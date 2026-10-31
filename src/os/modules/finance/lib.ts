// Finance & Approvals: types, settings, calculations and workflow calls.
// Each workflow call goes through `rpc(name, args, demo)`: with Supabase the SQL function in
// supabase/migrations/0006_finance.sql runs (and enforces roles + segregation of duties);
// in demo mode the JS twin below mirrors the same rules against the browser store.
import { useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { demoTable, insertRow, newId, nowIso, persistDemo, rpc, updateRow, useTable, type Row } from '@/os/lib/store';
import { notify } from '@/os/lib/notify';
import type { AppRole } from '@/lib/types';
import './seed';

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
const settingsNow = () => mergeSettings(demoTable('app_settings') as unknown as { key: string; value: unknown }[]);
export async function saveSetting(key: string, value: unknown) {
  if (supabase) {
    const { error } = await supabase.from('app_settings').upsert({ key, value, updated_at: nowIso() });
    if (error) throw error;
    return;
  }
  const rows = demoTable('app_settings');
  const i = rows.findIndex((r) => r.key === key);
  if (i >= 0) rows[i] = { ...rows[i], value };
  else rows.push({ id: key, key, value });
  persistDemo();
}

// ---------------------------------------------------------------- numbering (demo)
export function nextNumber(kind: 'invoice' | 'quotation' | 'proforma' | 'request' | 'receipt', existing: string[], fmtOverride?: string) {
  const fmt = fmtOverride ?? settingsNow().numbering[kind] ?? DEFAULT_SETTINGS.numbering[kind];
  const yr = String(new Date().getFullYear());
  const prefix = fmt.split('{0000}')[0].replace('{YYYY}', yr);
  const max = existing.filter((n) => n?.startsWith(prefix)).map((n) => parseInt(n.slice(prefix.length), 10) || 0).reduce((a, b) => Math.max(a, b), 0);
  return fmt.replace('{YYYY}', yr).replace('{0000}', String(max + 1).padStart(4, '0'));
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
const reqTable = () => demoTable('money_requests') as unknown as MoneyRequest[];
const findReq = (id: string) => {
  const r = reqTable().find((x) => x.id === id);
  if (!r) throw new Error('Request not found');
  return r;
};
const pushStep = (s: Omit<Step, 'id' | 'at' | 'device' | 'verified_by' | 'amount'> & Partial<Step>) =>
  demoTable('approval_steps').push({ id: newId(), at: nowIso(), created_at: nowIso(), device: '', verified_by: null, amount: null, ...s } as Row);
const tshTxt = (n: number) => `TSH ${Math.round(n).toLocaleString('en-GB')}`;
const ROLE_PEOPLE: Partial<Record<AppRole, string[]>> = { boss: ['u-boss'], gm_cfo: ['u-gm'], finance: ['u-fin'] };
const notifyRole = (role: AppRole, title: string, body: string, link: string, kind: 'money' | 'approval' = 'money') => (ROLE_PEOPLE[role] ?? []).forEach((u) => void notify(u, title, body, link, kind));
const need = (cond: boolean, msg: string) => { if (!cond) throw new Error(msg); };

export interface RequestDraft {
  project_id: string | null; budget_line_id: string | null; amount: number; purpose: string; category: string; needed_by: string | null;
  payee: string; payee_phone: string; method: Method; urgency: Urgency; attachment_url: string; comment?: string;
}

export function submitRequest(data: RequestDraft, id: string | null, actor: Actor) {
  return rpc<string>('submit_money_request', { _data: data, _id: id }, () => {
    const s = settingsNow();
    const reqs = reqTable();
    need(!!actor.userId, 'Sign in first');
    need(!(s.block_on_unretired && unretiredFor(reqs, actor.userId, s.retirement_days).length), 'Retire the receipts for your earlier advance before requesting more money');
    let r: MoneyRequest;
    let wasReturned = false;
    if (!id) {
      r = { id: newId(), number: nextNumber('request', reqs.map((x) => x.number)), requester_id: actor.userId, status: 'draft', created_at: nowIso(), change_returned: 0, approved_alone: false, over_budget: false, duplicate_of: null, question: null, recommendation: '' } as unknown as MoneyRequest;
      reqs.push(r);
    } else {
      r = findReq(id);
      need(r.requester_id === actor.userId, 'Only the requester can submit this request');
      need(['draft', 'returned'].includes(r.status), `This request is already ${STATUS_LABEL[r.status]}`);
      wasReturned = r.status === 'returned';
    }
    const lines = demoTable('project_budget_lines') as unknown as BudgetLine[];
    const line = lines.find((l) => l.id === data.budget_line_id);
    Object.assign(r, { ...data, category: data.category || line?.line || '' });
    delete (r as unknown as Record<string, unknown>).comment;
    need(Number(r.amount) > 0, 'Enter an amount above zero');
    need(r.purpose.trim().length >= 3, 'Say what the money is for');
    need(!line || line.project_id === r.project_id, 'That budget line belongs to another project');
    const rem = line ? lineStats(line, reqs, demoTable('expenses') as unknown as Expense[]).remaining : Infinity;
    const dup = reqs.find((x) => x.id !== r.id && x.requester_id === actor.userId && Number(x.amount) === Number(r.amount) && x.project_id === r.project_id && !['draft', 'rejected'].includes(x.status) && Date.now() - new Date(x.created_at).getTime() < 7 * 864e5);
    const isGm = actor.role === 'gm_cfo';
    Object.assign(r, { status: isGm ? 'boss_approval' : 'gm_review', submitted_at: nowIso(), stage_at: nowIso(), question: null, over_budget: Number(r.amount) > rem, duplicate_of: dup?.id ?? null, returned_at: null });
    pushStep({ request_id: r.id, step: 'submit', actor_id: actor.userId, decision: wasReturned ? 'resubmitted' : 'submitted', comment: data.comment ?? '', amount: Number(r.amount) });
    if (isGm) notifyRole('boss', `Approval needed · ${tshTxt(r.amount)}`, `${r.purpose} · requested by GM/CFO`, '/app?tab=approvals', 'approval');
    else notifyRole('gm_cfo', `New money request ${r.number}`, `${r.purpose} · ${tshTxt(r.amount)}`, '/app?tab=review');
    return r.id;
  });
}

export async function saveDraft(data: RequestDraft, id: string | null, actor: Actor) {
  // Drafts are plain rows (RLS lets the requester edit their own draft); numbering is assigned on submit in SQL.
  if (id) return updateRow('money_requests', id, { ...data });
  const reqs = reqTable();
  return insertRow('money_requests', { ...data, number: supabase ? `DRAFT-${Date.now().toString(36).toUpperCase()}` : nextNumber('request', reqs.map((x) => x.number)), requester_id: actor.userId, status: 'draft', change_returned: 0, approved_alone: false, over_budget: false, recommendation: '' });
}

export function reviewRequest(id: string, decision: 'recommend' | 'return' | 'reject', comment: string, actor: Actor) {
  return rpc<string>('review_money_request', { _id: id, _decision: decision, _comment: comment }, () => {
    need(actor.role === 'gm_cfo', 'Only the GM/CFO reviews money requests');
    const r = findReq(id);
    need(r.status === 'gm_review', `This request is not waiting for review (it is ${STATUS_LABEL[r.status]})`);
    need(r.requester_id !== actor.userId, 'You cannot review your own request');
    need(decision === 'recommend' || comment.trim().length > 0, 'Give a reason');
    const s = settingsNow();
    const now = nowIso();
    if (decision === 'recommend') {
      const used = reqTable().filter((x) => x.approved_alone && x.approved_by === actor.userId && x.approved_at?.slice(0, 10) === today()).reduce((a, x) => a + Number(x.approved_amount ?? 0), 0);
      const cap = s.approval_limits.gm_cfo_daily_cap;
      if (Number(r.amount) < s.approval_limits.gm_cfo_alone_below && (!cap || used + Number(r.amount) <= cap)) {
        Object.assign(r, { status: 'approved', approved_amount: r.amount, approved_by: actor.userId, approved_at: now, approved_alone: true, reviewed_by: actor.userId, reviewed_at: now, recommendation: comment, stage_at: now });
        pushStep({ request_id: id, step: 'review', actor_id: actor.userId, decision: 'approved_within_limit', comment, amount: r.amount });
        void notify(r.requester_id, `Request approved · ${r.number}`, 'Approved by GM/CFO within limit. Finance will pay next.', '/app?tab=requests', 'money');
        notifyRole('finance', `Ready to pay · ${tshTxt(r.amount)}`, `${r.number} · ${r.purpose}`, '/app?tab=queue');
        return 'approved';
      }
      Object.assign(r, { status: 'boss_approval', reviewed_by: actor.userId, reviewed_at: now, recommendation: comment, stage_at: now });
      pushStep({ request_id: id, step: 'review', actor_id: actor.userId, decision: 'recommended', comment, amount: r.amount });
      notifyRole('boss', `Approval needed · ${tshTxt(r.amount)}`, `${r.purpose} · recommended by GM/CFO`, '/app?tab=approvals', 'approval');
      return 'boss_approval';
    }
    if (decision === 'return') {
      Object.assign(r, { status: 'returned', reviewed_by: actor.userId, reviewed_at: now, returned_at: now, stage_at: now });
      pushStep({ request_id: id, step: 'review', actor_id: actor.userId, decision: 'returned', comment, amount: r.amount });
      void notify(r.requester_id, `Request returned · ${r.number}`, comment, '/app?tab=requests', 'money');
      return 'returned';
    }
    Object.assign(r, { status: 'rejected', reviewed_by: actor.userId, reviewed_at: now, rejected_at: now, stage_at: now });
    pushStep({ request_id: id, step: 'review', actor_id: actor.userId, decision: 'rejected', comment, amount: r.amount });
    void notify(r.requester_id, `Request rejected · ${r.number}`, comment, '/app?tab=requests', 'money');
    return 'rejected';
  });
}

export type BossDecision = 'approve' | 'approve_changed' | 'reject' | 'question';
export function bossDecide(id: string, decision: BossDecision, opts: { amount?: number; comment?: string; verified_by?: 'pin' | 'passkey' | null }, actor: Actor) {
  const comment = opts.comment ?? '';
  const device = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 120) : '';
  return rpc<string>('approve_money_request', { _id: id, _decision: decision, _amount: opts.amount ?? null, _comment: comment, _verified_by: opts.verified_by ?? null, _device: device }, () => {
    need(actor.role === 'boss', 'Only the Boss approves money requests');
    const r = findReq(id);
    need(r.status === 'boss_approval', `This request is not waiting for the Boss (it is ${STATUS_LABEL[r.status]})`);
    need(r.requester_id !== actor.userId, 'You cannot approve your own request');
    need(r.reviewed_by !== actor.userId, 'The reviewer and the approver must be different people');
    const now = nowIso();
    if (decision === 'approve' || decision === 'approve_changed') {
      need(opts.verified_by === 'pin' || opts.verified_by === 'passkey', 'Confirm with your fingerprint or PIN');
      const amt = decision === 'approve_changed' ? Number(opts.amount) : Number(r.amount);
      need(amt > 0, 'Enter the approved amount');
      Object.assign(r, { status: 'approved', approved_amount: amt, approved_by: actor.userId, approved_at: now, question: null, stage_at: now });
      pushStep({ request_id: id, step: 'approve', actor_id: actor.userId, decision: amt !== Number(r.amount) ? 'approved_changed' : 'approved', comment, amount: amt, device, verified_by: opts.verified_by });
      void notify(r.requester_id, `Approved · ${tshTxt(amt)}`, `${r.number} · Finance will pay next`, '/app?tab=requests', 'money');
      notifyRole('finance', `Ready to pay · ${tshTxt(amt)}`, `${r.number} · ${r.purpose}`, '/app?tab=queue');
      return 'approved';
    }
    need(comment.trim().length > 0, decision === 'question' ? 'Type your question' : 'Give a reason');
    if (decision === 'question') {
      r.question = comment;
      pushStep({ request_id: id, step: 'approve', actor_id: actor.userId, decision: 'question', comment, amount: r.amount });
      void notify(r.requester_id, `The Boss has a question · ${r.number}`, comment, '/app?tab=requests', 'approval');
      return 'question';
    }
    Object.assign(r, { status: 'rejected', rejected_at: now, approved_by: actor.userId, stage_at: now });
    pushStep({ request_id: id, step: 'approve', actor_id: actor.userId, decision: 'rejected', comment, amount: r.amount, device, verified_by: opts.verified_by ?? null });
    void notify(r.requester_id, `Request rejected · ${r.number}`, comment, '/app?tab=requests', 'money');
    if (r.reviewed_by) void notify(r.reviewed_by, `Boss rejected ${r.number}`, comment, '', 'money');
    return 'rejected';
  });
}

export function answerQuestion(id: string, answer: string, actor: Actor) {
  return rpc('answer_money_request', { _id: id, _answer: answer }, () => {
    const r = findReq(id);
    need(r.requester_id === actor.userId, 'Only the requester can answer');
    need(r.status === 'boss_approval' && !!r.question, 'There is no open question');
    need(answer.trim().length > 0, 'Type your answer');
    r.question = null;
    pushStep({ request_id: id, step: 'answer', actor_id: actor.userId, decision: 'answered', comment: answer, amount: r.amount });
    notifyRole('boss', `Answer on ${r.number}`, answer, '/app?tab=approvals', 'approval');
  });
}

export function payRequest(id: string, p: { method: string; reference: string; proof_url: string; account_id: string | null }, actor: Actor) {
  return rpc('pay_money_request', { _id: id, _method: p.method, _reference: p.reference, _proof_url: p.proof_url, _account_id: p.account_id }, () => {
    need(actor.role === 'finance', 'Only Finance pays money requests');
    const r = findReq(id);
    need(r.status === 'approved', `Only approved requests can be paid (this one is ${STATUS_LABEL[r.status]})`);
    need(r.requester_id !== actor.userId, 'You cannot pay your own request');
    need(r.approved_by !== actor.userId, 'The approver cannot also pay');
    need(p.method === 'Cash' || p.reference.trim().length > 0, 'Enter the transaction reference');
    const amt = Number(r.approved_amount ?? r.amount);
    const now = nowIso();
    Object.assign(r, { status: 'paid', paid_at: now, paid_by: actor.userId, paid_method: p.method, paid_reference: p.reference, paid_proof_url: p.proof_url, paid_account_id: p.account_id, stage_at: now });
    pushStep({ request_id: id, step: 'pay', actor_id: actor.userId, decision: 'paid', comment: `${p.method} · ${p.reference}`, amount: amt });
    demoTable('expenses').push({ id: newId(), created_at: now, date: today(), amount: amt, category: r.category || 'Contingency', account_id: p.account_id, project_id: r.project_id, budget_line_id: r.budget_line_id, request_id: r.id, payroll_run_id: null, payee: r.payee, description: `${r.number} · ${r.purpose}`, receipt_url: p.proof_url, petty_cash: p.method === 'Cash', recorded_by: actor.userId });
    void notify(r.requester_id, `Paid · ${tshTxt(amt)}`, `${p.method} ref ${p.reference}. Retire receipts within ${settingsNow().retirement_days} days.`, '/app?tab=requests', 'money');
  });
}

export function retireRequest(id: string, receipts: { url: string; amount: number; note: string }[], change: number, note: string, actor: Actor) {
  return rpc('retire_money_request', { _id: id, _receipts: receipts, _change: change, _note: note }, () => {
    const r = findReq(id);
    need(r.requester_id === actor.userId, 'Only the requester retires receipts');
    need(r.status === 'paid', 'Only paid requests can be retired');
    need(receipts.length > 0, 'Attach at least one receipt');
    const amt = Number(r.approved_amount ?? r.amount);
    need(change >= 0 && change <= amt, 'Change returned must be between 0 and the amount paid');
    const spent = receipts.reduce((s, x) => s + Number(x.amount), 0);
    const now = nowIso();
    demoTable('retirements').push({ id: newId(), created_at: now, request_id: id, receipts, total_spent: spent, change_returned: change, note, retired_by: actor.userId });
    Object.assign(r, { status: 'retired', retired_at: now, change_returned: change, stage_at: now });
    for (const e of demoTable('expenses')) if (e.request_id === id) e.amount = Math.max(amt - change, 0);
    pushStep({ request_id: id, step: 'retire', actor_id: actor.userId, decision: 'retired', comment: note, amount: spent });
    notifyRole('gm_cfo', `Receipts to reconcile · ${r.number}`, `${tshTxt(spent)} in receipts`, '/app?tab=more');
  });
}

export function reconcileRequest(id: string, decision: 'ok' | 'query', comment: string, actor: Actor) {
  return rpc('reconcile_money_request', { _id: id, _decision: decision, _comment: comment }, () => {
    need(actor.role === 'gm_cfo', 'Only the GM/CFO reconciles');
    const r = findReq(id);
    need(r.status === 'retired', 'Only retired requests can be reconciled');
    need(r.requester_id !== actor.userId, 'You cannot reconcile your own request');
    const now = nowIso();
    if (decision === 'query') {
      need(comment.trim().length > 0, 'Say what is wrong with the receipts');
      Object.assign(r, { status: 'paid', retired_at: null, stage_at: now });
      const rt = demoTable('retirements');
      for (let i = rt.length - 1; i >= 0; i--) if (rt[i].request_id === id) rt.splice(i, 1);
      pushStep({ request_id: id, step: 'reconcile', actor_id: actor.userId, decision: 'queried', comment });
      void notify(r.requester_id, `Receipts queried · ${r.number}`, comment, '/app?tab=requests', 'money');
      return;
    }
    Object.assign(r, { status: 'reconciled', reconciled_at: now, reconciled_by: actor.userId, stage_at: now });
    pushStep({ request_id: id, step: 'reconcile', actor_id: actor.userId, decision: 'reconciled', comment });
  });
}

// ---------------------------------------------------------------- invoices (demo twins of the SQL triggers)
export async function recordPayment(inv: Invoice, p: { amount: number; paid_on: string; method: string; reference: string; account_id: string | null; is_deposit: boolean }, actor: Actor) {
  if (supabase) return insertRow('invoice_payments', { invoice_id: inv.id, ...p });
  if (!PAYMENT_ROLES.includes(actor.role)) throw new Error('Only Finance or the GM/CFO records payments');
  const pays = demoTable('invoice_payments') as unknown as Payment[];
  const receipt_no = nextNumber('receipt', pays.map((x) => x.receipt_no));
  const row = await insertRow<Payment>('invoice_payments', { invoice_id: inv.id, ...p, receipt_no, recorded_by: actor.userId });
  await insertRow('income', { date: p.paid_on, amount: p.amount, account_id: p.account_id, client_id: inv.client_id, project_id: inv.project_id, invoice_id: inv.id, payment_id: row.id, category: 'Client payment', description: `Payment · ${inv.number}`, reference: p.reference, recorded_by: actor.userId });
  const paid = invoicePaid(inv, demoTable('invoice_payments') as unknown as Payment[]);
  const total = docTotals(inv).total;
  await updateRow('invoices', inv.id, { status: paid >= total ? 'paid' : 'partially_paid', paid_at: paid >= total ? nowIso() : null });
  return row;
}

// ---------------------------------------------------------------- proformas (demo twins of 0013_proforma.sql)
const proTable = () => demoTable('proformas') as unknown as Proforma[];
export const PROFORMA_TERMS = 'Payment by bank transfer or mobile money. Quote the proforma number as reference.';

/** Quotation → proforma: copies client, lines and VAT, marks the quotation accepted. Returns the proforma id. */
export function convertQuotationToProforma(quotationId: string, actor: Actor, validUntil?: string) {
  return rpc<string>('convert_quotation_to_proforma', { _quotation_id: quotationId, _valid_until: validUntil ?? null }, () => {
    need(MONEY_DOC_ROLES.includes(actor.role), 'Only the GM/CFO or Finance can raise a proforma');
    const q = (demoTable('quotations') as unknown as Quotation[]).find((x) => x.id === quotationId);
    need(!!q, 'Quotation not found');
    need(['sent', 'viewed', 'accepted'].includes(q!.status), `Only a sent or accepted quotation can become a proforma (this one is ${STATUS_LABEL[q!.status] ?? q!.status})`);
    need(!q!.invoice_id, 'This quotation is already invoiced');
    need(!proTable().some((p) => p.quotation_id === quotationId && p.status !== 'cancelled'), 'This quotation already has a proforma');
    need(q!.items.length > 0, 'The quotation has no line items');
    const id = newId();
    proTable().push({
      id, number: nextNumber('proforma', proTable().map((p) => p.number)), client_id: q!.client_id, project_id: q!.project_id, quotation_id: q!.id, prospect: q!.prospect, title: q!.title,
      items: structuredClone(q!.items), discount: q!.discount, vat_on: q!.vat_on, vat_rate: q!.vat_rate, issue_date: today(), valid_until: validUntil ?? addDays(today(), 30), status: 'draft',
      sent_at: null, accepted_at: null, cancelled_at: null, invoice_id: null, notes: q!.notes ?? '', terms: PROFORMA_TERMS, created_at: nowIso(),
    });
    Object.assign(q!, { status: 'accepted', accepted_at: q!.accepted_at ?? nowIso() });
    return id;
  });
}

/** Proforma → tax invoice (draft, 50/50 schedule, proforma and quotation linked). Returns the invoice id. */
export function convertProformaToInvoice(id: string, actor: Actor, dueDate?: string) {
  return rpc<string>('convert_proforma_to_invoice', { _id: id, _due_date: dueDate ?? null }, () => {
    need(MONEY_DOC_ROLES.includes(actor.role), 'Only the GM/CFO or Finance can raise an invoice');
    const p = proTable().find((x) => x.id === id);
    need(!!p, 'Proforma not found');
    need(!p!.invoice_id, 'This proforma is already invoiced');
    need(['sent', 'accepted'].includes(p!.status), `Send the proforma before invoicing it (this one is ${STATUS_LABEL[p!.status] ?? p!.status})`);
    need(!!p!.client_id, `Add ${p!.prospect || 'the prospect'} as a client before invoicing`);
    need(p!.items.length > 0, 'The proforma has no line items');
    const due = dueDate ?? addDays(today(), 14);
    const total = docTotals(p!).total;
    const invs = demoTable('invoices') as unknown as Invoice[];
    const inv: Invoice = {
      id: newId(), number: nextNumber('invoice', invs.map((x) => x.number)), client_id: p!.client_id, project_id: p!.project_id, quotation_id: p!.quotation_id, proforma_id: p!.id,
      title: p!.title, po_ref: '', items: structuredClone(p!.items), discount: p!.discount, vat_on: p!.vat_on, vat_rate: p!.vat_rate, deposit: Math.round(total / 2),
      schedule: [{ label: 'Deposit', pct: 50, due }, { label: 'On delivery', pct: 50, due: addDays(due, 31) }], issue_date: today(), due_date: due, status: 'draft',
      sent_at: null, viewed_at: null, paid_at: null, cancelled_at: null, notes: p!.notes, terms: p!.terms, created_at: nowIso(),
    };
    invs.push(inv);
    Object.assign(p!, { status: 'accepted', accepted_at: p!.accepted_at ?? nowIso(), invoice_id: inv.id });
    if (p!.quotation_id) {
      const q = (demoTable('quotations') as unknown as Quotation[]).find((x) => x.id === p!.quotation_id);
      if (q && !q.invoice_id) q.invoice_id = inv.id;
    }
    return inv.id;
  });
}

// ---------------------------------------------------------------- payroll workflow
const runsTable = () => demoTable('payroll_runs') as unknown as PayrollRun[];
const findRun = (id: string) => { const r = runsTable().find((x) => x.id === id); if (!r) throw new Error('Payroll run not found'); return r; };

export function preparePayroll(period: string, payDay: string, actor: Actor) {
  return rpc<string>('prepare_payroll_run', { _period: period, _pay_day: payDay }, () => {
    need(actor.role === 'finance', 'Only Finance prepares payroll');
    const s = settingsNow();
    let run = runsTable().find((r) => r.period === period);
    need(!run || ['prepared', 'returned'].includes(run.status), `Payroll for ${period} is already ${run && STATUS_LABEL[run.status]}`);
    if (!run) { run = { id: newId(), period, created_at: nowIso() } as PayrollRun; runsTable().push(run); }
    const slips = (demoTable('salary_profiles') as unknown as SalaryProfile[]).filter((p) => p.active).map((p) => computePayslip(p, s.statutory_rates));
    const ps = demoTable('payslips');
    for (let i = ps.length - 1; i >= 0; i--) if (ps[i].run_id === run.id) ps.splice(i, 1);
    slips.forEach((x) => ps.push({ id: newId(), run_id: run!.id, created_at: nowIso(), ...x }));
    Object.assign(run, { status: 'prepared', pay_day: payDay, prepared_by: actor.userId, prepared_at: nowIso(), reviewed_by: null, reviewed_at: null, approved_by: null, approved_at: null, comment: '', ...runTotals(slips) });
    notifyRole('gm_cfo', `Payroll ${period} ready for review`, '', '/app?tab=more');
    return run.id;
  });
}
export function reviewPayroll(id: string, decision: 'ok' | 'return', comment: string, actor: Actor) {
  return rpc('review_payroll_run', { _id: id, _decision: decision, _comment: comment }, () => {
    need(actor.role === 'gm_cfo', 'Only the GM/CFO reviews payroll');
    const run = findRun(id);
    need(run.status === 'prepared', 'Payroll is not waiting for review');
    need(run.prepared_by !== actor.userId, 'The preparer cannot also review');
    if (decision === 'return') { Object.assign(run, { status: 'returned', comment }); notifyRole('finance', `Payroll ${run.period} returned`, comment, ''); return; }
    Object.assign(run, { status: 'reviewed', reviewed_by: actor.userId, reviewed_at: nowIso(), comment });
    notifyRole('boss', `Payroll ${run.period} needs approval`, `${tshTxt(run.net)} net`, '/app?tab=approvals', 'approval');
  });
}
export function approvePayroll(id: string, decision: 'approve' | 'return', comment: string, verified_by: 'pin' | 'passkey' | null, actor: Actor) {
  return rpc('approve_payroll_run', { _id: id, _decision: decision, _comment: comment, _verified_by: verified_by }, () => {
    need(actor.role === 'boss', 'Only the Boss approves payroll');
    const run = findRun(id);
    need(run.status === 'reviewed', 'Payroll is not waiting for approval');
    need(actor.userId !== run.prepared_by && actor.userId !== run.reviewed_by, 'Preparer, reviewer and approver must be different people');
    if (decision === 'return') { Object.assign(run, { status: 'returned', comment }); notifyRole('finance', `Payroll ${run.period} returned by the Boss`, comment, ''); return; }
    need(verified_by === 'pin' || verified_by === 'passkey', 'Confirm with your fingerprint or PIN');
    Object.assign(run, { status: 'approved', approved_by: actor.userId, approved_at: nowIso(), verified_by });
    notifyRole('finance', `Payroll ${run.period} approved · pay now`, '', '/app?tab=more');
  });
}
export function payPayroll(id: string, reference: string, account_id: string | null, actor: Actor) {
  return rpc('pay_payroll_run', { _id: id, _reference: reference, _account_id: account_id }, () => {
    need(actor.role === 'finance', 'Only Finance pays payroll');
    const run = findRun(id);
    need(run.status === 'approved', 'Payroll must be approved by the Boss first');
    need(run.approved_by !== actor.userId, 'The approver cannot also pay');
    Object.assign(run, { status: 'paid', paid_by: actor.userId, paid_at: nowIso(), paid_reference: reference });
    demoTable('expenses').push({ id: newId(), created_at: nowIso(), date: today(), amount: Number(run.gross) + Number(run.nssf_employer) + Number(run.wcf) + Number(run.sdl), category: 'Salaries', account_id, project_id: null, budget_line_id: null, request_id: null, payroll_run_id: run.id, payee: 'Staff payroll', description: `Payroll ${run.period} (gross + employer NSSF, WCF, SDL)`, receipt_url: '', petty_cash: false, recorded_by: actor.userId });
    for (const s of demoTable('payslips')) if (s.run_id === id) void notify(String(s.user_id), `Your payslip for ${run.period} is ready`, `Net pay ${tshTxt(Number(s.net))}`, '/app?tab=more', 'money');
  });
}
export const RUN_STAGES = ['Prepared', 'GM/CFO reviewed', 'Boss approved', 'Paid', 'Payslips released'];
export function runStage(r: PayrollRun, name: (id?: string | null) => string) {
  const w = (id: string | null, at: string | null) => (id && at ? `${name(id).split(' ')[0]} · ${fmtShort(at)}` : undefined);
  const idx: Record<RunStatus, number> = { prepared: 1, reviewed: 2, approved: 3, paid: 5, returned: 0 };
  return { stages: RUN_STAGES, current: idx[r.status], meta: [w(r.prepared_by, r.prepared_at), w(r.reviewed_by, r.reviewed_at), w(r.approved_by, r.approved_at) ? `${w(r.approved_by, r.approved_at)}${r.verified_by === 'passkey' ? ' · fingerprint' : r.verified_by === 'pin' ? ' · PIN' : ''}` : undefined, w(r.paid_by, r.paid_at), r.status === 'paid' ? 'Visible to staff' : undefined], rejected: r.status === 'returned' };
}
