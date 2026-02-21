// api/lead-enrich-description.js
// Vercel Serverless Function — AI-Powered Lead Description Enrichment via Anthropic web_search
// Searches the open web for professional information about a growth lead and generates
// a rich, detailed description using Claude + web search.
// POST /api/lead-enrich-description { lead_id: "uuid" }

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Build the enrichment prompt for a single lead
// ---------------------------------------------------------------------------
function buildEnrichmentPrompt(lead) {
  const fullName = (lead.full_name || '').trim();
  if (!fullName) return null;

  const contextParts = [
    `Full name: ${fullName}`,
    lead.company ? `Organization/Company: ${lead.company}` : null,
    lead.job_title ? `Job title: ${lead.job_title}` : null,
    lead.geo ? `Geography: ${lead.geo}` : null,
    lead.linkedin_url ? `LinkedIn: ${lead.linkedin_url}` : null,
    lead.extra_data?.description ? `Current snippet: ${lead.extra_data.description}` : null,
  ].filter(Boolean).join('\n');

  return `Research the following professional and build a comprehensive profile description. Use web search to find real, verifiable information.

${contextParts}

Search for information on:
1. Their professional background, career history, and current role details
2. Their organization — what it does, its relevance in the industry
3. Published research papers, articles, or patents they have authored
4. Conference talks, keynote appearances, or panel participations
5. Professional memberships, board positions, or advisory roles
6. Notable achievements, awards, or recognitions
7. Areas of expertise and specialization
8. Any recent news, interviews, or public statements

IMPORTANT RULES:
- Only include information you actually find on the web. Never invent or assume details.
- Write in Spanish (the CRM is in Spanish).
- Be factual and professional. No speculation or flattery.
- If you find very little, say so honestly — a short but accurate description is better than a fabricated long one.
- Structure the description with clear sections when there is enough information.

Respond in this exact JSON format and nothing else:
{
  "description": "The full enriched description text (multi-paragraph, in Spanish). Use line breaks between sections.",
  "sources": ["https://url1.com", "https://url2.com"],
  "confidence": "high" or "medium" or "low",
  "sections_found": ["background", "publications", "talks", "awards", "expertise"]
}

If you cannot find meaningful information beyond what was already known, return:
{
  "description": null,
  "sources": [],
  "confidence": "low",
  "notes": "Explanation of why enrichment was not possible"
}`;
}

// ---------------------------------------------------------------------------
// Call Anthropic API with web_search tool (with retry + exponential backoff)
// ---------------------------------------------------------------------------
const RETRY_DELAYS = [3000, 6000, 12000];

