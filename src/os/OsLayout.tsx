import { useEffect, useState } from 'react';
import { onChange } from './lib/store';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen, CalendarRange, Globe2, Handshake, Images, Inbox, LayoutDashboard, LogOut, Menu,
  MessageSquareQuote, Newspaper, Settings2, Users, UsersRound, Video, BriefcaseBusiness, X, ExternalLink, Loader2,
} from 'lucide-react';
import { useAuth, ROLE_LABEL } from '@/lib/auth';
import { MODULES } from './modules';
import { useActing } from './lib/session';
import { Smartphone, ShieldCheck, KeyRound } from 'lucide-react';
import { PortalMenu } from './PortalSwitcher';
import type { AppRole } from '@/lib/types';
import { IMPLIED_ROLES } from '@/lib/roles';

const CMS_NAV = [
  { to: '/os/website', label: 'Overview', Icon: LayoutDashboard, end: true },
  { to: '/os/website/settings', label: 'Site settings', Icon: Settings2 },
  { to: '/os/website/projects', label: 'Projects', Icon: Video },
  { to: '/os/website/services', label: 'Services', Icon: BriefcaseBusiness },
  { to: '/os/website/partners', label: 'Partners', Icon: Handshake },
  { to: '/os/website/team', label: 'Team', Icon: UsersRound },
  { to: '/os/website/testimonials', label: 'Testimonials', Icon: MessageSquareQuote },
  { to: '/os/website/galleries', label: 'Galleries', Icon: Images },
  { to: '/os/website/news', label: 'Health news', Icon: Newspaper },
  { to: '/os/website/opportunities', label: 'Opportunities', Icon: BookOpen },
  { to: '/os/website/events', label: 'Events', Icon: CalendarRange },
  { to: '/os/website/bookings', label: 'Bookings', Icon: Inbox },
  { to: '/os/website/subscribers', label: 'Subscribers', Icon: Users },
];

/** Nav items of one portal (role). Each portal keeps its own menu. */
export function usePortalNav(role: AppRole) {
  const { user } = useAuth();
  // A portal that comes with another role (GM ⇒ Finance, Account Manager, Reception) shows only its own work:
  // items the parent portal already has are left there, so nothing is listed twice.
  const parents = (user?.roles ?? []).filter((p) => p !== 'super_admin' && IMPLIED_ROLES[p]?.includes(role));
  return MODULES.map((m) => ({ ...m, nav: m.nav.filter((n) => n.roles.includes(role) && !parents.some((p) => n.roles.includes(p))) })).filter((m) => m.nav.length);
}

