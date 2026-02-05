// src/hooks/useEmailGeneration.js
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  buildSystemPromptWithProject,
  buildEmailGenerationPrompt
} from '../config/aiPrompts';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// ========================================
// AJUSTES DE TONO
// ========================================
const TONE_ADJUSTMENTS = {
  professional: `
AJUSTE DE TONO: PROFESIONAL
- Mantén un lenguaje formal y respetuoso.
- Enfócate en la eficiencia y resultados clínicos.
- Evita excesiva familiaridad.`,

  empathetic: `
AJUSTE DE TONO: EMPÁTICO
- Usa un lenguaje cálido y comprensivo.
- Muestra preocupación genuina por la carga de trabajo del patólogo.
- Prioriza construir rapport humano antes de hablar de negocios.`,

  direct: `
AJUSTE DE TONO: DIRECTO
- Ve directo al grano.
- Usa oraciones cortas y párrafos breves.
- Elimina introducciones largas o adornos innecesarios.`
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
   * @param {string} emailType - Tipo de email (follow-up, first-contact, etc.)
   * @param {object} config - Configuración adicional
   * @param {string} config.tone - Tono del email
   * @param {string} config.language - Idioma
   * @param {string} config.project - Proyecto/modelo (breast_her2, prostate_gleason, etc.)
   * @param {string} config.customContext - Contexto personalizado (si project === 'custom')
   */
  const generateEmail = async (contactId, emailType = 'follow-up', config = {}) => {
    const {
      tone = 'professional',
      language = 'es',
      project = 'breast_her2',
      customContext = ''
    } = config;

    setIsGenerating(true);
    setError(null);
    setGeneratedDraft(null);

    try {
      // 1. Obtener datos completos del contacto
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select(`*, institution:institutions(*)`)
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

      // 3. Construir System Prompt con PROYECTO
      const baseSystemPrompt = buildSystemPromptWithProject(project, customContext);
      const systemPrompt = buildCombinedSystemPrompt(baseSystemPrompt, tone, language);

      // 4. Construir User Prompt
      const userPrompt = buildEmailGenerationPrompt(contact, interactions || [], emailType, project);

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
          max_tokens: 1500,
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

      // 7. Guardar borrador
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
            project: project,
            custom_context: customContext || null,
            contact_snapshot: {
              name: `${contact.first_name} ${contact.last_name}`,
              institution: contact.institution?.name
            }
          },
          ai_model: 'claude-sonnet-4-20250514'
        })
        .select()
        .single();

      if (draftError) console.error('Error guardando borrador:', draftError);

      const result = {
        id: draft?.id,
        subject: parsed.subject,
        body: parsed.body,
        notes: parsed.notes,
        contact,
        config: { tone, language, emailType, project },
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
    await supabase.from('email_drafts').update(updates).eq('id', draftId);
  };

  return { generateEmail, isGenerating, generatedDraft, error, clearDraft, updateDraftStatus };
};

// ========================================
// HELPERS
// ========================================

function buildCombinedSystemPrompt(basePrompt, tone, language) {
  const languageInstructions = {
    es: 'IDIOMA: Escribe SIEMPRE en ESPAÑOL (neutro o rioplatense según contexto).',
    en: 'LANGUAGE: Write ALWAYS in ENGLISH.',
    pt: 'IDIOMA: Escreva SEMPRE em PORTUGUÊS.'
  };

  return `${basePrompt}

---
${languageInstructions[language] || languageInstructions.es}

${TONE_ADJUSTMENTS[tone] || TONE_ADJUSTMENTS.professional}

IMPORTANTE: Recuerda seguir estrictamente el formato de respuesta con **Asunto**, **Cuerpo** y **Notas internas**.`;
}

function parseEmailResponse(text) {
  const result = { subject: '', body: '', notes: '' };

  const subjectMatch = text.match(/\*\*Asunto:\*\*\s*(.+?)(?=\n|$)/i);
  if (subjectMatch) result.subject = subjectMatch[1].trim();

  const bodyMatch = text.match(/\*\*Cuerpo:\*\*\s*([\s\S]*?)(?=\*\*Notas internas:\*\*|$)/i);
  if (bodyMatch) {
    result.body = bodyMatch[1].trim();
  } else {
    result.body = text.replace(/\*\*Asunto:\*\*.*\n?/i, '').trim();
  }

  const notesMatch = text.match(/\*\*Notas internas:\*\*\s*([\s\S]*?)$/i);
  if (notesMatch) result.notes = notesMatch[1].trim();

  return result;
}

export default useEmailGeneration;