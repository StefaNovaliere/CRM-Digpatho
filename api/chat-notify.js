// api/chat-notify.js
// Vercel Serverless Function — publica tarjetas en el espacio de Google Chat
// del equipo, usando el mismo mecanismo de incoming webhook que ya reciben
// los errores de Sentry.
//
// POST /api/chat-notify
//   Authorization: Bearer <access token de Supabase>
//   { type: 'email_sent' | 'campaign_finished' | 'campaign_failed' | 'handoff', ... }
//
// DOS DESVÍOS DELIBERADOS DE LA CONVENCIÓN DE api/:
//
// 1. Este endpoint SÍ valida el JWT. El resto de api/ es público, lo cual es
//    tolerable cuando lo peor que pasa es gastar créditos de Anthropic. Acá no:
//    un endpoint abierto que postea al espacio del equipo es un megáfono de
//    spam que además comparte el límite de 1 req/s con Sentry.
//
// 2. NO acepta texto libre. El cliente manda un payload tipado y la tarjeta se
//    arma acá. Así nadie puede inyectar contenido arbitrario al espacio.

import { createClient } from '@supabase/supabase-js';

const RETRY_DELAYS = [1000, 3000, 6000];
const GCHAT_TIMEOUT_MS = 8000;

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Faltan SUPABASE_URL o la key de Supabase.');
  return createClient(url, key);
}

function getAppUrl() {
  return (
    process.env.APP_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'https://crm-digpatho.vercel.app'
  );
}

// Limpia lo que viene del cliente antes de que llegue al espacio.
function limpiar(valor, max = 100) {
  if (!valor) return null;
  return String(valor).replace(/\s+/g, ' ').trim().slice(0, max) || null;
}

function ahora() {
  // El espacio es de un equipo argentino; se muestra en su huso, no en UTC.
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date());
}

function campo(label, texto) {
  return { decoratedText: { topLabel: label, text: texto, wrapText: true } };
}

function boton(texto, url) {
  return { buttonList: { buttons: [{ text: texto, onClick: { openLink: { url } } }] } };
}

// Arma la tarjeta según el tipo. Devuelve null si el tipo no se reconoce.
function construirTarjeta(payload) {
  const app = getAppUrl();
  const remitente = limpiar(payload.senderName) || 'Alguien';

  switch (payload.type) {
    case 'email_sent': {
      const destinatario = limpiar(payload.recipientName) || 'un contacto';
      const institucion = limpiar(payload.institutionName);
      const asunto = limpiar(payload.subject, 120);

      const widgets = [campo('Para', institucion ? `${destinatario} · ${institucion}` : destinatario)];
      if (asunto) widgets.push(campo('Asunto', asunto));
      widgets.push(campo('Hora', ahora()));
      if (payload.contactId) widgets.push(boton('Ver contacto', `${app}/contacts/${payload.contactId}`));

      return {
        cardId: 'email-sent',
        card: {
          header: { title: '📧 Correo enviado', subtitle: remitente },
          sections: [{ widgets }],
        },
      };
    }

    case 'campaign_finished': {
      const campana = limpiar(payload.campaignName) || 'Sin nombre';
      const enviados = Number(payload.sentCount) || 0;
      const fallidos = Number(payload.failedCount) || 0;
      const titulo = payload.isRetry ? '📬 Reintento de campaña terminado' : '📬 Campaña finalizada';

      return {
        cardId: 'campaign-finished',
        card: {
          header: { title: titulo, subtitle: remitente },
          sections: [{
            widgets: [
              campo('Campaña', campana),
              campo('Resultado', `${enviados} enviado${enviados === 1 ? '' : 's'} · ${fallidos} fallido${fallidos === 1 ? '' : 's'}`),
              campo('Hora', ahora()),
              boton('Ver campañas', `${app}/bulk-email`),
            ],
          }],
        },
      };
    }

    case 'campaign_failed': {
      const campana = limpiar(payload.campaignName) || 'Sin nombre';
      const motivo = limpiar(payload.errorMessage, 200) || 'Error desconocido';
      const enviados = Number(payload.sentCount) || 0;

      return {
        cardId: 'campaign-failed',
        card: {
          header: { title: '⚠️ Campaña interrumpida', subtitle: remitente },
          sections: [{
            widgets: [
              campo('Campaña', campana),
              campo('Alcanzó a enviar', `${enviados}`),
              campo('Motivo', motivo),
              boton('Ver campañas', `${app}/bulk-email`),
            ],
          }],
        },
      };
    }

    case 'handoff': {
      const contacto = limpiar(payload.contactName) || 'un contacto';
      const destino = limpiar(payload.assigneeName) || 'un vendedor';
      const institucion = limpiar(payload.institutionName);
      const prioridad = limpiar(payload.priority, 20);

      const widgets = [campo('Contacto', institucion ? `${contacto} · ${institucion}` : contacto)];
      if (prioridad) widgets.push(campo('Prioridad', prioridad));
      widgets.push(campo('Asignado a', destino));
      if (payload.contactId) widgets.push(boton('Ver contacto', `${app}/contacts/${payload.contactId}`));

      return {
        cardId: 'handoff',
        card: {
          header: { title: '🤝 Traspaso a vendedor', subtitle: `De ${remitente}` },
          sections: [{ widgets }],
        },
      };
    }

    default:
      return null;
  }
}

