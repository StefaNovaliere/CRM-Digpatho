// src/hooks/useContacts.js
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const useContacts = (options = {}) => {
  const { autoLoad = true } = options;

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar contactos
  const loadContacts = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('contacts')
        .select(`
          *,
          institution:institutions(id, name, city, type)
        `)
        .order('created_at', { ascending: false });

      // Aplicar filtros
      if (filters.interest_level && filters.interest_level !== 'all') {
        query = query.eq('interest_level', filters.interest_level);
      }
      if (filters.role && filters.role !== 'all') {
        query = query.eq('role', filters.role);
      }
      if (filters.institution_id && filters.institution_id !== 'all') {
        query = query.eq('institution_id', filters.institution_id);
      }
      if (filters.search) {
        query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setContacts(data || []);
    } catch (err) {
      console.error('Error loading contacts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Obtener un contacto por ID
  const getContact = useCallback(async (id) => {
    const { data, error } = await supabase
      .from('contacts')
      .select(`
        *,
        institution:institutions(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }, []);

  // Crear contacto
  const createContact = useCallback(async (contactData) => {
    const { data, error } = await supabase
      .from('contacts')
      .insert([contactData])
      .select()
      .single();

    if (error) throw error;
    setContacts(prev => [data, ...prev]);
    return data;
  }, []);

  // Actualizar contacto
  const updateContact = useCallback(async (id, updates) => {
    const { data, error } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
    return data;
  }, []);

  // Eliminar contacto
  const deleteContact = useCallback(async (id) => {
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id);

    if (error) throw error;
    setContacts(prev => prev.filter(c => c.id !== id));
  }, []);

  // Cargar al montar
  useEffect(() => {
    if (autoLoad) {
      loadContacts();
    }
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