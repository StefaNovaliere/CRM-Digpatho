// src/hooks/useGmail.js
import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

// Google OAuth Token Endpoint
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export const useGmail = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false); // Estado para la sincronización
  const [error, setError] = useState(null);

  /**
   * Obtiene un access token válido
   */
  const getValidAccessToken = async () => {
    // ... (Tu código existente de getValidAccessToken se mantiene IGUAL) ...
    // Para abreviar, asumo que mantienes la lógica de token que ya me pasaste.
    // Solo copiaré la lógica nueva abajo.

    if (!profile) throw new Error('No hay perfil de usuario.');

    // Verificación rápida del token actual
    if (profile.google_access_token && profile.google_token_expires_at) {
      const expiresAt = new Date(profile.google_token_expires_at);
      if (expiresAt.getTime() - new Date().getTime() > 5 * 60 * 1000) {
        return profile.google_access_token;
      }
    }

    if (!profile.google_refresh_token) throw new Error('Sesión de Google caducada.');

    // Refresh logic
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: profile.google_refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) throw new Error('Error al refrescar token');
    const data = await response.json();

    // Actualizar DB
    const newExpiresAt = new Date();
    newExpiresAt.setSeconds(newExpiresAt.getSeconds() + (data.expires_in || 3600));

    await supabase.from('user_profiles').update({
      google_access_token: data.access_token,
      google_token_expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);

    return data.access_token;
  };

  /**
   * Envía un email y AHORA guarda el thread_id
   */
  const sendEmail = async ({ to, subject, body, draftId = null }) => {
    setSending(true);
    setError(null);

    try {
      const accessToken = await getValidAccessToken();
      const fromEmail = user?.email || profile?.email;
      const fromName = profile?.full_name || 'Digpatho IA';

      const signature = profile?.email_signature ? `\n\n--\n${profile.email_signature}` : '';
      const fullBody = body + signature;

      // Construcción del email (MIME)
      const emailContent = [
        `From: "${fromName}" <${fromEmail}>`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        '',
        fullBody
      ].join('\r\n');

      const encodedEmail = btoa(unescape(encodeURIComponent(emailContent)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ raw: encodedEmail })
        }
      );

      if (!response.ok) throw new Error('Error al enviar email');
      const result = await response.json();

      // --- CAMBIO IMPORTANTE: Guardamos el threadId ---
      if (draftId) {
        await supabase.from('email_drafts').update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent_by: user.id
        }).eq('id', draftId);

        const { data: draft } = await supabase
          .from('email_drafts')
          .select('contact_id')
          .eq('id', draftId)
          .single();

        if (draft?.contact_id) {
          await supabase.from('interactions').insert({
            contact_id: draft.contact_id,
            type: 'email_sent',
            subject: subject,
            content: fullBody,
            direction: 'outbound',
            occurred_at: new Date().toISOString(),
            email_draft_id: draftId,
            created_by: user.id,
            thread_id: result.threadId, // <--- NUEVO: Guardamos el hilo
            gmail_id: result.id         // <--- NUEVO: Guardamos el ID del mensaje
          });
        }
      }

      return { success: true, messageId: result.id, threadId: result.threadId };

    } catch (err) {
      console.error('Error sending email:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setSending(false);
    }
  };

  /**
   * NUEVO: Busca respuestas en los hilos existentes de un contacto
   */
  const checkContactReplies = async (contactId) => {
    if (!contactId || !user) return;
    setSyncing(true);

    try {
      // 1. Obtener todos los thread_ids conocidos para este contacto
      const { data: threads } = await supabase
        .from('interactions')
        .select('thread_id')
        .eq('contact_id', contactId)
        .not('thread_id', 'is', null);

      if (!threads || threads.length === 0) {
        setSyncing(false);
        return;
      }

      // Filtrar threads únicos
      const uniqueThreadIds = [...new Set(threads.map(t => t.thread_id))];
      const accessToken = await getValidAccessToken();

      // 2. Revisar cada hilo en Gmail
      for (const threadId of uniqueThreadIds) {
        const response = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!response.ok) continue;
        const threadData = await response.json();

        // 3. Procesar mensajes del hilo
        if (threadData.messages && threadData.messages.length > 0) {
          for (const msg of threadData.messages) {
            // Solo nos interesan los mensajes RECIBIDOS (INBOX) que no tengamos ya

            // --- CORRECCIÓN AQUÍ: Usamos maybeSingle() para evitar el error 406 ---
            const { data: existing } = await supabase
              .from('interactions')
              .select('id')
              .eq('gmail_id', msg.id)
              .maybeSingle();

            if (!existing) {
              // Es un mensaje NUEVO.
              const isInbound = !msg.labelIds.includes('SENT');

              if (isInbound) {
                const snippet = msg.snippet;
                // Parsear fecha
                const dateHeader = msg.payload.headers.find(h => h.name === 'Date');
                const msgDate = dateHeader ? new Date(dateHeader.value) : new Date();

                // Insertar respuesta en el CRM
                // Asegúrate que 'email_draft_id' no se envía o es null
                const { error: insertError } = await supabase.from('interactions').insert({
                  contact_id: contactId,
                  type: 'email_reply',
                  subject: 'Respuesta recibida (Gmail)',
                  content: snippet,
                  direction: 'inbound',
                  occurred_at: msgDate.toISOString(),
                  created_by: user.id,
                  thread_id: threadId,
                  gmail_id: msg.id
                  // No enviamos email_draft_id
                });

                if (insertError) {
                    console.error("Error guardando respuesta:", insertError);
                } else {
                    console.log('Nueva respuesta sincronizada:', snippet);
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error sync replies:', err);
    } finally {
      setSyncing(false);
    }
  };

  // ... (tus funciones openInGmail y copyToClipboard se mantienen igual) ...
  const openInGmail = ({ to, subject, body }) => {
    // ... código existente ...
     const signature = profile?.email_signature ? `\n\n--\n${profile.email_signature}` : '';
    const fullBody = body + signature;
    const gmailUrl = new URL('https://mail.google.com/mail/');
    gmailUrl.searchParams.set('view', 'cm');
    gmailUrl.searchParams.set('to', to);
    gmailUrl.searchParams.set('su', subject);
    gmailUrl.searchParams.set('body', fullBody);
    window.open(gmailUrl.toString(), '_blank');
  };

  const copyToClipboard = async ({ subject, body }) => {
     // ... código existente ...
    const signature = profile?.email_signature ? `\n\n--\n${profile.email_signature}` : '';
    const fullText = `Asunto: ${subject}\n\n${body}${signature}`;
    try {
      await navigator.clipboard.writeText(fullText);
      return true;
    } catch (err) { return false; }
  };

  return {
    sendEmail,
    checkContactReplies, // <--- Exportamos la nueva función
    openInGmail,
    copyToClipboard,
    sending,
    syncing, // <--- Exportamos estado de sync
    error,
    hasGmailAccess: !!profile?.google_access_token,
    userEmail: user?.email || profile?.email
  };
};

export default useGmail;