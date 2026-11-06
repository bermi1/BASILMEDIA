// Invoices, quotations, receipts (incl. printable A4 letterhead) and quick income/expense recording.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRightLeft, Bell, FilePlus2, FileText, Plus, Printer, Trash2 } from 'lucide-react';
import { useSettings } from '@/hooks/useData';
import { useActing } from '@/os/lib/session';
import { insertRow, nowIso, updateRow, useTable } from '@/os/lib/store';
import { notifyRole } from '@/os/lib/notify';
import { useToast } from '@/os/cms/toast';
import { Card, Empty, Field, Pill, Sheet, StageTracker, Tabs, inputCls, tsh, tshShort } from '@/os/ui';
import {
  METHODS, MONEY_DOC_ROLES, PAYMENT_ROLES, STATUS_LABEL, addDays, convertQuotationToProforma, docTotals, fmtDate, fmtShort, invoicePaid, invoiceStatus, proformaStatus, quotationStatus, recordPayment, statusTone, today, useFinance,
  type Category, type Fin, type Instalment, type Invoice, type LineItem, type Payment, type PriceItem, type Proforma, type Quotation,
} from './lib';
import { StatusPill, errMsg } from './components';

type Kind = 'invoice' | 'quotation';
const TABLE: Record<Kind, string> = { invoice: 'invoices', quotation: 'quotations' };

// ---------------------------------------------------------------- trackers
export const INV_STAGES = ['Draft', 'Sent', 'Viewed', 'Partially paid', 'Paid'];
export function invoiceTracker(inv: Invoice, pays: Payment[]) {
  const st = invoiceStatus(inv, pays);
  const last = pays.filter((p) => p.invoice_id === inv.id).at(-1);
  const meta = [fmtShort(inv.created_at), inv.sent_at ? fmtShort(inv.sent_at) : undefined, inv.viewed_at ? fmtShort(inv.viewed_at) : undefined, last && st !== 'paid' ? fmtShort(last.paid_on) : undefined, st === 'paid' ? fmtShort(inv.paid_at ?? last?.paid_on) : undefined];
  const idx = { draft: 0, sent: 1, viewed: 2, partially_paid: 3, overdue: inv.viewed_at ? 2 : 1, paid: 5, cancelled: 1 }[st];
  if (st === 'overdue') meta[idx] = `Overdue ${fmtDate(inv.due_date)}`;
  return { stages: INV_STAGES, current: idx, meta, rejected: st === 'overdue' || st === 'cancelled' };
}
export const QUO_STAGES = ['Draft', 'Sent', 'Viewed', 'Accepted', 'Invoiced'];
export function quotationTracker(q: Quotation) {
  const st = quotationStatus(q);
  const idx = q.invoice_id ? 5 : { draft: 0, sent: 1, viewed: 2, accepted: 4, declined: 3, expired: q.viewed_at ? 2 : 1 }[st];
  const meta = [fmtShort(q.created_at), q.sent_at ? fmtShort(q.sent_at) : undefined, q.viewed_at ? fmtShort(q.viewed_at) : undefined, st === 'declined' ? 'Declined' : q.accepted_at ? fmtShort(q.accepted_at) : undefined, q.invoice_id ? 'Converted' : undefined];
  if (st === 'expired') meta[idx] = `Expired ${fmtDate(q.valid_until)}`;
  return { stages: QUO_STAGES, current: idx, meta, rejected: st === 'declined' || st === 'expired' };
}

// ---------------------------------------------------------------- lists
export function InvoicesList({ compact }: { compact?: boolean }) {
  const fin = useFinance();
  const [params, setParams] = useSearchParams();
  const [f, setF] = useState(params.get('open') ? 'all' : 'open');
  const [open, setOpen] = useState<string | null>(params.get('open'));
  useEffect(() => { if (params.get('open')) setParams((p) => (p.delete('open'), p), { replace: true }); }, [params, setParams]);
  const [edit, setEdit] = useState<Invoice | 'new' | null>(null);
  const rows = fin.invRows.filter((r) => (f === 'open' ? !['paid', 'cancelled', 'draft'].includes(r.status) : f === 'overdue' ? r.status === 'overdue' : f === 'draft' ? r.status === 'draft' : f === 'paid' ? r.status === 'paid' : true));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="m-0 text-xl font-extrabold">Invoices</h2><p className="m-0 text-sm text-basil-muted">{tsh(fin.outstanding)} outstanding · <span className="font-bold text-red-700">{tsh(fin.overdue)} overdue</span></p></div>
        <button type="button" onClick={() => setEdit('new')} className="btn-primary min-h-[44px]"><Plus size={18} />New invoice</button>
      </div>
      <Tabs value={f} onChange={setF} items={[{ value: 'open', label: 'Open' }, { value: 'overdue', label: 'Overdue', count: fin.overdueRows.length }, { value: 'draft', label: 'Drafts' }, { value: 'paid', label: 'Paid' }, { value: 'all', label: 'All' }]} />
      {!rows.length && <Empty icon={<FileText />} title="No invoices here" />}
      {rows.map((r) => (
        <button key={r.inv.id} type="button" onClick={() => setOpen(r.inv.id)} className="flex items-center gap-3 rounded-2xl border border-basil-line bg-white p-3 text-left">
          <span className="min-w-0 flex-1"><b className="block truncate">{fin.client(r.inv.client_id)?.name ?? 'Client'}</b><span className="block truncate text-xs text-basil-muted">{r.inv.number} · {r.inv.title}</span>
            <span className="mt-1 flex flex-wrap gap-1"><StatusPill status={r.status} />{r.status === 'overdue' && <Pill tone="red">{r.daysOverdue} days late</Pill>}{!compact && <span className="text-xs text-basil-muted">Due {fmtDate(r.inv.due_date)}</span>}</span></span>
          <span className="shrink-0 text-right"><b className="block font-display">{tshShort(r.balance || r.total)}</b><span className="text-[11px] text-basil-muted">{r.paid ? `of ${tshShort(r.total)}` : 'total'}</span></span>
        </button>
      ))}
      <Sheet open={!!open} onClose={() => setOpen(null)} title="Invoice">{open && <InvoiceDetail id={open} fin={fin} onEdit={(i) => { setOpen(null); setEdit(i); }} />}</Sheet>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'New invoice' : 'Edit invoice'}>{edit && <DocEditor kind="invoice" fin={fin} existing={edit === 'new' ? undefined : edit} onDone={() => setEdit(null)} />}</Sheet>
    </div>
  );
}

