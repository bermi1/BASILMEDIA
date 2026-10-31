// Retainer client portal screens (phone app for the client role). Every query is scoped to the user's client id;
// with Supabase, RLS (client_users + my_client_ids()) guarantees a client only ever sees their own rows.
import { useEffect, useState } from 'react';
import { CheckCircle2, Images, MessageCircle, Phone, Plus, Star } from 'lucide-react';
import { useActing } from '@/os/lib/session';
import { docTotals, invoicePaid, invoiceStatus, type Invoice, type Payment } from '@/os/modules/finance/lib';
import { fetchRows, insertRow, updateRow, usePeople } from '@/os/lib/store';
import { notify } from '@/os/lib/notify';
import { useToast } from '@/os/cms/toast';
import { Avatar, Empty, Field, Pill, Sheet, StageTracker, inputCls, tsh } from '@/os/ui';
import { REQUEST_STATUS, REQUEST_TYPES, balanceFor, dayLabel, dmy, isoPlus, monthKey, monthLabel, requestImpact, todayIso, type CalItem, type ClientRequest, type Retainer } from './lib';
import { Section, useClients, useGalleries, useMyClient } from './kit';
import { AllowanceRings, KIND_LABEL, WhoIsComing, YearCalendar, shootPill, signOffShoot, useRetainerData } from './retainers';

function useClientCtx() {
  const { userId } = useActing();
  const { clientId, clientRole, loading } = useMyClient(userId);
  const data = useRetainerData(clientId ?? '00000000-0000-0000-0000-000000000000');
  const client = useClients().find((c) => c.id === clientId);
  const retainer = data.retainers.find((r) => r.status === 'active') ?? data.retainers[0];
  return { userId, clientId, clientRole, loading, client, retainer, ...data };
}
const NoClient = () => <Empty title="No client account linked" sub="Ask your Basil Media account manager to link your login to your organisation." />;

function SignOff({ item }: { item: CalItem }) {
  const { userId } = useActing();
  const toast = useToast();
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const go = async (outcome: 'completed' | 'issue') => {
    try {
      if (outcome === 'issue' && !comment) throw new Error('Tell us what went wrong');
      await signOffShoot(item, outcome, stars, comment, userId);
      toast(outcome === 'completed' ? 'Thank you — shoot confirmed' : 'Issue reported to your account manager');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-basil-ice p-3">
      <b className="text-sm">How did it go?</b>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} stars`} onClick={() => setStars(n)} className="flex h-11 w-11 items-center justify-center border-0 bg-transparent"><Star size={26} className={n <= stars ? 'fill-amber-400 text-amber-400' : 'text-basil-edge'} /></button>)}
      </div>
      <textarea aria-label="Comment" className={`${inputCls} h-16 py-2`} placeholder="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-primary min-h-[48px]" onClick={() => go('completed')}><CheckCircle2 size={16} />Confirm completed</button>
        <button type="button" className="btn-outline min-h-[48px]" onClick={() => go('issue')}>Report an issue</button>
      </div>
    </div>
  );
}

export function ClientHome({ onGo }: { onGo?: (tab: string) => void }) {
  const c = useClientCtx();
  const people = usePeople();
  const [open, setOpen] = useState<CalItem | null>(null);
  if (c.loading) return null;
  if (!c.clientId) return <NoClient />;
  const today = todayIso();
  const shoots = c.items.filter((i) => i.kind === 'shoot' || i.kind === 'podcast');
  const waiting = shoots.filter((i) => i.status === 'Wrapped' && !i.signoff);
  const next = shoots.find((i) => i.date >= today && i.status !== 'Completed' && i.status !== 'Wrapped');
  const am = people.find((p) => p.id === c.retainer?.account_manager_id);
  const quotes = c.requests.filter((q) => q.status === 'Quote needed' && q.quote_status === 'sent');
  const deliveries = c.items.filter((i) => i.kind === 'delivery' && i.date <= today).slice(-3).reverse();
  return (
    <div className="flex flex-col gap-5">
      <div><div className="text-sm text-basil-muted">{c.client?.name} · {c.retainer?.tier} retainer</div><h1 className="m-0 font-display text-2xl font-extrabold">Habari, {people.find((p) => p.id === c.userId)?.full_name.split(' ').slice(0, 2).join(' ') ?? 'there'}</h1></div>
      {next ? (
        <button type="button" onClick={() => setOpen(next)} className="flex flex-col gap-2 rounded-[24px] border-0 p-4 text-left text-white" style={{ background: 'linear-gradient(135deg,#0F766E,#0A2F5C)' }}>
          <span className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-white/80">Next up {shootPill(next.status)}</span>
          <b className="text-lg">{next.title}</b>
          <span className="text-sm text-white/85">{dayLabel(next.date)} · {next.time} · {next.location}</span>
          <span className="flex items-center gap-2">{next.crew.map((x) => <span key={x.user_id} className="rounded-full ring-2 ring-white/60"><Avatar name={people.find((p) => p.id === x.user_id)?.full_name ?? '?'} size={30} /></span>)}<span className="text-sm text-white/85">{next.crew.length} crew · call {next.call_time}</span></span>
          <span className="text-sm font-bold">See who is coming ›</span>
        </button>
      ) : <Empty title="Nothing scheduled yet" sub="Request a shoot and we will plan it." />}
      {c.retainer && (
        <Section title={`Allowance · ${monthLabel(monthKey())}`}>
          <div className="rounded-2xl bg-white p-4"><AllowanceRings balance={c.balance(c.retainer)} size={64} /><p className="m-0 mt-2 text-xs text-basil-muted">{c.retainer.rollover === 'none' ? 'Unused allowance expires at month end.' : `Up to ${c.retainer.rollover_cap_pct}% of unused allowance rolls into next month.`} Renews {dmy(c.retainer.end_date)}.</p></div>
        </Section>
      )}
      <Section title={`Waiting for you · ${waiting.length + quotes.length}`}>
        {waiting.map((i) => <div key={i.id} className="rounded-2xl bg-white p-4"><b>{i.title}</b><div className="mb-2 text-sm text-basil-muted">Wrapped {dayLabel(i.date)} — please sign off</div><SignOff item={i} /></div>)}
        {quotes.map((q) => <button key={q.id} type="button" onClick={() => onGo?.('requests')} className="flex items-center justify-between rounded-2xl border-0 bg-white p-4 text-left"><span><b className="block">Quote: {q.title}</b><span className="text-sm text-basil-muted">Extra charge {tsh(q.quote_amount)}</span></span><Pill tone="amber">Decide</Pill></button>)}
        {waiting.length + quotes.length === 0 && <div className="rounded-2xl bg-white p-4 text-sm text-basil-muted">All done — nothing waiting.</div>}
      </Section>
      {deliveries.length > 0 && <Section title="Latest deliveries">{deliveries.map((d) => <div key={d.id} className="rounded-2xl bg-white p-3 text-sm"><b>{d.title}</b> <span className="text-basil-muted">· {dmy(d.date)}</span></div>)}</Section>}
      {am && (
        <div className="flex items-center gap-3 rounded-2xl bg-white p-4">
          <Avatar name={am.full_name} size={44} />
          <span className="min-w-0 flex-1"><b className="block">{am.full_name}</b><span className="text-sm text-basil-muted">Your account manager</span></span>
          <a href={`tel:${am.phone}`} aria-label="Call" className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E6F4F2] text-[#0F766E]"><Phone size={18} /></a>
          <a href={`https://wa.me/${am.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E6F4F2] text-[#0F766E]"><MessageCircle size={18} /></a>
        </div>
      )}
      <ItemSheet item={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function ItemSheet({ item, onClose }: { item: CalItem | null; onClose: () => void }) {
  const people = usePeople();
  const c = useClientCtx();
  const cur = item ? c.items.find((i) => i.id === item.id) ?? item : null;
  return (
    <Sheet open={!!cur} onClose={onClose} title={cur ? `${KIND_LABEL[cur.kind]} · ${dmy(cur.date)}` : ''}>
      {cur && (cur.kind === 'shoot' || cur.kind === 'podcast') ? (
        <WhoIsComing item={cur} people={people}>
          {cur.status === 'Wrapped' && !cur.signoff && <SignOff item={cur} />}
          {cur.signoff && <p className="m-0 text-sm">You signed off: {'★'.repeat(cur.signoff.rating)} {cur.signoff.outcome === 'issue' ? '· issue reported' : ''}</p>}
        </WhoIsComing>
      ) : cur && (
        <div className="flex flex-col gap-2 text-sm"><b>{cur.title}</b><span className="text-basil-muted">{dayLabel(cur.date)}</span>{cur.gallery_slug && <a href={`/g/${cur.gallery_slug}`} className="font-bold">Open gallery →</a>}{cur.link && <a href={cur.link} target="_blank" rel="noreferrer" className="font-bold">Open →</a>}</div>
      )}
    </Sheet>
  );
}

export function ClientCalendar() {
  const c = useClientCtx();
  const [open, setOpen] = useState<CalItem | null>(null);
  if (!c.clientId) return <NoClient />;
  return <div><YearCalendar items={c.items} onPick={setOpen} /><ItemSheet item={open} onClose={() => setOpen(null)} /></div>;
}

export function ClientRequests() {
  const c = useClientCtx();
  const toast = useToast();
  const [form, setForm] = useState<{ type: string; title: string; dates: string[]; location: string; deliverables: string; urgency: ClientRequest['urgency'] } | null>(null);
  if (!c.clientId) return <NoClient />;
  const viewer = c.clientRole === 'viewer';
  const type = REQUEST_TYPES.find((t) => t.key === form?.type) ?? REQUEST_TYPES[0];
  const month = monthKey(form?.dates[0] || todayIso());
  const impact = c.retainer ? requestImpact(type.units, balanceFor(c.retainer, c.ledger, month)) : null;
  const submit = async () => {
    try {
      if (!form?.title) throw new Error('Give your request a title');
      if (!form.dates.filter(Boolean).length) throw new Error('Pick at least one preferred date');
      if (!c.retainer) throw new Error('No active retainer');
      await insertRow('client_requests', {
        number: `REQ-${String(143 + c.requests.length).padStart(4, '0')}`, client_id: c.clientId, retainer_id: c.retainer.id, type: form.type, title: form.title, preferred_dates: form.dates.filter(Boolean), location: form.location, deliverables: form.deliverables, urgency: form.urgency,
        status: impact?.over ? 'Quote needed' : 'New', units: type.units, over_allowance: !!impact?.over, quote_amount: impact?.quote ?? 0, quote_status: impact?.over ? 'sent' : 'none', requested_by: c.userId, note: impact?.over ? 'Over allowance — estimated extra charge from the rate card; your account manager confirms.' : '',
      });
      // With Supabase the notify_client_request trigger tells the account manager.
      toast(impact?.over ? 'Sent — this is over your allowance, so it comes back as a quote' : 'Request sent');
      setForm(null);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const decide = async (q: ClientRequest, ok: boolean) => {
    try {
      await updateRow('client_requests', q.id, { quote_status: ok ? 'accepted' : 'declined', status: ok ? 'Reviewing' : 'Declined' });
      if (c.retainer) await notify(c.retainer.account_manager_id, ok ? 'Quote accepted' : 'Quote declined', `${c.client?.name} · ${q.title}`, '/os/retainers/requests', 'task');
      toast(ok ? 'Quote accepted — we will schedule it' : 'Quote declined');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <div className="flex flex-col gap-4">
      {!viewer && <button type="button" onClick={() => setForm({ type: 'shoot', title: '', dates: [isoPlus(7), '', ''], location: '', deliverables: '', urgency: 'Normal' })} className="flex items-center gap-3 rounded-[24px] border-0 p-4 text-left text-white" style={{ background: 'linear-gradient(135deg,#0F766E,#0A2F5C)' }}><span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20"><Plus /></span><span><b className="block text-lg">I need a shoot or content</b><span className="text-sm text-white/80">See the allowance impact before you send</span></span></button>}
      <Section title="My requests">
        {c.requests.map((q) => (
          <div key={q.id} className="flex flex-col gap-2 rounded-2xl bg-white p-4">
            <div className="flex items-start justify-between gap-2"><b>{q.title}</b><Pill tone={q.status === 'Declined' ? 'red' : q.status === 'Scheduled' ? 'green' : q.status === 'Quote needed' ? 'amber' : 'blue'}>{q.status}</Pill></div>
            <span className="text-xs text-basil-muted">{q.number} · {q.preferred_dates.map(dmy).join(', ')}</span>
            <StageTracker stages={['New', 'Reviewing', 'Quote needed', 'Scheduled']} current={q.status === 'Declined' ? Math.max(0, REQUEST_STATUS.indexOf('Reviewing')) : REQUEST_STATUS.indexOf(q.status)} rejected={q.status === 'Declined'} />
            {q.note && <p className="m-0 text-sm text-basil-muted">{q.note}</p>}
            {q.status === 'Quote needed' && q.quote_status === 'sent' && !viewer && (
              <div className="rounded-xl bg-amber-50 p-3 text-sm"><b>Extra charge {tsh(q.quote_amount)}</b> (excl. VAT)<div className="mt-2 grid grid-cols-2 gap-2"><button type="button" className="btn-primary min-h-[44px]" onClick={() => decide(q, true)}>Accept</button><button type="button" className="btn-outline min-h-[44px]" onClick={() => decide(q, false)}>Not now</button></div></div>
            )}
          </div>
        ))}
        {c.requests.length === 0 && <Empty title="No requests yet" />}
      </Section>
      <Sheet open={!!form} onClose={() => setForm(null)} title="I need a shoot or content">
        {form && (
          <div className="flex flex-col gap-3">
            <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0"><legend className="mb-1 text-sm font-bold">What do you need?</legend>
              {REQUEST_TYPES.map((t) => <label key={t.key} className={`flex min-h-[48px] items-center gap-2 rounded-xl border px-3 text-sm ${form.type === t.key ? 'border-[#0F766E] bg-[#E6F4F2]' : 'border-basil-line'}`}><input type="radio" name="rtype" checked={form.type === t.key} onChange={() => setForm({ ...form, type: t.key })} />{t.label}</label>)}
            </fieldset>
            <Field label="Title"><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <Field key={i} label={`Date ${i + 1}`}><input type="date" className={`${inputCls} px-1 text-sm`} value={form.dates[i]} onChange={(e) => setForm({ ...form, dates: form.dates.map((d, j) => (j === i ? e.target.value : d)) })} /></Field>)}</div>
            <Field label="Location"><input className={inputCls} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
            <Field label="Deliverables"><input className={inputCls} value={form.deliverables} onChange={(e) => setForm({ ...form, deliverables: e.target.value })} placeholder="e.g. 20 photos + 1 reel" /></Field>
            <Field label="Urgency"><select className={inputCls} value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value as ClientRequest['urgency'] })}><option>Normal</option><option>Soon</option><option>Urgent</option></select></Field>
            {impact && (
              <div className={`rounded-xl p-3 text-sm ${impact.over ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900'}`}>
                <b>Allowance impact · {monthLabel(month)}</b>
                <ul className="m-0 mt-1 pl-5">{impact.lines.map((l) => <li key={l.unit}>{l.label}: uses {l.qty}, {Math.max(0, l.left)} left{l.extra ? ` — ${l.extra} extra (${tsh(l.cost)})` : ''}</li>)}</ul>
                <p className="m-0 mt-1">{impact.over ? `Over your allowance: we will send an extra-charge quote of about ${tsh(impact.quote)} (excl. VAT).` : 'Covered by your retainer.'}</p>
              </div>
            )}
            <button type="button" className="btn-primary min-h-[48px]" onClick={submit}>Send request</button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

export function ClientWork() {
  const c = useClientCtx();
  const { rows: gals } = useGalleries();
  if (!c.clientId) return <NoClient />;
  const name = (c.client?.name ?? '').toLowerCase();
  const slugs = new Set(c.items.map((i) => i.gallery_slug).filter(Boolean));
  const mine = gals.filter((g) => g.published && (slugs.has(g.slug) || (name && g.client_name.toLowerCase() === name)));
  const deliveries = c.items.filter((i) => i.kind === 'delivery' && i.date <= todayIso()).reverse();
  return (
    <div className="flex flex-col gap-4">
      <Section title="Galleries">
        {mine.map((g) => <a key={g.id} href={`/g/${g.slug}`} className="flex items-center gap-3 rounded-2xl bg-white p-4 text-basil-ink no-underline"><Images className="text-[#0F766E]" /><span className="flex-1"><b className="block">{g.title}</b><span className="text-sm text-basil-muted">{dmy(g.event_date)} · {g.location}</span></span>›</a>)}
        {mine.length === 0 && <div className="rounded-2xl bg-white p-4 text-sm text-basil-muted">No galleries yet.</div>}
      </Section>
      <Section title="Deliverables">
        {deliveries.slice(0, 20).map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-2 rounded-2xl bg-white p-3 text-sm">
            <span className="min-w-0"><b className="block">{d.title}</b><span className="text-basil-muted">{dmy(d.date)}</span></span>
            {d.gallery_slug ? <a href={`/g/${d.gallery_slug}`} className="flex min-h-[44px] shrink-0 items-center rounded-full bg-[#E6F4F2] px-4 font-bold text-[#0F766E] no-underline">Open</a> : d.link ? <a href={d.link} target="_blank" rel="noreferrer" className="flex min-h-[44px] shrink-0 items-center rounded-full bg-[#E6F4F2] px-4 font-bold text-[#0F766E] no-underline">Watch</a> : <Pill tone="green">Delivered</Pill>}
          </div>
        ))}
        {deliveries.length === 0 && <div className="rounded-2xl bg-white p-4 text-sm text-basil-muted">Nothing delivered yet.</div>}
      </Section>
    </div>
  );
}

const INV_LABEL: Record<string, [string, 'green' | 'red' | 'amber' | 'blue' | 'grey']> = { paid: ['Paid', 'green'], overdue: ['Overdue', 'red'], partially_paid: ['Part paid', 'amber'], sent: ['Due', 'blue'], viewed: ['Due', 'blue'], draft: ['Draft', 'grey'], cancelled: ['Cancelled', 'grey'] };

export function ClientBilling() {
  const c = useClientCtx();
  const [data, setData] = useState<{ inv: Invoice[]; pay: Payment[] } | null>(null);
  useEffect(() => {
    if (!c.clientId) return;
    Promise.all([fetchRows<Invoice>('invoices', { eq: { client_id: c.clientId }, order: 'issue_date', ascending: false }), fetchRows<Payment>('invoice_payments').catch(() => [] as Payment[])])
      .then(([inv, pay]) => setData({ inv: inv.filter((i) => i.status !== 'draft'), pay }))
      .catch(() => setData({ inv: [], pay: [] }));
  }, [c.clientId]);
  if (!c.clientId) return <NoClient />;
  const rows = (data?.inv ?? []).map((i) => {
    const total = docTotals(i).total, paid = invoicePaid(i, data!.pay);
    return { i, total, balance: Math.max(0, total - paid), status: invoiceStatus(i, data!.pay) };
  });
  const due = rows.filter((r) => !['paid', 'cancelled'].includes(r.status)).reduce((s, r) => s + r.balance, 0);
  return (
    <div className="flex flex-col gap-4">
      {c.retainer && (
        <div className="flex flex-col gap-1 rounded-[24px] p-4 text-white" style={{ background: 'linear-gradient(135deg,#0F766E,#0A2F5C)' }}>
          <span className="text-xs font-bold uppercase tracking-wide text-white/75">{c.retainer.tier} retainer</span>
          <b className="font-display text-2xl">{tsh(c.retainer.monthly_fee)}<span className="text-sm font-normal text-white/80"> / month</span></b>
          <span className="text-sm text-white/85">{dmy(c.retainer.start_date)} – {dmy(c.retainer.end_date)}</span>
        </div>
      )}
      {rows.length > 0 && <div className="flex items-center justify-between rounded-2xl bg-white p-4 text-sm"><span className="text-basil-muted">Balance due</span><b className={`font-display text-lg ${due ? 'text-amber-800' : 'text-emerald-700'}`}>{due ? tsh(due) : 'All paid'}</b></div>}
      <Section title="Invoices">
        {data === null ? null : rows.length === 0 ? <div className="rounded-2xl bg-white p-4 text-sm text-basil-muted">No invoices to show yet.</div> : rows.map(({ i, total, balance, status }) => (
          <div key={i.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 text-sm">
            <span className="min-w-0"><b className="block">{i.number}</b><span className="block truncate text-basil-muted">{i.title || 'Invoice'}</span><span className="text-xs text-basil-muted">Issued {dmy(i.issue_date)} · due {dmy(i.due_date)}</span></span>
            <span className="shrink-0 text-right"><b className="block">{tsh(total)}</b>{balance > 0 && balance < total && <span className="block text-xs text-basil-muted">{tsh(balance)} left</span>}<Pill tone={INV_LABEL[status]?.[1] ?? 'amber'}>{INV_LABEL[status]?.[0] ?? status}</Pill></span>
          </div>
        ))}
      </Section>
    </div>
  );
}

export function RaiseConcern() {
  const c = useClientCtx();
  const toast = useToast();
  const [f, setF] = useState({ subject: '', body: '', severity: 'Medium' });
  if (!c.clientId) return <NoClient />;
  const send = async () => {
    try {
      if (!f.subject || !f.body) throw new Error('Add a subject and a few words');
      await insertRow('client_concerns', { client_id: c.clientId, subject: f.subject, body: f.body, severity: f.severity, status: 'Open', raised_by: c.userId, response: '' });
      // The notify_client_concern trigger tells the account managers and the Boss.
      setF({ subject: '', body: '', severity: 'Medium' });
      toast('Sent — your account manager will respond within one working day');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-4">
        <Field label="Subject"><input className={inputCls} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
        <Field label="What happened?"><textarea className={`${inputCls} h-28 py-2`} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
        <Field label="How serious?"><select className={inputCls} value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}><option>Low</option><option>Medium</option><option>High</option></select></Field>
        <button type="button" className="btn-primary min-h-[48px]" onClick={send}>Raise concern</button>
      </div>
      <Section title="Your concerns">
        {c.concerns.map((x) => <div key={x.id} className="rounded-2xl bg-white p-4 text-sm"><div className="flex justify-between gap-2"><b>{x.subject}</b><Pill tone={x.status === 'Resolved' ? 'green' : 'amber'}>{x.status}</Pill></div>{x.response && <p className="m-0 mt-1 text-basil-muted">Basil Media: {x.response}</p>}</div>)}
        {c.concerns.length === 0 && <div className="rounded-2xl bg-white p-4 text-sm text-basil-muted">None — glad to hear it.</div>}
      </Section>
    </div>
  );
}

export function TeamContacts() {
  const c = useClientCtx();
  const people = usePeople();
  const crewIds = [...new Set(c.items.flatMap((i) => i.crew.map((x) => x.user_id)))];
  const bossId = people.find((p) => p.roles.includes('boss'))?.id;
  const team = [c.retainer?.account_manager_id, bossId, ...crewIds].filter((x, i, a) => x && a.indexOf(x) === i) as string[];
  return (
    <div className="flex flex-col gap-2">
      {team.map((id) => {
        const p = people.find((x) => x.id === id);
        if (!p) return null;
        const role = id === c.retainer?.account_manager_id ? 'Account Manager' : id === bossId ? 'CEO, Basil Media' : c.items.flatMap((i) => i.crew).find((x) => x.user_id === id)?.role ?? 'Crew';
        return (
          <div key={id} className="flex items-center gap-3 rounded-2xl bg-white p-4">
            <Avatar name={p.full_name} size={44} /><span className="min-w-0 flex-1"><b className="block">{p.full_name}</b><span className="text-sm text-basil-muted">{role}</span></span>
            <a href={`tel:${p.phone}`} aria-label={`Call ${p.full_name}`} className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E6F4F2] text-[#0F766E]"><Phone size={18} /></a>
          </div>
        );
      })}
    </div>
  );
}

export type { Retainer };
