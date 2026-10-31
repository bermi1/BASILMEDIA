// Transport & crew logistics: vehicles, trips (Scheduled → Returned), fuel log with cost per project.
import { useState } from 'react';
import { AlertTriangle, Car, Fuel, MapPin, Navigation, Plus } from 'lucide-react';
import { insertRow, usePeople, useTable } from '@/os/lib/store';
import { notify } from '@/os/lib/notify';
import { useActing } from '@/os/lib/session';
import { useToast } from '@/os/cms/toast';
import { Card, Field, Pill, Sheet, StageTracker, Stat, inputCls, tsh, tshShort } from '@/os/ui';
import { TRIP_STAGES, dayKey, fmtDate, fmtDateTime, fmtTime, fromLocalInput, toLocalInput, type FuelLog, type Trip, type Vehicle, type VehicleIssue } from './data';
import { advanceTrip } from './actions';
import { EmptyBox, PersonSelect, ProjectSelect, SectionHead, nameOf, projectName, useProjects } from './shared';

const errT = (toast: ReturnType<typeof useToast>) => (e: unknown) => toast((e as Error).message ?? String(e), 'error');
const V_STATUS: Record<Vehicle['status'], { label: string; tone: 'green' | 'blue' | 'amber' | 'red' }> = {
  available: { label: 'Available', tone: 'green' }, on_trip: { label: 'On a trip', tone: 'blue' }, in_service: { label: 'In service', tone: 'amber' }, out_of_service: { label: 'Out of service', tone: 'red' },
};
const NEXT_LABEL: Record<string, string> = { Dispatched: 'Leaving now', Arrived: 'Arrived', Delivered: 'Crew & gear delivered', Returned: 'Back at base' };

function useTrips(mineOnly: boolean) {
  const { userId, can } = useActing();
  const all = useTable<Trip>('trips', { order: 'depart_at' }).rows;
  return mineOnly || !can('gm_cfo', 'boss') ? all.filter((t) => t.driver_id === userId) : all;
}

function TripCard({ t, onOpen }: { t: Trip; onOpen?: () => void }) {
  const { rows: vehicles } = useTable<Vehicle>('vehicles');
  const projects = useProjects();
  const people = usePeople();
  const v = vehicles.find((x) => x.id === t.vehicle_id);
  const C = onOpen ? 'button' : 'div';
  return (
    <C type={onOpen ? 'button' : undefined} onClick={onOpen} className="w-full rounded-2xl border border-basil-line bg-white p-4 text-left">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0"><b className="block">{t.purpose}</b><span className="text-xs text-basil-muted">{projectName(projects, t.project_id)} · {v?.registration} · {nameOf(people, t.driver_id)}</span></span>
        <Pill tone={t.stage === 'Returned' ? 'green' : t.stage === 'Scheduled' ? 'amber' : 'blue'}>{t.stage}</Pill>
      </div>
      <p className="m-0 mt-2 flex items-center gap-1.5 text-sm"><MapPin size={14} className="shrink-0 text-basil-muted" />{t.origin} → <b>{t.destination}</b></p>
      <p className="m-0 text-xs text-basil-muted">{fmtDateTime(t.depart_at)}{t.passengers && ` · ${t.passengers}`}{t.cargo && ` · ${t.cargo}`}</p>
      <div className="mt-3"><StageTracker stages={[...TRIP_STAGES]} current={t.stage === 'Returned' ? TRIP_STAGES.length : TRIP_STAGES.indexOf(t.stage)} meta={TRIP_STAGES.map((s) => { const l = t.stage_log.find((x) => x.stage === s); return l ? fmtTime(l.at) : undefined; })} /></div>
    </C>
  );
}

