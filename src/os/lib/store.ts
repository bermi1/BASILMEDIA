// Generic data layer for Basil Media OS modules (finance, projects, store, growth…).
// - With Supabase configured: plain table reads/writes + RPCs; RLS and SQL functions enforce the rules.
// - Demo mode: a browser-local store. Each module registers its own demo seed with `registerSeed`
//   and, for RPCs, passes a `demo` implementation that mimics the SQL function.
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type Row = Record<string, unknown> & { id: string };
type Listener = () => void;

const listeners = new Set<Listener>();
export const onChange = (fn: Listener) => (listeners.add(fn), () => void listeners.delete(fn));
export const emitChange = () => listeners.forEach((f) => f());

// ---------- demo store ----------
const KEY = 'basil-os-demo-v1';
const seeds: Record<string, () => Row[]> = {};
let mem: Record<string, Row[]> | null = null;

/** Register starter rows for a table (used only in demo mode, the first time the table is read). */
export function registerSeed(table: string, rows: () => Row[]) {
  seeds[table] = rows;
}
function db() {
  if (!mem) {
    try {
      mem = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    } catch {
      mem = {};
    }
  }
  return mem!;
}
export function demoTable(table: string): Row[] {
  const d = db();
  if (!d[table]) d[table] = seeds[table] ? structuredClone(seeds[table]()) : [];
  return d[table];
}
export function persistDemo() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db()));
  } catch {
    /* quota: keep in memory */
  }
  emitChange();
}
export function resetOsDemo() {
  mem = {};
  persistDemo();
}

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
export const nowIso = () => new Date().toISOString();

// ---------- queries ----------
export interface Query {
  select?: string;
  eq?: Record<string, unknown>;
  in?: Record<string, unknown[]>;
  order?: string;
  ascending?: boolean;
  limit?: number;
}

export async function fetchRows<T = Row>(table: string, q: Query = {}): Promise<T[]> {
  if (supabase) {
    let r = supabase.from(table).select(q.select ?? '*');
    for (const [k, v] of Object.entries(q.eq ?? {})) r = r.eq(k, v as never);
    for (const [k, v] of Object.entries(q.in ?? {})) r = r.in(k, v as never[]);
    if (q.order) r = r.order(q.order, { ascending: q.ascending ?? true });
    if (q.limit) r = r.limit(q.limit);
    const { data, error } = await r;
    if (error) throw error;
    return (data ?? []) as T[];
  }
  let rows = [...demoTable(table)];
  for (const [k, v] of Object.entries(q.eq ?? {})) rows = rows.filter((x) => x[k] === v);
  for (const [k, v] of Object.entries(q.in ?? {})) rows = rows.filter((x) => v.includes(x[k]));
  if (q.order) {
    const o = q.order, asc = q.ascending ?? true;
    rows.sort((a, b) => ((a[o] as never) > (b[o] as never) ? 1 : (a[o] as never) < (b[o] as never) ? -1 : 0) * (asc ? 1 : -1));
  }
  return (q.limit ? rows.slice(0, q.limit) : rows) as T[];
}

export async function insertRow<T = Row>(table: string, row: Record<string, unknown>): Promise<T> {
  if (supabase) {
    const { data, error } = await supabase.from(table).insert(row).select().single();
    if (error) throw error;
    emitChange();
    return data as T;
  }
  const full = { id: newId(), created_at: nowIso(), ...row } as Row;
  demoTable(table).push(full);
  persistDemo();
  return full as T;
}

export async function updateRow<T = Row>(table: string, id: string, patch: Record<string, unknown>): Promise<T> {
  if (supabase) {
    const { data, error } = await supabase.from(table).update(patch).eq('id', id).select().single();
    if (error) throw error;
    emitChange();
    return data as T;
  }
  const rows = demoTable(table);
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) throw new Error('Record not found');
  rows[i] = { ...rows[i], ...patch };
  persistDemo();
  return rows[i] as T;
}

export async function deleteRow(table: string, id: string) {
  if (supabase) {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
    emitChange();
    return;
  }
  const d = db();
  d[table] = demoTable(table).filter((r) => r.id !== id);
  persistDemo();
}

/** Call a SQL function; in demo mode run the JS twin that mimics it. */
export async function rpc<T = unknown>(name: string, args: Record<string, unknown>, demo: () => T | Promise<T>): Promise<T> {
  if (supabase) {
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw error;
    emitChange();
    return data as T;
  }
  const out = await demo();
  persistDemo();
  return out;
}

/** React hook: rows of a table, re-fetched whenever anything changes. */
export function useTable<T = Row>(table: string, q: Query = {}) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(q);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchRows<T>(table, JSON.parse(key))
        .then((r) => alive && (setRows(r), setError(null)))
        .catch((e) => alive && setError(e.message ?? String(e)))
        .finally(() => alive && setLoading(false));
    load();
    const off = onChange(load);
    return () => {
      alive = false;
      off();
    };
  }, [table, key]);
  return { rows, loading, error };
}

// ---------- people (for assignment pickers, names on records) ----------
export interface Person {
  id: string;
  full_name: string;
  phone: string;
  roles: string[];
}
const DEMO_PEOPLE: Person[] = [
  { id: 'u-boss', full_name: 'Emmanuel Basil', phone: '+255712000001', roles: ['boss'] },
  { id: 'u-gm', full_name: 'Saul Mwakyusa', phone: '+255712000002', roles: ['gm_cfo'] },
  { id: 'u-fin', full_name: 'Grace Mushi', phone: '+255712000003', roles: ['finance'] },
  { id: 'u-enock', full_name: 'Enock Mallya', phone: '+255712000004', roles: ['project_lead', 'staff'] },
  { id: 'u-jonathan', full_name: 'Jonathan Kimaro', phone: '+255712000005', roles: ['staff'] },
  { id: 'u-benedicto', full_name: 'Benedicto Ngowi', phone: '+255712000006', roles: ['staff', 'project_lead'] },
  { id: 'u-store', full_name: 'Juma Said', phone: '+255712000007', roles: ['storekeeper'] },
  { id: 'u-rehema', full_name: 'Rehema Juma', phone: '+255712000008', roles: ['receptionist'] },
  { id: 'u-driver', full_name: 'Hamisi Omary', phone: '+255712000009', roles: ['driver'] },
  { id: 'u-growth', full_name: 'Neema Lyimo', phone: '+255712000010', roles: ['growth', 'account_manager'] },
  { id: 'u-client', full_name: 'Dr Amina Juma', phone: '+255712000011', roles: ['client'] },
];
export function usePeople() {
  const [people, setPeople] = useState<Person[]>(supabase ? [] : DEMO_PEOPLE);
  useEffect(() => {
    if (!supabase) return;
    supabase.from('staff_directory').select('*').then(({ data }) => setPeople((data ?? []) as Person[]));
  }, []);
  return people;
}
export const personName = (people: Person[], id?: string | null) => people.find((p) => p.id === id)?.full_name ?? '—';
