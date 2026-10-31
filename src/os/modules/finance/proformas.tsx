// Proforma invoices: quotation → proforma → tax invoice. List (search + status chips), detail with
// the right actions for the stage, WhatsApp/copy sharing and the printable A4 (see PrintDoc in docs.tsx).
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarPlus, CheckCircle2, Copy, FilePlus2, FileText, MessageCircle, Plus, Printer, Search, Send, XCircle } from 'lucide-react';
import { useActing } from '@/os/lib/session';
import { nowIso, updateRow, useTable } from '@/os/lib/store';
import { useToast } from '@/os/cms/toast';
import { Empty, Pill, Sheet, StageTracker, Tabs, tsh, tshShort } from '@/os/ui';
import { MONEY_DOC_ROLES, addDays, convertProformaToInvoice, docTotals, fmtDate, fmtShort, proformaStatus, today, useFinance, type Fin, type LineItem, type Proforma, type ProStatus } from './lib';
import { StatusPill, errMsg } from './components';
import { DocForm } from './docform';

// ---------------------------------------------------------------- tracker
export const PF_STAGES = ['Draft', 'Sent', 'Accepted', 'Invoiced'];
export function proformaTracker(p: Proforma) {
  const st = proformaStatus(p);
  const idx = p.invoice_id ? 4 : { draft: 0, sent: 1, accepted: 3, expired: p.sent_at ? 1 : 0, cancelled: p.sent_at ? 1 : 0 }[st];
  const meta = [fmtShort(p.created_at), p.sent_at ? fmtShort(p.sent_at) : undefined, p.accepted_at ? fmtShort(p.accepted_at) : undefined, p.invoice_id ? 'Converted' : undefined];
  if (st === 'expired') meta[idx] = `Expired ${fmtDate(p.valid_until)}`;
  if (st === 'cancelled') meta[idx] = 'Cancelled';
  return { stages: PF_STAGES, current: idx, meta, rejected: st === 'expired' || st === 'cancelled' };
}

