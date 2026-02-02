// src/components/interactions/InteractionItem.jsx
import {
  Send, Mail, Phone, Video, FileText, Calendar,
  Linkedin, Sparkles, MoreVertical, Edit3, Trash2,
  ChevronDown, ChevronUp, Reply
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState, useMemo } from 'react';
import { parseEmailContent, isRawEmail } from '../../utils/emailContentParser';

const iconMap = {
  email_sent: { icon: Send, color: 'bg-blue-100 text-blue-600', label: 'Email Enviado' },
  email_received: { icon: Mail, color: 'bg-green-100 text-green-600', label: 'Email Recibido' },
  email_reply: { icon: Reply, color: 'bg-emerald-100 text-emerald-600', label: 'Respuesta Recibida' },
  meeting: { icon: Video, color: 'bg-violet-100 text-violet-600', label: 'Reunión' },
  call: { icon: Phone, color: 'bg-amber-100 text-amber-600', label: 'Llamada' },
  demo: { icon: Sparkles, color: 'bg-pink-100 text-pink-600', label: 'Demo' },
  note: { icon: FileText, color: 'bg-gray-100 text-gray-600', label: 'Nota' },
  linkedin: { icon: Linkedin, color: 'bg-sky-100 text-sky-600', label: 'LinkedIn' },
  conference: { icon: Calendar, color: 'bg-indigo-100 text-indigo-600', label: 'Conferencia' }
};

// Configuración de truncado
const MAX_LINES = 5;
const MAX_CHARS = 400;

export const InteractionItem = ({
  interaction,
  onEdit,
  onDelete,
  showActions = true,
  compact = false
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const { icon: Icon, color, label } = iconMap[interaction.type] || iconMap.note;

  const directionLabel = {
    outbound: 'Saliente',
    inbound: 'Entrante',
    internal: 'Interno'
  };

  const directionColor = {
    outbound: 'bg-blue-50 text-blue-700',
    inbound: 'bg-green-50 text-green-700',
    internal: 'bg-gray-50 text-gray-600'
  };

  // Calcular si el contenido necesita ser truncado
  const { truncatedContent, needsTruncation, cleanContent } = useMemo(() => {
    if (!interaction.content) {
      return { truncatedContent: '', needsTruncation: false, cleanContent: '' };
    }

    // NUEVO: Limpiar el contenido si es un email crudo
    let content = interaction.content;
    if (isRawEmail(content)) {
      content = parseEmailContent(content);
    }

    const lines = content.split('\n');

    // Verificar si excede el límite de líneas o caracteres
    const exceedsLines = lines.length > MAX_LINES;
    const exceedsChars = content.length > MAX_CHARS;

    if (!exceedsLines && !exceedsChars) {
      return {
        truncatedContent: content,
        needsTruncation: false,
        cleanContent: content
      };
    }

    // Truncar por líneas primero
    let truncated = lines.slice(0, MAX_LINES).join('\n');

    // Si aún es muy largo, truncar por caracteres
    if (truncated.length > MAX_CHARS) {
      truncated = truncated.substring(0, MAX_CHARS);
      // Cortar en el último espacio para no cortar palabras
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > MAX_CHARS * 0.8) {
        truncated = truncated.substring(0, lastSpace);
      }
    }

    return {
      truncatedContent: truncated,
      needsTruncation: true,
      cleanContent: content
    };
  }, [interaction.content]);

  if (compact) {
    return (
      <div className="flex items-center gap-3 py-2">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${color}`}>
          <Icon size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {interaction.subject || label}
          </p>
          <p className="text-xs text-gray-500">
            {formatDistanceToNow(new Date(interaction.occurred_at), { addSuffix: true, locale: es })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative">
      <div className="flex gap-4">
        {/* Icon column */}
        <div className="flex flex-col items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>
            <Icon size={18} />
          </div>
          {/* Vertical line */}
          <div className="w-px h-full bg-gray-200 mt-2" />
        </div>

        {/* Content */}
        <div className="flex-1 pb-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-gray-900">
                  {interaction.subject || label}
                </p>
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${directionColor[interaction.direction]}`}>
                  {directionLabel[interaction.direction]}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                {format(new Date(interaction.occurred_at), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
              </p>
            </div>

            {/* Actions */}
            {showActions && (onEdit || onDelete) && (
              <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <MoreVertical size={16} />
                </button>

                {showMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowMenu(false)}
                    />
                    <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                      {onEdit && (
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            onEdit(interaction);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Edit3 size={14} />
                          Editar
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            onDelete(interaction);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                          Eliminar
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Content body - CON CONTENIDO LIMPIO */}
          {interaction.content && (
            <div className="mt-3">
              <div className={`p-4 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap ${
                !isExpanded && needsTruncation ? 'relative' : ''
              }`}>
                {isExpanded ? cleanContent : truncatedContent}

                {/* Gradiente de fade cuando está truncado */}
                {!isExpanded && needsTruncation && (
                  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-gray-50 to-transparent rounded-b-lg pointer-events-none" />
                )}
              </div>

              {/* Botón Ver más / Ver menos */}
              {needsTruncation && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="mt-2 flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp size={16} />
                      Ver menos
                    </>
                  ) : (
                    <>
                      <ChevronDown size={16} />
                      Ver más
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Meeting link */}
          {interaction.meeting_link && (
            <a
              href={interaction.meeting_link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <Video size={14} />
              Ver grabación
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default InteractionItem;