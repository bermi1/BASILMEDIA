// Store operations: check-in sheet, maintenance, damage/loss incidents, consumables, stock-take, reservations.
import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, Minus, PackagePlus, Plus, ShieldAlert, Trash2, Wrench } from 'lucide-react';
import { insertRow, nowIso, updateRow, usePeople, useTable } from '@/os/lib/store';
import { notify } from '@/os/lib/notify';
import { useActing } from '@/os/lib/session';
import { useToast } from '@/os/cms/toast';
import { Card, Field, Pill, Progress, Sheet, Stat, Tabs, inputCls, tsh, tshShort } from '@/os/ui';
import {
  CONDITIONS, INCIDENT_DECISIONS, addDays, dayKey, fmtDate, fmtDateTime, fmtDay,
  type Checkout, type Consumable, type Gear, type Incident, type IncidentDecision, type Maintenance, type Reservation, type StockMovement, type StockTake,
} from './data';
import { checkinGear, moveStock, requestRestock, reservationConflicts, reserveGear } from './actions';
import { Chip, EmptyBox, GearStatusPill, GearThumb, PersonSelect, PhotoField, ProjectSelect, SearchBox, SectionHead, matchGear, nameOf, projectName, useCheckouts, useGear, useProjects } from './shared';

const err = (toast: ReturnType<typeof useToast>) => (e: unknown) => toast((e as Error).message ?? String(e), 'error');

// ---------- check-in ----------
export function CheckinSheet({ open, onClose, checkout, gear }: { open: boolean; onClose: () => void; checkout: Checkout; gear: Gear }) {
  const { userId } = useActing();
  const toast = useToast();
  const people = usePeople();
  const [cond, setCond] = useState(checkout.out_condition || 'Good');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState('');
  const [busy, setBusy] = useState(false);
  const damaged = cond === 'Damaged' || cond === 'Poor';
  const go = async () => {
    if (damaged && !note.trim()) return toast('Describe the damage before checking in', 'error');
    setBusy(true);
    try {
      await checkinGear(checkout.id, cond, note, photo, userId);
      toast(damaged ? 'Checked in · damage sent to GM/CFO for a decision' : `${gear.name} checked in · Asante`);
      onClose();
    } catch (e) {
      err(toast)(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title={`Check in · ${gear.name}`}>
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-basil-mist p-3 text-sm">
          From <b>{nameOf(people, checkout.holder_id)}</b> · out {fmtDateTime(checkout.out_at)} in <b>{checkout.out_condition}</b> condition
          {checkout.out_note && <div className="mt-1 text-basil-muted">“{checkout.out_note}”</div>}
          {checkout.out_photo_url && <img src={checkout.out_photo_url} alt="Condition at check-out" className="mt-2 h-24 rounded-xl object-cover" />}
        </div>
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-1.5 text-sm font-bold text-[#33465F]">Condition on return</legend>
          <div className="flex flex-wrap gap-2">{CONDITIONS.map((c) => <Chip key={c} on={cond === c} onClick={() => setCond(c)}>{c}</Chip>)}</div>
        </fieldset>
        <Field label={damaged ? 'What is damaged and how did it happen?' : 'Note (optional)'}><textarea className={`${inputCls} h-20 py-2`} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <PhotoField value={photo} onChange={setPhoto} label="Return photo (link)" />
        {damaged && <p className="m-0 rounded-xl bg-red-50 p-3 text-sm text-red-800">The item goes to <b>In repair</b> and a damage report goes to Saul (GM/CFO). The borrower is copied.</p>}
        <button type="button" disabled={busy} onClick={go} className="btn-primary w-full">{busy ? 'Saving…' : damaged ? 'Check in & report damage' : 'Check in'}</button>
      </div>
    </Sheet>
  );
}

// ---------- incidents ----------
export function IncidentSheet({ open, onClose, gear, holder, checkoutId }: { open: boolean; onClose: () => void; gear: Gear | null; holder: string | null; checkoutId: string | null }) {
  const { userId } = useActing();
  const toast = useToast();
  const { rows: all } = useGear();
  const [gearId, setGearId] = useState(gear?.id ?? '');
  const [kind, setKind] = useState<'damage' | 'loss'>('damage');
  const [desc, setDesc] = useState('');
  const [cost, setCost] = useState(0);
  const [photo, setPhoto] = useState('');
  const [who, setWho] = useState(holder ?? '');
  const g = gear ?? all.find((x) => x.id === gearId);
  const save = async () => {
    if (!g) return toast('Pick the item', 'error');
    if (desc.trim().length < 5) return toast('Describe what happened', 'error');
    try {
      await insertRow('gear_incidents', { gear_id: g.id, checkout_id: checkoutId, kind, description: desc, photo_url: photo, holder_id: who || null, reported_by: userId, estimated_cost: cost, decision: 'pending', decision_note: '', decided_by: null, status: 'open' });
      if (g.status !== 'out') await updateRow('gear_items', g.id, { status: kind === 'loss' ? 'out_of_service' : 'in_repair', condition: kind === 'damage' ? 'Damaged' : g.condition });
      await notify('u-gm', `${kind === 'loss' ? 'Loss' : 'Damage'} reported · ${g.name}`, `${desc.slice(0, 80)} · est. ${tsh(cost)}`, '/os/store/maintenance', 'alert');
      toast('Report sent to Saul (GM/CFO) for a decision');
      onClose();
      setDesc('');
    } catch (e) {
      err(toast)(e);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Report damage or loss">
      <div className="flex flex-col gap-3">
        {!gear && <Field label="Item"><select className={inputCls} value={gearId} onChange={(e) => setGearId(e.target.value)}><option value="">Choose item…</option>{all.map((x) => <option key={x.id} value={x.id}>{x.tag} · {x.name}</option>)}</select></Field>}
        <div className="flex gap-2"><Chip on={kind === 'damage'} onClick={() => setKind('damage')}>Damage</Chip><Chip on={kind === 'loss'} onClick={() => setKind('loss')}>Loss / theft</Chip></div>
        <Field label="What happened"><textarea className={`${inputCls} h-24 py-2`} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Where, when, how — and who was using it" /></Field>
        <Field label="Responsible person (if any)"><PersonSelect value={who} onChange={setWho} label="Last borrower" /></Field>
        <Field label="Estimated cost (TSH)"><input className={inputCls} type="number" min={0} value={cost || ''} onChange={(e) => setCost(Number(e.target.value))} /></Field>
        <PhotoField value={photo} onChange={setPhoto} label="Damage photo (link)" />
        <button type="button" onClick={save} className="btn-primary w-full">Send report</button>
      </div>
    </Sheet>
  );
}

export function IncidentsPanel() {
  const { rows: incidents } = useTable<Incident>('gear_incidents', { order: 'created_at', ascending: false });
  const { rows: gear } = useGear();
  const people = usePeople();
  const { userId, can } = useActing();
  const toast = useToast();
  const leader = can('gm_cfo', 'boss');
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const [report, setReport] = useState(false);
  const [deciding, setDeciding] = useState<Incident | null>(null);
  const [decision, setDecision] = useState<IncidentDecision>('repair');
  const [note, setNote] = useState('');
  const list = incidents.filter((i) => i.status === tab);
  const decide = async () => {
    const i = deciding!;
    if (i.reported_by === userId) return toast('The person who reported it cannot also decide it', 'error');
    try {
      await updateRow('gear_incidents', i.id, { decision, decision_note: note, decided_by: userId, status: 'closed' });
      const g = gear.find((x) => x.id === i.gear_id);
      if (decision === 'repair' || decision === 'insurance_claim') {
        await insertRow('gear_maintenance', { gear_id: i.gear_id, date: dayKey(), kind: 'Repair', description: `From incident: ${i.description}`, vendor: '', cost: i.estimated_cost, status: 'open', done_at: null, logged_by: userId });
        if (g && g.status !== 'out') await updateRow('gear_items', g.id, { status: 'in_repair' });
      }
      if (decision === 'write_off' && g) await updateRow('gear_items', g.id, { status: 'out_of_service', holder_id: null });
      if (decision === 'staff_liable' && i.holder_id) await notify(i.holder_id, 'Gear incident decision', `${g?.name}: you are asked to cover ${tsh(i.estimated_cost)}. ${note}`, '', 'alert');
      if (decision === 'staff_liable' || decision === 'client_liable') await notify('u-fin', 'Recover gear cost', `${g?.name} · ${tsh(i.estimated_cost)} · ${INCIDENT_DECISIONS[decision]}`, '', 'money');
      await notify('u-store', `Decision · ${g?.name}`, INCIDENT_DECISIONS[decision], '/os/store/maintenance', 'info');
      toast('Decision recorded');
      setDeciding(null);
      setNote('');
    } catch (e) {
      err(toast)(e);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={tab} onChange={setTab} items={[{ value: 'open', label: 'Awaiting decision', count: incidents.filter((i) => i.status === 'open').length }, { value: 'closed', label: 'Decided', count: incidents.filter((i) => i.status === 'closed').length }]} />
        <button type="button" className="btn-outline" onClick={() => setReport(true)}><ShieldAlert size={16} />Report</button>
      </div>
      {list.length === 0 && <EmptyBox>Nothing here.</EmptyBox>}
      {list.map((i) => {
        const g = gear.find((x) => x.id === i.gear_id);
        return (
          <div key={i.id} className={`rounded-2xl border bg-white p-4 ${i.status === 'open' ? 'border-red-200' : 'border-basil-line'}`}>
            <div className="flex items-start gap-3">
              {g && <GearThumb gear={g} />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><Pill tone={i.kind === 'loss' ? 'red' : 'amber'}>{i.kind === 'loss' ? 'Loss' : 'Damage'}</Pill><b>{g?.name}</b></div>
                <p className="m-0 mt-1 text-sm">{i.description}</p>
                <p className="m-0 mt-1 text-xs text-basil-muted">{fmtDateTime(i.created_at)} · reported by {nameOf(people, i.reported_by)} · borrower {nameOf(people, i.holder_id)} · est. {tsh(i.estimated_cost)}</p>
                {i.photo_url && <img src={i.photo_url} alt="" className="mt-2 h-20 rounded-xl object-cover" />}
                <div className="mt-2"><Pill tone={i.decision === 'pending' ? 'amber' : 'green'}>{INCIDENT_DECISIONS[i.decision]}</Pill>{i.decided_by && <span className="ml-2 text-xs text-basil-muted">by {nameOf(people, i.decided_by)}{i.decision_note && ` · “${i.decision_note}”`}</span>}</div>
              </div>
            </div>
            {i.status === 'open' && (leader ? <button type="button" className="btn-primary mt-3 w-full sm:w-auto" onClick={() => setDeciding(i)}>Decide follow-up</button> : <p className="m-0 mt-2 text-xs text-amber-800">Waiting for Saul (GM/CFO) to decide.</p>)}
          </div>
        );
      })}
      <IncidentSheet open={report} onClose={() => setReport(false)} gear={null} holder={null} checkoutId={null} />
      <Sheet open={!!deciding} onClose={() => setDeciding(null)} title="Follow-up decision">
        <div className="flex flex-col gap-3">
          <Field label="Decision"><select className={inputCls} value={decision} onChange={(e) => setDecision(e.target.value as IncidentDecision)}>{(Object.keys(INCIDENT_DECISIONS) as IncidentDecision[]).filter((k) => k !== 'pending').map((k) => <option key={k} value={k}>{INCIDENT_DECISIONS[k]}</option>)}</select></Field>
          <Field label="Note"><textarea className={`${inputCls} h-20 py-2`} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <button type="button" className="btn-primary w-full" onClick={decide}>Record decision</button>
        </div>
      </Sheet>
    </div>
  );
}

// ---------- maintenance ----------
export function MaintenanceSheet({ open, onClose, gearId }: { open: boolean; onClose: () => void; gearId?: string }) {
  const { userId } = useActing();
  const toast = useToast();
  const { rows: gear } = useGear();
  const [f, setF] = useState({ gear_id: gearId ?? '', kind: 'Service', description: '', vendor: '', cost: 0, date: dayKey(), sendToRepair: true });
  const save = async () => {
    if (!f.gear_id || !f.description) return toast('Pick the item and describe the work', 'error');
    try {
      const done = f.kind === 'Clean' || !f.sendToRepair;
      await insertRow('gear_maintenance', { gear_id: f.gear_id, kind: f.kind, description: f.description, vendor: f.vendor, cost: f.cost, date: f.date, status: done ? 'done' : 'open', done_at: done ? f.date : null, logged_by: userId });
      const g = gear.find((x) => x.id === f.gear_id);
      if (!done && g && g.status !== 'out') await updateRow('gear_items', g.id, { status: 'in_repair' });
      toast('Maintenance logged');
      onClose();
    } catch (e) {
      err(toast)(e);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Log maintenance">
      <div className="flex flex-col gap-3">
        {!gearId && <Field label="Item"><select className={inputCls} value={f.gear_id} onChange={(e) => setF({ ...f, gear_id: e.target.value })}><option value="">Choose item…</option>{gear.map((x) => <option key={x.id} value={x.id}>{x.tag} · {x.name}</option>)}</select></Field>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type"><select className={inputCls} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{['Service', 'Repair', 'Clean', 'Calibration', 'Firmware'].map((k) => <option key={k}>{k}</option>)}</select></Field>
          <Field label="Date"><input className={inputCls} type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        </div>
        <Field label="Work done / fault"><textarea className={`${inputCls} h-20 py-2`} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vendor"><input className={inputCls} value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} placeholder="In-house" /></Field>
          <Field label="Cost (TSH)"><input className={inputCls} type="number" min={0} value={f.cost || ''} onChange={(e) => setF({ ...f, cost: Number(e.target.value) })} /></Field>
        </div>
        <label className="flex min-h-[44px] items-center gap-3 text-sm font-semibold"><input type="checkbox" className="h-5 w-5" checked={f.sendToRepair} onChange={(e) => setF({ ...f, sendToRepair: e.target.checked })} />Still in progress — mark the item “In repair”</label>
        <button type="button" className="btn-primary w-full" onClick={save}>Save</button>
      </div>
    </Sheet>
  );
}

export function MaintenancePanel() {
  const { rows } = useTable<Maintenance>('gear_maintenance', { order: 'date', ascending: false });
  const { rows: gear } = useGear();
  const toast = useToast();
  const [add, setAdd] = useState(false);
  const [tab, setTab] = useState<'open' | 'done'>('open');
  const year = rows.filter((m) => m.date >= `${dayKey().slice(0, 4)}-01-01`).reduce((s, m) => s + m.cost, 0);
  const finish = async (m: Maintenance) => {
    await updateRow('gear_maintenance', m.id, { status: 'done', done_at: dayKey() });
    const others = rows.filter((x) => x.gear_id === m.gear_id && x.status === 'open' && x.id !== m.id);
    const g = gear.find((x) => x.id === m.gear_id);
    if (!others.length && g?.status === 'in_repair') await updateRow('gear_items', g.id, { status: 'available', condition: 'Good' });
    toast(`${g?.name ?? 'Item'} back in service`);
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Open jobs" value={rows.filter((m) => m.status === 'open').length} tone="amber" />
        <Stat label="In repair" value={gear.filter((g) => g.status === 'in_repair').length} />
        <Stat label="Spend this year" value={tshShort(year)} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={tab} onChange={setTab} items={[{ value: 'open', label: 'Open', count: rows.filter((m) => m.status === 'open').length }, { value: 'done', label: 'Done', count: rows.filter((m) => m.status === 'done').length }]} />
        <button type="button" className="btn-outline" onClick={() => setAdd(true)}><Wrench size={16} />Log work</button>
      </div>
      {rows.filter((m) => m.status === tab).map((m) => {
        const g = gear.find((x) => x.id === m.gear_id);
        return (
          <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-basil-line bg-white p-3">
            {g && <GearThumb gear={g} />}
            <div className="min-w-0 flex-1">
              <b className="block">{g?.name}</b>
              <span className="block text-sm">{m.kind} · {m.description}</span>
              <span className="text-xs text-basil-muted">{fmtDate(m.date)} · {m.vendor || 'In-house'} · {tsh(m.cost)}</span>
            </div>
            {m.status === 'open' ? <button type="button" className="btn-outline" onClick={() => finish(m)}><CheckCircle2 size={16} />Back in service</button> : <Pill tone="green">Done {fmtDate(m.done_at)}</Pill>}
          </div>
        );
      })}
      {rows.filter((m) => m.status === tab).length === 0 && <EmptyBox>No {tab} maintenance.</EmptyBox>}
      <MaintenanceSheet open={add} onClose={() => setAdd(false)} />
    </div>
  );
}

// ---------- consumables ----------
export function ConsumablesPanel({ compact }: { compact?: boolean }) {
  const { rows: items } = useTable<Consumable>('consumables', { order: 'name' });
  const { rows: moves } = useTable<StockMovement>('stock_movements', { order: 'created_at', ascending: false, limit: 12 });
  const people = usePeople();
  const projects = useProjects();
  const { userId } = useActing();
  const toast = useToast();
  const [sel, setSel] = useState<{ c: Consumable; kind: 'issue' | 'receive' } | null>(null);
  const [qty, setQty] = useState(1);
  const [person, setPerson] = useState('');
  const [project, setProject] = useState('');
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);
  const [nw, setNw] = useState({ name: '', category: 'Batteries', unit: 'pc', quantity: 0, min_level: 1, unit_cost: 0, location: '' });
  const low = items.filter((c) => c.quantity <= c.min_level);
  const go = async () => {
    try {
      await moveStock(sel!.c, sel!.kind, qty, person || null, project || null, note, userId);
      toast(sel!.kind === 'issue' ? `Issued ${qty} ${sel!.c.unit}` : `Received ${qty} ${sel!.c.unit}`);
      setSel(null);
      setQty(1);
      setNote('');
    } catch (e) {
      err(toast)(e);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      {low.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <b className="flex items-center gap-2 text-amber-900"><AlertTriangle size={16} />{low.length} below minimum</b>
          <div className="mt-2 flex flex-col gap-2">
            {low.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span><b>{c.name}</b> · {c.quantity} left (min {c.min_level})</span>
                <button type="button" className="btn-outline !min-h-[40px] !px-3 text-sm" onClick={() => requestRestock(c, c.min_level * 2 - c.quantity).then(() => toast('Restock request sent to Saul (GM/CFO)'))}>Request {c.min_level * 2 - c.quantity} more</button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((c) => (
          <div key={c.id} className="rounded-2xl border border-basil-line bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0"><b className="block">{c.name}</b><span className="text-xs text-basil-muted">{c.category} · {c.location} · {tsh(c.unit_cost)}/{c.unit}</span></span>
              <span className={`font-display text-2xl font-extrabold ${c.quantity <= c.min_level ? 'text-red-700' : 'text-basil-ink'}`}>{c.quantity}</span>
            </div>
            <div className="my-2"><Progress value={c.quantity} max={Math.max(c.min_level * 2, c.quantity)} tone={c.quantity <= c.min_level ? 'red' : c.quantity <= c.min_level * 1.5 ? 'amber' : 'green'} /></div>
            <div className="flex gap-2">
              <button type="button" className="btn-outline flex-1 !px-2" onClick={() => setSel({ c, kind: 'issue' })}><Minus size={16} />Issue</button>
              <button type="button" className="btn-outline flex-1 !px-2" onClick={() => setSel({ c, kind: 'receive' })}><Plus size={16} />Receive</button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="btn-outline self-start" onClick={() => setAdding(true)}><PackagePlus size={16} />New consumable</button>
      {!compact && (
        <Card title="Recent movements">
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
            {moves.map((m) => {
              const c = items.find((x) => x.id === m.consumable_id);
              return <li key={m.id} className="flex flex-wrap justify-between gap-2 border-b border-basil-line pb-1.5"><span><Pill tone={m.kind === 'issue' ? 'amber' : 'green'}>{m.kind}</Pill> <b>{m.quantity}</b> {c?.name} {m.person_id && `→ ${nameOf(people, m.person_id)}`} {m.project_id && `· ${projectName(projects, m.project_id)}`}</span><span className="text-basil-muted">{fmtDateTime(m.created_at)}</span></li>;
            })}
          </ul>
        </Card>
      )}
      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.kind === 'issue' ? 'Issue' : 'Receive'} · ${sel.c.name}` : ''}>
        {sel && (
          <div className="flex flex-col gap-3">
            <p className="m-0 text-sm text-basil-muted">{sel.c.quantity} {sel.c.unit} in stock · minimum {sel.c.min_level}</p>
            <div className="flex items-center gap-3">
              <button type="button" aria-label="Less" className="btn-outline !w-14" onClick={() => setQty(Math.max(1, qty - 1))}><Minus size={18} /></button>
              <input className={`${inputCls} text-center text-xl font-bold`} type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} aria-label="Quantity" />
              <button type="button" aria-label="More" className="btn-outline !w-14" onClick={() => setQty(qty + 1)}><Plus size={18} /></button>
            </div>
            {sel.kind === 'issue' && (<><Field label="Issued to"><PersonSelect value={person} onChange={setPerson} /></Field><Field label="Project"><ProjectSelect value={project} onChange={setProject} /></Field></>)}
            <Field label={sel.kind === 'receive' ? 'Supplier / note' : 'Note'}><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            <button type="button" className="btn-primary w-full" onClick={go}>{sel.kind === 'issue' ? 'Issue' : 'Receive'} {qty}</button>
          </div>
        )}
      </Sheet>
      <Sheet open={adding} onClose={() => setAdding(false)} title="New consumable">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Field label="Name"><input className={inputCls} value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} /></Field></div>
          <Field label="Category"><select className={inputCls} value={nw.category} onChange={(e) => setNw({ ...nw, category: e.target.value })}>{['Batteries', 'Memory cards', 'Cables', 'Tape', 'Cleaning', 'Storage', 'Grip', 'Other'].map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Unit"><input className={inputCls} value={nw.unit} onChange={(e) => setNw({ ...nw, unit: e.target.value })} /></Field>
          <Field label="In stock"><input className={inputCls} type="number" value={nw.quantity} onChange={(e) => setNw({ ...nw, quantity: Number(e.target.value) })} /></Field>
          <Field label="Minimum level"><input className={inputCls} type="number" value={nw.min_level} onChange={(e) => setNw({ ...nw, min_level: Number(e.target.value) })} /></Field>
          <Field label="Unit cost (TSH)"><input className={inputCls} type="number" value={nw.unit_cost} onChange={(e) => setNw({ ...nw, unit_cost: Number(e.target.value) })} /></Field>
          <Field label="Location"><input className={inputCls} value={nw.location} onChange={(e) => setNw({ ...nw, location: e.target.value })} /></Field>
          <button type="button" className="btn-primary col-span-2" onClick={() => nw.name ? insertRow('consumables', nw).then(() => (toast('Added'), setAdding(false))).catch(err(toast)) : toast('Name required', 'error')}>Add</button>
        </div>
      </Sheet>
    </div>
  );
}

// ---------- stock-take ----------
export function StockTakePanel() {
  const { rows: takes } = useTable<StockTake>('stock_takes', { order: 'started_at', ascending: false });
  const { rows: gear } = useGear();
  const people = usePeople();
  const { userId } = useActing();
  const toast = useToast();
  const [q, setQ] = useState('');
  const open = takes.find((t) => t.status === 'open');
  const last = takes.find((t) => t.status === 'completed');
  const shelf = gear.filter((g) => g.status !== 'out');
  const out = gear.filter((g) => g.status === 'out');
  const start = () => insertRow('stock_takes', { started_by: userId, started_at: nowIso(), completed_at: null, found_ids: [], missing_ids: [], status: 'open', note: '' }).then(() => toast('Stock-take started — tick everything you can see'));
  const toggle = (id: string) => open && updateRow('stock_takes', open.id, { found_ids: open.found_ids.includes(id) ? open.found_ids.filter((x) => x !== id) : [...open.found_ids, id] });
  const finish = async () => {
    if (!open) return;
    const missing = shelf.filter((g) => !open.found_ids.includes(g.id)).map((g) => g.id);
    await updateRow('stock_takes', open.id, { status: 'completed', completed_at: nowIso(), missing_ids: missing });
    if (missing.length) await notify('u-gm', `Stock-take: ${missing.length} missing`, missing.map((m) => gear.find((g) => g.id === m)?.name).join(', '), '/os/store/stocktake', 'alert');
    else await notify('u-gm', 'Stock-take complete', `All ${gear.length} items accounted for`, '/os/store/stocktake', 'info');
    toast(missing.length ? `${missing.length} missing — report sent to Saul` : `All ${gear.length} accounted for · report sent to Saul`);
  };
  if (!open) {
    return (
      <div className="flex flex-col gap-3">
        <Card>
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <ClipboardList size={36} className="text-amber-600" />
            <b className="text-lg">Stock-take mode</b>
            <p className="m-0 max-w-sm text-sm text-basil-muted">Walk the store and tick each item you find on the shelf. Items checked out are accounted for by their holder.</p>
            <button type="button" className="btn-primary mt-2" onClick={start}>Start stock-take</button>
          </div>
        </Card>
        {last && (
          <Card title={`Last stock-take · ${fmtDate(last.completed_at)}`}>
            <p className="m-0 text-sm">By {nameOf(people, last.started_by)} · {last.found_ids.length} found · <b className={last.missing_ids.length ? 'text-red-700' : 'text-emerald-700'}>{last.missing_ids.length} missing</b></p>
            {last.missing_ids.map((m) => { const g = gear.find((x) => x.id === m); return g ? <div key={m} className="mt-2 flex items-center gap-2 text-sm"><GearThumb gear={g} size={32} />{g.name} <span className="font-mono text-xs text-basil-muted">{g.tag}</span></div> : null; })}
            {last.note && <p className="m-0 mt-2 text-sm text-basil-muted">{last.note}</p>}
          </Card>
        )}
      </div>
    );
  }
  const found = shelf.filter((g) => open.found_ids.includes(g.id)).length;
  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-14 z-10 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-basil-line">
        <div className="mb-2 flex items-center justify-between text-sm"><b>{found} of {shelf.length} on shelf found</b><span className="text-basil-muted">{out.length} out with crew</span></div>
        <Progress value={found} max={shelf.length} tone={found === shelf.length ? 'green' : 'blue'} />
        <div className="mt-3"><SearchBox value={q} onChange={setQ} placeholder="Type tag or serial to tick" /></div>
      </div>
      {shelf.filter((g) => matchGear(g, q)).map((g) => {
        const on = open.found_ids.includes(g.id);
        return (
          <button key={g.id} type="button" aria-pressed={on} onClick={() => toggle(g.id)} className={`flex min-h-[60px] w-full items-center gap-3 rounded-2xl border p-3 text-left ${on ? 'border-emerald-300 bg-emerald-50' : 'border-basil-line bg-white'}`}>
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${on ? 'bg-emerald-600 text-white' : 'border-2 border-basil-edge'}`}>{on && <CheckCircle2 size={18} />}</span>
            <span className="min-w-0 flex-1"><b className="block truncate">{g.name}</b><span className="text-xs text-basil-muted">{g.tag} · {g.location}</span></span>
            <GearStatusPill status={g.status} />
          </button>
        );
      })}
      <SectionHead>Out with crew · accounted for</SectionHead>
      {out.map((g) => <div key={g.id} className="flex items-center gap-3 rounded-2xl bg-basil-mist p-3 text-sm"><GearThumb gear={g} size={32} /><span className="flex-1">{g.name}</span><span className="text-basil-muted">{nameOf(people, g.holder_id)}</span></div>)}
      <button type="button" className="btn-primary w-full" onClick={finish}>Finish · {shelf.length - found} not found</button>
    </div>
  );
}

// ---------- reservations ----------
const PROJECT_COLOURS = ['#0F6EC2', '#D97706', '#7C3AED', '#0D9488', '#DB2777', '#475569', '#16A34A'];
export function ReservationsPanel() {
  const { rows: res } = useTable<Reservation>('gear_reservations', { order: 'start_date' });
  const { rows: gear } = useGear();
  const { rows: checkouts } = useCheckouts();
  const projects = useProjects();
  const people = usePeople();

  const toast = useToast();
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [adding, setAdding] = useState(false);
  const today = dayKey();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const active = res.filter((r) => r.status === 'reserved' && r.end_date >= today);
  const colour = (pid: string | null) => PROJECT_COLOURS[Math.max(0, projects.findIndex((p) => p.id === pid)) % PROJECT_COLOURS.length];
  const rowsGear = gear.filter((g) => active.some((r) => r.gear_id === g.id));
  // conflicts: two reservations for the same item overlapping, or a reservation starting before the item is due back
  const conflicts = useMemo(() => {
    const out: { gear: Gear; a: Reservation; b?: Reservation; checkout?: Checkout }[] = [];
    for (const r of active) {
      const g = gear.find((x) => x.id === r.gear_id);
      if (!g) continue;
      const { res: clash, out: co } = reservationConflicts(r.gear_id, r.start_date, r.end_date, active, checkouts, r.id);
      clash.filter((c) => c.id > r.id).forEach((b) => out.push({ gear: g, a: r, b }));
      co.filter((c) => dayKey(c.due_at) >= r.start_date).forEach((c) => out.push({ gear: g, a: r, checkout: c }));
    }
    return out;
  }, [active, gear, checkouts]);
  const clashDay = (gid: string, d: string) => active.filter((r) => r.gear_id === gid && r.start_date <= d && r.end_date >= d).length > 1;
  const cancel = (r: Reservation) => updateRow('gear_reservations', r.id, { status: 'cancelled' }).then(async () => {
    const g = gear.find((x) => x.id === r.gear_id);
    if (g?.status === 'reserved' && !active.some((x) => x.id !== r.id && x.gear_id === g.id && x.start_date <= today)) await updateRow('gear_items', g.id, { status: 'available' });
    toast('Reservation cancelled');
  });
  const swap = async (r: Reservation) => {
    const g = gear.find((x) => x.id === r.gear_id)!;
    const alt = gear.find((x) => x.id !== g.id && x.category === g.category && x.status === 'available' && !reservationConflicts(x.id, r.start_date, r.end_date, active, checkouts).res.length);
    if (!alt) return toast(`No free ${g.category.toLowerCase()} for those dates`, 'error');
    await updateRow('gear_reservations', r.id, { gear_id: alt.id, note: `${r.note} (moved from ${g.name})`.trim() });
    await notify(r.holder_id, 'Reservation moved', `${projectName(projects, r.project_id)}: ${g.name} → ${alt.name}`, '', 'info');
    toast(`Moved to ${alt.name}`);
  };
  return (
    <div className="flex flex-col gap-3">
      {conflicts.map((c, i) => (
        <div key={i} className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <b className="flex items-center gap-2"><AlertTriangle size={16} />Conflict: {c.gear.name}</b>
          {c.b ? (
            <p className="m-0 mt-1">{projectName(projects, c.a.project_id)} ({firstOf(people, c.a.holder_id)}, {fmtDay(c.a.start_date)}–{fmtDay(c.a.end_date)}) and {projectName(projects, c.b.project_id)} ({firstOf(people, c.b.holder_id)}, {fmtDay(c.b.start_date)}–{fmtDay(c.b.end_date)}) both reserved it.</p>
          ) : (
            <p className="m-0 mt-1">Reserved for {projectName(projects, c.a.project_id)} from {fmtDay(c.a.start_date)}, but still out with {firstOf(people, c.checkout!.holder_id)} until {fmtDateTime(c.checkout!.due_at)}.</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn-outline !min-h-[40px] text-sm" onClick={() => swap(c.b ?? c.a)}>Move {projectName(projects, (c.b ?? c.a).project_id).split(' ')[0]} to another {c.gear.category.toLowerCase()}</button>
            <button type="button" className="btn-outline !min-h-[40px] text-sm" onClick={() => cancel(c.b ?? c.a)}>Cancel that reservation</button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={view} onChange={setView} items={[{ value: 'calendar', label: 'Calendar' }, { value: 'list', label: 'List', count: active.length }]} />
        <button type="button" className="btn-primary" onClick={() => setAdding(true)}><CalendarDays size={16} />Reserve gear</button>
      </div>
      {view === 'calendar' ? (
        <div className="overflow-x-auto rounded-2xl border border-basil-line bg-white">
          <table className="w-full min-w-[720px] border-collapse text-xs">
            <thead><tr><th className="sticky left-0 z-10 bg-white p-2 text-left">Item</th>{days.map((d) => <th key={d} className={`p-1 text-center font-semibold ${d === today ? 'text-basil' : 'text-basil-muted'}`}>{fmtDay(d).split(' ').slice(0, 2).join(' ')}</th>)}</tr></thead>
            <tbody>
              {rowsGear.map((g) => (
                <tr key={g.id} className="border-t border-basil-line">
                  <td className="sticky left-0 z-10 max-w-[150px] truncate bg-white p-2 font-bold">{g.name}</td>
                  {days.map((d) => {
                    const r = active.find((x) => x.gear_id === g.id && x.start_date <= d && x.end_date >= d);
                    const clash = clashDay(g.id, d);
                    return <td key={d} className="p-0.5"><div title={r ? `${projectName(projects, r.project_id)} · ${nameOf(people, r.holder_id)}` : ''} className={`h-7 rounded ${clash ? 'bg-red-500' : ''}`} style={!clash && r ? { background: colour(r.project_id), opacity: 0.85 } : undefined} /></td>;
                  })}
                </tr>
              ))}
              {!rowsGear.length && <tr><td colSpan={15} className="p-6 text-center text-basil-muted">No reservations in the next two weeks.</td></tr>}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-3 border-t border-basil-line p-2 text-xs">{projects.filter((p) => active.some((r) => r.project_id === p.id)).map((p) => <span key={p.id} className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ background: colour(p.id) }} />{p.name}</span>)}<span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-500" />Clash</span></div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {active.map((r) => {
            const g = gear.find((x) => x.id === r.gear_id);
            return (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-basil-line bg-white p-3">
                {g && <GearThumb gear={g} />}
                <div className="min-w-0 flex-1"><b className="block truncate">{g?.name}</b><span className="text-xs text-basil-muted">{fmtDay(r.start_date)} → {fmtDay(r.end_date)} · {nameOf(people, r.holder_id)} · {projectName(projects, r.project_id)}</span></div>
                <button type="button" aria-label="Cancel reservation" className="flex h-11 w-11 items-center justify-center rounded-xl border border-basil-edge bg-white text-red-700" onClick={() => cancel(r)}><Trash2 size={16} /></button>
              </div>
            );
          })}
          {!active.length && <EmptyBox>No upcoming reservations.</EmptyBox>}
        </div>
      )}
      <ReserveSheet open={adding} onClose={() => setAdding(false)} res={active} checkouts={checkouts} />
    </div>
  );
}
const firstOf = (people: ReturnType<typeof usePeople>, id: string) => nameOf(people, id).split(' ')[0];

function ReserveSheet({ open, onClose, res, checkouts }: { open: boolean; onClose: () => void; res: Reservation[]; checkouts: Checkout[] }) {
  const { rows: gear } = useGear();
  const { userId } = useActing();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [f, setF] = useState({ gear_id: '', project_id: '', holder_id: userId, start_date: addDays(dayKey(), 1), end_date: addDays(dayKey(), 2), note: '' });
  const c = f.gear_id ? reservationConflicts(f.gear_id, f.start_date, f.end_date, res, checkouts) : { res: [], out: [] };
  const save = async () => {
    if (!f.gear_id || !f.holder_id) return toast('Pick the item and who it is for', 'error');
    try {
      await reserveGear({ ...f, project_id: f.project_id || null }, res, checkouts);
      toast('Reserved');
      onClose();
    } catch (e) {
      err(toast)(e);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Reserve gear">
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="From"><input className={inputCls} type="date" min={dayKey()} value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value, end_date: e.target.value > f.end_date ? e.target.value : f.end_date })} /></Field>
          <Field label="To"><input className={inputCls} type="date" min={f.start_date} value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></Field>
        </div>
        <SearchBox value={q} onChange={setQ} />
        <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
          {gear.filter((g) => matchGear(g, q) && g.status !== 'out_of_service').map((g) => {
            const busy = reservationConflicts(g.id, f.start_date, f.end_date, res, checkouts).res.length > 0;
            return (
              <button key={g.id} type="button" aria-pressed={f.gear_id === g.id} onClick={() => setF({ ...f, gear_id: g.id })} className={`flex min-h-[48px] items-center gap-2 rounded-xl border px-3 text-left text-sm ${f.gear_id === g.id ? 'border-amber-500 bg-amber-50' : 'border-basil-line bg-white'}`}>
                <span className="flex-1 truncate"><b>{g.name}</b> <span className="text-basil-muted">{g.tag}</span></span>
                {busy ? <Pill tone="red">Booked</Pill> : <Pill tone="green">Free</Pill>}
              </button>
            );
          })}
        </div>
        {c.res.length > 0 && <p className="m-0 rounded-xl bg-red-50 p-3 text-sm text-red-800">Clash: already reserved {fmtDay(c.res[0].start_date)}–{fmtDay(c.res[0].end_date)}. Pick other dates or another item.</p>}
        {c.out.length > 0 && <p className="m-0 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Heads up: currently out, due back {fmtDateTime(c.out[0].due_at)}.</p>}
        <Field label="For"><PersonSelect value={f.holder_id} onChange={(v) => setF({ ...f, holder_id: v })} /></Field>
        <Field label="Project"><ProjectSelect value={f.project_id} onChange={(v) => setF({ ...f, project_id: v })} /></Field>
        <Field label="Note"><input className={inputCls} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <button type="button" className="btn-primary w-full" disabled={c.res.length > 0} onClick={save}>Reserve</button>
      </div>
    </Sheet>
  );
}