async function enrichDescriptionViaAI(apiKey, lead) {
  const prompt = buildEnrichmentPrompt(lead);
  if (!prompt) return { description: null, error: 'No name available' };

  const requestBody = JSON.stringify({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    messages: [
      { role: 'user', content: prompt },
    ],
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 10,
      },
    ],
  });

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };

  let lastError = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: requestBody,
      });

      if (response.ok) {
        const data = await response.json();
        return parseEnrichmentResponse(data);
      }

      const text = await response.text();
      const isRetryable = response.status === 429 || response.status === 529;

      if (isRetryable && attempt < RETRY_DELAYS.length) {
        const retryAfterHeader = response.headers.get('retry-after');
        const delay = retryAfterHeader
          ? Math.min(parseInt(retryAfterHeader, 10) * 1000, 30000)
          : RETRY_DELAYS[attempt];

        console.log(`Anthropic ${response.status} for "${lead.full_name}" enrichment — retry ${attempt + 1}/${RETRY_DELAYS.length} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        lastError = { status: response.status, text: text.slice(0, 300) };
        continue;
      }

      if (response.status === 429) {
        return { description: null, error: 'rate_limit', apiError: text.slice(0, 300) };
      }
      if (response.status === 529) {
        return { description: null, error: 'api_overloaded', apiError: text.slice(0, 300) };
      }
      if (text.includes('credit balance')) {
        return { description: null, error: 'no_credits', apiError: text.slice(0, 300) };
      }
      return { description: null, error: `Anthropic API ${response.status}: ${text.slice(0, 300)}` };
    } catch (err) {
      if (attempt < RETRY_DELAYS.length) {
        console.log(`Network error for "${lead.full_name}" enrichment — retry ${attempt + 1}/${RETRY_DELAYS.length}`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
        lastError = { status: 0, text: err.message };
        continue;
      }
      return { description: null, error: err.message };
    }
  }

  return { description: null, error: 'rate_limit', apiError: lastError?.text || 'All retries exhausted' };
}

// ---------------------------------------------------------------------------
// Strip <cite index="…">…</cite> tags from web_search responses
// ---------------------------------------------------------------------------
function stripCiteTags(text) {
  if (!text) return text;
  return text.replace(/<\/?cite[^>]*>/gi, '');
}

// ---------------------------------------------------------------------------
// Parse the AI response — extract JSON
// ---------------------------------------------------------------------------
function parseEnrichmentResponse(apiResponse) {
  const textBlocks = (apiResponse.content || []).filter(b => b.type === 'text');
  if (textBlocks.length === 0) return { description: null, error: 'no_text_response' };

  const lastText = textBlocks[textBlocks.length - 1].text;

  // Try to parse JSON from the response
  const jsonMatch = lastText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.description) {
        return {
          description: stripCiteTags(parsed.description),
          sources: parsed.sources || [],
          confidence: parsed.confidence || 'medium',
          sections_found: parsed.sections_found || [],
          searchCount: apiResponse.usage?.server_tool_use?.web_search_requests || 0,
        };
      }
      return {
        description: null,
        error: 'no_enrichment_found',
        notes: parsed.notes || 'No additional information found',
        searchCount: apiResponse.usage?.server_tool_use?.web_search_requests || 0,
      };
    } catch (_) {
      // JSON parse failed — try to use raw text as description
    }
  }

  // Fallback: use the entire text response as description if it's substantial
  const cleanText = stripCiteTags(lastText.trim());
  if (cleanText.length > 100) {
    return {
      description: cleanText,
      sources: [],
      confidence: 'low',
      sections_found: [],
      notes: 'Extracted from unstructured response',
      searchCount: apiResponse.usage?.server_tool_use?.web_search_requests || 0,
    };
  }

  return { description: null, error: 'no_useful_response' };
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
    const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return res.status(400).json({
        error: 'ANTHROPIC_API_KEY not configured. Set VITE_ANTHROPIC_API_KEY in environment variables.',
      });
    }

    const { lead_id } = req.body || {};
    if (!lead_id) {
      return res.status(400).json({ error: 'lead_id is required' });
    }

    const supabase = getSupabase();

    // Fetch lead from DB
    const { data: lead, error: fetchErr } = await supabase
      .from('growth_leads')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (fetchErr) throw fetchErr;
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Call Claude to enrich
    const result = await enrichDescriptionViaAI(anthropicKey, lead);

    if (result.description) {
      // Update extra_data with enriched description
      const updatedExtraData = {
        ...(lead.extra_data || {}),
        description: result.description,
        description_sources: result.sources || [],
        description_enriched_at: new Date().toISOString(),
        description_confidence: result.confidence || 'medium',
        description_original: lead.extra_data?.description || null,
      };

      const { error: updateErr } = await supabase
        .from('growth_leads')
        .update({
          extra_data: updatedExtraData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', lead_id);

      if (updateErr) throw updateErr;

      return res.status(200).json({
        success: true,
        result: {
          description: result.description,
          sources: result.sources || [],
          confidence: result.confidence,
          sections_found: result.sections_found || [],
          search_count: result.searchCount || 0,
        },
      });
    }

    // Enrichment failed or found nothing
    if (result.error === 'no_credits') {
      return res.status(402).json({
        error: 'no_credits',
        message: 'Tu cuenta de Anthropic no tiene créditos suficientes. Cargá créditos en https://console.anthropic.com/settings/billing',
        apiError: result.apiError || null,
      });
    }
    if (result.error === 'rate_limit' || result.error === 'api_overloaded') {
      return res.status(429).json({
        error: 'rate_limit',
        message: 'Límite de API alcanzado. Intentá de nuevo en unos minutos.',
        apiError: result.apiError || null,
      });
    }

    return res.status(200).json({
      success: false,
      result: {
        description: null,
        error: result.error || 'no_enrichment_found',
        notes: result.notes || 'No se encontró información adicional para este lead.',
      },
    });
  } catch (err) {
    console.error('Lead description enrichment error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
