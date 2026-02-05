/**
 * BACKWARD COMPATIBILITY REDIRECT
 *
 * The generic useQuery and useRealtime hooks now use the DI container.
 * New code should use specific repository hooks via useRepository instead.
 */
import { useState, useEffect } from 'react';
import { getSupabaseClient } from '../data/supabase/client';

const supabase = getSupabaseClient();

export { useAuth } from '../presentation/hooks/useAuth';

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

        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        });

        if (orderBy) {
          const { column, ascending = false } = orderBy;
          query = query.order(column, { ascending });
        }

        if (limit) query = query.limit(limit);

        if (single) {
          const { data: result, error: queryError } = await query.single();
          if (queryError) throw queryError;
          setData(result);
        } else {
          const { data: result, error: queryError } = await query;
          if (queryError) throw queryError;
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

export const useRealtime = (table, callback, filters = {}) => {
  useEffect(() => {
    const channel = supabase
      .channel(`${table}_changes`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: table, ...filters },
        (payload) => callback(payload)
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [table, callback, JSON.stringify(filters)]);
};

export default { useQuery, useRealtime };
