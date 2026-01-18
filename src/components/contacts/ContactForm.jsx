// src/components/contacts/ContactForm.jsx
import { useState, useEffect } from 'react';
import { X, User, Mail, Phone, Building2, Briefcase, Linkedin, Tag, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export const ContactForm = ({ contact, onClose, onSuccess }) => {
  const isEditing = !!contact;
  const [loading, setLoading] = useState(false);
  const [institutions, setInstitutions] = useState([]);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    linkedin_url: '',
    institution_id: '',
    role: 'other',
    job_title: '',
    interest_level: 'cold',
    source: '',
    tags: [],
    ai_context: ''
  });
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    loadInstitutions();
    if (contact) {
      setFormData({
        first_name: contact.first_name || '',
        last_name: contact.last_name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        linkedin_url: contact.linkedin_url || '',
        institution_id: contact.institution_id || '',
        role: contact.role || 'other',
        job_title: contact.job_title || '',
        interest_level: contact.interest_level || 'cold',
        source: contact.source || '',
        tags: contact.tags || [],
        ai_context: contact.ai_context || ''
      });
    }
  }, [contact]);

  const loadInstitutions = async () => {
    const { data } = await supabase
      .from('institutions')
      .select('id, name')
      .order('name');
    setInstitutions(data || []);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!formData.tags.includes(tagInput.trim())) {
        setFormData(prev => ({
          ...prev,
          tags: [...prev.tags, tagInput.trim()]
        }));
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dataToSave = {
        ...formData,
        institution_id: formData.institution_id || null
      };

      if (isEditing) {
        const { error } = await supabase
          .from('contacts')
          .update(dataToSave)
          .eq('id', contact.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('contacts')
          .insert([dataToSave]);
        if (error) throw error;
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving contact:', error);
      alert('Error al guardar el contacto');
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { value: 'pathologist', label: 'Patólogo' },
    { value: 'researcher', label: 'Investigador' },
    { value: 'hospital_director', label: 'Director de Hospital' },
    { value: 'lab_manager', label: 'Gerente de Laboratorio' },
    { value: 'procurement', label: 'Compras' },
    { value: 'other', label: 'Otro' }
  ];

  const interestLevels = [
    { value: 'cold', label: '❄️ Frío' },
    { value: 'warm', label: '🌤️ Tibio' },
    { value: 'hot', label: '🔥 Caliente' },
    { value: 'customer', label: '✅ Cliente' },
    { value: 'churned', label: '⚠️ Ex-cliente' }
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Editar Contacto' : 'Nuevo Contacto'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            <div className="space-y-6">
              {/* Nombre */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
                  </label>
                  <div className="relative">
                    <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={formData.first_name}
                      onChange={(e) => handleChange('first_name', e.target.value)}
                      className="input pl-10"
                      placeholder="Juan"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apellido *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => handleChange('last_name', e.target.value)}
                    className="input"
                    placeholder="Pérez"
                  />
                </div>
              </div>

              {/* Contacto */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className="input pl-10"
                      placeholder="juan@hospital.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono
                  </label>
                  <div className="relative">
                    <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      className="input pl-10"
                      placeholder="+54 11 1234-5678"
                    />
                  </div>
                </div>
              </div>

              {/* Institución y Rol */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Institución
                  </label>
                  <div className="relative">
                    <Building2 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <select
                      value={formData.institution_id}
                      onChange={(e) => handleChange('institution_id', e.target.value)}
                      className="input pl-10 appearance-none"
                    >
                      <option value="">Seleccionar...</option>
                      {institutions.map(inst => (
                        <option key={inst.id} value={inst.id}>{inst.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rol
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => handleChange('role', e.target.value)}
                    className="input appearance-none"
                  >
                    {roles.map(role => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cargo y LinkedIn */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cargo
                  </label>
                  <div className="relative">
                    <Briefcase size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={formData.job_title}
                      onChange={(e) => handleChange('job_title', e.target.value)}
                      className="input pl-10"
                      placeholder="Jefe de Anatomía Patológica"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    LinkedIn
                  </label>
                  <div className="relative">
                    <Linkedin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="url"
                      value={formData.linkedin_url}
                      onChange={(e) => handleChange('linkedin_url', e.target.value)}
                      className="input pl-10"
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>
                </div>
              </div>

              {/* Nivel de Interés y Fuente */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nivel de Interés
                  </label>
                  <select
                    value={formData.interest_level}
                    onChange={(e) => handleChange('interest_level', e.target.value)}
                    className="input appearance-none"
                  >
                    {interestLevels.map(level => (
                      <option key={level.value} value={level.value}>{level.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fuente
                  </label>
                  <input
                    type="text"
                    value={formData.source}
                    onChange={(e) => handleChange('source', e.target.value)}
                    className="input"
                    placeholder="Conferencia SLAP 2024"
                  />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags
                </label>
                <div className="relative">
                  <Tag size={18} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleAddTag}
                    className="input pl-10"
                    placeholder="Escribe y presiona Enter"
                  />
                </div>
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-sm rounded-md"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-blue-900"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Context */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="flex items-center gap-1">
                    <Sparkles size={16} className="text-violet-600" />
                    Contexto para IA
                  </span>
                </label>
                <textarea
                  value={formData.ai_context}
                  onChange={(e) => handleChange('ai_context', e.target.value)}
                  rows={3}
                  className="input resize-none"
                  placeholder="Información relevante para personalizar los emails generados por IA. Ej: 'Muy interesado en IA para diagnóstico de melanoma. Conocimos en conferencia de dermatopatología.'"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Este contexto se usará para personalizar los emails generados automáticamente.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-gray-100">
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
                ) : isEditing ? (
                  'Guardar Cambios'
                ) : (
                  'Crear Contacto'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ContactForm;