// ---------------------------------------------------------------- sharing (WhatsApp + copy)
export function docShareText(kind: string, d: { number: string; title: string; items: LineItem[]; discount: number; vat_on: boolean; vat_rate: number }, who: string, extra: string) {
  const t = docTotals(d);
  return [
    `Habari ${who},`,
    '',
    `Please find our ${kind} *${d.number}* for *${d.title}*.`,
    ...d.items.map((i) => `• ${i.title} × ${i.qty} — ${tsh(i.qty * i.unit_price)}`),
    `Total${d.vat_on ? ` (incl. VAT ${d.vat_rate}%)` : ''}: *${tsh(t.total)}*`,
    extra,
    'Bank: CRDB Bank · A/C name Basil Media · M-Pesa Lipa: BASIL MEDIA',
    `Reference: ${d.number}`,
    '',
    'Asante sana · Basil Media',
  ].filter((x) => x !== undefined).join('\n');
}
export const waHref = (text: string, phone?: string) => `https://wa.me/${(phone ?? '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

// ---------------------------------------------------------------- detail
export function ProformaDetail({ id, fin, onEdit, onInvoice }: { id: string; fin: Fin; onEdit: (p: Proforma) => void; onInvoice?: (invoiceId: string) => void }) {
  const { role, userId } = useActing();
  const toast = useToast();
  const { rows } = useTable<Proforma>('proformas');
  const p = rows.find((x) => x.id === id);
  const [busy, setBusy] = useState(false);
  if (!p) return null;
  const st = proformaStatus(p);
  const client = fin.client(p.client_id);
  const who = client?.contact_name?.split(' ')[0] || client?.name || p.prospect || 'there';
  const inv = p.invoice_id ? fin.invoices.find((x) => x.id === p.invoice_id) : undefined;
  const t = docTotals(p);
  const canConvert = MONEY_DOC_ROLES.includes(role);
  const share = docShareText('proforma invoice', p, who, `Valid until ${fmtDate(p.valid_until)}. This is a proforma, not a tax invoice; the tax invoice follows on confirmation.`);
  const set = async (patch: Partial<Proforma>, msg: string) => { try { await updateRow('proformas', p.id, patch); toast(msg); } catch (e) { toast(errMsg(e), 'error'); } };
  const toInvoice = async () => {
    setBusy(true);
    try { const iid = await convertProformaToInvoice(p.id, { role, userId }); toast('Tax invoice created as draft'); onInvoice?.(iid); } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };
  const btn = 'min-h-[44px] justify-center';
  return (
    <div className="flex flex-col gap-4" data-testid="proforma-detail">
      <div>
        <span className="text-sm text-basil-muted">{p.number} · {client?.name ?? p.prospect}</span>
        <b className="block font-display text-2xl">{tsh(t.total)}</b>
        <span className="text-sm">{p.title}</span>
        <div className="mt-1 flex flex-wrap items-center gap-1"><StatusPill status={st} />{inv && <Pill tone="green">Invoiced · {inv.number}</Pill>}<span className="text-xs text-basil-muted">Valid until {fmtDate(p.valid_until)}</span></div>
      </div>
      <StageTracker {...proformaTracker(p)} />
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">{p.items.map((i, k) => <li key={k} className="flex justify-between gap-2"><span>{i.title} <span className="text-basil-muted">× {i.qty}</span></span><span className="shrink-0">{tsh(i.qty * i.unit_price)}</span></li>)}</ul>
      <div className="flex flex-col gap-1 rounded-xl bg-basil-mist p-3 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span>{tsh(t.sub)}</span></div>
        {t.discount > 0 && <div className="flex justify-between"><span>Discount</span><span>− {tsh(t.discount)}</span></div>}
        {p.vat_on && <div className="flex justify-between"><span>VAT {p.vat_rate}%</span><span>{tsh(t.vat)}</span></div>}
        <div className="flex justify-between border-t border-basil-line pt-1.5 font-extrabold"><span>Total</span><span>{tsh(t.total)}</span></div>
      </div>
      {(p.notes || p.terms) && <div className="text-sm text-basil-muted">{p.notes && <p className="m-0">{p.notes}</p>}{p.terms && <p className="m-0 mt-1"><b className="text-basil-ink">Terms:</b> {p.terms}</p>}</div>}

      {canConvert && ['sent', 'accepted'].includes(st) && !p.invoice_id && (
        <>
          <button type="button" disabled={busy || !p.client_id} className={`btn-primary ${btn} min-h-[52px] !bg-emerald-600 disabled:opacity-50`} onClick={toInvoice}><FilePlus2 size={18} />Convert to tax invoice</button>
          {!p.client_id && <p className="-mt-2 m-0 text-xs text-amber-800">{p.prospect || 'This prospect'} is not a client yet. Add them under Clients, then edit the proforma to pick them before invoicing.</p>}
        </>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Link to={`/os/finance/print/proforma/${p.id}`} className={`btn-outline ${btn}`}><Printer size={16} />Print / PDF</Link>
        <a href={waHref(share, client?.phone)} target="_blank" rel="noreferrer" className={`btn-outline ${btn} !text-emerald-700`} onClick={() => st === 'draft' && void set({ status: 'sent', sent_at: nowIso() }, 'Shared on WhatsApp · marked sent')}><MessageCircle size={16} />WhatsApp</a>
        <button type="button" className={`btn-outline ${btn}`} onClick={async () => (await copyText(share)) ? toast('Copied · paste it into an email or chat') : toast('Could not copy on this device', 'error')}><Copy size={16} />Copy text</button>
        {st === 'draft' && <button type="button" className={`btn-outline ${btn}`} onClick={() => onEdit(p)}>Edit</button>}
        {st === 'draft' && <button type="button" className={`btn-primary ${btn} col-span-2`} onClick={() => set({ status: 'sent', sent_at: nowIso() }, 'Marked as sent')}><Send size={16} />Mark sent</button>}
        {st === 'sent' && <button type="button" className={`btn-primary ${btn}`} onClick={() => set({ status: 'accepted', accepted_at: nowIso() }, 'Client accepted the proforma')}><CheckCircle2 size={16} />Mark accepted</button>}
        {st === 'expired' && !p.invoice_id && <button type="button" className={`btn-outline ${btn}`} onClick={() => set({ valid_until: addDays(today(), 30), status: p.sent_at ? 'sent' : 'draft' }, 'Validity extended by 30 days')}><CalendarPlus size={16} />Extend 30 days</button>}
        {!p.invoice_id && !['cancelled'].includes(st) && <button type="button" className={`btn-outline ${btn} !text-red-700`} onClick={() => confirm('Cancel this proforma?') && set({ status: 'cancelled', cancelled_at: nowIso() }, 'Proforma cancelled')}><XCircle size={16} />Cancel</button>}
        {inv && onInvoice && <button type="button" className={`btn-outline ${btn}`} onClick={() => onInvoice(inv.id)}><FileText size={16} />Open {inv.number}</button>}
      </div>
      {!canConvert && ['sent', 'accepted'].includes(st) && !p.invoice_id && <p className="m-0 text-xs text-basil-muted">The GM/CFO or Finance converts proformas into tax invoices.</p>}
    </div>
  );
}

// ---------------------------------------------------------------- list (desktop page; also fine on phone)
type Filter = 'all' | 'open' | ProStatus | 'invoiced';
export function useProformaRows(fin: Fin) {
  const { rows } = useTable<Proforma>('proformas', { order: 'created_at', ascending: false });
  return useMemo(() => rows.map((p) => ({ p, st: proformaStatus(p), total: docTotals(p).total, who: fin.client(p.client_id)?.name ?? p.prospect })), [rows, fin]);
}
export const matchFilter = (r: { p: Proforma; st: ProStatus }, f: Filter) =>
  f === 'all' ? true : f === 'open' ? ['draft', 'sent', 'accepted'].includes(r.st) && !r.p.invoice_id : f === 'invoiced' ? !!r.p.invoice_id : r.st === f && !r.p.invoice_id;

export function ProformaRow({ r, onOpen }: { r: { p: Proforma; st: ProStatus; total: number; who: string }; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-basil-line bg-white p-3 text-left">
      <span className="min-w-0 flex-1"><b className="block truncate">{r.who || 'Client'}</b><span className="block truncate text-xs text-basil-muted">{r.p.number} · {r.p.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1">{r.p.invoice_id ? <Pill tone="green">Invoiced</Pill> : <StatusPill status={r.st} />}<span className="text-xs text-basil-muted">Valid to {fmtDate(r.p.valid_until)}</span></span></span>
      <b className="shrink-0 font-display">{tshShort(r.total)}</b>
    </button>
  );
}

export function ProformasList() {
  const fin = useFinance();
  const rows = useProformaRows(fin);
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const [f, setF] = useState<Filter>('open');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(params.get('open'));
  const [edit, setEdit] = useState<Proforma | 'new' | null>(null);
  useEffect(() => { const o = params.get('open'); if (o) { setOpen(o); setParams((p) => (p.delete('open'), p), { replace: true }); } }, [params, setParams]);
  const needle = q.trim().toLowerCase();
  const shown = rows.filter((r) => matchFilter(r, f) && (!needle || `${r.p.number} ${r.p.title} ${r.who}`.toLowerCase().includes(needle)));
  const count = (x: Filter) => rows.filter((r) => matchFilter(r, x)).length;
  const awaiting = rows.filter((r) => r.st === 'sent' && !r.p.invoice_id);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="m-0 text-xl font-extrabold">Proforma invoices</h2><p className="m-0 text-sm text-basil-muted">{awaiting.length} awaiting client · {tshShort(awaiting.reduce((s, r) => s + r.total, 0))} in play</p></div>
        <button type="button" onClick={() => setEdit('new')} className="btn-primary min-h-[44px]"><Plus size={18} />New proforma</button>
      </div>
      <label className="relative block"><Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-basil-muted" /><input type="search" aria-label="Search proformas" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client, number or title" className="h-11 w-full rounded-xl border border-basil-edge bg-white pl-10 pr-3 text-[15px] outline-none focus:border-basil" /></label>
      <Tabs value={f} onChange={setF} items={[{ value: 'open', label: 'Open', count: count('open') }, { value: 'draft', label: 'Drafts', count: count('draft') }, { value: 'sent', label: 'Sent', count: count('sent') }, { value: 'accepted', label: 'Accepted', count: count('accepted') }, { value: 'invoiced', label: 'Invoiced', count: count('invoiced') }, { value: 'expired', label: 'Expired', count: count('expired') }, { value: 'cancelled', label: 'Cancelled', count: count('cancelled') }, { value: 'all', label: 'All', count: rows.length }]} />
      {!shown.length && <Empty icon={<FileText />} title={needle ? 'No proformas match' : 'No proformas here'} sub="Raise one from scratch or convert a sent quotation." />}
      {shown.map((r) => <ProformaRow key={r.p.id} r={r} onOpen={() => setOpen(r.p.id)} />)}
      <Sheet open={!!open} onClose={() => setOpen(null)} title="Proforma invoice">{open && <ProformaDetail id={open} fin={fin} onEdit={(p) => { setOpen(null); setEdit(p); }} onInvoice={(iid) => { setOpen(null); nav(`/os/finance/invoices?open=${iid}`); }} />}</Sheet>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'New proforma' : 'Edit proforma'}>{edit && <DocForm kind="proforma" fin={fin} existing={edit === 'new' ? undefined : edit} onDone={(id) => { setEdit(null); if (id) setOpen(id); }} />}</Sheet>
    </div>
  );
}
