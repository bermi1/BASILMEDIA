// One data API for the whole app. With Supabase configured it talks to Postgres (RLS enforces
// who may read and write). Without it, a browser-local demo store seeded from seed.ts is used so
// the site and CMS work out of the box.
import { supabase } from './supabase';
import { DEFAULT_SETTINGS, SEED } from './seed';
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

// ---------- demo store ----------
const KEY = 'basil-demo-db-v1';
type DemoDb = { settings: SiteSettings } & { [K in TableName]: Row<K>[] };

function loadDemo(): DemoDb {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DemoDb>;
      return { settings: { ...DEFAULT_SETTINGS, ...parsed.settings }, ...SEED, ...parsed } as DemoDb;
    }
  } catch {
    /* storage unavailable: fall through to seed */
  }
  return { settings: DEFAULT_SETTINGS, ...structuredClone(SEED) } as DemoDb;
}
let demo: DemoDb | null = null;
const demoDb = () => (demo ??= loadDemo());
function saveDemo() {
  try {
    localStorage.setItem(KEY, JSON.stringify(demoDb()));
  } catch {
    throw new Error('Browser storage is full. In demo mode large uploads should be pasted as links instead.');
  }
}
export function resetDemo() {
  demo = { settings: DEFAULT_SETTINGS, ...structuredClone(SEED) } as DemoDb;
  saveDemo();
  emit();
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

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
  if (supabase) {
    let q = supabase.from(table).select(opts.columns ?? '*');
    if (opts.publishedOnly) q = q.eq('published', true);
    for (const [k, v] of Object.entries(opts.eq ?? {})) q = q.eq(k, v);
    q = q.order(order, { ascending });
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as Row<T>[];
  }
  let rows = [...(demoDb()[table] as Row<T>[])];
  if (opts.publishedOnly) rows = rows.filter((r) => (r as { published?: boolean }).published !== false);
  for (const [k, v] of Object.entries(opts.eq ?? {})) rows = rows.filter((r) => (r as unknown as Record<string, unknown>)[k] === v);
  rows.sort((a, b) => {
    const x = (a as unknown as Record<string, unknown>)[order] as string | number;
    const y = (b as unknown as Record<string, unknown>)[order] as string | number;
    return (x > y ? 1 : x < y ? -1 : 0) * (ascending ? 1 : -1);
  });
  return opts.limit ? rows.slice(0, opts.limit) : rows;
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
  if (supabase) {
    const { data, error } = await supabase.from(table).select('*').eq(field, value).maybeSingle();
    if (error) throw error;
    return data as Row<T> | null;
  }
  return (demoDb()[table] as Row<T>[]).find((r) => (r as unknown as Record<string, unknown>)[field] === value) ?? null;
}

export async function save<T extends TableName>(table: T, row: Partial<Row<T>>): Promise<Row<T>> {
  if (supabase) {
    const { data, error } = await supabase.from(table).upsert(row as never).select().single();
    if (error) throw error;
    emit();
    return data as Row<T>;
  }
  const rows = demoDb()[table] as Row<T>[];
  const r = row as Row<T> & { id?: string };
  const i = r.id ? rows.findIndex((x) => (x as { id: string }).id === r.id) : -1;
  const next = { ...(i >= 0 ? rows[i] : {}), ...r, id: r.id || uid() } as Row<T>;
  if (i >= 0) rows[i] = next;
  else rows.push(next);
  saveDemo();
  emit();
  return next;
}

export async function remove(table: TableName, id: string) {
  if (supabase) {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
  } else {
    const db = demoDb();
    (db[table] as { id: string }[]) = (db[table] as { id: string }[]).filter((r) => r.id !== id);
    saveDemo();
  }
  emit();
}

/** Public, unauthenticated inserts (booking form, subscribe, gallery selections). */
export async function submit<T extends 'bookings' | 'subscribers'>(table: T, row: Partial<Row<T>>) {
  const full = { ...row, created_at: new Date().toISOString() } as Partial<Row<T>>;
  if (supabase) {
    // No .select(): anonymous visitors may insert but never read these tables back.
    const { error } = await supabase.from(table).insert(full as never);
    if (error) throw error;
    return;
  }
  await save(table, { ...full, status: (row as { status?: string }).status ?? (table === 'bookings' ? 'new' : 'pending') } as Partial<Row<T>>);
}

export async function getSettings(): Promise<SiteSettings> {
  if (supabase) {
    const { data, error } = await supabase.from('site_settings').select('*').eq('id', 'site').maybeSingle();
    if (error) throw error;
    return { ...DEFAULT_SETTINGS, ...(data ?? {}) } as SiteSettings;
  }
  return demoDb().settings;
}

export async function saveSettings(patch: Partial<SiteSettings>) {
  if (supabase) {
    const { error } = await supabase.from('site_settings').upsert({ ...patch, id: 'site' });
    if (error) throw error;
  } else {
    const db = demoDb();
    db.settings = { ...db.settings, ...patch };
    saveDemo();
  }
  emit();
}

/** Gallery media for a visitor. PIN galleries are unlocked server-side by an RPC. */
export async function galleryMedia(galleryId: string, slug: string, pin?: string) {
  if (supabase) {
    const { data, error } = await supabase.rpc('gallery_media', { p_slug: slug, p_pin: pin ?? null });
    if (error) throw error;
    return (data ?? []) as Tables['media_items'][];
  }
  const g = demoDb().galleries.find((x) => x.id === galleryId);
  if (g?.access_mode === 'pin' && g.pin && g.pin !== pin) throw new Error('Wrong PIN');
  return list('media_items', { eq: { gallery_id: galleryId } });
}
