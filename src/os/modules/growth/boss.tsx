// Boss cockpit: today at a glance, Monday briefing (printable), company scoreboard and decision log.
import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowRight, Briefcase, CalendarClock, Check, ChevronRight, CircleDollarSign, Gavel, Inbox, Lightbulb, Plus, Target as TargetIcon, TrendingUp, Undo2, Users } from 'lucide-react';
import { useActing } from '@/os/lib/session';
import { fetchRows, insertRow, onChange, rpc, updateRow, usePeople, personName, useTable } from '@/os/lib/store';
import { useFinance } from '@/os/modules/finance/lib';
import { useToast } from '@/os/cms/toast';
import { Card, Empty, Field, Pill, Sheet, inputCls, tsh, tshShort, type Tone } from '@/os/ui';
import { ApprovalsInbox, CashGlance } from '@/os/modules/finance/phone';
import { DAY, daysBetween, dmy, fmtUnit, isoPlus, monthKey, renewalBand, rowAmount, rowDate, todayIso, type CalItem, type Decision, type LeadActivity, type Proposal, type Target, type Tender } from './lib';
import { GoLink, PageHead, Ring, PrintArea, PrintButton, useBookings, useClients, useInPhone } from './kit';
import { pipelineTotals, useCrm, useLeadHeat } from './crm';
import { useRenewals } from './docs';
import { useRetainerData } from './retainers';
import { proposalTotals } from './docs';

interface Proj { id: string; name: string; client_id: string; stage: string; lead_id: string; end_date: string; health: string; location: string; contract_value: number }
type R = Record<string, unknown> & { id: string };

/** Rows from tables owned by other modules (finance). Missing/empty tables are fine. */
function useForeign(table: string, q: Parameters<typeof fetchRows>[1] = {}) {
  const [rows, setRows] = useState<R[]>([]);
  const key = JSON.stringify(q);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetchRows<R>(table, JSON.parse(key));
        if (alive) setRows(r);
      } catch {
        if (alive) setRows([]);
      }
    };
    load();
    const off = onChange(load);
    return () => void ((alive = false), off());
  }, [table, key]);
  return rows;
}

export interface ApprovalItem { id: string; title: string; sub: string; amount: number; at: string; kind: 'money' | 'payroll' | 'proposal' | 'other'; link?: string }

