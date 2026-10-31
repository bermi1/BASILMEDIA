// Stable exports used by other roles' phone apps: ApprovalsInbox, MyMoneyRequests, CashGlance, MyPayslips.
// Plus finance-only phone screens used by the GM/CFO and Finance apps.
import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Fingerprint, Inbox, Plus, Receipt, Wallet } from 'lucide-react';
import { useActing } from '@/os/lib/session';
import { useTable } from '@/os/lib/store';
import { useToast } from '@/os/cms/toast';
import { Card, Empty, Pill, Progress, Sheet, Stat, StageTracker, Tabs, tsh, tshShort } from '@/os/ui';
import './seed';
import {
  approvePayroll, bossDecide, fmtDate, monthLabel, retireDue, reviewPayroll, runStage, unretiredFor, useFinance,
  type Fin, type MoneyRequest, type PayrollRun, type Payslip,
} from './lib';
import { EscalationPill, PayForm, RequestDetail, RequestForm, RequestRow, StatusPill, StepUpSheet, SwipeApproveCard, errMsg, useNames, waitingHours } from './components';

/** Bottom-sheet that shows one request with the right actions for the acting role. */
function RequestSheet({ id, fin, onClose }: { id: string | null; fin: Fin; onClose: () => void }) {
  const r = fin.requests.find((x) => x.id === id);
  return <Sheet open={!!r} onClose={onClose} title={r?.number ?? ''}>{r && <RequestDetail r={r} fin={fin} onDone={onClose} />}</Sheet>;
}

// ---------------------------------------------------------------- Approvals inbox (role-adaptive)
export function ApprovalsInbox() {
  const { role } = useActing();
  const fin = useFinance();
  if (role === 'boss') return <BossInbox fin={fin} />;
  if (role === 'gm_cfo') return <GmInbox fin={fin} />;
  return <MyMoneyRequests />;
}

function BossInbox({ fin }: { fin: Fin }) {
  const { role, userId } = useActing();
  const toast = useToast();
  const name = useNames();
  const [open, setOpen] = useState<string | null>(null);
  const [approve, setApprove] = useState<MoneyRequest[] | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const items = [...fin.waitingBoss].sort((a, b) => waitingHours(b) - waitingHours(a));
  const total = items.reduce((s, r) => s + Number(r.amount), 0);
  const payroll = fin.runs.filter((r) => r.status === 'reviewed');
  const selected = items.filter((r) => sel.includes(r.id));
  const doApprove = async (by: 'pin' | 'passkey') => {
    const list = approve ?? [];
    for (const r of list) await bossDecide(r.id, 'approve', { verified_by: by }, { role, userId });
    toast(list.length > 1 ? `${list.length} requests approved · Finance pays next` : `Approved · Finance will pay ${name(list[0]?.requester_id).split(' ')[0]}`);
    setSel([]); setSelecting(false);
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-2">
        <div><h2 className="m-0 text-xl font-extrabold">Approvals</h2><p className="m-0 text-sm text-basil-muted">{items.length} waiting · {tsh(total)}{items.some((r) => r.reviewed_by) ? ' · checked by GM/CFO' : ''}</p></div>
        {items.length > 1 && <button type="button" onClick={() => { setSelecting(!selecting); setSel([]); }} className="min-h-[40px] rounded-full border border-basil-edge bg-white px-3 text-sm font-bold">{selecting ? 'Cancel' : 'Select'}</button>}
      </div>
      {payroll.map((run) => <PayrollApprovalCard key={run.id} run={run} />)}
      {!items.length && !payroll.length && <Empty icon={<CheckCircle2 />} title="All clear" sub="Nothing is waiting for you." />}
      {selecting
        ? items.map((r) => <RequestRow key={r.id} r={r} fin={fin} onOpen={() => setOpen(r.id)} selected={sel.includes(r.id)} onSelect={() => setSel(sel.includes(r.id) ? sel.filter((x) => x !== r.id) : [...sel, r.id])} />)
        : items.map((r) => <SwipeApproveCard key={r.id} r={r} fin={fin} onOpen={() => setOpen(r.id)} onApprove={() => (r.question ? toast('Waiting for an answer to your question', 'error') : setApprove([r]))} onReject={() => setOpen(r.id)} />)}
      {!selecting && items.length > 0 && <p className="m-0 text-center text-xs text-basil-muted">Swipe right to approve, left to reject · tap for details</p>}
      {selecting && selected.length > 0 && (
        <button type="button" onClick={() => setApprove(selected.filter((r) => !r.question))} className="sticky bottom-24 flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border-0 bg-emerald-600 font-bold text-white shadow-card"><Fingerprint size={20} />Approve {selected.length} · {tsh(selected.reduce((s, r) => s + Number(r.amount), 0))}</button>
      )}
      <StepUpSheet open={!!approve?.length} onClose={() => setApprove(null)} title={approve && approve.length > 1 ? `Approving ${approve.length} requests · ${tsh(approve.reduce((s, r) => s + Number(r.amount), 0))}` : `Approving ${tsh(approve?.[0]?.amount)}`} sub={approve?.length === 1 ? `to ${name(approve[0].requester_id)} · ${approve[0].purpose}` : 'Batch approval'} onVerified={doApprove} />
      <RequestSheet id={open} fin={fin} onClose={() => setOpen(null)} />
    </div>
  );
}

