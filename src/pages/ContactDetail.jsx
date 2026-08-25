// src/pages/ContactDetail.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  MapPin,
  Linkedin,
  Edit3,
  Trash2,
  Sparkles,
  Plus,
  Calendar,
  MessageSquare,
  Video,
  FileText,
  Send,
  Clock,
  ChevronDown,
  Globe,
  MessageCircle,
  Zap,
  RefreshCw,
  Target,
  ChevronUp,
  Star,
  CalendarClock,
  UserCheck
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { StatusBadge } from '../components/common/StatusBadge';
import { useEmailGeneration } from '../hooks/useEmailGeneration';
import { useGmail } from '../hooks/useGmail';
import { EmailDraftModal } from '../components/email/EmailDraftModal';
import { ContactForm } from '../components/contacts/ContactForm';
import { AddInteractionModal } from '../components/interactions/AddInteractionModal';
import { PROJECT_OPTIONS } from '../config/aiPrompts';
import { PageContainer } from '../components/common/PageContainer';

// ========================================
// CONFIGURACIÓN
// ========================================
const TONE_OPTIONS = [
  { value: 'professional', label: 'Profesional', icon: '🎯', description: 'Formal y directo' },
  { value: 'empathetic', label: 'Empático', icon: '💙', description: 'Cercano y comprensivo' },
  { value: 'direct', label: 'Directo', icon: '⚡', description: 'Breve y al punto' },
];

const LANGUAGE_OPTIONS = [
  { value: 'es', label: 'ES', fullLabel: 'Español', flag: '🇪🇸' },
  { value: 'en', label: 'US', fullLabel: 'English', flag: '🇺🇸' },
  { value: 'pt', label: 'BR', fullLabel: 'Português', flag: '🇧🇷' },
];

const EMAIL_TYPE_OPTIONS = [
  { value: 'follow-up', label: 'Follow-up', description: 'Seguimiento de conversación previa' },
  { value: 'first-contact', label: 'Primer contacto', description: 'Presentación inicial' },
  { value: 'post-meeting', label: 'Post-reunión', description: 'Resumen después de una reunión' },
  { value: 'reactivation', label: 'Reactivación', description: 'Retomar contacto inactivo' },
];

