// Retainer programme (Account Manager side): retainers, allowances, year calendar, shoot status, requests, concerns, health.
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CalendarDays, CalendarPlus, LifeBuoy, MapPin, Phone, Plus, Repeat, SlidersHorizontal, Star } from 'lucide-react';
import { isDemo } from '@/lib/supabase';
import { useActing } from '@/os/lib/session';
import { demoTable, fetchRows, insertRow, newId, nowIso, rpc, updateRow, usePeople, useTable, type Person } from '@/os/lib/store';
import { notify } from '@/os/lib/notify';
import { useToast } from '@/os/cms/toast';
import { Avatar, Card, Empty, Field, Pill, Progress, Sheet, StageTracker, Stat, Tabs, inputCls, tsh, tshShort, type Tone } from '@/os/ui';
import {
  MONTHS, REQUEST_STATUS, SHOOT_STATUS, TIERS, UNITS, balanceFor, isoPlus, clientHealth, daysBetween, dayLabel, dmy, monthKey, monthLabel, overallUse, renewalBand, todayIso,
  type Balance, type CalItem, type ClientRequest, type Concern, type LedgerRow, type Retainer, type UnitKey,
} from './lib';
import { GoLink, PageHead, Ring, useClients } from './kit';

export function useRetainerData(clientId?: string | null) {
  const q = clientId ? { eq: { client_id: clientId } } : {};
  const retainers = useTable<Retainer>('retainers', q).rows;
  const ledger = useTable<LedgerRow>('allowance_ledger', q).rows;
  const items = useTable<CalItem>('retainer_calendar', { ...q, order: 'date' }).rows;
  const requests = useTable<ClientRequest>('client_requests', { ...q, order: 'created_at', ascending: false }).rows;
  const concerns = useTable<Concern>('client_concerns', { ...q, order: 'created_at', ascending: false }).rows;
  const balance = (r: Retainer, m = monthKey()) => balanceFor(r, ledger, m);
  const health = (r: Retainer) => clientHealth(r, { balance: balance(r), concerns, items, requests });
  return { retainers, ledger, items, requests, concerns, balance, health };
}

export function AllowanceRings({ balance, size = 70 }: { balance: Balance[]; size?: number }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
      {balance.map((b) => <Ring key={b.unit} value={b.used} max={b.allowance + b.carried} size={size} label={b.label} sub={`${b.used} of ${b.allowance + b.carried}${b.carried ? ` (+${b.carried} rolled)` : ''}`} />)}
    </div>
  );
}

const STONE: Record<string, Tone> = { Scheduled: 'grey', 'Crew confirmed': 'blue', 'On the way': 'amber', Arrived: 'amber', 'In progress': 'amber', Wrapped: 'gold', Completed: 'green' };
export const shootPill = (s: string) => <Pill tone={STONE[s] ?? 'blue'}>{s}</Pill>;

/** Notify every portal user of a client company. `always` = also with Supabase (no SQL trigger covers it). */
export async function notifyClient(clientId: string, title: string, body: string, link: string, always = false) {
  if (!isDemo && !always) return;
  const users = await fetchRows<{ user_id: string }>('client_users', { eq: { client_id: clientId } }).catch(() => []);
  for (const u of users) await notify(u.user_id, title, body, link, 'info');
}

