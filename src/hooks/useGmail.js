// src/hooks/useGmail.js
import { useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

// Google OAuth Token Endpoint
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export const useGmail = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Obtiene un access token válido, refrescándolo si es necesario
   */
  const getValidAccessToken = async () => {
    if (!profile) {
      throw new Error('No hay perfil de usuario. Por favor, vuelve a iniciar sesión.');
    }

    // Verificar si el token actual sigue siendo válido
    if (profile.google_access_token && profile.google_token_expires_at) {
      const expiresAt = new Date(profile.google_token_expires_at);
      const now = new Date();

      // Si el token expira en más de 5 minutos, usarlo
      if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
        console.log('Token válido, usando existente');
        return profile.google_access_token;
      }
    }

    // Token expirado o por expirar - necesitamos refrescarlo
    if (!profile.google_refresh_token) {
      throw new Error('No hay refresh token. Por favor, cierra sesión y vuelve a iniciar sesión con Google.');
    }

    console.log('Token expirado, refrescando...');

    try {
      // Obtener Client ID y Secret de las variables de entorno
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        console.error('Faltan VITE_GOOGLE_CLIENT_ID o VITE_GOOGLE_CLIENT_SECRET');
        throw new Error('Configuración de Google incompleta. Contacta al administrador.');
      }

      // Llamar a Google directamente para refrescar el token
      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: profile.google_refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error refreshing token:', errorData);
        throw new Error('No se pudo refrescar el token. Por favor, vuelve a iniciar sesión.');
      }

      const data = await response.json();

      // Calcular nueva fecha de expiración
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (data.expires_in || 3600));

      // Guardar el nuevo token en la base de datos
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          google_access_token: data.access_token,
          google_token_expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error saving new token:', updateError);
      }

      // Refrescar el perfil en memoria
      if (refreshProfile) {
        await refreshProfile();
      }

      console.log('Token refrescado exitosamente');
      return data.access_token;

    } catch (err) {
      console.error('Error en refresh:', err);
      throw new Error('No se pudo refrescar el token. Por favor, vuelve a iniciar sesión.');
    }
  };

  /**
   * Envía un email usando Gmail API
   */
  const sendEmail = async ({ to, subject, body, draftId = null }) => {
    setSending(true);
    setError(null);

    try {
      // 1. Obtener token válido (refresca automáticamente si es necesario)
      const accessToken = await getValidAccessToken();

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
        console.error('Gmail API error:', errorData);
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