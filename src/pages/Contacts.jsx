// src/pages/Contacts.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Users,
  Grid3X3,
  List,
  X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ContactCard } from '../components/contacts/ContactCard';
import { ContactForm } from '../components/contacts/ContactForm';

export const Contacts = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterInterest, setFilterInterest] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          *,
          institution:institutions(id, name, city)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter contacts
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch =
      searchQuery === '' ||
      `${contact.first_name} ${contact.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.institution?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      filterInterest === 'all' || contact.interest_level === filterInterest;

    return matchesSearch && matchesFilter;
  });

  const interestFilters = [
    { value: 'all', label: 'Todos', count: contacts.length },
    { value: 'hot', label: '🔥 Calientes', count: contacts.filter(c => c.interest_level === 'hot').length },
    { value: 'warm', label: '🌤️ Tibios', count: contacts.filter(c => c.interest_level === 'warm').length },
    { value: 'cold', label: '❄️ Fríos', count: contacts.filter(c => c.interest_level === 'cold').length },
    { value: 'customer', label: '✅ Clientes', count: contacts.filter(c => c.interest_level === 'customer').length },
  ];

  const handleContactCreated = () => {
    setShowCreateModal(false);
    loadContacts();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contactos</h1>
          <p className="text-gray-500 mt-1">{contacts.length} contactos en total</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          <Plus size={20} />
          Nuevo Contacto
        </button>
      </div>

      {/* Filters Bar */}
      <div className="card p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, email o institución..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Interest Filter */}
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-400" />
            <div className="flex gap-1">
              {interestFilters.map(filter => (
                <button
                  key={filter.value}
                  onClick={() => setFilterInterest(filter.value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    filterInterest === filter.value
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {filter.label}
                  <span className="ml-1 text-xs opacity-60">({filter.count})</span>
                </button>
              ))}
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 border-l border-gray-200 pl-4">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Grid3X3 size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Contacts Grid/List */}
      {filteredContacts.length > 0 ? (
        <div className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'space-y-3'
        }>
          {filteredContacts.map(contact => (
            <ContactCard
              key={contact.id}
              contact={contact}
              variant={viewMode === 'list' ? 'compact' : 'default'}
            />
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Users size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            No se encontraron contactos
          </h3>
          <p className="text-gray-500 mb-4">
            {searchQuery || filterInterest !== 'all'
              ? 'Prueba con otros filtros de búsqueda'
              : 'Comienza agregando tu primer contacto'}
          </p>
          {!searchQuery && filterInterest === 'all' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary"
            >
              <Plus size={20} />
              Agregar Contacto
            </button>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <ContactForm
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleContactCreated}
        />
      )}
    </div>
  );
};

export default Contacts;
