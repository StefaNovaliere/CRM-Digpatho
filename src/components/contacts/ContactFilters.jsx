// src/components/contacts/ContactFilters.jsx
import { Search, Filter, X, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';

export const ContactFilters = ({
  searchQuery,
  onSearchChange,
  interestFilter,
  onInterestFilterChange,
  roleFilter,
  onRoleFilterChange,
  institutionFilter,
  onInstitutionFilterChange,
  institutions = [],
  totalCount,
  filteredCount
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const interestOptions = [
    { value: 'all', label: 'Todos', emoji: '📋' },
    { value: 'hot', label: 'Calientes', emoji: '🔥' },
    { value: 'warm', label: 'Tibios', emoji: '🌤️' },
    { value: 'cold', label: 'Fríos', emoji: '❄️' },
    { value: 'customer', label: 'Clientes', emoji: '✅' },
    { value: 'churned', label: 'Ex-clientes', emoji: '⚠️' }
  ];

  const roleOptions = [
    { value: 'all', label: 'Todos los roles' },
    { value: 'pathologist', label: 'Patólogos' },
    { value: 'researcher', label: 'Investigadores' },
    { value: 'hospital_director', label: 'Directores' },
    { value: 'lab_manager', label: 'Lab Managers' },
    { value: 'procurement', label: 'Compras' }
  ];

  const hasActiveFilters =
    searchQuery ||
    interestFilter !== 'all' ||
    roleFilter !== 'all' ||
    institutionFilter !== 'all';

  const clearAllFilters = () => {
    onSearchChange('');
    onInterestFilterChange('all');
    onRoleFilterChange?.('all');
    onInstitutionFilterChange?.('all');
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o institución..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:border-blue-500 outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-2 px-4 py-2 border rounded-lg font-medium text-sm transition-colors ${
            showAdvanced || hasActiveFilters
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <SlidersHorizontal size={18} />
          Filtros
          {hasActiveFilters && (
            <span className="w-2 h-2 bg-blue-600 rounded-full" />
          )}
        </button>
      </div>

      {/* Interest Quick Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={16} className="text-gray-400" />
        {interestOptions.map(option => (
          <button
            key={option.value}
            onClick={() => onInterestFilterChange(option.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              interestFilter === option.value
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {option.emoji} {option.label}
          </button>
        ))}
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Role Filter */}
          {onRoleFilterChange && (
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Rol
              </label>
              <select
                value={roleFilter}
                onChange={(e) => onRoleFilterChange(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:border-blue-500 outline-none"
              >
                {roleOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Institution Filter */}
          {onInstitutionFilterChange && institutions.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Institución
              </label>
              <select
                value={institutionFilter}
                onChange={(e) => onInstitutionFilterChange(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:border-blue-500 outline-none"
              >
                <option value="all">Todas las instituciones</option>
                {institutions.map(inst => (
                  <option key={inst.id} value={inst.id}>{inst.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Results count & clear */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className="text-sm text-gray-500">
            Mostrando <strong>{filteredCount}</strong> de {totalCount} contactos
          </span>
          <button
            onClick={clearAllFilters}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
};

export default ContactFilters;
