// api/_vertex-auth.js
// Autenticación con Google Cloud vía Workload Identity Federation (WIF).
// NO usa service-account key (no hay private_key). En su lugar, federa el
// OIDC token de Vercel con GCP:
//
//   1. Vercel inyecta un OIDC JWT por request (header x-vercel-oidc-token,
//      o env VERCEL_OIDC_TOKEN en build/local).
//   2. Se intercambia en STS (sts.googleapis.com) por un token federado.
//   3. Se impersona el service account (iamcredentials) para el access
//      token final con scope cloud-platform.
//   4. Ese access token va como Bearer a Vertex AI.
//
// El config WIF viene en la env var GCP_WIF_CONFIG (JSON type=external_account).
//
// El archivo arranca con "_" para que Vercel lo trate como módulo helper,
// no como una ruta /api.

const STS_URL = 'https://sts.googleapis.com/v1/token';
const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

// Cache del access token impersonado (válido ~1h). Vercel reutiliza
// instancias "warm", así que evitamos re-federar en cada request.
let cachedToken = null; // { token, expiresAt (ms) }

function parseWifConfig() {
  const raw = process.env.GCP_WIF_CONFIG;
  if (!raw) {
    throw new Error('GCP_WIF_CONFIG no está configurada en las variables de entorno.');
  }
  let config;
  try {
    config = JSON.parse(raw);
  } catch (err) {
    throw new Error('GCP_WIF_CONFIG no es un JSON válido: ' + err.message);
  }
  if (config.type !== 'external_account') {
    throw new Error(`GCP_WIF_CONFIG.type esperado "external_account", se recibió "${config.type}".`);
  }
  if (!config.audience || !config.service_account_impersonation_url) {
    throw new Error('GCP_WIF_CONFIG incompleta: faltan audience o service_account_impersonation_url.');
  }
  return config;
}

// El OIDC token de Vercel: header en funciones desplegadas, env var en build/local.
function getVercelOidcToken(req) {
  const headerToken = req?.headers?.['x-vercel-oidc-token'];
  return headerToken || process.env.VERCEL_OIDC_TOKEN || null;
}

// Paso 2: STS token exchange — OIDC JWT → token federado.
async function exchangeStsToken(audience, subjectToken) {
  const response = await fetch(STS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
      audience,
      scope: CLOUD_PLATFORM_SCOPE,
      requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
      subjectToken,
      subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`STS token exchange falló (${response.status}): ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('STS no devolvió access_token.');
  }
  return data.access_token;
}

// Paso 3: impersonación del service account → access token final.
async function impersonateServiceAccount(impersonationUrl, federatedToken) {
  const response = await fetch(impersonationUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${federatedToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      scope: [CLOUD_PLATFORM_SCOPE],
      lifetime: '3600s',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Impersonación del service account falló (${response.status}): ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  if (!data.accessToken) {
    throw new Error('La impersonación no devolvió accessToken.');
  }
  return { token: data.accessToken, expireTime: data.expireTime };
}

// Devuelve un access token válido para Vertex AI, cacheando entre invocaciones.
export async function getVertexAccessToken(req) {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) {
    return cachedToken.token;
  }

  const config = parseWifConfig();
  const oidcToken = getVercelOidcToken(req);
  if (!oidcToken) {
    throw new Error(
      'No se encontró el OIDC token de Vercel (x-vercel-oidc-token / VERCEL_OIDC_TOKEN). ' +
      'Verificá que OIDC Federation esté habilitado en el proyecto de Vercel.'
    );
  }

  const federatedToken = await exchangeStsToken(config.audience, oidcToken);
  const { token, expireTime } = await impersonateServiceAccount(
    config.service_account_impersonation_url,
    federatedToken
  );

  const expiresAt = expireTime ? new Date(expireTime).getTime() : now + 3600_000;
  cachedToken = { token, expiresAt };
  return token;
}

// Deriva projectId y region para construir el endpoint de Vertex AI.
// projectId: env override → parseado del email del SA en la URL de impersonación.
// region: env override → us-central1.
export function getVertexConfig() {
  const region = process.env.VERTEX_AI_REGION || 'global';

  let projectId = process.env.VERTEX_AI_PROJECT_ID || null;
  if (!projectId) {
    const config = parseWifConfig();
    // service_account_impersonation_url contiene:
    //   .../serviceAccounts/<name>@<project-id>.iam.gserviceaccount.com:generateAccessToken
    const match = config.service_account_impersonation_url.match(/@([^.]+)\.iam\.gserviceaccount\.com/);
    projectId = match ? match[1] : null;
  }

  if (!projectId) {
    throw new Error('No se pudo determinar el projectId de GCP. Configurá VERTEX_AI_PROJECT_ID.');
  }

  return { projectId, region };
}