export function QuotationsList() {
  const fin = useFinance();
  const nav = useNavigate();
  const { role, userId } = useActing();
  const toast = useToast();
  const { rows } = useTable<Quotation>('quotations', { order: 'issue_date', ascending: false });
  const { rows: pros } = useTable<Proforma>('proformas');
  const [open, setOpen] = useState<string | null>(null);
  const toProforma = async (q: Quotation) => {
    try { const id = await convertQuotationToProforma(q.id, { role, userId }); toast('Proforma created as draft'); nav(`/os/finance/proformas?open=${id}`); } catch (e) { toast(errMsg(e), 'error'); }
  };
  const [edit, setEdit] = useState<Quotation | 'new' | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="m-0 text-xl font-extrabold">Quotations</h2><p className="m-0 text-sm text-basil-muted">{rows.filter((q) => ['sent', 'viewed'].includes(quotationStatus(q))).length} awaiting client · {tshShort(rows.filter((q) => ['sent', 'viewed'].includes(quotationStatus(q))).reduce((s, q) => s + docTotals(q).total, 0))} in play</p></div>
        <button type="button" onClick={() => setEdit('new')} className="btn-primary min-h-[44px]"><Plus size={18} />New quotation</button>
      </div>
      {rows.map((q) => {
        const pf = pros.find((p) => p.quotation_id === q.id && p.status !== 'cancelled');
        const convertible = canConvertQuotation(q, pf) && MONEY_DOC_ROLES.includes(role);
        return (
          <div key={q.id} className="flex items-stretch overflow-hidden rounded-2xl border border-basil-line bg-white">
            <button type="button" onClick={() => setOpen(q.id)} className="flex min-w-0 flex-1 items-center gap-3 border-0 bg-transparent p-3 text-left">
              <span className="min-w-0 flex-1"><b className="block truncate">{fin.client(q.client_id)?.name ?? q.prospect}</b><span className="block truncate text-xs text-basil-muted">{q.number} · {q.title}</span><span className="mt-1 flex flex-wrap gap-1"><StatusPill status={quotationStatus(q)} />{q.invoice_id && <Pill tone="green">Invoiced</Pill>}{pf && !q.invoice_id && <Pill tone="blue">Proforma {pf.number.slice(-4)}</Pill>}<span className="text-xs text-basil-muted">Valid to {fmtDate(q.valid_until)}</span></span></span>
              <b className="shrink-0 font-display">{tshShort(docTotals(q).total)}</b>
            </button>
            {convertible && <button type="button" onClick={() => void toProforma(q)} className="flex w-[104px] shrink-0 flex-col items-center justify-center gap-1 border-0 border-l border-basil-line bg-basil-mist px-2 text-xs font-bold text-basil-deep" title="Convert to proforma"><ArrowRightLeft size={18} />Convert to proforma</button>}
          </div>
        );
      })}
      <Sheet open={!!open} onClose={() => setOpen(null)} title="Quotation">{open && <QuotationDetail q={rows.find((x) => x.id === open)!} fin={fin} onEdit={(q) => { setOpen(null); setEdit(q); }} onClose={() => setOpen(null)} onProforma={(id) => nav(`/os/finance/proformas?open=${id}`)} />}</Sheet>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'New quotation' : 'Edit quotation'}>{edit && <DocEditor kind="quotation" fin={fin} existing={edit === 'new' ? undefined : edit} onDone={() => setEdit(null)} />}</Sheet>
    </div>
  );
}

// ---------------------------------------------------------------- details
function Totals({ d, paid }: { d: { items: LineItem[]; discount: number; vat_on: boolean; vat_rate: number }; paid?: number }) {
  const t = docTotals(d);
  const row = (l: string, v: string, b = false) => <div className={`flex justify-between ${b ? 'border-t border-basil-line pt-1.5 font-extrabold' : ''}`}><span>{l}</span><span>{v}</span></div>;
  return <div className="flex flex-col gap-1 text-sm">{row('Subtotal', tsh(t.sub))}{t.discount > 0 && row('Discount', `− ${tsh(t.discount)}`)}{d.vat_on && row(`VAT ${d.vat_rate}%`, tsh(t.vat))}{row('Total', tsh(t.total), true)}{paid !== undefined && <>{row('Paid', `− ${tsh(paid)}`)}{row('Balance due', tsh(Math.max(t.total - paid, 0)), true)}</>}</div>;
}

