// api/email-enrichment.js
// Vercel Serverless Function — Email Enrichment via Apollo.io
// Searches for email addresses of growth leads using Apollo's People Match API.
// POST /api/email-enrichment { lead_ids: [...] }
// Requires APOLLO_API_KEY in environment variables.

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Apollo.io People Enrichment — find email by name + company
// ---------------------------------------------------------------------------
async function enrichViaApollo(apiKey, lead) {
  const nameParts = (lead.full_name || '').trim().split(/\s+/);
  const firstName = lead.first_name || nameParts[0] || '';
  const lastName = lead.last_name || nameParts.slice(1).join(' ') || '';

  if (!firstName) return { email: null, error: 'No name available' };

  const body = {
    first_name: firstName,
    last_name: lastName,
    reveal_personal_emails: true,
  };

  // Add company/organization if available
  if (lead.company) {
    body.organization_name = lead.company;
  }

  // Add LinkedIn URL for better matching
  if (lead.linkedin_url) {
    body.linkedin_url = lead.linkedin_url;
  }

  try {
    const response = await fetch('https://api.apollo.io/api/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      // Rate limit
      if (response.status === 429) {
        return { email: null, error: 'rate_limit', retryAfter: true };
      }
      return { email: null, error: `Apollo API ${response.status}: ${text.slice(0, 200)}` };
    }

    const data = await response.json();
    const person = data.person;

    if (!person) {
      return { email: null, error: 'no_match' };
    }

    // Prefer corporate email, fall back to personal
    const email = person.email
      || (person.personal_emails && person.personal_emails[0])
      || null;

    return {
      email,
      apolloData: {
        title: person.title || null,
        organization: person.organization?.name || null,
        city: person.city || null,
        country: person.country || null,
        linkedin_url: person.linkedin_url || null,
      },
    };
  } catch (err) {
    return { email: null, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const apolloKey = process.env.APOLLO_API_KEY;
    if (!apolloKey) {
      return res.status(400).json({
        error: 'APOLLO_API_KEY not configured. Set it in Vercel Environment Variables.',
      });
    }

    const { lead_ids } = req.body || {};
    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({ error: 'lead_ids array is required' });
    }

    // Cap at 25 per request to avoid timeouts
    const idsToProcess = lead_ids.slice(0, 25);

    const supabase = getSupabase();

    // Fetch leads from DB
    const { data: leads, error: fetchErr } = await supabase
      .from('growth_leads')
      .select('*')
      .in('id', idsToProcess);

    if (fetchErr) throw fetchErr;
    if (!leads || leads.length === 0) {
      return res.status(404).json({ error: 'No leads found' });
    }

    // Filter to only leads without email
    const leadsToEnrich = leads.filter(l => !l.email);

    const results = {
      total: leadsToEnrich.length,
      found: 0,
      not_found: 0,
      errors: 0,
      already_had_email: leads.length - leadsToEnrich.length,
      details: [],
    };

    for (const lead of leadsToEnrich) {
      const result = await enrichViaApollo(apolloKey, lead);

      if (result.email) {
        // Update lead email in DB
        const { error: updateErr } = await supabase
          .from('growth_leads')
          .update({
            email: result.email,
            updated_at: new Date().toISOString(),
          })
          .eq('id', lead.id);

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
          });
        }
      } else if (result.error === 'rate_limit') {
        results.errors++;
        results.details.push({
          lead_id: lead.id,
          name: lead.full_name,
          status: 'rate_limited',
        });
        // Stop processing on rate limit
        break;
      } else {
        results.not_found++;
        results.details.push({
          lead_id: lead.id,
          name: lead.full_name,
          status: 'not_found',
        });
      }

      // Small delay between requests to avoid rate limiting
      if (leadsToEnrich.indexOf(lead) < leadsToEnrich.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    return res.status(200).json({ success: true, results });
  } catch (err) {
    console.error('Email enrichment error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
