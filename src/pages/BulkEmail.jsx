// src/pages/BulkEmail.jsx
import { useState, useEffect } from 'react';
import {
  Upload,
  Play,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Mail,
  Users,
  Paperclip,
  User
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BulkEmailImportModal } from '../components/bulk-email/BulkEmailImportModal';
import { BulkEmailQueueModal } from '../components/bulk-email/BulkEmailQueueModal';
import { BulkEmailSender } from '../components/bulk-email/BulkEmailSender';
import { StatusBadge } from '../components/common/StatusBadge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PageContainer } from '../components/common/PageContainer';

export const BulkEmail = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [sendingCampaign, setSendingCampaign] = useState(null);

  // Cargar campañas (con datos del remitente)
  const loadCampaigns = async () => {
    setLoading(true);

    // Cargar campañas.
    // Columnas enumeradas a propósito: con `select('*')` esta consulta se traía
    // el base64 de TODOS los adjuntos de TODAS las campañas en cada carga de la
    // pantalla. La lista sólo necesita el resumen (cuántos y cómo se llama el
    // primero); el contenido lo carga el sender de la campaña que se envía.
    const BASE_COLS = ['id', 'name', 'status', 'total_emails', 'sent_count',
      'failed_count', 'created_at', 'created_by'];
    // Columnas que dependen de migraciones que quizá no se corrieron todavía.
    const OPTIONAL_COLS = ['sender_id', 'followup_days', 'attachment_name',
      'attachment_content_type', 'attachment_size', 'attachment_count'];

    let cols = [...BASE_COLS, ...OPTIONAL_COLS];
    let data = null;
    let campError = null;

    for (let attempt = 0; attempt <= OPTIONAL_COLS.length; attempt++) {
      ({ data, error: campError } = await supabase
        .from('bulk_email_campaigns')
        .select(cols.join(', '))
        .order('created_at', { ascending: false }));

      if (!campError) break;

      const missing = cols.find(c => OPTIONAL_COLS.includes(c) && campError.message?.includes(c));
      if (!missing) break;
      console.warn(`Columna "${missing}" no existe en bulk_email_campaigns, reintentando sin ella.`);
      cols = cols.filter(c => c !== missing);
    }

    if (campError || !data) {
      setCampaigns([]);
      setLoading(false);
      return;
    }

    // Enriquecer con datos del remitente si sender_id existe
    const senderIds = [...new Set(data.filter(c => c.sender_id).map(c => c.sender_id))];
    let senderMap = {};
    if (senderIds.length > 0) {
      const { data: senders } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', senderIds);
      if (senders) {
        senderMap = Object.fromEntries(senders.map(s => [s.id, s]));
      }
    }

    setCampaigns(data.map(c => ({
      ...c,
      sender: c.sender_id ? senderMap[c.sender_id] || null : null
    })));
    setLoading(false);
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  // Eliminar campaña
  const handleDeleteCampaign = async (campaign) => {
    if (!window.confirm(`¿Eliminar la campaña "${campaign.name}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    // Borrar los adjuntos de Storage. Las rutas se piden acá, para esta sola
    // campaña, en vez de traerlas en la lista de todas.
    if (campaign.attachment_count || campaign.attachment_name) {
      const { data: adj } = await supabase
        .from('bulk_email_campaigns')
        .select('attachments, attachment_path')
        .eq('id', campaign.id)
        .single();

      const paths = [
        ...(Array.isArray(adj?.attachments) ? adj.attachments.map(a => a?.path) : []),
        adj?.attachment_path,
      ].filter(Boolean);

      if (paths.length > 0) {
        await supabase.storage.from('attachments').remove(paths);
      }
    }

    const { error } = await supabase
      .from('bulk_email_campaigns')
      .delete()
      .eq('id', campaign.id);

    if (!error) {
      loadCampaigns();
    }
  };

  // Ver cola de emails
  const handleViewQueue = (campaign) => {
    setSelectedCampaign(campaign);
    setShowQueueModal(true);
  };

  // Reintentar campaña fallida: resetear emails fallidos a "pending"
  const handleRetryCampaign = async (campaign) => {
    const { error: queueError } = await supabase
      .from('bulk_email_queue')
      .update({ status: 'pending', error_message: null })
      .eq('campaign_id', campaign.id)
      .eq('status', 'failed');

    if (queueError) {
      console.error('Error resetting failed emails:', queueError);
      return;
    }

    await supabase
      .from('bulk_email_campaigns')
      .update({ status: 'ready' })
      .eq('id', campaign.id);

    await loadCampaigns();
    setSendingCampaign({ ...campaign, status: 'ready' });
  };

  // Iniciar envío
  const handleStartSending = (campaign) => {
    setSendingCampaign(campaign);
  };

  return (
    <PageContainer gap="none">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Envío Masivo</h1>
          <p className="text-gray-500 mt-1">
            Importá contactos con emails predefinidos y envialos en un click
          </p>
        </div>
        <button
          onClick={() => setShowImportModal(true)}
          className="btn-primary"
        >
          <Upload size={18} />
          Nueva Campaña
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{campaigns.length}</p>
              <p className="text-sm text-gray-500">Campañas</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {campaigns.reduce((acc, c) => acc + (c.total_emails - c.sent_count - c.failed_count), 0)}
              </p>
              <p className="text-sm text-gray-500">Pendientes</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {campaigns.reduce((acc, c) => acc + c.sent_count, 0)}
              </p>
              <p className="text-sm text-gray-500">Enviados</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {campaigns.reduce((acc, c) => acc + c.failed_count, 0)}
              </p>
              <p className="text-sm text-gray-500">Fallidos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Campañas de Email</h2>
          <button
            onClick={loadCampaigns}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-gray-300 animate-spin mx-auto mb-3" />
            <p className="text-gray-500">Cargando campañas...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-12 text-center">
            <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay campañas creadas
            </h3>
            <p className="text-gray-500 mb-4">
              Importá un Excel con contactos y sus emails para comenzar
            </p>
            <button
              onClick={() => setShowImportModal(true)}
              className="btn-primary"
            >
              <Plus size={18} />
              Crear Primera Campaña
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-gray-900">{campaign.name}</h3>
                      <StatusBadge status={campaign.status} variant="campaign" />
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Users size={14} />
                        {campaign.total_emails} emails
                      </span>
                      <span>•</span>
                      <span className="text-green-600">{campaign.sent_count} enviados</span>
                      {campaign.failed_count > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-red-600">{campaign.failed_count} fallidos</span>
                        </>
                      )}
                      {campaign.sender && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-gray-600">
                            <User size={13} />
                            {campaign.sender.full_name || campaign.sender.email}
                          </span>
                        </>
                      )}
                      {(() => {
                        // Del resumen, no de `attachments`: esa columna ya no
                        // se trae en la lista porque puede pesar megabytes.
                        const attCount = campaign.attachment_count
                          ?? (campaign.attachment_name ? 1 : 0);
                        if (attCount === 0) return null;
                        const label = attCount === 1
                          ? campaign.attachment_name
                          : `${attCount} adjuntos`;
                        return (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-primary-600">
                              <Paperclip size={13} />
                              {label}
                            </span>
                          </>
                        );
                      })()}
                      <span>•</span>
                      <span>
                        {format(new Date(campaign.created_at), "d MMM yyyy", { locale: es })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Ver cola */}
                    <button
                      onClick={() => handleViewQueue(campaign)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Ver emails"
                    >
                      <Eye size={18} />
                    </button>

                    {/* Enviar */}
                    {(campaign.status === 'draft' || campaign.status === 'ready' || campaign.status === 'paused') && (
                      <button
                        onClick={() => handleStartSending(campaign)}
                        className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                        title="Iniciar envío"
                      >
                        <Play size={18} />
                      </button>
                    )}

                    {/* Reintentar fallidos */}
                    {campaign.status === 'failed' && (
                      <button
                        onClick={() => handleRetryCampaign(campaign)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                        title="Reintentar emails fallidos"
                      >
                        <RefreshCw size={14} />
                        Reintentar
                      </button>
                    )}

                    {/* Reintentar fallidos de campaña completada con errores */}
                    {campaign.status === 'completed' && campaign.failed_count > 0 && (
                      <button
                        onClick={() => handleRetryCampaign(campaign)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                        title="Reintentar emails fallidos"
                      >
                        <RefreshCw size={14} />
                        Reintentar ({campaign.failed_count})
                      </button>
                    )}

                    {/* Eliminar */}
                    {campaign.status !== 'sending' && (
                      <button
                        onClick={() => handleDeleteCampaign(campaign)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {campaign.total_emails > 0 && campaign.sent_count > 0 && (
                  <div className="mt-3">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{
                          width: `${(campaign.sent_count / campaign.total_emails) * 100}%`
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {Math.round((campaign.sent_count / campaign.total_emails) * 100)}% completado
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <BulkEmailImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false);
            loadCampaigns();
          }}
        />
      )}

      {/* Queue Modal */}
      {showQueueModal && selectedCampaign && (
        <BulkEmailQueueModal
          campaign={selectedCampaign}
          onClose={() => {
            setShowQueueModal(false);
            setSelectedCampaign(null);
          }}
          onRefresh={loadCampaigns}
        />
      )}

      {/* Sender Modal */}
      {sendingCampaign && (
        <BulkEmailSender
          campaign={sendingCampaign}
          onClose={() => {
            setSendingCampaign(null);
            loadCampaigns();
          }}
          onComplete={() => {
            setSendingCampaign(null);
            loadCampaigns();
          }}
        />
      )}
    </PageContainer>
  );
};

export default BulkEmail;
