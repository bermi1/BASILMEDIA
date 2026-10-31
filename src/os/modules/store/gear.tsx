// Gear register, asset detail, QR labels, ROI & depreciation.
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck, PackageCheck, Pencil, Plus, Printer, QrCode, ShieldAlert, Wrench } from 'lucide-react';
import { insertRow, updateRow, usePeople, useTable } from '@/os/lib/store';
import { useActing } from '@/os/lib/session';
import { useToast } from '@/os/cms/toast';
import { PageTitle } from '@/os/OsLayout';
import { Card, Empty, Field, Pill, Sheet, Stat, Tabs, inputCls, tsh, tshShort } from '@/os/ui';
import {
  CATEGORIES, CONDITIONS, GEAR_STATUS, INCIDENT_DECISIONS, QR, assetUrl, bookValue, conditionTone, daysOut, fmtDate, fmtDateTime, isOverdue, lateText, rentalIncome,
  type Gear, type GearStatus, type Incident, type Maintenance, type Rental, type Reservation,
} from './data';
import { GearStatusPill, GearThumb, Guard, STORE_ROLES, SearchBox, matchGear, nameOf, projectName, useCheckouts, useGear, useProjects } from './shared';
import { acknowledgeCheckouts } from './actions';
import { CheckinSheet, IncidentSheet, MaintenanceSheet } from './ops';

