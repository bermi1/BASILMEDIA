// Desktop pages for Finance & Approvals (all also work at phone width).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Fingerprint, Plus, Save } from 'lucide-react';
import { PageTitle } from '@/os/OsLayout';
import { useActing } from '@/os/lib/session';
import { insertRow, updateRow, useTable } from '@/os/lib/store';
import { useToast } from '@/os/cms/toast';
import { Card, Empty, Field, Pill, Progress, Sheet, Stat, StageTracker, Tabs, inputCls, tsh, tshShort } from '@/os/ui';
import {
  BUDGET_LINES, approvePayroll, computePayslip, fmtDate, monthLabel, payPayroll, preparePayroll, reviewPayroll, runStage, runTotals, saveSetting, today, useFinance,
  type BudgetLine, type Category, type FinSettings, type PayrollRun, type Payslip, type PriceItem, type SalaryProfile,
} from './lib';
import { HBars, IncomeExpenseBars, StepUpSheet, errMsg, useNames } from './components';
import { ApprovalsInbox, BudgetsGlance, MyMoneyRequests, PayQueue, PayslipBody, ReconcileList, RequestsRegister } from './phone';

// ---------------------------------------------------------------- overview
export function FinanceOverview() {
  const fin = useFinance();
  const month = today().slice(0, 7);
  const byCat = Object.entries(fin.expenses.filter((e) => e.date.startsWith(month)).reduce<Record<string, number>>((a, e) => ((a[e.category] = (a[e.category] ?? 0) + Number(e.amount)), a), {})).sort((a, b) => b[1] - a[1]);
  const aged = [['Not yet due', 0, -1e9], ['1–30 days', 1, 30], ['31–60 days', 31, 60], ['61–90 days', 61, 90], ['90+ days', 91, 1e9]] as const;
  const open = fin.invRows.filter((r) => !['draft', 'cancelled', 'paid'].includes(r.status));
  const agedRows = aged.map(([label, lo, hi]) => ({ label, value: open.filter((r) => (lo === 0 ? r.daysOverdue <= 0 : r.daysOverdue >= lo && r.daysOverdue <= hi)).reduce((s, r) => s + r.balance, 0), tone: lo === 0 ? 'bg-basil' : lo > 60 ? 'bg-red-600' : 'bg-amber-500' }));
  const profit = fin.incomeMonth - fin.expenseMonth;
  return (
    <div>
      <PageTitle tag="MONEY" title="Finance overview" sub={`Today ${fmtDate(today())} · all amounts in TSH`}>
        <div className="flex flex-wrap gap-2"><Link to="/os/finance/invoices" className="btn-outline min-h-[44px]">Invoices</Link><Link to="/os/finance/pay" className="btn-primary min-h-[44px]">Ready to pay · {fin.readyToPay.length}</Link></div>
      </PageTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Cash at hand" value={tshShort(fin.cash)} sub="Petty cash box" />
        <Stat label="Bank + mobile money" value={tshShort(fin.bank)} sub={`Runway ${fin.runwayMonths.toFixed(1)} months`} />
        <Stat label="Income this month" value={tshShort(fin.incomeMonth)} tone="green" />
        <Stat label="Expenses this month" value={tshShort(fin.expenseMonth)} sub={`Profit ${tshShort(profit)}`} tone={profit < 0 ? 'red' : undefined} />
        <Stat label="Outstanding" value={tshShort(fin.outstanding)} sub={`${open.length} open invoices`} />
        <Stat label="Overdue" value={tshShort(fin.overdue)} tone="red" sub={`${fin.overdueRows.length} invoices · oldest ${Math.max(0, ...fin.overdueRows.map((r) => r.daysOverdue))} days`} />
        <Stat label="Payroll due" value={fin.nextRun ? tshShort(fin.nextRun.net) : '—'} sub={fin.nextRun ? `${fmtDate(fin.nextRun.pay_day)} · ${fin.nextRun.status}` : ''} />
        <Stat label="In approval" value={fin.waitingGm.length + fin.waitingBoss.length} sub={`${fin.readyToPay.length} ready to pay · ${fin.toReconcile.length} to reconcile`} tone="amber" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Income vs expenses · last 6 months"><IncomeExpenseBars data={fin.monthly} /></Card>
        <Card title={`Expenses by category · ${monthLabel(month)}`}>{byCat.length ? <HBars rows={byCat.map(([label, value]) => ({ label, value, tone: 'bg-amber-500' }))} /> : <Empty title="No expenses yet this month" />}</Card>
        <Card title="Aged receivables"><HBars rows={agedRows} /></Card>
        <Card title="Accounts">{fin.balances.map((a) => <div key={a.id} className="flex justify-between border-b border-basil-line py-2 text-sm"><span>{a.name}<span className="block text-xs text-basil-muted">{a.kind}</span></span><b>{tsh(a.balance)}</b></div>)}</Card>
      </div>
      <Card title="Project profitability" className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-basil-muted"><tr><th className="py-2">Project</th><th>Contract</th><th>Invoiced</th><th>Received</th><th>Spent + committed</th><th>Margin</th></tr></thead>
            <tbody>{fin.projects.map((p) => { const m = fin.projectMoney(p); return (
              <tr key={p.id} className="border-t border-basil-line"><td className="py-2"><b>{p.name}</b><span className="block text-xs text-basil-muted">{fin.client(p.client_id)?.name}</span></td><td>{tshShort(m.contract)}</td><td>{tshShort(m.invoiced)}</td><td>{tshShort(m.received)}</td><td>{tshShort(m.spent + m.committed)}<span className="block text-xs text-basil-muted">of {tshShort(m.allocated)} budget</span></td><td><Pill tone={m.marginPct < 20 ? 'red' : m.marginPct < 35 ? 'amber' : 'green'}>{m.marginPct.toFixed(0)}% · {tshShort(m.margin)}</Pill></td></tr>); })}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- approvals (desktop)
export function ApprovalsPage() {
  const { role, canAny, setRole } = useActing();
  const label = role === 'boss' ? 'Waiting for your approval' : role === 'gm_cfo' ? 'Waiting for your review' : 'Your money requests';
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle tag="MONEY" title="Approvals" sub={`${label} · requester → GM/CFO → Boss → Finance → receipts → reconcile`}>
        {canAny('boss', 'gm_cfo') && <div className="flex gap-2">{(['boss', 'gm_cfo'] as const).filter((r) => canAny(r)).map((r) => <button key={r} type="button" onClick={() => setRole(r)} aria-pressed={role === r} className={`min-h-[40px] rounded-full px-3 text-sm font-bold ${role === r ? 'border-0 bg-basil text-white' : 'border border-basil-edge bg-white'}`}>{r === 'boss' ? 'As Boss' : 'As GM/CFO'}</button>)}</div>}
      </PageTitle>
      <ApprovalsInbox />
    </div>
  );
}
export const MyRequestsPage = () => <div className="mx-auto max-w-3xl"><PageTitle tag="MONEY" title="My money requests" sub="Request, track every step, and retire receipts." /><MyMoneyRequests /></div>;
export const PayPage = () => <div className="mx-auto max-w-3xl"><PageTitle tag="MONEY" title="Pay queue" sub="Approved requests ready to pay. Finance never approves." /><PayQueue /></div>;
export const RegisterPage = () => <div className="mx-auto max-w-3xl"><PageTitle tag="MONEY" title="All money requests" /><RequestsRegister /></div>;
export const ReconcilePage = () => <div className="mx-auto max-w-3xl"><PageTitle tag="MONEY" title="Reconcile" /><ReconcileList /></div>;

// ---------------------------------------------------------------- budgets
export function BudgetsPage() {
  const fin = useFinance();
  const { can } = useActing();
  const toast = useToast();
  const [pid, setPid] = useState<string | null>(null);
  const editable = can('boss', 'gm_cfo');
  const p = fin.project(pid);
  const lines = fin.lines.filter((l) => l.project_id === pid).sort((a, b) => BUDGET_LINES.indexOf(a.line as never) - BUDGET_LINES.indexOf(b.line as never));
  const setAlloc = async (l: BudgetLine, v: number) => { try { await updateRow('project_budget_lines', l.id, { allocated: v }); } catch (e) { toast(errMsg(e), 'error'); } };
  const addLine = async (line: string) => { try { await insertRow('project_budget_lines', { project_id: pid, line, allocated: 0, notes: '' }); } catch (e) { toast(errMsg(e), 'error'); } };
  return (
    <div>
      <PageTitle tag="MONEY" title="Project budgets" sub="Allocated, committed (approved, unpaid), spent and remaining per line." />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="flex flex-col gap-2">{fin.projects.map((x) => <button key={x.id} type="button" onClick={() => setPid(x.id)} className={`rounded-2xl border p-0 text-left ${pid === x.id ? 'border-basil' : 'border-transparent'}`}><MiniBudget id={x.id} /></button>)}</div>
        {p ? (
          <Card title={p.name}>
            <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs text-basil-muted"><tr><th className="py-2">Line</th><th>Allocated</th><th>Committed</th><th>In approval</th><th>Spent</th><th>Remaining</th></tr></thead>
              <tbody>{lines.map((l) => { const s = fin.lineStats(l); return (
                <tr key={l.id} className="border-t border-basil-line"><td className="py-2 font-bold">{l.line}<div className="w-28"><Progress value={s.spent + s.committed} max={s.allocated} /></div></td>
                  <td>{editable ? <input aria-label={`${l.line} allocation`} className={`${inputCls} h-10 w-32 text-sm`} defaultValue={l.allocated} onBlur={(e) => Number(e.target.value) !== Number(l.allocated) && setAlloc(l, Number(e.target.value) || 0)} /> : tsh(l.allocated)}</td>
                  <td>{tshShort(s.committed)}</td><td>{tshShort(s.pending)}</td><td>{tshShort(s.spent)}</td><td className={s.remaining < 0 ? 'font-bold text-red-700' : 'font-bold text-emerald-700'}>{tsh(s.remaining)}</td></tr>); })}</tbody>
            </table></div>
            {editable && BUDGET_LINES.filter((b) => !lines.some((l) => l.line === b)).length > 0 && <div className="mt-3 flex flex-wrap gap-2">{BUDGET_LINES.filter((b) => !lines.some((l) => l.line === b)).map((b) => <button key={b} type="button" onClick={() => addLine(b)} className="btn-outline min-h-[40px] text-sm"><Plus size={14} />{b}</button>)}</div>}
          </Card>
        ) : <Empty title="Pick a project" sub="See and edit its budget lines." />}
      </div>
    </div>
  );
}
function MiniBudget({ id }: { id: string }) {
  const fin = useFinance();
  const p = fin.project(id);
  if (!p) return null;
  const m = fin.projectMoney(p);
  return <div className="rounded-2xl border border-basil-line bg-white p-3"><div className="mb-1 flex justify-between text-sm"><b className="truncate">{p.name}</b><span className="text-xs">{tshShort(m.spent + m.committed)} / {tshShort(m.allocated)}</span></div><Progress value={m.spent + m.committed} max={m.allocated} /></div>;
}
export const BudgetsPhone = () => <BudgetsGlance />;

// ---------------------------------------------------------------- payroll
export function PayrollPanel() {
  const fin = useFinance();
  const { role, userId } = useActing();
  const toast = useToast();
  const { rows: slips } = useTable<Payslip>('payslips');
  const { rows: profiles } = useTable<SalaryProfile>('salary_profiles');
  const [sel, setSel] = useState<string | null>(null);
  const [step, setStep] = useState(false);
  const [slip, setSlip] = useState<Payslip | null>(null);
  const [tab, setTab] = useState<'runs' | 'people'>('runs');
  const run = fin.runs.find((r) => r.id === sel) ?? fin.runs[0];
  const actor = { role, userId };
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast(ok); } catch (e) { toast(errMsg(e), 'error'); } };
  const lastPeriod = fin.runs[0]?.period ?? today().slice(0, 7);
  const nd = new Date(lastPeriod + '-25T12:00:00'); nd.setMonth(nd.getMonth() + 1);
  const nextPeriod = nd.toISOString().slice(0, 7);
  const preview = runTotals(profiles.filter((p) => p.active).map((p) => computePayslip(p, fin.settings.statutory_rates)));
  return (
    <div className="flex flex-col gap-4">
      <Tabs value={tab} onChange={setTab} items={[{ value: 'runs', label: 'Payroll runs' }, { value: 'people', label: 'Salary profiles' }]} />
      {tab === 'runs' ? (<>
        <div className="flex flex-wrap gap-2">{fin.runs.map((r) => <button key={r.id} type="button" onClick={() => setSel(r.id)} className={`min-h-[40px] rounded-full px-3 text-sm font-bold ${run?.id === r.id ? 'border-0 bg-basil text-white' : 'border border-basil-edge bg-white'}`}>{monthLabel(r.period)} · {r.status}</button>)}</div>
        {role === 'finance' && (!run || ['paid'].includes(run.status)) && (
          <Card title={`Prepare ${monthLabel(nextPeriod)}`}><p className="m-0 mb-3 text-sm text-basil-muted">{preview.headcount} people · gross {tsh(preview.gross)} · net {tsh(preview.net)} (current rates)</p><button type="button" className="btn-primary" onClick={() => act(() => preparePayroll(nextPeriod, `${nextPeriod}-25`, actor), 'Payroll prepared · sent to GM/CFO')}>Prepare payroll</button></Card>
        )}
        {run && <RunCard run={run} />}
        {run && (
          <div className="flex flex-wrap gap-2">
            {role === 'finance' && ['prepared', 'returned'].includes(run.status) && <button type="button" className="btn-outline" onClick={() => act(() => preparePayroll(run.period, run.pay_day, actor), 'Recalculated')}>Recalculate</button>}
            {role === 'gm_cfo' && run.status === 'prepared' && <><button type="button" className="btn-primary" onClick={() => act(() => reviewPayroll(run.id, 'ok', '', actor), 'Reviewed · sent to the Boss')}>Reviewed · send to Boss</button><button type="button" className="btn-outline" onClick={() => { const c = prompt('What needs fixing?'); if (c) void act(() => reviewPayroll(run.id, 'return', c, actor), 'Returned'); }}>Return</button></>}
            {role === 'boss' && run.status === 'reviewed' && <button type="button" className="btn-primary !bg-emerald-600" onClick={() => setStep(true)}><Fingerprint size={18} />Approve payroll</button>}
            {role === 'finance' && run.status === 'approved' && <button type="button" className="btn-primary !bg-emerald-600" onClick={() => { const ref = prompt('Bank bulk-payment reference'); if (ref) void act(() => payPayroll(run.id, ref, fin.accounts.find((a) => a.kind === 'bank')?.id ?? null, actor), 'Payroll paid · payslips released'); }}>Mark payroll paid</button>}
          </div>
        )}
        {run && (
          <Card title="Payslips">
            <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm">
              <thead className="text-xs text-basil-muted"><tr><th className="py-2">Person</th><th>Gross</th><th>NSSF</th><th>PAYE</th><th>Other</th><th>Net</th></tr></thead>
              <tbody>{slips.filter((s) => s.run_id === run.id).map((s) => <tr key={s.id} className="cursor-pointer border-t border-basil-line hover:bg-basil-mist" onClick={() => setSlip(s)}><td className="py-2"><b>{s.full_name}</b><span className="block text-xs text-basil-muted">{s.title}</span></td><td>{tshShort(s.gross)}</td><td>{tshShort(s.nssf)}</td><td>{tshShort(s.paye)}</td><td>{s.other_deductions ? tshShort(s.other_deductions) : '—'}</td><td className="font-bold">{tsh(s.net)}</td></tr>)}</tbody>
            </table></div>
          </Card>
        )}
        <StepUpSheet open={step} onClose={() => setStep(false)} title={`Approving payroll ${tsh(run?.net)}`} sub={`${run?.headcount} people`} onVerified={async (by) => { await approvePayroll(run!.id, 'approve', '', by, actor); toast('Payroll approved'); }} />
        <Sheet open={!!slip} onClose={() => setSlip(null)} title="Payslip">{slip && <PayslipBody s={slip} />}</Sheet>
      </>) : <SalaryProfiles profiles={profiles} editable={role === 'finance' || role === 'gm_cfo'} />}
    </div>
  );
}
function RunCard({ run }: { run: PayrollRun }) {
  const name = useNames();
  return (
    <Card title={`Payroll ${monthLabel(run.period)} · pay day ${fmtDate(run.pay_day)}`} action={<Pill tone={run.status === 'paid' ? 'green' : run.status === 'returned' ? 'red' : 'amber'}>{run.status}</Pill>}>
      <div className="mb-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div><span className="block text-xs text-basil-muted">Net pay</span><b className="font-display text-lg">{tsh(run.net)}</b></div>
        <div><span className="block text-xs text-basil-muted">Gross · {run.headcount} people</span><b>{tsh(run.gross)}</b></div>
        <div><span className="block text-xs text-basil-muted">PAYE · NSSF (ee)</span><b>{tshShort(run.paye)} · {tshShort(run.nssf_employee)}</b></div>
        <div><span className="block text-xs text-basil-muted">Employer NSSF · WCF · SDL</span><b>{tshShort(run.nssf_employer)} · {tshShort(run.wcf)} · {tshShort(run.sdl)}</b></div>
      </div>
      <StageTracker {...runStage(run, name)} />
      {run.comment && <p className="m-0 mt-3 text-sm text-basil-muted">“{run.comment}”</p>}
    </Card>
  );
}
function SalaryProfiles({ profiles, editable }: { profiles: SalaryProfile[]; editable: boolean }) {
  const toast = useToast();
  const save = async (p: SalaryProfile, k: keyof SalaryProfile, v: number) => { try { await updateRow('salary_profiles', p.id, { [k]: v }); toast('Saved'); } catch (e) { toast(errMsg(e), 'error'); } };
  return (
    <Card title="Salary profiles">
      <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm">
        <thead className="text-xs text-basil-muted"><tr><th className="py-2">Person</th><th>Basic</th><th>Allowances</th><th>Deductions</th><th>Paid by</th></tr></thead>
        <tbody>{profiles.map((p) => <tr key={p.id} className="border-t border-basil-line"><td className="py-2"><b>{p.full_name}</b><span className="block text-xs text-basil-muted">{p.title}</span></td>
          {(['basic', 'allowances', 'deductions'] as const).map((k) => <td key={k}>{editable ? <input aria-label={`${p.full_name} ${k}`} className={`${inputCls} h-10 w-28 text-sm`} defaultValue={p[k]} onBlur={(e) => Number(e.target.value) !== Number(p[k]) && save(p, k, Number(e.target.value) || 0)} /> : tsh(p[k])}</td>)}
          <td className="text-xs">{p.pay_method}<span className="block text-basil-muted">{p.pay_account}</span></td></tr>)}</tbody>
      </table></div>
    </Card>
  );
}
export const PayrollPage = () => <div><PageTitle tag="MONEY" title="Payroll" sub="Finance prepares → GM/CFO reviews → Boss approves → Finance pays → payslips released." /><PayrollPanel /></div>;

// ---------------------------------------------------------------- settings (rates, categories, price list)
export function FinanceSettingsPage() {
  const fin = useFinance();
  const toast = useToast();
  const { rows: cats } = useTable<Category>('expense_categories', { order: 'sort_order' });
  const { rows: prices } = useTable<PriceItem>('price_items');
  const [rates, setRates] = useState<FinSettings['statutory_rates'] | null>(null);
  const r = rates ?? fin.settings.statutory_rates;
  const [vat, setVat] = useState<string | null>(null);
  const [cat, setCat] = useState('');
  const save = async (k: string, v: unknown) => { try { await saveSetting(k, v); toast('Saved'); } catch (e) { toast(errMsg(e), 'error'); } };
  return (
    <div>
      <PageTitle tag="MONEY" title="Finance settings" sub="Statutory rates, VAT, expense categories and the price list. Only the Super Admin can change rates when connected to the database." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Statutory rates (payroll)">
          <div className="grid grid-cols-2 gap-2">
            {(['nssf_employee', 'nssf_employer', 'wcf', 'sdl'] as const).map((k) => <Field key={k} label={`${k.replace('_', ' ').toUpperCase()} %`}><input className={inputCls} inputMode="decimal" value={r[k]} onChange={(e) => setRates({ ...r, [k]: Number(e.target.value) || 0 })} /></Field>)}
          </div>
          <b className="mt-3 block text-sm">PAYE bands (monthly taxable pay)</b>
          {r.paye_bands.map(([hi, rate], i) => (
            <div key={i} className="mt-1 grid grid-cols-2 gap-2">
              <input aria-label="Band upper limit" className={`${inputCls} h-10 text-sm`} placeholder="and above" value={hi ?? ''} onChange={(e) => setRates({ ...r, paye_bands: r.paye_bands.map((b, j) => (j === i ? [e.target.value === '' ? null : Number(e.target.value), b[1]] : b)) })} />
              <input aria-label="Band rate" className={`${inputCls} h-10 text-sm`} value={rate} onChange={(e) => setRates({ ...r, paye_bands: r.paye_bands.map((b, j) => (j === i ? [b[0], Number(e.target.value) || 0] : b)) })} />
            </div>
          ))}
          <button type="button" className="btn-primary mt-3" onClick={() => save('statutory_rates', r)}><Save size={16} />Save rates</button>
        </Card>
        <Card title="VAT & approval limits">
          <Field label="VAT rate %"><input className={inputCls} value={vat ?? fin.settings.vat_rate} onChange={(e) => setVat(e.target.value)} /></Field>
          <button type="button" className="btn-outline mt-2" onClick={() => save('vat_rate', Number(vat ?? fin.settings.vat_rate))}>Save VAT</button>
          <p className="mb-0 mt-4 text-sm text-basil-muted">GM/CFO approves alone below <b>{tsh(fin.settings.approval_limits.gm_cfo_alone_below)}</b> (daily cap {tsh(fin.settings.approval_limits.gm_cfo_daily_cap)}). Receipts due within <b>{fin.settings.retirement_days} days</b>; new requests {fin.settings.block_on_unretired ? 'are blocked' : 'are not blocked'} while an advance is overdue.</p>
        </Card>
        <Card title="Expense categories">
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">{cats.map((c) => <li key={c.id}><button type="button" onClick={() => updateRow('expense_categories', c.id, { active: !c.active })} className={`min-h-[36px] rounded-full px-3 text-sm ${c.active ? 'border border-basil-edge bg-white' : 'border-0 bg-slate-100 text-slate-400 line-through'}`}>{c.name}</button></li>)}</ul>
          <form className="mt-3 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!cat.trim()) return; await insertRow('expense_categories', { name: cat.trim(), active: true, sort_order: cats.length + 1 }); setCat(''); }}><input className={inputCls} value={cat} onChange={(e) => setCat(e.target.value)} placeholder="New category" /><button type="submit" className="btn-primary">Add</button></form>
        </Card>
        <Card title="Price list (for quotations)">
          {prices.map((p) => <div key={p.id} className="flex items-center justify-between gap-2 border-b border-basil-line py-1.5 text-sm"><span>{p.name}<span className="block text-xs text-basil-muted">per {p.unit}</span></span><input aria-label={`${p.name} price`} className={`${inputCls} h-10 w-32 text-sm`} defaultValue={p.unit_price} onBlur={(e) => Number(e.target.value) !== Number(p.unit_price) && updateRow('price_items', p.id, { unit_price: Number(e.target.value) || 0 })} /></div>)}
          <button type="button" className="btn-outline mt-3" onClick={() => insertRow('price_items', { name: 'New item', detail: '', unit: 'item', unit_price: 0, active: true })}><Plus size={16} />Add item</button>
        </Card>
      </div>
    </div>
  );
}