export function InvoiceDetail({ id, fin, onEdit }: { id: string; fin: Fin; onEdit: (i: Invoice) => void }) {
  const { role, userId } = useActing();
  const toast = useToast();
  const inv = fin.invoices.find((x) => x.id === id);
  const [pay, setPay] = useState(false);
  if (!inv) return null;
  const pays = fin.payments.filter((p) => p.invoice_id === inv.id);
  const paid = invoicePaid(inv, fin.payments);
  const st = invoiceStatus(inv, fin.payments);
  const total = docTotals(inv).total;
  const set = async (patch: Partial<Invoice>, msg: string) => { try { await updateRow('invoices', inv.id, patch); toast(msg); } catch (e) { toast(errMsg(e), 'error'); } };
  return (
    <div className="flex flex-col gap-4">
      <div><span className="text-sm text-basil-muted">{inv.number} · {fin.client(inv.client_id)?.name}</span><b className="block font-display text-2xl">{tsh(total)}</b><span className="text-sm">{inv.title}</span><div className="mt-1 flex flex-wrap gap-1"><StatusPill status={st} /><span className="text-xs text-basil-muted">Issued {fmtDate(inv.issue_date)} · due {fmtDate(inv.due_date)}</span></div>{inv.proforma_id && <ProformaSource id={inv.proforma_id} />}</div>
      <StageTracker {...invoiceTracker(inv, fin.payments)} />
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">{inv.items.map((i, k) => <li key={k} className="flex justify-between gap-2"><span>{i.title} <span className="text-basil-muted">× {i.qty}</span></span><span>{tsh(i.qty * i.unit_price)}</span></li>)}</ul>
      <Totals d={inv} paid={paid} />
      {inv.schedule.length > 0 && (
        <div className="rounded-xl bg-basil-mist p-3 text-sm"><b>Instalment schedule</b>
          {(() => { let acc = 0; return inv.schedule.map((s, k) => { const amt = Math.round((total * s.pct) / 100); acc += amt; const done = paid >= acc; return <div key={k} className="flex justify-between gap-2"><span>{s.pct}% · {s.label} · {fmtDate(s.due)}</span><span className={done ? 'font-bold text-emerald-700' : ''}>{tsh(amt)} {done ? '✓' : ''}</span></div>; }); })()}
        </div>
      )}
      {pays.length > 0 && (
        <div className="text-sm"><b>Payments</b>{pays.map((p) => <div key={p.id} className="flex items-center justify-between gap-2 border-b border-basil-line py-1.5"><span>{fmtDate(p.paid_on)} · {p.method}{p.is_deposit ? ' · deposit' : ''}<span className="block text-xs text-basil-muted">{p.receipt_no} · ref {p.reference}</span></span><span className="text-right"><b>{tsh(p.amount)}</b><Link to={`/os/finance/print/receipt/${p.id}`} className="block text-xs">Receipt</Link></span></div>)}</div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Link to={`/os/finance/print/invoice/${inv.id}`} className="btn-outline min-h-[44px]"><Printer size={16} />Print / PDF</Link>
        {st === 'draft' && <button type="button" className="btn-outline min-h-[44px]" onClick={() => onEdit(inv)}>Edit</button>}
        {st === 'draft' && <button type="button" className="btn-primary col-span-2 min-h-[44px]" onClick={() => set({ status: 'sent', sent_at: nowIso() }, 'Marked as sent')}>Mark sent</button>}
        {st === 'sent' && <button type="button" className="btn-outline min-h-[44px]" onClick={() => set({ status: 'viewed', viewed_at: nowIso() }, 'Marked as viewed')}>Client viewed</button>}
        {['sent', 'viewed', 'partially_paid', 'overdue'].includes(st) && PAYMENT_ROLES.includes(role) && <button type="button" className="btn-primary min-h-[44px] !bg-emerald-600" onClick={() => setPay(true)}>Record payment</button>}
        {st === 'overdue' && <button type="button" className="btn-outline min-h-[44px]" onClick={() => { void notifyRole('account_manager', `Chase ${inv.number}`, `${fin.client(inv.client_id)?.name} · ${tsh(total - paid)} overdue`, '', 'alert'); toast('Reminder sent to the client and account manager'); }}><Bell size={16} />Send reminder</button>}
        {!['paid', 'cancelled'].includes(st) && paid === 0 && <button type="button" className="btn-outline min-h-[44px] !text-red-700" onClick={() => confirm('Cancel this invoice?') && set({ status: 'cancelled', cancelled_at: nowIso() }, 'Invoice cancelled')}>Cancel</button>}
      </div>
      {!PAYMENT_ROLES.includes(role) && ['sent', 'viewed', 'partially_paid', 'overdue'].includes(st) && <p className="m-0 text-xs text-basil-muted">Only Finance or the GM/CFO records payments.</p>}
      <Sheet open={pay} onClose={() => setPay(false)} title="Record payment"><PaymentForm inv={inv} fin={fin} balance={total - paid} onDone={() => setPay(false)} actor={{ role, userId }} /></Sheet>
    </div>
  );
}

export function PaymentForm({ inv, fin, balance, onDone, actor }: { inv: Invoice; fin: Fin; balance: number; onDone: () => void; actor: { role: never | string; userId: string } }) {
  const toast = useToast();
  const [f, setF] = useState({ amount: String(Math.round(balance)), paid_on: today(), method: 'Bank transfer', reference: '', account_id: fin.accounts.find((a) => a.kind === 'bank')?.id ?? null as string | null, is_deposit: invoicePaid(inv, fin.payments) === 0 && inv.deposit > 0 });
  return (
    <form className="flex flex-col gap-3" onSubmit={async (e) => { e.preventDefault(); try { await recordPayment(inv, { ...f, amount: Number(f.amount) }, actor as never); toast('Payment recorded · receipt issued'); onDone(); } catch (x) { toast(errMsg(x), 'error'); } }}>
      <Field label="Amount (TSH)" hint={`Balance ${tsh(balance)}`}><input className={inputCls} inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d]/g, '') })} required /></Field>
      <div className="grid grid-cols-2 gap-2"><Field label="Date"><input type="date" className={inputCls} value={f.paid_on} onChange={(e) => setF({ ...f, paid_on: e.target.value })} /></Field>
        <Field label="Method"><select className={inputCls} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field></div>
      <Field label="Into account"><select className={inputCls} value={f.account_id ?? ''} onChange={(e) => setF({ ...f, account_id: e.target.value })}>{fin.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
      <Field label="Reference"><input className={inputCls} value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} required /></Field>
      <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" checked={f.is_deposit} onChange={(e) => setF({ ...f, is_deposit: e.target.checked })} />This is the deposit</label>
      <button type="submit" className="btn-primary min-h-[48px]">Record payment</button>
    </form>
  );
}

