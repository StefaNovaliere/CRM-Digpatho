// src/pages/GrowthSystem.jsx
// Página principal del Growth System: leads descubiertos + borradores pendientes
// Los datos vienen de las tablas growth_leads y growth_email_drafts
// generadas por el pipeline Python (ai_growth_system.py).

import { useState, useEffect } from 'react';
import {
  Rocket,
  Search,
  RefreshCw,
  Users,
  Mail,
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  UserPlus,
  Trash2,
  ExternalLink,
  Building2,
  FlaskConical,
  Megaphone,
  CalendarDays,
  Filter,
  ChevronDown,
  AlertCircle,
  Target,
  Play,
  FileText,
  Zap,
  X,
  Briefcase,
  Globe,
  AtSign
} from 'lucide-react';
import { useGrowthSystem } from '../hooks/useGrowthSystem';
import { DraftReviewModal } from '../components/growth/DraftReviewModal';
import { GROWTH_VERTICALS, GROWTH_LEAD_STATUSES, GROWTH_DRAFT_STATUSES } from '../config/constants';

// ========================================
// Constantes de UI
// ========================================
const VERTICAL_ICONS = {
  DIRECT_B2B: Building2,
  PHARMA: FlaskConical,
  INFLUENCER: Megaphone,
  EVENTS: CalendarDays
};

const VERTICAL_COLORS = {
  DIRECT_B2B: { bg: 'bg-blue-100', text: 'text-blue-700', ring: 'ring-blue-200', accent: 'bg-blue-500' },
  PHARMA: { bg: 'bg-violet-100', text: 'text-violet-700', ring: 'ring-violet-200', accent: 'bg-violet-500' },
  INFLUENCER: { bg: 'bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-200', accent: 'bg-amber-500' },
  EVENTS: { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-200', accent: 'bg-emerald-500' }
};

const STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-700',
  draft_generated: 'bg-violet-100 text-violet-700',
  promoted: 'bg-green-100 text-green-700',
  ignored: 'bg-gray-100 text-gray-500',
  draft_pending_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  sent: 'bg-blue-100 text-blue-700'
};

// ========================================
// Sub-componentes
// ========================================

const VerticalBadge = ({ vertical }) => {
  const config = GROWTH_VERTICALS[vertical];
  const colors = VERTICAL_COLORS[vertical] || VERTICAL_COLORS.DIRECT_B2B;
  const Icon = VERTICAL_ICONS[vertical] || Target;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${colors.bg} ${colors.text}`}>
      <Icon size={12} />
      {config?.label || vertical}
    </span>
  );
};

const StatusBadge = ({ status, type = 'lead' }) => {
  const config = type === 'lead'
    ? GROWTH_LEAD_STATUSES[status]
    : GROWTH_DRAFT_STATUSES[status];
  const colorClass = STATUS_COLORS[status] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${colorClass}`}>
      {config?.label || status}
    </span>
  );
};

