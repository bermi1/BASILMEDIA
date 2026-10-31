// Small building blocks shared by the growth module's desktop pages and phone screens.
import { createContext, useCallback, useContext, useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { PageTitle } from '@/os/OsLayout';
import { list, save, subscribe } from '@/lib/db';
import type { Booking, Gallery, Subscriber } from '@/lib/types';
import { useTable } from '@/os/lib/store';

// ---------- in-app navigation ----------
// On the phone app, growth screens open details (a proposal, a retainer, a showcase…) inside the app
// on a small stack instead of jumping to the desktop OS. On the desktop the same calls use the router.
export const StackCtx = createContext<((to: string) => void) | null>(null);
/** True when rendered inside the phone app (/app). */
export const useInPhone = () => useLocation().pathname.startsWith('/app');
/** Navigate to an OS path: pushes onto the phone stack when there is one, else uses the router. */
export function useGo() {
  const push = useContext(StackCtx);
  const nav = useNavigate();
  return useCallback((to: string) => (push ? push(to) : nav(to)), [push, nav]);
}
export function GoLink({ to, className, children, 'aria-label': aria }: { to: string; className?: string; children: ReactNode; 'aria-label'?: string }) {
  const push = useContext(StackCtx);
  const click = (e: MouseEvent) => {
    if (!push) return;
    e.preventDefault();
    push(to);
  };
  return <Link to={to} className={className} onClick={click} aria-label={aria}>{children}</Link>;
}
/** Page heading: the OS PageTitle on desktop; a compact heading on the phone (the app bar already names the tab). */
export function PageHead({ tag, title, sub, children }: { tag: string; title: string; sub?: string; children?: ReactNode }) {
  if (!useInPhone()) return <PageTitle tag={tag} title={title} sub={sub}>{children}</PageTitle>;
  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="min-w-0">
        <h1 className="m-0 font-display text-[22px] font-extrabold leading-tight">{title}</h1>
        {sub && <p className="m-0 mt-1 text-sm text-basil-muted">{sub}</p>}
      </div>
      {children && <div className="bm-phone-actions">{children}</div>}
    </div>
  );
}

/** Progress ring (SVG). */
export function Ring({ value, max, size = 76, stroke = 8, label, sub, color }: { value: number; max: number; size?: number; stroke?: number; label?: ReactNode; sub?: ReactNode; color?: string }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const auto = pct >= 1 ? '#DC2626' : pct >= 0.85 ? '#D97706' : '#059669';
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E3ECF7" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color ?? auto} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-display text-sm font-extrabold">{Math.round(pct * 100)}%</span>
      </div>
      {label && <span className="text-xs font-bold leading-tight">{label}</span>}
      {sub && <span className="text-[11px] leading-tight text-basil-muted">{sub}</span>}
    </div>
  );
}

/** Wrap printable content: when printing, only this block is shown. */
export function PrintArea({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`@media print { body * { visibility: hidden !important; } .bm-print, .bm-print * { visibility: visible !important; } .bm-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0 12mm; } .bm-noprint { display: none !important; } }`}</style>
      <div className="bm-print">{children}</div>
    </>
  );
}
export const PrintButton = ({ label = 'Print' }: { label?: string }) => (
  <button type="button" className="btn-outline bm-noprint" onClick={() => window.print()}><Printer size={16} />{label}</button>
);

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between"><h2 className="m-0 text-sm font-extrabold uppercase tracking-wide text-basil-muted">{title}</h2>{action}</div>
      {children}
    </section>
  );
}

// ---------- website tables (owned by the public site; read/updated through src/lib/db.ts) ----------
function useWeb<T>(load: () => Promise<T[]>) {
  const [rows, setRows] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const go = () => load().then((r) => alive && setRows(r)).catch((e) => alive && setError(String(e.message ?? e)));
    go();
    const off = subscribe(go);
    return () => void ((alive = false), off());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { rows, error };
}
export const useBookings = () => useWeb<Booking>(() => list('bookings', { order: 'created_at', ascending: false }));
export const useSubscribers = () => useWeb<Subscriber>(() => list('subscribers', { order: 'created_at', ascending: false }));
export const useGalleries = () => useWeb<Gallery>(() => list('galleries'));
export const markBooking = (b: Booking, status: Booking['status']) => save('bookings', { ...b, status });

/** The client (company) a client-portal user belongs to. */
export function useMyClient(userId: string) {
  const { rows, loading } = useTable<{ id: string; user_id: string; client_id: string; role: string }>('client_users', { eq: { user_id: userId } });
  return { clientId: rows[0]?.client_id ?? null, clientRole: rows[0]?.role ?? 'viewer', loading };
}

export interface Client { id: string; name: string; sector: string; contact_name: string; phone: string; email: string; address: string }
export const useClients = () => useTable<Client>('clients', { order: 'name' }).rows;