function PayrollApprovalCard({ run }: { run: PayrollRun }) {
  const { role, userId } = useActing();
  const toast = useToast();
  const name = useNames();
  const [step, setStep] = useState(false);
  const s = runStage(run, name);
  return (
    <div className="rounded-3xl border border-basil-line bg-white p-4">
      <div className="flex items-start justify-between gap-2"><div><span className="text-xs text-basil-muted">Payroll · {monthLabel(run.period)} · pay day {fmtDate(run.pay_day)}</span><b className="block font-display text-2xl">{tsh(run.net)} net</b><span className="text-sm text-basil-muted">{run.headcount} people · gross {tshShort(run.gross)} · PAYE {tshShort(run.paye)}</span></div><Pill tone="amber">Boss approval</Pill></div>
      {run.comment && <p className="m-0 mt-2 text-sm text-basil-muted">“{run.comment}”</p>}
      <div className="mt-3"><StageTracker {...s} /></div>
      <div className="mt-3 grid grid-cols-[1fr_2fr] gap-2">
        <button type="button" onClick={async () => { const c = prompt('What needs fixing?'); if (!c) return; try { await approvePayroll(run.id, 'return', c, null, { role, userId }); toast('Returned to Finance'); } catch (e) { toast(errMsg(e), 'error'); } }} className="btn-outline min-h-[48px]">Return</button>
        <button type="button" onClick={() => setStep(true)} className="btn-primary min-h-[48px] !bg-emerald-600"><Fingerprint size={18} />Approve payroll</button>
      </div>
      <StepUpSheet open={step} onClose={() => setStep(false)} title={`Approving payroll ${tsh(run.net)}`} sub={`${run.headcount} people · ${monthLabel(run.period)}`} onVerified={async (by) => { await approvePayroll(run.id, 'approve', '', by, { role, userId }); toast('Payroll approved · Finance pays on pay day'); }} />
    </div>
  );
}

function GmInbox({ fin }: { fin: Fin }) {
  const { role, userId } = useActing();
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const items = [...fin.waitingGm].sort((a, b) => waitingHours(b) - waitingHours(a));
  const payroll = fin.runs.filter((r) => r.status === 'prepared');
  return (
    <div className="flex flex-col gap-3">
      <div><h2 className="m-0 text-xl font-extrabold">Reviews</h2><p className="m-0 text-sm text-basil-muted">{items.length} waiting · {tsh(items.reduce((s, r) => s + Number(r.amount), 0))} · verify, then recommend to the Boss. Under {tshShort(fin.settings.approval_limits.gm_cfo_alone_below)} you approve alone.</p></div>
      {payroll.map((run) => (
        <Card key={run.id} title={`Payroll ${monthLabel(run.period)} · ${tsh(run.net)} net`}>
          <p className="m-0 mb-3 text-sm text-basil-muted">{run.headcount} people · prepared by Finance</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-outline" onClick={async () => { const c = prompt('What needs fixing?'); if (!c) return; try { await reviewPayroll(run.id, 'return', c, { role, userId }); toast('Returned'); } catch (e) { toast(errMsg(e), 'error'); } }}>Return</button>
            <button type="button" className="btn-primary" onClick={async () => { try { await reviewPayroll(run.id, 'ok', '', { role, userId }); toast('Sent to the Boss'); } catch (e) { toast(errMsg(e), 'error'); } }}>Reviewed · send</button>
          </div>
        </Card>
      ))}
      {!items.length && !payroll.length && <Empty icon={<CheckCircle2 />} title="All clear" sub="Nothing waiting for your review." />}
      {items.map((r) => <RequestRow key={r.id} r={r} fin={fin} onOpen={() => setOpen(r.id)} />)}
      <RequestSheet id={open} fin={fin} onClose={() => setOpen(null)} />
    </div>
  );
}

