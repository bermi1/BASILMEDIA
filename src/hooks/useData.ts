import { useEffect, useState } from 'react';
import { getSettings, list, subscribe, type ListOptions } from '@/lib/db';
import { DEFAULT_SETTINGS } from '@/lib/seed';
import type { SiteSettings, TableName, Tables } from '@/lib/types';

/** Rows from a table, refreshed whenever the CMS saves anything. */
// Published (public) rows are also kept on the visitor's device, so a return visit shows the work, partners
// and services at once while a fresh copy loads. Staff-only data is never stored this way.
const rowsKey = (table: string, key: string) => `bm-rows-v1:${table}:${key}`;
const PUBLIC_TABLES = new Set(['partners', 'services', 'projects_public', 'highlights', 'testimonials', 'team']);
const keepable = (table: string, o: ListOptions) => !!o.publishedOnly || PUBLIC_TABLES.has(table);
function savedRows<R>(table: string, key: string, opts: ListOptions): R[] {
  if (!keepable(table, opts)) return [];
  try { return JSON.parse(localStorage.getItem(rowsKey(table, key)) ?? '[]') as R[]; } catch { return []; }
}

export function useRows<T extends TableName>(table: T, opts: ListOptions = {}) {
  const key = JSON.stringify(opts);
  const [rows, setRows] = useState<Tables[T][]>(() => savedRows<Tables[T]>(table, key, opts));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const o = JSON.parse(key) as ListOptions;
    const load = () =>
      list(table, o)
        .then((r) => {
          if (!alive) return;
          setRows(r);
          setError(null);
          if (keepable(table, o)) try { localStorage.setItem(rowsKey(table, key), JSON.stringify(r)); } catch { /* full or private */ }
        })
        .catch((e) => alive && setError(e.message ?? String(e)))
        .finally(() => alive && setLoading(false));
    load();
    const off = subscribe(load);
    return () => {
      alive = false;
      off();
    };
  }, [table, key]);
  return { rows, loading, error };
}

// Site settings: the last copy is kept on the visitor's device so a return visit shows the real pictures and
// words at once; on a first visit, pictures that come from settings wait for the real values (see settingsReady)
// instead of flashing a default picture first.
const KEY = 'bm-settings-v1';
let cached: SiteSettings | null = (() => {
  try { const x = localStorage.getItem(KEY); return x ? { ...DEFAULT_SETTINGS, ...JSON.parse(x) } : null; } catch { return null; }
})();
let fresh = false;
/** True once real settings are known (from this visit or the device's saved copy). */
export const settingsReady = () => cached !== null;
export function useSettings() {
  const [s, setS] = useState<SiteSettings>(cached ?? DEFAULT_SETTINGS);
  useEffect(() => {
    const load = () => getSettings().then((x) => {
      cached = x; fresh = true;
      try { localStorage.setItem(KEY, JSON.stringify(x)); } catch { /* private mode */ }
      setS(x);
    }).catch(() => {});
    if (!fresh || !cached) load();
    return subscribe(load);
  }, []);
  return s;
}
