// src/pages/BulkEmail.jsx
import { useState, useEffect } from 'react';
import {
  Send,
  Upload,
  Play,
  Pause,
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
  AlertCircle,
  Paperclip
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { BulkEmailImportModal } from '../components/bulk-email/BulkEmailImportModal';
import { BulkEmailQueueModal } from '../components/bulk-email/BulkEmailQueueModal';
import { BulkEmailSender } from '../components/bulk-email/BulkEmailSender';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Status badges
const StatusBadge = ({ status }) => {
  const config = {
    draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-700', icon: Clock },
    ready: { label: 'Listo', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
    sending: { label: 'Enviando...', color: 'bg-amber-100 text-amber-700', icon: RefreshCw },
    completed: { label: 'Completado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    paused: { label: 'Pausado', color: 'bg-orange-100 text-orange-700', icon: Pause },
    failed: { label: 'Error', color: 'bg-red-100 text-red-700', icon: XCircle },
  };

  const { label, color, icon: Icon } = config[status] || config.draft;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${color}`}>
      <Icon size={12} className={status === 'sending' ? 'animate-spin' : ''} />
      {label}
    </span>
  );
};

export const BulkEmail = () => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [sendingCampaign, setSendingCampaign] = useState(null);

  // Cargar campañas
  const loadCampaigns = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('bulk_email_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) {
      setCampaigns(data || []);
    }
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

    // Eliminar adjunto de Storage si existe
    if (campaign.attachment_path) {
      await supabase.storage
        .from('attachments')
        .remove([campaign.attachment_path]);
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

  // Iniciar envío
  const handleStartSending = (campaign) => {
    setSendingCampaign(campaign);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
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
                      <StatusBadge status={campaign.status} />
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
                      {campaign.attachment_name && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-primary-600">
                            <Paperclip size={13} />
                            {campaign.attachment_name}
                          </span>
                        </>
                      )}
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
    </div>
  );
};

export default BulkEmail;