/** Everything the cockpit needs, derived from every module's tables. */
export function useBoss() {
  const { userId } = useActing();
  const people = usePeople();
  const crm = useCrm();
  const projects = useTable<Proj>('projects').rows;
  const proposals = useTable<Proposal>('proposals').rows;
  const tenders = useTable<Tender>('tenders').rows;
  const targets = useTable<Target>('scoreboard_targets', { eq: { year: new Date().getFullYear() }, order: 'sort_order' }).rows;
  const activity = useTable<LeadActivity>('lead_activity', { order: 'created_at', ascending: false }).rows;
  const ret = useRetainerData();
  const renewals = useRenewals();
  const clients = useClients();
  const income = useForeign('income');
  const expenses = useForeign('expenses');
  const fin = useFinance();
  // Overdue = effective status from finance (due date passed, balance after payments still open).
  const overdueInv = fin.overdueRows.map((r) => ({ id: r.inv.id, number: r.inv.number, amount: r.balance, due_date: r.inv.due_date }));
  const notes = useTable<{ id: string; user_id: string; kind: string; title: string; body: string; read_at: string | null; created_at: string; link: string }>('notifications', { eq: { user_id: userId } }).rows;
  const { rows: bookings } = useBookings();
  const heat = useLeadHeat();
  const today = todayIso();
  const leaveRows = useTable<{ user_id: string; leave_type: string; start_date: string; end_date: string; status: string }>('leave_requests').rows;
  const reportRows = useTable<{ author_id: string; week_start: string }>('weekly_reports').rows;

  const approvals: ApprovalItem[] = [
    ...fin.waitingBoss.map((m) => ({ id: m.id, title: m.purpose || 'Money request', sub: `${personName(people, m.requester_id)} · recommended by GM/CFO`, amount: Number(m.amount), at: String(m.stage_at ?? m.submitted_at ?? m.created_at ?? ''), kind: 'money' as const })),
    ...fin.runs.filter((r) => r.status === 'reviewed').map((r) => ({ id: r.id, title: `Payroll ${r.period}`, sub: `${r.headcount} people · checked by GM/CFO`, amount: Number(r.net), at: String(r.reviewed_at ?? r.created_at ?? ''), kind: 'payroll' as const })),
    ...proposals.filter((p) => p.status === 'awaiting_approval').map((p) => ({ id: p.id, title: `Proposal discount ${p.discount_pct}% · ${p.client_name}`, sub: p.title, amount: proposalTotals(p).total, at: p.created_at, kind: 'proposal' as const, link: `/os/growth/proposals/${p.id}` })),
  ];
  if (!fin.requests.length) notes.filter((n) => n.kind === 'approval' && !n.read_at && !proposals.some((p) => n.link.includes(p.id))).forEach((n) => approvals.push({ id: n.id, title: n.title, sub: n.body, amount: 0, at: n.created_at, kind: 'other', link: n.link }));
  approvals.sort((a, b) => a.at.localeCompare(b.at));

  const monthIncome = income.filter((r) => rowDate(r).startsWith(monthKey())).reduce((s, r) => s + rowAmount(r), 0);
  const revTarget = targets.find((t) => t.metric === 'revenue');
  const monthTarget = revTarget ? revTarget.target / 12 : 0;
  const fallbackMonth = ret.retainers.filter((r) => r.status === 'active').reduce((s, r) => s + r.monthly_fee, 0);
  const monthActual = income.length ? monthIncome : fallbackMonth;

  const active = projects.filter((p) => !['Archive', 'Invoice'].includes(p.stage));
  const red = active.filter((p) => p.health === 'red');
  const amber = active.filter((p) => p.health === 'amber');
  const onShoot = [
    ...active.filter((p) => p.stage === 'Shoot').map((p) => ({ who: `${personName(people, p.lead_id)} + crew`, where: `${p.name} · ${p.location}`, live: true })),
    ...ret.items.filter((i) => i.date === today && (i.kind === 'shoot' || i.kind === 'podcast')).map((i: CalItem) => ({ who: i.crew.map((c) => personName(people, c.user_id).split(' ')[0]).join(', '), where: `${clients.find((c) => c.id === i.client_id)?.name ?? ''} · ${i.title}`, live: i.status !== 'Completed' && i.status !== 'Wrapped' })),
  ];
  // Leave and daily reports come from the people module when it exists; demo shows a sample.
  // Team pulse: who is on approved leave today, and who has not filed last week's report.
  const monday = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7); return d.toISOString().slice(0, 10); })();
  const pulse = {
    leave: leaveRows.filter((l) => l.status === 'Approved' && l.start_date <= today && l.end_date >= today).map((l) => `${personName(people, l.user_id)} (${l.leave_type.toLowerCase()}, back ${l.end_date})`),
    reportsMissing: people.filter((p) => p.roles.some((r) => r !== 'client' && r !== 'boss')).filter((p) => !reportRows.some((w) => w.author_id === p.id && w.week_start >= monday)).map((p) => p.full_name),
  };
  const pipe = pipelineTotals(crm.leads);
  const atRisk = ret.retainers.filter((r) => ret.health(r).tone !== 'green');
  const newBookings = bookings.filter((b) => b.status === 'new');
  const tendersSoon = tenders.filter((t) => ['Identified', 'Preparing'].includes(t.status) && daysBetween(t.closes_on) >= 0 && daysBetween(t.closes_on) <= 7);
  const openConcerns = ret.concerns.filter((c) => c.status !== 'Resolved');

  const alerts: { tone: Tone; text: string; link: string }[] = [
    ...red.map((p) => ({ tone: 'red' as Tone, text: `${p.name} is red · stage ${p.stage}`, link: '/os' })),
    ...overdueInv.slice(0, 3).map((i) => ({ tone: 'red' as Tone, text: `Invoice ${i.number} overdue · ${tshShort(i.amount)}`, link: '/os' })),
    ...openConcerns.map((c) => ({ tone: (c.severity === 'High' ? 'red' : 'amber') as Tone, text: `Client concern: ${c.subject}`, link: '/os/retainers/concerns' })),
    ...renewals.map((c) => ({ tone: 'amber' as Tone, text: `${c.title} renews in ${daysBetween(c.end_date)} days`, link: '/os/growth/contracts' })),
    ...tendersSoon.map((t) => ({ tone: 'amber' as Tone, text: `Tender closes ${dmy(t.closes_on)}: ${t.title}`, link: '/os/growth/tenders' })),
    ...pipe.overdue.slice(0, 3).map((l) => ({ tone: 'amber' as Tone, text: `Overdue next action: ${l.title} (${crm.orgName(l.organisation_id)})`, link: '/os/growth' })),
    ...(newBookings.length ? [{ tone: 'blue' as Tone, text: `${newBookings.length} new website booking${newBookings.length > 1 ? 's' : ''} to convert`, link: '/os/growth/inbox' }] : []),
  ];

  return { people, crm, projects, active, red, amber, approvals, monthActual, monthTarget, usingIncome: income.length > 0, income, expenses, overdueInv, onShoot, pulse, pipe, atRisk, ret, renewals, tendersSoon, openConcerns, alerts, targets, activity, heat, newBookings, clients };
}
export type BossData = ReturnType<typeof useBoss>;

