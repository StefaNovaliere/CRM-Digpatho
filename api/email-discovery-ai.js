// api/email-discovery-ai.js
// Vercel Serverless Function — AI-Powered Email Discovery via Vertex AI
// Searches the open web for email addresses of growth leads using
// Gemini 2.0 Flash + Google Search grounding.
// POST /api/email-discovery-ai { lead_ids: [...] }

import { createClient } from '@supabase/supabase-js';
import { getVertexAccessToken, getVertexConfig } from './_vertex-auth.js';
import { discoverEmailForContact } from './_vertex-email.js';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  return createClient(url, key);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const accessToken = await getVertexAccessToken(req);
    const config = getVertexConfig();

    const { lead_ids } = req.body || {};
    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({ error: 'lead_ids array is required' });
    }

    const idsToProcess = lead_ids.slice(0, 10);
    const supabase = getSupabase();

    const { data: leads, error: fetchErr } = await supabase
      .from('growth_leads')
      .select('*')
      .in('id', idsToProcess);

    if (fetchErr) throw fetchErr;
    if (!leads || leads.length === 0) {
      return res.status(404).json({ error: 'No leads found' });
    }

    const leadsToSearch = leads.filter(l => !l.email);

    const results = {
      total: leadsToSearch.length,
      found: 0,
      not_found: 0,
      errors: 0,
      already_had_email: leads.length - leadsToSearch.length,
      details: [],
    };

    let consecutiveRateLimits = 0;

    for (let i = 0; i < leadsToSearch.length; i++) {
      const lead = leadsToSearch[i];
      const result = await discoverEmailForContact(accessToken, config, lead);

      if (result.email) {
        consecutiveRateLimits = 0;

        const updateData = {
          email: result.email,
          updated_at: new Date().toISOString(),
        };

        let updateErr;
        const metadataFields = {
          email_discovery_method: 'vertex_ai_search',
          email_confidence: result.confidence || 'medium',
        };
        if (result.sourceUrl) {
          metadataFields.email_source_url = result.sourceUrl;
        }

        const { error: fullUpdateErr } = await supabase
          .from('growth_leads')
          .update({ ...updateData, ...metadataFields })
          .eq('id', lead.id);

        if (fullUpdateErr && fullUpdateErr.message?.includes('column')) {
          const { error: fallbackErr } = await supabase
            .from('growth_leads')
            .update(updateData)
            .eq('id', lead.id);
          updateErr = fallbackErr;
        } else {
          updateErr = fullUpdateErr;
        }

        if (updateErr) {
          results.errors++;
          results.details.push({
            lead_id: lead.id,
            name: lead.full_name,
            status: 'error',
            error: updateErr.message,
          });
        } else {
          results.found++;
          results.details.push({
            lead_id: lead.id,
            name: lead.full_name,
            status: 'found',
            email: result.email,
            confidence: result.confidence,
            source_url: result.sourceUrl || null,
            source_description: result.sourceDescription || null,
            alternative_emails: result.alternativeEmails || [],
            notes: result.notes || null,
          });
        }
      } else if (result.error === 'permission_denied') {
        return res.status(403).json({
          error: 'permission_denied',
          message: 'El service account de Vertex AI no tiene permisos. Verificá los roles en GCP IAM.',
          apiError: result.apiError || null,
          partialResults: results,
        });
      } else if (result.error === 'rate_limit') {
        consecutiveRateLimits++;
        results.errors++;
        results.details.push({
          lead_id: lead.id,
          name: lead.full_name,
          status: 'rate_limited',
          apiError: result.apiError || null,
        });

        if (consecutiveRateLimits >= 3) {
          console.log(`3 consecutive rate limits — stopping. Last error: ${result.apiError}`);
          break;
        }
      } else {
        consecutiveRateLimits = 0;
        results.not_found++;
        results.details.push({
          lead_id: lead.id,
          name: lead.full_name,
          status: 'not_found',
          notes: result.notes || result.error || null,
        });
      }

      if (i < leadsToSearch.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return res.status(200).json({ success: true, results });
  } catch (err) {
    console.error('AI email discovery error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
