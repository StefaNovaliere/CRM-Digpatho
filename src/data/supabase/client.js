/**
 * Supabase Client Singleton
 *
 * Single point of initialization. Uses env.js for validated credentials.
 * If you need to swap the backend, replace this file only.
 */
import { createClient } from '@supabase/supabase-js';
import { env } from '../../infrastructure/config/env';

let _instance = null;

export function getSupabaseClient() {
  if (!_instance) {
    _instance = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });
  }
  return _instance;
}

export default getSupabaseClient;
