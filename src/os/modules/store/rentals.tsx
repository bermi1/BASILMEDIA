// Outside rentals: renter, items, dates, deposit, day/week pricing, late fees, return inspection, agreement.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileText, HandCoins, Plus, Printer, Undo2 } from 'lucide-react';
import { insertRow, nowIso, updateRow, useTable } from '@/os/lib/store';
import { notifyRole } from '@/os/lib/notify';
import { useActing } from '@/os/lib/session';
import { useToast } from '@/os/cms/toast';
import { PageTitle } from '@/os/OsLayout';
import { Empty, Field, Pill, Sheet, Tabs, inputCls, tsh } from '@/os/ui';
import { addDays, dayKey, fmtDate, isOverdue, overlaps, rentalLateDays, rentalTotals, type Checkout, type Rental, type Reservation } from './data';
import { Chip, EmptyBox, GearThumb, SearchBox, matchGear, useGear } from './shared';

const STATUS: Record<Rental['status'], { label: string; tone: 'blue' | 'amber' | 'green' | 'grey' }> = {
  booked: { label: 'Booked', tone: 'amber' }, out: { label: 'Out', tone: 'blue' }, returned: { label: 'Returned · settle deposit', tone: 'amber' }, closed: { label: 'Closed', tone: 'green' },
};

export function RentalsPanel() {
  const { rows: rentals } = useTable<Rental>('gear_rentals', { order: 'start_date', ascending: false });
  const { rows: gear } = useGear();
  const toast = useToast();
  const [tab, setTab] = useState<'active' | 'closed'>('active');
  const [adding, setAdding] = useState(false);
  const [ret, setRet] = useState<Rental | null>(null);
  const list = rentals.filter((r) => (tab === 'active' ? r.status !== 'closed' : r.status === 'closed'));
  const handOut = async (r: Rental) => {
    const busy = r.gear_ids.map((id) => gear.find((g) => g.id === id)).filter((g) => g && g.status !== 'available' && g.status !== 'reserved');
    if (busy.length) return toast(`${busy[0]!.name} is not back in the store yet — check it in first`, 'error');
    for (const id of r.gear_ids) await updateRow('gear_items', id, { status: 'out', holder_id: null });
    await updateRow('gear_rentals', r.id, { status: 'out' });
    toast('Handed to renter · agreement signed');
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={tab} onChange={setTab} items={[{ value: 'active', label: 'Active', count: rentals.filter((r) => r.status !== 'closed').length }, { value: 'closed', label: 'Closed', count: rentals.filter((r) => r.status === 'closed').length }]} />
        <button type="button" className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} />New rental</button>
      </div>
      {list.map((r) => {
        const t = rentalTotals(r);
        const late = r.status === 'out' ? rentalLateDays(r) : 0;
        return (
          <div key={r.id} className={`rounded-2xl border bg-white p-4 ${late ? 'border-red-200' : 'border-basil-line'}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span><b className="block">{r.renter_company || r.renter_name}</b><span className="text-xs text-basil-muted">{r.renter_name} · {r.renter_phone} · <span className="font-mono">{r.agreement_no}</span></span></span>
              <span className="flex gap-1.5">{late > 0 && <Pill tone="red">{late} day{late > 1 ? 's' : ''} late</Pill>}<Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill></span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">{r.gear_ids.map((id) => <Pill key={id} tone="grey">{gear.find((g) => g.id === id)?.name ?? id}</Pill>)}</div>
            <p className="m-0 mt-2 text-sm">{fmtDate(r.start_date)} → {fmtDate(r.end_date)} · {t.days} days · {tsh(r.rate)}/{r.pricing} · deposit {tsh(r.deposit)}</p>
            <p className="m-0 text-sm">Total <b>{tsh(t.total)}</b>{t.late > 0 && <span className="text-red-700"> (incl. late fees {tsh(t.late)})</span>}{r.status === 'closed' && ` · deposit refunded ${tsh(r.deposit_refunded)}`}</p>
            {r.inspection_note && <p className="m-0 mt-1 text-xs text-basil-muted">Inspection: {r.inspection_note}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to={`/os/store/rentals/${r.id}/agreement`} className="btn-outline !min-h-[40px] text-sm"><FileText size={15} />Agreement</Link>
              {r.status === 'booked' && <button type="button" className="btn-primary !min-h-[40px] text-sm" onClick={() => handOut(r)}>Hand out</button>}
              {r.status === 'out' && <button type="button" className="btn-primary !min-h-[40px] text-sm" onClick={() => setRet(r)}><Undo2 size={15} />Return & inspect</button>}
              {r.status === 'returned' && <button type="button" className="btn-primary !min-h-[40px] text-sm" onClick={() => updateRow('gear_rentals', r.id, { status: 'closed' }).then(() => toast('Deposit settled · rental closed'))}><HandCoins size={15} />Deposit settled</button>}
            </div>
          </div>
        );
      })}
      {!list.length && <EmptyBox>No rentals here.</EmptyBox>}
      <NewRentalSheet open={adding} onClose={() => setAdding(false)} rentals={rentals} />
      {ret && <ReturnSheet r={ret} onClose={() => setRet(null)} />}
    </div>
  );
}

function NewRentalSheet({ open, onClose, rentals }: { open: boolean; onClose: () => void; rentals: Rental[] }) {
  const { rows: gear } = useGear();
  const { rows: res } = useTable<Reservation>('gear_reservations');
  const { userId } = useActing();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [f, setF] = useState({ renter_name: '', renter_company: '', renter_phone: '', renter_id_number: '', gear_ids: [] as string[], start_date: addDays(dayKey(), 1), end_date: addDays(dayKey(), 3), pricing: 'day' as 'day' | 'week', rate: 0, deposit: 0, late_fee_per_day: 0 });
  const chosen = gear.filter((g) => f.gear_ids.includes(g.id));
  const dayRate = chosen.reduce((s, g) => s + g.day_rate, 0);
  const suggest = f.pricing === 'day' ? Math.round(dayRate * 1.2) : Math.round(dayRate * 1.2 * 5);
  const { rows: outNow } = useTable<Checkout>('gear_checkouts', { eq: { status: 'out' } });
  // Still out with crew past the hire start (or overdue) → cannot be promised to a renter.
  const busyOut = (id: string) => {
    const co = outNow.filter((c) => c.gear_id === id);
    if (co.length) return co.some((c) => isOverdue(c) || dayKey(c.due_at) >= f.start_date);
    return gear.find((g) => g.id === id)?.status === 'out'; // out on another rental
  };
  const clash = (id: string) => busyOut(id) || res.some((r) => r.gear_id === id && r.status === 'reserved' && overlaps(f.start_date, f.end_date, r.start_date, r.end_date)) || rentals.some((r) => r.gear_ids.includes(id) && ['booked', 'out'].includes(r.status) && overlaps(f.start_date, f.end_date, r.start_date, r.end_date));
  const save = async () => {
    if (!f.renter_name || !f.renter_phone || !f.gear_ids.length) return toast('Renter, phone and at least one item are required', 'error');
    if (f.gear_ids.some(clash)) return toast('One of the items is booked for those dates', 'error');
    const year = dayKey().slice(0, 4);
    const last = Math.max(10, ...rentals.filter((r) => r.agreement_no?.startsWith(`BM-RNT-${year}-`)).map((r) => Number(r.agreement_no.split('-').pop()) || 0));
    const no = `BM-RNT-${year}-${String(last + 1).padStart(3, '0')}`;
    await insertRow('gear_rentals', { ...f, rate: f.rate || suggest, deposit: f.deposit || Math.round(chosen.reduce((s, g) => s + g.purchase_price, 0) * 0.15), late_fee_per_day: f.late_fee_per_day || Math.round(dayRate * 0.6), agreement_no: no, status: 'booked', returned_at: null, inspection_note: '', damage_charge: 0, deposit_refunded: 0, created_by: userId });
    toast(`Rental ${no} booked`);
    setF((x) => ({ ...x, renter_name: '', renter_company: '', renter_phone: '', renter_id_number: '', gear_ids: [], rate: 0, deposit: 0, late_fee_per_day: 0 }));
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="New outside rental">
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Renter name"><input className={inputCls} value={f.renter_name} onChange={(e) => setF({ ...f, renter_name: e.target.value })} /></Field>
          <Field label="Company"><input className={inputCls} value={f.renter_company} onChange={(e) => setF({ ...f, renter_company: e.target.value })} /></Field>
          <Field label="Phone"><input className={inputCls} type="tel" inputMode="tel" value={f.renter_phone} onChange={(e) => setF({ ...f, renter_phone: e.target.value })} placeholder="+255…" /></Field>
          <Field label="ID (NIDA / passport)"><input className={inputCls} value={f.renter_id_number} onChange={(e) => setF({ ...f, renter_id_number: e.target.value })} /></Field>
          <Field label="From"><input className={inputCls} type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></Field>
          <Field label="To"><input className={inputCls} type="date" min={f.start_date} value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></Field>
        </div>
        <SearchBox value={q} onChange={setQ} />
        <div className="flex max-h-52 flex-col gap-1.5 overflow-y-auto">
          {gear.filter((g) => matchGear(g, q) && g.status !== 'out_of_service' && g.status !== 'in_repair').map((g) => {
            const on = f.gear_ids.includes(g.id), c = clash(g.id);
            return <button key={g.id} type="button" disabled={c && !on} aria-pressed={on} onClick={() => setF({ ...f, gear_ids: on ? f.gear_ids.filter((x) => x !== g.id) : [...f.gear_ids, g.id] })} className={`flex min-h-[48px] items-center gap-2 rounded-xl border px-3 text-left text-sm ${on ? 'border-amber-500 bg-amber-50' : 'border-basil-line bg-white'} ${c && !on ? 'opacity-50' : ''}`}><GearThumb gear={g} size={28} /><span className="flex-1 truncate"><b>{g.name}</b></span>{c ? <Pill tone="red">{busyOut(g.id) ? 'Out' : 'Booked'}</Pill> : g.status === 'out' ? <Pill tone="amber">Back {fmtDate(outNow.find((x) => x.gear_id === g.id)?.due_at)}</Pill> : <span className="text-xs text-basil-muted">{tsh(g.day_rate)}/day</span>}</button>;
          })}
        </div>
        <div className="flex gap-2"><Chip on={f.pricing === 'day'} onClick={() => setF({ ...f, pricing: 'day' })}>Per day</Chip><Chip on={f.pricing === 'week'} onClick={() => setF({ ...f, pricing: 'week' })}>Per week</Chip></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={`Rate per ${f.pricing}`} hint={`Suggested ${tsh(suggest)}`}><input className={inputCls} type="number" value={f.rate || ''} placeholder={String(suggest)} onChange={(e) => setF({ ...f, rate: Number(e.target.value) })} /></Field>
          <Field label="Deposit" hint="Default 15% of value"><input className={inputCls} type="number" value={f.deposit || ''} onChange={(e) => setF({ ...f, deposit: Number(e.target.value) })} /></Field>
          <Field label="Late fee / day"><input className={inputCls} type="number" value={f.late_fee_per_day || ''} onChange={(e) => setF({ ...f, late_fee_per_day: Number(e.target.value) })} /></Field>
        </div>
        <button type="button" className="btn-primary w-full" onClick={save}>Book rental</button>
      </div>
    </Sheet>
  );
}

function ReturnSheet({ r, onClose }: { r: Rental; onClose: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [damage, setDamage] = useState(0);
  const [damaged, setDamaged] = useState(false);
  const preview = rentalTotals({ ...r, returned_at: nowIso(), damage_charge: damage });
  const refund = Math.max(0, r.deposit - preview.late - damage);
  const save = async () => {
    await updateRow('gear_rentals', r.id, { status: 'returned', returned_at: nowIso(), inspection_note: note || 'Inspected — all items present.', damage_charge: damage, deposit_refunded: refund });
    for (const id of r.gear_ids) await updateRow('gear_items', id, { status: damaged ? 'in_repair' : 'available', holder_id: null });
    if (preview.late + damage > 0) await notifyRole('finance', `Rental ${r.agreement_no} charges`, `${r.renter_company || r.renter_name}: late ${tsh(preview.late)} + damage ${tsh(damage)}`, '/os/store/rentals', 'money');
    toast(`Returned · refund ${tsh(refund)} of deposit`);
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={`Return · ${r.agreement_no}`}>
      <div className="flex flex-col gap-3">
        <Field label="Inspection notes"><textarea className={`${inputCls} h-24 py-2`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="All items present? Sensor clean? Batteries? Scratches?" /></Field>
        <label className="flex min-h-[44px] items-center gap-3 text-sm font-semibold"><input type="checkbox" className="h-5 w-5" checked={damaged} onChange={(e) => setDamaged(e.target.checked)} />Damage found — send items to repair</label>
        <Field label="Damage charge (TSH)"><input className={inputCls} type="number" min={0} value={damage || ''} onChange={(e) => setDamage(Number(e.target.value))} /></Field>
        <dl className="m-0 grid grid-cols-2 gap-1 rounded-2xl bg-basil-mist p-3 text-sm">
          <dt>Hire ({preview.days} days)</dt><dd className="m-0 text-right">{tsh(preview.base)}</dd>
          <dt>Late fees ({rentalLateDays({ ...r, returned_at: nowIso() })} days)</dt><dd className="m-0 text-right">{tsh(preview.late)}</dd>
          <dt>Damage</dt><dd className="m-0 text-right">{tsh(damage)}</dd>
          <dt className="font-bold">Deposit refund</dt><dd className="m-0 text-right font-bold">{tsh(refund)}</dd>
        </dl>
        <button type="button" className="btn-primary w-full" onClick={save}>Confirm return</button>
      </div>
    </Sheet>
  );
}

export function RentalAgreement() {
  const { id } = useParams();
  const { rows } = useTable<Rental>('gear_rentals');
  const { rows: gear } = useGear();
  const r = rows.find((x) => x.id === id);
  if (!r) return <Empty title="Rental not found" />;
  const t = rentalTotals(r);
  const items = gear.filter((g) => r.gear_ids.includes(g.id));
  return (
    <div>
      <style>{'@media print { aside, header, .no-print { display: none !important; } main { padding: 0 !important; } body, .min-h-screen { background: #fff !important; } }'}</style>
      <div className="no-print"><PageTitle tag="OUTSIDE RENTAL" title={`Agreement ${r.agreement_no}`}><button type="button" className="btn-primary" onClick={() => print()}><Printer size={16} />Print</button></PageTitle></div>
      <article className="mx-auto max-w-3xl rounded-2xl border border-basil-line bg-white p-6 text-sm leading-relaxed sm:p-10 print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-4 border-b border-basil-line pb-4">
          <div><img src="/logo.svg" alt="" className="h-10" onError={(e) => (e.currentTarget.style.display = 'none')} /><b className="block font-display text-lg">Basil Media</b><span className="text-basil-muted">Mikocheni, Dar es Salaam · store@basilmedia.co.tz</span></div>
          <div className="text-right"><b className="block font-display text-lg">Equipment Rental Agreement</b><span className="font-mono">{r.agreement_no}</span><br /><span>Date {fmtDate(r.created_at ?? r.start_date)}</span></div>
        </header>
        <section className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><span className="kicker">RENTER</span><p className="m-0"><b>{r.renter_name}</b><br />{r.renter_company}<br />{r.renter_phone}<br />{r.renter_id_number}</p></div>
          <div><span className="kicker">PERIOD</span><p className="m-0">{fmtDate(r.start_date)} to {fmtDate(r.end_date)} ({t.days} days)<br />Return by 18:00 on {fmtDate(r.end_date)} to Basil Media, Mikocheni.</p></div>
        </section>
        <table className="mt-5 w-full border-collapse text-left">
          <thead><tr className="border-b border-basil-line"><th className="py-2">Item</th><th className="py-2">Serial</th><th className="py-2 text-right">Replacement value</th></tr></thead>
          <tbody>{items.map((g) => <tr key={g.id} className="border-b border-basil-line"><td className="py-2">{g.name}<br /><span className="text-xs text-basil-muted">{g.accessories}</span></td><td className="py-2 font-mono text-xs">{g.serial}</td><td className="py-2 text-right">{tsh(g.purchase_price)}</td></tr>)}</tbody>
        </table>
        <dl className="mt-4 ml-auto grid max-w-xs grid-cols-2 gap-1">
          <dt>Rate</dt><dd className="m-0 text-right">{tsh(r.rate)} / {r.pricing}</dd>
          <dt>Hire charge</dt><dd className="m-0 text-right">{tsh(t.base)}</dd>
          {t.late > 0 && <><dt>Late fees</dt><dd className="m-0 text-right">{tsh(t.late)}</dd></>}
          {r.damage_charge > 0 && <><dt>Damage</dt><dd className="m-0 text-right">{tsh(r.damage_charge)}</dd></>}
          <dt className="font-bold">Total</dt><dd className="m-0 text-right font-bold">{tsh(t.total)}</dd>
          <dt>Refundable deposit</dt><dd className="m-0 text-right">{tsh(r.deposit)}</dd>
        </dl>
        <section className="mt-5">
          <span className="kicker">TERMS</span>
          <ol className="mt-1 pl-5">
            <li>The renter is responsible for the equipment from collection until it is checked back in by Basil Media staff.</li>
            <li>Late returns are charged {tsh(r.late_fee_per_day)} per day or part day after 18:00 on the return date.</li>
            <li>Loss, theft or damage is charged at repair cost or replacement value as listed above, and may be deducted from the deposit.</li>
            <li>The equipment may not be sub-let or taken outside Tanzania without written consent. Drone use requires the renter’s own TCAA permit.</li>
            <li>The deposit is refunded after a return inspection, less any late fees and damage charges.</li>
          </ol>
        </section>
        <section className="mt-8 grid gap-8 sm:grid-cols-2">
          <div><div className="h-12 border-b border-basil-ink" /><span className="text-xs">Renter · {r.renter_name} · date</span></div>
          <div><div className="h-12 border-b border-basil-ink" /><span className="text-xs">For Basil Media · Storekeeper · date</span></div>
        </section>
      </article>
    </div>
  );
}
