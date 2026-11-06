import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Basil Media's own Supabase project. The publishable key is designed to be public (it ships in every browser);
// Row Level Security in the database decides what it can do. Override both with VITE_SUPABASE_URL /
// VITE_SUPABASE_ANON_KEY (e.g. for a self-hosted copy), or set VITE_DEMO=1 to run with browser-only demo data.
const DEFAULT_URL = 'https://vodhxhbjncvhogdgkmfy.supabase.co';
const DEFAULT_KEY = 'sb_publishable__sBG8Fjlu-S4PYwaDTNAww_4oL-0cLm';

const demo = import.meta.env.VITE_DEMO === '1';
const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_KEY;

/** Null only in demo mode: the app then keeps its data in the browser. */
export const supabase: SupabaseClient | null = demo ? null : createClient(url, key);
export const isDemo = !supabase;
