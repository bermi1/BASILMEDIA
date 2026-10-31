import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when the two VITE_SUPABASE_* variables are set. Without them the app shows a setup screen. */
export const supabaseConfigured = !!(url && key);

/** The one Supabase client. Postgres + RLS decide who may read and write what. */
export const supabase: SupabaseClient = createClient(url || 'http://localhost:54321', key || 'not-configured', {
  auth: { persistSession: true, autoRefreshToken: true },
});
