// Retainer programme (Account Manager side): retainers, allowances, year calendar, shoot status, requests, concerns, health.
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, CalendarDays, MapPin, Phone, Star } from 'lucide-react';
import { demoTable, insertRow, newId, nowIso, rpc, updateRow, usePeople, useTable, type Person } from '@/os/lib/store';
import { notify } from '@/os/lib/notify';
import { useToast } from '@/os/cms/toast';
import { Avatar, Card, Empty, Field, Pill, Progress, Sheet, StageTracker, Stat, Tabs, inputCls, tsh, tshShort, type Tone } from '@/os/ui';
import { PageTitle } from '@/os/OsLayout';
import {
  MONTHS, REQUEST_STATUS, SHOOT_STATUS, balanceFor, clientHealth, daysBetween, dayLabel, dmy, monthKey, monthLabel, overallUse, renewalBand, todayIso,
  type Balance, type CalItem, type ClientRequest, type Concern, type LedgerRow, type Retainer, type UnitKey,
} from './lib';
import { Ring, useClients } from './kit';

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
      <div className="flex flex-wrap gap-3 text-sm"><span><b>Call time</b> {item.call_time || '—'}</span>{item.map_url && <a href={item.map_url} target="_blank" rel="noreferrer" className="font-bold"><MapPin size={14} className="mr-1 inline" />Open map</a>}</div>
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
  await rpc('set_shoot_status', { _item: item.id, _status: status });
  if (['On the way', 'Arrived', 'Wrapped'].includes(status) && item.client_id === 'c-hospital') await notify('u-client', `Crew ${status.toLowerCase()}`, `${item.title} · ${item.time}`, '/app?tab=home', 'info');
}

/** Client sign-off: confirm completed (consumes allowance) or report an issue, with a 1–5 star rating. */
export async function signOffShoot(item: CalItem, outcome: 'completed' | 'issue', rating: number, comment: string, userId: string) {
  await rpc('client_signoff_shoot', { _item: item.id, _completed: outcome === 'completed', _rating: rating, _comment: comment });
  await notify('u-growth', outcome === 'issue' ? 'Client reported an issue' : 'Shoot signed off', `${item.title} · ${'★'.repeat(rating)}${comment ? ` · ${comment}` : ''}`, '/os/retainers', outcome === 'issue' ? 'alert' : 'info');
}

export function RetainersList({ compact = false }: { compact?: boolean }) {
  const { retainers, health, balance } = useRetainerData();
  const clients = useClients();
  const name = (id: string) => clients.find((c) => c.id === id)?.name ?? id;
  return (
    <div className="flex flex-col gap-3">
      {retainers.map((r) => {
        const h = health(r), b = balance(r), band = renewalBand(r.end_date), use = overallUse(b);
        return (
          <Link key={r.id} to={`/os/retainers/${r.id}`} className="flex flex-col gap-2 rounded-2xl border border-basil-line bg-white p-4 text-basil-ink no-underline">
            <span className="flex flex-wrap items-start justify-between gap-2"><b>{name(r.client_id)}</b><span className="flex gap-1.5"><Pill tone="gold">{r.tier}</Pill><Pill tone={h.tone}>Health {h.score}</Pill></span></span>
            <span className="text-sm text-basil-muted">{tsh(r.monthly_fee)}/month · {dmy(r.start_date)} – {dmy(r.end_date)}</span>
            <div className="flex items-center gap-2 text-sm"><span className="w-36 shrink-0">This month {use}% used</span><Progress value={use} max={100} /></div>
            {band && <span className="flex items-center gap-1 text-sm font-bold text-amber-800"><AlertTriangle size={14} />Renewal in {daysBetween(r.end_date)} days ({band}-day alert)</span>}
            {!compact && h.reasons.length > 0 && <span className="text-xs text-basil-muted">{h.reasons.join(' · ')}</span>}
          </Link>
        );
      })}
      {retainers.length === 0 && <Empty title="No retainers yet" />}
    </div>
  );
}

