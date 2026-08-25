// src/components/contacts/ContactForm.jsx
import { useState, useEffect } from 'react';
import {
  X, User, Mail, Phone, Building2, Briefcase, Linkedin, Tag, Sparkles,
  Globe, MapPin, Hash, Cpu, Target, Save, Loader2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  PIPELINE_STAGES,
  PRIORITY_LEVELS,
  SPECIALTIES,
  SOCIETIES,
} from '../../config/constants';

// ========================================
// OPCIONES DE SELECT
// ========================================
// IMPORTANTE: estos son los únicos valores válidos en la DB.
// Antes había tres opciones más (pharma_executive, medical_affairs, sales_rep)
// que la base rechaza: elegirlas hacía fallar el guardado con un alert crudo.
const ROLE_OPTIONS = [
  { value: 'pathologist', label: 'Patólogo/a' },
  { value: 'researcher', label: 'Investigador/a' },
  { value: 'hospital_director', label: 'Director/a de Hospital' },
  { value: 'lab_manager', label: 'Gerente de Laboratorio' },
  { value: 'procurement', label: 'Compras/Adquisiciones' },
  { value: 'other', label: 'Otro' },
];

const INSTITUTION_TYPE_OPTIONS = [
  { value: 'public', label: 'Público' },
  { value: 'private', label: 'Privado' },
  { value: 'mixed', label: 'Mixto' },
  { value: 'mnc', label: 'Multinacional (MNC)' },
  { value: 'startup', label: 'Startup' },
  { value: 'ngo', label: 'ONG / Sin fines de lucro' },
  { value: 'academic', label: 'Académico / Universidad' },
];

const GEOGRAPHIC_SCOPE_OPTIONS = [
  { value: 'local', label: 'Local' },
  { value: 'regional', label: 'Regional' },
  { value: 'national', label: 'Nacional' },
  { value: 'latam', label: 'Latinoamérica' },
  { value: 'global', label: 'Global' },
];

const COUNTRY_OPTIONS = [
  'Argentina', 'Brasil', 'Chile', 'Colombia', 'México', 'Perú', 'Uruguay',
  'Estados Unidos', 'España', 'Reino Unido', 'Alemania', 'Francia', 'Italia',
  'India', 'Sudáfrica', 'Nigeria', 'Etiopía', 'Kenia',
  'China', 'Japón', 'Australia', 'Otro'
];

// El input date espera 'YYYY-MM-DD'; la columna es timestamptz.
const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

