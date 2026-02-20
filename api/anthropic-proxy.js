// api/anthropic-proxy.js
// Vercel Serverless Function — Generic proxy for Anthropic Claude API calls.
// Keeps the API key server-side so it is never exposed to the browser.
// POST /api/anthropic-proxy { systemPrompt, userMessage, model?, maxTokens?, temperature? }

const RETRY_DELAYS = [3000, 6000, 12000];

async function callAnthropic(apiKey, { systemPrompt, userMessage, model, maxTokens, temperature }) {
  const requestBody = JSON.stringify({
    model: model || 'claude-sonnet-4-5-20250929',
    max_tokens: maxTokens || 1024,
    temperature: temperature ?? 0.7,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
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
        return { data };
      }

      const errText = await response.text();
      const isRetryable = response.status === 429 || response.status === 529;

      if (isRetryable && attempt < RETRY_DELAYS.length) {
        const retryAfterHeader = response.headers.get('retry-after');
        const delay = retryAfterHeader
          ? Math.min(parseInt(retryAfterHeader, 10) * 1000, 30000)
          : RETRY_DELAYS[attempt];
        console.log(`Anthropic ${response.status} — retry ${attempt + 1}/${RETRY_DELAYS.length} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        lastError = { status: response.status, text: errText.slice(0, 300) };
        continue;
      }

      if (response.status === 429) return { error: 'rate_limit', apiError: errText.slice(0, 300) };
      if (response.status === 529) return { error: 'api_overloaded', apiError: errText.slice(0, 300) };
      return { error: `Anthropic API ${response.status}: ${errText.slice(0, 300)}` };
    } catch (err) {
      if (attempt < RETRY_DELAYS.length) {
        console.log(`Network error — retry ${attempt + 1}/${RETRY_DELAYS.length}`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
        lastError = { status: 0, text: err.message };
        continue;
      }
      return { error: err.message };
    }
  }

  return { error: 'rate_limit', apiError: lastError?.text || 'All retries exhausted' };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return res.status(400).json({ error: 'ANTHROPIC_API_KEY not configured.' });
    }

    const { systemPrompt, userMessage, model, maxTokens, temperature } = req.body || {};

    if (!userMessage) {
      return res.status(400).json({ error: 'userMessage is required' });
    }

    const result = await callAnthropic(anthropicKey, {
      systemPrompt: systemPrompt || '',
      userMessage,
      model,
      maxTokens,
      temperature,
    });

    if (result.error) {
      if (result.error === 'rate_limit' || result.error === 'api_overloaded') {
        return res.status(429).json({
          error: result.error,
          message: 'Límite de API alcanzado. Intentá de nuevo en unos minutos.',
          apiError: result.apiError || null,
        });
      }
      return res.status(500).json({ error: result.error });
    }

    const data = result.data;
    return res.status(200).json({
      content: data.content[0].text,
      usage: {
        inputTokens: data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens,
      },
      model: data.model,
      stopReason: data.stop_reason,
    });
  } catch (err) {
    console.error('Anthropic proxy error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
