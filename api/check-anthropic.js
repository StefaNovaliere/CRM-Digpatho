// api/check-anthropic.js
// Diagnostic endpoint to verify Anthropic API key configuration and account status.
// GET /api/check-anthropic

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;

  const diagnostics = {
    keySource: process.env.ANTHROPIC_API_KEY
      ? 'ANTHROPIC_API_KEY'
      : process.env.VITE_ANTHROPIC_API_KEY
        ? 'VITE_ANTHROPIC_API_KEY'
        : null,
    keyPresent: !!anthropicKey,
    keyPreview: anthropicKey
      ? `${anthropicKey.slice(0, 10)}...${anthropicKey.slice(-4)}`
      : null,
    keyLength: anthropicKey ? anthropicKey.length : 0,
    apiStatus: null,
    accountError: null,
  };

  if (!anthropicKey) {
    diagnostics.apiStatus = 'NO_KEY';
    diagnostics.accountError = 'No se encontró ANTHROPIC_API_KEY ni VITE_ANTHROPIC_API_KEY en las variables de entorno.';
    return res.status(200).json(diagnostics);
  }

  // Test the key with a minimal API call
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });

    if (response.ok) {
      diagnostics.apiStatus = 'OK';
      return res.status(200).json(diagnostics);
    }

    const errText = await response.text();
    let errData;
    try { errData = JSON.parse(errText); } catch { errData = { raw: errText.slice(0, 500) }; }

    const errorMessage = errData?.error?.message || errText.slice(0, 300);

    if (errorMessage.includes('credit balance')) {
      diagnostics.apiStatus = 'NO_CREDITS';
      diagnostics.accountError =
        'La API key es VÁLIDA, pero la cuenta de Anthropic NO tiene créditos. ' +
        'Necesitás cargar créditos en: https://console.anthropic.com/settings/billing';
    } else if (response.status === 401) {
      diagnostics.apiStatus = 'INVALID_KEY';
      diagnostics.accountError =
        'La API key es INVÁLIDA o fue revocada. Generá una nueva en: https://console.anthropic.com/settings/keys';
    } else if (response.status === 403) {
      diagnostics.apiStatus = 'FORBIDDEN';
      diagnostics.accountError =
        'La API key no tiene permisos para este recurso. Verificá los permisos en la consola de Anthropic.';
    } else {
      diagnostics.apiStatus = `HTTP_${response.status}`;
      diagnostics.accountError = errorMessage;
    }

    return res.status(200).json(diagnostics);
  } catch (err) {
    diagnostics.apiStatus = 'NETWORK_ERROR';
    diagnostics.accountError = `Error de red al conectar con Anthropic: ${err.message}`;
    return res.status(200).json(diagnostics);
  }
}