/** Deterministic "three things that need your attention". Each rule scores urgency; the top three win. */
export function attention(b: BossData): { score: number; title: string; why: string; link: string }[] {
  const out: { score: number; title: string; why: string; link: string }[] = [];
  const overdueTotal = b.overdueInv.reduce((s, i) => s + i.amount, 0);
  if (overdueTotal > 0) {
    const oldest = Math.max(...b.overdueInv.map((i) => -daysBetween(i.due_date || todayIso())));
    out.push({ score: 70 + Math.min(25, oldest / 2), title: `Collect ${tshShort(overdueTotal)} in overdue invoices`, why: `${b.overdueInv.length} invoice${b.overdueInv.length > 1 ? 's' : ''}, oldest ${oldest} days late. Ask Finance for a call list today.`, link: '/os' });
  }
  if (b.approvals.length) {
    const age = Math.round((Date.now() - new Date(b.approvals[0].at).getTime()) / DAY);
    out.push({ score: 60 + age * 5, title: `Clear ${b.approvals.length} approval${b.approvals.length > 1 ? 's' : ''} waiting for you`, why: `Oldest has waited ${age} day${age === 1 ? '' : 's'}; work is blocked until you decide.`, link: '/app?tab=approvals' });
  }
  for (const p of b.red) out.push({ score: 75, title: `Get a recovery plan for “${p.name}”`, why: `Project is red at stage ${p.stage}; due ${dmy(p.end_date)}. Ask ${personName(b.people, p.lead_id)} for a plan by tomorrow.`, link: '/os' });
  for (const r of b.ret.retainers) {
    const d = daysBetween(r.end_date), h = b.ret.health(r), name = b.clients.find((c) => c.id === r.client_id)?.name ?? '';
    if (d >= 0 && d <= 60) out.push({ score: 80 - d / 2, title: `Start the renewal talk with ${name}`, why: `Retainer (${tshShort(r.monthly_fee)}/month) ends in ${d} days; health ${h.tone}.`, link: `/os/retainers/${r.id}` });
    else if (h.tone === 'red') out.push({ score: 72, title: `Call ${name} — retainer at risk`, why: h.reasons.join('; '), link: `/os/retainers/${r.id}` });
    const use = b.ret.balance(r).filter((x) => x.pct >= 90);
    if (use.length) out.push({ score: 45, title: `Offer ${name} an upgrade`, why: `${use.map((x) => x.label).join(', ')} at 90%+ of this month’s allowance — they need more than their tier.`, link: `/os/retainers/${r.id}` });
  }
  for (const l of b.pipe.overdue) if (l.value >= 15e6) out.push({ score: 55 + l.value / 2e6, title: `Unblock “${l.title}” (${tshShort(l.value)})`, why: `Next action “${l.next_action}” was due ${dmy(l.next_action_date)}.`, link: '/os/growth' });
  for (const l of b.crm.leads) {
    const h = b.heat(l.id);
    if (h?.temp === 'hot' && ['New', 'Contacted', 'Meeting', 'Proposal Sent'].includes(l.stage)) out.push({ score: 58, title: `Hot lead: ${b.crm.orgName(l.organisation_id)}`, why: `They said “I need something like this” on their showcase (score ${h.score}). Move to a deal room.`, link: '/os/share/deals' });
  }
  if (b.monthTarget && new Date().getDate() >= 15 && b.monthActual < b.monthTarget * 0.6) out.push({ score: 65, title: 'Revenue behind this month’s target', why: `${tshShort(b.monthActual)} of ${tshShort(b.monthTarget)} with half the month gone.`, link: '/os/boss/scoreboard' });
  for (const c of b.openConcerns) out.push({ score: c.severity === 'High' ? 68 : 40, title: `Answer the client concern “${c.subject}”`, why: `Open since ${dmy(c.created_at)} (${c.severity}).`, link: '/os/retainers/concerns' });
  for (const t of b.tendersSoon) out.push({ score: 50 + (7 - daysBetween(t.closes_on)) * 3, title: `Go / no-go on tender “${t.title}”`, why: `Closes ${dmy(t.closes_on)} · ${tshShort(t.value_estimate)}.`, link: '/os/growth/tenders' });
  return out.sort((a, b2) => b2.score - a.score).slice(0, 3);
}

