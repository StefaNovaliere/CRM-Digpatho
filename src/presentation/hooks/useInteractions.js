/**
 * useInteractions hook - refactored to use repository pattern.
 */
import { useState, useCallback } from 'react';
import { useRepository } from './useRepository';

export const useInteractions = (contactId = null) => {
  const interactionRepo = useRepository('interactionRepository');

  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadInteractions = useCallback(async (id = contactId) => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const data = await interactionRepo.getByContactId(id);
      setInteractions(data);
    } catch (err) {
      console.error('Error loading interactions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [contactId, interactionRepo]);

  const createInteraction = useCallback(async (interactionData) => {
    const data = await interactionRepo.create(interactionData);
    setInteractions(prev => [data, ...prev]);
    return data;
  }, [interactionRepo]);

  const updateInteraction = useCallback(async (id, updates) => {
    const data = await interactionRepo.update(id, updates);
    setInteractions(prev => prev.map(i => i.id === id ? data : i));
    return data;
  }, [interactionRepo]);

  const deleteInteraction = useCallback(async (id) => {
    await interactionRepo.delete(id);
    setInteractions(prev => prev.filter(i => i.id !== id));
  }, [interactionRepo]);

  const getRecentInteractions = useCallback(async (id, limit = 5) => {
    return interactionRepo.getRecentByContactId(id, limit);
  }, [interactionRepo]);

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
