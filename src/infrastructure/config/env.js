/**
 * Environment configuration - centralized, validated, fail-fast.
 * All env access goes through here. No scattered import.meta.env calls.
 */

function requireEnv(key) {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(
      `[ENV] Missing required environment variable: ${key}. ` +
      `Check your .env.local file. See .env.example for reference.`
    );
  }
  return value;
}

function optionalEnv(key, defaultValue = '') {
  return import.meta.env[key] || defaultValue;
}

export const env = Object.freeze({
  // Supabase - REQUIRED
  SUPABASE_URL: requireEnv('VITE_SUPABASE_URL'),
  SUPABASE_ANON_KEY: requireEnv('VITE_SUPABASE_ANON_KEY'),

  // Anthropic - Optional (will use Edge Function proxy if not set)
  ANTHROPIC_API_KEY: optionalEnv('VITE_ANTHROPIC_API_KEY'),

  // Google OAuth - Optional (handled by Supabase OAuth)
  GOOGLE_CLIENT_ID: optionalEnv('VITE_GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET: optionalEnv('VITE_GOOGLE_CLIENT_SECRET'),

  // Resend - Optional
  RESEND_API_KEY: optionalEnv('VITE_RESEND_API_KEY'),
  EMAIL_FROM: optionalEnv('VITE_EMAIL_FROM', 'Digpatho CRM <noreply@digpatho.com>'),

  // App
  APP_NAME: optionalEnv('VITE_APP_NAME', 'Digpatho CRM'),

  // Computed
  get IS_DEV() { return import.meta.env.DEV; },
  get IS_PROD() { return import.meta.env.PROD; },
});

export default env;
