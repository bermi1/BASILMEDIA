// Finance & Approvals: types, settings, calculations and workflow calls.
// Each workflow call is an SQL function in supabase/migrations/0006_finance.sql, which enforces
// roles and segregation of duties (requester ≠ reviewer ≠ approver ≠ payer).
import { useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { emitChange, insertRow, nowIso, rpc, updateRow, useTable } from '@/os/lib/store';
import type { AppRole } from '@/lib/types';

// ---------------------------------------------------------------- types
export type ReqStatus = 'draft' | 'submitted' | 'gm_review' | 'boss_approval' | 'approved' | 'paid' | 'retired' | 'reconciled' | 'returned' | 'rejected';
export type Method = 'M-Pesa' | 'Tigo Pesa' | 'Airtel Money' | 'HaloPesa' | 'Bank transfer' | 'Cash';
export const METHODS: Method[] = ['M-Pesa', 'Tigo Pesa', 'Airtel Money', 'HaloPesa', 'Bank transfer', 'Cash'];
export const BUDGET_LINES = ['Crew', 'Transport', 'Equipment hire', 'Per diem & meals', 'Location & permits', 'Post-production', 'Music & licences', 'Printing', 'Contingency'] as const;
export type Urgency = 'normal' | 'urgent' | 'critical';

export interface MoneyRequest {
  id: string; number: string; requester_id: string; project_id: string | null; budget_line_id: string | null;
  amount: number; approved_amount: number | null; purpose: string; category: string; needed_by: string | null;
  payee: string; payee_phone: string; method: Method; urgency: Urgency; attachment_url: string; status: ReqStatus;
  question: string | null; recommendation: string; over_budget: boolean; duplicate_of: string | null;
  submitted_at: string | null; stage_at: string | null; reviewed_at: string | null; reviewed_by: string | null;
  approved_at: string | null; approved_by: string | null; approved_alone: boolean;
  paid_at: string | null; paid_by: string | null; paid_method: string | null; paid_reference: string | null; paid_proof_url: string | null; paid_account_id: string | null;
  retired_at: string | null; change_returned: number; reconciled_at: string | null; reconciled_by: string | null;
  returned_at: string | null; rejected_at: string | null; created_at: string;
}
export interface Step { id: string; request_id: string; step: string; actor_id: string; decision: string; comment: string; amount: number | null; device: string; verified_by: 'pin' | 'passkey' | null; at: string }
export interface BudgetLine { id: string; project_id: string; line: string; allocated: number; notes: string }
export interface Retirement { id: string; request_id: string; receipts: { url: string; amount: number; note: string }[]; total_spent: number; change_returned: number; note: string; retired_by: string; created_at: string }
export interface Account { id: string; name: string; kind: 'cash' | 'bank' | 'mobile'; opening_balance: number; opening_date: string }
export interface Income { id: string; date: string; amount: number; account_id: string | null; client_id: string | null; project_id: string | null; invoice_id: string | null; payment_id: string | null; category: string; description: string; reference: string; recorded_by?: string }
export interface Expense { id: string; date: string; amount: number; category: string; account_id: string | null; project_id: string | null; budget_line_id: string | null; request_id: string | null; payroll_run_id: string | null; payee: string; description: string; receipt_url: string; petty_cash: boolean; recorded_by?: string }
export interface LineItem { title: string; detail: string; qty: number; unit_price: number }
export interface Instalment { label: string; pct: number; due: string }
export type InvStatus = 'draft' | 'sent' | 'viewed' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
export interface Invoice { id: string; number: string; client_id: string | null; project_id: string | null; quotation_id: string | null; proforma_id?: string | null; title: string; po_ref: string; items: LineItem[]; discount: number; vat_on: boolean; vat_rate: number; deposit: number; schedule: Instalment[]; issue_date: string; due_date: string; status: InvStatus; sent_at: string | null; viewed_at: string | null; paid_at: string | null; cancelled_at: string | null; notes: string; terms: string; created_at: string }
export interface Payment { id: string; invoice_id: string; amount: number; paid_on: string; method: string; reference: string; account_id: string | null; receipt_no: string; is_deposit: boolean; created_at: string }
export type QuoStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';
export interface Quotation { id: string; number: string; client_id: string | null; project_id: string | null; prospect: string; title: string; items: LineItem[]; discount: number; vat_on: boolean; vat_rate: number; issue_date: string; valid_until: string; status: QuoStatus; sent_at: string | null; viewed_at: string | null; accepted_at: string | null; declined_at: string | null; invoice_id: string | null; notes: string; created_at: string }
export type ProStatus = 'draft' | 'sent' | 'accepted' | 'expired' | 'cancelled';
export interface Proforma { id: string; number: string; client_id: string | null; project_id: string | null; quotation_id: string | null; prospect: string; title: string; items: LineItem[]; discount: number; vat_on: boolean; vat_rate: number; issue_date: string; valid_until: string; status: ProStatus; sent_at: string | null; accepted_at: string | null; cancelled_at: string | null; invoice_id: string | null; notes: string; terms: string; created_at: string }
export interface PriceItem { id: string; name: string; detail: string; unit: string; unit_price: number; active: boolean }
export interface Category { id: string; name: string; active: boolean; sort_order: number }
export interface SalaryProfile { id: string; user_id: string; full_name: string; title: string; basic: number; allowances: number; deductions: number; pay_method: string; pay_account: string; active: boolean }
export type RunStatus = 'prepared' | 'reviewed' | 'approved' | 'paid' | 'returned';
export interface PayrollRun { id: string; period: string; pay_day: string; status: RunStatus; headcount: number; gross: number; paye: number; nssf_employee: number; nssf_employer: number; wcf: number; sdl: number; other_deductions: number; net: number; comment: string; prepared_by: string | null; prepared_at: string | null; reviewed_by: string | null; reviewed_at: string | null; approved_by: string | null; approved_at: string | null; verified_by: string | null; paid_by: string | null; paid_at: string | null; paid_reference: string | null; created_at: string }
export interface Payslip { id: string; run_id: string; user_id: string; full_name: string; title: string; basic: number; allowances: number; gross: number; nssf: number; taxable: number; paye: number; other_deductions: number; net: number; nssf_employer: number; wcf: number; sdl: number }
export interface Project { id: string; name: string; client_id: string; budget: number; contract_value: number; lead_id: string; stage: string; health?: string; end_date?: string }
export interface Client { id: string; name: string; address?: string; contact_name?: string; tin?: string; email?: string; phone?: string }

// ---------------------------------------------------------------- formatting
export const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  const x = new Date(d.length === 10 ? d + 'T00:00:00' : d);
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`;
};
export const fmtShort = (d?: string | null) => {
  if (!d) return '';
  const x = new Date(d.length === 10 ? d + 'T00:00:00' : d);
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')} ${d.length === 10 ? '' : x.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dar_es_Salaam' })}`.trim();
};
export const ago = (d?: string | null) => {
  if (!d) return '';
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)} days ago`;
};
export const hoursSince = (d?: string | null) => (d ? (Date.now() - new Date(d).getTime()) / 36e5 : 0);
export const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => new Date(new Date(iso + 'T00:00:00').getTime() + n * 864e5).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 864e5);
export const monthKey = (d: string) => d.slice(0, 7);
export const monthLabel = (k: string) => new Date(k + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
export const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();

// ---------------------------------------------------------------- settings
export interface FinSettings {
  approval_limits: { gm_cfo_alone_below: number; boss_required_from: number; gm_cfo_daily_cap: number };
  vat_rate: number;
  statutory_rates: { nssf_employee: number; nssf_employer: number; wcf: number; sdl: number; paye_bands: [number | null, number][] };
  numbering: Record<string, string>;
  retirement_days: number;
  block_on_unretired: boolean;
}
export const DEFAULT_SETTINGS: FinSettings = {
  approval_limits: { gm_cfo_alone_below: 50000, boss_required_from: 50000, gm_cfo_daily_cap: 1000000 },
  vat_rate: 18,
  statutory_rates: { nssf_employee: 10, nssf_employer: 10, wcf: 0.5, sdl: 3.5, paye_bands: [[270000, 0], [520000, 8], [760000, 20], [1000000, 25], [null, 30]] },
  numbering: { invoice: 'BM-INV-{YYYY}-{0000}', quotation: 'BM-QUO-{YYYY}-{0000}', proforma: 'BM-PF-{YYYY}-{0000}', request: 'BM-REQ-{0000}', receipt: 'BM-RCT-{YYYY}-{0000}' },
  retirement_days: 3,
  block_on_unretired: true,
};
function mergeSettings(rows: { key: string; value: unknown }[]): FinSettings {
  const s: FinSettings = structuredClone(DEFAULT_SETTINGS);
  for (const r of rows) {
    let v = r.value;
    if (typeof v === 'string') try { v = JSON.parse(v); } catch { /* keep */ }
    if (r.key in s) (s as unknown as Record<string, unknown>)[r.key] = typeof v === 'object' && v && !Array.isArray(v) ? { ...((s as unknown as Record<string, object>)[r.key] ?? {}), ...v } : v;
  }
  return s;
}
export function useFinSettings(): FinSettings {
  const { rows } = useTable<{ key: string; value: unknown }>('app_settings');
  return useMemo(() => mergeSettings(rows), [rows]);
}
export async function saveSetting(key: string, value: unknown) {
  const { error } = await supabase.from('app_settings').upsert({ key, value, updated_at: nowIso() });
  if (error) throw error;
  emitChange();
}

// ---------------------------------------------------------------- calculations
export function docTotals(d: { items: LineItem[]; discount: number; vat_on: boolean; vat_rate: number }) {
  const sub = d.items.reduce((s, i) => s + Number(i.qty) * Number(i.unit_price), 0);
  const net = Math.max(sub - Number(d.discount || 0), 0);
  const vat = d.vat_on ? Math.round((net * Number(d.vat_rate)) / 100) : 0;
  return { sub, discount: Number(d.discount || 0), net, vat, total: net + vat };
}

export const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', submitted: 'Submitted', gm_review: 'GM/CFO review', boss_approval: 'Boss approval', approved: 'Ready to pay',
  paid: 'Paid · retire receipts', retired: 'Retired · reconcile', reconciled: 'Reconciled', returned: 'Returned', rejected: 'Rejected',
  sent: 'Sent', viewed: 'Viewed', partially_paid: 'Partially paid', overdue: 'Overdue', cancelled: 'Cancelled', accepted: 'Accepted', declined: 'Declined', expired: 'Expired',
  prepared: 'Prepared', reviewed: 'Reviewed',
};
export const statusTone = (s: string): 'green' | 'amber' | 'red' | 'blue' | 'grey' => {
  if (['approved', 'paid', 'reconciled', 'accepted'].includes(s)) return 'green';
  if (['gm_review', 'boss_approval', 'submitted', 'partially_paid', 'prepared', 'reviewed', 'retired', 'viewed', 'sent'].includes(s)) return s === 'sent' || s === 'viewed' ? 'blue' : 'amber';
  if (['rejected', 'overdue', 'declined', 'returned'].includes(s)) return 'red';
  return 'grey';
};

export function invoicePaid(inv: Invoice, payments: Payment[]) {
  return payments.filter((p) => p.invoice_id === inv.id).reduce((s, p) => s + Number(p.amount), 0);
}
/** Effective status shown everywhere (overdue/paid derived from dates and payments). */
export function invoiceStatus(inv: Invoice, payments: Payment[]): InvStatus {
  if (inv.status === 'cancelled' || inv.status === 'draft') return inv.status;
  const total = docTotals(inv).total;
  const paid = invoicePaid(inv, payments);
  if (paid >= total && total > 0) return 'paid';
  if (inv.due_date < today()) return 'overdue';
  if (paid > 0) return 'partially_paid';
  return inv.status === 'overdue' || inv.status === 'paid' || inv.status === 'partially_paid' ? 'sent' : inv.status;
}
export function quotationStatus(q: Quotation): QuoStatus {
  if (['draft', 'sent', 'viewed'].includes(q.status) && q.valid_until < today()) return 'expired';
  return q.status;
}
/** Effective proforma status: past its validity (and not invoiced) reads as expired. */
export function proformaStatus(p: Proforma): ProStatus {
  if (['draft', 'sent'].includes(p.status) && !p.invoice_id && p.valid_until < today()) return 'expired';
  return p.status;
}
/** Who may raise and convert money documents (mirrors the SQL convert functions). */
export const MONEY_DOC_ROLES: AppRole[] = ['gm_cfo', 'finance', 'boss'];
/** Who may record a client payment against an invoice (Finance, and the GM/CFO who owns money documents). */
export const PAYMENT_ROLES: AppRole[] = ['finance', 'gm_cfo'];

export function paye(taxable: number, bands: [number | null, number][]) {
  let lo = 0, tax = 0;
  for (const [hi, rate] of bands) {
    if (hi === null || taxable <= hi) { tax += (Math.max(taxable - lo, 0) * rate) / 100; break; }
    tax += ((hi - lo) * rate) / 100;
    lo = hi;
  }
  return Math.round(tax);
}
export function computePayslip(p: SalaryProfile, rates: FinSettings['statutory_rates']) {
  const gross = Number(p.basic) + Number(p.allowances);
  const nssf = Math.round((gross * rates.nssf_employee) / 100);
  const taxable = gross - nssf;
  const tax = paye(taxable, rates.paye_bands);
  return {
    user_id: p.user_id, full_name: p.full_name, title: p.title, basic: Number(p.basic), allowances: Number(p.allowances), gross, nssf, taxable, paye: tax,
    other_deductions: Number(p.deductions), net: gross - nssf - tax - Number(p.deductions),
    nssf_employer: Math.round((gross * rates.nssf_employer) / 100), wcf: Math.round((gross * rates.wcf) / 100), sdl: Math.round((gross * rates.sdl) / 100),
  };
}
export function runTotals(slips: ReturnType<typeof computePayslip>[]) {
  const sum = (k: keyof ReturnType<typeof computePayslip>) => slips.reduce((s, x) => s + Number(x[k]), 0);
  return { headcount: slips.length, gross: sum('gross'), paye: sum('paye'), nssf_employee: sum('nssf'), nssf_employer: sum('nssf_employer'), wcf: sum('wcf'), sdl: sum('sdl'), other_deductions: sum('other_deductions'), net: sum('net') };
}

/** Committed (approved, unpaid), pending (in approval), spent and remaining for a budget line. */
export function lineStats(line: BudgetLine, reqs: MoneyRequest[], expenses: Expense[]) {
  const mine = reqs.filter((r) => r.budget_line_id === line.id);
  const amt = (r: MoneyRequest) => Number(r.approved_amount ?? r.amount);
  const committed = mine.filter((r) => r.status === 'approved').reduce((s, r) => s + amt(r), 0);
  const pending = mine.filter((r) => ['submitted', 'gm_review', 'boss_approval'].includes(r.status)).reduce((s, r) => s + Number(r.amount), 0);
  const spent = mine.filter((r) => ['paid', 'retired', 'reconciled'].includes(r.status)).reduce((s, r) => s + amt(r) - Number(r.change_returned || 0), 0)
    + expenses.filter((e) => e.budget_line_id === line.id && !e.request_id).reduce((s, e) => s + Number(e.amount), 0);
  return { allocated: Number(line.allocated), committed, pending, spent, remaining: Number(line.allocated) - committed - spent };
}

// ---------------------------------------------------------------- the big data hook
export function useFinance() {
  const requests = useTable<MoneyRequest>('money_requests', { order: 'created_at', ascending: false }).rows;
  const steps = useTable<Step>('approval_steps', { order: 'at' }).rows;
  const lines = useTable<BudgetLine>('project_budget_lines').rows;
  const retirements = useTable<Retirement>('retirements').rows;
  const accounts = useTable<Account>('finance_accounts').rows;
  const income = useTable<Income>('income', { order: 'date', ascending: false }).rows;
  const expenses = useTable<Expense>('expenses', { order: 'date', ascending: false }).rows;
  const invoices = useTable<Invoice>('invoices', { order: 'issue_date', ascending: false }).rows;
  const payments = useTable<Payment>('invoice_payments', { order: 'paid_on' }).rows;
  const projects = useTable<Project>('projects').rows;
  const clients = useTable<Client>('clients').rows;
  const runs = useTable<PayrollRun>('payroll_runs', { order: 'period', ascending: false }).rows;
  const settings = useFinSettings();

  return useMemo(() => {
    const t = today();
    const balanceOf = (a: Account) =>
      Number(a.opening_balance)
      + income.filter((i) => i.account_id === a.id && i.date >= a.opening_date).reduce((s, i) => s + Number(i.amount), 0)
      - expenses.filter((e) => e.account_id === a.id && e.date >= a.opening_date).reduce((s, e) => s + Number(e.amount), 0);
    const balances = accounts.map((a) => ({ ...a, balance: balanceOf(a) }));
    const cash = balances.filter((a) => a.kind === 'cash').reduce((s, a) => s + a.balance, 0);
    const bank = balances.filter((a) => a.kind !== 'cash').reduce((s, a) => s + a.balance, 0);
    const mobile = balances.filter((a) => a.kind === 'mobile').reduce((s, a) => s + a.balance, 0);
    const thisMonth = t.slice(0, 7);
    const incomeMonth = income.filter((i) => monthKey(i.date) === thisMonth).reduce((s, i) => s + Number(i.amount), 0);
    const expenseMonth = expenses.filter((e) => monthKey(e.date) === thisMonth).reduce((s, e) => s + Number(e.amount), 0);

    const invRows = invoices.map((inv) => {
      const tot = docTotals(inv);
      const paid = invoicePaid(inv, payments);
      const st = invoiceStatus(inv, payments);
      return { inv, ...tot, paid, balance: Math.max(tot.total - paid, 0), status: st, daysOverdue: st === 'overdue' ? daysBetween(inv.due_date, t) : 0 };
    });
    const open = invRows.filter((r) => !['draft', 'cancelled', 'paid'].includes(r.status));
    const outstanding = open.reduce((s, r) => s + r.balance, 0);
    const overdueRows = open.filter((r) => r.status === 'overdue');
    const overdue = overdueRows.reduce((s, r) => s + r.balance, 0);

    // last 3 months average spend → runway
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); months.push(d.toISOString().slice(0, 7)); }
    const monthly = months.map((m) => ({
      key: m,
      income: income.filter((i) => monthKey(i.date) === m).reduce((s, i) => s + Number(i.amount), 0),
      expenses: expenses.filter((e) => monthKey(e.date) === m).reduce((s, e) => s + Number(e.amount), 0),
    }));
    const prev3 = monthly.slice(2, 5).filter((m) => m.expenses > 0);
    const avgSpend = prev3.length ? prev3.reduce((s, m) => s + m.expenses, 0) / prev3.length : expenseMonth || 1;
    const runwayMonths = (cash + bank) / Math.max(avgSpend, 1);

    const nextRun = runs.find((r) => r.status !== 'paid');
    const lineStatsFor = (l: BudgetLine) => lineStats(l, requests, expenses);
    const projectMoney = (p: Project) => {
      const pl = lines.filter((l) => l.project_id === p.id);
      const allocated = pl.reduce((s, l) => s + Number(l.allocated), 0) || Number(p.budget);
      const spent = expenses.filter((e) => e.project_id === p.id).reduce((s, e) => s + Number(e.amount), 0);
      const committed = pl.reduce((s, l) => s + lineStatsFor(l).committed, 0);
      const invoiced = invRows.filter((r) => r.inv.project_id === p.id && r.status !== 'cancelled').reduce((s, r) => s + r.total, 0);
      const received = invRows.filter((r) => r.inv.project_id === p.id).reduce((s, r) => s + r.paid, 0);
      const contract = Number(p.contract_value);
      return { allocated, spent, committed, invoiced, received, contract, margin: contract - spent - committed, marginPct: contract ? ((contract - spent - committed) / contract) * 100 : 0 };
    };
    const waitingGm = requests.filter((r) => r.status === 'gm_review');
    const waitingBoss = requests.filter((r) => r.status === 'boss_approval');
    const readyToPay = requests.filter((r) => r.status === 'approved');
    const toReconcile = requests.filter((r) => r.status === 'retired');

    return {
      requests, steps, lines, retirements, accounts, balances, income, expenses, invoices, payments, projects, clients, runs, settings,
      cash, bank, mobile, incomeMonth, expenseMonth, invRows, outstanding, overdue, overdueRows, monthly, avgSpend, runwayMonths, nextRun,
      lineStats: lineStatsFor, projectMoney, waitingGm, waitingBoss, readyToPay, toReconcile,
      project: (id?: string | null) => projects.find((p) => p.id === id),
      client: (id?: string | null) => clients.find((c) => c.id === id),
      line: (id?: string | null) => lines.find((l) => l.id === id),
      stepsFor: (id: string) => steps.filter((s) => s.request_id === id),
    };
  }, [requests, steps, lines, retirements, accounts, income, expenses, invoices, payments, projects, clients, runs, settings]);
}
export type Fin = ReturnType<typeof useFinance>;

// ---------------------------------------------------------------- request checks (UI + demo)
export function requestChecks(fin: Fin, draft: { id?: string; requester_id: string; project_id: string | null; budget_line_id: string | null; amount: number }) {
  const line = fin.line(draft.budget_line_id);
  const stats = line ? fin.lineStats(line) : null;
  const overLine = !!stats && draft.amount > stats.remaining;
  const weekAgo = Date.now() - 7 * 864e5;
  const duplicate = fin.requests.find((r) => r.id !== draft.id && r.requester_id === draft.requester_id && Number(r.amount) === Number(draft.amount) && r.project_id === draft.project_id && !['draft', 'rejected'].includes(r.status) && new Date(r.created_at).getTime() > weekAgo);
  const unretired = unretiredFor(fin.requests, draft.requester_id, fin.settings.retirement_days);
  return { stats, overLine, duplicate, unretired, blocked: fin.settings.block_on_unretired && unretired.length > 0 };
}
export function unretiredFor(reqs: MoneyRequest[], userId: string, days: number) {
  return reqs.filter((r) => r.requester_id === userId && r.status === 'paid' && r.paid_at && hoursSince(r.paid_at) > days * 24);
}
export const retireDue = (r: MoneyRequest, days: number) => (r.paid_at ? new Date(new Date(r.paid_at).getTime() + days * 864e5).toISOString() : null);

// ---------------------------------------------------------------- request stage tracker
export const REQ_STAGES = ['Requested', 'GM/CFO review', 'Boss approval', 'Paid', 'Receipts retired', 'Reconciled'];
export function requestStage(r: MoneyRequest, steps: Step[], name: (id?: string | null) => string) {
  const who = (s?: Step) => (s ? `${name(s.actor_id).split(' ')[0]} · ${fmtShort(s.at)}` : undefined);
  const last = (step: string) => [...steps].reverse().find((s) => s.step === step);
  const sub = last('submit'), rev = last('review'), app = [...steps].reverse().find((s) => s.step === 'approve' && s.decision !== 'question'), pay = last('pay'), ret = last('retire'), rec = last('reconcile');
  const skippedReview = !rev && (r.status === 'boss_approval' || !!app);
  const meta: (string | undefined)[] = [
    who(sub) ?? (r.status === 'draft' ? 'Draft' : undefined),
    skippedReview ? 'Skipped · GM/CFO request' : who(rev),
    r.approved_alone ? 'Not needed · under limit' : app ? `${who(app)}${app.verified_by === 'passkey' ? ' · fingerprint' : app.verified_by === 'pin' ? ' · PIN' : ''}` : undefined,
    pay ? `${who(pay)}` : undefined,
    who(ret),
    who(rec),
  ];
  const idx: Record<ReqStatus, number> = { draft: 0, submitted: 1, returned: 0, gm_review: 1, boss_approval: 2, approved: 3, paid: 4, retired: 5, reconciled: 6, rejected: 1 };
  let current = idx[r.status];
  if (r.status === 'rejected') current = app && app.decision === 'rejected' ? 2 : 1;
  if (r.status === 'returned') meta[0] = `Returned by ${name(rev?.actor_id).split(' ')[0]}`;
  return { stages: REQ_STAGES, current, meta, rejected: r.status === 'rejected' || r.status === 'returned' };
}

// ---------------------------------------------------------------- workflow calls
export interface Actor { userId: string; role: AppRole }

export interface RequestDraft {
  project_id: string | null; budget_line_id: string | null; amount: number; purpose: string; category: string; needed_by: string | null;
  payee: string; payee_phone: string; method: Method; urgency: Urgency; attachment_url: string; comment?: string;
}

export function submitRequest(data: RequestDraft, id: string | null, _actor: Actor) {
  return rpc<string>('submit_money_request', { _data: data, _id: id });
}

export async function saveDraft(data: RequestDraft, id: string | null, actor: Actor) {
  // Drafts are plain rows (RLS lets the requester edit their own draft); numbering is assigned on submit in SQL.
  if (id) return updateRow('money_requests', id, { ...data });
  return insertRow('money_requests', { ...data, number: `DRAFT-${Date.now().toString(36).toUpperCase()}`, requester_id: actor.userId, status: 'draft', change_returned: 0, approved_alone: false, over_budget: false, recommendation: '' });
}

export function reviewRequest(id: string, decision: 'recommend' | 'return' | 'reject', comment: string, _actor: Actor) {
  return rpc<string>('review_money_request', { _id: id, _decision: decision, _comment: comment });
}

export type BossDecision = 'approve' | 'approve_changed' | 'reject' | 'question';
export function bossDecide(id: string, decision: BossDecision, opts: { amount?: number; comment?: string; verified_by?: 'pin' | 'passkey' | null }, _actor: Actor) {
  const comment = opts.comment ?? '';
  const device = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 120) : '';
  return rpc<string>('approve_money_request', { _id: id, _decision: decision, _amount: opts.amount ?? null, _comment: comment, _verified_by: opts.verified_by ?? null, _device: device });
}

export function answerQuestion(id: string, answer: string, _actor: Actor) {
  return rpc('answer_money_request', { _id: id, _answer: answer });
}

export function payRequest(id: string, p: { method: string; reference: string; proof_url: string; account_id: string | null }, _actor: Actor) {
  return rpc('pay_money_request', { _id: id, _method: p.method, _reference: p.reference, _proof_url: p.proof_url, _account_id: p.account_id });
}

export function retireRequest(id: string, receipts: { url: string; amount: number; note: string }[], change: number, note: string, _actor: Actor) {
  return rpc('retire_money_request', { _id: id, _receipts: receipts, _change: change, _note: note });
}

export function reconcileRequest(id: string, decision: 'ok' | 'query', comment: string, _actor: Actor) {
  return rpc('reconcile_money_request', { _id: id, _decision: decision, _comment: comment });
}

// ---------------------------------------------------------------- invoices (demo twins of the SQL triggers)
export async function recordPayment(inv: Invoice, p: { amount: number; paid_on: string; method: string; reference: string; account_id: string | null; is_deposit: boolean }, _actor: Actor) {
  // Receipt number, income line and invoice status are set by SQL triggers (0006).
  return insertRow('invoice_payments', { invoice_id: inv.id, ...p });
}

// ---------------------------------------------------------------- proformas (demo twins of 0013_proforma.sql)
export const PROFORMA_TERMS = 'Payment by bank transfer or mobile money. Quote the proforma number as reference.';

/** Quotation → proforma: copies client, lines and VAT, marks the quotation accepted. Returns the proforma id. */
export function convertQuotationToProforma(quotationId: string, _actor: Actor, validUntil?: string) {
  return rpc<string>('convert_quotation_to_proforma', { _quotation_id: quotationId, _valid_until: validUntil ?? null });
}

/** Proforma → tax invoice (draft, 50/50 schedule, proforma and quotation linked). Returns the invoice id. */
export function convertProformaToInvoice(id: string, _actor: Actor, dueDate?: string) {
  return rpc<string>('convert_proforma_to_invoice', { _id: id, _due_date: dueDate ?? null });
}

// ---------------------------------------------------------------- payroll workflow

export function preparePayroll(period: string, payDay: string, _actor: Actor) {
  return rpc<string>('prepare_payroll_run', { _period: period, _pay_day: payDay });
}
export function reviewPayroll(id: string, decision: 'ok' | 'return', comment: string, _actor: Actor) {
  return rpc('review_payroll_run', { _id: id, _decision: decision, _comment: comment });
}
export function approvePayroll(id: string, decision: 'approve' | 'return', comment: string, verified_by: 'pin' | 'passkey' | null, _actor: Actor) {
  return rpc('approve_payroll_run', { _id: id, _decision: decision, _comment: comment, _verified_by: verified_by });
}
export function payPayroll(id: string, reference: string, account_id: string | null, _actor: Actor) {
  return rpc('pay_payroll_run', { _id: id, _reference: reference, _account_id: account_id });
}
export const RUN_STAGES = ['Prepared', 'GM/CFO reviewed', 'Boss approved', 'Paid', 'Payslips released'];
export function runStage(r: PayrollRun, name: (id?: string | null) => string) {
  const w = (id: string | null, at: string | null) => (id && at ? `${name(id).split(' ')[0]} · ${fmtShort(at)}` : undefined);
  const idx: Record<RunStatus, number> = { prepared: 1, reviewed: 2, approved: 3, paid: 5, returned: 0 };
  return { stages: RUN_STAGES, current: idx[r.status], meta: [w(r.prepared_by, r.prepared_at), w(r.reviewed_by, r.reviewed_at), w(r.approved_by, r.approved_at) ? `${w(r.approved_by, r.approved_at)}${r.verified_by === 'passkey' ? ' · fingerprint' : r.verified_by === 'pin' ? ' · PIN' : ''}` : undefined, w(r.paid_by, r.paid_at), r.status === 'paid' ? 'Visible to staff' : undefined], rejected: r.status === 'returned' };
}
