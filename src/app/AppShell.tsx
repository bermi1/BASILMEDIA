// Role-based phone app (installable PWA) at /app. Each role gets four tabs plus "More",
// in a floating bottom bar with a sliding indicator, its own accent colour and live badges.
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, ChevronRight, Globe2, LayoutDashboard, Loader2, LogOut, MoreHorizontal, RefreshCcw, UserCog } from 'lucide-react';
import { useAuth, ROLE_LABEL } from '@/lib/auth';
import { isDemo } from '@/lib/supabase';
import { ActingProvider, useActing } from '@/os/lib/session';
import { resetOsDemo, useTable } from '@/os/lib/store';
import { ToastProvider } from '@/os/cms/toast';
import { Sheet } from '@/os/ui';
import { PHONE_APPS } from './roles';
import { Alerts } from './Alerts';
import type { PhoneExtra } from '@/os/modules/types';
import type { AppRole } from '@/lib/types';

export default function PhoneApp() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-basil-night"><Loader2 className="animate-spin text-white" /></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return (
    <ActingProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </ActingProvider>
  );
}

function Shell() {
  const { user, signOut } = useAuth();
  const { role, roles, setRole, userId } = useActing();
  const [params, setParams] = useSearchParams();
  const app = PHONE_APPS[role];
  const tabs = useMemo(() => [...(app?.tabs ?? []).slice(0, 4), { key: 'more', label: 'More', icon: MoreHorizontal, element: null }], [app]);
  const tab = tabs.some((t) => t.key === params.get('tab')) ? params.get('tab')! : tabs[0].key;
  const [extra, setExtra] = useState<PhoneExtra | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const { rows: notes } = useTable<{ id: string; read_at: string | null }>('notifications', { eq: { user_id: userId } });
  const unread = notes.filter((n) => !n.read_at).length;
  const accent = app?.accent ?? '#0F6EC2';

  useEffect(() => {
    document.title = `${app?.title ?? 'Basil Media'} · Basil Media`;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0A2F5C');
  }, [app]);
  useEffect(() => void (scrollTo({ top: 0 }), setExtra(null)), [tab, role]);
  const go = (k: string) => setParams((p) => (p.set('tab', k), p), { replace: true });

  const current = tabs.find((t) => t.key === tab)!;
  const first = (user?.name || user?.email || '').split(/[ @]/)[0];

  return (
    <div className="min-h-screen bg-[#F1F5FB] text-basil-ink" style={{ ['--accent' as string]: accent }}>
      <header className="sticky top-0 z-30 border-b border-white/10 pt-[env(safe-area-inset-top)] text-white" style={{ background: `linear-gradient(135deg, #0A2F5C, #061E3D)` }}>
        <div className="mx-auto flex h-14 max-w-xl items-center gap-3 px-4">
          <img src="/logo-reverse.svg" alt="" className="h-8 w-8" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate font-display text-[15px] font-extrabold">{extra ? extra.label : current.key === 'more' ? 'More' : current.label}</div>
            <div className="truncate text-[11px] text-basil-haze"><span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: accent }} />{app?.title ?? ROLE_LABEL[role]} · {first}</div>
          </div>
          <button type="button" onClick={() => setAlertsOpen(true)} aria-label={`Alerts, ${unread} unread`} className="relative flex h-11 w-11 items-center justify-center rounded-full border-0 bg-white/10 text-white">
            <Bell size={20} />
            {unread > 0 && <span className="absolute right-1.5 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold">{unread}</span>}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-32 pt-4">
        <AnimatePresence mode="wait">
          <motion.div key={`${role}-${tab}-${extra?.key ?? ''}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            {extra ? (
              <>
                <button type="button" onClick={() => setExtra(null)} className="mb-3 border-0 bg-transparent p-0 text-sm font-bold text-basil">← More</button>
                {extra.element}
              </>
            ) : current.key === 'more' ? (
              <More extras={app?.more ?? []} onOpen={setExtra} roles={roles} role={role} setRole={(r) => (setRole(r), go(PHONE_APPS[r]?.tabs[0]?.key ?? 'home'))} signOut={signOut} />
            ) : (
              current.element
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav aria-label="Main tabs" className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(10px,env(safe-area-inset-bottom))]">
        <div className="mx-auto grid max-w-xl grid-cols-5 rounded-[26px] border border-white/60 bg-white/90 p-1.5 shadow-[0_18px_40px_rgba(10,47,92,0.22)] backdrop-blur-xl">
          {tabs.map(({ key, label, icon: Icon }) => {
            const on = key === tab && !extra;
            return (
              <button key={key} type="button" aria-current={on ? 'page' : undefined} onClick={() => (setExtra(null), go(key))} className="relative flex h-[58px] flex-col items-center justify-center gap-0.5 rounded-[20px] border-0 bg-transparent text-[11px] font-semibold">
                {on && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-[20px]" style={{ background: `color-mix(in srgb, ${accent} 14%, white)` }} transition={{ type: 'spring', stiffness: 420, damping: 32 }} />}
                <motion.span animate={{ y: on ? -1 : 0, scale: on ? 1.1 : 1 }} className="relative" style={{ color: on ? accent : '#4A5D78' }}><Icon size={22} strokeWidth={on ? 2.3 : 1.8} /></motion.span>
                <span className="relative" style={{ color: on ? accent : '#4A5D78' }}>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <Sheet open={alertsOpen} onClose={() => setAlertsOpen(false)} title="Alerts">
        <Alerts />
      </Sheet>
    </div>
  );
}

function More({ extras, onOpen, roles, role, setRole, signOut }: { extras: PhoneExtra[]; onOpen: (e: PhoneExtra) => void; roles: AppRole[]; role: AppRole; setRole: (r: AppRole) => void; signOut: () => void }) {
  const { user } = useAuth();
  const row = 'flex w-full items-center gap-3 rounded-2xl border-0 bg-white p-4 text-left text-basil-ink no-underline shadow-[0_1px_0_rgba(10,47,92,0.04)]';
  return (
    <div className="flex flex-col gap-5">
      {extras.length > 0 && (
        <div className="flex flex-col gap-2">
          {extras.map((e) => (
            <button key={e.key} type="button" onClick={() => onOpen(e)} className={row}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'color-mix(in srgb, var(--accent) 14%, white)', color: 'var(--accent)' }}><e.icon size={20} /></span>
              <span className="min-w-0 flex-1"><b className="block">{e.label}</b>{e.sub && <span className="text-sm text-basil-muted">{e.sub}</span>}</span>
              <ChevronRight size={18} className="text-basil-muted" />
            </button>
          ))}
        </div>
      )}
      {roles.length > 1 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-basil-muted"><UserCog size={16} />Switch portal{isDemo && ' (demo: view as any role)'}</h2>
          <div className="grid grid-cols-2 gap-2">
            {roles.filter((r) => PHONE_APPS[r]).map((r) => (
              <button key={r} type="button" onClick={() => setRole(r)} aria-pressed={r === role} className={`flex items-center gap-2 rounded-2xl p-3 text-left text-sm font-bold ${r === role ? 'border-0 text-white' : 'border border-basil-line bg-white text-basil-ink'}`} style={r === role ? { background: PHONE_APPS[r]!.accent } : undefined}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r === role ? '#fff' : PHONE_APPS[r]!.accent }} />{PHONE_APPS[r]!.title}
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="flex flex-col gap-2">
        <a href="/os" className={row}><LayoutDashboard size={20} className="text-basil" /><b className="flex-1">Open desktop OS</b><ChevronRight size={18} className="text-basil-muted" /></a>
        <a href="/" className={row}><Globe2 size={20} className="text-basil" /><b className="flex-1">Basil Media website</b><ChevronRight size={18} className="text-basil-muted" /></a>
        {isDemo && <button type="button" onClick={() => confirm('Reset all OS demo data?') && resetOsDemo()} className={row}><RefreshCcw size={20} className="text-amber-700" /><b className="flex-1">Reset demo data</b></button>}
        <button type="button" onClick={signOut} className={row}><LogOut size={20} className="text-red-700" /><b className="flex-1 text-red-700">Sign out</b><span className="text-xs text-basil-muted">{user?.email}</span></button>
      </div>
    </div>
  );
}
