/**
 * useStore - Zustand global store, refactored to use DI container.
 */
import { create } from 'zustand';
import { container } from '../../infrastructure/di/container';

const useStore = create((set, get) => ({
  // ===========================================
  // CONTACTS STATE
  // ===========================================
  contacts: [],
  contactsLoading: false,
  selectedContact: null,

  loadContacts: async () => {
    set({ contactsLoading: true });
    try {
      const contactRepo = container.get('contactRepository');
      const data = await contactRepo.getAll();
      set({ contacts: data });
    } catch (err) {
      console.error('Error loading contacts:', err);
    } finally {
      set({ contactsLoading: false });
    }
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
    try {
      const institutionRepo = container.get('institutionRepository');
      const data = await institutionRepo.getAll();
      set({ institutions: data });
    } catch (err) {
      console.error('Error loading institutions:', err);
    } finally {
      set({ institutionsLoading: false });
    }
  },

  addInstitution: (institution) => set((state) => ({
    institutions: [...state.institutions, institution].sort((a, b) => a.name.localeCompare(b.name))
  })),

  // ===========================================
  // UI STATE
  // ===========================================
  sidebarOpen: true,
  modalOpen: null,
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

  getFilteredContacts: () => {
    const { contacts, filters, searchQuery } = get();
    const contactService = container.get('contactService');
    return contactService.filterContacts(contacts, { ...filters, search: searchQuery });
  },

  // ===========================================
  // STATS (Computed)
  // ===========================================
  getStats: () => {
    const { contacts } = get();
    const contactService = container.get('contactService');
    return contactService.computeStats(contacts);
  }
}));

export default useStore;
