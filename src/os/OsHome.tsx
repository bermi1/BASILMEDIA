import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ArrowRight, Globe2, Inbox, KeyRound, Newspaper, ShieldCheck, Smartphone, Users, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PORTAL_BLURB } from '@/lib/roles';
import { useRows } from '@/hooks/useData';
import { NavBadge, PageTitle, usePortalNav } from './OsLayout';
import { useActing } from './lib/session';
import { portalMeta } from './PortalSwitcher';
import type { AppRole } from '@/lib/types';

/** Desktop home: the current portal's sections as tiles, plus the other portals one tap away. */
export default function OsHome() {
  const { user, canEditWebsite } = useAuth();
  const { role, roles, setRole } = useActing();
  const go = useNavigate();
  const nav = usePortalNav(role);
  const { rows: bookings } = useRows('bookings');
  const { rows: subs } = useRows('subscribers');
  const fresh = bookings.filter((b) => b.status === 'new').length;
  const meta = portalMeta(role);
  const others = roles.filter((r) => r !== role);
  const first = (user?.name || user?.email || '').split(/[ @]/)[0];
  const switchTo = (r: AppRole) => (setRole(r), scrollTo({ top: 0 }), go('/os'));

  return (
    <>
      <PageTitle tag={`${meta.label.toUpperCase()} PORTAL`} title={`Habari, ${first}`} sub={PORTAL_BLURB[role] ?? 'Run the office. Reach the audience. Tell the story.'}>
        <a href={`/app`} className="btn-outline"><Smartphone size={16} />Open on phone</a>
      </PageTitle>

      {user?.roles.includes('super_admin') && <AdminOverview fresh={fresh} subs={subs.length} />}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {nav.flatMap((m) => m.nav).map((n, i) => (
          <motion.div key={n.to} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.025, 0.3) }}>
            <Link to={n.to} className="group flex h-full items-center gap-4 rounded-2xl border border-basil-line bg-white p-4 text-basil-ink no-underline transition hover:-translate-y-0.5 hover:border-basil-soft hover:shadow-card">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: meta.accent }}><n.icon size={20} /></span>
              <b className="min-w-0 flex-1 truncate">{n.label}</b>
              {n.badge && <NavBadge get={n.badge} />}
              <ArrowRight size={16} className="text-basil-muted transition group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        ))}
      </div>

      {canEditWebsite && (
        <>
          <h2 className="mb-3 mt-8 text-base font-extrabold">Website</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Link to="/os/website" className="card flex items-center gap-4 p-5 text-basil-ink no-underline hover:shadow-card"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-basil text-white"><Globe2 /></span><span><b className="block">Website CMS</b><span className="text-sm text-basil-muted">Pages, photos, videos, news</span></span></Link>
            <Link to="/os/website/bookings" className="card flex items-center gap-4 p-5 text-basil-ink no-underline hover:shadow-card"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-basil-ice text-basil"><Inbox /></span><span><b className="block">{fresh} new bookings</b><span className="text-sm text-basil-muted">{bookings.length} in total</span></span></Link>
            <Link to="/os/website/subscribers" className="card flex items-center gap-4 p-5 text-basil-ink no-underline hover:shadow-card"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-basil-ice text-basil"><Users /></span><span><b className="block">{subs.length} subscribers</b><span className="text-sm text-basil-muted">Basil Health Brief</span></span></Link>
          </div>
        </>
      )}

      {others.length > 0 && (
        <>
          <h2 className="mb-1 mt-8 text-base font-extrabold">Your other portals</h2>
          <p className="m-0 mb-3 text-sm text-basil-muted">Each portal keeps its own menu. Switch any time from the top of the sidebar.</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {others.map((r) => {
              const m = portalMeta(r);
              return (
                <button key={r} type="button" onClick={() => switchTo(r)} className="flex items-center gap-3 rounded-2xl border border-basil-line bg-white p-3.5 text-left hover:border-basil-soft hover:shadow-card">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: m.accent }}><m.Icon size={18} /></span>
                  <span className="min-w-0"><b className="block truncate text-sm">{m.label}</b><span className="block truncate text-xs text-basil-muted">{PORTAL_BLURB[r]}</span></span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

/** Super Admin overview: live figures and the five things an admin opens most. */
function AdminOverview({ fresh, subs }: { fresh: number; subs: number }) {
  const [users, setUsers] = useState<number | null>(null);
  const [news, setNews] = useState<number | null>(null);
  useEffect(() => {
    supabase.rpc('admin_list_users').then(({ data }) => setUsers(Array.isArray(data) ? data.length : null));
    supabase.from('health_feed_items').select('id', { count: 'exact', head: true }).gte('published_at', new Date(Date.now() - 48 * 36e5).toISOString())
      .then(({ count }) => setNews(count ?? 0));
  }, []);
  const stats: [string, string | number, typeof Users][] = [
    ['People with accounts', users ?? '·', UserRound],
    ['New bookings', fresh, Inbox],
    ['Health Brief subscribers', subs, Users],
    ['News stories · 48 h', news ?? '·', Newspaper],
  ];
  const links: [string, string, string, typeof Users][] = [
    ['Website CMS', 'Pages, photos, partners, events', '/os/website', Globe2],
    ['Users & roles', 'Give or remove access', '/os/admin/users', ShieldCheck],
    ['Portal access', 'Project-only portals', '/os/admin/access', KeyRound],
    ['Phone app', 'Every portal on mobile', '/app', Smartphone],
    ['View website', 'basilmedia.vercel.app', '/', ArrowRight],
  ];
  return (
    <section className="mb-8 overflow-hidden rounded-[26px] bg-gradient-to-br from-basil-deep to-basil-night p-5 text-white sm:p-7">
      <div className="mb-4 flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-basil-haze"><ShieldCheck size={14} />SUPER ADMIN</div>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {stats.map(([label, value, Icon]) => (
          <div key={label} className="rounded-2xl bg-white/[0.08] p-4 ring-1 ring-white/10">
            <Icon size={18} className="text-basil-sky" />
            <b className="mt-2 block font-display text-3xl leading-none">{value}</b>
            <span className="mt-1 block text-[12.5px] text-basil-haze">{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        {links.map(([label, sub, to, Icon]) => {
          const cls = 'group flex items-center gap-3 rounded-2xl bg-white p-3.5 text-basil-ink no-underline transition hover:-translate-y-0.5 hover:text-basil-ink';
          const body = (<><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-basil-ice text-basil group-hover:bg-basil group-hover:text-white"><Icon size={18} /></span><span className="min-w-0"><b className="block truncate text-sm">{label}</b><span className="block truncate text-xs text-basil-muted">{sub}</span></span></>);
          return to.startsWith('/os') ? <Link key={label} to={to} className={cls}>{body}</Link> : <a key={label} href={to} className={cls}>{body}</a>;
        })}
      </div>
    </section>
  );
}