function Tile({ icon, label, value, sub, tone, onClick, to }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; onClick?: () => void; to?: string }) {
  const Link = GoLink;
  const body = (
    <>
      <span className="flex items-center justify-between text-[13px] text-basil-muted"><span className="flex items-center gap-1.5">{icon}{label}</span>{(onClick || to) && <ChevronRight size={16} />}</span>
      <span className={`font-display text-2xl font-extrabold ${tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700' : tone === 'green' ? 'text-emerald-700' : tone === 'gold' ? 'text-[#8a6d1f]' : 'text-basil-ink'}`}>{value}</span>
      {sub && <span className="text-xs text-basil-muted">{sub}</span>}
    </>
  );
  const cls = 'flex min-h-[96px] min-w-0 flex-col gap-1 rounded-2xl border border-basil-line bg-white p-4 text-left text-basil-ink no-underline';
  return to ? <Link to={to} className={cls}>{body}</Link> : onClick ? <button type="button" onClick={onClick} className={cls}>{body}</button> : <div className={cls}>{body}</div>;
}

/** "Today at a glance" — used on the Boss phone Home tab and the desktop cockpit. */
export function TodayGlance({ onApprovals, onProjects, desktop = false }: { onApprovals?: () => void; onProjects?: () => void; desktop?: boolean }) {
  const b = useBoss();
  const phone = useInPhone();
  const Link = GoLink;
  // On the phone, links into the approvals/projects tabs switch tab instead of leaving the app.
  const tabLink = (to: string): { to?: string; onClick?: () => void } => (to.startsWith('/app?tab=approvals') ? { onClick: onApprovals } : phone && to === '/os' ? { onClick: onProjects } : { to });
  const { userId } = useActing();
  const first = personName(b.people, userId).split(' ')[0];
  const pct = b.monthTarget ? Math.round((b.monthActual / b.monthTarget) * 100) : 0;
  const things = attention(b);
  const oldest = b.approvals[0];
  return (
    <div className="flex flex-col gap-4">
      {!desktop && (
        <div>
          <div className="font-mono text-[11px] tracking-[0.16em] text-[#8a6d1f]">BOSS · {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()}</div>
          <h1 className="m-0 font-display text-2xl font-extrabold">Habari, {first}</h1>
        </div>
      )}
      <button type="button" onClick={onApprovals} className="flex items-center gap-3 rounded-[22px] border-0 p-4 text-left text-white" style={{ background: 'linear-gradient(135deg,#B8860B,#7A5E12)' }}>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 font-display text-xl font-extrabold">{b.approvals.length}</span>
        <span className="min-w-0 flex-1"><b className="block">Needs your approval</b><span className="block truncate text-sm text-white/85">{oldest ? `Oldest: ${oldest.title}${oldest.amount ? ` · ${tshShort(oldest.amount)}` : ''} · ${dmy(oldest.at)}` : 'Nothing waiting — all clear'}</span></span>
        <ChevronRight />
      </button>
      <CashGlance />
      <div className={`grid gap-3 ${desktop ? 'grid-cols-2 xl:grid-cols-4' : 'grid-cols-2'}`}>
        <div className="col-span-2 flex items-center gap-4 rounded-2xl border border-basil-line bg-white p-4 xl:col-span-1">
          <Ring value={b.monthActual} max={b.monthTarget || 1} size={72} color="#B8860B" />
          <span className="min-w-0"><span className="block text-[13px] text-basil-muted">This month vs target</span><b className="font-display text-xl">{tshShort(b.monthActual)}</b><span className="block text-xs text-basil-muted">of {tshShort(b.monthTarget)} · {pct}%{!b.usingIncome && ' · from retainers (no income posted yet)'}</span></span>
        </div>
        <Tile icon={<Briefcase size={15} />} label="Projects" value={b.active.length} sub={<><span className="text-emerald-700">{b.active.length - b.red.length - b.amber.length} ok</span> · <span className="text-amber-700">{b.amber.length} risk</span> · <span className="text-red-700">{b.red.length} red</span></>} tone={b.red.length ? 'red' : undefined} {...tabLink('/os')} />
        <Tile icon={<TrendingUp size={15} />} label="Pipeline" value={tshShort(b.pipe.value)} sub={`${b.pipe.count} open leads`} tone="gold" to="/os/growth" />
        <Tile icon={<Users size={15} />} label="Retainers at risk" value={b.atRisk.length} sub={`of ${b.ret.retainers.length} · ${b.renewals.length} renewal${b.renewals.length === 1 ? '' : 's'} due`} tone={b.atRisk.length ? 'amber' : 'green'} to={desktop ? '/os/retainers' : '/os/boss/risk'} />
      </div>
      <Card title={<span className="flex items-center gap-2"><Users size={16} />People today</span>}>
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
          {b.onShoot.map((s, i) => <li key={i} className="flex items-start gap-2"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${s.live ? 'bg-red-500' : 'bg-emerald-500'}`} /><span><b>{s.who}</b> <span className="text-basil-muted">· {s.where}</span></span>{s.live && <Pill tone="red">On shoot</Pill>}</li>)}
          {b.onShoot.length === 0 && <li className="text-basil-muted">Nobody on a shoot today.</li>}
          {b.pulse.leave.map((x) => <li key={x} className="text-basil-muted">On leave: <b className="text-basil-ink">{x}</b></li>)}
          {b.pulse.reportsMissing.length > 0 && <li className="text-amber-800">Yesterday’s report missing: <b>{b.pulse.reportsMissing.join(', ')}</b></li>}
        </ul>
      </Card>
      <Card title={<span className="flex items-center gap-2"><Lightbulb size={16} className="text-[#B8860B]" />Three things that need your attention</span>}>
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {things.map((t, i) => {
            const tl = tabLink(t.link);
            const cls = 'flex w-full gap-3 rounded-xl border-0 bg-[#FBF4E2] p-3 text-left text-basil-ink no-underline';
            const inner = <><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#B8860B] text-sm font-bold text-white">{i + 1}</span><span className="text-sm"><b className="block">{t.title}</b><span className="text-basil-muted">{t.why}</span></span></>;
            return <li key={i}>{tl.to ? <Link to={tl.to} className={cls}>{inner}</Link> : <button type="button" onClick={tl.onClick} className={cls}>{inner}</button>}</li>;
          })}
          {things.length === 0 && <li className="text-sm text-basil-muted">Nothing pressing. Good week.</li>}
        </ol>
      </Card>
      {b.alerts.length > 0 && (
        <Card title={<span className="flex items-center gap-2"><AlertTriangle size={16} />Alerts</span>}>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {b.alerts.slice(0, desktop ? 12 : 6).map((a, i) => {
              const tl = tabLink(a.link);
              const cls = 'flex min-h-[44px] w-full items-center gap-2 border-0 bg-transparent p-0 text-left text-sm text-basil-ink no-underline';
              const inner = <><span className={`h-2 w-2 shrink-0 rounded-full ${a.tone === 'red' ? 'bg-red-600' : a.tone === 'amber' ? 'bg-amber-500' : 'bg-basil'}`} /><span className="flex-1">{a.text}</span><ChevronRight size={16} className="shrink-0 text-basil-muted" /></>;
              return <li key={i}>{tl.to ? <Link to={tl.to} className={cls}>{inner}</Link> : <button type="button" onClick={tl.onClick} className={cls}>{inner}</button>}</li>;
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

export function BossCockpit() {
  const scroll = () => document.getElementById('approvals')?.scrollIntoView({ behavior: 'smooth' });
  return (
    <div>
      <PageHead tag="BOSS · COCKPIT" title="Today at a glance" sub={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Dar_es_Salaam' })}>
        <div className="flex flex-wrap gap-2"><GoLink to="/os/boss/briefing" className="btn-outline"><CalendarClock size={16} />Monday briefing</GoLink><GoLink to="/os/boss/scoreboard" className="btn-outline"><TargetIcon size={16} />Scoreboard</GoLink><GoLink to="/os/boss/decisions" className="btn-outline"><Gavel size={16} />Decisions</GoLink></div>
      </PageHead>
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <TodayGlance desktop onApprovals={scroll} />
        <div className="flex flex-col gap-4">
          <section id="approvals" className="rounded-2xl border border-basil-line bg-white p-4"><h2 className="m-0 mb-3 text-base font-extrabold">Approvals</h2><ApprovalsInbox /><ProposalApprovals /></section>
          <ScoreboardMini />
        </div>
      </div>
    </div>
  );
}

/** Proposal discounts waiting for the boss, decided in place. Money approvals live in ApprovalsInbox. */
export function ProposalApprovals() {
  const { rows } = useTable<Proposal>('proposals', { order: 'created_at' });
  const { can } = useActing();
  const people = usePeople();
  const toast = useToast();
  const items = rows.filter((p) => p.status === 'awaiting_approval');
  if (!items.length) return null;
  const decide = async (p: Proposal, ok: boolean) => {
    try {
      await rpc('approve_proposal', { _id: p.id, _approve: ok });
      toast(ok ? `Discount approved · ${p.client_name}` : 'Sent back to draft');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-basil-line pt-3">
      <b className="text-sm">Proposal discounts</b>
      {items.map((p) => {
        const t = proposalTotals(p);
        return (
          <div key={p.id} className="flex flex-col gap-2 rounded-2xl bg-[#FBF4E2] p-3 text-sm">
            <GoLink to={`/os/growth/proposals/${p.id}`} className="flex items-start justify-between gap-2 text-basil-ink no-underline"><span className="min-w-0"><b className="block">{p.client_name} · {p.discount_pct}% off</b><span className="text-basil-muted">{p.title} · by {personName(people, p.created_by)}</span></span><span className="shrink-0 text-right"><b className="block">{tshShort(t.total)}</b><span className="text-xs text-amber-800">−{tshShort(t.disc)}</span></span></GoLink>
            {can('boss') && (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn-outline bg-white" onClick={() => decide(p, false)}><Undo2 size={16} />Send back</button>
                <button type="button" className="btn-primary" onClick={() => decide(p, true)}><Check size={16} />Approve</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Monday briefing ----------
export function MondayBriefing() {
  const b = useBoss();
  const weekAgo = isoPlus(-7), today = todayIso();
  const inWeek = (d: string) => d >= weekAgo && d <= today;
  const inc = b.income.filter((r) => inWeek(rowDate(r))).reduce((s, r) => s + rowAmount(r), 0);
  const exp = b.expenses.filter((r) => inWeek(rowDate(r))).reduce((s, r) => s + rowAmount(r), 0);
  const due = b.active.filter((p) => p.end_date >= today && p.end_date <= isoPlus(7));
  const moves = b.activity.filter((a) => a.created_at.slice(0, 10) >= weekAgo);
  const won = moves.filter((a) => a.to_stage === 'Won'), lost = moves.filter((a) => a.to_stage === 'Lost'), created = moves.filter((a) => a.kind === 'created');
  const lead = (id: string) => b.crm.leads.find((l) => l.id === id);
  const things = attention(b);
  const suggestions = [
    ...b.ret.retainers.filter((r) => renewalBand(r.end_date)).map((r) => `Book the renewal meeting with ${b.clients.find((c) => c.id === r.client_id)?.name} (ends ${dmy(r.end_date)}).`),
    ...(b.newBookings.length ? [`Convert ${b.newBookings.length} website booking${b.newBookings.length > 1 ? 's' : ''} into leads.`] : []),
    ...b.pipe.overdue.slice(0, 2).map((l) => `Chase “${l.next_action}” for ${l.title}.`),
    ...b.tendersSoon.map((t) => `Confirm documents for tender ${t.reference} (closes ${dmy(t.closes_on)}).`),
  ].slice(0, 5);
  const Row = ({ k, v, tone }: { k: string; v: ReactNode; tone?: string }) => <div className="flex justify-between gap-3 border-b border-basil-line/70 py-1.5 text-sm"><span className="shrink-0 text-basil-muted">{k}</span><b className={`text-right ${tone ?? ''}`}>{v}</b></div>;
  return (
    <div>
      <PageHead tag="BOSS · MONDAY BRIEFING" title="Monday briefing" sub="Generated automatically from every module. One page — print it or read it on the phone."><PrintButton label="Print briefing" /></PageHead>
      <PrintArea>
        <article className="mx-auto max-w-3xl rounded-2xl border border-basil-line bg-white p-4 sm:p-8">
          <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b-2 border-[#B8860B] pb-3">
            <div><div className="font-display text-xl font-extrabold text-basil-deep">Basil Media · Monday briefing</div><div className="text-sm text-basil-muted">Week {dmy(weekAgo)} – {dmy(today)}</div></div>
            <Pill tone="gold">For Emmanuel Basil</Pill>
          </header>
          <section className="mb-5 break-inside-avoid">
            <h2 className="m-0 mb-2 text-lg font-extrabold">Three things that need your attention</h2>
            <ol className="m-0 flex flex-col gap-2 pl-4">{things.map((t, i) => <li key={i} className="text-sm"><b>{t.title}.</b> {t.why}</li>)}{things.length === 0 && <li className="text-sm">Nothing urgent this week.</li>}</ol>
          </section>
          <div className="grid gap-5 sm:grid-cols-2">
            <section className="break-inside-avoid">
              <h3 className="m-0 mb-1 text-base font-extrabold"><CircleDollarSign size={15} className="mr-1 inline" />Money last week</h3>
              <Row k="Income" v={b.income.length ? tsh(inc) : 'Not recorded yet'} tone="text-emerald-700" />
              <Row k="Expenses" v={b.expenses.length ? tsh(exp) : 'Not recorded yet'} tone="text-red-700" />
              <Row k="Net" v={b.income.length || b.expenses.length ? tsh(inc - exp) : '—'} />
              <Row k="Overdue invoices" v={b.overdueInv.length ? `${b.overdueInv.length} · ${tshShort(b.overdueInv.reduce((s, i) => s + i.amount, 0))}` : 'None'} tone={b.overdueInv.length ? 'text-red-700' : ''} />
              <Row k="Approvals waiting" v={b.approvals.length} tone={b.approvals.length ? 'text-amber-700' : ''} />
            </section>
            <section className="break-inside-avoid">
              <h3 className="m-0 mb-1 text-base font-extrabold"><TrendingUp size={15} className="mr-1 inline" />Pipeline movement</h3>
              <Row k="New leads" v={created.length} />
              <Row k="Won" v={won.length ? won.map((a) => `${lead(a.lead_id)?.title ?? ''} (${tshShort(lead(a.lead_id)?.value ?? 0)})`).join(', ') : '—'} tone="text-emerald-700" />
              <Row k="Lost" v={lost.length ? lost.map((a) => `${lead(a.lead_id)?.title ?? ''} — ${a.body || lead(a.lead_id)?.lost_reason || ''}`).join(', ') : '—'} tone="text-red-700" />
              <Row k="Stage moves" v={moves.filter((a) => a.kind === 'stage').length} />
              <Row k="Open pipeline" v={`${tshShort(b.pipe.value)} (weighted ${tshShort(b.pipe.weighted)})`} />
            </section>
            <section className="break-inside-avoid">
              <h3 className="m-0 mb-1 text-base font-extrabold"><Briefcase size={15} className="mr-1 inline" />Projects due in 7 days</h3>
              {due.length ? due.map((p) => <Row key={p.id} k={p.name} v={`${dmy(p.end_date)} · ${p.health}`} tone={p.health === 'red' ? 'text-red-700' : p.health === 'amber' ? 'text-amber-700' : 'text-emerald-700'} />) : <p className="m-0 text-sm text-basil-muted">None.</p>}
              {b.red.filter((p) => !due.includes(p)).map((p) => <Row key={p.id} k={`${p.name} (red)`} v={p.stage} tone="text-red-700" />)}
            </section>
            <section className="break-inside-avoid">
              <h3 className="m-0 mb-1 text-base font-extrabold"><Lightbulb size={15} className="mr-1 inline" />Suggestions</h3>
              <ul className="m-0 flex flex-col gap-1 pl-5 text-sm">{suggestions.map((s) => <li key={s}>{s}</li>)}{suggestions.length === 0 && <li>Keep going.</li>}</ul>
            </section>
          </div>
        </article>
      </PrintArea>
    </div>
  );
}

// ---------- scoreboard ----------
function useTargets() {
  return useTable<Target>('scoreboard_targets', { eq: { year: new Date().getFullYear() }, order: 'sort_order' }).rows;
}
function ScoreboardMini() {
  const rows = useTargets();
  return (
    <Card title="Scoreboard" action={<GoLink to="/os/boss/scoreboard" className="inline-flex min-h-[44px] items-center text-sm font-bold">Open <ArrowRight size={14} className="inline" /></GoLink>}>
      <div className="grid grid-cols-3 gap-3">{rows.slice(0, 6).map((t) => <Ring key={t.id} value={t.actual} max={t.target} size={64} color="#B8860B" label={t.label} />)}</div>
    </Card>
  );
}
export function Scoreboard() {
  const rows = useTargets();
  const { can } = useActing();
  const toast = useToast();
  const [edit, setEdit] = useState<Partial<Target> | null>(null);
  const editor = can('boss');
  const yearPct = Math.round(((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (365 * DAY)) * 100);
  const save = async () => {
    try {
      if (!edit?.label || !edit.target) throw new Error('Label and target are required');
      const row = { year: new Date().getFullYear(), metric: edit.metric || edit.label.toLowerCase().replace(/\W+/g, '_'), label: edit.label, unit: edit.unit ?? 'count', target: Number(edit.target), actual: Number(edit.actual) || 0, sort_order: edit.sort_order ?? rows.length + 1 };
      if (edit.id) await updateRow('scoreboard_targets', edit.id, row);
      else await insertRow('scoreboard_targets', row);
      setEdit(null);
      toast('Target saved');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <div>
      <PageHead tag="BOSS · SCOREBOARD" title={`Company scoreboard ${new Date().getFullYear()}`} sub={`${yearPct}% of the year gone. Gold ring = progress to the yearly target.`}>
        {editor && <button type="button" className="btn-primary" onClick={() => setEdit({ unit: 'count' })}><Plus size={16} />Target</button>}
      </PageHead>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {rows.map((t) => {
          const p = t.target ? Math.round((t.actual / t.target) * 100) : 0;
          const tone: Tone = p >= yearPct ? 'green' : p >= yearPct - 15 ? 'amber' : 'red';
          return (
            <button key={t.id} type="button" disabled={!editor} onClick={() => setEdit(t)} className="flex flex-col items-center gap-2 rounded-2xl border border-basil-line bg-white p-4 text-center disabled:cursor-default">
              <Ring value={t.actual} max={t.target} size={96} stroke={10} color="#B8860B" />
              <b>{t.label}</b>
              <span className="text-sm text-basil-muted">{fmtUnit(t, t.actual)} of {fmtUnit(t, t.target)}</span>
              <Pill tone={tone}>{tone === 'green' ? 'Ahead of pace' : tone === 'amber' ? 'Slightly behind' : 'Behind pace'}</Pill>
            </button>
          );
        })}
        {rows.length === 0 && <Empty title="No targets set" />}
      </div>
      {!editor && <p className="mt-3 text-sm text-basil-muted">Only the boss can change targets.</p>}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit target' : 'New target'}>
        {edit && (
          <div className="flex flex-col gap-3">
            <Field label="Label"><input className={inputCls} value={edit.label ?? ''} onChange={(e) => setEdit({ ...edit, label: e.target.value })} /></Field>
            <Field label="Unit"><select className={inputCls} value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value as Target['unit'] })}><option value="tsh">TSH</option><option value="count">Count</option><option value="pct">Percent</option></select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Yearly target"><input className={inputCls} inputMode="numeric" value={edit.target ?? ''} onChange={(e) => setEdit({ ...edit, target: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></Field>
              <Field label="Actual so far"><input className={inputCls} inputMode="numeric" value={edit.actual ?? ''} onChange={(e) => setEdit({ ...edit, actual: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></Field>
            </div>
            <button type="button" className="btn-primary" onClick={save}>Save</button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

// ---------- decision log ----------
export function DecisionLog() {
  const { rows } = useTable<Decision>('decisions', { order: 'decided_on', ascending: false });
  const people = usePeople();
  const { can, userId } = useActing();
  const toast = useToast();
  const [edit, setEdit] = useState<Partial<Decision> | null>(null);
  const editor = can('boss', 'gm_cfo');
  const save = async () => {
    try {
      if (!edit?.title || !edit.decision) throw new Error('Title and decision are required');
      const row = { decided_on: edit.decided_on ?? todayIso(), title: edit.title, context: edit.context ?? '', decision: edit.decision, decided_by: edit.decided_by ?? userId, owner_id: edit.owner_id ?? userId, review_on: edit.review_on || null, status: edit.status ?? 'Active' };
      if (edit.id) await updateRow('decisions', edit.id, row);
      else await insertRow('decisions', row);
      setEdit(null);
      toast('Decision logged');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <div>
      <PageHead tag="BOSS · DECISIONS" title="Decision log" sub="What we decided, why, who owns it and when we review it.">
        {editor && <button type="button" className="btn-primary" onClick={() => setEdit({ decided_on: todayIso(), status: 'Active' })}><Plus size={16} />Decision</button>}
      </PageHead>
      <div className="flex flex-col gap-3">
        {rows.map((d) => {
          const review = d.review_on && d.status === 'Active' && d.review_on <= isoPlus(7);
          return (
            <button key={d.id} type="button" disabled={!editor} onClick={() => setEdit(d)} className="flex flex-col gap-1 rounded-2xl border border-basil-line bg-white p-4 text-left disabled:cursor-default">
              <span className="flex flex-wrap items-start justify-between gap-2"><b>{d.title}</b><span className="flex gap-1.5">{review && <Pill tone="amber">Review {dmy(d.review_on)}</Pill>}<Pill tone={d.status === 'Active' ? 'blue' : d.status === 'Reversed' ? 'red' : 'green'}>{d.status}</Pill></span></span>
              <span className="text-sm text-basil-muted">{dmy(d.decided_on)} · decided by {personName(people, d.decided_by)} · owner {personName(people, d.owner_id)}</span>
              {d.context && <span className="text-sm text-basil-muted">Why: {d.context}</span>}
              <span className="text-sm">{d.decision}</span>
            </button>
          );
        })}
        {rows.length === 0 && <Empty icon={<Inbox />} title="No decisions logged" />}
      </div>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit decision' : 'Log a decision'}>
        {edit && (
          <div className="flex flex-col gap-3">
            <Field label="Title"><input className={inputCls} value={edit.title ?? ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <Field label="Context"><textarea className={`${inputCls} h-20 py-2`} value={edit.context ?? ''} onChange={(e) => setEdit({ ...edit, context: e.target.value })} /></Field>
            <Field label="Decision"><textarea className={`${inputCls} h-24 py-2`} value={edit.decision ?? ''} onChange={(e) => setEdit({ ...edit, decision: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date"><input type="date" className={inputCls} value={edit.decided_on ?? ''} onChange={(e) => setEdit({ ...edit, decided_on: e.target.value })} /></Field>
              <Field label="Review on"><input type="date" className={inputCls} value={edit.review_on ?? ''} onChange={(e) => setEdit({ ...edit, review_on: e.target.value })} /></Field>
              <Field label="Owner"><select className={inputCls} value={edit.owner_id ?? userId} onChange={(e) => setEdit({ ...edit, owner_id: e.target.value })}>{people.filter((p) => !p.roles.includes('client')).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></Field>
              <Field label="Status"><select className={inputCls} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as Decision['status'] })}><option>Active</option><option>Reviewed</option><option>Reversed</option></select></Field>
            </div>
            <button type="button" className="btn-primary" onClick={save}>Save</button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
