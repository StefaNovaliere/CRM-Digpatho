// src/components/growth/QueryManagerModal.jsx
// Modal para gestionar los search queries personalizados por vertical.
// Los queries custom se combinan con los hardcoded al ejecutar el pipeline.

import { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Search,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Save,
  AlertCircle,
  Info
} from 'lucide-react';
import { GROWTH_VERTICALS } from '../../config/constants';

const verticalColors = {
  DIRECT_B2B: 'from-blue-500 to-cyan-500',
  PHARMA: 'from-violet-500 to-purple-500',
  INFLUENCER: 'from-amber-500 to-orange-500',
  EVENTS: 'from-emerald-500 to-teal-500',
};

export const QueryManagerModal = ({
  vertical,
  onClose,
  loadCustomQueries,
  addCustomQuery,
  updateCustomQuery,
  deleteCustomQuery,
}) => {
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newQuery, setNewQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);

  const verticalConfig = GROWTH_VERTICALS[vertical] || {};
  const gradientClass = verticalColors[vertical] || 'from-gray-500 to-gray-600';

  useEffect(() => {
    loadQueries();
  }, [vertical]);

  const loadQueries = async () => {
    setLoading(true);
    const data = await loadCustomQueries(vertical);
    setQueries(data);
    setLoading(false);
  };

  const handleAdd = async () => {
    const trimmed = newQuery.trim();
    if (!trimmed) return;

    setAdding(true);
    setError(null);

    const result = await addCustomQuery(vertical, trimmed);
    if (result) {
      setQueries(prev => [result, ...prev]);
      setNewQuery('');
    } else {
      setError('Error al agregar el query');
    }
    setAdding(false);
  };

  const handleToggle = async (query) => {
    const ok = await updateCustomQuery(query.id, { enabled: !query.enabled });
    if (ok) {
      setQueries(prev => prev.map(q =>
        q.id === query.id ? { ...q, enabled: !q.enabled } : q
      ));
    }
  };

  const handleDelete = async (queryId) => {
    const ok = await deleteCustomQuery(queryId);
    if (ok) {
      setQueries(prev => prev.filter(q => q.id !== queryId));
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex items-center justify-center min-h-screen p-4">
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">

          {/* Header */}
          <div className={`flex items-center justify-between px-6 py-4 bg-gradient-to-r ${gradientClass}`}>
            <div className="flex items-center gap-3 text-white">
              <Search className="w-5 h-5" />
              <div>
                <h2 className="font-semibold">Search Queries — {verticalConfig.label}</h2>
                <p className="text-sm text-white/80">
                  Queries personalizados para guiar la búsqueda de leads
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/80 rounded-lg hover:bg-white/20 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[65vh] overflow-y-auto space-y-4">

            {/* Info */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl text-sm text-blue-700">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p>Los queries custom se suman a los predefinidos al ejecutar el pipeline.</p>
                <p className="mt-1 text-blue-600">
                  Tip: Usá el formato <code className="bg-blue-100 px-1 rounded">site:linkedin.com/in "cargo" "empresa" OR "país"</code> para buscar perfiles específicos.
                </p>
              </div>
            </div>

            {/* Add new query */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Agregar nuevo query
              </label>
              <div className="flex gap-2">
                <textarea
                  value={newQuery}
                  onChange={(e) => setNewQuery(e.target.value)}
                  rows={2}
                  placeholder='Ej: site:linkedin.com/in "Director" "patología" hospital Argentina'
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm resize-none"
                />
                <button
                  onClick={handleAdd}
                  disabled={adding || !newQuery.trim()}
                  className="self-end flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {adding ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                  Agregar
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* Custom queries list */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Queries personalizados ({queries.length})
              </h3>

              {loading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                  <RefreshCw size={14} className="animate-spin" />
                  Cargando...
                </div>
              ) : queries.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">
                  No hay queries personalizados para esta vertical. Se usarán solo los predefinidos.
                </p>
              ) : (
                <div className="space-y-2">
                  {queries.map((q) => (
                    <div
                      key={q.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border text-sm transition-colors ${
                        q.enabled
                          ? 'bg-white border-gray-200'
                          : 'bg-gray-50 border-gray-100 opacity-60'
                      }`}
                    >
                      <button
                        onClick={() => handleToggle(q)}
                        className={`mt-0.5 flex-shrink-0 ${q.enabled ? 'text-green-500' : 'text-gray-300'}`}
                        title={q.enabled ? 'Desactivar' : 'Activar'}
                      >
                        {q.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>
                      <p className="flex-1 text-gray-700 break-all leading-relaxed">
                        {q.query}
                      </p>
                      <button
                        onClick={() => handleDelete(q.id)}
                        className="flex-shrink-0 p-1 text-gray-300 hover:text-red-500 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueryManagerModal;
