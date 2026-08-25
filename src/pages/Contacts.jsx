// src/pages/Contacts.jsx
import { useEffect, useState, useCallback, useRef } from 'react';
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
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ContactCard } from '../components/contacts/ContactCard';
import { ContactForm } from '../components/contacts/ContactForm';
import { ImportContactsModal } from '../components/contacts/ImportContactsModal';
import { BulkActionsBar } from '../components/contacts/BulkActionsBar';
import { PageContainer } from '../components/common/PageContainer';
import { PIPELINE_STAGES, PRIORITY_LEVELS } from '../config/constants';

const PAGE_SIZE = 50;

// Filtros de seguimiento. El manual trabaja sobre "vencidos", así que esa es
// la cola que importa; las otras son para revisar la agenda.
const FOLLOWUP_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'overdue', label: 'Vencidos' },
  { value: 'week', label: 'Esta semana' },
  { value: 'none', label: 'Sin fecha' },
];

const CARTERA_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'mine', label: 'Mis contactos' },
  { value: 'team', label: 'Mi equipo' },
  { value: 'unassigned', label: 'Sin asignar' },
];

export const Contacts = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuth();

  const [contacts, setContacts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const [filterStage, setFilterStage] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterCartera, setFilterCartera] = useState('all');
  const [filterFollowup, setFilterFollowup] = useState('all');

  const [viewMode, setViewMode] = useState('grid');
  const [showCreateModal, setShowCreateModal] = useState(searchParams.get('new') === 'true');
  const [showImportModal, setShowImportModal] = useState(false);

  // Conteos por etapa/prioridad. Se traen aparte con una query mínima
  // (2 columnas) para que las píldoras muestren números reales sin tener que
  // cargar todos los contactos completos como se hacía antes.
  const [counts, setCounts] = useState({ stage: {}, priority: {}, total: 0 });

  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const reloadRef = useRef(0);

  // Debounce de la búsqueda: sin esto se dispara una query por tecla.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Volver a la primera página cuando cambia cualquier filtro.
  useEffect(() => {
    setPage(0);
  }, [debouncedQuery, filterStage, filterPriority, filterCartera, filterFollowup]);

  // Usuarios del equipo: para "Mi equipo" y para el selector de asignación.
  useEffect(() => {
    supabase
      .from('user_profiles')
      .select('id, full_name, email, team, crm_role')
      .then(({ data }) => setUsers(data || []));
  }, []);

  // Conteos por píldora
  useEffect(() => {
    supabase
      .from('contacts')
      .select('stage, priority')
      .then(({ data }) => {
        if (!data) return;
        const stage = {};
        const priority = {};
        data.forEach(c => {
          stage[c.stage] = (stage[c.stage] || 0) + 1;
          priority[c.priority] = (priority[c.priority] || 0) + 1;
        });
        setCounts({ stage, priority, total: data.length });
      });
  }, [reloadRef.current]);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('contacts')
        .select('*, institution:institutions(id, name, city)', { count: 'exact' });

      if (filterStage !== 'all') query = query.eq('stage', filterStage);
      if (filterPriority !== 'all') query = query.eq('priority', filterPriority);

      // Cartera. "Mi equipo" se deriva de los usuarios que comparten mi team;
      // no hay columna de equipo en contacts justamente para que un cambio de
      // equipo no obligue a reasignar contactos.
      if (filterCartera === 'mine' && user?.id) {
        query = query.eq('assigned_to', user.id);
      } else if (filterCartera === 'unassigned') {
        query = query.is('assigned_to', null);
      } else if (filterCartera === 'team') {
        const myTeam = users.find(u => u.id === user?.id)?.team || profile?.team;
        const teamIds = myTeam
          ? users.filter(u => u.team === myTeam).map(u => u.id)
          : (user?.id ? [user.id] : []);
        query = teamIds.length ? query.in('assigned_to', teamIds) : query.eq('id', '00000000-0000-0000-0000-000000000000');
      }

      // Seguimiento
      const now = new Date();
      if (filterFollowup === 'overdue') {
        query = query.lte('next_followup_at', now.toISOString());
      } else if (filterFollowup === 'week') {
        const weekAhead = new Date(now);
        weekAhead.setDate(weekAhead.getDate() + 7);
        query = query
          .gte('next_followup_at', now.toISOString())
          .lte('next_followup_at', weekAhead.toISOString());
      } else if (filterFollowup === 'none') {
        query = query.is('next_followup_at', null);
      }

      // Búsqueda. Nombre/email van directo; institución y asunto de correo
      // viven en otras tablas, así que se resuelven primero a ids. Va acotado
      // con .limit() para no traer medio universo.
      const q = debouncedQuery.trim();
      if (q) {
        const like = `%${q}%`;
        const [{ data: insts }, { data: inters }] = await Promise.all([
          supabase.from('institutions').select('id').ilike('name', like).limit(200),
          supabase.from('interactions').select('contact_id').ilike('subject', like).limit(500),
        ]);

        const instIds = (insts || []).map(i => i.id);
        const contactIds = [...new Set((inters || []).map(i => i.contact_id).filter(Boolean))];

        const clauses = [
          `first_name.ilike.${like}`,
          `last_name.ilike.${like}`,
          `email.ilike.${like}`,
        ];
        if (instIds.length) clauses.push(`institution_id.in.(${instIds.join(',')})`);
        if (contactIds.length) clauses.push(`id.in.(${contactIds.join(',')})`);

        query = query.or(clauses.join(','));
      }

      const from = page * PAGE_SIZE;
      query = query
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      const { data, error, count } = await query;
      if (error) throw error;

      setContacts(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error loading contacts:', err);
      setContacts([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, filterStage, filterPriority, filterCartera, filterFollowup, page, user?.id, users, profile?.team]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    if (searchParams.get('new') === 'true') setShowCreateModal(true);
  }, [searchParams]);

  const refresh = () => {
    reloadRef.current += 1;
    setSelected(new Set());
    loadContacts();
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pageIds = contacts.map(c => c.id);
    const allSelected = pageIds.every(id => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(pageIds));
  };

  const hasFilters =
    debouncedQuery || filterStage !== 'all' || filterPriority !== 'all' ||
    filterCartera !== 'all' || filterFollowup !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setFilterStage('all');
    setFilterPriority('all');
    setFilterCartera('all');
    setFilterFollowup('all');
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const pill = (active) =>
    `px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
      active ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'
    }`;

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contactos</h1>
          <p className="text-gray-500 mt-1">{counts.total} contactos en total</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowImportModal(true)} className="btn-secondary">
            <Upload size={18} />
            Importar
          </button>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus size={20} />
            Nuevo Contacto
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, email, institución o asunto de correo..."
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

          <div className="flex items-center gap-1 lg:border-l border-gray-200 lg:pl-4">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
              title="Vista grilla"
            >
              <Grid3X3 size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
              title="Vista lista"
            >
              <List size={18} />
            </button>
          </div>
        </div>

        {/* Etapa */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter size={18} className="text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-500 mr-1 flex-shrink-0">Etapa:</span>
          <div className="flex gap-1">
            <button onClick={() => setFilterStage('all')} className={pill(filterStage === 'all')}>
              Todas <span className="ml-1 text-xs opacity-60">({counts.total})</span>
            </button>
            {Object.values(PIPELINE_STAGES).map(s => (
              <button key={s.value} onClick={() => setFilterStage(s.value)} className={pill(filterStage === s.value)}>
                {s.label}
                <span className="ml-1 text-xs opacity-60">({counts.stage[s.value] || 0})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Prioridad */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-2 border-t border-gray-100">
          <span className="text-sm text-gray-500 mr-1 flex-shrink-0 pl-[26px]">Prioridad:</span>
          <div className="flex gap-1">
            <button onClick={() => setFilterPriority('all')} className={pill(filterPriority === 'all')}>
              Todas
            </button>
            {Object.values(PRIORITY_LEVELS).map(p => (
              <button key={p.value} onClick={() => setFilterPriority(p.value)} className={pill(filterPriority === p.value)}>
                {p.label}
                <span className="ml-1 text-xs opacity-60">({counts.priority[p.value] || 0})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Cartera + seguimiento */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 pl-[26px]">Cartera:</span>
            <div className="flex gap-1">
              {CARTERA_FILTERS.map(f => (
                <button key={f.value} onClick={() => setFilterCartera(f.value)} className={pill(filterCartera === f.value)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Seguimiento:</span>
            <div className="flex gap-1">
              {FOLLOWUP_FILTERS.map(f => (
                <button key={f.value} onClick={() => setFilterFollowup(f.value)} className={pill(filterFollowup === f.value)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {hasFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              <strong>{totalCount}</strong> contacto{totalCount !== 1 ? 's' : ''} coinciden
            </span>
            <button onClick={clearFilters} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Acciones en lote */}
      <BulkActionsBar
        selectedIds={[...selected]}
        users={users}
        onDone={refresh}
        onClear={() => setSelected(new Set())}
      />

      {/* Seleccionar todo */}
      {contacts.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            {contacts.every(c => selected.has(c.id))
              ? <CheckSquare size={16} className="text-primary-600" />
              : <Square size={16} />}
            Seleccionar los {contacts.length} de esta página
          </button>
          {totalPages > 1 && (
            <span className="text-sm text-gray-500">
              Página {page + 1} de {totalPages}
            </span>
          )}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Cargando contactos...</p>
        </div>
      ) : contacts.length > 0 ? (
        <>
          <div className={viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'space-y-3'}>
            {contacts.map(contact => (
              <ContactCard
                key={contact.id}
                contact={contact}
                variant={viewMode === 'list' ? 'compact' : 'default'}
                selectable
                selected={selected.has(contact.id)}
                onToggleSelect={() => toggleSelect(contact.id)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="btn-secondary py-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
                Anterior
              </button>
              <span className="text-sm text-gray-500 px-3">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} de {totalCount}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page + 1 >= totalPages}
                className="btn-secondary py-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Siguiente
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="card p-12 text-center">
          <Users size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No se encontraron contactos</h3>
          <p className="text-gray-500 mb-4">
            {hasFilters
              ? 'Probá con otros filtros de búsqueda'
              : 'Comenzá agregando tu primer contacto o importando desde un archivo'}
          </p>
          {!hasFilters && (
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setShowImportModal(true)} className="btn-secondary">
                <Upload size={18} />
                Importar Excel
              </button>
              <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                <Plus size={20} />
                Agregar Contacto
              </button>
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <ContactForm
          onClose={() => {
            setShowCreateModal(false);
            navigate('/contacts', { replace: true });
          }}
          onSuccess={() => { setShowCreateModal(false); refresh(); }}
        />
      )}

      <ImportContactsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => { setShowImportModal(false); refresh(); }}
      />
    </PageContainer>
  );
};

export default Contacts;