// ---------- register ----------
export function GearRegister() {
  const { rows: gear } = useGear();
  const people = usePeople();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | GearStatus>('all');
  const [cat, setCat] = useState('');
  const [edit, setEdit] = useState<Gear | 'new' | null>(null);
  const list = gear.filter((g) => matchGear(g, q) && (status === 'all' || g.status === status) && (!cat || g.category === cat));
  const value = gear.reduce((s, g) => s + g.purchase_price, 0);
  const book = gear.reduce((s, g) => s + bookValue(g), 0);
  return (
    <Guard roles={STORE_ROLES}>
      <PageTitle tag="MEDIA STORE" title="Gear register" sub={`${gear.length} items · bought for ${tshShort(value)} · book value ${tshShort(book)}`}>
        <div className="flex flex-wrap gap-2">
          <Link to={`/os/store/labels?ids=${list.map((g) => g.id).join(',')}`} className="btn-outline inline-flex items-center gap-2"><Printer size={16} />Print {list.length} labels</Link>
          <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => setEdit('new')}><Plus size={16} />Add item</button>
        </div>
      </PageTitle>
      <div className="mb-4 flex flex-col gap-3">
        <SearchBox value={q} onChange={setQ} />
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={status} onChange={setStatus} items={[{ value: 'all', label: 'All', count: gear.length }, ...(Object.keys(GEAR_STATUS) as GearStatus[]).map((s) => ({ value: s, label: GEAR_STATUS[s].label, count: gear.filter((g) => g.status === s).length }))]} />
          <select className={`${inputCls} !h-10 !w-auto`} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      {list.length === 0 ? <Empty title={`No gear matches “${q}”`} /> : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-basil-line bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-basil-mist font-mono text-[11px] uppercase tracking-wider text-basil-muted">
                <tr><th className="p-3">Item</th><th className="p-3">Serial</th><th className="p-3">Category</th><th className="p-3">Location</th><th className="p-3">Status</th><th className="p-3">Condition</th><th className="p-3 text-right">Day rate</th></tr>
              </thead>
              <tbody>
                {list.map((g) => (
                  <tr key={g.id} className="border-t border-basil-line hover:bg-basil-mist/60">
                    <td className="p-3"><Link to={`/os/store/asset/${g.id}`} className="flex items-center gap-3 font-bold text-basil-ink no-underline"><GearThumb gear={g} size={36} /><span><span className="block">{g.name}</span><span className="font-mono text-xs font-normal text-basil-muted">{g.tag}</span></span></Link></td>
                    <td className="p-3 font-mono text-xs">{g.serial}</td>
                    <td className="p-3">{g.category}</td>
                    <td className="p-3 text-basil-muted">{g.location}</td>
                    <td className="p-3"><GearStatusPill status={g.status} />{g.holder_id && <div className="mt-1 text-xs text-basil-muted">{nameOf(people, g.holder_id)}</div>}</td>
                    <td className="p-3"><Pill tone={conditionTone(g.condition)}>{g.condition}</Pill></td>
                    <td className="p-3 text-right">{tsh(g.day_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-2 md:hidden">
            {list.map((g) => <GearRow key={g.id} g={g} holder={g.holder_id ? nameOf(people, g.holder_id) : ''} to={`/os/store/asset/${g.id}`} />)}
          </div>
        </>
      )}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'Add gear item' : 'Edit gear item'}>
        {edit && <GearForm gear={edit === 'new' ? null : edit} count={gear.length} onDone={() => setEdit(null)} />}
      </Sheet>
    </Guard>
  );
}

export function GearRow({ g, holder, to, onClick, right }: { g: Gear; holder?: string; to?: string; onClick?: () => void; right?: React.ReactNode }) {
  const body = (
    <>
      <GearThumb gear={g} />
      <span className="min-w-0 flex-1">
        <b className="block truncate">{g.name}</b>
        <span className="block truncate text-xs text-basil-muted">{g.tag} · {g.serial}{holder ? ` · ${holder}` : ''}</span>
      </span>
      {right ?? <GearStatusPill status={g.status} />}
    </>
  );
  const cls = 'flex min-h-[60px] w-full items-center gap-3 rounded-2xl border border-basil-line bg-white p-3 text-left text-basil-ink no-underline';
  if (to) return <Link to={to} className={cls}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{body}</button>;
  return <div className={cls}>{body}</div>;
}

export function GearForm({ gear, count, onDone }: { gear: Gear | null; count: number; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<Partial<Gear>>(gear ?? { category: 'Camera', condition: 'Good', status: 'available', useful_life_years: 5, purchase_price: 0, day_rate: 0, salvage_value: 0, tag: `BM-GEN-${String(count + 1).padStart(3, '0')}` });
  const set = (k: keyof Gear) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const row = { ...f, name: f.name || `${f.make ?? ''} ${f.model ?? ''}`.trim(), purchase_date: f.purchase_date || null, insurance_expiry: f.insurance_expiry || null, warranty_expiry: f.warranty_expiry || null };
    try {
      if (gear) await updateRow('gear_items', gear.id, row);
      else await insertRow('gear_items', { holder_id: null, photo_url: '', notes: '', supplier: '', accessories: '', location: '', ...row });
      toast(gear ? 'Item updated' : 'Item added to the register');
      onDone();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };
  const inp = (k: keyof Gear, label: string, type = 'text', req = false) => <Field label={label}><input className={inputCls} type={type} required={req} value={(f[k] as string | number | undefined) ?? ''} onChange={set(k)} /></Field>;
  return (
    <form onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {inp('tag', 'Asset tag', 'text', true)}
      <Field label="Category"><select className={inputCls} value={f.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
      {inp('make', 'Make', 'text', true)}
      {inp('model', 'Model', 'text', true)}
      {inp('name', 'Display name')}
      {inp('serial', 'Serial number', 'text', true)}
      {inp('purchase_date', 'Purchase date', 'date')}
      {inp('purchase_price', 'Purchase price (TSH)', 'number')}
      {inp('supplier', 'Supplier')}
      {inp('day_rate', 'Internal day rate (TSH)', 'number')}
      <Field label="Condition"><select className={inputCls} value={f.condition} onChange={set('condition')}>{CONDITIONS.map((c) => <option key={c}>{c}</option>)}</select></Field>
      <Field label="Status"><select className={inputCls} value={f.status} onChange={set('status')} disabled={f.status === 'out'}>{(Object.keys(GEAR_STATUS) as GearStatus[]).filter((s) => s !== 'out' || f.status === 'out').map((s) => <option key={s} value={s}>{GEAR_STATUS[s].label}</option>)}</select></Field>
      {inp('location', 'Location / shelf')}
      {inp('photo_url', 'Photo URL', 'url')}
      {inp('insurance_expiry', 'Insurance expiry', 'date')}
      {inp('warranty_expiry', 'Warranty expiry', 'date')}
      {inp('useful_life_years', 'Useful life (years)', 'number')}
      {inp('salvage_value', 'Salvage value (TSH)', 'number')}
      <div className="sm:col-span-2"><Field label="Accessories"><textarea className={`${inputCls} h-20 py-2`} value={f.accessories ?? ''} onChange={set('accessories')} /></Field></div>
      <div className="flex gap-2 sm:col-span-2"><button className="btn-primary flex-1" type="submit">Save</button><button type="button" className="btn-outline" onClick={onDone}>Cancel</button></div>
    </form>
  );
}

// ---------- asset detail (QR target) ----------
/** Asset page. On the phone it is shown in place (gearId + onBack) so the bottom tabs stay put. */
export function AssetDetail({ gearId, onBack, onCheckout }: { gearId?: string; onBack?: () => void; onCheckout?: (id: string) => void } = {}) {
  const params = useParams();
  const id = gearId ?? params.id ?? '';
  const nav = useNavigate();
  const toast = useToast();
  const { userId, canAny } = useActing();
  const manage = canAny(...STORE_ROLES);
  const { rows: gear, loading } = useGear();
  const { rows: checkouts } = useCheckouts();
  const { rows: maint } = useTable<Maintenance>('gear_maintenance', { eq: { gear_id: id }, order: 'date', ascending: false });
  const { rows: incidents } = useTable<Incident>('gear_incidents', { eq: { gear_id: id } });
  const { rows: reservations } = useTable<Reservation>('gear_reservations', { eq: { gear_id: id }, order: 'start_date' });
  const { rows: rentals } = useTable<Rental>('gear_rentals');
  const people = usePeople();
  const projects = useProjects();
  const [tab, setTab] = useState<'history' | 'maintenance' | 'incidents' | 'reservations'>('history');
  const [sheet, setSheet] = useState<'edit' | 'checkin' | 'damage' | 'maint' | null>(null);
  const g = gear.find((x) => x.id === id);
  if (!g) return loading ? null : <Empty title="Item not found" sub="The QR label may belong to an item that was removed." action={onBack ? <button type="button" className="btn-outline" onClick={onBack}>Back</button> : <Link to="/os/store/gear">Back to register</Link>} />;
  const mine = checkouts.filter((c) => c.gear_id === id);
  const open = mine.find((c) => c.status === 'out');
  const days = daysOut(id, checkouts);
  const internal = days * g.day_rate;
  const rent = rentalIncome(id, rentals);
  const bv = bookValue(g);
  const facts: [string, React.ReactNode][] = [
    ['Make / model', `${g.make} ${g.model}`], ['Serial', <span className="font-mono">{g.serial}</span>], ['Category', g.category], ['Location', g.location || '—'],
    ['Purchased', `${fmtDate(g.purchase_date)} · ${tsh(g.purchase_price)}`], ['Supplier', g.supplier || '—'], ['Day rate', tsh(g.day_rate)],
    ['Insurance', g.insurance_expiry ? fmtDate(g.insurance_expiry) : 'Not insured'], ['Warranty', g.warranty_expiry ? fmtDate(g.warranty_expiry) : '—'], ['Accessories', g.accessories || '—'],
  ];
  const setStatus = async (s: GearStatus) => {
    await updateRow('gear_items', g.id, { status: s });
    toast(`Marked ${GEAR_STATUS[s].label.toLowerCase()}`);
  };
  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={() => (onBack ? onBack() : nav(-1))} className="flex min-h-[44px] items-center gap-1 self-start border-0 bg-transparent p-0 text-sm font-bold text-basil"><ArrowLeft size={16} />Back</button>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="flex flex-wrap items-start gap-4">
            {g.photo_url ? <img src={g.photo_url} alt={g.name} className="h-28 w-28 rounded-2xl object-cover" /> : <GearThumb gear={g} size={112} />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><GearStatusPill status={g.status} /><Pill tone={conditionTone(g.condition)}>{g.condition}</Pill><span className="font-mono text-xs text-basil-muted">{g.category} · {g.tag}</span></div>
              <h1 className="m-0 mt-2 text-2xl font-extrabold">{g.name}</h1>
              {open && (
                <p className={`m-0 mt-2 rounded-xl p-3 text-sm ${isOverdue(open) ? 'bg-red-50 text-red-800' : 'bg-basil-ice text-basil-deep'}`}>
                  With <b>{nameOf(people, open.holder_id)}</b> · {projectName(projects, open.project_id)} · due {fmtDateTime(open.due_at)}{isOverdue(open) && <> · <b>{lateText(open.due_at)}</b></>}
                  {!open.acknowledged_at && <> · <i>not yet acknowledged</i></>}
                </p>
              )}
            </div>
          </div>
          {open && open.holder_id === userId && !open.acknowledged_at && <button type="button" className="btn-primary mt-3 w-full" onClick={() => acknowledgeCheckouts([open.id]).then(() => toast('Thanks — you are responsible until it is checked in'))}>I have received this item</button>}
          {manage && (
            <div className="mt-4 flex flex-wrap gap-2">
              {g.status === 'available' || g.status === 'reserved' ? (onCheckout ? <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => onCheckout(g.id)}><PackageCheck size={16} />Check out</button> : <Link to={`/os/store/checkout?gear=${g.id}`} className="btn-primary inline-flex items-center gap-2"><PackageCheck size={16} />Check out</Link>) : null}
              {open && <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => setSheet('checkin')}><ClipboardCheck size={16} />Check in</button>}
              <button type="button" className="btn-outline inline-flex items-center gap-2" onClick={() => setSheet('damage')}><ShieldAlert size={16} />Report damage / loss</button>
              <button type="button" className="btn-outline inline-flex items-center gap-2" onClick={() => setSheet('maint')}><Wrench size={16} />Log maintenance</button>
              <button type="button" className="btn-outline inline-flex items-center gap-2" onClick={() => setSheet('edit')}><Pencil size={16} />Edit</button>
              {g.status !== 'out' && (
                <select className={`${inputCls} !h-11 !w-auto`} value={g.status} onChange={(e) => setStatus(e.target.value as GearStatus)} aria-label="Set status">
                  {(['available', 'reserved', 'in_repair', 'out_of_service'] as GearStatus[]).map((s) => <option key={s} value={s}>{GEAR_STATUS[s].label}</option>)}
                </select>
              )}
            </div>
          )}
          <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {facts.map(([k, v]) => <div key={k}><dt className="font-mono text-[10px] uppercase tracking-wider text-basil-muted">{k}</dt><dd className="m-0 text-sm font-semibold">{v}</dd></div>)}
          </dl>
        </Card>
        <div className="flex flex-col gap-4">
          <Card title="QR label" action={<Link to={`/os/store/asset/${g.id}/label`} className="inline-flex items-center gap-1 text-sm font-bold"><Printer size={15} />Print</Link>}>
            <div className="flex items-center gap-3">
              <img src={QR(assetUrl(g.id), 200)} alt={`QR code for ${g.tag}`} className="h-28 w-28 rounded-lg border border-basil-line" />
              <div className="text-sm"><b className="font-mono">{g.tag}</b><p className="m-0 mt-1 text-basil-muted">Scan with the Basil Media app to see who has it, check out or check in.</p></div>
            </div>
          </Card>
          {manage && (
            <Card title="Earnings & value">
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Days used" value={days} />
                <Stat label="Book value" value={tshShort(bv)} sub={`straight line · ${g.useful_life_years} yrs`} />
                <Stat label="Project use" value={tshShort(internal)} sub="day rate × days" />
                <Stat label="Rental income" value={tshShort(rent)} />
              </div>
              <p className="m-0 mt-3 text-sm">Earned <b>{Math.round(((internal + rent) / Math.max(1, g.purchase_price)) * 100)}%</b> of purchase price.</p>
            </Card>
          )}
        </div>
      </div>
      <Card>
        <Tabs value={tab} onChange={setTab} items={[{ value: 'history', label: 'Check-outs', count: mine.length }, { value: 'maintenance', label: 'Maintenance', count: maint.length }, { value: 'incidents', label: 'Incidents', count: incidents.length }, { value: 'reservations', label: 'Reservations', count: reservations.filter((r) => r.status === 'reserved').length }]} />
        <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
          {tab === 'history' && mine.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-basil-mist p-3 text-sm">
              <span><b>{nameOf(people, c.holder_id)}</b> · {projectName(projects, c.project_id)}<br /><span className="text-basil-muted">{fmtDateTime(c.out_at)} → {c.returned_at ? fmtDateTime(c.returned_at) : `due ${fmtDateTime(c.due_at)}`}</span></span>
              {c.status === 'out' ? <Pill tone={isOverdue(c) ? 'red' : 'blue'}>{isOverdue(c) ? lateText(c.due_at) : 'Out'}</Pill> : <Pill tone={conditionTone(c.in_condition ?? '')}>Back · {c.in_condition}</Pill>}
            </li>
          ))}
          {tab === 'maintenance' && maint.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-basil-mist p-3 text-sm">
              <span><b>{m.kind}</b> · {fmtDate(m.date)} · {m.vendor}<br /><span className="text-basil-muted">{m.description}</span></span>
              <span className="text-right"><b>{tsh(m.cost)}</b><br /><Pill tone={m.status === 'done' ? 'green' : 'amber'}>{m.status === 'done' ? 'Done' : 'Open'}</Pill></span>
            </li>
          ))}
          {tab === 'incidents' && incidents.map((i) => (
            <li key={i.id} className="rounded-xl bg-basil-mist p-3 text-sm"><b className="capitalize">{i.kind}</b> · {fmtDate(i.created_at)} · {nameOf(people, i.holder_id)}<br /><span className="text-basil-muted">{i.description}</span><br /><Pill tone={i.decision === 'pending' ? 'amber' : 'green'}>{INCIDENT_DECISIONS[i.decision]}</Pill></li>
          ))}
          {tab === 'reservations' && reservations.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-basil-mist p-3 text-sm"><span><b>{fmtDate(r.start_date)} → {fmtDate(r.end_date)}</b> · {nameOf(people, r.holder_id)} · {projectName(projects, r.project_id)}</span><Pill tone={r.status === 'reserved' ? 'amber' : 'grey'}>{r.status}</Pill></li>
          ))}
        </ul>
      </Card>
      <Sheet open={sheet === 'edit'} onClose={() => setSheet(null)} title="Edit gear item">{sheet === 'edit' && <GearForm gear={g} count={gear.length} onDone={() => setSheet(null)} />}</Sheet>
      {open && <CheckinSheet open={sheet === 'checkin'} onClose={() => setSheet(null)} checkout={open} gear={g} />}
      <IncidentSheet open={sheet === 'damage'} onClose={() => setSheet(null)} gear={g} holder={open?.holder_id ?? null} checkoutId={open?.id ?? null} />
      <MaintenanceSheet open={sheet === 'maint'} onClose={() => setSheet(null)} gearId={g.id} />
    </div>
  );
}