// ========================================
// TIMELINE ITEM
// ========================================
const TimelineItem = ({ interaction }) => {
  const iconMap = {
    email_sent: { icon: Send, color: 'bg-blue-100 text-blue-600' },
    email_reply: { icon: Mail, color: 'bg-green-100 text-green-600' },
    email_received: { icon: Mail, color: 'bg-green-100 text-green-600' },
    meeting: { icon: Video, color: 'bg-violet-100 text-violet-600' },
    call: { icon: Phone, color: 'bg-amber-100 text-amber-600' },
    demo: { icon: Sparkles, color: 'bg-pink-100 text-pink-600' },
    note: { icon: FileText, color: 'bg-gray-100 text-gray-600' },
    linkedin: { icon: Linkedin, color: 'bg-sky-100 text-sky-600' },
    conference: { icon: Calendar, color: 'bg-indigo-100 text-indigo-600' }
  };

  const { icon: Icon, color } = iconMap[interaction.type] || iconMap.note;
  const isReply = interaction.type === 'email_reply';
  const displaySubject = isReply ? 'Respuesta Recibida' : (interaction.subject || interaction.type);

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>
          <Icon size={18} />
        </div>
        <div className="w-px h-full bg-gray-200 mt-2"></div>
      </div>
      <div className="flex-1 pb-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium text-gray-900">{displaySubject}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {format(new Date(interaction.occurred_at), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
            </p>
          </div>
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
            interaction.direction === 'outbound' ? 'bg-blue-50 text-blue-700' :
            interaction.direction === 'inbound' ? 'bg-green-50 text-green-700' :
            'bg-gray-50 text-gray-600'
          }`}>
            {interaction.direction === 'outbound' ? 'Saliente' :
             interaction.direction === 'inbound' ? 'Entrante' : 'Interno'}
          </span>
        </div>
        {interaction.content && (
          <div className="mt-3 p-4 bg-gray-50 rounded-xl text-sm text-gray-700 whitespace-pre-wrap">
            {interaction.content}
          </div>
        )}
      </div>
    </div>
  );
};

// ========================================
// MAIN COMPONENT
// ========================================
export const ContactDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { generateEmail, isGenerating, generatedDraft, clearDraft } = useEmailGeneration();
  const { checkContactReplies, syncing } = useGmail();

  const [contact, setContact] = useState(null);
  const [assignedUser, setAssignedUser] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showInteractionModal, setShowInteractionModal] = useState(false);

  // Configuración de Email - AGREGADO: project y customContext
  const [emailConfig, setEmailConfig] = useState({
    tone: 'professional',
    language: 'es',
    emailType: 'follow-up',
    project: 'breast_her2',
    customContext: ''
  });

  // Toggle para mostrar opciones avanzadas
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  useEffect(() => {
    loadContact();
    loadInteractions();

    if (id) {
      checkContactReplies(id).then(() => {
        loadInteractions();
      });
    }
  }, [id]);

  const loadContact = async () => {
    const { data, error } = await supabase
      .from('contacts')
      .select(`*, institution:institutions(*)`)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error loading contact:', error);
      navigate('/contacts');
      return;
    }
    setContact(data);
    setLoading(false);

    // El responsable se busca aparte: assigned_to apunta a auth.users, no hay
    // FK declarada hacia user_profiles, así que Supabase no puede joinearlo.
    if (data?.assigned_to) {
      const { data: u } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .eq('id', data.assigned_to)
        .maybeSingle();
      setAssignedUser(u || null);
    } else {
      setAssignedUser(null);
    }
  };

  const loadInteractions = async () => {
    const { data } = await supabase
      .from('interactions')
      .select('*')
      .eq('contact_id', id)
      .order('occurred_at', { ascending: false });

    setInteractions(data || []);
  };

  const handleGenerateEmail = async () => {
    await generateEmail(id, emailConfig.emailType, {
      tone: emailConfig.tone,
      language: emailConfig.language,
      project: emailConfig.project,
      customContext: emailConfig.customContext
    });
    setShowEmailModal(true);
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Estás seguro de eliminar este contacto?')) return;
    await supabase.from('contacts').delete().eq('id', id);
    navigate('/contacts');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!contact) return null;

  const selectedTone = TONE_OPTIONS.find(t => t.value === emailConfig.tone);
  const selectedLanguage = LANGUAGE_OPTIONS.find(l => l.value === emailConfig.language);
  const selectedEmailType = EMAIL_TYPE_OPTIONS.find(e => e.value === emailConfig.emailType);
  const selectedProject = PROJECT_OPTIONS.find(p => p.value === emailConfig.project);

  return (
    <PageContainer width="medium" gap="none">
      {/* Back Button */}
      <Link
        to="/contacts"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium mb-6 transition-colors"
      >
        <ArrowLeft size={20} />
        Volver a Contactos
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header Card */}
          <div className="card p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                  {contact.first_name[0]}{contact.last_name[0]}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {contact.first_name} {contact.last_name}
                  </h1>
                  <p className="text-gray-500">
                    {contact.job_title || contact.specialty || 'Sin cargo'}
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <StatusBadge status={contact.stage} variant="stage" />
                    <StatusBadge status={contact.priority} variant="priority" />
                    {contact.is_kol && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                        <Star size={12} /> KOL
                      </span>
                    )}
                    {contact.society && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-sky-50 text-sky-700">
                        {contact.society}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowEditModal(true)} className="btn-secondary">
                  <Edit3 size={16} />
                  Editar
                </button>
                <button onClick={handleDelete} className="btn-ghost text-red-600 hover:bg-red-50">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-gray-600 hover:text-primary-600 transition-colors">
                  <Mail size={16} className="text-gray-400" />
                  {contact.email}
                </a>
              )}
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-gray-600 hover:text-primary-600 transition-colors">
                  <Phone size={16} className="text-gray-400" />
                  {contact.phone}
                </a>
              )}
              {contact.institution && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Building2 size={16} className="text-gray-400" />
                  {contact.institution.name}
                </div>
              )}
              {contact.institution?.city && (
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin size={16} className="text-gray-400" />
                  {contact.institution.city}
                </div>
              )}
              {contact.linkedin_url && (
                <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-600 hover:text-primary-600 transition-colors">
                  <Linkedin size={16} className="text-gray-400" />
                  LinkedIn
                </a>
              )}
            </div>

            {/* AI Context */}
            {contact.ai_context && (
              <div className="mt-4 p-4 bg-primary-50 rounded-xl border border-primary-100">
                <p className="text-sm font-medium text-primary-700 mb-1 flex items-center gap-2">
                  <Sparkles size={14} />
                  Contexto para IA
                </p>
                <p className="text-sm text-primary-600">{contact.ai_context}</p>
              </div>
            )}

            {contact.tags && contact.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {contact.tags.map((tag, i) => (
                  <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded-lg">{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="card">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare size={20} className="text-gray-400" />
                <h2 className="font-semibold text-gray-900">Historial de Interacciones</h2>
                {syncing ? (
                  <span className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded-lg">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Sincronizando...
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                    {interactions.length}
                  </span>
                )}
              </div>
              <button onClick={() => setShowInteractionModal(true)} className="btn-secondary text-sm">
                <Plus size={16} />
                Agregar
              </button>
            </div>
            <div className="p-5">
              {interactions.length > 0 ? (
                <div className="space-y-0">
                  {interactions.map(interaction => (
                    <TimelineItem key={interaction.id} interaction={interaction} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock size={32} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">No hay interacciones registradas</p>
                  <button onClick={() => setShowInteractionModal(true)} className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium">
                    Agregar primera interacción
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================
            SIDEBAR - GENERADOR DE EMAIL
            ======================================== */}
        <div className="space-y-6">
          <div className="card overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-primary-500 to-primary-700 text-white">
              <h3 className="font-semibold flex items-center gap-2">
                <Sparkles size={18} />
                Generar Email con IA
              </h3>
              <p className="text-sm text-primary-100 mt-1">
                Personaliza el estilo para este contacto
              </p>
            </div>

            <div className="p-4 space-y-4">
              {/* 🎯 PROYECTO / OBJETIVO - NUEVO */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Target size={14} />
                  Proyecto / Objetivo
                </label>
                <div className="space-y-2">
                  {PROJECT_OPTIONS.filter(p => p.value !== 'custom').map(option => (
                    <button
                      key={option.value}
                      onClick={() => setEmailConfig(prev => ({ ...prev, project: option.value, customContext: '' }))}
                      className={`w-full p-3 text-left rounded-xl border-2 transition-all ${
                        emailConfig.project === option.value
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{option.icon}</span>
                        <div>
                          <p className={`text-sm font-medium ${
                            emailConfig.project === option.value ? 'text-primary-700' : 'text-gray-900'
                          }`}>
                            {option.label}
                          </p>
                          <p className="text-xs text-gray-500">{option.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}

                  {/* Opción Custom */}
                  <button
                    onClick={() => setEmailConfig(prev => ({ ...prev, project: 'custom' }))}
                    className={`w-full p-3 text-left rounded-xl border-2 transition-all ${
                      emailConfig.project === 'custom'
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">✏️</span>
                      <div>
                        <p className={`text-sm font-medium ${
                          emailConfig.project === 'custom' ? 'text-primary-700' : 'text-gray-900'
                        }`}>
                          Personalizado
                        </p>
                        <p className="text-xs text-gray-500">Definir objetivo manualmente</p>
                      </div>
                    </div>
                  </button>

                  {/* Textarea para objetivo personalizado */}
                  {emailConfig.project === 'custom' && (
                    <textarea
                      value={emailConfig.customContext}
                      onChange={(e) => setEmailConfig(prev => ({ ...prev, customContext: e.target.value }))}
                      placeholder="Describe el objetivo del email... Ej: Invitar a participar como speaker en un webinar sobre patología digital"
                      className="w-full p-3 text-sm border border-gray-200 rounded-xl focus:border-primary-500 outline-none resize-none"
                      rows={3}
                    />
                  )}
                </div>
              </div>

              {/* Toggle opciones avanzadas */}
              <button
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="w-full flex items-center justify-between text-sm text-gray-600 hover:text-gray-900 py-2"
              >
                <span>Opciones avanzadas</span>
                {showAdvancedOptions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showAdvancedOptions && (
                <>
                  {/* Tipo de Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo de Email
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {EMAIL_TYPE_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          onClick={() => setEmailConfig(prev => ({ ...prev, emailType: option.value }))}
                          className={`p-2 text-left rounded-xl border-2 transition-all ${
                            emailConfig.emailType === option.value
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <p className={`text-sm font-medium ${
                            emailConfig.emailType === option.value ? 'text-primary-700' : 'text-gray-900'
                          }`}>
                            {option.label}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tono */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <MessageCircle size={14} />
                      Tono
                    </label>
                    <div className="flex gap-2">
                      {TONE_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          onClick={() => setEmailConfig(prev => ({ ...prev, tone: option.value }))}
                          className={`flex-1 p-3 rounded-xl border-2 transition-all text-center ${
                            emailConfig.tone === option.value
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          title={option.description}
                        >
                          <span className="text-lg">{option.icon}</span>
                          <p className={`text-xs font-medium mt-1 ${
                            emailConfig.tone === option.value ? 'text-primary-700' : 'text-gray-600'
                          }`}>
                            {option.label}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Idioma */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Globe size={14} />
                      Idioma
                    </label>
                    <div className="flex gap-2">
                      {LANGUAGE_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          onClick={() => setEmailConfig(prev => ({ ...prev, language: option.value }))}
                          className={`flex-1 p-2 rounded-xl border-2 transition-all text-center ${
                            emailConfig.language === option.value
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <span className="text-lg">{option.flag}</span>
                          <p className={`text-xs font-medium mt-0.5 ${
                            emailConfig.language === option.value ? 'text-primary-700' : 'text-gray-600'
                          }`}>
                            {option.label}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGenerateEmail}
                disabled={isGenerating || (emailConfig.project === 'custom' && !emailConfig.customContext.trim())}
                className="w-full btn bg-gradient-to-r from-primary-500 to-primary-700 text-white hover:from-primary-600 hover:to-primary-800 justify-center py-3 mt-2 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Zap size={18} />
                    Generar Email
                  </>
                )}
              </button>

              {/* Config Summary */}
              <p className="text-xs text-gray-500 text-center">
                {selectedProject?.icon} {selectedProject?.label} • {selectedTone?.icon} {selectedTone?.label} • {selectedLanguage?.flag}
              </p>
            </div>
          </div>

          {/* Pipeline comercial */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Pipeline comercial</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <UserCheck size={14} className="text-gray-400" />
                  Responsable
                </span>
                <span className="font-semibold text-right">
                  {assignedUser?.full_name || assignedUser?.email || 'Sin asignar'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <CalendarClock size={14} className="text-gray-400" />
                  Próximo seguimiento
                </span>
                <span className={`font-semibold text-right ${
                  contact.next_followup_at && new Date(contact.next_followup_at) < new Date()
                    ? 'text-red-600'
                    : ''
                }`}>
                  {contact.next_followup_at
                    ? format(new Date(contact.next_followup_at), "d 'de' MMMM, yyyy", { locale: es })
                    : 'Sin agendar'}
                </span>
              </div>
              {contact.specialty && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-600">Especialidad</span>
                  <span className="font-semibold text-right">{contact.specialty}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Estadísticas</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Total interacciones</span>
                <span className="font-semibold">{contact.interaction_count || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Última interacción</span>
                <span className="font-semibold text-sm">
                  {contact.last_interaction_at
                    ? formatDistanceToNow(new Date(contact.last_interaction_at), { addSuffix: true, locale: es })
                    : 'Nunca'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Fuente</span>
                <span className="font-semibold">{contact.source || '-'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showEditModal && (
        <ContactForm
          contact={contact}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            loadContact();
          }}
        />
      )}

      {showEmailModal && (
        <EmailDraftModal
          isOpen={showEmailModal}
          onClose={() => {
            setShowEmailModal(false);
            clearDraft();
          }}
          contact={contact}
          draft={generatedDraft}
          isLoading={isGenerating}
        />
      )}

      {showInteractionModal && (
        <AddInteractionModal
          contactId={id}
          onClose={() => setShowInteractionModal(false)}
          onSuccess={() => {
            setShowInteractionModal(false);
            loadInteractions();
            loadContact();
          }}
        />
      )}
    </PageContainer>
  );
};

export default ContactDetail;
