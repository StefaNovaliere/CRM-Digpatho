// src/components/contacts/ContactCard.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Building2,
  MapPin,
  Sparkles,
  ChevronRight,
  Clock,
  MessageSquare,
  CalendarClock,
  Linkedin,
  Star,
  CheckSquare,
  Square
} from 'lucide-react';
import { formatDistanceToNow, format, isPast, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { EmailDraftModal } from '../email/EmailDraftModal';
import { useEmailGeneration } from '../../hooks/useEmailGeneration';
import { StatusBadge } from '../common/StatusBadge';

// Muestra el próximo seguimiento y destaca en rojo si ya venció: es la señal
// que define la cola de trabajo del día.
const FollowupChip = ({ date }) => {
  if (!date) return null;
  const d = new Date(date);
  const vencido = isPast(d) && !isToday(d);

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
        vencido ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
      }`}
      title={vencido ? 'Seguimiento vencido' : 'Próximo seguimiento'}
    >
      <CalendarClock size={11} />
      {format(d, 'd MMM', { locale: es })}
    </span>
  );
};

export const ContactCard = ({
  contact,
  variant = 'default',
  selectable = false,
  selected = false,
  onToggleSelect,
}) => {
  const navigate = useNavigate();
  const [showEmailModal, setShowEmailModal] = useState(false);
  const { generateEmail, isGenerating, generatedDraft, error, clearDraft } = useEmailGeneration();

  const handleToggleSelect = (e) => {
    e.stopPropagation();
    onToggleSelect?.();
  };

  const SelectBox = () =>
    selectable ? (
      <button
        onClick={handleToggleSelect}
        className="text-gray-400 hover:text-primary-600 transition-colors flex-shrink-0"
        title={selected ? 'Deseleccionar' : 'Seleccionar'}
      >
        {selected ? <CheckSquare size={18} className="text-primary-600" /> : <Square size={18} />}
      </button>
    ) : null;

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
          className={`group flex items-center justify-between p-4 bg-white border rounded-lg hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer ${
            selected ? 'border-primary-400 bg-primary-50/30' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center gap-4 min-w-0">
            <SelectBox />

            {/* Avatar */}
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
              {contact.first_name[0]}{contact.last_name[0]}
            </div>

            {/* Info */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-gray-900">
                  {contact.first_name} {contact.last_name}
                </h3>
                <StatusBadge status={contact.stage} variant="stage" size="sm" />
                <StatusBadge status={contact.priority} variant="priority" size="sm" />
                <FollowupChip date={contact.next_followup_at} />
                {contact.is_kol && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-100 text-violet-700">
                    <Star size={11} /> KOL
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 truncate">
                {contact.job_title || contact.specialty || contact.role} • {contact.institution?.name || 'Sin institución'}
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
        className={`group bg-white border rounded-xl hover:border-blue-300 hover:shadow-md transition-all cursor-pointer overflow-hidden ${
          selected ? 'border-primary-400 ring-1 ring-primary-200' : 'border-gray-200'
        }`}
      >
        {/* Header con gradiente sutil */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <SelectBox />

              {/* Avatar */}
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm flex-shrink-0">
                {contact.first_name[0]}{contact.last_name[0]}
              </div>

              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 text-lg leading-tight truncate">
                  {contact.first_name} {contact.last_name}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5 truncate">
                  {contact.job_title || contact.specialty || 'Sin cargo especificado'}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <StatusBadge status={contact.stage} variant="stage" size="sm" />
              <StatusBadge status={contact.priority} variant="priority" size="sm" />
            </div>
          </div>

          {/* Seguimiento y KOL */}
          {(contact.next_followup_at || contact.is_kol || contact.society) && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <FollowupChip date={contact.next_followup_at} />
              {contact.is_kol && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-100 text-violet-700">
                  <Star size={11} /> KOL
                </span>
              )}
              {contact.society && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-50 text-sky-700">
                  {contact.society}
                </span>
              )}
            </div>
          )}
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
