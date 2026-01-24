// src/hooks/useGmail.js
import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

// Google OAuth Token Endpoint
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export const useGmail = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Obtiene un access token válido
   */
  const getValidAccessToken = async () => {
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

    if (!clientId || !clientSecret) {
      throw new Error('Configuración de Google incompleta.');
    }

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

    if (refreshProfile) await refreshProfile();

    return data.access_token;
  };

  /**
   * Construye un email MIME con soporte para CC y adjuntos
   */
  const buildMimeEmail = ({ to, cc, subject, body, attachments }) => {
    const fromEmail = user?.email || profile?.email;
    const fromName = profile?.full_name || 'Digpatho IA';

    // Agregar firma si existe
    const signature = profile?.email_signature
      ? `\n\n--\n${profile.email_signature}`
      : '';

    const fullBody = body + signature;
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substr(2)}`;

    let headers = [
      `From: "${fromName}" <${fromEmail}>`,
      `To: ${to}`,
    ];

    // Agregar CC si existe
    if (cc && cc.length > 0) {
      headers.push(`Cc: ${Array.isArray(cc) ? cc.join(', ') : cc}`);
    }

    // Codificar subject en UTF-8 Base64 para caracteres especiales
    const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
    headers.push(`Subject: ${encodedSubject}`);
    headers.push('MIME-Version: 1.0');

    // Si hay adjuntos, usar multipart/mixed
    if (attachments && attachments.length > 0) {
      headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

      let mimeBody = headers.join('\r\n') + '\r\n\r\n';

      // Parte del texto
      mimeBody += `--${boundary}\r\n`;
      mimeBody += 'Content-Type: text/plain; charset=UTF-8\r\n';
      mimeBody += 'Content-Transfer-Encoding: base64\r\n\r\n';
      mimeBody += btoa(unescape(encodeURIComponent(fullBody))) + '\r\n';

      // Adjuntos
      for (const att of attachments) {
        mimeBody += `--${boundary}\r\n`;
        mimeBody += `Content-Type: ${att.type || 'application/octet-stream'}; name="${att.name}"\r\n`;
        mimeBody += 'Content-Transfer-Encoding: base64\r\n';
        mimeBody += `Content-Disposition: attachment; filename="${att.name}"\r\n\r\n`;
        mimeBody += att.data + '\r\n';
      }

      mimeBody += `--${boundary}--`;

      return mimeBody;
    } else {
      // Email simple sin adjuntos
      headers.push('Content-Type: text/plain; charset=UTF-8');
      return headers.join('\r\n') + '\r\n\r\n' + fullBody;
    }
  };

  /**
   * Envía un email con soporte para CC y adjuntos
   */
  const sendEmail = async ({ to, cc, subject, body, attachments, draftId = null }) => {
    setSending(true);
    setError(null);

    try {
      const accessToken = await getValidAccessToken();

      // Construir el email MIME
      const mimeEmail = buildMimeEmail({ to, cc, subject, body, attachments });

      // Codificar en base64 URL-safe
      const encodedEmail = btoa(unescape(encodeURIComponent(mimeEmail)))
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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Error al enviar email');
      }

      const result = await response.json();

      // Guardar en la base de datos
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
          // Construir contenido con info de CC y adjuntos
          let interactionContent = body;
          if (cc && cc.length > 0) {
            const ccStr = Array.isArray(cc) ? cc.join(', ') : cc;
            interactionContent = `[CC: ${ccStr}]\n\n${interactionContent}`;
          }
          if (attachments && attachments.length > 0) {
            const attachmentNames = attachments.map(a => a.name).join(', ');
            interactionContent += `\n\n[Adjuntos: ${attachmentNames}]`;
          }

          await supabase.from('interactions').insert({
            contact_id: draft.contact_id,
            type: 'email_sent',
            subject: subject,
            content: interactionContent,
            direction: 'outbound',
            occurred_at: new Date().toISOString(),
            email_draft_id: draftId,
            created_by: user.id,
            thread_id: result.threadId,
            gmail_id: result.id
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
   * Extrae el cuerpo del mensaje de Gmail (texto plano)
   */
  const extractMessageBody = (payload) => {
    // Caso 1: Mensaje simple
    if (payload.body?.data) {
      try {
        return atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      } catch {
        return payload.body.data;
      }
    }

    // Caso 2: Multipart - buscar text/plain
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          try {
            return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          } catch {
            return part.body.data;
          }
        }
        // Recursivo para multipart anidados
        if (part.parts) {
          const nested = extractMessageBody(part);
          if (nested) return nested;
        }
      }
    }

    return null;
  };

  /**
   * Extrae el subject del mensaje
   */
  const extractSubject = (headers) => {
    const subjectHeader = headers?.find(h => h.name.toLowerCase() === 'subject');
    return subjectHeader?.value || 'Sin asunto';
  };

  /**
   * CORREGIDO: Busca TODOS los mensajes en los hilos (enviados Y recibidos)
   */
  const checkContactReplies = async (contactId) => {
    if (!contactId || !user) return;
    setSyncing(true);

    try {
      // 1. Obtener nombre del contacto
      const { data: contact } = await supabase
        .from('contacts')
        .select('first_name, last_name, email')
        .eq('id', contactId)
        .single();

      const contactName = contact ? `${contact.first_name} ${contact.last_name}` : 'Un contacto';

      // 2. Obtener threads existentes
      const { data: threads } = await supabase
        .from('interactions')
        .select('thread_id')
        .eq('contact_id', contactId)
        .not('thread_id', 'is', null);

      if (!threads || threads.length === 0) {
        setSyncing(false);
        return;
      }

      const uniqueThreadIds = [...new Set(threads.map(t => t.thread_id))];
      const accessToken = await getValidAccessToken();

      let newRepliesCount = 0;

      // 3. Revisar cada hilo
      for (const threadId of uniqueThreadIds) {
        const response = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (!response.ok) continue;
        const threadData = await response.json();

        if (threadData.messages && threadData.messages.length > 0) {
          for (const msg of threadData.messages) {

            // Verificar si ya existe en nuestra DB
            const { data: existing } = await supabase
              .from('interactions')
              .select('id')
              .eq('gmail_id', msg.id)
              .maybeSingle();

            if (!existing) {
              // CAMBIO: Ahora guardamos TODOS los mensajes, no solo los inbound
              const isSentByMe = msg.labelIds?.includes('SENT');

              // Extraer datos del mensaje
              const headers = msg.payload?.headers || [];
              const dateHeader = headers.find(h => h.name.toLowerCase() === 'date');
              const msgDate = dateHeader ? new Date(dateHeader.value) : new Date();

              // Extraer cuerpo completo del mensaje
              const fullBody = extractMessageBody(msg.payload);
              const content = fullBody || msg.snippet || '';

              // Extraer subject
              const subject = extractSubject(headers);

              // Determinar tipo y dirección
              const interactionType = isSentByMe ? 'email_sent' : 'email_reply';
              const direction = isSentByMe ? 'outbound' : 'inbound';

              // Guardar la interacción
              const { error: insertError } = await supabase.from('interactions').insert({
                contact_id: contactId,
                type: interactionType,
                subject: subject,
                content: content,
                direction: direction,
                occurred_at: msgDate.toISOString(),
                created_by: user.id,
                thread_id: threadId,
                gmail_id: msg.id
              });

              // Solo crear notificación para mensajes ENTRANTES (no mis propias respuestas)
              if (!insertError && !isSentByMe) {
                newRepliesCount++;
                await supabase.from('notifications').insert({
                  user_id: user.id,
                  type: 'email_reply',
                  title: `Respuesta de ${contactName}`,
                  message: msg.snippet ? msg.snippet.substring(0, 80) + '...' : 'Tienes un nuevo correo.',
                  link: `/contacts/${contactId}`,
                  is_read: false
                });
              }
            }
          }
        }
      }

      console.log(`Sincronización completada: ${newRepliesCount} nuevas respuestas`);
      return { success: true, newReplies: newRepliesCount };

    } catch (err) {
      console.error('Error sync replies:', err);
      return { success: false, error: err.message };
    } finally {
      setSyncing(false);
    }
  };

  /**
   * Abre Gmail en el navegador con el email pre-llenado (fallback)
   */
  const openInGmail = ({ to, cc, subject, body }) => {
    const signature = profile?.email_signature ? `\n\n--\n${profile.email_signature}` : '';
    const fullBody = body + signature;
    const gmailUrl = new URL('https://mail.google.com/mail/');
    gmailUrl.searchParams.set('view', 'cm');
    gmailUrl.searchParams.set('to', to);
    if (cc) {
      gmailUrl.searchParams.set('cc', Array.isArray(cc) ? cc.join(',') : cc);
    }
    gmailUrl.searchParams.set('su', subject);
    gmailUrl.searchParams.set('body', fullBody);
    window.open(gmailUrl.toString(), '_blank');
  };

  /**
   * Copia el email al portapapeles
   */
  const copyToClipboard = async ({ subject, body }) => {
    const signature = profile?.email_signature ? `\n\n--\n${profile.email_signature}` : '';
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
    checkContactReplies,
    openInGmail,
    copyToClipboard,
    sending,
    syncing,
    error,
    hasGmailAccess: !!profile?.google_access_token,
    userEmail: user?.email || profile?.email
  };
};

export default useGmail;