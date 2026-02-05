/**
 * BACKWARD COMPATIBILITY REDIRECT
 * This file now delegates to the Clean Architecture data layer.
 * Old imports like `import { supabase } from '../lib/supabase'` will still work.
 *
 * New code should use: import { useRepository } from '../presentation/hooks/useRepository';
 */
import { getSupabaseClient } from '../data/supabase/client';

export const supabase = getSupabaseClient();
export default supabase;
