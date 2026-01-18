// src/store/useStore.js
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const useStore = create((set, get) => ({
  // ===========================================
  // AUTH STATE
  // ===========================================
  user: null,
  session: null,
  isAuthenticated: false,
  authLoading: true,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setSession: (session) => set({ session, user: session?.user, isAuthenticated: !!session }),
  setAuthLoading: (loading) => set({ authLoading: loading }),

  // Initialize auth
  initAuth: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    set({
      session,
      user: session?.user,
      isAuthenticated: !!session,
      authLoading: false
    });

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user, isAuthenticated: !!session });
    });
  },

  // ===========================================
  // CONTACTS STATE
  // ===========================================
  contacts: [],
  contactsLoading: false,
  selectedContact: null,

  loadContacts: async () => {
    set({ contactsLoading: true });
    const { data, error } = await supabase
      .from('contacts')
      .select(`*, institution:institutions(id, name, city)`)
      .order('created_at', { ascending: false });

    if (!error) {
      set({ contacts: data || [] });
    }
    set({ contactsLoading: false });
  },

  setSelectedContact: (contact) => set({ selectedContact: contact }),

  addContact: (contact) => set((state) => ({
    contacts: [contact, ...state.contacts]
  })),

  updateContact: (id, updates) => set((state) => ({
    contacts: state.contacts.map(c => c.id === id ? { ...c, ...updates } : c)
  })),

  removeContact: (id) => set((state) => ({
    contacts: state.contacts.filter(c => c.id !== id)
  })),

  // ===========================================
  // INSTITUTIONS STATE
  // ===========================================
  institutions: [],
  institutionsLoading: false,

  loadInstitutions: async () => {
    set({ institutionsLoading: true });
    const { data, error } = await supabase
      .from('institutions')
      .select('*')
      .order('name');

    if (!error) {
      set({ institutions: data || [] });
    }
    set({ institutionsLoading: false });
  },

  addInstitution: (institution) => set((state) => ({
    institutions: [...state.institutions, institution].sort((a, b) => a.name.localeCompare(b.name))
  })),

  // ===========================================
  // UI STATE
  // ===========================================
  sidebarOpen: true,
  modalOpen: null, // 'contact-form', 'email-draft', etc.
  searchQuery: '',

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setModalOpen: (modal) => set({ modalOpen: modal }),
  closeModal: () => set({ modalOpen: null }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  // ===========================================
  // FILTERS STATE
  // ===========================================
  filters: {
    interest_level: 'all',
    role: 'all',
    institution_id: 'all'
  },

  setFilter: (key, value) => set((state) => ({
    filters: { ...state.filters, [key]: value }
  })),

  clearFilters: () => set({
    filters: { interest_level: 'all', role: 'all', institution_id: 'all' }
  }),

  // Computed: filtered contacts
  getFilteredContacts: () => {
    const { contacts, filters, searchQuery } = get();

    return contacts.filter(contact => {
      // Interest level filter
      if (filters.interest_level !== 'all' && contact.interest_level !== filters.interest_level) {
        return false;
      }
      // Role filter
      if (filters.role !== 'all' && contact.role !== filters.role) {
        return false;
      }
      // Institution filter
      if (filters.institution_id !== 'all' && contact.institution_id !== filters.institution_id) {
        return false;
      }
      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const fullName = `${contact.first_name} ${contact.last_name}`.toLowerCase();
        const email = contact.email?.toLowerCase() || '';
        const institution = contact.institution?.name?.toLowerCase() || '';

        if (!fullName.includes(query) && !email.includes(query) && !institution.includes(query)) {
          return false;
        }
      }
      return true;
    });
  },

  // ===========================================
  // STATS (Computed)
  // ===========================================
  getStats: () => {
    const { contacts } = get();
    return {
      total: contacts.length,
      hot: contacts.filter(c => c.interest_level === 'hot').length,
      warm: contacts.filter(c => c.interest_level === 'warm').length,
      cold: contacts.filter(c => c.interest_level === 'cold').length,
      customers: contacts.filter(c => c.interest_level === 'customer').length
    };
  }
}));

export default useStore;