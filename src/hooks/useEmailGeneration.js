// src/hooks/useEmailGeneration.js
import { useState } from 'react';
import { supabase } from '../lib/supabase';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// ========================================
// SYSTEM PROMPTS POR TONO
// ========================================
const TONE_PROMPTS = {
  professional: `Eres un experto en comunicación empresarial B2B para el sector de salud y patología.
Tu tono es profesional, respetuoso y orientado a resultados.
Usas lenguaje formal pero no frío. Eres directo pero cortés.`,

  empathetic: `Eres un experto en comunicación empresarial B2B para el sector de salud y patología.
Tu tono es cálido, empático y comprensivo. Te preocupas genuinamente por los desafíos del profesional.
Construyes rapport antes de ir al punto. Muestras interés genuino en su trabajo.`,

  direct: `Eres un experto en comunicación empresarial B2B para el sector de salud y patología.
Tu tono es directo, conciso y eficiente. Vas al grano rápidamente.
Respetas el tiempo del lector. Emails cortos y con propósito claro.`
};

// ========================================
// INSTRUCCIONES POR TIPO DE EMAIL
// ========================================
const EMAIL_TYPE_INSTRUCTIONS = {
  'follow-up': 'Genera un email de seguimiento natural que retome la conversación previa.',
  'first-contact': 'Genera un email de primer contacto profesional para presentar Digpatho IA.',
  'post-meeting': 'Genera un email de resumen post-reunión con próximos pasos claros.',
  'reactivation': 'Genera un email para reactivar un contacto con el que hemos perdido comunicación.'
};

