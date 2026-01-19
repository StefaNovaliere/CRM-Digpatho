// src/hooks/useGmail.js
import { useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

// ========================================
// GMAIL API HOOK
// ========================================
export const useGmail = () => {
  const { user, profile, getGoogleAccessToken } = useAuth();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Envía un email usando Gmail API
   * @param {object} options - { to, subject, body, draftId? }
   * @returns {object} - { success, messageId, error }
   */
  const sendEmail = async ({ to, subject, body, draftId = null }) => {
    setSending(true);
    setError(null);

    try {
      // 1. Obtener token válido
      const accessToken = await getGoogleAccessToken();

      // 2. Construir el email en formato RFC 2822
      const fromEmail = user?.email || profile?.email;
      const fromName = profile?.full_name || 'Digpatho IA';

      // Agregar firma si existe
      const signature = profile?.email_signature
        ? `\n\n--\n${profile.email_signature}`
        : '';

      const fullBody = body + signature;

      const emailContent = [
        `From: "${fromName}" <${fromEmail}>`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        '',
        fullBody
      ].join('\r\n');

      // 3. Codificar en base64 URL-safe
      const encodedEmail = btoa(unescape(encodeURIComponent(emailContent)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // 4. Enviar via Gmail API
      const response = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            raw: encodedEmail
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Error al enviar email');
      }

      const result = await response.json();

      // 5. Registrar la interacción en la base de datos
      if (draftId) {
        // Actualizar el borrador como enviado
        await supabase
          .from('email_drafts')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            sent_by: user.id
          })
          .eq('id', draftId);

        // Obtener el contact_id del draft
        const { data: draft } = await supabase
          .from('email_drafts')
          .select('contact_id')
          .eq('id', draftId)
          .single();

        if (draft?.contact_id) {
          // Registrar la interacción
          await supabase
            .from('interactions')
            .insert({
              contact_id: draft.contact_id,
              type: 'email_sent',
              subject: subject,
              content: fullBody,
              direction: 'outbound',
              occurred_at: new Date().toISOString(),
              email_draft_id: draftId,
              created_by: user.id
            });
        }
      }

      return {
        success: true,
        messageId: result.id,
        threadId: result.threadId
      };

    } catch (err) {
      console.error('Error sending email:', err);
      setError(err.message);
      return {
        success: false,
        error: err.message
      };
    } finally {
      setSending(false);
    }
  };

  /**
   * Abre Gmail en el navegador con el email pre-llenado (fallback)
   */
  const openInGmail = ({ to, subject, body }) => {
    const signature = profile?.email_signature
      ? `\n\n--\n${profile.email_signature}`
      : '';

    const fullBody = body + signature;

    // Construir URL de Gmail compose
    const gmailUrl = new URL('https://mail.google.com/mail/');
    gmailUrl.searchParams.set('view', 'cm');
    gmailUrl.searchParams.set('to', to);
    gmailUrl.searchParams.set('su', subject);
    gmailUrl.searchParams.set('body', fullBody);

    window.open(gmailUrl.toString(), '_blank');
  };

  /**
   * Copia el email al portapapeles
   */
  const copyToClipboard = async ({ subject, body }) => {
    const signature = profile?.email_signature
      ? `\n\n--\n${profile.email_signature}`
      : '';

    const fullText = `Asunto: ${subject}\n\n${body}${signature}`;

    try {
      await navigator.clipboard.writeText(fullText);
      return true;
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      return false;
    }
  };

  return {
    sendEmail,
    openInGmail,
    copyToClipboard,
    sending,
    error,
    hasGmailAccess: !!profile?.google_access_token,
    userEmail: user?.email || profile?.email
  };
};

export default useGmail;