// ---------------------------------------------------------------- My requests
export function MyMoneyRequests() {
  const { userId } = useActing();
  const fin = useFinance();
  const [form, setForm] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'done'>('active');
  const mine = fin.requests.filter((r) => r.requester_id === userId);
  const active = mine.filter((r) => !['reconciled', 'rejected'].includes(r.status));
  const list = tab === 'active' ? active : mine.filter((r) => ['reconciled', 'rejected'].includes(r.status));
  const toRetire = mine.filter((r) => r.status === 'paid');
  const overdue = unretiredFor(fin.requests, userId, fin.settings.retirement_days);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div><h2 className="m-0 text-xl font-extrabold">My money requests</h2><p className="m-0 text-sm text-basil-muted">{active.length} in progress</p></div>
        <button type="button" onClick={() => setForm(true)} className="btn-primary min-h-[44px]"><Plus size={18} />Request money</button>
      </div>
      {toRetire.length > 0 && (
        <div className={`flex gap-2 rounded-2xl p-3 text-sm ${overdue.length ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`}>
          <Receipt size={18} className="shrink-0" />
          <span><b>{toRetire.length} advance{toRetire.length > 1 ? 's' : ''} to retire.</b> {overdue.length ? 'Overdue — new requests are blocked until you upload receipts.' : `Upload receipts within ${fin.settings.retirement_days} days of payment.`}</span>
        </div>
      )}
      <Tabs value={tab} onChange={setTab} items={[{ value: 'active', label: 'In progress', count: active.length }, { value: 'done', label: 'Closed' }]} />
      {!list.length && <Empty icon={<Wallet />} title={tab === 'active' ? 'No open requests' : 'Nothing closed yet'} sub="Request money for a project; you’ll see every step here." />}
      {list.map((r) => (
        <button key={r.id} type="button" onClick={() => setOpen(r.id)} className="flex flex-col gap-3 rounded-2xl border border-basil-line bg-white p-4 text-left">
          <div className="flex w-full items-start justify-between gap-2"><span className="min-w-0"><b className="block truncate">{r.purpose || 'Draft'}</b><span className="text-xs text-basil-muted">{fin.project(r.project_id)?.name} · {r.number}</span></span><b className="shrink-0 font-display">{tshShort(Number(r.approved_amount ?? r.amount))}</b></div>
          <div className="flex flex-wrap gap-1"><StatusPill status={r.status} /><EscalationPill r={r} />{r.question && <Pill tone="blue">Boss asked a question</Pill>}{r.status === 'paid' && <Pill tone="amber">Retire by {fmtDate(retireDue(r, fin.settings.retirement_days))}</Pill>}</div>
          <MiniTracker r={r} />
        </button>
      ))}
      <Sheet open={form} onClose={() => setForm(false)} title="Request money"><RequestForm fin={fin} onDone={() => setForm(false)} /></Sheet>
      <RequestSheet id={open} fin={fin} onClose={() => setOpen(null)} />
    </div>
  );
}
function MiniTracker({ r }: { r: MoneyRequest }) {
  const order = ['draft', 'gm_review', 'boss_approval', 'approved', 'paid', 'retired', 'reconciled'];
  const i = Math.max(order.indexOf(r.status), 0);
  const bad = r.status === 'rejected' || r.status === 'returned';
  return <div className="flex w-full gap-1" aria-hidden>{order.slice(1).map((s, j) => <span key={s} className={`h-1.5 flex-1 rounded-full ${bad ? (j === 0 ? 'bg-red-500' : 'bg-basil-line') : j < i ? 'bg-basil' : 'bg-basil-line'}`} />)}</div>;
}

