// src/hooks/useEmailGeneration.js
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { EMAIL_AGENT_SYSTEM_PROMPT, buildEmailGenerationPrompt } from '../config/aiPrompts';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export const useEmailGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState(null);
  const [error, setError] = useState(null);

  const generateEmail = async (contactId, emailType = 'follow-up') => {
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

      // 3. Construir el prompt
      const userPrompt = buildEmailGenerationPrompt(contact, interactions || [], emailType);

      // 4. Llamar a la API de Claude
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true' // Solo para desarrollo
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: EMAIL_AGENT_SYSTEM_PROMPT,
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

      // 5. Parsear el resultado (extraer asunto y cuerpo)
      const parsed = parseEmailResponse(generatedText);

      // 6. Guardar el borrador en la base de datos
      const { data: draft, error: draftError } = await supabase
        .from('email_drafts')
        .insert({
          contact_id: contactId,
          subject: parsed.subject,
          body: parsed.body,
          status: 'generated',
          generation_context: {
            email_type: emailType,
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
        // No es crítico, continuamos
      }

      const result = {
        id: draft?.id,
        subject: parsed.subject,
        body: parsed.body,
        notes: parsed.notes,
        contact,
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

// Helper para parsear la respuesta de la IA
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
    // Si no hay formato esperado, usar todo como cuerpo
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
