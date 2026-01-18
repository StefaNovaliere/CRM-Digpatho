// src/components/email/EmailDraftModal.jsx
import { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Send,
  Edit3,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  Mail,
  User,
  Building2
} from 'lucide-react';

export const EmailDraftModal = ({
  isOpen,
  onClose,
  contact,
  draft,
  isLoading,
  error,
  onRegenerate,
  onSend
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (draft) {
      setEditedSubject(draft.subject);
      setEditedBody(draft.body);
    }
  }, [draft]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    const textToCopy = `Asunto: ${editedSubject}\n\n${editedBody}`;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendToGmail = () => {
    const subject = encodeURIComponent(editedSubject);
    const body = encodeURIComponent(editedBody);
    const to = encodeURIComponent(contact?.email || '');
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg">
                <Sparkles size={20} className="text-violet-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Email Generado con IA</h2>
                <p className="text-sm text-gray-500">Revisa y edita antes de enviar</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Destinatario Info */}
          {contact && (
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <User size={14} className="text-gray-400" />
                  <span className="font-medium">{contact.first_name} {contact.last_name}</span>
                </div>
                {contact.institution && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Building2 size={14} className="text-gray-400" />
                    <span>{contact.institution.name}</span>
                  </div>
                )}
                {contact.email && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Mail size={14} className="text-gray-400" />
                    <span>{contact.email}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Loading State */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-violet-100 rounded-full"></div>
                  <div className="absolute top-0 left-0 w-16 h-16 border-4 border-violet-600 rounded-full border-t-transparent animate-spin"></div>
                </div>
                <p className="mt-4 text-gray-600 font-medium">Generando email personalizado...</p>
                <p className="text-sm text-gray-400 mt-1">Claude está analizando el contexto del contacto</p>
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 bg-red-50 rounded-full">
                  <AlertCircle size={32} className="text-red-500" />
                </div>
                <p className="mt-4 text-gray-900 font-medium">Error al generar email</p>
                <p className="text-sm text-gray-500 mt-1">{error}</p>
                {onRegenerate && (
                  <button
                    onClick={onRegenerate}
                    className="mt-4 flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
                  >
                    <RefreshCw size={16} />
                    Reintentar
                  </button>
                )}
              </div>
            )}

            {/* Draft Content */}
            {draft && !isLoading && !error && (
              <div className="space-y-4">
                {/* Asunto */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Asunto
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedSubject}
                      onChange={(e) => setEditedSubject(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none text-gray-900 font-medium"
                    />
                  ) : (
                    <p className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900 font-medium">
                      {editedSubject}
                    </p>
                  )}
                </div>

                {/* Cuerpo */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Cuerpo del Email
                  </label>
                  {isEditing ? (
                    <textarea
                      value={editedBody}
                      onChange={(e) => setEditedBody(e.target.value)}
                      rows={12}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none text-gray-700 leading-relaxed resize-none"
                    />
                  ) : (
                    <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {editedBody}
                    </div>
                  )}
                </div>

                {/* Notas de la IA */}
                {draft.notes && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs font-medium text-amber-800 uppercase tracking-wide mb-1">
                      💡 Notas de la IA
                    </p>
                    <p className="text-sm text-amber-700">{draft.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          {draft && !isLoading && !error && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    isEditing
                      ? 'bg-violet-100 text-violet-700'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Edit3 size={16} />
                  {isEditing ? 'Editando...' : 'Editar'}
                </button>

                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm transition-colors"
                >
                  {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>

                {onRegenerate && (
                  <button
                    onClick={onRegenerate}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm transition-colors"
                  >
                    <RefreshCw size={16} />
                    Regenerar
                  </button>
                )}
              </div>

              <button
                onClick={handleSendToGmail}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors shadow-sm"
              >
                <Send size={16} />
                Abrir en Gmail
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailDraftModal;