/** "Who is coming" — crew, call time, map, checklist and live status. */
export function WhoIsComing({ item, people, onToggleCheck, children }: { item: CalItem; people: Person[]; onToggleCheck?: (i: number) => void; children?: React.ReactNode }) {
  const idx = SHOOT_STATUS.indexOf(item.status as never);
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-basil-line bg-white p-4">
      <div className="flex items-start justify-between gap-2"><span><b className="block">{item.title}</b><span className="text-sm text-basil-muted">{dayLabel(item.date)} · {item.time} · {item.location}</span></span>{shootPill(item.status)}</div>
      <StageTracker stages={[...SHOOT_STATUS]} current={Math.max(0, idx)} />
      <h3 className="m-0 text-sm font-extrabold">Who is coming</h3>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {item.crew.map((c) => {
          const p = people.find((x) => x.id === c.user_id);
          return (
            <li key={c.user_id} className="flex items-center gap-3">
              <Avatar name={p?.full_name ?? c.role} size={40} />
              <span className="min-w-0 flex-1 text-sm"><b className="block">{p?.full_name ?? '—'}</b><span className="text-basil-muted">{c.role}</span></span>
              {p?.phone && <a href={`tel:${p.phone}`} aria-label={`Call ${p.full_name}`} className="flex h-11 w-11 items-center justify-center rounded-full bg-basil-ice text-basil"><Phone size={18} /></a>}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3 text-sm"><span><b>Call time</b> {item.call_time || '—'}</span>{item.map_url && <a href={item.map_url} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center font-bold"><MapPin size={14} className="mr-1 inline" />Open map</a>}</div>
      {item.checklist.length > 0 && (
        <div>
          <h3 className="m-0 mb-1 text-sm font-extrabold">Your checklist</h3>
          {item.checklist.map((c, i) => (
            <label key={i} className="flex min-h-[40px] items-center gap-2 text-sm"><input type="checkbox" checked={c.done} disabled={!onToggleCheck} onChange={() => onToggleCheck?.(i)} />{c.label}</label>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

const KIND_DOT: Record<CalItem['kind'], string> = { shoot: 'bg-basil', podcast: 'bg-violet-500', delivery: 'bg-emerald-500', review: 'bg-amber-500', post: 'bg-[#E8573F]' };
export const KIND_LABEL: Record<CalItem['kind'], string> = { shoot: 'Shoot', podcast: 'Podcast', delivery: 'Delivery', review: 'Review', post: 'Post' };

/** 12-month overview + list for the chosen month. */
export function YearCalendar({ items, onPick }: { items: CalItem[]; onPick?: (i: CalItem) => void }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(monthKey());
  const yearItems = items.filter((i) => i.date.startsWith(String(year)));
  const monthItems = items.filter((i) => i.date.startsWith(month));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button type="button" className="btn-outline min-h-[44px]" onClick={() => setYear(year - 1)} aria-label="Previous year">‹</button>
        <b className="font-display text-lg">{year}</b>
        <button type="button" className="btn-outline min-h-[44px]" onClick={() => setYear(year + 1)} aria-label="Next year">›</button>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {MONTHS.map((m, i) => {
          const key = `${year}-${String(i + 1).padStart(2, '0')}`;
          const its = yearItems.filter((x) => x.date.startsWith(key));
          const shoots = its.filter((x) => x.kind === 'shoot' || x.kind === 'podcast').length;
          return (
            <button key={m} type="button" onClick={() => setMonth(key)} aria-pressed={month === key} className={`flex min-h-[64px] flex-col items-start gap-1 rounded-xl border p-2 text-left ${month === key ? 'border-basil bg-basil-ice' : key === monthKey() ? 'border-basil-soft bg-white' : 'border-basil-line bg-white'} ${its.length === 0 ? 'opacity-50' : ''}`}>
              <b className="text-xs">{m.slice(0, 3)}</b>
              <span className="flex flex-wrap gap-0.5">{its.slice(0, 14).map((x) => <span key={x.id} className={`h-1.5 w-1.5 rounded-full ${KIND_DOT[x.kind]}`} />)}</span>
              <span className="text-[10px] text-basil-muted">{shoots} shoots · {its.length} items</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-basil-muted">{(Object.keys(KIND_DOT) as CalItem['kind'][]).map((k) => <span key={k} className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${KIND_DOT[k]}`} />{KIND_LABEL[k]}</span>)}</div>
      <h3 className="m-0 text-base font-extrabold">{monthLabel(month)}</h3>
      {monthItems.length === 0 && <Empty title="Nothing planned this month" />}
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {monthItems.map((i) => (
          <li key={i.id}>
            <button type="button" onClick={() => onPick?.(i)} className="flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-basil-line bg-white px-3 py-2 text-left">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${KIND_DOT[i.kind]}`} />
              <span className="w-20 shrink-0 text-xs text-basil-muted">{dayLabel(i.date)}</span>
              <span className="min-w-0 flex-1 text-sm"><b className="block truncate">{i.title}</b><span className="text-xs text-basil-muted">{KIND_LABEL[i.kind]}{i.time && i.kind !== 'post' ? ` · ${i.time}` : ''}</span></span>
              {(i.kind === 'shoot' || i.kind === 'podcast') && shootPill(i.signoff?.outcome === 'issue' ? 'Issue reported' : i.status)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Advance a shoot's live status (crew / AM). Clients get notified at key moments. */
export async function setShootStatus(item: CalItem, status: string) {
  await rpc('set_shoot_status', { _item: item.id, _status: status }, () => {
    const r = demoTable('retainer_calendar').find((x) => x.id === item.id);
    if (!r) throw new Error('Not found');
    r.status = status;
  });
  if (['On the way', 'Arrived', 'Wrapped'].includes(status)) await notifyClient(item.client_id, `Crew ${status.toLowerCase()}`, `${item.title} · ${item.time}`, '/app?tab=home');
}

/** Client sign-off: confirm completed (consumes allowance) or report an issue, with a 1–5 star rating. */
export async function signOffShoot(item: CalItem, outcome: 'completed' | 'issue', rating: number, comment: string, userId: string) {
  await rpc('client_signoff_shoot', { _item: item.id, _completed: outcome === 'completed', _rating: rating, _comment: comment }, () => {
    const r = demoTable('retainer_calendar').find((x) => x.id === item.id);
    if (!r) throw new Error('Not found');
    if (r.signoff) throw new Error('Already signed off');
    if (rating < 1 || rating > 5) throw new Error('Choose 1–5 stars');
    r.signoff = { outcome, rating, comment, at: nowIso(), by: userId };
    r.status = 'Completed';
    for (const [unit, qty] of Object.entries(item.units) as [UnitKey, number][]) {
      demoTable('allowance_ledger').push({ id: newId(), retainer_id: item.retainer_id, client_id: item.client_id, month: monthKey(item.date), unit, qty, kind: 'usage', source_id: item.id, note: `Signed off: ${item.title}`, created_at: nowIso() });
    }
  });
  if (isDemo) await notify(String(demoTable('retainers').find((x) => x.id === item.retainer_id)?.account_manager_id ?? 'u-growth'), outcome === 'issue' ? 'Client reported an issue' : 'Shoot signed off', `${item.title} · ${'★'.repeat(rating)}${comment ? ` · ${comment}` : ''}`, `/os/retainers/${item.retainer_id}`, outcome === 'issue' ? 'alert' : 'info');
}

export function RetainersList({ compact = false }: { compact?: boolean }) {
  const { retainers, health, balance } = useRetainerData();
  const clients = useClients();
  const [adding, setAdding] = useState(false);
  const name = (id: string) => clients.find((c) => c.id === id)?.name ?? id;
  return (
    <div className="flex flex-col gap-3">
      {compact && <button type="button" className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} />New retainer</button>}
      <RetainerForm open={adding} onClose={() => setAdding(false)} />
      {retainers.map((r) => {
        const h = health(r), b = balance(r), band = renewalBand(r.end_date), use = overallUse(b);
        return (
          <GoLink key={r.id} to={`/os/retainers/${r.id}`} className="flex flex-col gap-2 rounded-2xl border border-basil-line bg-white p-4 text-basil-ink no-underline">
            <span className="flex flex-wrap items-start justify-between gap-2"><b>{name(r.client_id)}</b><span className="flex gap-1.5"><Pill tone="gold">{r.tier}</Pill><Pill tone={h.tone}>Health {h.score}</Pill></span></span>
            <span className="text-sm text-basil-muted">{tsh(r.monthly_fee)}/month · {dmy(r.start_date)} – {dmy(r.end_date)}</span>
            <div className="flex items-center gap-3 text-sm"><span className="shrink-0">This month <b>{use}%</b> used</span><Progress value={use} max={100} /></div>
            {band && <span className="flex items-center gap-1 text-sm font-bold text-amber-800"><AlertTriangle size={14} />Renewal in {daysBetween(r.end_date)} days ({band}-day alert)</span>}
            {!compact && h.reasons.length > 0 && <span className="text-xs text-basil-muted">{h.reasons.join(' · ')}</span>}
          </GoLink>
        );
      })}
      {retainers.length === 0 && <Empty icon={<Repeat />} title="No retainers yet" sub="Create one when a client signs a monthly agreement." />}
    </div>
  );
}

export function RetainersPage() {
  const { retainers, requests, concerns, health } = useRetainerData();
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <PageHead tag="CLIENTS · RETAINERS" title="Retainer programme" sub="Allowances, year calendars, shoot sign-offs, requests and client health.">
        <div className="flex flex-wrap gap-2"><GoLink to="/os/retainers/requests" className="btn-outline">Request board</GoLink><GoLink to="/os/retainers/concerns" className="btn-outline">Concerns</GoLink><button type="button" className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} />New retainer</button></div>
      </PageHead>
      <RetainerForm open={adding} onClose={() => setAdding(false)} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Retainers" value={retainers.length} sub={tshShort(retainers.reduce((s, r) => s + r.monthly_fee, 0)) + ' / month'} />
        <Stat label="At risk" value={retainers.filter((r) => health(r).tone !== 'green').length} tone="amber" />
        <Stat label="Open requests" value={requests.filter((q) => ['New', 'Reviewing', 'Quote needed'].includes(q.status)).length} />
        <Stat label="Open concerns" value={concerns.filter((c) => c.status !== 'Resolved').length} tone={concerns.some((c) => c.status !== 'Resolved') ? 'red' : 'green'} />
      </div>
      <RetainersList />
    </div>
  );
}

export function RetainerDetail({ id: idArg }: { id?: string } = {}) {
  const params = useParams();
  const id = idArg ?? params.id;
  const { retainers, items, ledger, balance, health, requests } = useRetainerData();
  const [visit, setVisit] = useState(false);
  const [usage, setUsage] = useState(false);
  const [editing, setEditing] = useState(false);
  const r = retainers.find((x) => x.id === id);
  const clients = useClients();
  const people = usePeople();
  const toast = useToast();
  const [pick, setPick] = useState<CalItem | null>(null);
  const [tab, setTab] = useState<'calendar' | 'ledger'>('calendar');
  if (!r) return <Empty title="Retainer not found" />;
  const its = items.filter((i) => i.retainer_id === r.id);
  const b = balance(r), h = health(r);
  const cur = pick ? its.find((i) => i.id === pick.id) ?? pick : null;
  const advance = async (s: string) => {
    try {
      await setShootStatus(cur!, s);
      toast(`Status: ${s}`);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <div>
      <PageHead tag={`RETAINER · ${r.number}`} title={clients.find((c) => c.id === r.client_id)?.name ?? r.client_id} sub={`${r.tier} tier · ${tsh(r.monthly_fee)}/month · ${dmy(r.start_date)} – ${dmy(r.end_date)} · rollover ${r.rollover === 'none' ? 'none (unused expires monthly)' : `next month, up to ${r.rollover_cap_pct}%`}`}>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button type="button" className="btn-primary" onClick={() => setVisit(true)}><CalendarPlus size={16} />Schedule visit</button>
          <button type="button" className="btn-outline" onClick={() => setUsage(true)}><SlidersHorizontal size={16} />Log usage</button>
          <button type="button" className="btn-outline col-span-2 sm:col-span-1" onClick={() => setEditing(true)}>Edit retainer</button>
        </div>
      </PageHead>
      <RetainerForm open={editing} onClose={() => setEditing(false)} retainer={r} />
      <VisitForm open={visit} onClose={() => setVisit(false)} retainer={r} />
      <UsageForm open={usage} onClose={() => setUsage(false)} retainer={r} />
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4">
          <Card title={`Allowance · ${monthLabel(monthKey())}`}><AllowanceRings balance={b} /></Card>
          <Card title={<Tabs value={tab} onChange={setTab} items={[{ value: 'calendar', label: 'Year calendar' }, { value: 'ledger', label: 'Allowance ledger' }]} />}>
            {tab === 'calendar' ? <YearCalendar items={its} onPick={setPick} /> : (
              <ul className="m-0 flex list-none flex-col p-0 text-sm">
                {ledger.filter((l) => l.retainer_id === r.id).sort((a, z) => z.month.localeCompare(a.month) || String(z.created_at).localeCompare(String(a.created_at))).slice(0, 60).map((l) => (
                  <li key={l.id} className="flex items-center gap-3 border-t border-basil-line py-2 first:border-t-0">
                    <span className="flex h-10 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-basil-ice text-[11px] font-bold leading-tight text-basil-deep">{MONTHS[Number(l.month.slice(5, 7)) - 1].slice(0, 3)}<span className="font-normal">{l.month.slice(0, 4)}</span></span>
                    <span className="min-w-0 flex-1"><b className="block">{UNITS.find((u) => u.key === l.unit)?.label ?? l.unit}</b><span className="block truncate text-xs text-basil-muted">{l.kind === 'adjustment' ? 'Adjustment · ' : ''}{l.note || '—'}</span></span>
                    <b className={Number(l.qty) < 0 ? 'text-emerald-700' : ''}>{Number(l.qty) > 0 ? '−' : '+'}{Math.abs(Number(l.qty))}</b>
                  </li>
                ))}
                {!ledger.some((l) => l.retainer_id === r.id) && <li className="text-basil-muted">No usage logged yet.</li>}
              </ul>
            )}
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card title="Client health"><div className="mb-2"><Pill tone={h.tone}>{h.tone.toUpperCase()} · {h.score}/100</Pill></div>{h.reasons.length ? <ul className="m-0 pl-5 text-sm">{h.reasons.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="m-0 text-sm text-basil-muted">All good.</p>}</Card>
          <Card title="Requests"><ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">{requests.filter((q) => q.retainer_id === r.id).slice(0, 6).map((q) => <li key={q.id} className="flex justify-between gap-2"><span>{q.title}</span><Pill tone={q.status === 'Declined' ? 'red' : q.status === 'Scheduled' ? 'green' : 'amber'}>{q.status}</Pill></li>)}{!requests.some((q) => q.retainer_id === r.id) && <li className="text-basil-muted">No requests yet.</li>}</ul><GoLink to="/os/retainers/requests" className="mt-1 inline-flex min-h-[44px] items-center text-sm font-bold">Request board →</GoLink></Card>
          <Card title="Notes"><p className="m-0 text-sm">{r.notes || '—'}</p></Card>
        </div>
      </div>
      <Sheet open={!!cur} onClose={() => setPick(null)} title={cur ? `${KIND_LABEL[cur.kind]} · ${dmy(cur.date)}` : ''}>
        {cur && (cur.kind === 'shoot' || cur.kind === 'podcast') ? (
          <WhoIsComing item={cur} people={people}>
            {cur.signoff ? <p className="m-0 text-sm">Client sign-off: <b>{cur.signoff.outcome === 'issue' ? 'Issue reported' : 'Confirmed'}</b> · {'★'.repeat(cur.signoff.rating)} {cur.signoff.comment}</p> : (
              <div className="flex flex-wrap gap-2">{SHOOT_STATUS.filter((s) => s !== 'Completed' && s !== cur.status).map((s) => <button key={s} type="button" className="btn-outline min-h-[44px]" onClick={() => advance(s)}>{s}</button>)}</div>
            )}
          </WhoIsComing>
        ) : cur && <div className="flex flex-col gap-1 text-sm"><b>{cur.title}</b><span className="text-basil-muted">{dayLabel(cur.date)}{cur.time ? ` · ${cur.time}` : ''} · {cur.status}</span>{cur.location && <span>{cur.location}</span>}{cur.gallery_slug && <a href={`/g/${cur.gallery_slug}`} className="inline-flex min-h-[44px] items-center font-bold">Gallery →</a>}{cur.link && <a href={cur.link} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center font-bold">Open link →</a>}</div>}
      </Sheet>
    </div>
  );
}

/** Account Manager request board: New → Reviewing → Quote needed → Scheduled → Declined. */
export function RequestBoard({ compact = false }: { compact?: boolean }) {
  const { requests, retainers, balance } = useRetainerData();
  const clients = useClients();
  const toast = useToast();
  const [col, setCol] = useState<ClientRequest['status']>('New');
  const [open, setOpen] = useState<ClientRequest | null>(null);
  const [date, setDate] = useState('');
  const [quote, setQuote] = useState('');
  const [note, setNote] = useState('');
  const move = async (q: ClientRequest, status: ClientRequest['status']) => {
    try {
      let itemId: string | null = null;
      if (status === 'Scheduled') {
        const day = date || q.preferred_dates[0];
        if (!day) throw new Error('Choose a date');
        if (q.over_allowance && q.quote_status !== 'accepted') throw new Error('Over allowance — the client must accept the quote first');
        const it = await insertRow<CalItem>('retainer_calendar', { retainer_id: q.retainer_id, client_id: q.client_id, date: day, time: '09:00', kind: q.type === 'podcast' ? 'podcast' : q.type === 'shoot' ? 'shoot' : 'delivery', title: q.title, location: q.location, map_url: q.location ? `https://maps.google.com/?q=${encodeURIComponent(q.location)}` : '', status: 'Scheduled', crew: q.type === 'shoot' ? [{ user_id: 'u-jonathan', role: 'Lead camera' }, { user_id: 'u-benedicto', role: 'Photographer' }] : [], call_time: q.type === 'shoot' ? '08:00' : '', checklist: [], units: q.units, signoff: null, gallery_slug: '', link: '' });
        itemId = it.id;
      }
      await rpc('set_request_status', { _id: q.id, _status: status, _quote: quote ? Number(quote) : null, _note: note || null }, () => {
        const r = demoTable('client_requests').find((x) => x.id === q.id)!;
        Object.assign(r, { status, note: note || r.note, ...(quote ? { quote_amount: Number(quote), quote_status: 'sent' } : {}), ...(itemId ? { scheduled_item_id: itemId } : {}) });
      });
      await notifyClient(q.client_id, `Request ${status.toLowerCase()}`, q.title, '/app?tab=requests');
      toast(`Moved to ${status}`);
      setOpen(null);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const card = (q: ClientRequest) => (
    <button key={q.id} type="button" onClick={() => (setOpen(q), setDate(q.preferred_dates[0] ?? ''), setQuote(q.quote_amount ? String(q.quote_amount) : ''), setNote(q.note))} className="flex w-full flex-col gap-1 rounded-2xl border border-basil-line bg-white p-3 text-left">
      <b className="text-sm">{q.title}</b>
      <span className="text-xs text-basil-muted">{clients.find((c) => c.id === q.client_id)?.name} · {q.number} · {q.urgency}</span>
      <span className="text-xs">{q.preferred_dates.map(dmy).join(', ')}</span>
      {q.over_allowance && <span><Pill tone={q.quote_status === 'accepted' ? 'green' : 'amber'}>Over allowance · {tshShort(q.quote_amount)}{q.quote_status === 'accepted' ? ' · accepted' : ''}</Pill></span>}
    </button>
  );
  const r = open ? retainers.find((x) => x.id === open.retainer_id) : null;
  return (
    <div className="flex flex-col gap-3">
      {compact ? (
        <>
          <Tabs value={col} onChange={setCol} items={REQUEST_STATUS.map((s) => ({ value: s, label: s, count: requests.filter((q) => q.status === s).length }))} />
          {requests.filter((q) => q.status === col).map(card)}
          {!requests.some((q) => q.status === col) && <Empty title={`Nothing in ${col}`} />}
        </>
      ) : (
        <div className="scrollbar-none flex gap-3 overflow-x-auto pb-2">
          {REQUEST_STATUS.map((s) => (
            <div key={s} className="flex w-[250px] shrink-0 flex-col gap-2 rounded-2xl bg-basil-mist/60 p-2">
              <div className="px-1 text-sm font-extrabold">{s} <span className="text-basil-muted">{requests.filter((q) => q.status === s).length}</span></div>
              {requests.filter((q) => q.status === s).map(card)}
            </div>
          ))}
        </div>
      )}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.title ?? ''}>
        {open && (
          <div className="flex flex-col gap-3 text-sm">
            <StageTracker stages={['New', 'Reviewing', 'Quote needed', 'Scheduled']} current={open.status === 'Declined' ? 3 : REQUEST_STATUS.indexOf(open.status)} rejected={open.status === 'Declined'} />
            <p className="m-0">{open.deliverables} · {open.location || 'Location TBC'} · urgency {open.urgency}</p>
            <p className="m-0 text-basil-muted">Preferred: {open.preferred_dates.map(dmy).join(', ')}</p>
            {r && <p className="m-0">Balance this month: {balance(r).map((b) => `${b.label} ${b.left}`).join(' · ')}</p>}
            <Field label="Schedule on"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Extra-charge quote (TSH)" hint="Only when over allowance."><input className={inputCls} inputMode="numeric" value={quote} onChange={(e) => setQuote(e.target.value.replace(/\D/g, ''))} /></Field>
            <Field label="Note to client"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            <div className="flex flex-wrap gap-2">{REQUEST_STATUS.filter((s) => s !== open.status).map((s) => <button key={s} type="button" className={s === 'Scheduled' ? 'btn-primary min-h-[44px]' : 'btn-outline min-h-[44px]'} onClick={() => move(open, s)}>{s}</button>)}</div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
export const RequestBoardPage = () => (<div><PageHead tag="CLIENTS · REQUESTS" title="Client request board" sub="Requests from retainer clients. Over-allowance requests return to the client as an extra-charge quote." /><RequestBoard /></div>);

export function ConcernsBoard() {
  const { concerns } = useRetainerData();
  const clients = useClients();
  const toast = useToast();
  const [resp, setResp] = useState<Record<string, string>>({});
  const [show, setShow] = useState<'open' | 'resolved'>('open');
  const set = async (c: Concern, status: Concern['status']) => {
    try {
      const response = (resp[c.id] ?? c.response).trim();
      if (status === 'Resolved' && !response) throw new Error('Write a response to the client before resolving');
      await updateRow('client_concerns', c.id, { status, response });
      await notifyClient(c.client_id, `Your concern: ${status}`, `${c.subject}${response ? ` — ${response}` : ''}`, '/app?tab=more', true);
      toast(`Marked ${status}`);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const list = concerns.filter((c) => (show === 'open' ? c.status !== 'Resolved' : c.status === 'Resolved'));
  return (
    <div>
      <PageHead tag="CLIENTS · CONCERNS" title="Raised concerns" sub="Tickets clients raised from their portal. Answer, then resolve." />
      <div className="mb-3"><Tabs value={show} onChange={setShow} items={[{ value: 'open', label: 'Open', count: concerns.filter((c) => c.status !== 'Resolved').length }, { value: 'resolved', label: 'Resolved', count: concerns.filter((c) => c.status === 'Resolved').length }]} /></div>
      <div className="flex flex-col gap-3">
        {list.map((c) => (
          <Card key={c.id} title={c.subject} action={<Pill tone={c.status === 'Resolved' ? 'green' : c.severity === 'High' ? 'red' : 'amber'}>{c.status} · {c.severity}</Pill>}>
            <p className="m-0 text-sm text-basil-muted">{clients.find((x) => x.id === c.client_id)?.name} · {dmy(c.created_at)}</p>
            <p className="m-0 mt-1 text-sm">{c.body}</p>
            <div className="mt-3"><Field label="Response to the client"><textarea className={`${inputCls} h-20 py-2`} value={resp[c.id] ?? c.response} onChange={(e) => setResp({ ...resp, [c.id]: e.target.value })} /></Field></div>
            {c.status !== 'Resolved' ? (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:flex">{c.status !== 'In progress' && <button type="button" className="btn-outline" onClick={() => set(c, 'In progress')}>In progress</button>}<button type="button" className={`btn-primary ${c.status === 'In progress' ? 'col-span-2' : ''}`} onClick={() => set(c, 'Resolved')}>Resolve</button></div>
            ) : <div className="mt-3 flex"><button type="button" className="btn-outline" onClick={() => set(c, 'Open')}>Reopen</button></div>}
          </Card>
        ))}
        {list.length === 0 && <Empty icon={<LifeBuoy />} title={show === 'open' ? 'No open concerns' : 'Nothing resolved yet'} sub={show === 'open' ? 'When a client raises a concern in their portal it lands here.' : undefined} />}
      </div>
    </div>
  );
}

/** Retainers whose health is amber/red or renewal is within 90 days (boss view). */
export function RetainersAtRisk() {
  const { retainers, health } = useRetainerData();
  const clients = useClients();
  const list = useMemo(() => retainers.map((r) => ({ r, h: health(r) })).filter(({ r, h }) => h.tone !== 'green' || renewalBand(r.end_date)), [retainers, health]);
  return (
    <div className="flex flex-col gap-2">
      {list.map(({ r, h }) => (
        <GoLink key={r.id} to={`/os/retainers/${r.id}`} className="block rounded-2xl border border-basil-line bg-white p-4 text-basil-ink no-underline">
          <div className="flex items-start justify-between gap-2"><b>{clients.find((c) => c.id === r.client_id)?.name}</b><Pill tone={h.tone}>{h.tone} · {h.score}</Pill></div>
          <div className="text-sm text-basil-muted">{r.tier} · {tsh(r.monthly_fee)}/month · ends {dmy(r.end_date)}</div>
          <ul className="m-0 mt-1 pl-5 text-sm">{h.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
        </GoLink>
      ))}
      {list.length === 0 && <Empty icon={<Star />} title="No retainers at risk" />}
      <span className="text-xs text-basil-muted"><CalendarDays size={12} className="mr-1 inline" />Health checks rating, concerns, renewal date, allowance use and stalled requests. Today {dmy(todayIso())}.</span>
    </div>
  );
}

// ---------- forms: new/edit retainer, schedule a visit, log allowance usage ----------
const CREW_ROLES = ['Lead camera', 'Photographer', 'Sound', 'Producer', 'Editor', 'Driver'];

export function RetainerForm({ open, onClose, retainer }: { open: boolean; onClose: () => void; retainer?: Retainer }) {
  const clients = useClients();
  const people = usePeople();
  const { userId } = useActing();
  const toast = useToast();
  const { rows: all } = useTable<Retainer>('retainers');
  const blank = (): Partial<Retainer> => ({ tier: 'Growth', monthly_fee: 0, start_date: todayIso(), end_date: isoPlus(365), status: 'active', allowances: { shoot_days: 2, posts: 12, reels: 2, edited_photos: 80 }, rollover: 'none', rollover_cap_pct: 0, account_manager_id: userId, notes: '' });
  const [f, setF] = useState<Partial<Retainer>>(blank);
  const [key, setKey] = useState<string | null>(null);
  const k = open ? retainer?.id ?? 'new' : null;
  if (k !== key) {
    setKey(k);
    if (k) setF(retainer ? structuredClone(retainer) : blank());
  }
  const managers = people.filter((p) => p.roles.some((r) => ['growth', 'account_manager', 'gm_cfo', 'boss'].includes(r)));
  const save = async () => {
    try {
      if (!f.client_id) throw new Error('Choose the client');
      if (!Number(f.monthly_fee)) throw new Error('Enter the monthly fee');
      if (!f.start_date || !f.end_date || f.end_date <= f.start_date) throw new Error('The end date must be after the start date');
      const allowances = Object.fromEntries(Object.entries(f.allowances ?? {}).filter(([, v]) => Number(v) > 0).map(([u, v]) => [u, Number(v)]));
      if (!Object.keys(allowances).length) throw new Error('Give at least one monthly allowance');
      const row = { client_id: f.client_id, tier: f.tier ?? 'Growth', monthly_fee: Number(f.monthly_fee), start_date: f.start_date, end_date: f.end_date, status: f.status ?? 'active', allowances, rollover: f.rollover ?? 'none', rollover_cap_pct: f.rollover === 'next_month' ? Number(f.rollover_cap_pct) || 0 : 0, account_manager_id: f.account_manager_id || userId, notes: f.notes ?? '' };
      if (retainer) await updateRow('retainers', retainer.id, row);
      else await insertRow('retainers', { ...row, number: `BM-RET-${String(all.length + 21).padStart(3, '0')}` });
      toast(retainer ? 'Retainer updated' : 'Retainer created — the client sees it in their portal');
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const setU = (u: UnitKey, v: string) => setF({ ...f, allowances: { ...f.allowances, [u]: Number(v.replace(/\D/g, '')) || 0 } });
  return (
    <Sheet open={open} onClose={onClose} title={retainer ? 'Edit retainer' : 'New retainer'}>
      <div className="flex flex-col gap-3">
        <Field label="Client"><select className={inputCls} value={f.client_id ?? ''} disabled={!!retainer} onChange={(e) => setF({ ...f, client_id: e.target.value })}><option value="">Choose…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tier"><select className={inputCls} value={f.tier} onChange={(e) => setF({ ...f, tier: e.target.value })}>{TIERS.map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Monthly fee (TSH)"><input className={inputCls} inputMode="numeric" value={f.monthly_fee || ''} onChange={(e) => setF({ ...f, monthly_fee: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></Field>
          <Field label="Starts"><input type="date" className={inputCls} value={f.start_date ?? ''} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></Field>
          <Field label="Ends"><input type="date" className={inputCls} value={f.end_date ?? ''} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></Field>
        </div>
        <fieldset className="m-0 flex flex-col gap-2 rounded-xl border border-basil-line p-3">
          <legend className="px-1 text-sm font-bold text-[#33465F]">Monthly allowance</legend>
          <div className="grid grid-cols-2 gap-2">
            {UNITS.map((u) => <Field key={u.key} label={u.label}><input className={inputCls} inputMode="numeric" value={f.allowances?.[u.key] ?? 0} onChange={(e) => setU(u.key, e.target.value)} /></Field>)}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Unused allowance"><select className={inputCls} value={f.rollover} onChange={(e) => setF({ ...f, rollover: e.target.value as Retainer['rollover'] })}><option value="none">Expires monthly</option><option value="next_month">Rolls to next month</option></select></Field>
          <Field label="Rollover cap %"><input className={inputCls} inputMode="numeric" disabled={f.rollover !== 'next_month'} value={f.rollover === 'next_month' ? f.rollover_cap_pct ?? 0 : 0} onChange={(e) => setF({ ...f, rollover_cap_pct: Math.min(100, Number(e.target.value.replace(/\D/g, '')) || 0) })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Account manager"><select className={inputCls} value={f.account_manager_id ?? ''} onChange={(e) => setF({ ...f, account_manager_id: e.target.value })}>{managers.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></Field>
          <Field label="Status"><select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Retainer['status'] })}><option value="active">Active</option><option value="paused">Paused</option><option value="ended">Ended</option></select></Field>
        </div>
        <Field label="Notes"><textarea className={`${inputCls} h-20 py-2`} value={f.notes ?? ''} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        <button type="button" className="btn-primary" onClick={save}>{retainer ? 'Save changes' : 'Create retainer'}</button>
      </div>
    </Sheet>
  );
}

const KIND_UNITS: Record<CalItem['kind'], Partial<Record<UnitKey, number>>> = { shoot: { shoot_days: 1 }, podcast: { podcast_episodes: 1 }, delivery: {}, review: {}, post: { posts: 1 } };

export function VisitForm({ open, onClose, retainer }: { open: boolean; onClose: () => void; retainer: Retainer }) {
  const people = usePeople();
  const toast = useToast();
  const staff = people.filter((p) => !p.roles.includes('client') && p.roles.some((r) => ['staff', 'project_lead', 'driver'].includes(r)));
  const blank = () => ({ kind: 'shoot' as CalItem['kind'], title: '', date: isoPlus(7), time: '09:00', call_time: '08:00', location: '', crew: [] as { user_id: string; role: string }[], units: KIND_UNITS.shoot as Partial<Record<UnitKey, number>> });
  const [f, setF] = useState(blank);
  const [was, setWas] = useState(false);
  if (open !== was) {
    setWas(open);
    if (open) setF(blank());
  }
  const toggleCrew = (id: string) => setF({ ...f, crew: f.crew.some((c) => c.user_id === id) ? f.crew.filter((c) => c.user_id !== id) : [...f.crew, { user_id: id, role: CREW_ROLES[Math.min(f.crew.length, CREW_ROLES.length - 1)] }] });
  const save = async () => {
    try {
      if (!f.title.trim()) throw new Error('Give the visit a title');
      if (!f.date) throw new Error('Choose a date');
      const live = f.kind === 'shoot' || f.kind === 'podcast';
      await insertRow<CalItem>('retainer_calendar', {
        retainer_id: retainer.id, client_id: retainer.client_id, date: f.date, time: f.time, kind: f.kind, title: f.title.trim(), location: f.location,
        map_url: f.location ? `https://maps.google.com/?q=${encodeURIComponent(f.location)}` : '', status: 'Scheduled', crew: live ? f.crew : [], call_time: live ? f.call_time : '',
        checklist: live ? [{ label: 'Location access confirmed', done: false }, { label: 'Consent forms ready', done: false }] : [], units: f.units, signoff: null, gallery_slug: '', link: '',
      });
      await notifyClient(retainer.client_id, `${KIND_LABEL[f.kind]} scheduled`, `${f.title.trim()} · ${dmy(f.date)} ${f.time}`, '/app?tab=calendar', true);
      toast(`${KIND_LABEL[f.kind]} scheduled — it is on the client's calendar`);
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Schedule a visit">
      <div className="flex flex-col gap-3">
        <Field label="What"><select className={inputCls} value={f.kind} onChange={(e) => { const kind = e.target.value as CalItem['kind']; setF({ ...f, kind, units: KIND_UNITS[kind] }); }}>{(Object.keys(KIND_LABEL) as CalItem['kind'][]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></Field>
        <Field label="Title"><input className={inputCls} value={f.title} placeholder="e.g. Ward 7 patient stories" onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><input type="date" className={inputCls} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Time"><input type="time" className={inputCls} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
        </div>
        <Field label="Location"><input className={inputCls} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
        {(f.kind === 'shoot' || f.kind === 'podcast') && (
          <>
            <Field label="Crew call time"><input type="time" className={inputCls} value={f.call_time} onChange={(e) => setF({ ...f, call_time: e.target.value })} /></Field>
            <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
              <legend className="mb-1 text-sm font-bold text-[#33465F]">Crew</legend>
              {staff.map((p) => {
                const on = f.crew.find((c) => c.user_id === p.id);
                return (
                  <div key={p.id} className={`flex min-h-[48px] items-center gap-2 rounded-xl border px-3 ${on ? 'border-basil bg-basil-ice' : 'border-basil-line'}`}>
                    <label className="flex min-h-[44px] flex-1 items-center gap-2 text-sm"><input type="checkbox" checked={!!on} onChange={() => toggleCrew(p.id)} />{p.full_name}</label>
                    {on && <select aria-label={`Role for ${p.full_name}`} className="h-10 rounded-lg border border-basil-edge bg-white px-2 text-sm" value={on.role} onChange={(e) => setF({ ...f, crew: f.crew.map((c) => (c.user_id === p.id ? { ...c, role: e.target.value } : c)) })}>{CREW_ROLES.map((r) => <option key={r}>{r}</option>)}</select>}
                  </div>
                );
              })}
            </fieldset>
          </>
        )}
        <p className="m-0 rounded-xl bg-basil-ice p-3 text-sm text-basil-deep">Uses {Object.entries(f.units).map(([u, n]) => `${n} ${UNITS.find((x) => x.key === u)?.short}`).join(', ') || 'no allowance'} — counted when the client signs off.</p>
        <button type="button" className="btn-primary" onClick={save}>Schedule</button>
      </div>
    </Sheet>
  );
}

export function UsageForm({ open, onClose, retainer }: { open: boolean; onClose: () => void; retainer: Retainer }) {
  const toast = useToast();
  const units = UNITS.filter((u) => (retainer.allowances[u.key] ?? 0) > 0);
  const blank = () => ({ unit: (units[0]?.key ?? 'posts') as UnitKey, qty: '1', month: monthKey(), kind: 'usage' as LedgerRow['kind'], note: '' });
  const [f, setF] = useState(blank);
  const [was, setWas] = useState(false);
  if (open !== was) {
    setWas(open);
    if (open) setF(blank());
  }
  const save = async () => {
    try {
      const qty = Number(f.qty);
      if (!qty) throw new Error('Enter a quantity');
      if (f.kind === 'usage' && qty < 0) throw new Error('Usage must be positive; use an adjustment to give units back');
      if (!f.note.trim()) throw new Error('Add a short note (what was delivered)');
      await insertRow('allowance_ledger', { retainer_id: retainer.id, client_id: retainer.client_id, month: f.month, unit: f.unit, qty, kind: f.kind, source_id: null, note: f.note.trim() });
      toast(qty > 0 ? `${qty} ${UNITS.find((u) => u.key === f.unit)?.short} logged` : 'Units given back');
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Log allowance usage">
      <div className="flex flex-col gap-3">
        <Tabs value={f.kind} onChange={(kind) => setF({ ...f, kind })} items={[{ value: 'usage', label: 'Usage' }, { value: 'adjustment', label: 'Adjustment' }]} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Unit"><select className={inputCls} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value as UnitKey })}>{units.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}</select></Field>
          <Field label="Quantity" hint={f.kind === 'adjustment' ? 'Negative gives units back' : undefined}><input className={inputCls} inputMode="decimal" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value.replace(/[^\d.-]/g, '') })} /></Field>
        </div>
        <Field label="Month"><input type="month" className={inputCls} value={f.month} onChange={(e) => setF({ ...f, month: e.target.value })} /></Field>
        <Field label="Note"><input className={inputCls} value={f.note} placeholder="e.g. 4 posts for World Heart Day" onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <button type="button" className="btn-primary" onClick={save}>Log</button>
      </div>
    </Sheet>
  );
}