export function TripsList({ onOpen }: { onOpen?: (t: Trip) => void }) {
  const trips = useTrips(false);
  const { can } = useActing();
  const [adding, setAdding] = useState(false);
  const active = trips.filter((t) => t.stage !== 'Returned');
  return (
    <div className="flex flex-col gap-3">
      {can('gm_cfo', 'boss') && <button type="button" className="btn-primary self-start" onClick={() => setAdding(true)}><Plus size={16} />Schedule trip</button>}
      {active.map((t) => <TripCard key={t.id} t={t} onOpen={onOpen ? () => onOpen(t) : undefined} />)}
      {!active.length && <EmptyBox>No trips scheduled.</EmptyBox>}
      <NewTripSheet open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

export function TripHistory() {
  const trips = useTrips(false).filter((t) => t.stage === 'Returned').reverse();
  return <div className="flex flex-col gap-3">{trips.map((t) => <TripCard key={t.id} t={t} />)}{!trips.length && <EmptyBox>No completed trips yet.</EmptyBox>}</div>;
}

/** Driver's current trip with big status buttons. */
export function CurrentTrip() {
  const trips = useTrips(true).filter((t) => t.stage !== 'Returned');
  const { userId } = useActing();
  const toast = useToast();
  const [issue, setIssue] = useState('');
  const t = trips.find((x) => x.stage !== 'Scheduled') ?? trips.find((x) => dayKey(x.depart_at) <= dayKey()) ?? trips[0];
  if (!t) return <EmptyBox>No trip assigned. Enjoy the break.</EmptyBox>;
  const next = TRIP_STAGES[TRIP_STAGES.indexOf(t.stage) + 1];
  return (
    <div className="flex flex-col gap-3">
      <TripCard t={t} />
      <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${t.destination}, Dar es Salaam`)}`} target="_blank" rel="noreferrer" className="btn-outline w-full"><Navigation size={18} />Directions to {t.destination.split(',')[0]}</a>
      {next && (
        <button type="button" onClick={() => advanceTrip(t, next, userId).then(() => toast(`${next} · office notified`)).catch(errT(toast))} className="flex min-h-[88px] w-full flex-col items-center justify-center rounded-3xl border-0 bg-slate-700 text-white shadow-lg active:scale-[0.99]">
          <span className="font-display text-2xl font-extrabold">{NEXT_LABEL[next]}</span>
          <span className="text-sm opacity-80">Mark trip “{next}”</span>
        </button>
      )}
      <div className="grid grid-cols-4 gap-1.5">
        {TRIP_STAGES.map((s, i) => <div key={s} className={`rounded-xl p-2 text-center text-[11px] font-bold ${i <= TRIP_STAGES.indexOf(t.stage) ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-basil-muted'} ${s === 'Scheduled' ? 'hidden' : ''}`}>{s}</div>)}
      </div>
      <Card title="Problem on the road?">
        <div className="flex flex-col gap-2">
          <textarea className={`${inputCls} h-20 py-2`} value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="Traffic at Selander bridge, flat tyre, client late…" aria-label="Describe the problem" />
          <button type="button" className="btn-outline w-full" onClick={() => issue.trim() && notify('u-gm', `Trip delay · ${t.destination}`, issue, '/os/transport', 'alert').then(() => notify(t.project_id ? 'u-enock' : 'u-gm', `Driver update · ${t.purpose}`, issue, '', 'alert')).then(() => (setIssue(''), toast('Office and project lead told')))}><AlertTriangle size={16} />Send update</button>
        </div>
      </Card>
    </div>
  );
}

function NewTripSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { rows: vehicles } = useTable<Vehicle>('vehicles');
  const { userId } = useActing();
  const toast = useToast();
  const [f, setF] = useState({ vehicle_id: '', driver_id: 'u-driver', project_id: '', purpose: '', origin: 'Basil Media, Mikocheni', destination: '', depart_at: new Date(Date.now() + 864e5).toISOString(), passengers: '', cargo: '' });
  const save = async () => {
    if (!f.vehicle_id || !f.destination || !f.driver_id) return toast('Vehicle, driver and destination required', 'error');
    await insertRow('trips', { ...f, project_id: f.project_id || null, return_at: null, stage: 'Scheduled', stage_log: [{ stage: 'Scheduled', at: new Date().toISOString(), by: userId }], issue_note: '' });
    await notify(f.driver_id, 'New trip scheduled', `${f.purpose} · ${fmtDateTime(f.depart_at)} → ${f.destination}`, '/app', 'task');
    toast('Trip scheduled · driver notified');
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Schedule a trip">
      <div className="flex flex-col gap-3">
        <Field label="Vehicle"><select className={inputCls} value={f.vehicle_id} onChange={(e) => setF({ ...f, vehicle_id: e.target.value })}><option value="">Choose…</option>{vehicles.map((v) => <option key={v.id} value={v.id} disabled={v.status === 'out_of_service'}>{v.registration} · {v.make_model} ({V_STATUS[v.status].label})</option>)}</select></Field>
        <Field label="Driver"><PersonSelect value={f.driver_id} onChange={(v) => setF({ ...f, driver_id: v })} /></Field>
        <Field label="Project"><ProjectSelect value={f.project_id} onChange={(v) => setF({ ...f, project_id: v })} /></Field>
        <Field label="Purpose"><input className={inputCls} value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From"><input className={inputCls} value={f.origin} onChange={(e) => setF({ ...f, origin: e.target.value })} /></Field>
          <Field label="To"><input className={inputCls} value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value })} /></Field>
        </div>
        <Field label="Depart"><input className={inputCls} type="datetime-local" value={toLocalInput(f.depart_at)} onChange={(e) => e.target.value && setF({ ...f, depart_at: fromLocalInput(e.target.value) })} /></Field>
        <Field label="Passengers"><input className={inputCls} value={f.passengers} onChange={(e) => setF({ ...f, passengers: e.target.value })} /></Field>
        <Field label="Cargo / gear"><input className={inputCls} value={f.cargo} onChange={(e) => setF({ ...f, cargo: e.target.value })} /></Field>
        <button type="button" className="btn-primary w-full" onClick={save}>Schedule</button>
      </div>
    </Sheet>
  );
}

