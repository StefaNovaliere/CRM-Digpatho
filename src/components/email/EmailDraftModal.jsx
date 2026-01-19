// src/components/email/EmailDraftModal.jsx
import { useState } from 'react';
import {
  X,
  Send,
  Copy,
  Edit3,
  Check,
  ExternalLink,
  Sparkles,
  Mail,
  Loader2,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useGmail } from '../../hooks/useGmail';
import { useEmailGeneration } from '../../hooks/useEmailGeneration';

export const EmailDraftModal = ({ isOpen, onClose, contact, draft, isLoading }) => {
  const { sendEmail, openInGmail, copyToClipboard, sending, hasGmailAccess, userEmail } = useGmail();
  const { updateDraftStatus } = useEmailGeneration();

  const [isEditing, setIsEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [copied, setCopied] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  // Inicializar valores editables
  const subject = isEditing ? editedSubject : (draft?.subject || '');
  const body = isEditing ? editedBody : (draft?.body || '');

  const handleStartEdit = () => {
    setEditedSubject(draft?.subject || '');
    setEditedBody(draft?.body || '');
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (draft?.id) {
      await updateDraftStatus(draft.id, 'edited', editedBody);
    }
    setIsEditing(false);
  };

  const handleCopy = async () => {
    const success = await copyToClipboard({
      subject: isEditing ? editedSubject : draft?.subject,
      body: isEditing ? editedBody : draft?.body
    });
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendEmail = async () => {
    setSendResult(null);

    const result = await sendEmail({
      to: contact.email,
      subject: isEditing ? editedSubject : draft?.subject,
      body: isEditing ? editedBody : draft?.body,
      draftId: draft?.id
    });

    setSendResult(result);

    if (result.success) {
      // Cerrar modal después de 2 segundos si el envío fue exitoso
      setTimeout(() => {
        onClose();
      }, 2000);
    }
  };

  const handleOpenGmail = () => {
    openInGmail({
      to: contact.email,
      subject: isEditing ? editedSubject : draft?.subject,
      body: isEditing ? editedBody : draft?.body
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative flex items-center justify-center min-h-screen p-4">
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-primary-500 to-primary-700">
            <div className="flex items-center gap-3 text-white">
              <Sparkles className="w-5 h-5" />
              <div>
                <h2 className="font-semibold">Email Generado con IA</h2>
                <p className="text-sm text-primary-100">
                  Para: {contact?.first_name} {contact?.last_name}
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
          <div className="p-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-gray-500">Generando email personalizado...</p>
                <p className="text-sm text-gray-400 mt-1">Esto puede tomar unos segundos</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Sender Info */}
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500">Desde:</span>
                  <span className="font-medium text-gray-900">{userEmail}</span>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Asunto
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedSubject}
                      onChange={(e) => setEditedSubject(e.target.value)}
                      className="input"
                    />
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-xl text-gray-900">
                      {subject}
                    </div>
                  )}
                </div>

                {/* Body */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cuerpo del Email
                  </label>
                  {isEditing ? (
                    <textarea
                      value={editedBody}
                      onChange={(e) => setEditedBody(e.target.value)}
                      rows={10}
                      className="input resize-none"
                    />
                  ) : (
                    <div className="p-4 bg-gray-50 rounded-xl text-gray-900 whitespace-pre-wrap max-h-64 overflow-y-auto">
                      {body}
                    </div>
                  )}
                </div>

                {/* AI Notes */}
                {draft?.notes && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-sm font-medium text-amber-800 mb-1">💡 Notas de la IA:</p>
                    <p className="text-sm text-amber-700">{draft.notes}</p>
                  </div>
                )}

                {/* Send Result */}
                {sendResult && (
                  <div className={`p-4 rounded-xl flex items-start gap-3 ${
                    sendResult.success
                      ? 'bg-emerald-50 border border-emerald-200'
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    {sendResult.success ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-emerald-800">¡Email enviado correctamente!</p>
                          <p className="text-sm text-emerald-600 mt-1">
                            El email fue enviado desde {userEmail} y registrado en el historial.
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-red-800">Error al enviar</p>
                          <p className="text-sm text-red-600 mt-1">{sendResult.error}</p>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Config Used */}
                {draft?.config && (
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>Tono: {draft.config.tone}</span>
                    <span>•</span>
                    <span>Idioma: {draft.config.language}</span>
                    <span>•</span>
                    <span>Tipo: {draft.config.emailType}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {!isLoading && !sendResult?.success && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <button
                    onClick={handleSaveEdit}
                    className="btn-secondary text-sm"
                  >
                    <Check className="w-4 h-4" />
                    Guardar Cambios
                  </button>
                ) : (
                  <button
                    onClick={handleStartEdit}
                    className="btn-secondary text-sm"
                  >
                    <Edit3 className="w-4 h-4" />
                    Editar
                  </button>
                )}
                <button
                  onClick={handleCopy}
                  className="btn-ghost text-sm"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Open in Gmail - Fallback */}
                <button
                  onClick={handleOpenGmail}
                  className="btn-secondary text-sm"
                  title="Abrir en Gmail"
                >
                  <ExternalLink className="w-4 h-4" />
                  Abrir en Gmail
                </button>

                {/* Send via API */}
                {hasGmailAccess && contact?.email && (
                  <button
                    onClick={handleSendEmail}
                    disabled={sending || !contact?.email}
                    className="btn-primary text-sm"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Enviar Email
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailDraftModal;