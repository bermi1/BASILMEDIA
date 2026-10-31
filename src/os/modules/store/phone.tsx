// Stable exports used by other roles' phone apps (MyGear, GearAlerts, TodayVisitors, RoomsBoard)
// plus the storekeeper's phone home and inventory screens.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Clock, PackageCheck, Users } from 'lucide-react';
import { usePeople, useTable } from '@/os/lib/store';
import { useActing } from '@/os/lib/session';
import { useToast } from '@/os/cms/toast';
import { Card, Field, Pill, Sheet, Tabs, inputCls } from '@/os/ui';
import { dayKey, fmtDateTime, fmtTime, fromLocalInput, isDueToday, isOverdue, lateText, toLocalInput, type Checkout, type Consumable, type Gear, type Visitor } from './data';
import { acknowledgeCheckouts, requestReturnHelp } from './actions';
import { EmptyBox, GearStatusPill, GearThumb, SearchBox, SectionHead, matchGear, nameOf, projectName, useCheckouts, useGear, useProjects } from './shared';
import { CheckinSheet, ConsumablesPanel } from './ops';
import { WhoHasIt } from './checkout';
import './seed';

export { RoomsBoard } from './reception';

/** Gear the acting user holds, with due-back time, overdue flag and "Return / need more time". */
export function MyGear() {
  const { userId } = useActing();
  const { rows: checkouts } = useTable<Checkout>('gear_checkouts', { eq: { holder_id: userId, status: 'out' }, order: 'due_at' });
  const { rows: gear } = useGear();
  const projects = useProjects();
  const toast = useToast();
  const [sheet, setSheet] = useState<Checkout | null>(null);
  const [mode, setMode] = useState<'return' | 'extend'>('extend');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const pending = checkouts.filter((c) => !c.acknowledged_at);
  const send = () => requestReturnHelp(sheet!.id, mode, mode === 'extend' ? to : null, reason)
    .then(() => (toast(mode === 'return' ? 'Storekeeper told you are bringing it back' : 'Request sent to the storekeeper'), setSheet(null), setReason('')))
    .catch((e) => toast((e as Error).message, 'error'));
  if (!checkouts.length) return <EmptyBox>You are not holding any gear.</EmptyBox>;
  return (
    <div className="flex flex-col gap-2">
      {pending.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm">
          <b>{pending.length} item{pending.length > 1 ? 's' : ''} waiting for your acknowledgement</b>
          <button type="button" className="btn-primary mt-2 w-full" onClick={() => acknowledgeCheckouts(pending.map((c) => c.id)).then(() => toast('Acknowledged · you are responsible until check-in'))}>I have received them</button>
        </div>
      )}
      {checkouts.map((c) => {
        const g = gear.find((x) => x.id === c.gear_id);
        if (!g) return null;
        const late = isOverdue(c);
        return (
          <div key={c.id} className={`min-w-0 rounded-2xl border bg-white p-3 ${late ? 'border-red-200' : 'border-basil-line'}`}>
            <div className="flex items-center gap-3">
              <GearThumb gear={g} />
              <span className="min-w-0 flex-1"><b className="block truncate">{g.name}</b><span className="block truncate text-xs text-basil-muted">{g.tag} · {projectName(projects, c.project_id)}</span></span>
              {late ? <Pill tone="red">{lateText(c.due_at)}</Pill> : <Pill tone={isDueToday(c) ? 'amber' : 'blue'}>{isDueToday(c) ? `Today ${fmtTime(c.due_at)}` : fmtDateTime(c.due_at)}</Pill>}
            </div>
            {c.extension_requested_to && <p className="m-0 mt-2 text-xs text-amber-800">Asked for more time until {fmtDateTime(c.extension_requested_to)} — waiting for the storekeeper.</p>}
            {c.return_requested_at && <p className="m-0 mt-2 text-xs text-basil-muted">Storekeeper knows you are bringing it back.</p>}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" className="btn-outline !min-h-[44px] !px-2 text-sm" onClick={() => (setSheet(c), setMode('return'))}>Return</button>
              <button type="button" className="btn-outline !min-h-[44px] !px-2 text-sm" onClick={() => (setSheet(c), setMode('extend'), setTo(new Date(new Date(c.due_at).getTime() + 864e5).toISOString()))}>Need more time</button>
            </div>
          </div>
        );
      })}
      <Sheet open={!!sheet} onClose={() => setSheet(null)} title={mode === 'return' ? 'Bringing it back' : 'Ask for more time'}>
        <div className="flex flex-col gap-3">
          {mode === 'extend' && <Field label="New return time"><input className={inputCls} type="datetime-local" value={to ? toLocalInput(to) : ''} onChange={(e) => e.target.value && setTo(fromLocalInput(e.target.value))} /></Field>}
          <Field label={mode === 'return' ? 'Note for the storekeeper (optional)' : 'Why?'}><textarea className={`${inputCls} h-20 py-2`} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <button type="button" className="btn-primary w-full" onClick={send}>{mode === 'return' ? 'Tell the storekeeper' : 'Send request'}</button>
        </div>
      </Sheet>
    </div>
  );
}

/** Overdue + low-stock summary card for Boss/GM homes. */
export function GearAlerts() {
  const { rows: checkouts } = useCheckouts();
  const { rows: gear } = useGear();
  const { rows: cons } = useTable<Consumable>('consumables');
  const people = usePeople();
  const overdue = checkouts.filter(isOverdue);
  const low = cons.filter((c) => c.quantity <= c.min_level);
  const repair = gear.filter((g) => g.status === 'in_repair' || g.status === 'out_of_service').length;
  return (
    <Card title="Media store" action={<Link to="/os/store" className="text-sm font-bold">Open</Link>}>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-red-50 p-2"><b className="block font-display text-xl text-red-700">{overdue.length}</b><span className="text-xs">Overdue</span></div>
        <div className="rounded-xl bg-amber-50 p-2"><b className="block font-display text-xl text-amber-700">{low.length}</b><span className="text-xs">Low stock</span></div>
        <div className="rounded-xl bg-basil-mist p-2"><b className="block font-display text-xl">{repair}</b><span className="text-xs">In repair</span></div>
      </div>
      <ul className="m-0 mt-3 flex list-none flex-col gap-1 p-0 text-sm">
        {overdue.slice(0, 4).map((c) => <li key={c.id} className="flex justify-between gap-2"><span className="truncate">{gear.find((g) => g.id === c.gear_id)?.name} · {nameOf(people, c.holder_id).split(' ')[0]}</span><b className="shrink-0 text-red-700">{lateText(c.due_at)}</b></li>)}
        {low.slice(0, 3).map((c) => <li key={c.id} className="flex justify-between gap-2"><span className="truncate">{c.name}</span><b className="shrink-0 text-amber-700">{c.quantity} left</b></li>)}
      </ul>
    </Card>
  );
}

/** Compact list of today's visitors for reception. */
export function TodayVisitors() {
  const { rows } = useTable<Visitor>('visitors', { order: 'created_at', ascending: false });
  const people = usePeople();
  const today = dayKey();
  const list = rows.filter((v) => (v.signed_in_at && dayKey(v.signed_in_at) === today) || (v.status === 'expected' && v.expected_at && dayKey(v.expected_at) === today));
  return (
    <Card title={<span className="flex items-center gap-2"><Users size={18} />Visitors today</span>}>
      {!list.length && <p className="m-0 text-sm text-basil-muted">No visitors today.</p>}
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
        {list.map((v) => <li key={v.id} className="flex items-center justify-between gap-2"><span className="min-w-0 truncate"><b>{v.name}</b> · {nameOf(people, v.host_id).split(' ')[0]}</span><Pill tone={v.status === 'in' ? 'green' : v.status === 'expected' ? 'amber' : 'grey'}>{v.status === 'in' ? 'In' : v.status === 'expected' ? fmtTime(v.expected_at) : 'Left'}</Pill></li>)}
      </ul>
    </Card>
  );
}

// ---------- storekeeper phone ----------
export function StorePhoneHome() {
  const [, setParams] = useSearchParams();
  const go = (tab: string) => setParams((p) => (p.set('tab', tab), p), { replace: true });
  const { rows: gear } = useGear();
  const { rows: checkouts } = useCheckouts();
  const { rows: cons } = useTable<Consumable>('consumables');
  const people = usePeople();
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Gear | null>(null);
  const open = checkouts.filter((c) => c.status === 'out');
  const overdue = open.filter(isOverdue);
  const dueToday = open.filter(isDueToday);
  const low = cons.filter((c) => c.quantity <= c.min_level);
  const count = (s: Gear['status']) => gear.filter((g) => g.status === s).length;
  const hits = q.trim() ? gear.filter((g) => matchGear(g, q)).slice(0, 6) : [];
  const checkout = found ? open.find((c) => c.gear_id === found.id) : undefined;
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl bg-gradient-to-br from-amber-600 to-amber-800 p-4 text-white">
        <span className="font-mono text-[11px] tracking-widest opacity-80">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Dar_es_Salaam' }).toUpperCase()}</span>
        <b className="mt-1 block font-display text-2xl">Habari, {nameOf(people, 'u-store').split(' ')[0] === '—' ? 'Juma' : nameOf(people, 'u-store').split(' ')[0]}</b>
        <span className="text-sm opacity-90">{gear.length} items tracked · Media store, Mikocheni</span>
        <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
          {([['In store', count('available')], ['Out', count('out')], ['Repair', count('in_repair')], ['Reserved', count('reserved')]] as const).map(([l, n]) => <div key={l} className="rounded-xl bg-white/15 py-2"><b className="block font-display text-xl">{n}</b><span className="text-[11px]">{l}</span></div>)}
        </div>
      </div>
      <div>
        <SearchBox value={q} onChange={(v) => (setQ(v), setFound(null))} placeholder="Scan or type tag / serial — e.g. CAM-001" />
        {hits.length > 0 && !found && <div className="mt-2 flex flex-col gap-1.5">{hits.map((g) => <button key={g.id} type="button" onClick={() => setFound(g)} className="flex min-h-[52px] items-center gap-3 rounded-2xl border border-basil-line bg-white p-2.5 text-left"><GearThumb gear={g} size={36} /><span className="min-w-0 flex-1 truncate text-sm"><b>{g.name}</b><br /><span className="text-xs text-basil-muted">{g.tag} · {g.serial}</span></span><GearStatusPill status={g.status} /></button>)}</div>}
        {found && (
          <div className="mt-2 rounded-2xl border border-amber-300 bg-white p-3">
            <div className="flex items-center gap-3"><GearThumb gear={found} size={48} /><span className="min-w-0 flex-1"><b className="block">{found.name}</b><span className="text-xs text-basil-muted">{found.tag} · {found.serial} · {found.location}</span></span><GearStatusPill status={found.status} /></div>
            {checkout && <p className="m-0 mt-2 text-sm">With <b>{nameOf(people, checkout.holder_id)}</b> · due {fmtDateTime(checkout.due_at)}{isOverdue(checkout) && <b className="text-red-700"> · {lateText(checkout.due_at)}</b>}</p>}
            <div className="mt-2 grid grid-cols-2 gap-2">
              {checkout ? <FoundCheckin c={checkout} g={found} /> : found.status === 'available' || found.status === 'reserved' ? <button type="button" className="btn-primary !px-2" onClick={() => go('checkout')}>Check out</button> : <span />}
              <Link to={`/os/store/asset/${found.id}`} className="btn-outline !px-2">Details</Link>
            </div>
          </div>
        )}
      </div>
      {overdue.length > 0 && (
        <section><SectionHead>Overdue · {overdue.length}</SectionHead>
          <div className="flex flex-col gap-2">{overdue.map((c) => { const g = gear.find((x) => x.id === c.gear_id); return g ? <button key={c.id} type="button" onClick={() => go('returns')} className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-red-200 bg-white p-3 text-left"><AlertTriangle size={20} className="shrink-0 text-red-600" /><span className="min-w-0 flex-1 truncate text-sm"><b>{g.name}</b><br /><span className="text-xs text-basil-muted">{nameOf(people, c.holder_id)}</span></span><Pill tone="red">{lateText(c.due_at)}</Pill></button> : null; })}</div>
        </section>
      )}
      <section><SectionHead>Due back today · {dueToday.length}</SectionHead>
        {dueToday.length ? <div className="flex flex-col gap-2">{dueToday.map((c) => { const g = gear.find((x) => x.id === c.gear_id); return <div key={c.id} className="flex min-h-[52px] items-center gap-3 rounded-2xl bg-white p-3 text-sm"><Clock size={18} className="text-amber-600" /><span className="flex-1 truncate"><b>{g?.name}</b> · {nameOf(people, c.holder_id).split(' ')[0]}</span><b>{fmtTime(c.due_at)}</b></div>; })}</div> : <EmptyBox>Nothing else due today.</EmptyBox>}
      </section>
      {low.length > 0 && (
        <section><SectionHead>Low consumables</SectionHead>
          <div className="flex flex-col gap-1.5">{low.map((c) => <div key={c.id} className="flex items-center justify-between rounded-2xl bg-white p-3 text-sm"><span>{c.name}</span><b className="text-red-700">{c.quantity} left · min {c.min_level}</b></div>)}</div>
        </section>
      )}
      <section><SectionHead>Out now · {open.length}</SectionHead><WhoHasIt /></section>
    </div>
  );
}

function FoundCheckin({ c, g }: { c: Checkout; g: Gear }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className="btn-primary !px-2" onClick={() => setOpen(true)}><PackageCheck size={16} />Check in</button><CheckinSheet open={open} onClose={() => setOpen(false)} checkout={c} gear={g} /></>;
}

export function InventoryPhone() {
  const { rows: gear } = useGear();
  const people = usePeople();
  const [tab, setTab] = useState<'gear' | 'consumables'>('gear');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const cats = [...new Set(gear.map((g) => g.category))];
  return (
    <div className="flex flex-col gap-3">
      <Tabs value={tab} onChange={setTab} items={[{ value: 'gear', label: 'Gear', count: gear.length }, { value: 'consumables', label: 'Consumables' }]} />
      {tab === 'consumables' ? <ConsumablesPanel compact /> : (
        <>
          <SearchBox value={q} onChange={setQ} />
          <div className="scrollbar-none flex gap-1.5 overflow-x-auto">{['', ...cats].map((c) => <button key={c || 'all'} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={`min-h-[40px] shrink-0 rounded-full px-3 text-sm font-semibold ${cat === c ? 'border-0 bg-amber-600 text-white' : 'border border-basil-edge bg-white'}`}>{c || 'All'}</button>)}</div>
          {gear.filter((g) => matchGear(g, q) && (!cat || g.category === cat)).map((g) => (
            <Link key={g.id} to={`/os/store/asset/${g.id}`} className="flex min-h-[60px] items-center gap-3 rounded-2xl border border-basil-line bg-white p-3 text-basil-ink no-underline">
              <GearThumb gear={g} />
              <span className="min-w-0 flex-1"><b className="block truncate">{g.name}</b><span className="block truncate text-xs text-basil-muted">{g.tag} · {g.holder_id ? nameOf(people, g.holder_id) : g.location}</span></span>
              <GearStatusPill status={g.status} />
            </Link>
          ))}
        </>
      )}
    </div>
  );
}

