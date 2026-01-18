// src/components/email/EmailPreview.jsx
import { Mail, User, Building2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const EmailPreview = ({
  subject,
  body,
  to,
  from,
  date,
  className = ''
}) => {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl overflow-hidden ${className}`}>
      {/* Email Header */}
      <div className="bg-gray-50 border-b border-gray-200 p-4 space-y-2">
        {/* Subject */}
        <div className="flex items-center gap-2">
          <Mail size={16} className="text-gray-400" />
          <span className="font-semibold text-gray-900">{subject}</span>
        </div>

        {/* To */}
        {to && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 w-12">Para:</span>
            <div className="flex items-center gap-1.5 text-gray-700">
              <User size={14} className="text-gray-400" />
              {to.name && <span className="font-medium">{to.name}</span>}
              {to.email && <span className="text-gray-500">&lt;{to.email}&gt;</span>}
              {to.institution && (
                <>
                  <span className="text-gray-300">•</span>
                  <Building2 size={14} className="text-gray-400" />
                  <span className="text-gray-500">{to.institution}</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* From */}
        {from && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 w-12">De:</span>
            <span className="text-gray-700">{from}</span>
          </div>
        )}

        {/* Date */}
        {date && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 w-12">Fecha:</span>
            <div className="flex items-center gap-1.5 text-gray-600">
              <Clock size={14} className="text-gray-400" />
              {format(new Date(date), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
            </div>
          </div>
        )}
      </div>

      {/* Email Body */}
      <div className="p-6">
        <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
          {body}
        </div>
      </div>
    </div>
  );
};

// Versión compacta para listas
export const EmailPreviewCompact = ({
  subject,
  body,
  date,
  status,
  onClick
}) => {
  const statusColors = {
    generated: 'bg-violet-100 text-violet-700',
    edited: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    sent: 'bg-blue-100 text-blue-700',
    discarded: 'bg-gray-100 text-gray-500'
  };

  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 truncate">{subject}</h4>
          <p className="text-sm text-gray-500 line-clamp-2 mt-1">{body}</p>
        </div>
        {status && (
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${statusColors[status]}`}>
            {status === 'generated' && 'Generado'}
            {status === 'edited' && 'Editado'}
            {status === 'approved' && 'Aprobado'}
            {status === 'sent' && 'Enviado'}
            {status === 'discarded' && 'Descartado'}
          </span>
        )}
      </div>
      {date && (
        <p className="text-xs text-gray-400 mt-2">
          {format(new Date(date), "d MMM yyyy, HH:mm", { locale: es })}
        </p>
      )}
    </div>
  );
};

export default EmailPreview;

