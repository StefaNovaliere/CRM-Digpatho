/**
 * Anthropic Proxy Edge Function
 *
 * PURPOSE: Keep the Anthropic API key server-side only.
 * The frontend calls this function instead of hitting the Anthropic API directly.
 * This prevents the API key from being exposed in the browser.
 *
 * Required Supabase Secrets:
 * - ANTHROPIC_API_KEY: Your Anthropic API key
 *
 * Optional:
 * - ALLOWED_ORIGINS: Comma-separated list of allowed origins (default: *)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// Restrict CORS to your domain in production
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '*').split(',').map(s => s.trim());

function getCorsHeaders(origin: string | null) {
  const allowOrigin = allowedOrigins.includes('*')
    ? '*'
    : (origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0]);

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Verify the user is authenticated via Supabase JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Anthropic API key from server-side secrets
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      console.error('ANTHROPIC_API_KEY not configured in Supabase secrets');
      return new Response(JSON.stringify({ error: 'Servicio no configurado' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body = await req.json();
    const {
      system,
      message,
      model = 'claude-sonnet-4-20250514',
      max_tokens = 1500,
      temperature = 0.7
    } = body;

    if (!message) {
      return new Response(JSON.stringify({ error: 'El campo "message" es obligatorio' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Forward to Anthropic API
    const anthropicResponse = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens,
        temperature,
        system: system || undefined,
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!anthropicResponse.ok) {
      const errorData = await anthropicResponse.json();
      console.error('Anthropic API error:', errorData);
      return new Response(JSON.stringify({
        error: errorData.error?.message || 'Error en la API de IA'
      }), {
        status: anthropicResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await anthropicResponse.json();

    return new Response(JSON.stringify({
      content: data.content[0]?.text || '',
      model: data.model,
      usage: {
        input_tokens: data.usage?.input_tokens,
        output_tokens: data.usage?.output_tokens,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
