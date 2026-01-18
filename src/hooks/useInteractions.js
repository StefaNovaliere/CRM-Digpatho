// src/hooks/useInteractions.js
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const useInteractions = (contactId = null) => {
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cargar interacciones de un contacto
  const loadInteractions = useCallback(async (id = contactId) => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('interactions')
        .select('*')
        .eq('contact_id', id)
        .order('occurred_at', { ascending: false });

      if (fetchError) throw fetchError;
      setInteractions(data || []);
    } catch (err) {
      console.error('Error loading interactions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  // Crear interacción
  const createInteraction = useCallback(async (interactionData) => {
    const { data, error } = await supabase
      .from('interactions')
      .insert([interactionData])
      .select()
      .single();

    if (error) throw error;
    setInteractions(prev => [data, ...prev]);
    return data;
  }, []);

  // Actualizar interacción
  const updateInteraction = useCallback(async (id, updates) => {
    const { data, error } = await supabase
      .from('interactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    setInteractions(prev => prev.map(i => i.id === id ? data : i));
    return data;
  }, []);

  // Eliminar interacción
  const deleteInteraction = useCallback(async (id) => {
    const { error } = await supabase
      .from('interactions')
      .delete()
      .eq('id', id);

    if (error) throw error;
    setInteractions(prev => prev.filter(i => i.id !== id));
  }, []);

  // Obtener últimas N interacciones
  const getRecentInteractions = useCallback(async (id, limit = 5) => {
    const { data, error } = await supabase
      .from('interactions')
      .select('*')
      .eq('contact_id', id)
      .order('occurred_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }, []);

  return {
    interactions,
    loading,
    error,
    loadInteractions,
    createInteraction,
    updateInteraction,
    deleteInteraction,
    getRecentInteractions,
    refresh: loadInteractions
  };
};

export default useInteractions;