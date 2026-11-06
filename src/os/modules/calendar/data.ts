// Shared calendar — data loading.
// The shared company layers come from the security-definer `calendar_feed()` RPC
// (0012_calendar.sql) so every staff role sees the shared calendar without being granted the full
// project / finance rows; finance rows and custom events are read directly under their own RLS.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchRows, onChange } from '@/os/lib/store';
import { useActing } from '@/os/lib/session';
import { aggregate, FINANCE_ROLES, type CalEvent, type Sources, type Viewer } from './lib';

async function load(v: Viewer): Promise<Sources> {
  const fin = FINANCE_ROLES.includes(v.role);
  const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
  const [feed, events, invoices, contracts] = await Promise.all([
    safe(
      (async () => {
        const { data, error } = await supabase.rpc('calendar_feed');
        if (error) throw error;
        return (data ?? {}) as Sources;
      })(),
      {} as Sources,
    ),
    safe(fetchRows('calendar_events'), []),
    fin ? safe(fetchRows('invoices', { select: 'id,number,title,client_id,project_id,status,due_date,schedule' }), []) : Promise.resolve([]),
    fin ? safe(fetchRows('contracts', { select: 'id,number,title,client_id,instalments' }), []) : Promise.resolve([]),
  ]);
  return { ...feed, calendar_events: events, invoices, contracts };
}

/** Every event the acting user may see, kept fresh when any table changes. */
export function useCalendarEvents(): { events: CalEvent[]; loading: boolean; error: string | null; viewer: Viewer; sources: Sources } {
  const { role, userId } = useActing();
  const [sources, setSources] = useState<Sources>({});
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const cu = role === 'client' && userId ? await fetchRows<{ client_id: string }>('client_users', { eq: { user_id: userId } }).catch(() => []) : [];
        const src = await load({ role, userId, clientIds: cu.map((c) => c.client_id) });
        if (!alive) return;
        setClientIds(cu.map((c) => c.client_id));
        setSources(src);
        setError(null);
      } catch (e) {
        if (alive) setError((e as Error).message ?? String(e));
      } finally {
        if (alive) setLoading(false);
      }
    };
    run();
    const off = onChange(run);
    return () => {
      alive = false;
      off();
    };
  }, [role, userId]);

  const viewer = useMemo<Viewer>(() => ({ role, userId, clientIds }), [role, userId, clientIds]);
  const events = useMemo(() => aggregate(sources, viewer), [sources, viewer]);
  return { events, loading, error, viewer, sources };
}
