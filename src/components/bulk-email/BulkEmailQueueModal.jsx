// src/components/bulk-email/BulkEmailQueueModal.jsx
import { useState, useEffect } from 'react';
import {
  X,
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Trash2,
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Status config
const statusConfig = {
  pending: { label: 'Pendiente', color: 'bg-gray-100 text-gray-700', icon: Clock },
  sending: { label: 'Enviando', color: 'bg-amber-100 text-amber-700', icon: RefreshCw },
  sent: { label: 'Enviado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  failed: { label: 'Error', color: 'bg-red-100 text-red-700', icon: XCircle },
  skipped: { label: 'Omitido', color: 'bg-gray-100 text-gray-500', icon: X },
};

export const BulkEmailQueueModal = ({ campaign, onClose, onRefresh }) => {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [previewEmail, setPreviewEmail] = useState(null);

  // Cargar cola
  const loadQueue = async () => {
    setLoading(true);
    let query = supabase
      .from('bulk_email_queue')
      .select('*')
      .eq('campaign_id', campaign.id)
      .order('created_at', { ascending: true });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data, error } = await query;

    if (!error) {
      setQueue(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadQueue();
  }, [campaign.id, filter]);

  // Filtrar por búsqueda
  const filteredQueue = queue.filter(item =>
    item.to_email.toLowerCase().includes(search.toLowerCase()) ||
    item.to_name?.toLowerCase().includes(search.toLowerCase()) ||
    item.subject.toLowerCase().includes(search.toLowerCase())
  );

  // Eliminar un email de la cola
  const handleDeleteItem = async (item) => {
    if (!window.confirm('¿Eliminar este email de la cola?')) return;

    const { error } = await supabase
      .from('bulk_email_queue')
      .delete()
      .eq('id', item.id);

    if (!error) {
      loadQueue();
      onRefresh?.();
    }
  };

  // Stats
  const stats = {
    total: queue.length,
    pending: queue.filter(q => q.status === 'pending').length,
    sent: queue.filter(q => q.status === 'sent').length,
    failed: queue.filter(q => q.status === 'failed').length,
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex items-center justify-center min-h-screen p-4">
        <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{campaign.name}</h2>
              <p className="text-sm text-gray-500">Cola de emails</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stats */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Total:</span>
                <span className="font-semibold text-gray-900">{stats.total}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-gray-400" />
                <span className="text-sm text-gray-500">Pendientes:</span>
                <span className="font-semibold text-gray-900">{stats.pending}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-green-500" />
                <span className="text-sm text-gray-500">Enviados:</span>
                <span className="font-semibold text-green-600">{stats.sent}</span>
              </div>
              {stats.failed > 0 && (
                <div className="flex items-center gap-2">
                  <XCircle size={14} className="text-red-500" />
                  <span className="text-sm text-gray-500">Fallidos:</span>
                  <span className="font-semibold text-red-600">{stats.failed}</span>
                </div>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por email, nombre o asunto..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:border-primary-500 outline-none"
              />
            </div>

            {/* Status Filter */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-primary-500 outline-none"
            >
              <option value="all">Todos los estados</option>
              <option value="pending">Pendientes</option>
              <option value="sent">Enviados</option>
              <option value="failed">Fallidos</option>
            </select>

            {/* Refresh */}
            <button
              onClick={loadQueue}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <RefreshCw size={18} />
            </button>
          </div>

          {/* Queue List */}
          <div className="max-h-[50vh] overflow-y-auto">
            {loading ? (
              <div className="p-12 text-center">
                <RefreshCw className="w-8 h-8 text-gray-300 animate-spin mx-auto mb-3" />
                <p className="text-gray-500">Cargando...</p>
              </div>
            ) : filteredQueue.length === 0 ? (
              <div className="p-12 text-center">
                <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No hay emails en la cola</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredQueue.map((item) => {
                  const status = statusConfig[item.status] || statusConfig.pending;
                  const StatusIcon = status.icon;

                  return (
                    <div
                      key={item.id}
                      className="px-6 py-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <p className="font-medium text-gray-900 truncate">
                              {item.to_name || item.to_email}
                            </p>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${status.color}`}>
                              <StatusIcon size={12} className={item.status === 'sending' ? 'animate-spin' : ''} />
                              {status.label}
                            </span>
                          </div>

                          {item.to_name && (
                            <p className="text-sm text-gray-500 truncate">{item.to_email}</p>
                          )}

                          <p className="text-sm text-gray-600 mt-1 truncate">
                            <strong>Asunto:</strong> {item.subject}
                          </p>

                          {item.error_message && (
                            <p className="text-xs text-red-600 mt-1 truncate">
                              Error: {item.error_message}
                            </p>
                          )}

                          {item.sent_at && (
                            <p className="text-xs text-gray-400 mt-1">
                              Enviado: {format(new Date(item.sent_at), "d MMM yyyy HH:mm", { locale: es })}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setPreviewEmail(item)}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                            title="Ver email"
                          >
                            <Eye size={16} />
                          </button>

                          {item.status === 'pending' && (
                            <button
                              onClick={() => handleDeleteItem(item)}
                              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              title="Eliminar"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button onClick={onClose} className="btn-secondary">
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Email Preview Modal */}
      {previewEmail && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setPreviewEmail(null)} />
          <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Preview del Email</h3>
              <button onClick={() => setPreviewEmail(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-gray-500 mb-1">Para:</p>
              <p className="font-medium text-gray-900 mb-4">
                {previewEmail.to_name && `${previewEmail.to_name} `}&lt;{previewEmail.to_email}&gt;
              </p>

              <p className="text-sm text-gray-500 mb-1">Asunto:</p>
              <p className="font-medium text-gray-900 mb-4">{previewEmail.subject}</p>

              <p className="text-sm text-gray-500 mb-1">Mensaje:</p>
              <div className="p-4 bg-gray-50 rounded-lg whitespace-pre-wrap text-sm text-gray-700">
                {previewEmail.body}
              </div>

              {previewEmail.error_message && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">
                    <strong>Error:</strong> {previewEmail.error_message}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkEmailQueueModal;