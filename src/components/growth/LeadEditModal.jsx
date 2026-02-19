// src/components/growth/LeadEditModal.jsx
// Modal para editar datos de un lead descubierto por el Growth System.
// Permite corregir nombre, cargo, empresa, email, geo, linkedin.

import { useState } from 'react';
import {
  X,
  Save,
  User,
  AtSign,
  Briefcase,
  Building2,
  Globe,
  ExternalLink,
} from 'lucide-react';

export const LeadEditModal = ({ lead, onClose, onSave }) => {
  const [form, setForm] = useState({
    full_name: lead.full_name || '',
    email: lead.email || '',
    job_title: lead.job_title || '',
    company: lead.company || '',
    geo: lead.geo || '',
    linkedin_url: lead.linkedin_url || '',
  });
  const [saving, setSaving] = useState(false);

  if (!lead) return null;

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    // Split name into first/last
    const parts = form.full_name.trim().split(/\s+/);
    const first_name = parts[0] || '';
    const last_name = parts.slice(1).join(' ') || '';

    await onSave(lead.id, {
      full_name: form.full_name.trim(),
      first_name,
      last_name,
      email: form.email.trim() || null,
      job_title: form.job_title.trim() || null,
      company: form.company.trim() || null,
      geo: form.geo.trim() || null,
      linkedin_url: form.linkedin_url.trim() || null,
    });
    setSaving(false);
  };

  const fields = [
    { key: 'full_name', label: 'Nombre completo', icon: User, placeholder: 'Ej: Juan Pérez' },
    { key: 'email', label: 'Email', icon: AtSign, placeholder: 'Ej: juan.perez@hospital.com', type: 'email' },
    { key: 'job_title', label: 'Cargo', icon: Briefcase, placeholder: 'Ej: Director de Patología' },
    { key: 'company', label: 'Empresa / Institución', icon: Building2, placeholder: 'Ej: Hospital Italiano' },
    { key: 'geo', label: 'Geografía', icon: Globe, placeholder: 'Ej: Argentina' },
    { key: 'linkedin_url', label: 'LinkedIn URL', icon: ExternalLink, placeholder: 'https://linkedin.com/in/...' },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex items-center justify-center min-h-screen p-4">
        <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-500 to-cyan-500">
            <div className="flex items-center gap-3 text-white">
              <User className="w-5 h-5" />
              <div>
                <h2 className="font-semibold">Editar Lead</h2>
                <p className="text-sm text-white/80">
                  Corregí o completá los datos del lead
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

          {/* Form */}
          <div className="p-6 space-y-4">
            {fields.map(({ key, label, icon: Icon, placeholder, type }) => (
              <div key={key}>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                  <Icon size={14} className="text-gray-400" />
                  {label}
                </label>
                <input
                  type={type || 'text'}
                  value={form[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm"
                />
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.full_name.trim()}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadEditModal;
