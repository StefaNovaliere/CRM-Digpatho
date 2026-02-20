// src/api/anthropic.js
// Frontend client that calls the server-side proxy (/api/anthropic-proxy)
// instead of calling the Anthropic API directly from the browser.
// This keeps the API key server-side and never exposes it to the client.

const PROXY_URL = '/api/anthropic-proxy';

export const anthropicClient = {
  /**
   * Genera un mensaje usando Claude a través del proxy server-side
   * @param {string} systemPrompt - Instrucciones del sistema
   * @param {string} userMessage - Mensaje del usuario
   * @param {object} options - Opciones adicionales
   */
  async generateMessage(systemPrompt, userMessage, options = {}) {
    const {
      model = 'claude-sonnet-4-5-20250929',
      maxTokens = 1024,
      temperature = 0.7
    } = options;

    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt,
        userMessage,
        model,
        maxTokens,
        temperature,
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error en la API de Anthropic');
    }

    return response.json();
  },

  /**
   * Genera un email de seguimiento
   */
  async generateFollowUpEmail(context) {
    const { EMAIL_AGENT_SYSTEM_PROMPT, buildEmailGenerationPrompt } = await import('../config/aiPrompts');
    const userPrompt = buildEmailGenerationPrompt(context.contact, context.interactions, 'follow-up');
    return this.generateMessage(EMAIL_AGENT_SYSTEM_PROMPT, userPrompt);
  },

  /**
   * Genera un email de primer contacto
   */
  async generateFirstContactEmail(context) {
    const { EMAIL_AGENT_SYSTEM_PROMPT, buildEmailGenerationPrompt } = await import('../config/aiPrompts');
    const userPrompt = buildEmailGenerationPrompt(context.contact, [], 'first-contact');
    return this.generateMessage(EMAIL_AGENT_SYSTEM_PROMPT, userPrompt);
  },

  /**
   * Mejora un borrador existente
   */
  async improveEmailDraft(draft, instructions) {
    const systemPrompt = `Eres un asistente que mejora borradores de emails comerciales para Digpatho IA, una startup de biotecnología.
Mantén el tono profesional y científico. Sé conciso.`;

    const userPrompt = `## Borrador actual:
Asunto: ${draft.subject}

${draft.body}

## Instrucciones de mejora:
${instructions}

Por favor, genera una versión mejorada manteniendo el formato:
**Asunto:** [nuevo asunto]
**Cuerpo:** [nuevo cuerpo]`;

    return this.generateMessage(systemPrompt, userPrompt);
  }
};

export default anthropicClient;