/** Vehicles, fuel log and issue reporting. */
export function VehiclePanel() {
  const { rows: vehicles } = useTable<Vehicle>('vehicles');
  const { rows: fuel } = useTable<FuelLog>('fuel_logs', { order: 'date', ascending: false });
  const { rows: issues } = useTable<VehicleIssue>('vehicle_issues', { order: 'created_at', ascending: false });
  const trips = useTrips(false);
  const projects = useProjects();
  const { userId } = useActing();
  const toast = useToast();
  const [fuelFor, setFuelFor] = useState<Vehicle | null>(null);
  const [issueFor, setIssueFor] = useState<Vehicle | null>(null);
  const [ff, setFf] = useState({ litres: 0, cost: 0, odometer: 0, station: '', trip_id: '' });
  const [iss, setIss] = useState({ description: '', severity: 'medium' });
  const today = dayKey();
  const expiry = (d: string | null) => (!d ? <Pill tone="grey">—</Pill> : d < today ? <Pill tone="red">Expired {fmtDate(d)}</Pill> : d <= new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10) ? <Pill tone="amber">{fmtDate(d)}</Pill> : <Pill tone="green">{fmtDate(d)}</Pill>);
  const byProject = projects.map((p) => ({ p, cost: fuel.filter((f) => f.project_id === p.id).reduce((s, f) => s + f.cost, 0) })).filter((x) => x.cost > 0);
  const saveFuel = async () => {
    if (!(ff.litres > 0 && ff.cost > 0)) return toast('Litres and cost are required', 'error');
    const trip = trips.find((t) => t.id === ff.trip_id);
    await insertRow('fuel_logs', { vehicle_id: fuelFor!.id, trip_id: ff.trip_id || null, project_id: trip?.project_id ?? null, driver_id: userId, date: today, litres: ff.litres, cost: ff.cost, odometer: ff.odometer, station: ff.station, receipt_url: '' });
    toast(`Fuel logged · ${tsh(ff.cost)}${trip?.project_id ? ` to ${projectName(projects, trip.project_id)}` : ''}`);
    setFuelFor(null);
  };
  const saveIssue = async () => {
    if (!iss.description.trim()) return toast('Describe the issue', 'error');
    await insertRow('vehicle_issues', { vehicle_id: issueFor!.id, reported_by: userId, description: iss.description, severity: iss.severity, status: 'open' });
    await notify('u-gm', `Vehicle issue · ${issueFor!.registration}`, iss.description, '/os/transport', 'alert');
    toast('Reported to Saul (GM/CFO)');
    setIssueFor(null);
  };
  return (
    <div className="flex flex-col gap-4">
      {vehicles.map((v) => (
        <div key={v.id} className="rounded-2xl border border-basil-line bg-white p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><Car size={24} /></span>
            <span className="min-w-0 flex-1"><b className="block font-mono text-lg">{v.registration}</b><span className="text-xs text-basil-muted">{v.make_model} · {v.seats} seats · {v.odometer.toLocaleString('en-GB')} km</span></span>
            <Pill tone={V_STATUS[v.status].tone}>{V_STATUS[v.status].label}</Pill>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><span>Insurance<br />{expiry(v.insurance_expiry)}</span><span>Inspection<br />{expiry(v.inspection_expiry)}</span></div>
          {issues.filter((i) => i.vehicle_id === v.id && i.status === 'open').map((i) => <p key={i.id} className="m-0 mt-2 rounded-xl bg-amber-50 p-2 text-xs text-amber-900"><AlertTriangle size={12} className="inline" /> {i.description}</p>)}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className="btn-outline !px-2" onClick={() => (setFuelFor(v), setFf({ litres: 0, cost: 0, odometer: v.odometer, station: '', trip_id: trips.find((t) => t.vehicle_id === v.id && t.stage !== 'Returned')?.id ?? '' }))}><Fuel size={16} />Log fuel</button>
            <button type="button" className="btn-outline !px-2" onClick={() => (setIssueFor(v), setIss({ description: '', severity: 'medium' }))}><AlertTriangle size={16} />Report issue</button>
          </div>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Fuel this month" value={tshShort(fuel.filter((f) => f.date.slice(0, 7) === today.slice(0, 7)).reduce((s, f) => s + f.cost, 0))} />
        <Stat label="Litres this month" value={fuel.filter((f) => f.date.slice(0, 7) === today.slice(0, 7)).reduce((s, f) => s + f.litres, 0)} />
      </div>
      <section><SectionHead>Fuel cost per project</SectionHead>
        <div className="flex flex-col gap-1.5">{byProject.map(({ p, cost }) => <div key={p.id} className="flex justify-between rounded-xl bg-white p-3 text-sm"><span>{p.name}</span><b>{tsh(cost)}</b></div>)}</div>
      </section>
      <section><SectionHead>Fuel log</SectionHead>
        <div className="flex flex-col gap-1.5">{fuel.map((f) => <div key={f.id} className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 text-sm"><span className="min-w-0"><b>{vehicles.find((v) => v.id === f.vehicle_id)?.registration}</b> · {f.litres} L · {f.station}<br /><span className="text-xs text-basil-muted">{fmtDate(f.date)} · {projectName(projects, f.project_id)}</span></span><b className="shrink-0">{tsh(f.cost)}</b></div>)}</div>
      </section>
      <Sheet open={!!fuelFor} onClose={() => setFuelFor(null)} title={`Fuel · ${fuelFor?.registration ?? ''}`}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Litres"><input className={inputCls} type="number" inputMode="decimal" value={ff.litres || ''} onChange={(e) => setFf({ ...ff, litres: Number(e.target.value), cost: ff.cost || Math.round(Number(e.target.value) * 3240) })} /></Field>
          <Field label="Cost (TSH)"><input className={inputCls} type="number" inputMode="numeric" value={ff.cost || ''} onChange={(e) => setFf({ ...ff, cost: Number(e.target.value) })} /></Field>
          <Field label="Odometer (km)"><input className={inputCls} type="number" value={ff.odometer || ''} onChange={(e) => setFf({ ...ff, odometer: Number(e.target.value) })} /></Field>
          <Field label="Station"><input className={inputCls} value={ff.station} onChange={(e) => setFf({ ...ff, station: e.target.value })} placeholder="Puma, Mikocheni" /></Field>
          <div className="col-span-2"><Field label="Trip (charges the project)"><select className={inputCls} value={ff.trip_id} onChange={(e) => setFf({ ...ff, trip_id: e.target.value })}><option value="">No trip · office use</option>{trips.filter((t) => t.vehicle_id === fuelFor?.id).slice(-6).map((t) => <option key={t.id} value={t.id}>{t.purpose} · {fmtDate(t.depart_at)}</option>)}</select></Field></div>
          <button type="button" className="btn-primary col-span-2" onClick={saveFuel}>Save</button>
        </div>
      </Sheet>
      <Sheet open={!!issueFor} onClose={() => setIssueFor(null)} title={`Report issue · ${issueFor?.registration ?? ''}`}>
        <div className="flex flex-col gap-3">
          <Field label="What is wrong"><textarea className={`${inputCls} h-24 py-2`} value={iss.description} onChange={(e) => setIss({ ...iss, description: e.target.value })} /></Field>
          <div className="flex gap-2">{['low', 'medium', 'high'].map((s) => <button key={s} type="button" aria-pressed={iss.severity === s} onClick={() => setIss({ ...iss, severity: s })} className={`min-h-[44px] flex-1 rounded-xl text-sm font-bold capitalize ${iss.severity === s ? 'border-0 bg-slate-700 text-white' : 'border border-basil-edge bg-white'}`}>{s}</button>)}</div>
          <button type="button" className="btn-primary w-full" onClick={saveIssue}>Send report</button>
        </div>
      </Sheet>
    </div>
  );
}