function ProformaSource({ id }: { id: string }) {
  const { rows } = useTable<Proforma>('proformas');
  const p = rows.find((x) => x.id === id);
  return p ? <span className="mt-1 block text-xs text-basil-muted">From proforma {p.number}</span> : null;
}

export const canConvertQuotation = (q: Quotation, pf?: Proforma) => ['sent', 'viewed', 'accepted'].includes(quotationStatus(q)) && !q.invoice_id && !pf;

export function QuotationDetail({ q, fin, onEdit, onClose, onProforma }: { q: Quotation; fin: Fin; onEdit: (q: Quotation) => void; onClose: () => void; onProforma?: (proformaId: string) => void }) {
  const toast = useToast();
  const { role, userId } = useActing();
  const { rows: pros } = useTable<Proforma>('proformas');
  const pf = pros.find((p) => p.quotation_id === q.id && p.status !== 'cancelled');
  const st = quotationStatus(q);
  const toProforma = async () => {
    try { const id = await convertQuotationToProforma(q.id, { role, userId }); toast('Proforma created as draft'); onClose(); onProforma?.(id); } catch (e) { toast(errMsg(e), 'error'); }
  };
  const set = async (patch: Partial<Quotation>, msg: string) => { try { await updateRow('quotations', q.id, patch); toast(msg); } catch (e) { toast(errMsg(e), 'error'); } };
  const convert = async () => {
    try {
      const sched: Instalment[] = [{ label: 'Deposit', pct: 50, due: addDays(today(), 14) }, { label: 'On delivery', pct: 50, due: addDays(today(), 45) }];
      const total = docTotals(q).total;
      const inv = await insertRow<Invoice>('invoices', {
        client_id: q.client_id, project_id: q.project_id, quotation_id: q.id, title: q.title, po_ref: '', items: q.items, discount: q.discount, vat_on: q.vat_on, vat_rate: q.vat_rate,
        deposit: Math.round(total / 2), schedule: sched, issue_date: today(), due_date: addDays(today(), 14), status: 'draft', notes: '', terms: '',
      });
      await updateRow('quotations', q.id, { status: 'accepted', accepted_at: q.accepted_at ?? nowIso(), invoice_id: inv.id });
      toast(`Invoice ${inv.number ?? ''} created as draft`); onClose();
    } catch (e) { toast(errMsg(e), 'error'); }
  };
  return (
    <div className="flex flex-col gap-4">
      <div><span className="text-sm text-basil-muted">{q.number} · {fin.client(q.client_id)?.name ?? q.prospect}</span><b className="block font-display text-2xl">{tsh(docTotals(q).total)}</b><span className="text-sm">{q.title}</span><div className="mt-1 flex gap-1"><StatusPill status={st} /><span className="text-xs text-basil-muted">Valid until {fmtDate(q.valid_until)}</span></div></div>
      <StageTracker {...quotationTracker(q)} />
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">{q.items.map((i, k) => <li key={k} className="flex justify-between gap-2"><span>{i.title} <span className="text-basil-muted">× {i.qty}</span></span><span>{tsh(i.qty * i.unit_price)}</span></li>)}</ul>
      <Totals d={q} />
      <div className="grid grid-cols-2 gap-2">
        <Link to={`/os/finance/print/quotation/${q.id}`} className="btn-outline min-h-[44px]"><Printer size={16} />Print / PDF</Link>
        {st === 'draft' && <button type="button" className="btn-outline min-h-[44px]" onClick={() => onEdit(q)}>Edit</button>}
        {st === 'draft' && <button type="button" className="btn-primary col-span-2 min-h-[44px]" onClick={() => set({ status: 'sent', sent_at: nowIso() }, 'Marked as sent')}>Mark sent</button>}
        {st === 'sent' && <button type="button" className="btn-outline min-h-[44px]" onClick={() => set({ status: 'viewed', viewed_at: nowIso() }, 'Marked as viewed')}>Client viewed</button>}
        {['sent', 'viewed'].includes(st) && <button type="button" className="btn-outline min-h-[44px] !text-red-700" onClick={() => set({ status: 'declined', declined_at: nowIso() }, 'Marked declined')}>Declined</button>}
        {canConvertQuotation(q, pf) && MONEY_DOC_ROLES.includes(role) && <button type="button" className="btn-primary min-h-[44px]" onClick={toProforma}><ArrowRightLeft size={16} />Convert to proforma</button>}
        {['sent', 'viewed', 'accepted'].includes(st) && !q.invoice_id && !pf && <button type="button" className="btn-primary min-h-[44px] !bg-emerald-600" onClick={convert}><FilePlus2 size={16} />Accept → invoice</button>}
      </div>
      {pf && <p className="m-0 rounded-xl bg-basil-ice p-3 text-sm">Proforma <b>{pf.number}</b> · {STATUS_LABEL[proformaStatus(pf)]}{onProforma && <button type="button" onClick={() => { onClose(); onProforma(pf.id); }} className="ml-2 border-0 bg-transparent p-0 font-bold text-basil underline">Open</button>}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- editor (invoice or quotation)
function DocEditor({ kind, fin, existing, onDone }: { kind: Kind; fin: Fin; existing?: Invoice | Quotation; onDone: () => void }) {
  const toast = useToast();
  const { rows: prices } = useTable<PriceItem>('price_items');
  const ex = existing as (Partial<Invoice> & Partial<Quotation>) | undefined;
  const [d, setD] = useState({
    client_id: (ex?.client_id ?? fin.clients[0]?.id ?? null) as string | null, prospect: ex?.prospect ?? '', project_id: ex?.project_id ?? null as string | null, title: ex?.title ?? '', po_ref: ex?.po_ref ?? '',
    items: ex?.items ?? ([] as LineItem[]), discount: ex?.discount ?? 0, vat_on: ex?.vat_on ?? true, vat_rate: ex?.vat_rate ?? fin.settings.vat_rate,
    issue_date: ex?.issue_date ?? today(), due_date: ex?.due_date ?? addDays(today(), 14), valid_until: ex?.valid_until ?? addDays(today(), 30),
    schedule: ex?.schedule ?? ([{ label: 'Deposit', pct: 40, due: today() }, { label: 'On delivery', pct: 60, due: addDays(today(), 30) }] as Instalment[]), notes: ex?.notes ?? '',
  });
  useEffect(() => { if (!existing && !d.items.length && prices[0]) setD((x) => ({ ...x, items: [{ title: prices[0].name, detail: prices[0].detail, qty: 1, unit_price: Number(prices[0].unit_price) }] })); }, [prices.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const t = docTotals(d);
  const setItem = (i: number, patch: Partial<LineItem>) => setD({ ...d, items: d.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const save = async () => {
    try {
      const common = { client_id: d.client_id, project_id: d.project_id, title: d.title, items: d.items, discount: Number(d.discount), vat_on: d.vat_on, vat_rate: Number(d.vat_rate), issue_date: d.issue_date, notes: d.notes };
      const row = kind === 'invoice'
        ? { ...common, po_ref: d.po_ref, due_date: d.due_date, schedule: d.schedule, deposit: d.schedule[0] ? Math.round((t.total * d.schedule[0].pct) / 100) : 0 }
        : { ...common, prospect: d.prospect, valid_until: d.valid_until };
      if (existing) await updateRow(TABLE[kind], existing.id, row);
      else await insertRow(TABLE[kind], { ...row, status: 'draft' });
      toast(`${kind === 'invoice' ? 'Invoice' : 'Quotation'} saved as draft`); onDone();
    } catch (e) { toast(errMsg(e), 'error'); }
  };
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <Field label="Bill to"><select className={inputCls} value={d.client_id ?? ''} onChange={(e) => setD({ ...d, client_id: e.target.value || null })}>{kind === 'quotation' && <option value="">New prospect…</option>}{fin.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      {kind === 'quotation' && !d.client_id && <Field label="Prospect name"><input className={inputCls} value={d.prospect} onChange={(e) => setD({ ...d, prospect: e.target.value })} required /></Field>}
      <Field label="Project (optional)"><select className={inputCls} value={d.project_id ?? ''} onChange={(e) => setD({ ...d, project_id: e.target.value || null })}><option value="">—</option>{fin.projects.filter((p) => !d.client_id || p.client_id === d.client_id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      <Field label="Title"><input className={inputCls} value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} required placeholder="e.g. Scholarship campaign film" /></Field>
      <div className="flex flex-col gap-2">
        <b className="text-sm text-[#33465F]">Line items</b>
        {d.items.map((it, i) => (
          <div key={i} className="grid grid-cols-[1fr_64px_110px_40px] items-center gap-1.5 rounded-xl border border-basil-line p-2">
            <input aria-label="Description" className={`${inputCls} h-10 text-sm`} value={it.title} onChange={(e) => setItem(i, { title: e.target.value })} />
            <input aria-label="Quantity" className={`${inputCls} h-10 text-sm`} inputMode="decimal" value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) || 0 })} />
            <input aria-label="Unit price" className={`${inputCls} h-10 text-sm`} inputMode="numeric" value={it.unit_price} onChange={(e) => setItem(i, { unit_price: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })} />
            <button type="button" aria-label="Remove line" onClick={() => setD({ ...d, items: d.items.filter((_, j) => j !== i) })} className="flex h-10 w-10 items-center justify-center rounded-lg border-0 bg-red-50 text-red-700"><Trash2 size={16} /></button>
          </div>
        ))}
        <select className={inputCls} value="" onChange={(e) => { const p = prices.find((x) => x.id === e.target.value); if (p) setD({ ...d, items: [...d.items, { title: p.name, detail: p.detail, qty: 1, unit_price: Number(p.unit_price) }] }); }}>
          <option value="">+ Add from price list…</option>{prices.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name} · {tsh(p.unit_price)}/{p.unit}</option>)}
        </select>
        <button type="button" className="btn-outline" onClick={() => setD({ ...d, items: [...d.items, { title: '', detail: '', qty: 1, unit_price: 0 }] })}>+ Custom line</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Discount (TSH)"><input className={inputCls} inputMode="numeric" value={d.discount} onChange={(e) => setD({ ...d, discount: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })} /></Field>
        <label className="flex min-h-[48px] items-end gap-2 pb-3 text-sm font-bold"><input type="checkbox" checked={d.vat_on} onChange={(e) => setD({ ...d, vat_on: e.target.checked })} />Add VAT {d.vat_rate}%</label>
      </div>
      {kind === 'invoice' ? (
        <>
          <div className="grid grid-cols-2 gap-2"><Field label="Issue date"><input type="date" className={inputCls} value={d.issue_date} onChange={(e) => setD({ ...d, issue_date: e.target.value })} /></Field><Field label="Due date"><input type="date" className={inputCls} value={d.due_date} onChange={(e) => setD({ ...d, due_date: e.target.value })} /></Field></div>
          <Field label="Client PO reference"><input className={inputCls} value={d.po_ref} onChange={(e) => setD({ ...d, po_ref: e.target.value })} /></Field>
          <div className="flex flex-col gap-2"><b className="text-sm text-[#33465F]">Instalments (first = deposit)</b>
            {d.schedule.map((s, i) => (
              <div key={i} className="grid grid-cols-[60px_1fr_130px_40px] gap-1.5">
                <input aria-label="Percent" className={`${inputCls} h-10 text-sm`} inputMode="numeric" value={s.pct} onChange={(e) => setD({ ...d, schedule: d.schedule.map((x, j) => (j === i ? { ...x, pct: Number(e.target.value) || 0 } : x)) })} />
                <input aria-label="Label" className={`${inputCls} h-10 text-sm`} value={s.label} onChange={(e) => setD({ ...d, schedule: d.schedule.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                <input aria-label="Due" type="date" className={`${inputCls} h-10 text-sm`} value={s.due} onChange={(e) => setD({ ...d, schedule: d.schedule.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)) })} />
                <button type="button" aria-label="Remove instalment" onClick={() => setD({ ...d, schedule: d.schedule.filter((_, j) => j !== i) })} className="h-10 w-10 rounded-lg border-0 bg-red-50 text-red-700"><Trash2 size={16} className="mx-auto" /></button>
              </div>
            ))}
            <button type="button" className="btn-outline" onClick={() => setD({ ...d, schedule: [...d.schedule, { label: 'Instalment', pct: 0, due: addDays(today(), 30) }] })}>+ Instalment</button>
            {d.schedule.length > 0 && d.schedule.reduce((s, x) => s + x.pct, 0) !== 100 && <span className="text-xs font-bold text-amber-700">Instalments add up to {d.schedule.reduce((s, x) => s + x.pct, 0)}% (should be 100%)</span>}
          </div>
        </>
      ) : <Field label="Valid until"><input type="date" className={inputCls} value={d.valid_until} onChange={(e) => setD({ ...d, valid_until: e.target.value })} /></Field>}
      <div className="rounded-xl bg-basil-mist p-3"><Totals d={d} /></div>
      <button type="submit" disabled={!d.items.length} className="btn-primary min-h-[48px]">Save draft</button>
    </form>
  );
}

// ---------------------------------------------------------------- printable A4 page
const PRINT_CSS = `@page { size: A4; margin: 12mm; }
@media print { body * { visibility: hidden !important; } .print-area, .print-area * { visibility: visible !important; } .print-area { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: 0 !important; margin: 0 !important; } .no-print { display: none !important; } }`;

export function PrintDoc() {
  const { kind, id } = useParams();
  const fin = useFinance();
  const s = useSettings();
  const nav = useNavigate();
  const { rows: quotes } = useTable<Quotation>('quotations');
  const { rows: pros } = useTable<Proforma>('proformas');
  const inv = kind === 'invoice' ? fin.invoices.find((x) => x.id === id) : undefined;
  const q = kind === 'quotation' ? quotes.find((x) => x.id === id) : undefined;
  const pf = kind === 'proforma' ? pros.find((x) => x.id === id) : undefined;
  const pay = kind === 'receipt' ? fin.payments.find((x) => x.id === id) : undefined;
  const payInv = pay ? fin.invoices.find((x) => x.id === pay.invoice_id) : undefined;
  const doc = inv ?? q ?? pf ?? payInv;
  if (!doc) return <Empty title="Document not found" sub="It may still be loading." />;
  const client = fin.client(doc.client_id);
  const project = fin.project(doc.project_id);
  const t = docTotals(doc);
  const paid = inv ? invoicePaid(inv, fin.payments) : 0;
  const deposit = inv ? fin.payments.find((p) => p.invoice_id === inv.id && p.is_deposit) : undefined;
  const title = kind === 'invoice' ? 'TAX INVOICE' : kind === 'quotation' ? 'QUOTATION' : kind === 'proforma' ? 'PROFORMA INVOICE' : 'OFFICIAL RECEIPT';
  const number = kind === 'receipt' ? pay!.receipt_no : doc.number;
  const k = (l: string, v: string, sub?: string) => <div><div className="font-mono text-[9px] tracking-[0.16em] text-basil-muted">{l}</div><div className="font-bold">{v}</div>{sub && <div className="text-[11px] text-basil-muted">{sub}</div>}</div>;
  return (
    <div>
      <style>{PRINT_CSS}</style>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link to={kind === 'quotation' ? '/os/finance/quotations' : kind === 'proforma' ? '/os/finance/proformas' : '/os/finance/invoices'} onClick={(e) => { if (history.length > 1) { e.preventDefault(); nav(-1); } }} className="flex min-h-[44px] items-center text-sm font-bold">← Back</Link>
        <button type="button" onClick={() => print()} className="btn-primary min-h-[44px]"><Printer size={18} />Print or save as PDF</button>
      </div>
      <article className="print-area mx-auto max-w-[210mm] overflow-x-auto bg-white p-6 text-[12px] text-basil-ink shadow-card sm:p-10" style={{ minHeight: '297mm' }}>
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-4 border-basil pb-5">
          <div className="flex items-center gap-3">
            <img src="/brand/basil-media-logo.svg" alt="Basil Media" className="h-20 w-auto" onError={(e) => (e.currentTarget.style.display = 'none')} />
            <div><div className="text-basil-muted">{s.address || 'Mikocheni, Dar es Salaam, Tanzania'}</div><div className="text-basil-muted">{[s.phone, s.contact_email].filter(Boolean).join(' · ')}</div></div>
          </div>
          <div className="text-right"><div className="font-display text-xl font-extrabold tracking-wide text-basil-deep">{title}</div><div className="font-mono text-sm font-bold">{number}</div>
            {kind === 'invoice' && inv && <div className="mt-1"><Pill tone={statusTone(invoiceStatus(inv, fin.payments)) as never}>{STATUS_LABEL[invoiceStatus(inv, fin.payments)]}</Pill></div>}
            {pf && <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-amber-800">Not a tax invoice</div>}</div>
        </header>
        <section className="grid grid-cols-2 gap-5 py-5 sm:grid-cols-4">
          <div className="col-span-2">{k(kind === 'receipt' ? 'RECEIVED FROM' : 'BILL TO', client?.name ?? (q?.prospect || pf?.prospect || '—'))}<div className="text-basil-muted">{client?.address}</div>{client?.contact_name && <div className="text-basil-muted">Attn: {client.contact_name}</div>}{client?.tin && <div className="text-basil-muted">TIN {client.tin}</div>}</div>
          {k('PROJECT', doc.title || project?.name || '—', inv?.po_ref ? `Ref. ${inv.po_ref}` : undefined)}
          {kind === 'receipt' ? k('DATE RECEIVED', fmtDate(pay!.paid_on)) : k('ISSUE DATE', fmtDate(doc.issue_date))}
          {k('CURRENCY', 'TSH')}
          {kind === 'invoice' && inv && k('DUE DATE', fmtDate(inv.due_date), `${Math.max(0, Math.round((new Date(inv.due_date).getTime() - new Date(inv.issue_date).getTime()) / 864e5))} days net`)}
          {kind === 'quotation' && q && k('VALID UNTIL', fmtDate(q.valid_until))}
          {pf && k('VALID UNTIL', fmtDate(pf.valid_until), pf.quotation_id ? `Ref. ${quotes.find((x) => x.id === pf.quotation_id)?.number ?? 'quotation'}` : undefined)}
          {kind === 'receipt' && k('METHOD', `${pay!.method} · ${pay!.reference}`)}
        </section>
        {kind === 'receipt' ? (
          <section className="rounded-xl bg-basil-ice p-5">
            <div className="text-basil-muted">Amount received</div><div className="font-display text-3xl font-extrabold">{tsh(pay!.amount)}</div>
            <div className="mt-2">For invoice <b>{payInv!.number}</b> · {payInv!.title}{pay!.is_deposit ? ' (deposit)' : ''}</div>
            <div className="mt-1 text-basil-muted">Invoice total {tsh(t.total)} · paid to date {tsh(invoicePaid(payInv!, fin.payments))} · balance {tsh(Math.max(t.total - invoicePaid(payInv!, fin.payments), 0))}</div>
          </section>
        ) : (
          <>
            <table className="w-full border-collapse text-left">
              <thead><tr className="bg-basil-deep text-white"><th className="p-2">#</th><th className="p-2">DESCRIPTION</th><th className="p-2 text-right">QTY</th><th className="p-2 text-right">UNIT PRICE</th><th className="p-2 text-right">AMOUNT</th></tr></thead>
              <tbody>{doc.items.map((it, i) => <tr key={i} className="border-b border-basil-line align-top"><td className="p-2">{i + 1}</td><td className="p-2"><b>{it.title}</b>{it.detail && <div className="text-basil-muted">{it.detail}</div>}</td><td className="p-2 text-right">{it.qty}</td><td className="p-2 text-right">{tsh(it.unit_price)}</td><td className="p-2 text-right font-bold">{tsh(it.qty * it.unit_price)}</td></tr>)}</tbody>
            </table>
            <section className="mt-4 flex flex-wrap justify-between gap-6">
              <div className="min-w-[220px] flex-1">
                {inv && inv.schedule.length > 0 && (<><div className="mb-1 font-mono text-[9px] tracking-[0.16em] text-basil-muted">INSTALMENT SCHEDULE</div>
                  {(() => { let acc = 0; return inv.schedule.map((sc, i) => { const amt = Math.round((t.total * sc.pct) / 100); acc += amt; return <div key={i} className="flex justify-between gap-2 border-b border-basil-line py-1"><span>{sc.pct}% · {sc.label} · {fmtDate(sc.due)}</span><span>{tsh(amt)} {paid >= acc ? '· Paid' : ''}</span></div>; }); })()}</>)}
              </div>
              <div className="w-full max-w-[260px]">
                <div className="flex justify-between py-0.5"><span>Subtotal</span><span>{tsh(t.sub)}</span></div>
                {t.discount > 0 && <div className="flex justify-between py-0.5"><span>Discount</span><span>− {tsh(t.discount)}</span></div>}
                {doc.vat_on && <div className="flex justify-between py-0.5"><span>VAT {doc.vat_rate}%{pf ? ' (indicative)' : ''}</span><span>{tsh(t.vat)}</span></div>}
                <div className="flex justify-between border-t border-basil-line py-1 font-bold"><span>Total{doc.vat_on ? ' (VAT incl.)' : ''}</span><span>{tsh(t.total)}</span></div>
                {inv && paid > 0 && <div className="flex justify-between py-0.5"><span>{deposit ? `Paid incl. deposit ${fmtDate(deposit.paid_on)}` : 'Paid'}</span><span>− {tsh(paid)}</span></div>}
                {inv && <div className="mt-1 flex justify-between rounded-lg bg-basil p-2 font-display text-base font-extrabold text-white"><span>BALANCE DUE</span><span>{tsh(Math.max(t.total - paid, 0))}</span></div>}
                {pf && <div className="mt-1 flex justify-between rounded-lg bg-basil p-2 font-display text-base font-extrabold text-white"><span>AMOUNT PAYABLE</span><span>{tsh(t.total)}</span></div>}
              </div>
            </section>
          </>
        )}
        {kind !== 'receipt' && (
          <section className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-basil-line p-3"><div className="font-mono text-[9px] tracking-[0.16em] text-basil-muted">BANK TRANSFER</div><div>Bank: CRDB Bank</div><div>A/C name: Basil Media</div><div>Reference: {doc.number}</div></div>
            <div className="rounded-xl border border-basil-line p-3"><div className="font-mono text-[9px] tracking-[0.16em] text-basil-muted">MOBILE MONEY</div><div>M-Pesa Lipa · name shown BASIL MEDIA</div><div>Reference: {doc.number}</div></div>
          </section>
        )}
        <section className="mt-6 text-[11px] text-basil-muted">
          <div className="font-mono text-[9px] tracking-[0.16em]">TERMS</div>
          {pf && <p className="m-0 mb-2 rounded-lg border border-amber-300 bg-amber-50 p-2 font-bold text-amber-900">This is not a tax invoice. It is issued so the client can raise a purchase order or pay in advance; a tax invoice follows on confirmation or payment.</p>}
          {pf?.notes && <p className="m-0 mb-1">{pf.notes}</p>}
          {kind === 'quotation' ? <p className="m-0">Prices valid until {fmtDate(q?.valid_until)}. Two revision rounds included. A deposit confirms the booking.</p>
            : pf ? <p className="m-0">Prices valid until {fmtDate(pf.valid_until)}. {pf.terms || 'Quote the proforma number as the payment reference.'}</p>
            : <p className="m-0">Payment within the due date. Quote the {kind === 'receipt' ? 'invoice' : 'invoice'} number as the payment reference. Final masters are released once the delivery instalment is received. Two revision rounds are included.</p>}
        </section>
        <footer className="mt-10 flex flex-wrap items-end justify-between gap-4 border-t border-basil-line pt-4">
          <div><div className="font-display text-lg italic">Grace Mushi</div><div className="text-basil-muted">Finance Officer · for and on behalf of Basil Media</div></div>
          <div className="text-right text-basil-muted">Thank you for choosing Basil Media · Asante sana<div className="font-mono text-[10px]">{number} · Page 1 of 1</div></div>
        </footer>
      </article>
    </div>
  );
}

// ---------------------------------------------------------------- money in / out
export function MoneyInOut() {
  const fin = useFinance();
  const { userId } = useActing();
  const toast = useToast();
  const { rows: cats } = useTable<Category>('expense_categories', { order: 'sort_order' });
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const blank = { amount: '', date: today(), category: '', account_id: fin.accounts[0]?.id ?? '', project_id: '', description: '', payee: '', receipt_url: '', reference: '' };
  const [f, setF] = useState(blank);
  const [tab, setTab] = useState<'add' | 'list'>('add');
  const list = [...fin.expenses.map((e) => ({ ...e, k: 'expense' as const })), ...fin.income.map((i) => ({ ...i, k: 'income' as const, payee: '', receipt_url: '', petty_cash: false }))].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60);
  const save = async () => {
    try {
      const base = { amount: Number(f.amount), date: f.date, account_id: f.account_id || null, project_id: f.project_id || null, description: f.description, recorded_by: userId };
      if (kind === 'expense') await insertRow('expenses', { ...base, category: f.category || 'Office & petty cash', payee: f.payee, receipt_url: f.receipt_url, petty_cash: fin.accounts.find((a) => a.id === f.account_id)?.kind === 'cash', budget_line_id: f.project_id ? fin.lines.find((l) => l.project_id === f.project_id && l.line === f.category)?.id ?? null : null, request_id: null, payroll_run_id: null });
      else await insertRow('income', { ...base, category: f.category || 'Other income', reference: f.reference, client_id: null, invoice_id: null, payment_id: null });
      toast(kind === 'expense' ? 'Expense recorded' : 'Income recorded'); setF({ ...blank, account_id: f.account_id });
    } catch (e) { toast(errMsg(e), 'error'); }
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">{fin.balances.map((a) => <div key={a.id} className="rounded-2xl border border-basil-line bg-white p-3"><span className="block truncate text-[11px] text-basil-muted">{a.name}</span><b className="font-display text-sm">{tshShort(a.balance)}</b></div>)}</div>
      <Tabs value={tab} onChange={setTab} items={[{ value: 'add', label: 'Record' }, { value: 'list', label: 'Recent' }]} />
      {tab === 'add' ? (
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <div className="grid grid-cols-2 gap-2">{(['expense', 'income'] as const).map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`min-h-[48px] rounded-2xl font-bold ${kind === k ? (k === 'expense' ? 'border-0 bg-amber-500 text-white' : 'border-0 bg-emerald-600 text-white') : 'border border-basil-edge bg-white'}`}>{k === 'expense' ? 'Money out' : 'Money in'}</button>)}</div>
          <Field label="Amount (TSH)"><input className={`${inputCls} font-display text-xl font-extrabold`} inputMode="numeric" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d]/g, '') })} /></Field>
          <div className="grid grid-cols-2 gap-2"><Field label="Date"><input type="date" className={inputCls} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label={kind === 'expense' ? 'Paid from' : 'Into'}><select className={inputCls} value={f.account_id} onChange={(e) => setF({ ...f, account_id: e.target.value })}>{fin.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field></div>
          <Field label="Category">{kind === 'expense'
            ? <select className={inputCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">Choose…</option>{cats.filter((c) => c.active).map((c) => <option key={c.id}>{c.name}</option>)}</select>
            : <input className={inputCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Equipment rental, Training…" />}</Field>
          <Field label="Project (optional)"><select className={inputCls} value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}><option value="">— Overhead —</option>{fin.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Description"><input className={inputCls} required value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          {kind === 'expense' ? (<>
            <Field label="Paid to"><input className={inputCls} value={f.payee} onChange={(e) => setF({ ...f, payee: e.target.value })} /></Field>
            <Field label="Receipt photo link"><input type="url" className={inputCls} value={f.receipt_url} onChange={(e) => setF({ ...f, receipt_url: e.target.value })} placeholder="https://…" /></Field>
          </>) : <Field label="Reference"><input className={inputCls} value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>}
          <button type="submit" className="btn-primary min-h-[52px]">Save</button>
        </form>
      ) : (
        <Card>
          <ul className="m-0 flex list-none flex-col p-0">{list.map((x) => <li key={x.id} className="flex items-center justify-between gap-2 border-b border-basil-line py-2 text-sm"><span className="min-w-0"><b className="block truncate">{x.description}</b><span className="text-xs text-basil-muted">{fmtDate(x.date)} · {x.category}{x.k === 'expense' && x.petty_cash ? ' · petty cash' : ''}{x.k === 'expense' && x.receipt_url ? ' · receipt ✓' : ''}</span></span><b className={`shrink-0 ${x.k === 'income' ? 'text-emerald-700' : ''}`}>{x.k === 'income' ? '+' : '−'}{tshShort(Number(x.amount))}</b></li>)}</ul>
        </Card>
      )}
    </div>
  );
}
