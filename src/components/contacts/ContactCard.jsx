// src/components/contacts/ContactCard.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Phone,
  Building2,
  MapPin,
  Sparkles,
  ChevronRight,
  Clock,
  MessageSquare,
  Calendar,
  Linkedin
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { EmailDraftModal } from '../email/EmailDraftModal';
import { useEmailGeneration } from '../../hooks/useEmailGeneration';

// Badge de nivel de interés
const InterestBadge = ({ level }) => {
  const config = {
    cold: { label: 'Frío', bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
    warm: { label: 'Tibio', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
    hot: { label: 'Caliente', bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
    customer: { label: 'Cliente', bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
    churned: { label: 'Ex-cliente', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' }
  };

  const { label, bg, text, dot } = config[level] || config.cold;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`}></span>
      {label}
    </span>
  );
};

// Badge de rol
const RoleBadge = ({ role }) => {
  const labels = {
    pathologist: 'Patólogo',
    researcher: 'Investigador',
    hospital_director: 'Director',
    lab_manager: 'Lab Manager',
    procurement: 'Compras',
    other: 'Otro'
  };

  return (
    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded">
      {labels[role] || role}
    </span>
  );
};

export const ContactCard = ({ contact, variant = 'default' }) => {
  const navigate = useNavigate();
  const [showEmailModal, setShowEmailModal] = useState(false);
  const { generateEmail, isGenerating, generatedDraft, error, clearDraft } = useEmailGeneration();

  const handleGenerateEmail = async (e) => {
    e.stopPropagation();
    await generateEmail(contact.id, 'follow-up');
    setShowEmailModal(true);
  };

  const handleCardClick = () => {
    navigate(`/contacts/${contact.id}`);
  };

  const handleCloseModal = () => {
    setShowEmailModal(false);
    clearDraft();
  };

  // Formato de última interacción
  const lastInteractionText = contact.last_interaction_at
    ? formatDistanceToNow(new Date(contact.last_interaction_at), { addSuffix: true, locale: es })
    : 'Sin interacciones';

  // Variante compacta para listas
  if (variant === 'compact') {
    return (
      <>
        <div
          onClick={handleCardClick}
          className="group flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
        >
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              {contact.first_name[0]}{contact.last_name[0]}
            </div>

            {/* Info */}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">
                  {contact.first_name} {contact.last_name}
                </h3>
                <InterestBadge level={contact.interest_level} />
              </div>
              <p className="text-sm text-gray-500">
                {contact.job_title || contact.role} • {contact.institution?.name || 'Sin institución'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Botón IA */}
            <button
              onClick={handleGenerateEmail}
              disabled={isGenerating}
              className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-700 text-sm font-medium rounded-lg hover:bg-violet-100 transition-all disabled:opacity-50"
            >
              <Sparkles size={14} className={isGenerating ? 'animate-spin' : ''} />
              {isGenerating ? 'Generando...' : 'Email IA'}
            </button>

            <ChevronRight size={18} className="text-gray-400" />
          </div>
        </div>

        {/* Modal de Email */}
        <EmailDraftModal
          isOpen={showEmailModal}
          onClose={handleCloseModal}
          contact={contact}
          draft={generatedDraft}
          isLoading={isGenerating}
          error={error}
        />
      </>
    );
  }

  // Variante default (tarjeta completa)
  return (
    <>
      <div
        onClick={handleCardClick}
        className="group bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all cursor-pointer overflow-hidden"
      >
        {/* Header con gradiente sutil */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm">
                {contact.first_name[0]}{contact.last_name[0]}
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 text-lg leading-tight">
                  {contact.first_name} {contact.last_name}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {contact.job_title || 'Sin cargo especificado'}
                </p>
              </div>
            </div>

            <InterestBadge level={contact.interest_level} />
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {/* Institución */}
          {contact.institution && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Building2 size={15} className="text-gray-400" />
              <span>{contact.institution.name}</span>
              {contact.institution.city && (
                <>
                  <span className="text-gray-300">•</span>
                  <MapPin size={13} className="text-gray-400" />
                  <span className="text-gray-500">{contact.institution.city}</span>
                </>
              )}
            </div>
          )}

          {/* Contacto */}
          <div className="flex items-center gap-4 text-sm">
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 text-gray-600 hover:text-blue-600 transition-colors"
              >
                <Mail size={14} />
                <span className="truncate max-w-[180px]">{contact.email}</span>
              </a>
            )}
            {contact.linkedin_url && (
              <a
                href={contact.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-gray-400 hover:text-blue-600 transition-colors"
              >
                <Linkedin size={15} />
              </a>
            )}
          </div>

          {/* Tags */}
          {contact.tags && contact.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {contact.tags.slice(0, 3).map((tag, i) => (
                <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-md">
                  {tag}
                </span>
              ))}
              {contact.tags.length > 3 && (
                <span className="px-2 py-0.5 text-gray-400 text-xs">
                  +{contact.tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Contexto IA */}
          {contact.ai_context && (
            <p className="text-xs text-gray-500 italic line-clamp-2 bg-gray-50 rounded-lg p-2">
              💡 {contact.ai_context}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {lastInteractionText}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare size={12} />
              {contact.interaction_count || 0} interacciones
            </span>
          </div>

          {/* Botón Generar Email con IA */}
          <button
            onClick={handleGenerateEmail}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <Sparkles size={16} className={isGenerating ? 'animate-pulse' : ''} />
            {isGenerating ? 'Generando...' : 'Generar Follow-up'}
          </button>
        </div>
      </div>

      {/* Modal de Email Draft */}
      <EmailDraftModal
        isOpen={showEmailModal}
        onClose={handleCloseModal}
        contact={contact}
        draft={generatedDraft}
        isLoading={isGenerating}
        error={error}
      />
    </>
  );
};

export default ContactCard;