// Postea con reintentos. Google Chat permite 1 request por segundo POR ESPACIO,
// compartido con el webhook de Sentry, y devuelve 429 al pasarse.
async function postearConReintentos(url, body) {
  let ultimoError = null;

  for (let intento = 0; intento <= RETRY_DELAYS.length; intento++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GCHAT_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) return { ok: true };

      const texto = await res.text();
      const reintentable = res.status === 429 || res.status === 503 || res.status >= 500;

      if (reintentable && intento < RETRY_DELAYS.length) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS[intento]));
        ultimoError = { status: res.status, texto: texto.slice(0, 200) };
        continue;
      }
      return { ok: false, status: res.status, texto: texto.slice(0, 200) };
    } catch (err) {
      clearTimeout(timer);
      if (intento < RETRY_DELAYS.length) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS[intento]));
        ultimoError = { status: 0, texto: err.message };
        continue;
      }
      return { ok: false, status: 0, texto: err.message };
    }
  }

  return { ok: false, ...ultimoError };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // --- Auth ---
    const header = req.headers.authorization || '';
    const jwt = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!jwt) {
      return res.status(401).json({ error: 'unauthorized', message: 'Falta el token de sesión.' });
    }

    const supabase = getSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return res.status(401).json({ error: 'unauthorized', message: 'Sesión inválida o expirada.' });
    }

    // --- Kill switch y configuración ---
    // Se devuelve 200 y no 4xx a propósito: el llamador es fire-and-forget y
    // un error en la consola por cada correo enviado entrena al equipo a
    // ignorar la consola. Los diagnósticos ruidosos van en check-whatsapp.
    if (process.env.GCHAT_NOTIFY_ENABLED === 'false') {
      return res.status(200).json({ success: false, skipped: 'disabled' });
    }

    const webhookUrl = process.env.GCHAT_WEBHOOK_URL_TEST || process.env.GCHAT_WEBHOOK_URL;
    if (!webhookUrl) {
      return res.status(200).json({ success: false, skipped: 'not_configured' });
    }

    // --- Construcción de la tarjeta ---
    const payload = req.body || {};
    const tarjeta = construirTarjeta(payload);
    if (!tarjeta) {
      return res.status(400).json({ error: 'invalid_type', message: `Tipo de aviso desconocido: ${payload.type}` });
    }

    const body = { cardsV2: [tarjeta] };

    // --- Ensayo en seco ---
    if (process.env.GCHAT_DRY_RUN === 'true') {
      console.log('[chat-notify] DRY RUN:', JSON.stringify(body));
      return res.status(200).json({ success: true, dryRun: true, card: body });
    }

    const resultado = await postearConReintentos(webhookUrl, body);

    if (!resultado.ok) {
      console.error('[chat-notify] Falló el POST a Google Chat:', resultado);
      if (resultado.status === 429) {
        return res.status(429).json({ error: 'rate_limit', message: 'Google Chat rechazó por límite de 1 mensaje por segundo.' });
      }
      return res.status(502).json({ error: 'gchat_error', status: resultado.status, message: resultado.texto });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('chat-notify error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
