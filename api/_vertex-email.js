// api/_vertex-email.js
// Núcleo de búsqueda de email vía Vertex AI (Gemini 2.0 Flash + Google Search
// grounding). Compartido entre:
//   - api/email-discovery-ai.js   (discovery individual, leads de la DB)
//   - api/vertex-email-search.js  (búsqueda masiva desde Excel)

import { getVertexAccessToken, getVertexConfig } from './_vertex-auth.js';

const VERTEX_MODEL = process.env.VERTEX_AI_MODEL || 'gemini-2.5-flash';
const RETRY_DELAYS = [2000, 4000, 8000];

function buildPrompt(contact) {
  const fullName = (contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim());
  if (!fullName) return null;

  const contextParts = [
    `Full name: ${fullName}`,
    contact.company || contact.organization ? `Organization/Company: ${contact.company || contact.organization}` : null,
    contact.job_title ? `Job title: ${contact.job_title}` : null,
    contact.geo || contact.location ? `Geography/Location: ${contact.geo || contact.location}` : null,
    contact.specialty ? `Specialty/Field: ${contact.specialty}` : null,
    contact.linkedin_url ? `LinkedIn: ${contact.linkedin_url}` : null,
    contact.context ? `Additional context: ${contact.context}` : null,
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

Respond in this exact JSON format:
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

function buildVertexEndpoint(projectId, region) {
  // La región `global` usa el host sin prefijo; las regionales lo llevan.
  const host = region === 'global'
    ? 'aiplatform.googleapis.com'
    : `${region}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${projectId}/locations/${region}/publishers/google/models/${VERTEX_MODEL}:generateContent`;
}

function parseGeminiResponse(apiResponse) {
  const candidate = apiResponse.candidates?.[0];
  if (!candidate?.content?.parts?.length) {
    return { email: null, error: 'no_text_response' };
  }

  let text = candidate.content.parts
    .filter(p => p.text)
    .map(p => p.text)
    .join('');

  // Strip markdown code block wrapping
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');

  // Grounding metadata — verified source URLs from Google Search
  const groundingChunks = candidate.groundingMetadata?.groundingChunks || [];
  const groundingUrl = groundingChunks[0]?.web?.uri || null;

  // Parse JSON response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        email: parsed.found ? (parsed.email || null) : null,
        alternativeEmails: parsed.alternative_emails || [],
        sourceUrl: parsed.source_url || groundingUrl || null,
        sourceDescription: parsed.source_description || null,
        confidence: parsed.confidence || 'low',
        notes: parsed.notes || null,
      };
    } catch (_) {
      // JSON parse failed — try regex fallback
    }
  }

  // Fallback: extract emails via regex
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const foundEmails = (text.match(emailRegex) || []).filter(
    e => !e.endsWith('email.com') && !e.endsWith('example.com')
  );

  if (foundEmails.length > 0) {
    return {
      email: foundEmails[0],
      alternativeEmails: foundEmails.slice(1),
      sourceUrl: groundingUrl,
      confidence: 'low',
      notes: 'Extracted via regex fallback from unstructured response',
    };
  }

  return { email: null, error: 'no_email_found' };
}

export async function discoverEmailForContact(accessToken, config, contact) {
  const prompt = buildPrompt(contact);
  if (!prompt) return { email: null, error: 'No name available' };

  const endpoint = buildVertexEndpoint(config.projectId, config.region);

  const requestBody = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
      // gemini-2.5-flash tiene "thinking" on por defecto, que consume tokens
      // de salida. Para esta extracción simple lo desactivamos.
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  let lastError = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: requestBody,
      });

      if (response.ok) {
        const data = await response.json();
        return parseGeminiResponse(data);
      }

      const text = await response.text();
      const isRetryable = response.status === 429 || response.status === 503;

      if (isRetryable && attempt < RETRY_DELAYS.length) {
        console.log(`Vertex AI ${response.status} — retry ${attempt + 1}/${RETRY_DELAYS.length} in ${RETRY_DELAYS[attempt]}ms`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
        lastError = { status: response.status, text: text.slice(0, 300) };
        continue;
      }

      if (response.status === 429) {
        return { email: null, error: 'rate_limit', apiError: text.slice(0, 300) };
      }
      if (response.status === 403) {
        return { email: null, error: 'permission_denied', apiError: text.slice(0, 300) };
      }
      return { email: null, error: `Vertex AI ${response.status}: ${text.slice(0, 300)}` };
    } catch (err) {
      if (attempt < RETRY_DELAYS.length) {
        console.log(`Network error — retry ${attempt + 1}/${RETRY_DELAYS.length}`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
        lastError = { status: 0, text: err.message };
        continue;
      }
      return { email: null, error: err.message };
    }
  }

  return { email: null, error: 'rate_limit', apiError: lastError?.text || 'All retries exhausted' };
}
