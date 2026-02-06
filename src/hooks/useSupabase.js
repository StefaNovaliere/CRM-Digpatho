// src/hooks/useSupabase.js
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Hook para autenticación
export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Obtener sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Escuchar cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  };

  return {
    user,
    session,
    loading,
    isAuthenticated: !!session,
    signIn,
    signUp,
    signOut,
    resetPassword
  };
};

// Hook genérico para queries
export const useQuery = (table, options = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const {
    select = '*',
    filters = {},
    orderBy = null,
    limit = null,
    single = false
  } = options;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let query = supabase.from(table).select(select);

        // Aplicar filtros
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        });

        // Ordenar
        if (orderBy) {
          const { column, ascending = false } = orderBy;
          query = query.order(column, { ascending });
        }

        // Limitar
        if (limit) {
          query = query.limit(limit);
        }

        // Single o multiple
        if (single) {
          const { data: result, error } = await query.single();
          if (error) throw error;
          setData(result);
        } else {
          const { data: result, error } = await query;
          if (error) throw error;
          setData(result || []);
        }
      } catch (err) {
        console.error(`Error fetching ${table}:`, err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [table, select, JSON.stringify(filters), JSON.stringify(orderBy), limit, single]);

  return { data, loading, error };
};

// Hook para real-time subscriptions
export const useRealtime = (table, callback, filters = {}) => {
  useEffect(() => {
    let channel = supabase
      .channel(`${table}_changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          ...filters
        },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, callback, JSON.stringify(filters)]);
};

export default { useAuth, useQuery, useRealtime };