// One person, several portals — each portal stays on its own (no single cluttered menu).
// Desktop: a portal picker at the top of the sidebar. Phone: tap the title in the header.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BadgeDollarSign, Briefcase, Building2, Car, Check, ChevronsUpDown, Crown, FolderKanban, Globe2, Handshake, Package, TrendingUp, User, BarChart3,
  type LucideIcon,
} from 'lucide-react';
import type { AppRole } from '@/lib/types';
import { PORTAL_BLURB } from '@/lib/roles';
import { useAuth } from '@/lib/auth';
import { useActing } from './lib/session';
import { useTable } from './lib/store';

export const PORTAL_META: Record<Exclude<AppRole, 'super_admin'>, { label: string; accent: string; Icon: LucideIcon }> = {
  boss: { label: 'Boss', accent: '#B8860B', Icon: Crown },
  gm_cfo: { label: 'GM/CFO', accent: '#0F6EC2', Icon: BarChart3 },
  finance: { label: 'Finance', accent: '#059669', Icon: BadgeDollarSign },
  account_manager: { label: 'Account Manager', accent: '#E8573F', Icon: Handshake },
  growth: { label: 'Growth', accent: '#E8573F', Icon: TrendingUp },
  receptionist: { label: 'Reception', accent: '#0D9488', Icon: Building2 },
  project_lead: { label: 'Project Lead', accent: '#0284C7', Icon: FolderKanban },
  staff: { label: 'Staff', accent: '#7C3AED', Icon: User },
  storekeeper: { label: 'Store', accent: '#D97706', Icon: Package },
  driver: { label: 'Driver', accent: '#475569', Icon: Car },
  client: { label: 'Client', accent: '#0F766E', Icon: Briefcase },
};
export const portalMeta = (r: AppRole) => PORTAL_META[r as Exclude<AppRole, 'super_admin'>] ?? PORTAL_META.staff;

/** "Project Lead · Wedding film" when the portal is limited to some projects. */
function useScopeLabel() {
  const { user } = useAuth();
  const { rows: projects } = useTable<{ id: string; name: string }>('projects');
  return (r: AppRole) => {
    const rows = (user?.access ?? []).filter((a) => a.role === r);
    if (!rows.length || rows.some((a) => !a.project_id)) return '';
    const names = rows.map((a) => projects.find((p) => p.id === a.project_id)?.name).filter(Boolean) as string[];
    return names.length === 1 ? names[0] : `${rows.length} projects`;
  };
}

interface Item { key: string; label: string; sub: string; accent: string; Icon: LucideIcon; active: boolean; onPick: () => void }

function useItems(onRole: (r: AppRole) => void, opts: { website?: { active: boolean; onPick: () => void } }) {
  const { role, roles } = useActing();
  const scopeLabel = useScopeLabel();
  const items: Item[] = roles.map((r) => {
    const m = portalMeta(r);
    const lim = scopeLabel(r);
    return { key: r, label: m.label, sub: lim ? `Only: ${lim}` : PORTAL_BLURB[r] ?? '', accent: m.accent, Icon: m.Icon, active: !opts.website?.active && r === role, onPick: () => onRole(r) };
  });
  if (opts.website) items.push({ key: 'website', label: 'Website CMS', sub: 'Pages, photos, videos and news', accent: '#0A2F5C', Icon: Globe2, active: opts.website.active, onPick: opts.website.onPick });
  return items;
}

function List({ items, onDone, dark }: { items: Item[]; onDone: () => void; dark?: boolean }) {
  return (
    <ul role="listbox" aria-label="Portals" className="m-0 flex list-none flex-col gap-1 p-0">
      {items.map((i) => (
        <li key={i.key}>
          <button
            type="button" role="option" aria-selected={i.active}
            onClick={() => (i.onPick(), onDone())}
            className={`flex min-h-[52px] w-full items-center gap-3 rounded-2xl border-0 px-2.5 py-2 text-left transition ${dark ? (i.active ? 'bg-white/[0.14]' : 'bg-transparent hover:bg-white/[0.07]') : i.active ? 'bg-basil-ice' : 'bg-transparent hover:bg-basil-mist'}`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: i.accent }}><i.Icon size={18} /></span>
            <span className="min-w-0 flex-1">
              <b className={`block truncate text-sm ${dark ? 'text-white' : 'text-basil-ink'}`}>{i.label}</b>
              <span className={`block truncate text-xs ${dark ? 'text-basil-haze' : 'text-basil-muted'}`}>{i.sub}</span>
            </span>
            {i.active && <Check size={18} className={dark ? 'text-basil-sky' : 'text-basil'} />}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Desktop sidebar: current portal + popover to switch. */
export function PortalMenu({ onRole, website }: { onRole: (r: AppRole) => void; website?: { active: boolean; onPick: () => void } }) {
  const { role } = useActing();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const items = useItems(onRole, { website });
  const scopeLabel = useScopeLabel();
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    addEventListener('mousedown', off);
    addEventListener('keydown', esc);
    return () => (removeEventListener('mousedown', off), removeEventListener('keydown', esc));
  }, [open]);
  const cur = website?.active ? items.find((i) => i.key === 'website')! : items.find((i) => i.key === role) ?? items[0];
  if (!cur) return null;
  const lim = !website?.active && scopeLabel(role);
  return (
    <div ref={ref} className="relative">
      <div className="mb-1.5 px-1 font-mono text-[10px] tracking-[0.18em] text-basil-haze/70">PORTAL</div>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.08] p-2.5 text-left text-white hover:bg-white/[0.12]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: cur.accent }}><cur.Icon size={20} /></span>
        <span className="min-w-0 flex-1"><b className="block truncate text-[15px]">{cur.label}</b><span className="block truncate text-xs text-basil-haze">{lim ? `Only: ${lim}` : items.length > 1 ? `${items.length} portals · switch` : 'Your portal'}</span></span>
        {items.length > 1 && <ChevronsUpDown size={16} className="text-basil-haze" />}
      </button>
      <AnimatePresence>
        {open && items.length > 1 && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.14 }} className="absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0B2547] p-1.5 shadow-[0_24px_50px_rgba(0,0,0,0.45)]">
            <List items={items} onDone={() => setOpen(false)} dark />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Phone: the list shown in a bottom sheet. */
export function PortalList({ onRole, onDone }: { onRole: (r: AppRole) => void; onDone: () => void }) {
  const items = useItems(onRole, {});
  return <List items={items} onDone={onDone} />;
}