// ========================================
// HOOK PRINCIPAL
// ========================================
export const useEmailGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState(null);
  const [error, setError] = useState(null);

  /**
   * Genera un email personalizado
   * @param {string} contactId - ID del contacto
   * @param {string} emailType - Tipo de email (follow-up, first-contact, etc)
   * @param {object} config - Configuración contextual { tone, language }
   */
  const generateEmail = async (contactId, emailType = 'follow-up', config = {}) => {
    const { tone = 'professional', language = 'es' } = config;

    setIsGenerating(true);
    setError(null);
    setGeneratedDraft(null);

    try {
      // 1. Obtener datos completos del contacto
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select(`
          *,
          institution:institutions(*)
        `)
        .eq('id', contactId)
        .single();

      if (contactError) throw new Error('No se pudo cargar el contacto');

      // 2. Obtener últimas interacciones
      const { data: interactions } = await supabase
        .from('interactions')
        .select('*')
        .eq('contact_id', contactId)
        .order('occurred_at', { ascending: false })
        .limit(5);

      // 3. Construir el system prompt con el tono elegido
      const systemPrompt = buildSystemPrompt(tone, language);

      // 4. Construir el user prompt con contexto
      const userPrompt = buildUserPrompt(contact, interactions || [], emailType, language);

      // 5. Llamar a la API de Claude
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userPrompt }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Error al generar email');
      }

      const data = await response.json();
      const generatedText = data.content[0].text;

      // 6. Parsear el resultado
      const parsed = parseEmailResponse(generatedText);

      // 7. Guardar el borrador en la base de datos
      const { data: draft, error: draftError } = await supabase
        .from('email_drafts')
        .insert({
          contact_id: contactId,
          subject: parsed.subject,
          body: parsed.body,
          status: 'generated',
          generation_context: {
            email_type: emailType,
            tone: tone,
            language: language,
            contact_snapshot: {
              name: `${contact.first_name} ${contact.last_name}`,
              institution: contact.institution?.name,
              interest_level: contact.interest_level
            },
            interactions_count: interactions?.length || 0
          },
          ai_model: 'claude-sonnet-4-20250514',
          prompt_tokens: data.usage?.input_tokens,
          completion_tokens: data.usage?.output_tokens
        })
        .select()
        .single();

      if (draftError) {
        console.error('Error guardando borrador:', draftError);
      }

      const result = {
        id: draft?.id,
        subject: parsed.subject,
        body: parsed.body,
        notes: parsed.notes,
        contact,
        config: { tone, language, emailType },
        generatedAt: new Date().toISOString()
      };

      setGeneratedDraft(result);
      return result;

    } catch (err) {
      console.error('Error generando email:', err);
      setError(err.message);
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const clearDraft = () => {
    setGeneratedDraft(null);
    setError(null);
  };

  const updateDraftStatus = async (draftId, status, editedBody = null) => {
    const updates = { status };
    if (editedBody) {
      updates.edited_body = editedBody;
      updates.edited_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('email_drafts')
      .update(updates)
      .eq('id', draftId);

    if (error) {
      console.error('Error actualizando borrador:', error);
    }
  };

  return {
    generateEmail,
    isGenerating,
    generatedDraft,
    error,
    clearDraft,
    updateDraftStatus
  };
};

// ========================================
// HELPERS
// ========================================

function buildSystemPrompt(tone, language) {
  const toneInstructions = TONE_PROMPTS[tone] || TONE_PROMPTS.professional;

  const languageInstructions = {
    es: 'Escribe SIEMPRE en español.',
    en: 'Write ALWAYS in English.',
    pt: 'Escreva SEMPRE em português.'
  };

  return `${toneInstructions}

${languageInstructions[language] || languageInstructions.es}

Trabajas para Digpatho IA, una startup que desarrolla soluciones de inteligencia artificial para anatomía patológica y diagnóstico digital.

REGLAS:
- Genera emails concisos (máximo 150 palabras)
- Personaliza basándote en el contexto proporcionado
- Incluye siempre un llamado a la acción claro
- NO uses frases genéricas como "espero que estés bien"
- Usa el nombre del contacto apropiadamente

FORMATO DE RESPUESTA (obligatorio):
**Asunto:** [asunto del email]

**Cuerpo:**
[contenido del email]

**Notas internas:** [opcional: notas para el comercial sobre el email]`;
}

function buildUserPrompt(contact, interactions, emailType, language) {
  const interactionsText = interactions.length > 0
    ? interactions.map(i => `- ${i.type}: "${i.subject || 'Sin asunto'}" (${new Date(i.occurred_at).toLocaleDateString()})`).join('\n')
    : 'Sin interacciones previas';

  const typeInstruction = EMAIL_TYPE_INSTRUCTIONS[emailType] || EMAIL_TYPE_INSTRUCTIONS['follow-up'];

  return `CONTACTO:
- Nombre: ${contact.first_name} ${contact.last_name}
- Cargo: ${contact.job_title || 'No especificado'}
- Institución: ${contact.institution?.name || 'No especificada'}
- Nivel de interés: ${contact.interest_level}
- Contexto especial: ${contact.ai_context || 'Ninguno'}

HISTORIAL DE INTERACCIONES:
${interactionsText}

INSTRUCCIÓN:
${typeInstruction}

Genera el email ahora.`;
}

function parseEmailResponse(text) {
  const result = {
    subject: '',
    body: '',
    notes: ''
  };

  // Buscar el asunto
  const subjectMatch = text.match(/\*\*Asunto:\*\*\s*(.+?)(?=\n|$)/i);
  if (subjectMatch) {
    result.subject = subjectMatch[1].trim();
  }

  // Buscar el cuerpo
  const bodyMatch = text.match(/\*\*Cuerpo:\*\*\s*([\s\S]*?)(?=\*\*Notas internas:\*\*|$)/i);
  if (bodyMatch) {
    result.body = bodyMatch[1].trim();
  } else {
    result.body = text.replace(/\*\*Asunto:\*\*.*\n?/i, '').trim();
  }

  // Buscar notas internas
  const notesMatch = text.match(/\*\*Notas internas:\*\*\s*([\s\S]*?)$/i);
  if (notesMatch) {
    result.notes = notesMatch[1].trim();
  }

  return result;
}

export default useEmailGeneration;