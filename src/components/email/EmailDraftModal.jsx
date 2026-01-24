// src/components/email/EmailDraftModal.jsx
import { useState, useEffect, useRef } from 'react';
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
  CheckCircle,
  Paperclip,
  FileText,
  Image,
  File,
  Trash2,
  Users
} from 'lucide-react';
import { useGmail } from '../../hooks/useGmail';
import { useEmailGeneration } from '../../hooks/useEmailGeneration';

// ========================================
// HELPER: Formatear tamaño de archivo
// ========================================
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ========================================
// HELPER: Icono según tipo de archivo
// ========================================
const FileIcon = ({ type }) => {
  if (type?.startsWith('image/')) return <Image className="w-4 h-4 text-blue-500" />;
  if (type?.includes('pdf')) return <FileText className="w-4 h-4 text-red-500" />;
  return <File className="w-4 h-4 text-gray-500" />;
};

// ========================================
// COMPONENTE PRINCIPAL
// ========================================
export const EmailDraftModal = ({ isOpen, onClose, contact, draft, isLoading }) => {
  const { sendEmail, openInGmail, copyToClipboard, sending, hasGmailAccess, userEmail } = useGmail();
  const { updateDraftStatus } = useEmailGeneration();

  const fileInputRef = useRef(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [copied, setCopied] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  // Nuevos estados para CC y Adjuntos
  const [ccEmails, setCcEmails] = useState('');
  const [showCcField, setShowCcField] = useState(false);
  const [attachments, setAttachments] = useState([]);

  // Sincronizar el estado cuando llega el borrador nuevo (draft)
  useEffect(() => {
    if (draft) {
      setEditedSubject(draft.subject || '');
      setEditedBody(draft.body || '');
    }
  }, [draft]);

  // Reset al cerrar
  useEffect(() => {
    if (!isOpen) {
      setSendResult(null);
      setCcEmails('');
      setShowCcField(false);
      setAttachments([]);
      setIsEditing(false);
    }
  }, [isOpen]);

  const handleStartEdit = () => {
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
      subject: editedSubject,
      body: editedBody
    });
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ========================================
  // MANEJO DE ADJUNTOS
  // ========================================
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);

    // Validar tamaño total (máximo 25MB para Gmail)
    const totalSize = files.reduce((acc, file) => acc + file.size, 0) +
      attachments.reduce((acc, att) => acc + att.size, 0);

    if (totalSize > 25 * 1024 * 1024) {
      alert('El tamaño total de adjuntos no puede superar 25MB');
      return;
    }

    // Convertir a base64 y agregar
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAttachments(prev => [...prev, {
          name: file.name,
          type: file.type,
          size: file.size,
          data: e.target.result.split(',')[1] // Solo la parte base64
        }]);
      };
      reader.readAsDataURL(file);
    });

    // Limpiar input
    e.target.value = '';
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // ========================================
  // ENVIAR EMAIL
  // ========================================
  const handleSendEmail = async () => {
    setSendResult(null);

    // Parsear emails de CC
    const ccList = ccEmails
      .split(/[,;]/)
      .map(email => email.trim())
      .filter(email => email && email.includes('@'));

    const result = await sendEmail({
      to: contact.email,
      cc: ccList.length > 0 ? ccList : undefined,
      subject: editedSubject,
      body: editedBody,
      attachments: attachments.length > 0 ? attachments : undefined,
      draftId: draft?.id
    });

    setSendResult(result);

    if (result.success) {
      setTimeout(() => {
        onClose();
      }, 2000);
    }
  };

  const handleOpenGmail = () => {
    openInGmail({
      to: contact.email,
      cc: ccEmails,
      subject: editedSubject,
      body: editedBody
    });
  };

  if (!isOpen) return null;

  const totalAttachmentSize = attachments.reduce((acc, att) => acc + att.size, 0);

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
          <div className="p-6 max-h-[60vh] overflow-y-auto">
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

                {/* Para */}
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-sm">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500">Para:</span>
                  <span className="font-medium text-gray-900">{contact?.email}</span>

                  {/* Botón para mostrar CC */}
                  {!showCcField && (
                    <button
                      onClick={() => setShowCcField(true)}
                      className="ml-auto text-xs text-primary-600 hover:text-primary-700 font-medium"
                    >
                      + Agregar CC
                    </button>
                  )}
                </div>

                {/* Campo CC */}
                {showCcField && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CC (separar con comas)
                    </label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={ccEmails}
                        onChange={(e) => setCcEmails(e.target.value)}
                        placeholder="email1@ejemplo.com, email2@ejemplo.com"
                        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none text-sm"
                      />
                      <button
                        onClick={() => {
                          setShowCcField(false);
                          setCcEmails('');
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

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
                      {editedSubject}
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
                      {editedBody}
                    </div>
                  )}
                </div>

                {/* Adjuntos */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Paperclip className="w-4 h-4" />
                      Adjuntos
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                    >
                      <Paperclip className="w-4 h-4" />
                      Agregar archivo
                    </button>
                  </div>

                  {attachments.length > 0 ? (
                    <div className="space-y-2">
                      {attachments.map((att, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                        >
                          <div className="flex items-center gap-3">
                            <FileIcon type={att.type} />
                            <div>
                              <p className="text-sm font-medium text-gray-900 truncate max-w-xs">
                                {att.name}
                              </p>
                              <p className="text-xs text-gray-500">{formatFileSize(att.size)}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => removeAttachment(idx)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <p className="text-xs text-gray-500 text-right">
                        Total: {formatFileSize(totalAttachmentSize)} / 25 MB
                      </p>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="p-4 border-2 border-dashed border-gray-200 rounded-xl text-center cursor-pointer hover:border-primary-300 hover:bg-primary-50/50 transition-colors"
                    >
                      <Paperclip className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">
                        Click para agregar archivos
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Máximo 25 MB en total
                      </p>
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
                  <div className={`p-4 rounded-xl flex items-start gap-3 ${sendResult.success
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
                        {attachments.length > 0 && (
                          <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-xs">
                            {attachments.length}
                          </span>
                        )}
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