const StatCard = ({ icon: Icon, iconColor, value, label }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5">
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 ${iconColor} rounded-lg flex items-center justify-center`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  </div>
);

// ========================================
// TABS: Leads / Borradores
// ========================================
const TABS = [
  { id: 'leads', label: 'Leads Descubiertos', icon: Users },
  { id: 'drafts', label: 'Borradores Pendientes', icon: Mail },
];

// ========================================
// Componente principal
// ========================================
export const GrowthSystem = () => {
  const {
    leads, drafts, stats, loading, error,
    loadLeads, loadDrafts, loadStats,
    updateDraftStatus, promoteLeadToContact, ignoreLead,
    runPipeline, pipelineRunning, pipelineResult, setPipelineResult
  } = useGrowthSystem();

  const [activeTab, setActiveTab] = useState('leads');
  const [selectedVertical, setSelectedVertical] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [promoting, setPromoting] = useState(null); // leadId being promoted
  const [showModeMenu, setShowModeMenu] = useState(null); // vertical key or null

  // Pipeline execution
  const handleRunPipeline = async (vertical, mode) => {
    setShowModeMenu(null);
    const result = await runPipeline(vertical, mode);
    if (result) {
      // Refresh data after pipeline completes
      loadStats();
      const v = selectedVertical === 'all' ? null : selectedVertical;
      loadLeads({ vertical: v, search: searchQuery || null });
      loadDrafts({ vertical: v });
    }
  };

  // Initial load
  useEffect(() => {
    loadStats();
    loadLeads({ vertical: selectedVertical === 'all' ? null : selectedVertical });
    loadDrafts({ vertical: selectedVertical === 'all' ? null : selectedVertical });
  }, []);

  // Reload on filter change
  useEffect(() => {
    const v = selectedVertical === 'all' ? null : selectedVertical;
    loadLeads({ vertical: v, search: searchQuery || null });
    loadDrafts({ vertical: v });
  }, [selectedVertical]);

  const handleSearch = () => {
    const v = selectedVertical === 'all' ? null : selectedVertical;
    loadLeads({ vertical: v, search: searchQuery || null });
  };

  const handleRefresh = () => {
    loadStats();
    const v = selectedVertical === 'all' ? null : selectedVertical;
    loadLeads({ vertical: v, search: searchQuery || null });
    loadDrafts({ vertical: v });
  };

  // Draft actions
  const handleApproveDraft = async (draftId, notes) => {
    const ok = await updateDraftStatus(draftId, 'approved', notes);
    if (ok) {
      setSelectedDraft(null);
      loadStats();
    }
  };

  const handleRejectDraft = async (draftId, notes) => {
    const ok = await updateDraftStatus(draftId, 'rejected', notes);
    if (ok) {
      setSelectedDraft(null);
      loadStats();
    }
  };

  // Lead actions
  const handlePromote = async (lead) => {
    setPromoting(lead.id);
    const contact = await promoteLeadToContact(lead);
    setPromoting(null);
    if (contact) {
      loadStats();
    }
  };

  const handleIgnore = async (leadId) => {
    await ignoreLead(leadId);
    loadStats();
  };

  // Filter drafts for display
  const pendingDrafts = drafts.filter(d => d.status === 'draft_pending_review');

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Rocket size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Growth System</h1>
              <p className="text-gray-500">
                Prospección inteligente — Leads y borradores de email por vertical
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Users}
          iconColor="bg-blue-100 text-blue-600"
          value={stats.totalLeads}
          label="Total Leads"
        />
        <StatCard
          icon={Clock}
          iconColor="bg-amber-100 text-amber-600"
          value={stats.pendingDrafts}
          label="Borradores Pendientes"
        />
        <StatCard
          icon={CheckCircle}
          iconColor="bg-green-100 text-green-600"
          value={stats.approvedDrafts}
          label="Aprobados"
        />
        <StatCard
          icon={UserPlus}
          iconColor="bg-violet-100 text-violet-600"
          value={stats.promoted}
          label="Promovidos al CRM"
        />
      </div>

      {/* Pipeline Result Banner */}
      {pipelineResult && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-emerald-800">
              Pipeline completado — {GROWTH_VERTICALS[pipelineResult.vertical]?.label || pipelineResult.vertical}
            </p>
            <div className="flex items-center gap-4 mt-1 text-sm text-emerald-700">
              {pipelineResult.leads_found > 0 && (
                <span>{pipelineResult.leads_found} leads encontrados</span>
              )}
              {pipelineResult.leads_inserted > 0 && (
                <span>{pipelineResult.leads_inserted} insertados</span>
              )}
              {pipelineResult.duplicates > 0 && (
                <span>{pipelineResult.duplicates} duplicados</span>
              )}
              {pipelineResult.drafts_created > 0 && (
                <span>{pipelineResult.drafts_created} borradores creados</span>
              )}
            </div>
          </div>
          <button onClick={() => setPipelineResult(null)} className="p-1 text-emerald-400 hover:text-emerald-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Vertical Breakdown with Pipeline Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Object.entries(GROWTH_VERTICALS).map(([key, config]) => {
          const vStats = stats.byVertical[key] || { leads: 0, new: 0 };
          const colors = VERTICAL_COLORS[key];
          const Icon = VERTICAL_ICONS[key];
          const isRunning = pipelineRunning === key;
          const isMenuOpen = showModeMenu === key;

          return (
            <div
              key={key}
              className={`relative p-4 rounded-xl border transition-all ${
                selectedVertical === key
                  ? `${colors.bg} border-transparent ring-2 ${colors.ring}`
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Card content — clickable to filter */}
              <button
                onClick={() => setSelectedVertical(selectedVertical === key ? 'all' : key)}
                className="w-full text-left"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={16} className={selectedVertical === key ? colors.text : 'text-gray-400'} />
                  <span className={`text-sm font-semibold ${selectedVertical === key ? colors.text : 'text-gray-900'}`}>
                    {config.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{vStats.leads} leads | {vStats.new} nuevos</p>
              </button>

              {/* Run Pipeline Button */}
              <div className="mt-3 relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowModeMenu(isMenuOpen ? null : key);
                  }}
                  disabled={isRunning}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                    isRunning
                      ? 'bg-gray-100 text-gray-400 cursor-wait'
                      : `${colors.accent} text-white hover:opacity-90 shadow-sm`
                  }`}
                >
                  {isRunning ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      Ejecutando...
                    </>
                  ) : (
                    <>
                      <Play size={13} />
                      Ejecutar Pipeline
                    </>
                  )}
                </button>

                {/* Mode selection dropdown */}
                {isMenuOpen && !isRunning && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowModeMenu(null)} />
                    <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden animate-scale-in">
                      <button
                        onClick={() => handleRunPipeline(key, 'full')}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left hover:bg-gray-50 transition-colors"
                      >
                        <Zap size={13} className="text-violet-500" />
                        <div>
                          <p className="font-semibold text-gray-900">Completo</p>
                          <p className="text-gray-500">Buscar leads + generar borradores</p>
                        </div>
                      </button>
                      <button
                        onClick={() => handleRunPipeline(key, 'search')}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left hover:bg-gray-50 transition-colors border-t border-gray-100"
                      >
                        <Search size={13} className="text-blue-500" />
                        <div>
                          <p className="font-semibold text-gray-900">Solo buscar</p>
                          <p className="text-gray-500">Descubrir leads sin generar emails</p>
                        </div>
                      </button>
                      <button
                        onClick={() => handleRunPipeline(key, 'draft')}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left hover:bg-gray-50 transition-colors border-t border-gray-100"
                      >
                        <FileText size={13} className="text-amber-500" />
                        <div>
                          <p className="font-semibold text-gray-900">Solo borradores</p>
                          <p className="text-gray-500">Generar emails para leads existentes</p>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
            {tab.id === 'drafts' && pendingDrafts.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full">
                {pendingDrafts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search (leads tab only) */}
      {activeTab === 'leads' && (
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, empresa o cargo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm"
            />
          </div>
          {selectedVertical !== 'all' && (
            <button
              onClick={() => setSelectedVertical('all')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <XCircle size={14} />
              Limpiar filtro
            </button>
          )}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Error al cargar datos</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
            <p className="text-xs text-red-500 mt-2">
              Verificá que las tablas growth_leads y growth_email_drafts existan.
              Ejecutá el SQL de migrations/001_growth_system_tables.sql en Supabase.
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

        {/* LEADS TAB */}
        {activeTab === 'leads' && (
          <>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                Leads Descubiertos
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({leads.length} {selectedVertical !== 'all' ? `en ${GROWTH_VERTICALS[selectedVertical]?.label}` : 'total'})
                </span>
              </h2>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <RefreshCw className="w-8 h-8 text-gray-300 animate-spin mx-auto mb-3" />
                <p className="text-gray-500">Cargando leads...</p>
              </div>
            ) : leads.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No hay leads todavía
                </h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  Usá el botón <strong>"Ejecutar Pipeline"</strong> en cada vertical para descubrir leads automáticamente.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {leads.map((lead) => (
                  <div
                    key={lead.id}
                    className="px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1">
                          <h3 className="font-medium text-gray-900 truncate">
                            {lead.full_name || '[Sin nombre]'}
                          </h3>
                          <VerticalBadge vertical={lead.vertical} />
                          <StatusBadge status={lead.status} type="lead" />
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          {lead.job_title && (
                            <span className="flex items-center gap-1">
                              <Briefcase size={13} />
                              {lead.job_title}
                            </span>
                          )}
                          {lead.company && (
                            <span className="flex items-center gap-1">
                              <Building2 size={13} />
                              {lead.company}
                            </span>
                          )}
                          {lead.geo && (
                            <span className="flex items-center gap-1">
                              <Globe size={13} />
                              {lead.geo}
                            </span>
                          )}
                          {lead.email && (
                            <a
                              href={`mailto:${lead.email}`}
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <AtSign size={13} />
                              {lead.email}
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        {/* LinkedIn */}
                        {lead.linkedin_url && (
                          <a
                            href={lead.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Ver LinkedIn"
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}

                        {/* Promote to CRM */}
                        {lead.status !== 'promoted' && lead.status !== 'ignored' && (
                          <button
                            onClick={() => handlePromote(lead)}
                            disabled={promoting === lead.id}
                            className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Promover a Contacto CRM"
                          >
                            {promoting === lead.id ? (
                              <RefreshCw size={16} className="animate-spin" />
                            ) : (
                              <UserPlus size={16} />
                            )}
                          </button>
                        )}

                        {/* Ignore */}
                        {lead.status !== 'promoted' && lead.status !== 'ignored' && (
                          <button
                            onClick={() => handleIgnore(lead.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Descartar lead"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* DRAFTS TAB */}
        {activeTab === 'drafts' && (
          <>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                Borradores de Email
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({pendingDrafts.length} pendientes de revisión)
                </span>
              </h2>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <RefreshCw className="w-8 h-8 text-gray-300 animate-spin mx-auto mb-3" />
                <p className="text-gray-500">Cargando borradores...</p>
              </div>
            ) : drafts.length === 0 ? (
              <div className="p-12 text-center">
                <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No hay borradores
                </h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  Primero buscá leads y luego usá <strong>"Solo borradores"</strong> en cada vertical para generar emails.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {drafts.map((draft) => {
                  const lead = draft.lead || {};
                  return (
                    <div
                      key={draft.id}
                      className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedDraft(draft)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 mb-1">
                            <h3 className="font-medium text-gray-900 truncate">
                              {draft.subject}
                            </h3>
                            <StatusBadge status={draft.status} type="draft" />
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Users size={13} />
                              {lead.full_name || '[Sin nombre]'}
                            </span>
                            <VerticalBadge vertical={draft.vertical} />
                            <span>
                              {{ en: 'EN', es: 'ES', pt: 'PT' }[draft.language] || ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedDraft(draft); }}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Revisar borrador"
                          >
                            <Eye size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Draft Review Modal */}
      {selectedDraft && (
        <DraftReviewModal
          draft={selectedDraft}
          onClose={() => setSelectedDraft(null)}
          onApprove={handleApproveDraft}
          onReject={handleRejectDraft}
        />
      )}
    </div>
  );
};

export default GrowthSystem;
