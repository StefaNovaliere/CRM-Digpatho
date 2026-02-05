/**
 * useEmailGeneration hook - refactored to use repository pattern.
 */
import { useState } from 'react';
import { useRepository } from './useRepository';
import {
  buildSystemPromptWithProject,
  buildEmailGenerationPrompt
} from '../../infrastructure/config/aiPrompts';

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

export const useEmailGeneration = () => {
  const contactRepo = useRepository('contactRepository');
  const interactionRepo = useRepository('interactionRepository');
  const emailDraftRepo = useRepository('emailDraftRepository');
  const anthropicClient = useRepository('anthropicClient');
  const emailService = useRepository('emailService');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState(null);
  const [error, setError] = useState(null);

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
      // 1. Get contact data via repository
      const contact = await contactRepo.getById(contactId);
      if (!contact) throw new Error('No se pudo cargar el contacto');

      // 2. Get recent interactions via repository
      const interactions = await interactionRepo.getRecentByContactId(contactId, 5);

      // 3. Build prompts (pure domain logic)
      const baseSystemPrompt = buildSystemPromptWithProject(project, customContext);
      const systemPrompt = buildCombinedSystemPrompt(baseSystemPrompt, tone, language);
      const userPrompt = buildEmailGenerationPrompt(contact, interactions || [], emailType, project);

      // 4. Call AI via external client
      const aiResponse = await anthropicClient.generateMessage(systemPrompt, userPrompt, {
        maxTokens: 1500
      });

      // 5. Parse response (pure domain logic)
      const parsed = emailService.parseEmailResponse(aiResponse.content);

      // 6. Save draft via repository
      let draft = null;
      try {
        draft = await emailDraftRepo.create({
          contact_id: contactId,
          subject: parsed.subject,
          body: parsed.body,
          status: 'generated',
          generation_context: emailService.buildGenerationContext({
            contactId, emailType, tone, language, project, customContext,
            contactSnapshot: {
              name: `${contact.first_name} ${contact.last_name}`,
              institution: contact.institution?.name
            }
          }),
          ai_model: 'claude-sonnet-4-20250514'
        });
      } catch (draftError) {
        console.error('Error guardando borrador:', draftError);
      }

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
    await emailDraftRepo.update(draftId, updates);
  };

  return { generateEmail, isGenerating, generatedDraft, error, clearDraft, updateDraftStatus };
};

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

export default useEmailGeneration;
