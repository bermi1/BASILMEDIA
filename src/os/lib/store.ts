// Generic data layer for Basil Media OS modules (finance, projects, store, growth, calendar…).
// Plain table reads/writes and RPCs on Supabase; RLS and SQL functions enforce every rule.
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type Row = Record<string, unknown> & { id: string };
type Listener = () => void;

const listeners = new Set<Listener>();
export const onChange = (fn: Listener) => (listeners.add(fn), () => void listeners.delete(fn));
export const emitChange = () => listeners.forEach((f) => f());

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
  let r = supabase.from(table).select(q.select ?? '*');
  for (const [k, v] of Object.entries(q.eq ?? {})) r = r.eq(k, v as never);
  for (const [k, v] of Object.entries(q.in ?? {})) r = r.in(k, v as never[]);
  if (q.order) r = r.order(q.order, { ascending: q.ascending ?? true });
  if (q.limit) r = r.limit(q.limit);
  const { data, error } = await r;
  if (error) throw error;
  return (data ?? []) as T[];
}

export async function insertRow<T = Row>(table: string, row: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw error;
  emitChange();
  return data as T;
}

export async function updateRow<T = Row>(table: string, id: string, patch: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.from(table).update(patch).eq('id', id).select().single();
  if (error) throw error;
  emitChange();
  return data as T;
}

export async function deleteRow(table: string, id: string) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
  emitChange();
}

/** Call a SQL function (security definer functions hold the business rules). */
export async function rpc<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  emitChange();
  return data as T;
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
let peopleCache: Person[] = [];
export function usePeople() {
  const [people, setPeople] = useState<Person[]>(peopleCache);
  useEffect(() => {
    const load = () => supabase.from('staff_directory').select('*').order('full_name').then(({ data }) => {
      peopleCache = (data ?? []) as Person[];
      setPeople(peopleCache);
    });
    load();
    return onChange(load);
  }, []);
  return people;
}
export const personName = (people: Person[], id?: string | null) => people.find((p) => p.id === id)?.full_name ?? '—';
