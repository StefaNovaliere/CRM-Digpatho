// api/vertex-email-search.js
// Vercel Serverless Function — Búsqueda masiva de emails con Vertex AI.
// A diferencia de email-discovery-ai.js (que trabaja con lead_ids de la DB),
// este endpoint acepta una lista libre de contactos (nombre + características)
// y busca el email de cada uno en la web abierta con Gemini + Google Search.
//
// POST /api/vertex-email-search
//   { contacts: [{ first_name, last_name, organization?, location?, specialty?, context? }, ...] }

import { getVertexAccessToken, getVertexConfig } from './_vertex-auth.js';
import { discoverEmailForContact } from './_vertex-email.js';

function normalizeContact(raw) {
  const first_name = (raw.first_name || '').trim();
  const last_name = (raw.last_name || '').trim();
  const full_name = `${first_name} ${last_name}`.trim();
  const organization = (raw.organization_name || raw.organization || raw.company || raw.institution || '').trim();
  const location = (raw.location || raw.geo || raw.country || raw.city || '').trim();
  const specialty = (raw.specialty || raw.area || '').trim();
  const context = (raw.context || raw.notes || '').trim();
  const linkedin_url = (raw.linkedin_url || '').trim();

  return { first_name, last_name, full_name, organization, location, specialty, context, linkedin_url };
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

    const { contacts } = req.body || {};
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'contacts array is required' });
    }

    const normalized = contacts
      .map(normalizeContact)
      .filter(c => c.full_name);

    if (normalized.length === 0) {
      return res.status(400).json({ error: 'No contacts with a valid name were provided' });
    }

    const results = [];
    let consecutiveRateLimits = 0;

    for (let i = 0; i < normalized.length; i++) {
      const contact = normalized[i];

      const result = await discoverEmailForContact(accessToken, config, {
        full_name: contact.full_name,
        company: contact.organization,
        geo: contact.location,
        specialty: contact.specialty,
        context: contact.context,
        linkedin_url: contact.linkedin_url,
      });

      if (result.email) {
        consecutiveRateLimits = 0;
        results.push({
          input: contact,
          status: 'found',
          email: result.email,
          confidence: result.confidence || null,
          source_url: result.sourceUrl || null,
          source_description: result.sourceDescription || null,
          alternative_emails: result.alternativeEmails || [],
          notes: result.notes || null,
        });
      } else if (result.error === 'rate_limit') {
        consecutiveRateLimits++;
        results.push({
          input: contact,
          status: 'error',
          email: null,
          error: 'Rate limit alcanzado',
        });
        if (consecutiveRateLimits >= 3) break;
      } else if (result.error === 'permission_denied') {
        return res.status(403).json({
          error: 'permission_denied',
          message: 'El service account de Vertex AI no tiene permisos. Verificá los roles en GCP IAM.',
          apiError: result.apiError || null,
        });
      } else {
        consecutiveRateLimits = 0;
        results.push({
          input: contact,
          status: 'not_found',
          email: null,
          notes: result.notes || result.error || null,
        });
      }

      if (i < normalized.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const found = results.filter(r => r.status === 'found').length;
    const notFound = results.filter(r => r.status === 'not_found').length;
    const errored = results.filter(r => r.status === 'error').length;

    return res.status(200).json({
      success: true,
      summary: {
        total: results.length,
        found,
        not_found: notFound,
        errors: errored,
      },
      results,
    });
  } catch (err) {
    console.error('Vertex email search error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
