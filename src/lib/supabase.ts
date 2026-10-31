import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Null when no Supabase project is configured: the app then runs in demo mode. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
export const isDemo = !supabase;
