// src/lib/chatNotify.js
//
// Avisos al espacio de Google Chat del equipo.
//
// EL CONTRATO COMPLETO DE ESTE MÓDULO ES: nunca lanza, nunca bloquea.
// Un problema en Google Chat no puede demorar ni romper un envío de correo.
//
// Eso se garantiza estructuralmente, no por disciplina en cada call site:
// las funciones exportadas NO son async, así que nadie puede hacerles `await`
// por accidente. Devuelven undefined inmediatamente y el trabajo sigue en
// segundo plano.

import { supabase } from './supabase';

const TIMEOUT_MS = 8000;

function post(payload) {
  // Todo adentro de un try/catch que sólo avisa por consola. Incluido
  // getSession(), que también puede fallar.
  (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) return; // sin sesión no hay a quién avisar; silencio

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch('/api/chat-notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
        // El modal de envío se cierra 2 segundos después del éxito. Sin
        // keepalive el navegador cancela el request al desmontar y el aviso
        // se pierde en silencio.
        keepalive: true,
      });
      clearTimeout(timer);

      // El body puede no ser JSON si Vercel devuelve una página de error.
      const texto = await response.text();
      let cuerpo;
      try {
        cuerpo = JSON.parse(texto);
      } catch {
        console.warn(`[chat] respuesta no-JSON (${response.status}): ${texto.slice(0, 150)}`);
        return;
      }

      if (!response.ok || cuerpo?.success === false) {
        // "skipped" es esperable (sin configurar, o apagado): no es un error.
        const motivo = cuerpo?.skipped || cuerpo?.error || response.status;
        if (!cuerpo?.skipped) {
          console.warn('[chat] aviso no enviado:', motivo, cuerpo?.message || '');
        }
      }
    } catch (err) {
      if (err?.name === 'AbortError') {
        console.warn('[chat] timeout al avisar (ignorado)');
      } else {
        console.warn('[chat] error de red (ignorado):', err?.message);
      }
    }
  })();
}

/** Un correo individual salió. */
export function notifyEmailSent({ senderName, recipientName, institutionName, subject, contactId }) {
  post({ type: 'email_sent', senderName, recipientName, institutionName, subject, contactId });
}

/** Una campaña masiva terminó. */
export function notifyCampaignFinished({ senderName, campaignName, sentCount, failedCount, isRetry }) {
  post({ type: 'campaign_finished', senderName, campaignName, sentCount, failedCount, isRetry });
}

/** Una campaña se cortó por un error. */
export function notifyCampaignFailed({ senderName, campaignName, sentCount, errorMessage }) {
  post({ type: 'campaign_failed', senderName, campaignName, sentCount, errorMessage });
}

/** Un telefonista pasó un contacto calificado a un vendedor. */
export function notifyHandoff({ senderName, contactName, institutionName, assigneeName, priority, contactId }) {
  post({ type: 'handoff', senderName, contactName, institutionName, assigneeName, priority, contactId });
}
