// src/pages/Institutions.jsx
import { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Building2,
  MapPin,
  Globe,
  Users,
  Edit3,
  Trash2,
  X
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// Institution Form Modal
const InstitutionForm = ({ institution, onClose, onSuccess }) => {
  const isEditing = !!institution;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    country: 'Argentina',
    city: '',
    address: '',
    website: '',
    notes: ''
  });

  useEffect(() => {
    if (institution) {
      setFormData({
        name: institution.name || '',
        type: institution.type || '',
        country: institution.country || 'Argentina',
        city: institution.city || '',
        address: institution.address || '',
        website: institution.website || '',
        notes: institution.notes || ''
      });
    }
  }, [institution]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEditing) {
        await supabase.from('institutions').update(formData).eq('id', institution.id);
      } else {
        await supabase.from('institutions').insert([formData]);
      }
      onSuccess();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const institutionTypes = [
    'Hospital',
    'Clínica',
    'Laboratorio',
    'Universidad',
    'Instituto de Investigación',
    'Otro'
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Editar Institución' : 'Nueva Institución'}
            </h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                className="input"
                placeholder="Hospital Italiano de Buenos Aires"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(p => ({ ...p, type: e.target.value }))}
                  className="input appearance-none"
                >
                  <option value="">Seleccionar...</option>
                  {institutionTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData(p => ({ ...p, country: e.target.value }))}
                  className="input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData(p => ({ ...p, city: e.target.value }))}
                  className="input"
                  placeholder="Buenos Aires"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData(p => ({ ...p, website: e.target.value }))}
                  className="input"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData(p => ({ ...p, address: e.target.value }))}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                rows={3}
                className="input resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? '...' : isEditing ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Institution Card
const InstitutionCard = ({ institution, contactCount, onEdit, onDelete }) => (
  <div className="card p-5 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between mb-3">
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
      <div className="flex items-center gap-1">
        <button
          onClick={() => onEdit(institution)}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <Edit3 size={16} />
        </button>
        <button
          onClick={() => onDelete(institution)}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>

    <div className="space-y-2 text-sm">
      {institution.city && (
        <div className="flex items-center gap-2 text-gray-600">
          <MapPin size={14} className="text-gray-400" />
          {institution.city}, {institution.country}
        </div>
      )}
      {institution.website && (
        <a
          href={institution.website}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
        >
          <Globe size={14} />
          Sitio web
        </a>
      )}
      <div className="flex items-center gap-2 text-gray-600">
        <Users size={14} className="text-gray-400" />
        {contactCount} contactos
      </div>
    </div>
  </div>
);

export const Institutions = () => {
  const [institutions, setInstitutions] = useState([]);
  const [contactCounts, setContactCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingInstitution, setEditingInstitution] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: insts } = await supabase
      .from('institutions')
      .select('*')
      .order('name');

    const { data: contacts } = await supabase
      .from('contacts')
      .select('institution_id');

    const counts = {};
    contacts?.forEach(c => {
      if (c.institution_id) {
        counts[c.institution_id] = (counts[c.institution_id] || 0) + 1;
      }
    });

    setInstitutions(insts || []);
    setContactCounts(counts);
    setLoading(false);
  };

  const handleDelete = async (inst) => {
    if (!window.confirm(`¿Eliminar "${inst.name}"?`)) return;
    await supabase.from('institutions').delete().eq('id', inst.id);
    loadData();
  };

  const filteredInstitutions = institutions.filter(inst =>
    inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inst.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Instituciones</h1>
          <p className="text-gray-500 mt-1">{institutions.length} instituciones</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus size={20} />
          Nueva Institución
        </button>
      </div>

      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre o ciudad..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input pl-10"
        />
      </div>

      {filteredInstitutions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInstitutions.map(inst => (
            <InstitutionCard
              key={inst.id}
              institution={inst}
              contactCount={contactCounts[inst.id] || 0}
              onEdit={(i) => { setEditingInstitution(i); setShowForm(true); }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No se encontraron instituciones</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery ? 'Prueba con otro término' : 'Comienza agregando tu primera institución'}
          </p>
        </div>
      )}

      {showForm && (
        <InstitutionForm
          institution={editingInstitution}
          onClose={() => { setShowForm(false); setEditingInstitution(null); }}
          onSuccess={() => { setShowForm(false); setEditingInstitution(null); loadData(); }}
        />
      )}
    </div>
  );
};

export default Institutions;