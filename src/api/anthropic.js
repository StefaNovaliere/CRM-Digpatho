// src/api/anthropic.js
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export const anthropicClient = {
  /**
   * Genera un mensaje usando la API de Claude
   * @param {string} systemPrompt - Instrucciones del sistema
   * @param {string} userMessage - Mensaje del usuario
   * @param {object} options - Opciones adicionales
   */
  async generateMessage(systemPrompt, userMessage, options = {}) {
    const {
      model = 'claude-sonnet-4-20250514',
      maxTokens = 1024,
      temperature = 0.7
    } = options;

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userMessage }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Error en la API de Anthropic');
    }

    const data = await response.json();

    return {
      content: data.content[0].text,
      usage: {
        inputTokens: data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens
      },
      model: data.model,
      stopReason: data.stop_reason
    };
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
