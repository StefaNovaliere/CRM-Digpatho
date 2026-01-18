// src/components/institutions/InstitutionSelect.jsx
import { useState, useEffect, useRef } from 'react';
import { Building2, Search, Plus, ChevronDown, Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export const InstitutionSelect = ({
  value,
  onChange,
  placeholder = 'Seleccionar institución...',
  allowCreate = true,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef(null);

  // Cargar instituciones
  useEffect(() => {
    loadInstitutions();
  }, []);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadInstitutions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('institutions')
      .select('id, name, city, type')
      .order('name');
    setInstitutions(data || []);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!search.trim()) return;

    setCreating(true);
    const { data, error } = await supabase
      .from('institutions')
      .insert([{ name: search.trim() }])
      .select()
      .single();

    if (!error && data) {
      setInstitutions([...institutions, data]);
      onChange(data.id);
      setSearch('');
      setIsOpen(false);
    }
    setCreating(false);
  };

  const filteredInstitutions = institutions.filter(inst =>
    inst.name.toLowerCase().includes(search.toLowerCase()) ||
    inst.city?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedInstitution = institutions.find(i => i.id === value);
  const showCreateOption = allowCreate && search.trim() &&
    !filteredInstitutions.some(i => i.name.toLowerCase() === search.toLowerCase());

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between px-4 py-2.5
          bg-white border rounded-lg text-left transition-colors
          ${isOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-300 hover:border-gray-400'}
        `}
      >
        <div className="flex items-center gap-2">
          <Building2 size={18} className="text-gray-400" />
          {selectedInstitution ? (
            <span className="text-gray-900">{selectedInstitution.name}</span>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown size={18} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar o crear..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none"
                autoFocus
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-60 overflow-auto">
            {loading ? (
              <div className="p-4 text-center text-sm text-gray-500">
                Cargando...
              </div>
            ) : filteredInstitutions.length === 0 && !showCreateOption ? (
              <div className="p-4 text-center text-sm text-gray-500">
                No se encontraron instituciones
              </div>
            ) : (
              <>
                {filteredInstitutions.map(inst => (
                  <button
                    key={inst.id}
                    type="button"
                    onClick={() => {
                      onChange(inst.id);
                      setSearch('');
                      setIsOpen(false);
                    }}
                    className={`
                      w-full flex items-center justify-between px-4 py-3 text-left transition-colors
                      ${inst.id === value ? 'bg-blue-50' : 'hover:bg-gray-50'}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        inst.id === value ? 'bg-blue-100' : 'bg-gray-100'
                      }`}>
                        <Building2 size={16} className={inst.id === value ? 'text-blue-600' : 'text-gray-500'} />
                      </div>
                      <div>
                        <p className={`font-medium ${inst.id === value ? 'text-blue-900' : 'text-gray-900'}`}>
                          {inst.name}
                        </p>
                        {inst.city && (
                          <p className="text-xs text-gray-500">{inst.city}</p>
                        )}
                      </div>
                    </div>
                    {inst.id === value && <Check size={18} className="text-blue-600" />}
                  </button>
                ))}

                {/* Create option */}
                {showCreateOption && (
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={creating}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-blue-600 hover:bg-blue-50 border-t border-gray-100"
                  >
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Plus size={16} className="text-blue-600" />
                    </div>
                    <span className="font-medium">
                      {creating ? 'Creando...' : `Crear "${search}"`}
                    </span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InstitutionSelect;

