// Small building blocks shared by the growth module's desktop pages and phone screens.
import { useEffect, useState, type ReactNode } from 'react';
import { Printer } from 'lucide-react';
import { list, save, subscribe } from '@/lib/db';
import { isDemo } from '@/lib/supabase';
import type { Booking, Gallery, Subscriber } from '@/lib/types';
import { useTable } from '@/os/lib/store';
import { isoPlus } from './lib';
import './seed';

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
const DEMO_FLAG = 'basil-growth-web-seeded-v1';
async function seedWebsiteDemo() {
  if (!isDemo) return;
  try {
    if (localStorage.getItem(DEMO_FLAG)) return;
    localStorage.setItem(DEMO_FLAG, '1');
  } catch {
    return;
  }
  const existing = await list('bookings');
  if (!existing.length) {
    const now = Date.now();
    const b = (h: number, name: string, contact: string, service: string, days: number | null, message: string, source: Booking['source'] = 'booking') =>
      save('bookings', { name, contact, service, preferred_date: days === null ? null : isoPlus(days), message, source, status: 'new', created_at: new Date(now - h * 36e5).toISOString() } as Partial<Booking>);
    await b(3, 'Dr Salome Kimaro · Aga Clinic Mwanza', '+255754 331 220 · salome@agaclinic.co.tz', 'Brand Storytelling', 20, 'We are opening a new cancer wing and need a short film and photos for the launch.');
    await b(20, 'Hassan Mwinyi · Pwani Microfinance', 'hassan@pwanimf.co.tz', 'Corporate Content', null, 'Looking for monthly social media content for our 12 branches. Can you share your retainer tiers?');
    await b(46, 'Rose Ndege · Wildlife Trust', '+255 688 120 554', 'Films & Documentaries', 45, 'Documentary on community rangers in Ruaha, 10–15 minutes.', 'contact');
    await b(70, 'Peter Laizer', '+255 715 990 001', 'Photography', 8, 'Wedding photos in Arusha.');
  }
  const gals = await list('galleries');
  if (!gals.some((g) => g.slug === 'hospital-care-stories')) {
    await save('galleries', { slug: 'hospital-care-stories', title: 'Hospital care stories', client_name: 'National Referral Hospital', event_date: isoPlus(-21), location: 'Upanga, Dar es Salaam', cover_url: '', collections: ['Wards', 'Portraits'], access_mode: 'link', pin: '', expires_on: isoPlus(120), allow_downloads: true, selection_limit: 0, face_search_enabled: false, published: true } as Partial<Gallery>);
  }
}

function useWeb<T>(load: () => Promise<T[]>) {
  const [rows, setRows] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const go = () => load().then((r) => alive && setRows(r)).catch((e) => alive && setError(String(e.message ?? e)));
    seedWebsiteDemo().finally(go);
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