// ---------------------------------------------------------------- Cash glance (Boss home)
export function CashGlance() {
  const fin = useFinance();
  return (
    <section className="overflow-hidden rounded-3xl p-5 text-white" style={{ background: 'linear-gradient(135deg,#0A2F5C,#0F6EC2)' }}>
      <span className="text-xs text-basil-haze">Cash position</span>
      <b className="block font-display text-[30px] leading-tight">{tsh(fin.cash + fin.bank)}</b>
      <span className="text-xs text-basil-haze">Cash {tshShort(fin.cash)} · Bank + mobile {tshShort(fin.bank)} · runway {fin.runwayMonths.toFixed(1)} months</span>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-2xl bg-white/10 p-3"><span className="block text-xs text-basil-haze">Owed to us</span><b>{tshShort(fin.outstanding)}</b></div>
        <div className="rounded-2xl bg-white/10 p-3"><span className="block text-xs text-basil-haze">Overdue</span><b className="text-amber-200">{tshShort(fin.overdue)}</b></div>
        <div className="rounded-2xl bg-white/10 p-3"><span className="block text-xs text-basil-haze">Income this month</span><b>{tshShort(fin.incomeMonth)}</b></div>
        <div className="rounded-2xl bg-white/10 p-3"><span className="block text-xs text-basil-haze">Payroll due</span><b>{fin.nextRun ? `${tshShort(fin.nextRun.net)} · ${fmtDate(fin.nextRun.pay_day).slice(0, 5)}` : '—'}</b></div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Payslips (staff app)
export function MyPayslips() {
  const { userId } = useActing();
  const fin = useFinance();
  const { rows } = useTable<Payslip>('payslips', { eq: { user_id: userId } });
  const [open, setOpen] = useState<Payslip | null>(null);
  const paidRuns = fin.runs.filter((r) => r.status === 'paid');
  const slips = rows.filter((s) => paidRuns.some((r) => r.id === s.run_id)).sort((a, b) => (fin.runs.find((r) => r.id === b.run_id)?.period ?? '').localeCompare(fin.runs.find((r) => r.id === a.run_id)?.period ?? ''));
  const period = (s: Payslip) => fin.runs.find((r) => r.id === s.run_id);
  if (!slips.length) return <Empty icon={<Receipt />} title="No payslips yet" sub="Payslips appear here once payroll is paid." />;
  return (
    <div className="flex flex-col gap-2">
      <h2 className="m-0 text-xl font-extrabold">My payslips</h2>
      {slips.map((s) => (
        <button key={s.id} type="button" onClick={() => setOpen(s)} className="flex items-center gap-3 rounded-2xl border border-basil-line bg-white p-4 text-left">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-basil-ice text-basil"><Receipt size={20} /></span>
          <span className="flex-1"><b className="block">{monthLabel(period(s)?.period ?? '')}</b><span className="text-xs text-basil-muted">Paid {fmtDate(period(s)?.paid_at)}</span></span>
          <b className="font-display">{tsh(s.net)}</b><ChevronRight size={18} className="text-basil-muted" />
        </button>
      ))}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={`Payslip · ${monthLabel(period(open!)?.period ?? '')}`}>{open && <PayslipBody s={open} />}</Sheet>
    </div>
  );
}
export function PayslipBody({ s }: { s: Payslip }) {
  const row = (l: string, v: number, neg = false, bold = false) => <div className={`flex justify-between py-1.5 ${bold ? 'border-t border-basil-line pt-2 font-extrabold' : ''}`}><span>{l}</span><span>{neg ? '− ' : ''}{tsh(v)}</span></div>;
  return (
    <div className="text-sm">
      <p className="m-0 mb-2"><b>{s.full_name}</b><span className="block text-basil-muted">{s.title}</span></p>
      {row('Basic salary', s.basic)}{row('Allowances', s.allowances)}{row('Gross pay', s.gross, false, true)}
      {row('NSSF (employee)', s.nssf, true)}{row('PAYE', s.paye, true)}{s.other_deductions > 0 && row('Loans / advances', s.other_deductions, true)}
      {row('Net pay', s.net, false, true)}
      <p className="m-0 mt-3 text-xs text-basil-muted">Employer also pays NSSF {tsh(s.nssf_employer)}, WCF {tsh(s.wcf)} and SDL {tsh(s.sdl)} on your behalf. Taxable pay {tsh(s.taxable)}.</p>
    </div>
  );
}

// ---------------------------------------------------------------- Finance: ready-to-pay queue
export function PayQueue() {
  const fin = useFinance();
  const [pay, setPay] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const r = fin.requests.find((x) => x.id === pay);
  const paidToday = fin.requests.filter((x) => x.paid_at && x.paid_at.slice(0, 10) === new Date().toISOString().slice(0, 10));
  const total = fin.readyToPay.reduce((s, x) => s + Number(x.approved_amount ?? x.amount), 0);
  return (
    <div className="flex flex-col gap-3">
      <div><h2 className="m-0 text-xl font-extrabold">Ready to pay</h2><p className="m-0 text-sm text-basil-muted">{fin.readyToPay.length} approved · {tsh(total)} · Finance pays only approved requests</p></div>
      {!fin.readyToPay.length && <Empty icon={<CheckCircle2 />} title="Queue clear" sub="Every approved request is paid. Requesters retire receipts next." />}
      {fin.readyToPay.map((x) => <RequestRow key={x.id} r={x} fin={fin} onOpen={() => setOpen(x.id)} right={<button type="button" onClick={() => setPay(x.id)} className="min-h-[44px] shrink-0 rounded-xl border-0 bg-emerald-600 px-3 text-sm font-bold text-white">Pay</button>} />)}
      {paidToday.length > 0 && <><h3 className="m-0 mt-2 text-sm font-bold text-basil-muted">Paid today</h3>{paidToday.map((x) => <RequestRow key={x.id} r={x} fin={fin} onOpen={() => setOpen(x.id)} />)}</>}
      <Sheet open={!!r} onClose={() => setPay(null)} title="Mark as paid">{r && <PayForm r={r} fin={fin} onDone={() => setPay(null)} />}</Sheet>
      <RequestSheet id={open} fin={fin} onClose={() => setOpen(null)} />
    </div>
  );
}

/** All requests register with status filter (Finance "Requests" tab, desktop register). */
export function RequestsRegister() {
  const fin = useFinance();
  const [f, setF] = useState('open');
  const [open, setOpen] = useState<string | null>(null);
  const groups: Record<string, (r: MoneyRequest) => boolean> = {
    open: (r) => ['gm_review', 'boss_approval', 'approved'].includes(r.status), paid: (r) => r.status === 'paid', retired: (r) => r.status === 'retired',
    closed: (r) => ['reconciled', 'rejected'].includes(r.status), all: (r) => r.status !== 'draft',
  };
  const list = fin.requests.filter(groups[f]);
  return (
    <div className="flex flex-col gap-3">
      <Tabs value={f} onChange={setF} items={[{ value: 'open', label: 'In approval', count: fin.requests.filter(groups.open).length }, { value: 'paid', label: 'Awaiting receipts', count: fin.requests.filter(groups.paid).length }, { value: 'retired', label: 'To reconcile', count: fin.toReconcile.length }, { value: 'closed', label: 'Closed' }, { value: 'all', label: 'All' }]} />
      {!list.length && <Empty icon={<Inbox />} title="Nothing here" />}
      {list.map((r) => <RequestRow key={r.id} r={r} fin={fin} onOpen={() => setOpen(r.id)} />)}
      <RequestSheet id={open} fin={fin} onClose={() => setOpen(null)} />
    </div>
  );
}

/** GM/CFO: retired receipts to reconcile. */
export function ReconcileList() {
  const fin = useFinance();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <div><h2 className="m-0 text-xl font-extrabold">Reconcile receipts</h2><p className="m-0 text-sm text-basil-muted">{fin.toReconcile.length} retired advances to check against receipts</p></div>
      {!fin.toReconcile.length && <Empty icon={<CheckCircle2 />} title="All reconciled" />}
      {fin.toReconcile.map((r) => <RequestRow key={r.id} r={r} fin={fin} onOpen={() => setOpen(r.id)} />)}
      <RequestSheet id={open} fin={fin} onClose={() => setOpen(null)} />
    </div>
  );
}

/** Project budgets with progress (GM cockpit + Budgets). */
export function BudgetsGlance({ limit }: { limit?: number }) {
  const fin = useFinance();
  const rows = useMemo(() => fin.projects.map((p) => ({ p, m: fin.projectMoney(p) })).sort((a, b) => b.m.spent / (b.m.allocated || 1) - a.m.spent / (a.m.allocated || 1)), [fin]);
  return (
    <div className="flex flex-col gap-3">
      {rows.slice(0, limit).map(({ p, m }) => {
        const pct = m.allocated ? ((m.spent + m.committed) / m.allocated) * 100 : 0;
        return (
          <div key={p.id} className="rounded-2xl border border-basil-line bg-white p-3">
            <div className="mb-1 flex justify-between gap-2 text-sm"><b className="truncate">{p.name}</b><Pill tone={pct >= 100 ? 'red' : pct >= 80 ? 'amber' : 'green'}>{pct >= 100 ? 'Over budget' : pct >= 80 ? 'At risk' : 'On track'}</Pill></div>
            <Progress value={m.spent + m.committed} max={m.allocated} />
            <div className="mt-1 text-xs text-basil-muted">{tshShort(m.spent)} spent + {tshShort(m.committed)} committed of {tshShort(m.allocated)} · margin {m.marginPct.toFixed(0)}%</div>
          </div>
        );
      })}
    </div>
  );
}

/** GM/CFO phone home: the cockpit. */
export function GmCockpit({ onGo }: { onGo?: (tab: string) => void }) {
  const fin = useFinance();
  const name = useNames();
  const waiting = fin.waitingGm;
  const escalated = [...fin.waitingGm, ...fin.waitingBoss].filter((r) => waitingHours(r) > 24);
  const overBudget = fin.projects.filter((p) => { const m = fin.projectMoney(p); return m.spent + m.committed > m.allocated; });
  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={() => onGo?.('review')} className="flex items-center gap-3 rounded-3xl border-0 p-5 text-left text-white" style={{ background: 'linear-gradient(135deg,#0A2F5C,#0F6EC2)' }}>
        <span className="flex-1"><span className="block text-xs text-basil-haze">To review</span><b className="block font-display text-[28px]">{waiting.length} · {tshShort(waiting.reduce((s, r) => s + Number(r.amount), 0))}</b><span className="text-xs text-basil-haze">Money requests waiting for your check</span></span><ChevronRight />
      </button>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Cash position" value={tshShort(fin.cash + fin.bank)} sub={`Runway ${fin.runwayMonths.toFixed(1)} months`} />
        <Stat label="Overdue invoices" value={tshShort(fin.overdue)} tone="red" sub={`${fin.overdueRows.length} invoices`} onClick={() => onGo?.('money')} />
        <Stat label="Payroll due" value={fin.nextRun ? tshShort(fin.nextRun.net) : '—'} sub={fin.nextRun ? `${fmtDate(fin.nextRun.pay_day)} · ${fin.nextRun.status}` : ''} />
        <Stat label="To reconcile" value={fin.toReconcile.length} sub="retired advances" tone={fin.toReconcile.length ? 'amber' : undefined} />
      </div>
      <Card title="Needs you now">
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
          {escalated.map((r) => <li key={r.id} className="flex gap-2"><AlertTriangle size={16} className="shrink-0 text-red-600" /><span><b>{r.number}</b> waiting {Math.round(waitingHours(r))}h at {r.status === 'gm_review' ? 'your review' : 'Boss approval'} · {name(r.requester_id).split(' ')[0]} · {tsh(r.amount)}</span></li>)}
          {overBudget.map((p) => <li key={p.id} className="flex gap-2"><AlertTriangle size={16} className="shrink-0 text-amber-600" /><span><b>{p.name}</b> is over budget</span></li>)}
          {fin.overdueRows.slice(0, 3).map((r) => <li key={r.inv.id} className="flex gap-2"><AlertTriangle size={16} className="shrink-0 text-red-600" /><span><b>{r.inv.number}</b> · {fin.client(r.inv.client_id)?.name} · {tsh(r.balance)} · {r.daysOverdue} days late</span></li>)}
          {!escalated.length && !overBudget.length && !fin.overdueRows.length && <li>Nothing urgent.</li>}
        </ul>
      </Card>
      <Card title="Project budgets"><BudgetsGlance limit={4} /></Card>
    </div>
  );
}