export function RetainersPage() {
  const { retainers, requests, concerns, health } = useRetainerData();
  return (
    <div>
      <PageTitle tag="CLIENTS · RETAINERS" title="Retainer programme" sub="Allowances, year calendars, shoot sign-offs, requests and client health.">
        <div className="flex flex-wrap gap-2"><Link to="/os/retainers/requests" className="btn-outline">Request board</Link><Link to="/os/retainers/concerns" className="btn-outline">Concerns</Link></div>
      </PageTitle>
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

export function RetainerDetail() {
  const { id } = useParams();
  const { retainers, items, ledger, balance, health, requests } = useRetainerData();
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
      <PageTitle tag={`RETAINER · ${r.number}`} title={clients.find((c) => c.id === r.client_id)?.name ?? r.client_id} sub={`${r.tier} tier · ${tsh(r.monthly_fee)}/month · ${dmy(r.start_date)} – ${dmy(r.end_date)} · rollover ${r.rollover === 'none' ? 'none (unused expires monthly)' : `next month, up to ${r.rollover_cap_pct}%`}`} />
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4">
          <Card title={`Allowance · ${monthLabel(monthKey())}`}><AllowanceRings balance={b} /></Card>
          <Card title={<Tabs value={tab} onChange={setTab} items={[{ value: 'calendar', label: 'Year calendar' }, { value: 'ledger', label: 'Allowance ledger' }]} />}>
            {tab === 'calendar' ? <YearCalendar items={its} onPick={setPick} /> : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-basil-muted"><th className="py-1">Month</th><th>Unit</th><th className="text-right">Used</th><th>Note</th></tr></thead>
                <tbody>{ledger.filter((l) => l.retainer_id === r.id).sort((a, z) => z.month.localeCompare(a.month)).slice(0, 60).map((l) => <tr key={l.id} className="border-t border-basil-line"><td className="py-1">{l.month}</td><td>{l.unit.replace('_', ' ')}</td><td className="text-right">{l.qty}</td><td className="text-basil-muted">{l.note}</td></tr>)}</tbody>
              </table>
            )}
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card title="Client health"><div className="mb-2"><Pill tone={h.tone}>{h.tone.toUpperCase()} · {h.score}/100</Pill></div>{h.reasons.length ? <ul className="m-0 pl-5 text-sm">{h.reasons.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="m-0 text-sm text-basil-muted">All good.</p>}</Card>
          <Card title="Requests"><ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">{requests.filter((q) => q.retainer_id === r.id).slice(0, 6).map((q) => <li key={q.id} className="flex justify-between gap-2"><span>{q.title}</span><Pill tone={q.status === 'Declined' ? 'red' : q.status === 'Scheduled' ? 'green' : 'amber'}>{q.status}</Pill></li>)}</ul><Link to="/os/retainers/requests" className="mt-2 inline-block text-sm font-bold">Request board →</Link></Card>
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
        ) : cur && <div className="text-sm"><b>{cur.title}</b><p className="text-basil-muted">{cur.status}</p>{cur.gallery_slug && <a href={`/g/${cur.gallery_slug}`}>Gallery →</a>}</div>}
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
        const it = await insertRow<CalItem>('retainer_calendar', { retainer_id: q.retainer_id, client_id: q.client_id, date: day, time: '09:00', kind: q.type === 'podcast' ? 'podcast' : q.type === 'shoot' ? 'shoot' : 'delivery', title: q.title, location: q.location, map_url: q.location ? `https://maps.google.com/?q=${encodeURIComponent(q.location)}` : '', status: 'Scheduled', crew: q.type === 'shoot' ? [{ user_id: 'u-jonathan', role: 'Lead camera' }, { user_id: 'u-benedicto', role: 'Photographer' }] : [], call_time: q.type === 'shoot' ? '08:00' : '', checklist: [], units: q.units, signoff: null, gallery_slug: '', link: '' });
        itemId = it.id;
      }
      await rpc('set_request_status', { _id: q.id, _status: status, _quote: quote ? Number(quote) : null, _note: note || null });
      if (q.client_id === 'c-hospital') await notify('u-client', `Request ${status.toLowerCase()}`, q.title, '/app?tab=requests', 'info');
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
      {q.over_allowance && <Pill tone="amber">Over allowance · {tshShort(q.quote_amount)}</Pill>}
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
export const RequestBoardPage = () => (<div><PageTitle tag="CLIENTS · REQUESTS" title="Client request board" sub="Requests from retainer clients. Over-allowance requests return to the client as an extra-charge quote." /><RequestBoard /></div>);

export function ConcernsBoard() {
  const { concerns } = useRetainerData();
  const clients = useClients();
  const toast = useToast();
  const [resp, setResp] = useState<Record<string, string>>({});
  const set = async (c: Concern, status: Concern['status']) => {
    await updateRow('client_concerns', c.id, { status, response: resp[c.id] ?? c.response });
    if (c.client_id === 'c-hospital') await notify('u-client', `Your concern: ${status}`, c.subject, '/app', 'info');
    toast(`Marked ${status}`);
  };
  return (
    <div>
      <PageTitle tag="CLIENTS · CONCERNS" title="Raised concerns" sub="Tickets clients raised from their portal." />
      <div className="flex flex-col gap-3">
        {concerns.map((c) => (
          <Card key={c.id} title={c.subject} action={<Pill tone={c.status === 'Resolved' ? 'green' : c.severity === 'High' ? 'red' : 'amber'}>{c.status} · {c.severity}</Pill>}>
            <p className="m-0 text-sm text-basil-muted">{clients.find((x) => x.id === c.client_id)?.name} · {dmy(c.created_at)}</p>
            <p className="m-0 mt-1 text-sm">{c.body}</p>
            <Field label="Response"><textarea className={`${inputCls} h-20 py-2`} defaultValue={c.response} onChange={(e) => setResp({ ...resp, [c.id]: e.target.value })} /></Field>
            <div className="mt-2 flex gap-2"><button type="button" className="btn-outline" onClick={() => set(c, 'In progress')}>In progress</button><button type="button" className="btn-primary" onClick={() => set(c, 'Resolved')}>Resolve</button></div>
          </Card>
        ))}
        {concerns.length === 0 && <Empty title="No concerns raised" />}
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
        <div key={r.id} className="rounded-2xl border border-basil-line bg-white p-4">
          <div className="flex items-start justify-between gap-2"><b>{clients.find((c) => c.id === r.client_id)?.name}</b><Pill tone={h.tone}>{h.tone} · {h.score}</Pill></div>
          <div className="text-sm text-basil-muted">{r.tier} · {tsh(r.monthly_fee)}/month · ends {dmy(r.end_date)}</div>
          <ul className="m-0 mt-1 pl-5 text-sm">{h.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      ))}
      {list.length === 0 && <Empty icon={<Star />} title="No retainers at risk" />}
      <span className="text-xs text-basil-muted"><CalendarDays size={12} className="mr-1 inline" />Health checks rating, concerns, renewal date, allowance use and stalled requests. Today {dmy(todayIso())}.</span>
    </div>
  );
}
