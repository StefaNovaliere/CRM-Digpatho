// src/hooks/useEmailGeneration.js
import { useState } from 'react';
import { supabase } from '../lib/supabase';

// ========================================
// HOOK PRINCIPAL
// ========================================
export const useEmailGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState(null);
  const [error, setError] = useState(null);

  /**
   * Genera un email personalizado via serverless function
   * @param {string} contactId - ID del contacto
   * @param {string} emailType - Tipo de email (follow-up, first-contact, etc.)
   * @param {object} config - Configuración adicional
   * @param {string} config.tone - Tono del email
   * @param {string} config.language - Idioma
   * @param {string} config.project - Proyecto/modelo (breast_her2, prostate_gleason, etc.)
   * @param {string} config.customContext - Contexto personalizado (si project === 'custom')
   */
  const generateEmail = async (contactId, emailType = 'follow-up', config = {}) => {
    setIsGenerating(true);
    setError(null);
    setGeneratedDraft(null);

    try {
      const response = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, emailType, config })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Email Gen] API error:', response.status, errorData);
        throw new Error(errorData.error || errorData.message || 'Error al generar email');
      }

      const data = await response.json();

      if (!data.success || !data.result) {
        throw new Error('Respuesta inválida del servidor');
      }

      const result = data.result;
      console.log('[Email Gen] Generated:', { subject: result.subject?.substring(0, 50), bodyLen: result.body?.length });

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

export default useEmailGeneration;