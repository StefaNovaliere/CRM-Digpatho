// api/apollo-bulk-match.js
// Vercel Serverless Function — Bulk email lookup via Apollo.io
// Diferente del Growth System (que descubre leads en LinkedIn): este endpoint
// toma una lista de contactos YA conocidos (nombre + empresa) y le pregunta
// a Apollo el email profesional asociado.
//
// POST /api/apollo-bulk-match
//   { contacts: [{ first_name, last_name, organization_name?, domain?, linkedin_url? }, ...] }
//
// Apollo bulk_match endpoint: hasta 10 contactos por request.
// https://docs.apollo.io/reference/bulk-people-enrichment

const APOLLO_BULK_MATCH_URL = 'https://api.apollo.io/api/v1/people/bulk_match';
const APOLLO_BATCH_SIZE = 10;

function normalizeContact(raw) {
  const first_name = (raw.first_name || '').trim();
  const last_name = (raw.last_name || '').trim();
  const organization_name = (raw.organization_name || raw.company || raw.institution || '').trim();
  const domain = (raw.domain || '').trim();
  const linkedin_url = (raw.linkedin_url || '').trim();
  const full_name = `${first_name} ${last_name}`.trim();

  return { first_name, last_name, full_name, organization_name, domain, linkedin_url };
}

function buildApolloPayload(batch) {
  return {
    reveal_personal_emails: false,
    details: batch.map(c => {
      const detail = {};
      if (c.first_name) detail.first_name = c.first_name;
      if (c.last_name) detail.last_name = c.last_name;
      if (c.organization_name) detail.organization_name = c.organization_name;
      if (c.domain) detail.domain = c.domain;
      if (c.linkedin_url) detail.linkedin_url = c.linkedin_url;
      return detail;
    }),
  };
}

async function callApolloBatch(apiKey, batch) {
  const response = await fetch(APOLLO_BULK_MATCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'accept': 'application/json',
      'Cache-Control': 'no-cache',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(buildApolloPayload(batch)),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Apollo API ${response.status}: ${text.slice(0, 300)}`);
  }

  return response.json();
}

function extractResult(apolloMatch, inputContact) {
  // Apollo retorna `matches` como array paralelo al input `details`.
  // Cada match puede ser null (no encontrado) o un objeto Person.
  if (!apolloMatch) {
    return {
      input: inputContact,
      status: 'not_found',
      email: null,
      organization: null,
      linkedin_url: null,
      title: null,
      confidence: null,
    };
  }

  const email = apolloMatch.email || null;
  const status = email ? 'found' : 'not_found';

  return {
    input: inputContact,
    status,
    email,
    email_status: apolloMatch.email_status || null,
    organization: apolloMatch.organization?.name || apolloMatch.organization_name || null,
    organization_domain: apolloMatch.organization?.primary_domain || null,
    linkedin_url: apolloMatch.linkedin_url || null,
    title: apolloMatch.title || null,
    seniority: apolloMatch.seniority || null,
    city: apolloMatch.city || null,
    country: apolloMatch.country || null,
    photo_url: apolloMatch.photo_url || null,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.APOLLO_API_KEY || process.env.VITE_APOLLO_API_KEY;
  if (!apiKey) {
    return res.status(400).json({
      error: 'APOLLO_API_KEY not configured. Set APOLLO_API_KEY in environment variables.',
    });
  }

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
  const errors = [];

  for (let i = 0; i < normalized.length; i += APOLLO_BATCH_SIZE) {
    const batch = normalized.slice(i, i + APOLLO_BATCH_SIZE);

    try {
      const data = await callApolloBatch(apiKey, batch);
      const matches = data.matches || [];

      batch.forEach((contact, idx) => {
        results.push(extractResult(matches[idx], contact));
      });
    } catch (err) {
      console.error(`Apollo batch ${i}-${i + batch.length} failed:`, err.message);
      errors.push({ batch_start: i, error: err.message });
      // Marcar todos los del batch como error
      batch.forEach(contact => {
        results.push({
          input: contact,
          status: 'error',
          email: null,
          error: err.message,
        });
      });
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
    batch_errors: errors.length > 0 ? errors : undefined,
  });
}
