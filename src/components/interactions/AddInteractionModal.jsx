// src/components/interactions/AddInteractionModal.jsx
import { useState } from 'react';
import {
  X,
  Send,
  Mail,
  Phone,
  Video,
  FileText,
  Calendar,
  Linkedin,
  Sparkles
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

export const AddInteractionModal = ({ contactId, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: 'email_sent',
    direction: 'outbound',
    subject: '',
    content: '',
    occurred_at: new Date().toISOString().slice(0, 16)
  });

  const interactionTypes = [
    { value: 'email_sent', label: 'Email Enviado', icon: Send, color: 'bg-blue-100 text-blue-600' },
    { value: 'email_received', label: 'Email Recibido', icon: Mail, color: 'bg-green-100 text-green-600' },
    { value: 'meeting', label: 'Reunión', icon: Video, color: 'bg-violet-100 text-violet-600' },
    { value: 'call', label: 'Llamada', icon: Phone, color: 'bg-amber-100 text-amber-600' },
    { value: 'demo', label: 'Demo', icon: Sparkles, color: 'bg-pink-100 text-pink-600' },
    { value: 'note', label: 'Nota Interna', icon: FileText, color: 'bg-gray-100 text-gray-600' },
    { value: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'bg-sky-100 text-sky-600' },
    { value: 'conference', label: 'Conferencia', icon: Calendar, color: 'bg-indigo-100 text-indigo-600' }
  ];

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('interactions')
        .insert([{
          contact_id: contactId,
          type: formData.type,
          direction: formData.direction,
          subject: formData.subject || null,
          content: formData.content || null,
          occurred_at: new Date(formData.occurred_at).toISOString()
        }]);

      if (error) throw error;
      onSuccess();
    } catch (error) {
      console.error('Error saving interaction:', error);
      alert('Error al guardar la interacción');
    } finally {
      setLoading(false);
    }
  };

  const selectedType = interactionTypes.find(t => t.value === formData.type);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900">
              Nueva Interacción
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Tipo de Interacción */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Interacción
              </label>
              <div className="grid grid-cols-4 gap-2">
                {interactionTypes.map(type => {
                  const Icon = type.icon;
                  const isSelected = formData.type === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => handleChange('type', type.value)}
                      className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${type.color}`}>
                        <Icon size={18} />
                      </div>
                      <span className="text-xs font-medium text-gray-700">{type.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dirección */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dirección
              </label>
              <div className="flex gap-2">
                {[
                  { value: 'outbound', label: 'Saliente (yo inicié)' },
                  { value: 'inbound', label: 'Entrante (me contactaron)' },
                  { value: 'internal', label: 'Interno (nota)' }
                ].map(dir => (
                  <button
                    key={dir.value}
                    type="button"
                    onClick={() => handleChange('direction', dir.value)}
                    className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      formData.direction === dir.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {dir.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha y Hora
              </label>
              <input
                type="datetime-local"
                value={formData.occurred_at}
                onChange={(e) => handleChange('occurred_at', e.target.value)}
                className="input"
              />
            </div>

            {/* Asunto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Asunto / Título
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => handleChange('subject', e.target.value)}
                className="input"
                placeholder={
                  formData.type === 'email_sent' ? 'Asunto del email' :
                  formData.type === 'meeting' ? 'Título de la reunión' :
                  formData.type === 'note' ? 'Título de la nota' :
                  'Descripción breve'
                }
              />
            </div>

            {/* Contenido */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contenido / Notas
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => handleChange('content', e.target.value)}
                rows={4}
                className="input resize-none"
                placeholder={
                  formData.type === 'note' ? 'Escribe tu nota interna...' :
                  formData.type === 'meeting' ? 'Resumen de la reunión, puntos discutidos...' :
                  'Detalles de la interacción...'
                }
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Guardar Interacción'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddInteractionModal;