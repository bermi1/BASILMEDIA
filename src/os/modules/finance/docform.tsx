// One phone-native form for every money document (quotation, proforma, invoice):
// big tap targets, line items as cards with a quantity stepper, a VAT switch and a sticky live total.
import { useEffect, useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { insertRow, updateRow, useTable } from '@/os/lib/store';
import { useToast } from '@/os/cms/toast';
import { Field, inputCls, tsh } from '@/os/ui';
import { PROFORMA_TERMS, addDays, docTotals, today, type Fin, type Instalment, type Invoice, type LineItem, type PriceItem, type Proforma, type Quotation } from './lib';
import { errMsg } from './components';

export type DocKind = 'invoice' | 'proforma' | 'quotation';
export const DOC_TABLE: Record<DocKind, string> = { invoice: 'invoices', proforma: 'proformas', quotation: 'quotations' };
export const DOC_LABEL: Record<DocKind, string> = { invoice: 'Invoice', proforma: 'Proforma', quotation: 'Quotation' };

type AnyDoc = Partial<Invoice> & Partial<Quotation> & Partial<Proforma>;
const digits = (v: string) => Number(v.replace(/[^\d]/g, '')) || 0;

export function DocForm({ kind, fin, existing, onDone }: { kind: DocKind; fin: Fin; existing?: Invoice | Quotation | Proforma; onDone: (id?: string) => void }) {
  const toast = useToast();
  const { rows: prices } = useTable<PriceItem>('price_items');
  const ex = existing as AnyDoc | undefined;
  const firstPct = ex?.schedule?.[0]?.pct;
  const [busy, setBusy] = useState(false);
  const [d, setD] = useState({
    client_id: (ex ? ex.client_id ?? null : fin.clients[0]?.id ?? null) as string | null,
    prospect: ex?.prospect ?? '',
    project_id: (ex?.project_id ?? null) as string | null,
    title: ex?.title ?? '',
    po_ref: ex?.po_ref ?? '',
    items: (ex?.items ? structuredClone(ex.items) : []) as LineItem[],
    discount: Number(ex?.discount ?? 0),
    vat_on: ex?.vat_on ?? true,
    vat_rate: Number(ex?.vat_rate ?? fin.settings.vat_rate),
    issue_date: ex?.issue_date ?? today(),
    due_date: ex?.due_date ?? addDays(today(), 14),
    valid_until: ex?.valid_until ?? addDays(today(), 30),
    deposit_pct: firstPct ?? 50,
    notes: ex?.notes ?? '',
    terms: ex?.terms ?? (kind === 'proforma' ? PROFORMA_TERMS : ''),
  });
  const [pctTouched, setPctTouched] = useState(false);
  useEffect(() => {
    if (!existing && !d.items.length && prices[0]) setD((x) => (x.items.length ? x : { ...x, items: [{ title: prices[0].name, detail: prices[0].detail, qty: 1, unit_price: Number(prices[0].unit_price) }] }));
  }, [prices.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const t = docTotals(d);
  const set = (patch: Partial<typeof d>) => setD((x) => ({ ...x, ...patch }));
  const setItem = (i: number, patch: Partial<LineItem>) => setD((x) => ({ ...x, items: x.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
  const allowProspect = kind !== 'invoice';
  const valid = d.items.length > 0 && d.items.every((i) => i.title.trim()) && d.title.trim() && (d.client_id || (allowProspect && d.prospect.trim()));

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const common = { client_id: d.client_id, project_id: d.project_id, title: d.title.trim(), items: d.items.map((i) => ({ ...i, title: i.title.trim(), qty: Number(i.qty), unit_price: Number(i.unit_price) })), discount: Number(d.discount), vat_on: d.vat_on, vat_rate: Number(d.vat_rate), issue_date: d.issue_date, notes: d.notes };
      let row: Record<string, unknown>;
      if (kind === 'invoice') {
        const keep = existing && !pctTouched && (ex?.schedule?.length ?? 0) > 0;
        const schedule: Instalment[] = keep ? ex!.schedule! : d.deposit_pct > 0 && d.deposit_pct < 100
          ? [{ label: 'Deposit', pct: d.deposit_pct, due: d.due_date }, { label: 'On delivery', pct: 100 - d.deposit_pct, due: addDays(d.due_date, 30) }]
          : [];
        row = { ...common, po_ref: d.po_ref, due_date: d.due_date, terms: d.terms, schedule, deposit: schedule[0] ? Math.round((t.total * schedule[0].pct) / 100) : 0 };
      } else if (kind === 'proforma') row = { ...common, prospect: d.client_id ? '' : d.prospect.trim(), valid_until: d.valid_until, terms: d.terms };
      else row = { ...common, prospect: d.client_id ? '' : d.prospect.trim(), valid_until: d.valid_until };
      let id = existing?.id;
      if (existing) await updateRow(DOC_TABLE[kind], existing.id, row);
      else {
        const made = await insertRow<{ id: string; number?: string }>(DOC_TABLE[kind], { ...row, status: 'draft' });
        id = made.id;
      }
      toast(existing ? `${DOC_LABEL[kind]} updated` : `${DOC_LABEL[kind]} saved as draft`);
      onDone(id);
    } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <Field label={kind === 'invoice' ? 'Bill to' : 'Client'}>
        <select className={inputCls} value={d.client_id ?? ''} onChange={(e) => set({ client_id: e.target.value || null, project_id: null })}>
          {allowProspect && <option value="">New prospect…</option>}
          {fin.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      {allowProspect && !d.client_id && <Field label="Prospect name"><input className={inputCls} value={d.prospect} onChange={(e) => set({ prospect: e.target.value })} placeholder="Company or person" required /></Field>}
      <Field label="Title"><input className={inputCls} value={d.title} onChange={(e) => set({ title: e.target.value })} required placeholder="e.g. Scholarship campaign film" /></Field>
      {d.client_id && fin.projects.some((p) => p.client_id === d.client_id) && (
        <Field label="Project (optional)"><select className={inputCls} value={d.project_id ?? ''} onChange={(e) => set({ project_id: e.target.value || null })}><option value="">—</option>{fin.projects.filter((p) => p.client_id === d.client_id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      )}

      <section className="flex flex-col gap-2" aria-label="Line items">
        <div className="flex items-baseline justify-between"><b className="text-sm text-[#33465F]">Line items</b><span className="text-xs text-basil-muted">{d.items.length} {d.items.length === 1 ? 'line' : 'lines'}</span></div>
        {d.items.map((it, i) => (
          <div key={i} className="rounded-2xl border border-basil-line bg-basil-mist/40 p-3">
            <div className="flex items-start gap-2">
              <input aria-label={`Line ${i + 1} description`} className={`${inputCls} h-11 min-w-0 flex-1`} value={it.title} placeholder="Description" onChange={(e) => setItem(i, { title: e.target.value })} />
              <button type="button" aria-label={`Remove line ${i + 1}`} onClick={() => set({ items: d.items.filter((_, j) => j !== i) })} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-0 bg-red-50 text-red-700"><Trash2 size={18} /></button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex h-11 shrink-0 items-center overflow-hidden rounded-xl border border-basil-edge bg-white">
                <button type="button" aria-label="Decrease quantity" onClick={() => setItem(i, { qty: Math.max(1, Number(it.qty) - 1) })} className="flex h-11 w-10 items-center justify-center border-0 bg-transparent text-basil-deep"><Minus size={16} /></button>
                <input aria-label={`Line ${i + 1} quantity`} inputMode="decimal" className="h-11 w-10 border-0 bg-transparent p-0 text-center text-[15px] font-bold outline-none" value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 })} />
                <button type="button" aria-label="Increase quantity" onClick={() => setItem(i, { qty: Number(it.qty) + 1 })} className="flex h-11 w-10 items-center justify-center border-0 bg-transparent text-basil-deep"><Plus size={16} /></button>
              </div>
              <span className="text-sm text-basil-muted">×</span>
              <label className="relative min-w-0 flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-basil-muted">TSH</span>
                <input aria-label={`Line ${i + 1} unit price`} inputMode="numeric" className={`${inputCls} h-11 pl-11 text-right`} value={it.unit_price ? Number(it.unit_price).toLocaleString('en-GB') : ''} placeholder="0" onChange={(e) => setItem(i, { unit_price: digits(e.target.value) })} />
              </label>
            </div>
            <div className="mt-1.5 text-right text-sm"><span className="text-basil-muted">Line total </span><b>{tsh(Number(it.qty) * Number(it.unit_price))}</b></div>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-outline min-h-[44px] justify-center" onClick={() => set({ items: [...d.items, { title: '', detail: '', qty: 1, unit_price: 0 }] })}><Plus size={16} />Add line</button>
          <select aria-label="Add from price list" className={`${inputCls} h-11 text-sm font-semibold text-basil-deep`} value="" onChange={(e) => { const p = prices.find((x) => x.id === e.target.value); if (p) set({ items: [...d.items, { title: p.name, detail: p.detail, qty: 1, unit_price: Number(p.unit_price) }] }); }}>
            <option value="">Price list…</option>{prices.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name} · {tsh(p.unit_price)}/{p.unit}</option>)}
          </select>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Discount (TSH)"><input className={inputCls} inputMode="numeric" value={d.discount ? d.discount.toLocaleString('en-GB') : ''} placeholder="0" onChange={(e) => set({ discount: digits(e.target.value) })} /></Field>
        <div className="flex flex-col gap-1.5 text-sm font-bold text-[#33465F]">VAT
          <button type="button" role="switch" aria-checked={d.vat_on} aria-label={`VAT ${d.vat_rate}%`} onClick={() => set({ vat_on: !d.vat_on })} className={`flex h-12 items-center justify-between rounded-xl border px-3 text-[15px] font-semibold ${d.vat_on ? 'border-basil bg-basil-ice text-basil-deep' : 'border-basil-edge bg-white text-basil-muted'}`}>
            {d.vat_on ? `${d.vat_rate}% on` : 'No VAT'}
            <span className={`relative h-6 w-10 rounded-full transition ${d.vat_on ? 'bg-basil' : 'bg-basil-line'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${d.vat_on ? 'left-[18px]' : 'left-0.5'}`} /></span>
          </button>
        </div>
      </div>

      {kind === 'invoice' ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Issue date"><input type="date" className={inputCls} value={d.issue_date} onChange={(e) => set({ issue_date: e.target.value })} /></Field>
            <Field label="Due date"><input type="date" className={inputCls} value={d.due_date} onChange={(e) => set({ due_date: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Deposit %" hint={existing && !pctTouched && (ex?.schedule?.length ?? 0) > 2 ? 'Keeps the existing schedule' : d.deposit_pct ? `${tsh(Math.round((t.total * d.deposit_pct) / 100))} up front` : 'Pay in full'}>
              <input className={inputCls} inputMode="numeric" value={d.deposit_pct} onChange={(e) => { setPctTouched(true); set({ deposit_pct: Math.min(100, digits(e.target.value)) }); }} />
            </Field>
            <Field label="Client PO ref"><input className={inputCls} value={d.po_ref} onChange={(e) => set({ po_ref: e.target.value })} /></Field>
          </div>
        </>
      ) : (
        <Field label="Valid until"><input type="date" className={inputCls} value={d.valid_until} onChange={(e) => set({ valid_until: e.target.value })} /></Field>
      )}
      {kind !== 'quotation' && <Field label="Payment terms"><textarea className={`${inputCls} h-auto min-h-[72px] py-2`} value={d.terms} onChange={(e) => set({ terms: e.target.value })} /></Field>}
      <Field label="Notes (optional)"><textarea className={`${inputCls} h-auto min-h-[64px] py-2`} value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Shown on the printed document" /></Field>

      <div className="sticky bottom-[-20px] z-10 -mx-5 -mb-5 mt-1 border-t border-basil-line bg-white/95 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mb-2 flex items-end justify-between gap-2 text-sm">
          <span className="text-basil-muted">Subtotal {tsh(t.sub)}{t.discount > 0 && ` − ${tsh(t.discount)}`}{d.vat_on && ` + VAT ${tsh(t.vat)}`}</span>
          <b className="shrink-0 font-display text-xl" aria-live="polite" data-testid="doc-total">{tsh(t.total)}</b>
        </div>
        <button type="submit" disabled={!valid || busy} className="btn-primary min-h-[50px] w-full justify-center disabled:opacity-50">{existing ? 'Save changes' : `Save ${DOC_LABEL[kind].toLowerCase()} draft`}</button>
      </div>
    </form>
  );
}
