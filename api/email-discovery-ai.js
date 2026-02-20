// api/email-discovery-ai.js
// Vercel Serverless Function — AI-Powered Email Discovery via Anthropic web_search
// Searches the open web for email addresses of growth leads using Claude + web search.
// POST /api/email-discovery-ai { lead_ids: [...] }
// Reuses VITE_ANTHROPIC_API_KEY already configured in the environment.

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Build the search prompt for a single lead
// ---------------------------------------------------------------------------
function buildPrompt(lead) {
  const fullName = (lead.full_name || '').trim();
  if (!fullName) return null;

  const contextParts = [
    `Full name: ${fullName}`,
    lead.company ? `Organization/Company: ${lead.company}` : null,
    lead.job_title ? `Job title: ${lead.job_title}` : null,
    lead.geo ? `Geography: ${lead.geo}` : null,
    lead.linkedin_url ? `LinkedIn: ${lead.linkedin_url}` : null,
  ].filter(Boolean).join('\n');

  return `Find the professional email address for this person:

${contextParts}

Search for their email on:
1. Their organization/university/hospital website (staff directory, faculty page, "about us")
2. Conference speaker lists or published papers that list contact info
3. Regulatory body directories or professional association member lists
4. Their personal or professional website/blog
5. Published research papers (author contact info)

IMPORTANT RULES:
- Only return email addresses you actually find on a web page. Never guess or construct email addresses.
- If you find multiple emails, prefer the professional/institutional one over personal (gmail, hotmail, etc).
- Report exactly where you found each email (the URL).

Respond in this exact JSON format and nothing else:
{
  "found": true or false,
  "email": "the@email.com" or null,
  "alternative_emails": [] or ["other@email.com"],
  "source_url": "https://page-where-found.com" or null,
  "source_description": "Faculty directory of University X" or null,
  "confidence": "high" or "medium" or "low",
  "notes": "any relevant context"
}

If you cannot find an email, set found to false and explain in notes why.`;
}

// ---------------------------------------------------------------------------
// Call Anthropic API with web_search tool (with retry + exponential backoff)
// ---------------------------------------------------------------------------
const RETRY_DELAYS = [3000, 6000, 12000]; // 3s, 6s, 12s

async function discoverEmailViaAI(apiKey, lead) {
  const prompt = buildPrompt(lead);
  if (!prompt) return { email: null, error: 'No name available' };

  const requestBody = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      { role: 'user', content: prompt },
    ],
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 5,
      },
    ],
  });

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };

  let lastError = null;

  // Try initial request + up to 3 retries
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: requestBody,
      });

      if (response.ok) {
        const data = await response.json();
        return parseAIResponse(data);
      }

      const text = await response.text();
      const isRetryable = response.status === 429 || response.status === 529;

      if (isRetryable && attempt < RETRY_DELAYS.length) {
        // Respect Retry-After header if present, otherwise use exponential backoff
        const retryAfterHeader = response.headers.get('retry-after');
        const delay = retryAfterHeader
          ? Math.min(parseInt(retryAfterHeader, 10) * 1000, 30000)
          : RETRY_DELAYS[attempt];

        console.log(`Anthropic ${response.status} for "${lead.full_name}" — retry ${attempt + 1}/${RETRY_DELAYS.length} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        lastError = { status: response.status, text: text.slice(0, 300) };
        continue;
      }

      // Non-retryable error or retries exhausted
      if (response.status === 429) {
        return { email: null, error: 'rate_limit', apiError: text.slice(0, 300) };
      }
      if (response.status === 529) {
        return { email: null, error: 'api_overloaded', apiError: text.slice(0, 300) };
      }
      return { email: null, error: `Anthropic API ${response.status}: ${text.slice(0, 300)}` };
    } catch (err) {
      if (attempt < RETRY_DELAYS.length) {
        console.log(`Network error for "${lead.full_name}" — retry ${attempt + 1}/${RETRY_DELAYS.length}`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
        lastError = { status: 0, text: err.message };
        continue;
      }
      return { email: null, error: err.message };
    }
  }

  // All retries exhausted
  return { email: null, error: 'rate_limit', apiError: lastError?.text || 'All retries exhausted' };
}

// ---------------------------------------------------------------------------
// Parse the AI response — extract JSON or fall back to regex
// ---------------------------------------------------------------------------
function parseAIResponse(apiResponse) {
  const textBlocks = (apiResponse.content || []).filter(b => b.type === 'text');
  if (textBlocks.length === 0) return { email: null, error: 'no_text_response' };

  const lastText = textBlocks[textBlocks.length - 1].text;

  // Try to parse JSON from the response
  const jsonMatch = lastText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        email: parsed.found ? (parsed.email || null) : null,
        alternativeEmails: parsed.alternative_emails || [],
        sourceUrl: parsed.source_url || null,
        sourceDescription: parsed.source_description || null,
        confidence: parsed.confidence || 'low',
        notes: parsed.notes || null,
        searchCount: apiResponse.usage?.server_tool_use?.web_search_requests || 0,
      };
    } catch (_) {
      // JSON parse failed — try regex fallback
    }
  }

  // Fallback: extract emails via regex from the full text
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const foundEmails = (lastText.match(emailRegex) || []).filter(
    e => !e.endsWith('email.com') && !e.endsWith('example.com')
  );

  if (foundEmails.length > 0) {
    return {
      email: foundEmails[0],
      alternativeEmails: foundEmails.slice(1),
      confidence: 'low',
      notes: 'Extracted via regex fallback from unstructured response',
      searchCount: apiResponse.usage?.server_tool_use?.web_search_requests || 0,
    };
  }

  return { email: null, error: 'no_email_found' };
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

    const { lead_ids } = req.body || {};
    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({ error: 'lead_ids array is required' });
    }

    // Cap at 5 per request — each lead requires a full Claude API call with web search
    const idsToProcess = lead_ids.slice(0, 5);

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
      const result = await discoverEmailViaAI(anthropicKey, lead);

      if (result.email) {
        consecutiveRateLimits = 0; // Reset on success

        // Update lead email + discovery metadata in DB
        const updateData = {
          email: result.email,
          email_discovery_method: 'ai_web_search',
          email_confidence: result.confidence || 'medium',
          updated_at: new Date().toISOString(),
        };
        if (result.sourceUrl) {
          updateData.email_source_url = result.sourceUrl;
        }

        const { error: updateErr } = await supabase
          .from('growth_leads')
          .update(updateData)
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
            confidence: result.confidence,
            source_url: result.sourceUrl || null,
            source_description: result.sourceDescription || null,
            alternative_emails: result.alternativeEmails || [],
            notes: result.notes || null,
          });
        }
      } else if (result.error === 'rate_limit' || result.error === 'api_overloaded') {
        consecutiveRateLimits++;
        results.errors++;
        results.details.push({
          lead_id: lead.id,
          name: lead.full_name,
          status: 'rate_limited',
          apiError: result.apiError || null,
        });

        // Only stop after 3 consecutive rate limits (API is genuinely throttling us)
        if (consecutiveRateLimits >= 3) {
          console.log(`3 consecutive rate limits — stopping. Last error: ${result.apiError}`);
          break;
        }
      } else {
        consecutiveRateLimits = 0; // Reset on non-rate-limit responses
        results.not_found++;
        results.details.push({
          lead_id: lead.id,
          name: lead.full_name,
          status: 'not_found',
          notes: result.notes || result.error || null,
        });
      }

      // Delay between leads to avoid rate limiting (skip after last lead)
      if (i < leadsToSearch.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return res.status(200).json({ success: true, results });
  } catch (err) {
    console.error('AI email discovery error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
