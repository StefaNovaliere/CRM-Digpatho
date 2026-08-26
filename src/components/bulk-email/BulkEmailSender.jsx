// src/components/bulk-email/BulkEmailSender.jsx
import { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  CheckCircle,
  Loader2,
  AlertTriangle,
  Paperclip,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { notifyCampaignFinished, notifyCampaignFailed } from '../../lib/chatNotify';

// Delay entre emails para evitar rate limiting (en ms)
const DELAY_BETWEEN_EMAILS = 2000; // 2 segundos

export const BulkEmailSender = ({ campaign, onClose, onComplete }) => {
  const { user, profile } = useAuth();
  const [status, setStatus] = useState('ready'); // ready, sending, paused, completed, error
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0 });
  const [currentEmail, setCurrentEmail] = useState(null);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);
  const [senderProfile, setSenderProfile] = useState(null); // Perfil del remitente elegido

  const isPausedRef = useRef(false);
  const abortRef = useRef(false);

  // Cargar estado inicial y perfil del remitente
  useEffect(() => {
    loadProgress();
    loadSenderProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  // Cargar el perfil del remitente seleccionado
  const loadSenderProfile = async () => {
    const senderId = campaign.sender_id;
    if (!senderId || senderId === user?.id) {
      // Usar el perfil del usuario actual
      setSenderProfile(profile);
      return;
    }
    const { data, error: fetchErr } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', senderId)
      .single();

    if (!fetchErr && data) {
      setSenderProfile(data);
    } else {
      // Fallback al usuario actual
      setSenderProfile(profile);
    }
  };

  const loadProgress = async () => {
    const { data: queue } = await supabase
      .from('bulk_email_queue')
      .select('status')
      .eq('campaign_id', campaign.id);

    if (queue) {
      setProgress({
        total: queue.length,
        sent: queue.filter(q => q.status === 'sent').length,
        failed: queue.filter(q => q.status === 'failed').length,
      });
    }
  };

  // Agregar log
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, timestamp }].slice(-50));
  };

  // Refrescar access token usando el refresh token
  const refreshAccessToken = async () => {
    const sender = senderProfile || profile;
    const senderId = campaign.sender_id || user?.id;

    if (!sender?.google_refresh_token) {
      throw new Error('No hay refresh token. El remitente debe iniciar sesión nuevamente.');
    }

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: sender.google_refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      if (errData.error === 'invalid_grant') {
        throw new Error('El refresh token expiró o fue revocado. El remitente debe iniciar sesión nuevamente en el CRM.');
      }
      throw new Error('Error al refrescar token del remitente');
    }
    const data = await response.json();

    const newExpiresAt = new Date();
    newExpiresAt.setSeconds(newExpiresAt.getSeconds() + (data.expires_in || 3600));

    await supabase.from('user_profiles').update({
      google_access_token: data.access_token,
      google_token_expires_at: newExpiresAt.toISOString(),
    }).eq('id', senderId);

    return data.access_token;
  };

  // Obtener access token válido (del remitente seleccionado)
  const getValidAccessToken = async () => {
    const sender = senderProfile || profile;

    if (!sender?.google_access_token) {
      throw new Error('No hay token de Gmail para el remitente. Pedile que inicie sesión nuevamente.');
    }

    if (sender.google_token_expires_at) {
      const expiresAt = new Date(sender.google_token_expires_at);
      if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
        return await refreshAccessToken();
      }
    }

    return sender.google_access_token;
  };

  // Enviar un email (con o sin adjunto)
  const sendSingleEmail = async (queueItem, accessToken, attachments) => {
    const sender = senderProfile || profile;
    const fromEmail = sender?.email || user?.email || profile?.email;
    const fromName = sender?.full_name || 'Digpatho';
    const signature = sender?.email_signature ? `\n\n--\n${sender.email_signature}` : '';
    const fullBody = queueItem.body + signature;

    // Construir MIME
    const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(queueItem.subject)))}?=`;

    // --- CORRECCIÓN CC ---
    let ccString = '';
    if (queueItem.cc_emails) {
      if (Array.isArray(queueItem.cc_emails) && queueItem.cc_emails.length > 0) {
        ccString = queueItem.cc_emails.join(', ');
      } else if (typeof queueItem.cc_emails === 'string' && queueItem.cc_emails.includes('@')) {
        ccString = queueItem.cc_emails;
      }
    }

    const attachmentList = Array.isArray(attachments) ? attachments : (attachments ? [attachments] : []);
    let emailContent;

    if (attachmentList.length > 0) {
      // --- MIME multipart/mixed con uno o más adjuntos ---
      const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;

      const headers = [
        `From: "${fromName}" <${fromEmail}>`,
        `To: ${queueItem.to_email}`,
      ];
      if (ccString) headers.push(`Cc: ${ccString}`);
      headers.push(
        `Subject: ${encodedSubject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`
      );

      // Helper: dividir base64 en líneas de 76 caracteres (estándar MIME)
      const wrapBase64 = (b64) => b64.match(/.{1,76}/g)?.join('\r\n') || b64;

      // Parte 1: cuerpo del email
      const bodyPart = [
        `--${boundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        wrapBase64(btoa(unescape(encodeURIComponent(fullBody))))
      ].join('\r\n');

      // Parte 2..N: archivos adjuntos
      const attachmentParts = attachmentList.map(att => [
        `--${boundary}`,
        `Content-Type: ${att.contentType}; name="${att.name}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${att.name}"`,
        '',
        wrapBase64(att.base64)
      ].join('\r\n'));

      emailContent = [
        ...headers,
        '',
        bodyPart,
        ...attachmentParts,
        `--${boundary}--`
      ].join('\r\n');

    } else {
      // --- MIME simple sin adjunto (original) ---
      const headers = [
        `From: "${fromName}" <${fromEmail}>`,
        `To: ${queueItem.to_email}`,
      ];
      if (ccString) headers.push(`Cc: ${ccString}`);
      headers.push(
        `Subject: ${encodedSubject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8'
      );

      emailContent = [
        ...headers,
        '',
        fullBody
      ].join('\r\n');
    }

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

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Error de Gmail API');
    }

    return await response.json();
  };

  // Proceso de envío masivo
  const startSending = async () => {
    setStatus('sending');
    setError(null);
    isPausedRef.current = false;
    abortRef.current = false;

    addLog('Iniciando envío masivo...', 'info');

    // Estos contadores se declaran FUERA del try para que el catch pueda
    // reportar cuánto se alcanzó a enviar antes de que se cortara.
    let sentCount = progress.sent;
    let failedCount = progress.failed;

    // Un reintento arranca con envíos ya hechos: sirve para redactar el aviso.
    const esReintento = progress.sent > 0;

    // El remitente real sale de campaign.sender_id, que puede no ser quien
    // apretó el botón. interactions.created_by guarda al operador, así que no
    // sirve para esto: el nombre tiene que coincidir con el From: del correo.
    const nombreRemitente = (senderProfile || profile)?.full_name
      || (senderProfile || profile)?.email
      || 'Alguien';

    // A quién se le asignan los contactos de esta campaña. Es el remitente,
    // no el operador: las respuestas llegan a la casilla del remitente, así
    // que es quien va a tener que seguir la conversación.
    const remitenteId = campaign.sender_id || user?.id || null;

    // Días hasta el próximo seguimiento, configurable por campaña
    // (migración 011). 0 o null = no fijar fecha.
    const diasSeguimiento = campaign.followup_days ?? 7;

    // Actualizar estado de campaña
    await supabase
      .from('bulk_email_campaigns')
      .update({ status: 'sending', started_at: new Date().toISOString() })
      .eq('id', campaign.id);

    try {
      // Obtener token
      let accessToken = await getValidAccessToken();
      addLog('Token de Gmail obtenido', 'success');

      // Cargar adjuntos de la campaña (una sola vez).
      //
      // Se piden acá y no vienen en el objeto `campaign`: la lista de campañas
      // ya no trae estas columnas, justamente para no descargar los adjuntos de
      // todas las campañas cada vez que se abre la pantalla.
      const attachmentsData = [];

      // Algunas de estas columnas dependen de migraciones que pueden no estar
      // corridas, y PostgREST falla la consulta entera si pide una que no
      // existe. Por eso se van descartando de a una.
      let adjCols = ['attachments', 'attachment_name', 'attachment_content_type',
        'attachment_size', 'attachment_base64', 'attachment_path'];
      let adjRow = null;

      for (let intento = 0; intento <= adjCols.length; intento++) {
        const { data, error: adjError } = await supabase
          .from('bulk_email_campaigns')
          .select(adjCols.join(', '))
          .eq('id', campaign.id)
          .single();

        if (!adjError) { adjRow = data; break; }

        const faltante = adjCols.find(c => adjError.message?.includes(c));
        if (!faltante) break;
        adjCols = adjCols.filter(c => c !== faltante);
        if (adjCols.length === 0) break;
      }

      const adj = adjRow || {};

      // Un adjunto puede venir de dos formas: con el contenido embebido
      // (`base64`, campañas viejas) o con una ruta a Supabase Storage (`path`,
      // el formato nuevo). El MIME siempre necesita base64, así que las rutas
      // se descargan y convierten en memoria.
      const blobToBase64 = async (blob) => {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = '';
        for (let k = 0; k < bytes.length; k++) binary += String.fromCharCode(bytes[k]);
        return btoa(binary);
      };

      const resolverAdjunto = async (a) => {
        if (!a || !a.name) return null;
        const base = {
          name: a.name,
          contentType: a.content_type || a.contentType || 'application/octet-stream',
        };
        if (a.base64) return { ...base, base64: a.base64 };
        if (!a.path) return null;

        const { data: fileBlob, error: downloadError } = await supabase.storage
          .from('attachments')
          .download(a.path);
        if (downloadError) throw new Error(`${a.name}: ${downloadError.message}`);
        return { ...base, base64: await blobToBase64(fileBlob) };
      };

      // Lista normalizada: el array `attachments` si existe, si no el adjunto
      // único de las columnas legacy.
      let adjuntosCrudos = [];
      if (Array.isArray(adj.attachments) && adj.attachments.length > 0) {
        adjuntosCrudos = adj.attachments;
      } else if (adj.attachment_name && (adj.attachment_base64 || adj.attachment_path)) {
        adjuntosCrudos = [{
          name: adj.attachment_name,
          content_type: adj.attachment_content_type,
          size: adj.attachment_size,
          base64: adj.attachment_base64 || undefined,
          path: adj.attachment_path || undefined,
        }];
      }

      if (adjuntosCrudos.length > 0) {
        const hayQueDescargar = adjuntosCrudos.some(a => a && !a.base64 && a.path);
        if (hayQueDescargar) addLog('Descargando adjuntos...', 'info');

        for (const a of adjuntosCrudos) {
          try {
            const resuelto = await resolverAdjunto(a);
            if (resuelto) attachmentsData.push(resuelto);
          } catch (attachErr) {
            // Un adjunto que falla no cancela la campaña, pero el usuario tiene
            // que enterarse de que el correo sale incompleto.
            addLog(`Error al cargar adjunto ${attachErr.message}. Se enviará sin ese archivo.`, 'warning');
          }
        }

        if (attachmentsData.length > 0) {
          addLog(`${attachmentsData.length} adjunto(s) cargado(s): ${attachmentsData.map(a => a.name).join(', ')}`, 'success');
        }
      }

      // Obtener emails pendientes
      const { data: pendingEmails, error: fetchError } = await supabase
        .from('bulk_email_queue')
        .select('*')
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      addLog(`${pendingEmails.length} emails pendientes`, 'info');

      for (let i = 0; i < pendingEmails.length; i++) {
        // Verificar si se pausó o abortó
        if (isPausedRef.current) {
          addLog('Envío pausado por el usuario', 'warning');
          setStatus('paused');
          await supabase
            .from('bulk_email_campaigns')
            .update({ status: 'paused' })
            .eq('id', campaign.id);
          return;
        }

        if (abortRef.current) {
          addLog('Envío cancelado', 'warning');
          return;
        }

        const queueItem = pendingEmails[i];
        setCurrentEmail(queueItem);

        // Marcar como enviando
        await supabase
          .from('bulk_email_queue')
          .update({ status: 'sending' })
          .eq('id', queueItem.id);

        try {
          // Refrescar token cada 50 emails por seguridad
          if (i > 0 && i % 50 === 0) {
            accessToken = await getValidAccessToken();
            addLog('Token refrescado', 'info');
          }

          // Enviar — si falla por auth, refrescar token y reintentar una vez
          let result;
          try {
            result = await sendSingleEmail(queueItem, accessToken, attachmentsData);
          } catch (sendErr) {
            const isAuthError = sendErr.message?.includes('invalid authentication credentials')
              || sendErr.message?.includes('Invalid Credentials')
              || sendErr.message?.includes('401');
            if (isAuthError) {
              addLog('Token inválido — refrescando...', 'warning');
              try {
                accessToken = await refreshAccessToken();
                addLog('Token refrescado exitosamente', 'success');
                result = await sendSingleEmail(queueItem, accessToken, attachmentsData);
              } catch (refreshErr) {
                throw new Error(refreshErr.message?.includes('iniciar sesión')
                  ? refreshErr.message
                  : sendErr.message);
              }
            } else {
              throw sendErr;
            }
          }

          // Marcar como enviado
          await supabase
            .from('bulk_email_queue')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              gmail_id: result.id,
              thread_id: result.threadId
            })
            .eq('id', queueItem.id);

          // Traer el contacto con su estado actual del pipeline. Se necesita
          // el estado, no sólo el id, para decidir qué actualizar sin pisar
          // trabajo previo (ver más abajo).
          const columnasContacto = 'id, stage, assigned_to, next_followup_at';
          let contacto = null;

          if (queueItem.contact_id) {
            const { data } = await supabase
              .from('contacts')
              .select(columnasContacto)
              .eq('id', queueItem.contact_id)
              .maybeSingle();
            contacto = data;
          } else {
            // Sin contact_id en la cola, se busca por email. Puede no existir:
            // el importador sólo crea contactos cuando se mapeó un nombre.
            const { data } = await supabase
              .from('contacts')
              .select(columnasContacto)
              .eq('email', queueItem.to_email)
              .maybeSingle();
            contacto = data;
          }

          if (contacto) {
            // 1. El historial del correo
            let historyContent = queueItem.body;
            if (queueItem.cc_emails && Array.isArray(queueItem.cc_emails) && queueItem.cc_emails.length > 0) {
                historyContent = `[CC: ${queueItem.cc_emails.join(', ')}]\n\n${historyContent}`;
            }

            await supabase.from('interactions').insert({
              contact_id: contacto.id,
              type: 'email_sent',
              subject: queueItem.subject,
              content: historyContent,
              direction: 'outbound',
              occurred_at: new Date().toISOString(),
              created_by: user.id,
              thread_id: result.threadId,
              gmail_id: result.id,
            });

            // 2. El pipeline. Las tres reglas son conservadoras a propósito:
            // una campaña masiva no debe destruir el trabajo de nadie.
            const updates = {};

            // ETAPA: sólo avanza desde 'new'. Un contacto que ya está
            // 'qualified' o 'customer' no retrocede porque le llegó un masivo.
            const etapaActual = contacto.stage || 'new';
            const avanzaEtapa = etapaActual === 'new';
            if (avanzaEtapa) {
              updates.stage = 'contacted';
              updates.stage_changed_at = new Date().toISOString();
            }

            // ASIGNACIÓN: sólo si no tiene dueño. Se asigna al REMITENTE
            // (de cuya casilla salió el correo), no al operador que apretó
            // enviar: las respuestas le llegan al remitente, así que es quien
            // va a tener que seguir la conversación.
            if (!contacto.assigned_to && remitenteId) {
              updates.assigned_to = remitenteId;
            }

            // SEGUIMIENTO: sólo si no tenía fecha puesta a mano.
            if (!contacto.next_followup_at && diasSeguimiento > 0) {
              const proxima = new Date();
              proxima.setDate(proxima.getDate() + diasSeguimiento);
              proxima.setHours(9, 0, 0, 0); // 9am, arranque de jornada
              updates.next_followup_at = proxima.toISOString();
            }

            if (Object.keys(updates).length > 0) {
              const { error: updErr } = await supabase
                .from('contacts')
                .update(updates)
                .eq('id', contacto.id);

              if (updErr) {
                // No corta el envío: perder la actualización del pipeline es
                // molesto, pero el correo ya salió y el historial ya quedó.
                console.error('No se pudo actualizar el contacto:', updErr.message);
              } else if (avanzaEtapa) {
                // El rastro para "conversión por etapa" del cierre mensual.
                const { error: histErr } = await supabase
                  .from('contact_stage_changes')
                  .insert({
                    contact_id: contacto.id,
                    from_stage: etapaActual,
                    to_stage: 'contacted',
                    changed_by: user.id,
                    note: `Campaña: ${campaign.name}`,
                  });
                if (histErr) console.error('No se pudo registrar el cambio de etapa:', histErr.message);
              }
            }
          }

          sentCount++;
          addLog(`✓ Enviado a ${queueItem.to_email}`, 'success');

        } catch (emailError) {
          // Si es error de auth irrecuperable, parar todo el envío
          if (emailError.message?.includes('iniciar sesión')) {
            addLog(`⚠ ${emailError.message}`, 'error');
            // Revertir el item actual a pending
            await supabase
              .from('bulk_email_queue')
              .update({ status: 'pending' })
              .eq('id', queueItem.id);
            throw emailError;
          }

          await supabase
            .from('bulk_email_queue')
            .update({
              status: 'failed',
              error_message: emailError.message
            })
            .eq('id', queueItem.id);

          failedCount++;
          addLog(`✗ Error en ${queueItem.to_email}: ${emailError.message}`, 'error');
        }

        // Actualizar progreso
        setProgress(prev => ({
          ...prev,
          sent: sentCount,
          failed: failedCount
        }));

        // Delay entre emails
        if (i < pendingEmails.length - 1) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_EMAILS));
        }
      }

      // Completado
      setStatus('completed');
      setCurrentEmail(null);
      addLog(`¡Completado! ${sentCount} enviados, ${failedCount} fallidos`, 'success');

      await supabase
        .from('bulk_email_campaigns')
        .update({
          status: failedCount === pendingEmails.length ? 'failed' : 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', campaign.id);

      // Un solo resumen al final, no uno por destinatario: 17 tarjetas
      // seguidas harían que el equipo silencie el espacio.
      notifyCampaignFinished({
        senderName: nombreRemitente,
        campaignName: campaign.name,
        sentCount,
        failedCount,
        isRetry: esReintento,
      });

    } catch (err) {
      console.error('Bulk send error:', err);
      setError(err.message);
      setStatus('error');
      addLog(`Error fatal: ${err.message}`, 'error');

      await supabase
        .from('bulk_email_campaigns')
        .update({ status: 'failed' })
        .eq('id', campaign.id);

      // El caso que ya les pasó cuatro veces con el token de Gmail vencido:
      // conviene que alguien se entere sin tener la pantalla abierta.
      notifyCampaignFailed({
        senderName: nombreRemitente,
        campaignName: campaign.name,
        sentCount,
        errorMessage: err.message,
      });
    }
  };

  const handlePause = () => {
    isPausedRef.current = true;
  };

  const handleResume = () => {
    startSending();
  };

  const handleClose = () => {
    abortRef.current = true;
    onClose();
  };

  const percentComplete = progress.total > 0
    ? Math.round(((progress.sent + progress.failed) / progress.total) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />

      <div className="relative flex items-center justify-center min-h-screen p-4">
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-primary-500 to-primary-700">
            <div className="text-white">
              <h2 className="text-lg font-semibold">Envío Masivo</h2>
              <p className="text-sm text-primary-100">{campaign.name}</p>
              {senderProfile && (
                <p className="text-xs text-primary-200 mt-0.5">
                  Enviando como: {senderProfile.full_name || senderProfile.email}
                </p>
              )}
            </div>
            {status !== 'sending' && (
              <button
                onClick={handleClose}
                className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Progress */}
          <div className="p-6">
            {/* Attachment Info */}
            {(() => {
              const list = Array.isArray(campaign.attachments) && campaign.attachments.length > 0
                ? campaign.attachments.map(a => ({ name: a.name, size: a.size }))
                : (campaign.attachment_name ? [{ name: campaign.attachment_name, size: campaign.attachment_size }] : []);
              if (list.length === 0) return null;
              return (
                <div className="mb-4 p-3 bg-primary-50 border border-primary-200 rounded-xl flex items-start gap-3">
                  <Paperclip className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-primary-700">
                    <strong>{list.length === 1 ? 'Adjunto' : `${list.length} adjuntos`}</strong> — se {list.length === 1 ? 'incluirá' : 'incluirán'} en cada email:
                    <ul className="mt-1 space-y-0.5">
                      {list.map((a, idx) => (
                        <li key={idx}>
                          • {a.name}{a.size ? ` (${(a.size / 1024).toFixed(1)} KB)` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })()}

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Progreso</span>
                <span className="text-sm text-gray-500">{percentComplete}%</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full flex">
                  <div
                    className="bg-green-500 transition-all duration-300"
                    style={{ width: `${(progress.sent / progress.total) * 100}%` }}
                  />
                  <div
                    className="bg-red-500 transition-all duration-300"
                    style={{ width: `${(progress.failed / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <p className="text-2xl font-bold text-gray-900">{progress.total}</p>
                <p className="text-sm text-gray-500">Total</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-xl">
                <p className="text-2xl font-bold text-green-600">{progress.sent}</p>
                <p className="text-sm text-green-600">Enviados</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-xl">
                <p className="text-2xl font-bold text-red-600">{progress.failed}</p>
                <p className="text-sm text-red-600">Fallidos</p>
              </div>
            </div>

            {/* Current Email */}
            {currentEmail && status === 'sending' && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">Enviando...</p>
                    <p className="text-sm text-blue-600">{currentEmail.to_email}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Status Messages */}
            {status === 'completed' && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">¡Envío completado!</p>
                    <p className="text-sm text-green-600">
                      {progress.sent} emails enviados exitosamente
                      {progress.failed > 0 && `, ${progress.failed} fallidos`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {status === 'paused' && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <Pause className="w-6 h-6 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-800">Envío pausado</p>
                    <p className="text-sm text-amber-600">
                      Hacé click en "Continuar" para reanudar
                    </p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                  <div>
                    <p className="font-medium text-red-800">Error</p>
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Logs */}
            <div className="bg-gray-900 rounded-xl p-4 max-h-48 overflow-y-auto font-mono text-xs">
              {logs.length === 0 ? (
                <p className="text-gray-500">Esperando inicio...</p>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className={`${
                    log.type === 'error' ? 'text-red-400' :
                    log.type === 'success' ? 'text-green-400' :
                    log.type === 'warning' ? 'text-amber-400' :
                    'text-gray-400'
                  }`}>
                    <span className="text-gray-600">[{log.timestamp}]</span> {log.message}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-500">
              {status === 'sending' && `Enviando ${progress.sent + progress.failed + 1} de ${progress.total}...`}
              {status === 'ready' && `${progress.total - progress.sent - progress.failed} emails pendientes`}
              {status === 'completed' && 'Proceso finalizado'}
              {status === 'paused' && 'Proceso en pausa'}
            </p>

            <div className="flex items-center gap-3">
              {status === 'ready' && (
                <button onClick={startSending} className="btn-primary">
                  <Play className="w-4 h-4" />
                  Iniciar Envío
                </button>
              )}

              {status === 'sending' && (
                <button onClick={handlePause} className="btn-secondary">
                  <Pause className="w-4 h-4" />
                  Pausar
                </button>
              )}

              {status === 'paused' && (
                <>
                  <button onClick={handleClose} className="btn-secondary">
                    Cancelar
                  </button>
                  <button onClick={handleResume} className="btn-primary">
                    <Play className="w-4 h-4" />
                    Continuar
                  </button>
                </>
              )}

              {(status === 'completed' || status === 'error') && (
                <>
                  {progress.failed > 0 && (
                    <button
                      onClick={async () => {
                        await supabase
                          .from('bulk_email_queue')
                          .update({ status: 'pending', error_message: null })
                          .eq('campaign_id', campaign.id)
                          .eq('status', 'failed');
                        setProgress(prev => ({ ...prev, failed: 0 }));
                        setStatus('ready');
                        setError(null);
                        addLog(`${progress.failed} emails fallidos reseteados — listos para reintentar`, 'info');
                        await loadProgress();
                      }}
                      className="btn-secondary"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Reintentar fallidos ({progress.failed})
                    </button>
                  )}
                  <button onClick={onComplete} className="btn-primary">
                    <CheckCircle className="w-4 h-4" />
                    Cerrar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkEmailSender;
