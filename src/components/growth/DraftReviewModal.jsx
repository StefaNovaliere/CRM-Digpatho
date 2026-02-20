// src/components/growth/DraftReviewModal.jsx
// Modal para revisar, aprobar o rechazar borradores de email
// generados por el Growth System (ai_growth_system.py).
// Al aprobar, permite agregar el contacto a una campaña de envío masivo.

import { useState, useEffect } from 'react';
import {
  X,
  Check,
  XCircle,
  ExternalLink,
  Copy,
  Mail,
  Building2,
  Briefcase,
  Globe,
  MessageSquare,
  AtSign,
  Send,
  Plus,
  ChevronDown,
  RefreshCw,
  AlertCircle,
  FileText,
  Pencil,
  Save
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { GROWTH_VERTICALS } from '../../config/constants';

const verticalColors = {
  DIRECT_B2B: 'from-blue-500 to-cyan-500',
  PHARMA: 'from-violet-500 to-purple-500',
  INFLUENCER: 'from-amber-500 to-orange-500',
  EVENTS: 'from-emerald-500 to-teal-500',
};

export const DraftReviewModal = ({ draft, onClose, onApprove, onReject, onViewLead, onSaveDraft }) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState(draft?.reviewer_notes || '');
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editSubject, setEditSubject] = useState(draft?.subject || '');
  const [editBody, setEditBody] = useState(draft?.body || '');
  const [saving, setSaving] = useState(false);

  // Campaign integration state
  const [showCampaignStep, setShowCampaignStep] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [newCampaignName, setNewCampaignName] = useState('');
  const [addToCampaign, setAddToCampaign] = useState(true);
  const [approving, setApproving] = useState(false);
  const [campaignError, setCampaignError] = useState(null);

  if (!draft) return null;

  const lead = draft.lead || {};
  const verticalConfig = GROWTH_VERTICALS[draft.vertical] || {};
  const gradientClass = verticalColors[draft.vertical] || 'from-gray-500 to-gray-600';
  const description = lead.extra_data?.description || '';

  // Load available campaigns when campaign step is shown
  useEffect(() => {
    if (showCampaignStep) {
      loadCampaigns();
    }
  }, [showCampaignStep]);

  const loadCampaigns = async () => {
    setLoadingCampaigns(true);
    const { data, error } = await supabase
      .from('bulk_email_campaigns')
      .select('id, name, status, total_emails, sent_count')
      .in('status', ['draft', 'ready', 'paused'])
      .order('created_at', { ascending: false });

    if (!error) {
      setCampaigns(data || []);
    }
    setLoadingCampaigns(false);
  };

  const handleStartApprove = () => {
    if (!lead.email) {
      setCampaignError('El lead no tiene email. Editá el lead primero para agregar un email.');
      return;
    }
    setShowCampaignStep(true);
  };

  const handleConfirmApprove = async () => {
    setApproving(true);
    setCampaignError(null);

    try {
      if (addToCampaign) {
        let campaignId = selectedCampaignId;

        // Create new campaign if needed
        if (selectedCampaignId === 'new') {
          const name = newCampaignName.trim();
          if (!name) {
            setCampaignError('Ingresá un nombre para la nueva campaña');
            setApproving(false);
            return;
          }

          const { data: newCampaign, error: campErr } = await supabase
            .from('bulk_email_campaigns')
            .insert({
              name,
              status: 'ready',
              total_emails: 0,
              created_by: user?.id || null,
            })
            .select()
            .single();

          if (campErr) throw campErr;
          campaignId = newCampaign.id;
        }

        if (!campaignId) {
          setCampaignError('Seleccioná una campaña o creá una nueva');
          setApproving(false);
          return;
        }

        // Promote lead to contacts if not already promoted
        let contactId = null;
        if (lead.status !== 'promoted') {
          const contactData = {
            first_name: lead.first_name || lead.full_name?.split(' ')[0] || '',
            last_name: lead.last_name || lead.full_name?.split(' ').slice(1).join(' ') || '',
            email: lead.email || '',
            job_title: lead.job_title || '',
            interest_level: 'cold',
            role: 'other',
            source: `growth_system_${lead.vertical}`,
            ai_context: [
              `Vertical: ${lead.vertical}`,
              lead.company ? `Empresa: ${lead.company}` : null,
              lead.email ? `Email: ${lead.email}` : null,
              lead.geo ? `Geo: ${lead.geo}` : null,
              `LinkedIn: ${lead.linkedin_url}`,
              lead.extra_data?.description ? `Descripción: ${lead.extra_data.description}` : null,
              `Descubierto por Growth System el ${new Date(lead.created_at).toLocaleDateString()}`
            ].filter(Boolean).join('\n'),
          };

          const { data: contact, error: contactErr } = await supabase
            .from('contacts')
            .insert(contactData)
            .select()
            .single();

          if (contactErr) throw contactErr;
          contactId = contact.id;

          // Mark lead as promoted
          await supabase
            .from('growth_leads')
            .update({ status: 'promoted', updated_at: new Date().toISOString() })
            .eq('id', lead.id);
        } else {
          // Lead already promoted — find existing contact by email
          const { data: existing } = await supabase
            .from('contacts')
            .select('id')
            .eq('email', lead.email)
            .limit(1)
            .single();
          contactId = existing?.id || null;
        }

        // Add email to campaign queue
        const { error: queueErr } = await supabase
          .from('bulk_email_queue')
          .insert({
            campaign_id: campaignId,
            contact_id: contactId,
            to_email: lead.email,
            to_name: lead.full_name || '',
            subject: draft.subject,
            body: draft.body,
            status: 'pending',
          });

        if (queueErr) throw queueErr;

        // Update campaign total_emails count
        const { count } = await supabase
          .from('bulk_email_queue')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaignId);

        await supabase
          .from('bulk_email_campaigns')
          .update({ total_emails: count || 1 })
          .eq('id', campaignId);
      }

      // Approve the draft
      await onApprove(draft.id, notes);
    } catch (err) {
      console.error('Error approving with campaign:', err);
      setCampaignError(err.message);
      setApproving(false);
    }
  };

  const handleReject = () => {
    onReject(draft.id, notes);
  };

  const handleCopy = () => {
    const subject = isEditing ? editSubject : draft.subject;
    const body = isEditing ? editBody : draft.body;
    navigator.clipboard.writeText(
      `Asunto: ${subject}\n\n${body}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveDraft = async () => {
    if (!onSaveDraft) return;
    setSaving(true);
    const ok = await onSaveDraft(draft.id, { subject: editSubject, body: editBody });
    setSaving(false);
    if (ok) {
      draft.subject = editSubject;
      draft.body = editBody;
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditSubject(draft.subject);
    setEditBody(draft.body);
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative flex items-center justify-center min-h-screen p-4">
        <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">

          {/* Header */}
          <div className={`flex items-center justify-between px-6 py-4 bg-gradient-to-r ${gradientClass}`}>
            <div className="flex items-center gap-3 text-white">
              <Mail className="w-5 h-5" />
              <div>
                <h2 className="font-semibold">
                  {showCampaignStep ? 'Agregar a Campaña' : `Revisar Borrador — ${verticalConfig.label}`}
                </h2>
                <p className="text-sm text-white/80">
                  Para: {lead.full_name || '[Sin nombre]'}
                  {lead.company ? ` — ${lead.company}` : ''}
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
          <div className="p-6 max-h-[65vh] overflow-y-auto space-y-5">

            {!showCampaignStep ? (
              <>
                {/* Lead Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-sm">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500">Empresa:</span>
                    <span className="font-medium text-gray-900">{lead.company || '[EMPRESA]'}</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-sm">
                    <Briefcase className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500">Cargo:</span>
                    <span className="font-medium text-gray-900">{lead.job_title || '[CARGO]'}</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-sm">
                    <Globe className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500">Geo:</span>
                    <span className="font-medium text-gray-900">{lead.geo || 'Global'}</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-sm">
                    <MessageSquare className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500">Idioma:</span>
                    <span className="font-medium text-gray-900">
                      {{ en: 'English', es: 'Español', pt: 'Português' }[draft.language] || draft.language}
                    </span>
                  </div>
                </div>

                {/* Email */}
                {lead.email && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl text-sm">
                    <AtSign className="w-4 h-4 text-blue-500" />
                    <span className="text-gray-500">Email:</span>
                    <a
                      href={`mailto:${lead.email}`}
                      className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      {lead.email}
                    </a>
                  </div>
                )}

                {/* Description */}
                {description && (
                  <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl text-sm">
                    <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-gray-500">Descripción:</span>
                      <p className="text-gray-700 mt-0.5 leading-relaxed">{description}</p>
                    </div>
                  </div>
                )}

                {/* LinkedIn + View Lead */}
                <div className="flex items-center gap-4">
                  {lead.linkedin_url && (
                    <a
                      href={lead.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Ver perfil en LinkedIn
                    </a>
                  )}
                  {onViewLead && lead.id && (
                    <button
                      onClick={() => onViewLead(lead)}
                      className="inline-flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700 hover:underline"
                    >
                      <Briefcase className="w-4 h-4" />
                      Editar lead
                    </button>
                  )}
                </div>

                {/* Edit toggle */}
                <div className="flex items-center justify-end">
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors"
                    >
                      <Pencil size={13} />
                      Editar borrador
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCancelEdit}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <X size={13} />
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveDraft}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                        Guardar cambios
                      </button>
                    </div>
                  )}
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-violet-300 rounded-xl focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm font-medium"
                    />
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-xl text-gray-900 font-medium">
                      {draft.subject}
                    </div>
                  )}
                </div>

                {/* Body */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cuerpo del email</label>
                  {isEditing ? (
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={12}
                      className="w-full px-4 py-3 bg-white border border-violet-300 rounded-xl focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm leading-relaxed resize-y"
                    />
                  ) : (
                    <div className="p-4 bg-gray-50 rounded-xl text-gray-900 whitespace-pre-wrap max-h-72 overflow-y-auto text-sm leading-relaxed">
                      {draft.body}
                    </div>
                  )}
                </div>

                {/* Generation context */}
                {draft.generation_context?.tone && (
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>Tono: {draft.generation_context.tone.slice(0, 50)}</span>
                    {draft.generation_context.cta && (
                      <>
                        <span>|</span>
                        <span>CTA: {draft.generation_context.cta}</span>
                      </>
                    )}
                  </div>
                )}

                {/* Reviewer Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas del revisor (opcional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Ej: Ajustar el subject, verificar nombre del contacto..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm resize-none"
                  />
                </div>

                {/* Error (e.g. missing email) */}
                {campaignError && !showCampaignStep && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {campaignError}
                  </div>
                )}
              </>
            ) : (
              /* Campaign Selection Step */
              <>
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <p className="text-sm text-emerald-800">
                    <strong>Borrador aprobado.</strong> Ahora elegí a qué campaña de envío masivo agregar este email.
                    El contacto será promovido al CRM automáticamente.
                  </p>
                </div>

                {/* Email summary */}
                <div className="p-3 bg-gray-50 rounded-xl text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <AtSign size={14} className="text-gray-400" />
                    <span className="text-gray-500">Para:</span>
                    <span className="font-medium">{lead.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-gray-400" />
                    <span className="text-gray-500">Asunto:</span>
                    <span className="font-medium">{draft.subject}</span>
                  </div>
                </div>

                {/* Toggle: add to campaign */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addToCampaign}
                    onChange={(e) => setAddToCampaign(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Agregar a una campaña de envío masivo
                  </span>
                </label>

                {addToCampaign && (
                  <div className="space-y-3 pl-7">
                    {loadingCampaigns ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <RefreshCw size={14} className="animate-spin" />
                        Cargando campañas...
                      </div>
                    ) : (
                      <>
                        {/* Campaign selector */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Seleccionar campaña
                          </label>
                          <select
                            value={selectedCampaignId}
                            onChange={(e) => setSelectedCampaignId(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm"
                          >
                            <option value="">— Elegir campaña —</option>
                            {campaigns.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.total_emails} emails, {c.sent_count} enviados)
                              </option>
                            ))}
                            <option value="new">+ Crear nueva campaña</option>
                          </select>
                        </div>

                        {/* New campaign name */}
                        {selectedCampaignId === 'new' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Nombre de la nueva campaña
                            </label>
                            <input
                              type="text"
                              value={newCampaignName}
                              onChange={(e) => setNewCampaignName(e.target.value)}
                              placeholder="Ej: Growth B2B Febrero 2026"
                              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Error */}
                {campaignError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {campaignError}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            {!showCampaignStep ? (
              <>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleReject}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Rechazar
                  </button>
                  <button
                    onClick={handleStartApprove}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-lg transition-colors shadow-sm"
                  >
                    <Check className="w-4 h-4" />
                    Aprobar borrador
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setShowCampaignStep(false); setCampaignError(null); }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Volver
                </button>

                <button
                  onClick={handleConfirmApprove}
                  disabled={approving || (addToCampaign && !selectedCampaignId)}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {approving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      {addToCampaign ? 'Aprobar y agregar a campaña' : 'Aprobar sin campaña'}
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DraftReviewModal;