// ---------- printable QR labels ----------
export function LabelsPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const ids = id ? [id] : (params.get('ids') ?? '').split(',').filter(Boolean);
  const { rows: gear } = useGear();
  const list = ids.length ? gear.filter((g) => ids.includes(g.id)) : gear;
  return (
    <div>
      <style>{'@media print { aside, header, .no-print { display: none !important; } main { padding: 0 !important; } body, .min-h-screen { background: #fff !important; } .label { break-inside: avoid; } }'}</style>
      <div className="no-print"><PageTitle tag="MEDIA STORE" title={`QR labels · ${list.length}`} sub="Print on A4 sticker sheets and fix to each item or case."><button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => print()}><Printer size={16} />Print</button></PageTitle></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3">
        {list.map((g) => (
          <div key={g.id} className="label flex flex-col items-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-3 text-center">
            <img src={QR(assetUrl(g.id))} alt={`QR ${g.tag}`} className="h-32 w-32" />
            <b className="mt-1 font-mono text-sm">{g.tag}</b>
            <span className="text-xs font-bold leading-tight">{g.name}</span>
            <span className="font-mono text-[10px] text-slate-500">{g.serial}</span>
            <span className="mt-1 text-[10px] text-slate-500">Property of Basil Media · Mikocheni, Dar es Salaam</span>
          </div>
        ))}
      </div>
      {!list.length && <Empty icon={<QrCode size={24} />} title="No items selected" />}
    </div>
  );
}

// ---------- ROI & depreciation ----------
export function RoiPage() {
  const { rows: gear } = useGear();
  const { rows: checkouts } = useCheckouts();
  const { rows: rentals } = useTable<Rental>('gear_rentals');
  const { rows: maint } = useTable<Maintenance>('gear_maintenance');
  const [sort, setSort] = useState<'roi' | 'price' | 'days'>('roi');
  const rows = useMemo(() => gear.map((g) => {
    const days = daysOut(g.id, checkouts);
    const internal = days * g.day_rate;
    const rent = rentalIncome(g.id, rentals);
    const upkeep = maint.filter((m) => m.gear_id === g.id).reduce((s, m) => s + m.cost, 0);
    const earned = internal + rent;
    const bv = bookValue(g);
    const perYear = (g.purchase_price - g.salvage_value) / Math.max(1, g.useful_life_years);
    return { g, days, internal, rent, upkeep, earned, bv, perYear, roi: (earned - upkeep) / Math.max(1, g.purchase_price) };
  }).sort((a, b) => (sort === 'roi' ? b.roi - a.roi : sort === 'price' ? b.g.purchase_price - a.g.purchase_price : b.days - a.days)), [gear, checkouts, rentals, maint, sort]);
  const T = rows.reduce((s, r) => ({ price: s.price + r.g.purchase_price, bv: s.bv + r.bv, earned: s.earned + r.earned, upkeep: s.upkeep + r.upkeep, dep: s.dep + r.perYear }), { price: 0, bv: 0, earned: 0, upkeep: 0, dep: 0 });
  return (
    <Guard roles={STORE_ROLES}>
      <PageTitle tag="MEDIA STORE" title="Gear ROI & depreciation" sub="Day rate × days out on projects, plus outside rental income, against purchase price. Straight-line depreciation to salvage value." />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Purchase cost" value={tshShort(T.price)} />
        <Stat label="Book value today" value={tshShort(T.bv)} />
        <Stat label="Depreciation / year" value={tshShort(T.dep)} tone="amber" />
        <Stat label="Earned (use + rental)" value={tshShort(T.earned)} tone="green" />
        <Stat label="Maintenance spend" value={tshShort(T.upkeep)} />
      </div>
      <div className="mb-3"><Tabs value={sort} onChange={setSort} items={[{ value: 'roi', label: 'Best return' }, { value: 'price', label: 'Most expensive' }, { value: 'days', label: 'Most used' }]} /></div>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <Link key={r.g.id} to={`/os/store/asset/${r.g.id}`} className="grid grid-cols-1 gap-2 rounded-2xl border border-basil-line bg-white p-3 text-basil-ink no-underline sm:grid-cols-[1.6fr_repeat(4,1fr)] sm:items-center">
            <span className="flex items-center gap-3"><GearThumb gear={r.g} size={36} /><span className="min-w-0"><b className="block truncate">{r.g.name}</b><span className="text-xs text-basil-muted">{r.days} days used · {tsh(r.g.day_rate)}/day</span></span></span>
            <span className="text-sm"><span className="block text-xs text-basil-muted">Cost</span>{tshShort(r.g.purchase_price)}</span>
            <span className="text-sm"><span className="block text-xs text-basil-muted">Earned</span>{tshShort(r.internal)} + {tshShort(r.rent)} rental</span>
            <span className="text-sm"><span className="block text-xs text-basil-muted">Book value</span>{tshShort(r.bv)}</span>
            <span className="flex flex-col gap-1 text-sm"><span className="text-xs text-basil-muted">Return</span><Pill tone={r.roi >= 1 ? 'green' : r.roi >= 0.4 ? 'blue' : 'amber'}>{Math.round(r.roi * 100)}% of cost</Pill></span>
          </Link>
        ))}
      </div>
    </Guard>
  );
}
