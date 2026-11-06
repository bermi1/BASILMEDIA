// One data API for the public site and the Website CMS. It talks to Postgres through Supabase;
// row-level security decides who may read and write.
import { supabase } from './supabase';
import { DEFAULT_SETTINGS } from './seed';
import type { SiteSettings, TableName, Tables } from './types';

type Row<T extends TableName> = Tables[T];
type Listener = () => void;

const listeners = new Set<Listener>();
export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
function emit() {
  listeners.forEach((fn) => fn());
}

// ---------- public API ----------
export interface ListOptions {
  /** Only rows with published = true (public pages). */
  publishedOnly?: boolean;
  eq?: Record<string, string | number | boolean>;
  order?: string;
  ascending?: boolean;
  limit?: number;
  /** Explicit column list (for tables where some columns are hidden from the public). */
  columns?: string;
}

export async function list<T extends TableName>(table: T, opts: ListOptions = {}): Promise<Row<T>[]> {
  const order = opts.order ?? defaultOrder(table);
  const ascending = opts.ascending ?? !order.endsWith('_at');
  let q = supabase.from(table).select(opts.columns ?? '*');
  if (opts.publishedOnly) q = q.eq('published', true);
  for (const [k, v] of Object.entries(opts.eq ?? {})) q = q.eq(k, v);
  q = q.order(order, { ascending });
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Row<T>[];
}

function defaultOrder(table: TableName) {
  if (table === 'bookings' || table === 'subscribers') return 'created_at';
  if (table === 'news_stories') return 'published_at';
  if (table === 'events') return 'starts_on';
  if (table === 'opportunities') return 'closes_on';
  if (table === 'galleries') return 'event_date';
  return 'sort_order';
}

export async function get<T extends TableName>(table: T, field: string, value: string): Promise<Row<T> | null> {
  const { data, error } = await supabase.from(table).select('*').eq(field, value).maybeSingle();
  if (error) throw error;
  return data as Row<T> | null;
}

export async function save<T extends TableName>(table: T, row: Partial<Row<T>>): Promise<Row<T>> {
  const { data, error } = await supabase.from(table).upsert(row as never).select().single();
  if (error) throw error;
  emit();
  return data as Row<T>;
}

export async function remove(table: TableName, id: string) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
  emit();
}

/** Public, unauthenticated inserts (booking form, subscribe). */
export async function submit<T extends 'bookings' | 'subscribers'>(table: T, row: Partial<Row<T>>) {
  // No .select(): anonymous visitors may insert but never read these tables back.
  const { error } = await supabase.from(table).insert(row as never);
  if (error) throw error;
}

export async function getSettings(): Promise<SiteSettings> {
  const { data, error } = await supabase.from('site_settings').select('*').eq('id', 'site').maybeSingle();
  if (error) throw error;
  return { ...DEFAULT_SETTINGS, ...(data ?? {}) } as SiteSettings;
}

export async function saveSettings(patch: Partial<SiteSettings>) {
  const { error } = await supabase.from('site_settings').upsert({ ...patch, id: 'site' });
  if (error) throw error;
  emit();
}

/** Gallery media for a visitor. PIN galleries are unlocked server-side by an RPC. */
export async function galleryMedia(_galleryId: string, slug: string, pin?: string) {
  const { data, error } = await supabase.rpc('gallery_media', { p_slug: slug, p_pin: pin ?? null });
  if (error) throw error;
  return (data ?? []) as Tables['media_items'][];
}
