// src/components/growth/LeadDetailModal.jsx
// Modal para ver detalle completo de un lead y editar sus campos.
// Permite agregar email manualmente ya que SerpAPI no siempre lo encuentra.

import { useState } from 'react';
import {
  X,
  Save,
  UserPlus,
  Trash2,
  ExternalLink,
  Building2,
  Briefcase,
  Globe,
  AtSign,
  User,
  FileText,
  Search,
  RefreshCw
} from 'lucide-react';
import { GROWTH_VERTICALS } from '../../config/constants';

const verticalColors = {
  DIRECT_B2B: 'from-blue-500 to-cyan-500',
  PHARMA: 'from-violet-500 to-purple-500',
  INFLUENCER: 'from-amber-500 to-orange-500',
  EVENTS: 'from-emerald-500 to-teal-500',
};

export const LeadDetailModal = ({ lead, onClose, onSave, onPromote, onIgnore }) => {
  const [form, setForm] = useState({
    full_name: lead.full_name || '',
    first_name: lead.first_name || lead.full_name?.split(' ')[0] || '',
    last_name: lead.last_name || lead.full_name?.split(' ').slice(1).join(' ') || '',
    job_title: lead.job_title || '',
    company: lead.company || '',
    email: lead.email || '',
    geo: lead.geo || '',
    extra_data: lead.extra_data || {},
  });
  const [saving, setSaving] = useState(false);
  const [promoting, setPromoting] = useState(false);

  const verticalConfig = GROWTH_VERTICALS[lead.vertical] || {};
  const gradientClass = verticalColors[lead.vertical] || 'from-gray-500 to-gray-600';

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Auto-split name
    if (field === 'full_name') {
      const parts = value.trim().split(/\s+/);
      setForm(prev => ({
        ...prev,
        full_name: value,
        first_name: parts[0] || '',
        last_name: parts.slice(1).join(' ') || '',
      }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({ id: lead.id, ...form });
    setSaving(false);
  };

  const handlePromote = async () => {
    setPromoting(true);
    await onPromote({ ...lead, ...form });
    setPromoting(false);
  };

  const description = form.extra_data?.description || '';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex items-center justify-center min-h-screen p-4">
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">

          {/* Header */}
          <div className={`flex items-center justify-between px-6 py-4 bg-gradient-to-r ${gradientClass}`}>
            <div className="flex items-center gap-3 text-white">
              <User className="w-5 h-5" />
              <div>
                <h2 className="font-semibold">Detalle del Lead</h2>
                <p className="text-sm text-white/80">
                  {verticalConfig.label} — {lead.status === 'promoted' ? 'Promovido' : lead.status === 'ignored' ? 'Descartado' : 'Activo'}
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

            {/* Nombre completo */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                <User size={14} />
                Nombre completo
              </label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => handleChange('full_name', e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm"
                placeholder="Nombre del contacto"
              />
            </div>

            {/* Cargo + Empresa */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                  <Briefcase size={14} />
                  Cargo
                </label>
                <input
                  type="text"
                  value={form.job_title}
                  onChange={(e) => handleChange('job_title', e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm"
                  placeholder="Ej: Pathologist, Lab Director"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                  <Building2 size={14} />
                  Empresa / Institución
                </label>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => handleChange('company', e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm"
                  placeholder="Ej: Hospital Italiano"
                />
              </div>
            </div>

            {/* Email + Geo */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                  <AtSign size={14} />
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm"
                  placeholder="Agregar email manualmente..."
                />
                {!form.email && (
                  <p className="mt-1 text-xs text-amber-600">
                    Podés agregar el email encontrado manualmente
                  </p>
                )}
                {lead.email_discovery_method && (
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-50 text-blue-700">
                      {lead.email_discovery_method === 'ai_web_search' ? 'AI Web Search' :
                       lead.email_discovery_method === 'google_snippet' ? 'Google Snippet' :
                       'Manual'}
                    </span>
                    {lead.email_confidence && (
                      <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full ${
                        lead.email_confidence === 'high' ? 'bg-green-50 text-green-700' :
                        lead.email_confidence === 'medium' ? 'bg-amber-50 text-amber-700' :
                        'bg-red-50 text-red-700'
                      }`}>
                        {lead.email_confidence === 'high' ? 'Alta confianza' :
                         lead.email_confidence === 'medium' ? 'Confianza media' :
                         'Baja confianza'}
                      </span>
                    )}
                    {lead.email_source_url && (
                      <a
                        href={lead.email_source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-600 hover:underline truncate max-w-[200px]"
                      >
                        Fuente
                      </a>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                  <Globe size={14} />
                  Geo / País
                </label>
                <input
                  type="text"
                  value={form.geo}
                  onChange={(e) => handleChange('geo', e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm"
                  placeholder="Ej: Argentina, LATAM"
                />
              </div>
            </div>

            {/* LinkedIn */}
            {lead.linkedin_url && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl text-sm">
                <ExternalLink className="w-4 h-4 text-blue-500" />
                <span className="text-gray-500">LinkedIn:</span>
                <a
                  href={lead.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 hover:text-blue-700 hover:underline truncate"
                >
                  {lead.linkedin_url}
                </a>
              </div>
            )}

            {/* Source query */}
            {lead.source_query && (
              <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl text-sm">
                <Search className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-gray-500">Query de búsqueda:</span>
                  <p className="text-gray-700 mt-0.5">{lead.source_query}</p>
                </div>
              </div>
            )}

            {/* Description / Snippet */}
            {description && (
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                  <FileText size={14} />
                  Descripción
                </label>
                <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {description}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2">
              {lead.status !== 'promoted' && lead.status !== 'ignored' && (
                <button
                  onClick={() => onIgnore(lead.id)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Descartar
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar cambios
              </button>
              {lead.status !== 'promoted' && (
                <button
                  onClick={handlePromote}
                  disabled={promoting}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                >
                  {promoting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Promover al CRM
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadDetailModal;
