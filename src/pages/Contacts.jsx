// src/pages/Contacts.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Users,
  Grid3X3,
  List,
  X,
  Upload,
  Download,
  MessageSquare,
  Mail,
  MailX,
  Clock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ContactCard } from '../components/contacts/ContactCard';
import { ContactForm } from '../components/contacts/ContactForm';
import { ImportContactsModal } from '../components/contacts/ImportContactsModal';

export const Contacts = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [filterInterest, setFilterInterest] = useState('all');
  const [filterResponse, setFilterResponse] = useState('all'); // NUEVO: filtro de respuesta
  const [viewMode, setViewMode] = useState('grid');
  const [showCreateModal, setShowCreateModal] = useState(searchParams.get('new') === 'true');
  const [showImportModal, setShowImportModal] = useState(false);

  // Stats de respuesta
  const [responseStats, setResponseStats] = useState({
    responded: 0,
    noResponse: 0,
    notContacted: 0
  });

  useEffect(() => {
    let mounted = true;

    const loadContacts = async () => {
      try {
        console.log("Cargando contactos con estado de respuesta...");

        // Cargar contactos
        const { data: contactsData, error: contactsError } = await supabase
          .from('contacts')
          .select(`
            *,
            institution:institutions(id, name, city)
          `)
          .order('created_at', { ascending: false });

        if (contactsError) throw contactsError;

        // Cargar interacciones para determinar estado de respuesta
        const { data: interactionsData, error: interactionsError } = await supabase
          .from('interactions')
          .select('contact_id, type, direction')
          .in('type', ['email_sent', 'email_reply']);

        if (interactionsError) throw interactionsError;

        // Procesar estado de respuesta por contacto
        const interactionsByContact = {};
        interactionsData?.forEach(interaction => {
          if (!interactionsByContact[interaction.contact_id]) {
            interactionsByContact[interaction.contact_id] = {
              hasSentEmail: false,
              hasReceivedReply: false
            };
          }

          if (interaction.type === 'email_sent' || interaction.direction === 'outbound') {
            interactionsByContact[interaction.contact_id].hasSentEmail = true;
          }
          if (interaction.type === 'email_reply' || interaction.direction === 'inbound') {
            interactionsByContact[interaction.contact_id].hasReceivedReply = true;
          }
        });

        // Agregar estado de respuesta a cada contacto
        const contactsWithResponseStatus = contactsData?.map(contact => {
          const interactions = interactionsByContact[contact.id];
          let responseStatus = 'not_contacted'; // Sin contactar

          if (interactions) {
            if (interactions.hasReceivedReply) {
              responseStatus = 'responded'; // Respondió
            } else if (interactions.hasSentEmail) {
              responseStatus = 'no_response'; // Sin respuesta
            }
          }

          return {
            ...contact,
            responseStatus
          };
        }) || [];

        // Calcular stats
        const stats = {
          responded: contactsWithResponseStatus.filter(c => c.responseStatus === 'responded').length,
          noResponse: contactsWithResponseStatus.filter(c => c.responseStatus === 'no_response').length,
          notContacted: contactsWithResponseStatus.filter(c => c.responseStatus === 'not_contacted').length
        };

        if (mounted) {
          setContacts(contactsWithResponseStatus);
          setResponseStats(stats);
        }
      } catch (error) {
        console.error('Error loading contacts:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadContacts();

    return () => {
      mounted = false;
    };
  }, []);

  // Abrir modal si viene con ?new=true
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setShowCreateModal(true);
    }
  }, [searchParams]);

  const handleContactCreated = () => {
    setShowCreateModal(false);
    window.location.reload();
  };

  const handleImportSuccess = () => {
    window.location.reload();
  };

  // Filter contacts
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch =
      searchQuery === '' ||
      `${contact.first_name} ${contact.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.institution?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesInterest =
      filterInterest === 'all' || contact.interest_level === filterInterest;

    const matchesResponse =
      filterResponse === 'all' || contact.responseStatus === filterResponse;

    return matchesSearch && matchesInterest && matchesResponse;
  });

  const interestFilters = [
    { value: 'all', label: 'Todos', count: contacts.length },
    { value: 'hot', label: '🔥 Calientes', count: contacts.filter(c => c.interest_level === 'hot').length },
    { value: 'warm', label: '🌤️ Tibios', count: contacts.filter(c => c.interest_level === 'warm').length },
    { value: 'cold', label: '❄️ Fríos', count: contacts.filter(c => c.interest_level === 'cold').length },
    { value: 'customer', label: '✅ Clientes', count: contacts.filter(c => c.interest_level === 'customer').length },
  ];

  const responseFilters = [
    { value: 'all', label: 'Todos', icon: Mail, count: contacts.length },
    { value: 'responded', label: 'Respondieron', icon: MessageSquare, count: responseStats.responded, color: 'text-green-600 bg-green-50' },
    { value: 'no_response', label: 'Sin respuesta', icon: MailX, count: responseStats.noResponse, color: 'text-amber-600 bg-amber-50' },
    { value: 'not_contacted', label: 'Sin contactar', icon: Clock, count: responseStats.notContacted, color: 'text-gray-500 bg-gray-50' },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-gray-500">Cargando contactos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contactos</h1>
          <p className="text-gray-500 mt-1">{contacts.length} contactos en total</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="btn-secondary"
          >
            <Upload size={18} />
            Importar
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            <Plus size={20} />
            Nuevo Contacto
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card p-4 space-y-4">
        {/* Search + View Toggle */}
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

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 border-l border-gray-200 pl-4">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Vista grilla"
            >
              <Grid3X3 size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Vista lista"
            >
              <List size={18} />
            </button>
          </div>
        </div>

        {/* Interest Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter size={18} className="text-gray-400 flex-shrink-0" />
          <div className="flex gap-1">
            {interestFilters.map(filter => (
              <button
                key={filter.value}
                onClick={() => setFilterInterest(filter.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  filterInterest === filter.value
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {filter.label}
                <span className="ml-1 text-xs opacity-60">({filter.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Response Filter - NUEVO */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-2 border-t border-gray-100">
          <MessageSquare size={18} className="text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-500 mr-2">Estado email:</span>
          <div className="flex gap-2">
            {responseFilters.map(filter => {
              const Icon = filter.icon;
              const isActive = filterResponse === filter.value;
              return (
                <button
                  key={filter.value}
                  onClick={() => setFilterResponse(filter.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                    isActive
                      ? filter.color || 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  } ${isActive && filter.value !== 'all' ? filter.color : ''}`}
                >
                  <Icon size={14} />
                  {filter.label}
                  <span className={`text-xs ${isActive ? 'opacity-80' : 'opacity-60'}`}>
                    ({filter.count})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active filters indicator */}
        {(filterInterest !== 'all' || filterResponse !== 'all' || searchQuery) && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              Mostrando <strong>{filteredContacts.length}</strong> de {contacts.length} contactos
            </span>
            <button
              onClick={() => {
                setFilterInterest('all');
                setFilterResponse('all');
                setSearchQuery('');
              }}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Limpiar filtros
            </button>
          </div>
        )}
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
            {searchQuery || filterInterest !== 'all' || filterResponse !== 'all'
              ? 'Prueba con otros filtros de búsqueda'
              : 'Comienza agregando tu primer contacto o importando desde un archivo'}
          </p>
          {!searchQuery && filterInterest === 'all' && filterResponse === 'all' && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowImportModal(true)}
                className="btn-secondary"
              >
                <Upload size={18} />
                Importar Excel
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary"
              >
                <Plus size={20} />
                Agregar Contacto
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <ContactForm
          onClose={() => {
            setShowCreateModal(false);
            navigate('/contacts', { replace: true });
          }}
          onSuccess={handleContactCreated}
        />
      )}

      {/* Import Modal */}
      <ImportContactsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
};

export default Contacts;