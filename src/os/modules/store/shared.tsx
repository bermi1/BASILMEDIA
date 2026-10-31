// Small UI pieces shared by the store, reception and transport screens (desktop and phone).
import type { ReactNode } from 'react';
import { Aperture, Battery, Camera, CircleDot, HardDrive, Laptop, Lightbulb, Lock, Mic, Monitor, Move3d, Package, Plane, Radio, Search, Triangle, Wrench } from 'lucide-react';
import type { AppRole } from '@/lib/types';
import { useActing } from '@/os/lib/session';
import { usePeople, useTable, type Person } from '@/os/lib/store';
import { Empty, Pill, inputCls } from '@/os/ui';
import { GEAR_STATUS, type Checkout, type Gear, type ProjectRef } from './data';

export const STORE_ROLES: AppRole[] = ['storekeeper', 'gm_cfo', 'boss'];
export const RECEPTION_ROLES: AppRole[] = ['receptionist', 'gm_cfo', 'boss'];
export const TRANSPORT_ROLES: AppRole[] = ['driver', 'gm_cfo', 'boss'];

export function Guard({ roles, children }: { roles: AppRole[]; children: ReactNode }) {
  const { canAny } = useActing();
  if (!canAny(...roles)) return <Empty icon={<Lock size={24} />} title="No access" sub="This area is for the operations team. Ask the Super Admin if you need access." />;
  return <>{children}</>;
}

export const useGear = () => useTable<Gear>('gear_items', { order: 'tag' });
export const useCheckouts = () => useTable<Checkout>('gear_checkouts', { order: 'out_at', ascending: false });
export const useProjects = () => useTable<ProjectRef>('projects', { order: 'name' }).rows;

export function nameOf(people: Person[], id?: string | null) {
  return people.find((p) => p.id === id)?.full_name ?? '—';
}
export function firstName(people: Person[], id?: string | null) {
  return nameOf(people, id).split(' ')[0];
}
export const projectName = (projects: ProjectRef[], id?: string | null) => (id ? projects.find((p) => p.id === id)?.name ?? '—' : 'No project');

export function GearStatusPill({ status }: { status: Gear['status'] }) {
  const s = GEAR_STATUS[status] ?? GEAR_STATUS.available;
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

const ICONS: Record<string, typeof Camera> = {
  Camera, Lens: Aperture, Light: Lightbulb, Audio: Mic, Drone: Plane, Gimbal: Move3d, Laptop, Drive: HardDrive, Tripod: Triangle, Monitor, Power: Battery, Streaming: Radio, Grip: Wrench,
};
export function GearIcon({ category, size = 20 }: { category: string; size?: number }) {
  const I = ICONS[category] ?? CircleDot;
  return <I size={size} />;
}
export function GearThumb({ gear, size = 44 }: { gear: Pick<Gear, 'photo_url' | 'category' | 'name'>; size?: number }) {
  return gear.photo_url ? (
    <img src={gear.photo_url} alt="" className="shrink-0 rounded-xl object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700" style={{ width: size, height: size }} aria-hidden>
      <GearIcon category={gear.category} size={Math.round(size * 0.45)} />
    </span>
  );
}

export function PersonSelect({ value, onChange, label = 'Choose person', filter }: { value: string; onChange: (v: string) => void; label?: string; filter?: (p: Person) => boolean }) {
  const people = usePeople().filter((p) => !p.roles.includes('client')).filter(filter ?? (() => true));
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">{label}…</option>
      {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
    </select>
  );
}
export function ProjectSelect({ value, onChange, optional = true }: { value: string; onChange: (v: string) => void; optional?: boolean }) {
  const projects = useProjects();
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Project">
      <option value="">{optional ? 'No project (internal)' : 'Choose project…'}</option>
      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Search tag, serial or name' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="relative block">
      <span className="sr-only">{placeholder}</span>
      <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-basil-muted" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${inputCls} pl-10`} />
    </label>
  );
}
export const matchGear = (g: Gear, q: string) => {
  const s = q.trim().toLowerCase();
  return !s || [g.tag, g.name, g.serial, g.make, g.model, g.category, g.location].some((x) => (x ?? '').toLowerCase().includes(s));
};

/** Condition photo: paste a link (camera roll upload attaches later); preview if it loads. */
export function PhotoField({ value, onChange, label = 'Condition photo (link)' }: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <div className="flex flex-col gap-1.5 text-sm font-bold text-[#33465F]">
      <label htmlFor={`ph-${label}`}>{label}</label>
      <div className="flex items-center gap-2">
        <input id={`ph-${label}`} className={inputCls} type="url" inputMode="url" placeholder="https://… photo of all sides" value={value} onChange={(e) => onChange(e.target.value)} />
        {value ? <img src={value} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-basil-line" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-basil-mist text-basil-muted"><Camera size={18} /></span>}
      </div>
      <span className="text-xs font-normal text-basil-muted">Photos protect the crew if anything is damaged.</span>
    </div>
  );
}

export function SectionHead({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="mb-2 mt-1 flex items-center justify-between gap-2"><h2 className="m-0 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-basil-muted">{children}</h2>{action}</div>;
}
export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-pressed={on} onClick={onClick} className={`min-h-[44px] rounded-xl px-3 text-sm font-bold ${on ? 'border-0 bg-amber-600 text-white' : 'border border-basil-edge bg-white text-basil-deep'}`}>{children}</button>;
}
export function EmptyBox({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-basil-edge bg-white px-4 py-6 text-center text-sm text-basil-muted">{children}</div>;
}
export { Package };