export const ContactForm = ({ contact, onClose, onSuccess }) => {
  const isEditing = !!contact;
  const [loading, setLoading] = useState(false);
  const [institutions, setInstitutions] = useState([]);
  const [teamUsers, setTeamUsers] = useState([]);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    linkedin_url: '',
    website: '',
    institution_id: '',
    institution_name: '', // Para crear nueva
    institution_type: '',
    role: 'other',
    role_detail: '',
    job_title: '',
    country: '',
    geographic_scope: '',
    annual_cases: '',
    uses_ai_pathology: null,
    // Pipeline comercial (migración 009)
    stage: 'new',
    priority: 'media',
    assigned_to: '',
    next_followup_at: '',
    specialty: '',
    society: '',
    is_kol: false,
    source: '',
    tags: [],
    ai_context: ''
  });
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    loadInstitutions();
    loadTeamUsers();
    if (contact) {
      setFormData({
        first_name: contact.first_name || '',
        last_name: contact.last_name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        linkedin_url: contact.linkedin_url || '',
        website: contact.website || '',
        institution_id: contact.institution_id || '',
        institution_name: '',
        institution_type: contact.institution_type || '',
        role: contact.role || 'other',
        role_detail: contact.role_detail || '',
        job_title: contact.job_title || '',
        country: contact.country || '',
        geographic_scope: contact.geographic_scope || '',
        annual_cases: contact.annual_cases || '',
        uses_ai_pathology: contact.uses_ai_pathology,
        stage: contact.stage || 'new',
        priority: contact.priority || 'media',
        assigned_to: contact.assigned_to || '',
        next_followup_at: toDateInput(contact.next_followup_at),
        specialty: contact.specialty || '',
        society: contact.society || '',
        is_kol: !!contact.is_kol,
        source: contact.source || '',
        tags: contact.tags || [],
        ai_context: contact.ai_context || ''
      });
    }
  }, [contact]);

  const loadTeamUsers = async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, full_name, email')
      .order('full_name');
    setTeamUsers(data || []);
  };

  const loadInstitutions = async () => {
    const { data } = await supabase
      .from('institutions')
      .select('id, name')
      .order('name');
    setInstitutions(data || []);
  };

  const handleChange = (field, value) => {
    if (field === 'annual_cases') {
      // Solo números
      value = value.replace(/\D/g, '');
    }
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
      let institutionId = formData.institution_id;

      // Si escribió una institución nueva, crearla
      if (!institutionId && formData.institution_name.trim()) {
        const { data: newInst, error: instError } = await supabase
          .from('institutions')
          .insert({ name: formData.institution_name.trim() })
          .select()
          .single();

        if (instError) throw instError;
        institutionId = newInst.id;
      }

      const dataToSave = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        linkedin_url: formData.linkedin_url.trim() || null,
        website: formData.website.trim() || null,
        institution_id: institutionId || null,
        institution_type: formData.institution_type || null,
        role: formData.role,
        role_detail: formData.role_detail.trim() || null,
        job_title: formData.job_title.trim() || null,
        country: formData.country || null,
        geographic_scope: formData.geographic_scope || null,
        annual_cases: formData.annual_cases ? parseInt(formData.annual_cases) : null,
        uses_ai_pathology: formData.uses_ai_pathology,
        // Pipeline comercial
        stage: formData.stage,
        priority: formData.priority,
        assigned_to: formData.assigned_to || null,
        next_followup_at: formData.next_followup_at
          ? new Date(formData.next_followup_at).toISOString()
          : null,
        specialty: formData.specialty.trim() || null,
        society: formData.society.trim() || null,
        is_kol: formData.is_kol,
        source: formData.source.trim() || null,
        tags: formData.tags.length > 0 ? formData.tags : null,
        ai_context: formData.ai_context.trim() || null
      };

      // Si la etapa cambió, dejamos registro: es la única fuente de la
      // conversión por etapa del cierre mensual.
      const stageChanged = isEditing && contact.stage !== formData.stage;
      if (stageChanged) {
        dataToSave.stage_changed_at = new Date().toISOString();
      } else if (!isEditing) {
        dataToSave.stage_changed_at = new Date().toISOString();
      }

      if (isEditing) {
        const { error } = await supabase
          .from('contacts')
          .update(dataToSave)
          .eq('id', contact.id);
        if (error) throw error;

        if (stageChanged) {
          const { data: { user } } = await supabase.auth.getUser();
          const { error: histErr } = await supabase.from('contact_stage_changes').insert({
            contact_id: contact.id,
            from_stage: contact.stage || null,
            to_stage: formData.stage,
            changed_by: user?.id || null,
          });
          // El historial es complementario: si falla, no revertimos el cambio.
          if (histErr) console.warn('No se pudo registrar el cambio de etapa:', histErr.message);
        }
      } else {
        const { error } = await supabase
          .from('contacts')
          .insert([dataToSave]);
        if (error) throw error;
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving contact:', error);
      alert('Error al guardar el contacto: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-primary-500 to-primary-700">
            <h2 className="text-xl font-semibold text-white">
              {isEditing ? 'Editar Contacto' : 'Nuevo Contacto'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            <div className="space-y-6">

              {/* === INFORMACIÓN BÁSICA === */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Información Básica
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Nombre */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre <span className="text-red-500">*</span>
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

                  {/* Apellido */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Apellido <span className="text-red-500">*</span>
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

                  {/* Email */}
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

                  {/* Teléfono */}
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
              </div>

              {/* === INFORMACIÓN PROFESIONAL === */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Información Profesional
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Institución */}
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
                    {!formData.institution_id && (
                      <input
                        type="text"
                        value={formData.institution_name}
                        onChange={(e) => handleChange('institution_name', e.target.value)}
                        placeholder="O escribí una nueva..."
                        className="input mt-2 text-sm"
                      />
                    )}
                  </div>

                  {/* Tipo de institución */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de Institución
                    </label>
                    <select
                      value={formData.institution_type}
                      onChange={(e) => handleChange('institution_type', e.target.value)}
                      className="input appearance-none"
                    >
                      <option value="">Seleccionar...</option>
                      {INSTITUTION_TYPE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Rol */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rol
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => handleChange('role', e.target.value)}
                      className="input appearance-none"
                    >
                      {ROLE_OPTIONS.map(role => (
                        <option key={role.value} value={role.value}>{role.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Cargo */}
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

                  {/* Detalle del rol */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Detalle del Rol / Responsabilidades
                    </label>
                    <input
                      type="text"
                      value={formData.role_detail}
                      onChange={(e) => handleChange('role_detail', e.target.value)}
                      placeholder="Ej: Aprobación final de acuerdos comerciales..."
                      className="input"
                    />
                  </div>
                </div>
              </div>

              {/* === UBICACIÓN Y ALCANCE === */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Ubicación y Alcance
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* País */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      País
                    </label>
                    <div className="relative">
                      <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <select
                        value={formData.country}
                        onChange={(e) => handleChange('country', e.target.value)}
                        className="input pl-10 appearance-none"
                      >
                        <option value="">Seleccionar...</option>
                        {COUNTRY_OPTIONS.map(country => (
                          <option key={country} value={country}>{country}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Alcance geográfico */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Alcance Geográfico
                    </label>
                    <div className="relative">
                      <Target size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <select
                        value={formData.geographic_scope}
                        onChange={(e) => handleChange('geographic_scope', e.target.value)}
                        className="input pl-10 appearance-none"
                      >
                        <option value="">Seleccionar...</option>
                        {GEOGRAPHIC_SCOPE_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Casos anuales */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Casos Anuales (estimado)
                    </label>
                    <div className="relative">
                      <Hash size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={formData.annual_cases}
                        onChange={(e) => handleChange('annual_cases', e.target.value)}
                        placeholder="5000"
                        className="input pl-10"
                      />
                    </div>
                  </div>

                  {/* Usa IA */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ¿Usa IA en Patología?
                    </label>
                    <div className="relative">
                      <Cpu size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <select
                        value={formData.uses_ai_pathology === null ? '' : formData.uses_ai_pathology.toString()}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleChange('uses_ai_pathology', val === '' ? null : val === 'true');
                        }}
                        className="input pl-10 appearance-none"
                      >
                        <option value="">No sé</option>
                        <option value="true">Sí</option>
                        <option value="false">No</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* === LINKS === */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Links
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* LinkedIn */}
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

                  {/* Website */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Website
                    </label>
                    <div className="relative">
                      <Globe size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="url"
                        value={formData.website}
                        onChange={(e) => handleChange('website', e.target.value)}
                        className="input pl-10"
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* === PIPELINE COMERCIAL === */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Pipeline comercial
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Etapa */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Etapa
                    </label>
                    <select
                      value={formData.stage}
                      onChange={(e) => handleChange('stage', e.target.value)}
                      className="input appearance-none"
                    >
                      {Object.values(PIPELINE_STAGES).map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Prioridad */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prioridad
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => handleChange('priority', e.target.value)}
                      className="input appearance-none"
                    >
                      {Object.values(PRIORITY_LEVELS).map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Responsable */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Responsable
                    </label>
                    <select
                      value={formData.assigned_to || ''}
                      onChange={(e) => handleChange('assigned_to', e.target.value)}
                      className="input appearance-none"
                    >
                      <option value="">Sin asignar</option>
                      {teamUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                      ))}
                    </select>
                  </div>

                  {/* Próximo seguimiento */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Próximo seguimiento
                    </label>
                    <input
                      type="date"
                      value={formData.next_followup_at}
                      onChange={(e) => handleChange('next_followup_at', e.target.value)}
                      className="input"
                    />
                  </div>

                  {/* Especialidad */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Especialidad
                    </label>
                    <input
                      list="specialties-list"
                      type="text"
                      value={formData.specialty}
                      onChange={(e) => handleChange('specialty', e.target.value)}
                      className="input"
                      placeholder="Anatomía Patológica"
                    />
                    <datalist id="specialties-list">
                      {SPECIALTIES.map(s => <option key={s} value={s} />)}
                    </datalist>
                  </div>

                  {/* Sociedad */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sociedad científica
                    </label>
                    <input
                      list="societies-list"
                      type="text"
                      value={formData.society}
                      onChange={(e) => handleChange('society', e.target.value)}
                      className="input"
                      placeholder="SAPYCC"
                    />
                    <datalist id="societies-list">
                      {SOCIETIES.map(s => <option key={s} value={s} />)}
                    </datalist>
                  </div>

                  {/* KOL */}
                  <div className="col-span-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_kol}
                        onChange={(e) => handleChange('is_kol', e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-primary-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Es KOL (líder de opinión)
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* === CLASIFICACIÓN === */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Clasificación
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Fuente */}
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

                  {/* Tags */}
                  <div className="col-span-2">
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
                        placeholder="Escribí y presioná Enter"
                      />
                    </div>
                    {formData.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-700 text-sm rounded-md"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(tag)}
                              className="hover:text-primary-900"
                            >
                              <X size={14} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* === CONTEXTO IA === */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="flex items-center gap-1">
                    <Sparkles size={16} className="text-primary-600" />
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
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {isEditing ? 'Guardar Cambios' : 'Crear Contacto'}
                  </>
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
