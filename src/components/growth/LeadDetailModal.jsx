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
  RefreshCw,
  AlertCircle,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { GROWTH_VERTICALS } from '../../config/constants';

const verticalColors = {
  DIRECT_B2B: 'from-blue-500 to-cyan-500',
  PHARMA: 'from-violet-500 to-purple-500',
  INFLUENCER: 'from-amber-500 to-orange-500',
  EVENTS: 'from-emerald-500 to-teal-500',
};

export const LeadDetailModal = ({ lead, onClose, onSave, onPromote, onIgnore, onEnrichDescription }) => {
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
  const [discovering, setDiscovering] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState(null);
  const [discoveryError, setDiscoveryError] = useState(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichmentError, setEnrichmentError] = useState(null);
  const [enrichmentDone, setEnrichmentDone] = useState(false);

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

  const handleDiscoverEmail = async () => {
    setDiscovering(true);
    setDiscoveryResult(null);
    setDiscoveryError(null);

    try {
      const response = await fetch('/api/email-discovery-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_ids: [lead.id] }),
      });

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (_) {
        throw new Error(`Error del servidor (${response.status}): ${responseText.slice(0, 150)}`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Error en la búsqueda de email');
      }

      const detail = data.results?.details?.[0];

      if (detail?.status === 'found' && detail.email) {
        setForm(prev => ({ ...prev, email: detail.email }));
        setDiscoveryResult({
          email: detail.email,
          confidence: detail.confidence,
          source_url: detail.source_url,
          source_description: detail.source_description,
          alternative_emails: detail.alternative_emails || [],
          notes: detail.notes,
        });
      } else if (detail?.status === 'rate_limited') {
        setDiscoveryError('Límite de API alcanzado. Intentá de nuevo en unos minutos.');
      } else {
        setDiscoveryError(detail?.notes || 'No se encontró un email para este lead.');
      }
    } catch (err) {
      console.error('Error discovering email:', err);
      setDiscoveryError(err.message);
    } finally {
      setDiscovering(false);
    }
  };

  const handleEnrichDescription = async () => {
    if (!onEnrichDescription) return;
    setEnriching(true);
    setEnrichmentError(null);
    setEnrichmentDone(false);

    try {
      const data = await onEnrichDescription(lead.id);

      if (data?.success && data.result?.description) {
        setForm(prev => ({
          ...prev,
          extra_data: {
            ...(prev.extra_data || {}),
            description: data.result.description,
            description_sources: data.result.sources || [],
            description_enriched_at: new Date().toISOString(),
            description_confidence: data.result.confidence || 'medium',
            description_original: prev.extra_data?.description || null,
          },
        }));
        setEnrichmentDone(true);
      } else {
        setEnrichmentError(
          data?.result?.notes || 'No se encontró información adicional para este lead.'
        );
      }
    } catch (err) {
      console.error('Error enriching description:', err);
      setEnrichmentError(err.message);
    } finally {
      setEnriching(false);
    }
  };

  const description = form.extra_data?.description || '';
  const isDescriptionEnriched = !!form.extra_data?.description_enriched_at;

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
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm"
                    placeholder="Agregar email manualmente..."
                  />
                  {!form.email && !discovering && (
                    <button
                      onClick={handleDiscoverEmail}
                      className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors whitespace-nowrap"
                      title="Buscar email con IA"
                    >
                      <Search size={14} />
                      Buscar
                    </button>
                  )}
                  {discovering && (
                    <div className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-xl whitespace-nowrap">
                      <RefreshCw size={14} className="animate-spin" />
                      Buscando...
                    </div>
                  )}
                </div>

                {/* Hint when no email and not yet searched */}
                {!form.email && !discoveryResult && !discoveryError && !discovering && (
                  <p className="mt-1 text-xs text-amber-600">
                    Agregá el email manualmente o buscalo con IA
                  </p>
                )}

                {/* Discovery error */}
                {discoveryError && (
                  <div className="mt-1.5 flex items-start gap-1.5 text-xs text-red-600">
                    <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                    <span>{discoveryError}</span>
                  </div>
                )}

                {/* Discovery success metadata (just found) */}
                {discoveryResult && (
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-50 text-blue-700">
                      AI Web Search
                    </span>
                    {discoveryResult.confidence && (
                      <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full ${
                        discoveryResult.confidence === 'high' ? 'bg-green-50 text-green-700' :
                        discoveryResult.confidence === 'medium' ? 'bg-amber-50 text-amber-700' :
                        'bg-red-50 text-red-700'
                      }`}>
                        {discoveryResult.confidence === 'high' ? 'Alta confianza' :
                         discoveryResult.confidence === 'medium' ? 'Confianza media' :
                         'Baja confianza'}
                      </span>
                    )}
                    {discoveryResult.source_url && (
                      <a
                        href={discoveryResult.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-600 hover:underline truncate max-w-[200px]"
                      >
                        Fuente
                      </a>
                    )}
                  </div>
                )}

                {/* Existing DB metadata (previously discovered) */}
                {!discoveryResult && lead.email_discovery_method && (
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
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                  <FileText size={14} />
                  Descripción
                  {isDescriptionEnriched && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-50 text-purple-700">
                      <Sparkles size={10} />
                      Enriquecida con IA
                    </span>
                  )}
                </label>
                {onEnrichDescription && !enriching && (
                  <button
                    onClick={handleEnrichDescription}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
                    title="Buscar información en la web con IA para generar una descripción más completa"
                  >
                    <Sparkles size={13} />
                    {description ? 'Enriquecer con IA' : 'Generar con IA'}
                  </button>
                )}
                {enriching && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded-lg">
                    <RefreshCw size={13} className="animate-spin" />
                    Investigando en la web...
                  </div>
                )}
              </div>

              {description ? (
                <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-700 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {description}
                </div>
              ) : !enriching && (
                <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-400 italic text-center">
                  Sin descripción. Usá "Generar con IA" para investigar este lead en la web.
                </div>
              )}

              {/* Enrichment success indicator */}
              {enrichmentDone && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-green-600">
                  <CheckCircle2 size={12} />
                  <span>Descripción enriquecida y guardada</span>
                </div>
              )}

              {/* Enrichment error */}
              {enrichmentError && (
                <div className="mt-1.5 flex items-start gap-1.5 text-xs text-red-600">
                  <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                  <span>{enrichmentError}</span>
                </div>
              )}

              {/* Source URLs from enrichment */}
              {form.extra_data?.description_sources?.length > 0 && (
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-gray-500">Fuentes:</span>
                  {form.extra_data.description_sources.slice(0, 3).map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-blue-600 hover:underline truncate max-w-[200px]"
                    >
                      {new URL(url).hostname}
                    </a>
                  ))}
                  {form.extra_data.description_sources.length > 3 && (
                    <span className="text-[10px] text-gray-400">
                      +{form.extra_data.description_sources.length - 3} más
                    </span>
                  )}
                </div>
              )}
            </div>
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
