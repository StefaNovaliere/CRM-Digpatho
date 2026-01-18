// src/components/institutions/InstitutionCard.jsx
import { Building2, MapPin, Globe, Users, Edit3, Trash2, ExternalLink } from 'lucide-react';

export const InstitutionCard = ({
  institution,
  contactCount = 0,
  onEdit,
  onDelete,
  onClick
}) => {
  const handleClick = (e) => {
    if (onClick) onClick(institution);
  };

  return (
    <div
      className={`
        bg-white border border-gray-200 rounded-xl p-5
        hover:shadow-md hover:border-gray-300 transition-all
        ${onClick ? 'cursor-pointer' : ''}
      `}
      onClick={handleClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
            <Building2 size={24} className="text-violet-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{institution.name}</h3>
            {institution.type && (
              <span className="text-sm text-gray-500">{institution.type}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        {(onEdit || onDelete) && (
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            {onEdit && (
              <button
                onClick={() => onEdit(institution)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Editar"
              >
                <Edit3 size={16} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(institution)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Eliminar"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="space-y-2 text-sm">
        {(institution.city || institution.country) && (
          <div className="flex items-center gap-2 text-gray-600">
            <MapPin size={14} className="text-gray-400 flex-shrink-0" />
            <span>
              {[institution.city, institution.country].filter(Boolean).join(', ')}
            </span>
          </div>
        )}

        {institution.website && (
          <a
            href={institution.website}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
          >
            <Globe size={14} className="flex-shrink-0" />
            <span className="truncate">Sitio web</span>
            <ExternalLink size={12} className="opacity-50" />
          </a>
        )}

        <div className="flex items-center gap-2 text-gray-600">
          <Users size={14} className="text-gray-400 flex-shrink-0" />
          <span>{contactCount} contacto{contactCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Notes (if any) */}
      {institution.notes && (
        <p className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-500 line-clamp-2">
          {institution.notes}
        </p>
      )}
    </div>
  );
};

// Versión compacta para selects y listas
export const InstitutionCardCompact = ({
  institution,
  selected = false,
  onClick
}) => (
  <div
    onClick={() => onClick?.(institution)}
    className={`
      flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors
      ${selected
        ? 'bg-blue-50 border border-blue-200'
        : 'hover:bg-gray-50 border border-transparent'
      }
    `}
  >
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
      selected ? 'bg-blue-100' : 'bg-gray-100'
    }`}>
      <Building2 size={18} className={selected ? 'text-blue-600' : 'text-gray-500'} />
    </div>
    <div className="flex-1 min-w-0">
      <p className={`font-medium truncate ${selected ? 'text-blue-900' : 'text-gray-900'}`}>
        {institution.name}
      </p>
      {institution.city && (
        <p className="text-sm text-gray-500 truncate">{institution.city}</p>
      )}
    </div>
  </div>
);

export default InstitutionCard;
