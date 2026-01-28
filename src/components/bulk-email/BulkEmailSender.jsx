// src/components/bulk-email/BulkEmailSender.jsx
import { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  CheckCircle,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

// Delay entre emails para evitar rate limiting (en ms)
const DELAY_BETWEEN_EMAILS = 2000; // 2 segundos

export const BulkEmailSender = ({ campaign, onClose, onComplete }) => {
  const { user, profile } = useAuth();
  const [status, setStatus] = useState('ready'); // ready, sending, paused, completed, error
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0 });
  const [currentEmail, setCurrentEmail] = useState(null);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);

  const isPausedRef = useRef(false);
  const abortRef = useRef(false);

  // Cargar estado inicial
  useEffect(() => {
    loadProgress();
  }, [campaign.id]);

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

  // Obtener access token válido
  const getValidAccessToken = async () => {
    if (!profile?.google_access_token) {
      throw new Error('No hay token de Gmail. Iniciá sesión nuevamente.');
    }

    // Verificar si el token está por expirar
    if (profile.google_token_expires_at) {
      const expiresAt = new Date(profile.google_token_expires_at);
      if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
        // Refrescar token
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;

        const response = await fetch('https://oauth2.googleapis.com/token', {
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

        // Actualizar en DB
        const newExpiresAt = new Date();
        newExpiresAt.setSeconds(newExpiresAt.getSeconds() + (data.expires_in || 3600));

        await supabase.from('user_profiles').update({
          google_access_token: data.access_token,
          google_token_expires_at: newExpiresAt.toISOString(),
        }).eq('id', user.id);

        return data.access_token;
      }
    }

    return profile.google_access_token;
  };

  // Enviar un email
  const sendSingleEmail = async (queueItem, accessToken) => {
    const fromEmail = user?.email || profile?.email;
    const fromName = profile?.full_name || 'Digpatho';
    const signature = profile?.email_signature ? `\n\n--\n${profile.email_signature}` : '';
    const fullBody = queueItem.body + signature;

    // Construir MIME
    const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(queueItem.subject)))}?=`;

    // --- CORRECCIÓN CC ---
    // Extraemos los CC del item de la cola (donde los guardó el Importador)
    let ccString = '';
    if (queueItem.cc_emails && Array.isArray(queueItem.cc_emails) && queueItem.cc_emails.length > 0) {
        ccString = queueItem.cc_emails.join(', ');
    } else if (typeof queueItem.cc_emails === 'string' && queueItem.cc_emails.includes('@')) {
        ccString = queueItem.cc_emails; // Fallback por si viene como string
    }

    const headers = [
      `From: "${fromName}" <${fromEmail}>`,
      `To: ${queueItem.to_email}`,
    ];

    // Si hay CC, lo agregamos al header
    if (ccString) {
        headers.push(`Cc: ${ccString}`);
    }

    headers.push(`Subject: ${encodedSubject}`);
    headers.push('MIME-Version: 1.0');
    headers.push('Content-Type: text/plain; charset=UTF-8');

    const emailContent = [
      ...headers,
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

    // Actualizar estado de campaña
    await supabase
      .from('bulk_email_campaigns')
      .update({ status: 'sending', started_at: new Date().toISOString() })
      .eq('id', campaign.id);

    try {
      // Obtener token
      let accessToken = await getValidAccessToken();
      addLog('Token de Gmail obtenido', 'success');

      // Obtener emails pendientes
      const { data: pendingEmails, error: fetchError } = await supabase
        .from('bulk_email_queue')
        .select('*')
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      addLog(`${pendingEmails.length} emails pendientes`, 'info');

      let sentCount = progress.sent;
      let failedCount = progress.failed;

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

          // Enviar
          const result = await sendSingleEmail(queueItem, accessToken);

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

          // Registrar interacción
          let targetContactId = queueItem.contact_id;

          if (!targetContactId) {
            const { data: foundContact } = await supabase
              .from('contacts')
              .select('id')
              .eq('email', queueItem.to_email)
              .maybeSingle();

            if (foundContact) {
              targetContactId = foundContact.id;
            }
          }

          if (targetContactId) {
            // Preparamos el contenido visible en el historial
            let historyContent = queueItem.body;
            // Si hubo CC, lo agregamos al historial para que quede constancia
            if (queueItem.cc_emails && Array.isArray(queueItem.cc_emails) && queueItem.cc_emails.length > 0) {
                historyContent = `[CC: ${queueItem.cc_emails.join(', ')}]\n\n${historyContent}`;
            }

            await supabase.from('interactions').insert({
              contact_id: targetContactId,
              type: 'email_sent',
              subject: queueItem.subject,
              content: historyContent,
              direction: 'outbound',
              occurred_at: new Date().toISOString(),
              created_by: user.id,
              thread_id: result.threadId,
              gmail_id: result.id,
            });
          }

          sentCount++;
          addLog(`✓ Enviado a ${queueItem.to_email}`, 'success');

        } catch (emailError) {
          // Marcar como fallido
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

    } catch (err) {
      console.error('Bulk send error:', err);
      setError(err.message);
      setStatus('error');
      addLog(`Error fatal: ${err.message}`, 'error');

      await supabase
        .from('bulk_email_campaigns')
        .update({ status: 'failed' })
        .eq('id', campaign.id);
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
                <button onClick={onComplete} className="btn-primary">
                  <CheckCircle className="w-4 h-4" />
                  Cerrar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkEmailSender;
