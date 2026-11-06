// Phone "Money" screen for the GM/CFO (and Finance): every money document in one place.
// Sticky segmented control (Invoices · Proformas · Quotations), search + status chips, a floating
// "+ New" button that opens a bottom-sheet form, and detail sheets with send / print / convert.
import { useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Copy, FileBadge2, FileSpreadsheet, FileText, MessageCircle, Plus, Search } from 'lucide-react';
import { useTable } from '@/os/lib/store';
import { useToast } from '@/os/cms/toast';
import { Empty, Pill, Sheet, tshShort } from '@/os/ui';
import { docTotals, fmtDate, quotationStatus, useFinance, type Fin, type Invoice, type Proforma, type Quotation } from './lib';
import { InvoiceDetail, QuotationDetail } from './docs';
import { ProformaDetail, ProformaRow, copyText, docShareText, matchFilter, useProformaRows, waHref } from './proformas';
import { DOC_LABEL, DocForm, type DocKind } from './docform';
import { StatusPill } from './components';

type Seg = 'invoices' | 'proformas' | 'quotations';
const KIND_SEG: Record<DocKind, Seg> = { invoice: 'invoices', proforma: 'proformas', quotation: 'quotations' };
const SEGS: { key: Seg; label: string }[] = [{ key: 'invoices', label: 'Invoices' }, { key: 'proformas', label: 'Proformas' }, { key: 'quotations', label: 'Quotations' }];

function Chips<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[] }) {
  return (
    <div role="tablist" aria-label="Filter" className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4">
      {items.map((i) => (
        <button key={i.value} role="tab" type="button" aria-selected={value === i.value} onClick={() => onChange(i.value)} className={`min-h-[44px] shrink-0 rounded-full px-4 text-sm font-semibold ${value === i.value ? 'border-0 bg-basil-deep text-white' : 'border border-basil-edge bg-white text-basil-deep'}`}>
          {i.label}{i.count !== undefined && <span className="ml-1 opacity-70">{i.count}</span>}
        </button>
      ))}
    </div>
  );
}

function Summary({ items }: { items: { label: string; value: string; tone?: 'red' | 'amber' }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((x) => <div key={x.label} className="rounded-2xl bg-white p-3 shadow-[0_1px_0_rgba(10,47,92,0.05)]"><span className="block text-xs text-basil-muted">{x.label}</span><b className={`font-display text-lg ${x.tone === 'red' ? 'text-red-700' : x.tone === 'amber' ? 'text-amber-700' : ''}`}>{x.value}</b></div>)}
    </div>
  );
}

function ShareRow({ text, phone }: { text: string; phone?: string }) {
  const toast = useToast();
  return (
    <div className="grid grid-cols-2 gap-2 border-t border-basil-line pt-3">
      <a href={waHref(text, phone)} target="_blank" rel="noreferrer" className="btn-outline min-h-[44px] justify-center !text-emerald-700"><MessageCircle size={16} />WhatsApp</a>
      <button type="button" className="btn-outline min-h-[44px] justify-center" onClick={async () => ((await copyText(text)) ? toast('Copied · paste it into an email or chat') : toast('Could not copy on this device', 'error'))}><Copy size={16} />Copy text</button>
    </div>
  );
}

export function MoneyDocs() {
  const fin = useFinance();
  const [params, setParams] = useSearchParams();
  const seg: Seg = (['invoices', 'proformas', 'quotations'] as Seg[]).find((s) => s === params.get('doc')) ?? 'invoices';
  const setSeg = (s: Seg) => setParams((p) => (p.set('doc', s), p), { replace: true });
  const [q, setQ] = useState('');
  const [invF, setInvF] = useState('open');
  const [proF, setProF] = useState<'open' | 'draft' | 'sent' | 'accepted' | 'invoiced' | 'expired' | 'all'>('open');
  const [quoF, setQuoF] = useState('open');
  const [picker, setPicker] = useState(false);
  const [form, setForm] = useState<{ kind: DocKind; existing?: Invoice | Quotation | Proforma } | null>(null);
  const [open, setOpen] = useState<{ kind: DocKind; id: string } | null>(null);
  const { rows: quotes } = useTable<Quotation>('quotations', { order: 'issue_date', ascending: false });
  const pros = useProformaRows(fin);
  const needle = q.trim().toLowerCase();
  const hit = (...xs: (string | null | undefined)[]) => !needle || xs.join(' ').toLowerCase().includes(needle);
  const show = (kind: DocKind, id: string) => { setSeg(KIND_SEG[kind]); setOpen({ kind, id }); };

  // ---- invoices
  const invMatch = (r: Fin['invRows'][number], f: string) => (f === 'open' ? !['paid', 'cancelled', 'draft'].includes(r.status) : f === 'all' ? true : r.status === f);
  const invRows = fin.invRows.filter((r) => invMatch(r, invF) && hit(r.inv.number, r.inv.title, fin.client(r.inv.client_id)?.name));
  // ---- quotations
  const quoRows = useMemo(() => quotes.map((x) => ({ q: x, st: quotationStatus(x), total: docTotals(x).total, who: fin.client(x.client_id)?.name ?? x.prospect })), [quotes, fin]);
  const quoMatch = (r: (typeof quoRows)[number], f: string) => (f === 'open' ? ['draft', 'sent', 'viewed'].includes(r.st) : f === 'won' ? r.st === 'accepted' : f === 'lost' ? ['declined', 'expired'].includes(r.st) : true);
  const quoShown = quoRows.filter((r) => quoMatch(r, quoF) && hit(r.q.number, r.q.title, r.who));
  const proShown = pros.filter((r) => matchFilter(r, proF) && hit(r.p.number, r.p.title, r.who));
  const proAwait = pros.filter((r) => r.st === 'sent' && !r.p.invoice_id);
  const readyPf = pros.filter((r) => r.st === 'accepted' && !r.p.invoice_id).length;
  const quoAwait =quoRows.filter((r) => ['sent', 'viewed'].includes(r.st));

  const openInv = open?.kind === 'invoice' ? fin.invoices.find((x) => x.id === open.id) : undefined;
  const openQuo = open?.kind === 'quotation' ? quotes.find((x) => x.id === open.id) : undefined;
  const shareFor = (d: Invoice | Quotation, kind: 'invoice' | 'quotation') => {
    const c = fin.client(d.client_id);
    const who = c?.contact_name?.split(' ')[0] || c?.name || (d as Quotation).prospect || 'there';
    return { phone: c?.phone, text: docShareText(kind === 'invoice' ? 'invoice' : 'quotation', d, who, kind === 'invoice' ? `Due by ${fmtDate((d as Invoice).due_date)}.` : `Valid until ${fmtDate((d as Quotation).valid_until)}.`) };
  };

  let pane: ReactNode;
  if (seg === 'invoices') pane = (
    <>
      <Summary items={[{ label: 'Owed to us', value: tshShort(fin.outstanding) }, { label: `Overdue · ${fin.overdueRows.length}`, value: tshShort(fin.overdue), tone: 'red' }]} />
      <Chips value={invF} onChange={setInvF} items={[{ value: 'open', label: 'Open' }, { value: 'overdue', label: 'Overdue', count: fin.overdueRows.length }, { value: 'draft', label: 'Drafts' }, { value: 'paid', label: 'Paid' }, { value: 'all', label: 'All' }]} />
      {!invRows.length && <Empty icon={<FileText />} title={needle ? 'No invoices match' : 'No invoices here'} />}
      {invRows.map((r) => (
        <button key={r.inv.id} type="button" onClick={() => setOpen({ kind: 'invoice', id: r.inv.id })} className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-basil-line bg-white p-3 text-left">
          <span className="min-w-0 flex-1"><b className="block truncate">{fin.client(r.inv.client_id)?.name ?? 'Client'}</b><span className="block truncate text-xs text-basil-muted">{r.inv.number} · {r.inv.title}</span>
            <span className="mt-1 flex flex-wrap items-center gap-1"><StatusPill status={r.status} />{r.status === 'overdue' ? <Pill tone="red">{r.daysOverdue}d late</Pill> : <span className="text-xs text-basil-muted">Due {fmtDate(r.inv.due_date)}</span>}</span></span>
          <span className="shrink-0 text-right"><b className="block font-display">{tshShort(r.balance || r.total)}</b><span className="text-[11px] text-basil-muted">{r.paid ? 'balance' : 'total'}</span></span>
        </button>
      ))}
    </>
  );
  else if (seg === 'proformas') pane = (
    <>
      <Summary items={[{ label: `Awaiting client · ${proAwait.length}`, value: tshShort(proAwait.reduce((s, r) => s + r.total, 0)) }, { label: 'Ready to invoice', value: String(readyPf), tone: readyPf ? 'amber' : undefined }]} />
      <Chips value={proF} onChange={setProF} items={[{ value: 'open', label: 'Open' }, { value: 'draft', label: 'Drafts' }, { value: 'sent', label: 'Sent' }, { value: 'accepted', label: 'Accepted' }, { value: 'invoiced', label: 'Invoiced' }, { value: 'expired', label: 'Expired' }, { value: 'all', label: 'All' }]} />
      {!proShown.length && <Empty icon={<FileBadge2 />} title={needle ? 'No proformas match' : 'No proformas here'} sub="Tap + New, or convert a sent quotation." />}
      {proShown.map((r) => <ProformaRow key={r.p.id} r={r} onOpen={() => setOpen({ kind: 'proforma', id: r.p.id })} />)}
    </>
  );
  else pane = (
    <>
      <Summary items={[{ label: `Awaiting client · ${quoAwait.length}`, value: tshShort(quoAwait.reduce((s, r) => s + r.total, 0)) }, { label: 'Accepted', value: String(quoRows.filter((r) => r.st === 'accepted').length) }]} />
      <Chips value={quoF} onChange={setQuoF} items={[{ value: 'open', label: 'Open' }, { value: 'won', label: 'Accepted' }, { value: 'lost', label: 'Declined / expired' }, { value: 'all', label: 'All' }]} />
      {!quoShown.length && <Empty icon={<FileSpreadsheet />} title={needle ? 'No quotations match' : 'No quotations here'} />}
      {quoShown.map((r) => (
        <button key={r.q.id} type="button" onClick={() => setOpen({ kind: 'quotation', id: r.q.id })} className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-basil-line bg-white p-3 text-left">
          <span className="min-w-0 flex-1"><b className="block truncate">{r.who}</b><span className="block truncate text-xs text-basil-muted">{r.q.number} · {r.q.title}</span>
            <span className="mt-1 flex flex-wrap items-center gap-1"><StatusPill status={r.st} />{r.q.invoice_id && <Pill tone="green">Invoiced</Pill>}{pros.some((p) => p.p.quotation_id === r.q.id && p.st !== 'cancelled') && !r.q.invoice_id && <Pill tone="blue">Proforma</Pill>}</span></span>
          <b className="shrink-0 font-display">{tshShort(r.total)}</b>
        </button>
      ))}
    </>
  );

  return (
    <div className="flex flex-col gap-3" data-testid="money-docs">
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 -mt-4 flex flex-col gap-2 bg-[#F1F5FB]/95 px-4 pb-2 pt-3 backdrop-blur">
        <div role="tablist" aria-label="Document type" className="grid grid-cols-3 rounded-2xl bg-[#DFE7F2] p-1">
          {SEGS.map((s) => {
            const on = s.key === seg;
            return (
              <button key={s.key} role="tab" type="button" aria-selected={on} onClick={() => { setSeg(s.key); setQ(''); }} className="relative h-11 rounded-xl border-0 bg-transparent text-[14px] font-bold">
                {on && <motion.span layoutId="money-seg" className="absolute inset-0 rounded-xl bg-white shadow-[0_2px_8px_rgba(10,47,92,0.14)]" transition={{ type: 'spring', stiffness: 460, damping: 36 }} />}
                <span className={`relative ${on ? 'text-basil-deep' : 'text-[#4A5D78]'}`}>{s.label}</span>
              </button>
            );
          })}
        </div>
        <label className="relative block"><Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-basil-muted" />
          <input type="search" aria-label={`Search ${seg}`} value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${seg}`} className="h-11 w-full rounded-xl border border-basil-edge bg-white pl-10 pr-3 text-[15px] outline-none focus:border-basil" />
        </label>
      </div>
      {pane}

      {createPortal(
        <button type="button" onClick={() => setPicker(true)} aria-label="New document" className="fixed bottom-[calc(96px+env(safe-area-inset-bottom))] right-[max(16px,calc(50vw-17rem))] z-[45] flex h-14 items-center gap-2 rounded-full border-0 bg-basil px-5 font-display text-[16px] font-extrabold text-white shadow-[0_12px_28px_rgba(15,110,194,0.45)]">
          <Plus size={22} strokeWidth={2.6} />New
        </button>,
        document.body,
      )}

      <Sheet open={picker} onClose={() => setPicker(false)} title="New document">
        <div className="flex flex-col gap-2">
          {([
            ['quotation', FileSpreadsheet, 'Price a job for a client or a new prospect'],
            ['proforma', FileBadge2, 'For a purchase order or advance · not a tax invoice'],
            ['invoice', FileText, `Tax invoice with VAT ${fin.settings.vat_rate}% and a deposit schedule`],
          ] as const).map(([k, Icon, sub]) => (
            <button key={k} type="button" onClick={() => { setPicker(false); setSeg(KIND_SEG[k]); setForm({ kind: k }); }} className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-basil-line bg-white p-3 text-left">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-basil-ice text-basil"><Icon size={22} /></span>
              <span className="min-w-0 flex-1"><b className="block">{k === 'invoice' ? 'Tax invoice' : k === 'proforma' ? 'Proforma invoice' : 'Quotation'}</b><span className="block text-[13px] leading-snug text-basil-muted">{sub}</span></span>
              <ChevronRight size={18} className="text-basil-muted" />
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={!!form} onClose={() => setForm(null)} title={form ? `${form.existing ? 'Edit' : 'New'} ${form.kind === 'invoice' ? 'tax invoice' : DOC_LABEL[form.kind].toLowerCase()}` : ''}>
        {form && <DocForm kind={form.kind} fin={fin} existing={form.existing} onDone={(id) => { const k = form.kind; setForm(null); if (id) show(k, id); }} />}
      </Sheet>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? (open.kind === 'invoice' ? 'Invoice' : open.kind === 'proforma' ? 'Proforma invoice' : 'Quotation') : ''}>
        {open?.kind === 'invoice' && openInv && (
          <div className="flex flex-col gap-3">
            <InvoiceDetail id={open.id} fin={fin} onEdit={(i) => { setOpen(null); setForm({ kind: 'invoice', existing: i }); }} />
            <ShareRow {...shareFor(openInv, 'invoice')} />
          </div>
        )}
        {open?.kind === 'quotation' && openQuo && (
          <div className="flex flex-col gap-3">
            <QuotationDetail q={openQuo} fin={fin} onEdit={(x) => { setOpen(null); setForm({ kind: 'quotation', existing: x }); }} onClose={() => setOpen(null)} onProforma={(id) => show('proforma', id)} />
            <ShareRow {...shareFor(openQuo, 'quotation')} />
          </div>
        )}
        {open?.kind === 'proforma' && <ProformaDetail id={open.id} fin={fin} onEdit={(p) => { setOpen(null); setForm({ kind: 'proforma', existing: p }); }} onInvoice={(iid) => show('invoice', iid)} />}
      </Sheet>
    </div>
  );
}
