import { useEffect, useState } from 'react';
import { getSettings, list, subscribe, type ListOptions } from '@/lib/db';
import { DEFAULT_SETTINGS } from '@/lib/seed';
import type { SiteSettings, TableName, Tables } from '@/lib/types';

/** Rows from a table, refreshed whenever the CMS saves anything. */
export function useRows<T extends TableName>(table: T, opts: ListOptions = {}) {
  const [rows, setRows] = useState<Tables[T][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(opts);
  useEffect(() => {
    let alive = true;
    const load = () =>
      list(table, JSON.parse(key))
        .then((r) => alive && (setRows(r), setError(null)))
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

let cached: SiteSettings | null = null;
export function useSettings() {
  const [s, setS] = useState<SiteSettings>(cached ?? DEFAULT_SETTINGS);
  useEffect(() => {
    const load = () => getSettings().then((x) => ((cached = x), setS(x))).catch(() => {});
    load();
    return subscribe(load);
  }, []);
  return s;
}
