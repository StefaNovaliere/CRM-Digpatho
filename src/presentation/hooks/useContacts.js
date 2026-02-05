/**
 * useContacts hook - refactored to use repository pattern.
 */
import { useState, useEffect, useCallback } from 'react';
import { useRepository } from './useRepository';

export const useContacts = (options = {}) => {
  const { autoLoad = true } = options;
  const contactRepo = useRepository('contactRepository');

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadContacts = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);

    try {
      const data = await contactRepo.getAll(filters);
      setContacts(data);
    } catch (err) {
      console.error('Error loading contacts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [contactRepo]);

  const getContact = useCallback(async (id) => {
    return contactRepo.getById(id);
  }, [contactRepo]);

  const createContact = useCallback(async (contactData) => {
    const data = await contactRepo.create(contactData);
    setContacts(prev => [data, ...prev]);
    return data;
  }, [contactRepo]);

  const updateContact = useCallback(async (id, updates) => {
    const data = await contactRepo.update(id, updates);
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
    return data;
  }, [contactRepo]);

  const deleteContact = useCallback(async (id) => {
    await contactRepo.delete(id);
    setContacts(prev => prev.filter(c => c.id !== id));
  }, [contactRepo]);

  useEffect(() => {
    if (autoLoad) loadContacts();
  }, [autoLoad, loadContacts]);

  return {
    contacts,
    loading,
    error,
    loadContacts,
    getContact,
    createContact,
    updateContact,
    deleteContact,
    refresh: loadContacts
  };
};

export default useContacts;
