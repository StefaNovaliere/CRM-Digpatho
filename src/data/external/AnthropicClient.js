/**
 * AnthropicClient - handles API calls to Claude.
 *
 * SECURITY NOTE: In production, this should go through an Edge Function proxy
 * so the API key never touches the browser. The proxy is at
 * supabase/functions/anthropic-proxy/index.ts
 */
import { env } from '../../infrastructure/config/env';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export class AnthropicClient {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  async generateMessage(systemPrompt, userMessage, options = {}) {
    const {
      model = 'claude-sonnet-4-20250514',
      maxTokens = 1500,
      temperature = 0.7
    } = options;

    // Prefer Edge Function proxy (API key stays server-side)
    const useProxy = !env.ANTHROPIC_API_KEY;

    if (useProxy) {
      return this._callViaProxy(systemPrompt, userMessage, { model, maxTokens, temperature });
    }

    return this._callDirect(systemPrompt, userMessage, { model, maxTokens, temperature });
  }

  async _callViaProxy(systemPrompt, userMessage, { model, maxTokens, temperature }) {
    const { data, error } = await this.supabase.functions.invoke('anthropic-proxy', {
      body: {
        system: systemPrompt,
        message: userMessage,
        model,
        max_tokens: maxTokens,
        temperature
      }
    });

    if (error) throw new Error(error.message || 'Error en proxy de Anthropic');
    return {
      content: data.content,
      usage: data.usage,
      model: data.model
    };
  }

  async _callDirect(systemPrompt, userMessage, { model, maxTokens, temperature }) {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Error en la API de Anthropic');
    }

    const data = await response.json();
    return {
      content: data.content[0].text,
      usage: {
        inputTokens: data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens
      },
      model: data.model
    };
  }
}