export function OsLayout() {
  const { user, loading, signOut, canEditWebsite } = useAuth();
  const { role, setRole, canAny } = useActing();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const go = useNavigate();
  const portalNav = usePortalNav(role);
  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-basil" size={36} /></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  const inCms = loc.pathname.startsWith('/os/website');
  const pick = (r: AppRole) => (setRole(r), setOpen(false), go('/os'));

  const nav = (
    <nav aria-label="OS" className="flex flex-col gap-0.5">
      <NavLink to="/os" end className={itemCls} onClick={() => setOpen(false)}><LayoutDashboard size={18} />Home</NavLink>
      {inCms && canEditWebsite ? (
        <>
          <div className="mb-1 mt-5 px-3 font-mono text-[10px] tracking-[0.18em] text-basil-haze/70">WEBSITE CMS</div>
          {CMS_NAV.map(({ to, label, Icon, end }) => <NavLink key={to} to={to} end={end} className={itemCls} onClick={() => setOpen(false)}><Icon size={18} />{label}</NavLink>)}
        </>
      ) : (
        portalNav.map((m) => (
          <div key={m.key}>
            <div className="mb-1 mt-5 px-3 font-mono text-[10px] tracking-[0.18em] text-basil-haze/70">{m.section}</div>
            {m.nav.map(({ to, label, icon: Icon, badge }) => (
              <NavLink key={to} to={to} end={to.split('/').length <= 3} className={itemCls} onClick={() => setOpen(false)}><Icon size={18} /><span className="flex-1">{label}</span>{badge && <NavBadge get={badge} />}</NavLink>
            ))}
          </div>
        ))
      )}
      <div className="mb-1 mt-5 px-3 font-mono text-[10px] tracking-[0.18em] text-basil-haze/70">PLATFORM</div>
      <a href="/app" className={itemCls({ isActive: false })}><Smartphone size={18} />Phone app</a>
      {canAny('boss', 'gm_cfo') && <NavLink to="/os/admin/access" className={itemCls} onClick={() => setOpen(false)}><KeyRound size={18} />Portal access</NavLink>}
      {user.roles.includes('super_admin') && <NavLink to="/os/admin/users" className={itemCls} onClick={() => setOpen(false)}><ShieldCheck size={18} />Users &amp; roles</NavLink>}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-[#F3F7FC] text-basil-ink">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col bg-basil-deep p-4 text-white transition-transform lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-6 flex items-center justify-between">
          <Link to="/os" className="flex items-center gap-2.5 no-underline"><img src="/logo-reverse.svg" alt="" className="h-11 w-11" /><span className="font-display text-lg font-extrabold text-white">Basil <span className="text-basil-sky">OS</span></span></Link>
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl border-0 bg-white/10 text-white lg:hidden"><X size={18} /></button>
        </div>
        <div className="mb-3"><PortalMenu onRole={pick} website={canEditWebsite ? { active: inCms, onPick: () => (setOpen(false), go('/os/website')) } : undefined} /></div>
        <div className="min-h-0 flex-1 overflow-y-auto">{nav}</div>
        <div className="mt-4 rounded-2xl bg-white/[0.07] p-3">
          <div className="truncate text-sm font-bold">{user.name || user.email}</div>
          <div className="truncate text-xs text-basil-haze">{user.roles.map((r) => ROLE_LABEL[r]).join(' · ') || 'No role yet'}</div>
          <button type="button" onClick={signOut} className="mt-2 flex items-center gap-2 border-0 bg-transparent p-0 text-sm font-bold text-basil-sky"><LogOut size={16} />Sign out</button>
        </div>
      </aside>
      {open && <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-30 border-0 bg-basil-night/50 lg:hidden" />}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-basil-line bg-white/90 px-4 backdrop-blur-xl sm:px-6">
          <button type="button" aria-label="Open menu" onClick={() => setOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-basil-edge bg-white text-basil-deep lg:hidden"><Menu size={20} /></button>
          <div className="min-w-0 flex-1 truncate font-display font-extrabold">Basil Media OS</div>
          <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm font-bold no-underline"><Globe2 size={16} />View site <ExternalLink size={14} /></a>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6"><Outlet /></main>
      </div>
    </div>
  );
}

const itemCls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm no-underline transition ${isActive ? 'bg-white/[0.12] font-bold text-white' : 'text-basil-haze hover:bg-white/[0.06] hover:text-white'}`;

/** Live count next to a menu item; refreshed whenever data changes. */
export function NavBadge({ get, className = 'rounded-full bg-basil px-2 text-xs font-bold text-white' }: { get: () => Promise<number>; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () => void get().then((x) => alive && setN(x)).catch(() => {});
    load();
    const off = onChange(load);
    return () => ((alive = false), off());
  }, [get]);
  return n > 0 ? <span className={className}>{n}</span> : null;
}

export function RequireCms({ children }: { children: React.ReactNode }) {
  const { canEditWebsite } = useAuth();
  if (!canEditWebsite) return <div className="card p-8"><h1 className="m-0 text-2xl font-extrabold">No access</h1><p className="text-basil-muted">The Website CMS is for the Super Admin, GM/CFO and Growth roles.</p></div>;
  return <>{children}</>;
}

export function PageTitle({ tag, title, sub, children }: { tag: string; title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <span className="rounded-full bg-gold/15 px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.16em] text-[#8a6d1f]">{tag}</span>
        <h1 className="m-0 mt-2 text-[28px] font-extrabold">{title}</h1>
        {sub && <p className="m-0 mt-1 text-basil-muted">{sub}</p>}
      </div>
      {children}
    </div>
  );
}
