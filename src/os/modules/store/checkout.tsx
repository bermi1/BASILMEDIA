// Check-out flow (single items or kits with packing checklist), returns, and the "who has it now" board.
import { useMemo, useState } from 'react';
import { ArrowLeft, Bell, Boxes, Check, CheckCircle2, ChevronRight, ClipboardCheck, Clock, PackageCheck, Plus, Send } from 'lucide-react';
import { insertRow, usePeople, useTable } from '@/os/lib/store';
import { notify } from '@/os/lib/notify';
import { useActing } from '@/os/lib/session';
import { useToast } from '@/os/cms/toast';
import { Avatar, Field, Pill, Progress, Sheet, inputCls } from '@/os/ui';
import {
  CONDITIONS, addDays, dayKey, fmtDateTime, fromLocalInput, isDueToday, isOverdue, lateText, toLocalInput,
  type Checkout, type Kit, type KitCheckout, type KitLine,
} from './data';
import { acknowledgeCheckouts, checkoutGear, confirmKitOut, decideExtension, kitCheckin, saveChecklist, startKitCheckout } from './actions';
import { CheckinSheet } from './ops';
import { Chip, EmptyBox, GearStatusPill, GearThumb, PhotoField, ProjectSelect, SearchBox, SectionHead, firstName, matchGear, nameOf, projectName, useCheckouts, useGear, useProjects } from './shared';

const at18 = (offset: number) => new Date(`${addDays(dayKey(), offset)}T18:00:00+03:00`).toISOString();
const errMsg = (e: unknown) => (e as Error).message ?? String(e);

function PeoplePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const people = usePeople().filter((p) => !p.roles.includes('client') && !p.roles.includes('storekeeper'));
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {people.map((p) => (
        <button key={p.id} type="button" aria-pressed={value === p.id} onClick={() => onChange(p.id)} className={`flex min-h-[52px] items-center gap-2 rounded-2xl border p-2 text-left text-sm font-bold ${value === p.id ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-300' : 'border-basil-line bg-white'}`}>
          <Avatar name={p.full_name} size={32} /><span className="min-w-0 truncate">{p.full_name}</span>
        </button>
      ))}
    </div>
  );
}

function DuePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opts = [{ l: 'Today 18:00', v: at18(0) }, { l: 'Tomorrow 18:00', v: at18(1) }, { l: 'In 3 days', v: at18(3) }, { l: 'In a week', v: at18(7) }].filter((o) => new Date(o.v).getTime() > Date.now());
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">{opts.map((o) => <Chip key={o.l} on={value === o.v} onClick={() => onChange(o.v)}>{o.l}</Chip>)}</div>
      <input aria-label="Return by (custom)" className={inputCls} type="datetime-local" value={toLocalInput(value)} onChange={(e) => e.target.value && onChange(fromLocalInput(e.target.value))} />
    </div>
  );
}

const Steps = ({ n, of }: { n: number; of: number }) => (
  <div className="mb-4 flex gap-1.5" aria-label={`Step ${n + 1} of ${of}`}>{Array.from({ length: of }, (_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= n ? 'bg-amber-500' : 'bg-basil-line'}`} />)}</div>
);

// ---------- guided check-out ----------
export function CheckoutFlow({ initialGear }: { initialGear?: string }) {
  const [mode, setMode] = useState<'items' | 'kit' | null>(initialGear ? 'items' : null);
  if (!mode) {
    return (
      <div className="flex flex-col gap-3">
        <p className="m-0 text-sm text-basil-muted">What is going out?</p>
        <button type="button" onClick={() => setMode('items')} className="flex min-h-[84px] items-center gap-4 rounded-3xl border border-basil-line bg-white p-4 text-left">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><PackageCheck size={24} /></span>
          <span className="flex-1"><b className="block text-lg">Single items</b><span className="text-sm text-basil-muted">Pick cameras, lenses, lights… one by one</span></span><ChevronRight className="text-basil-muted" />
        </button>
        <button type="button" onClick={() => setMode('kit')} className="flex min-h-[84px] items-center gap-4 rounded-3xl border border-basil-line bg-white p-4 text-left">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><Boxes size={24} /></span>
          <span className="flex-1"><b className="block text-lg">A kit</b><span className="text-sm text-basil-muted">Interview, Event Photo or Documentary — with packing checklist</span></span><ChevronRight className="text-basil-muted" />
        </button>
      </div>
    );
  }
  return mode === 'items' ? <ItemsFlow initialGear={initialGear} onBack={() => setMode(null)} /> : <KitFlow onBack={() => setMode(null)} />;
}

function ItemsFlow({ initialGear, onBack }: { initialGear?: string; onBack: () => void }) {
  const { rows: gear } = useGear();
  const people = usePeople();
  const projects = useProjects();
  const { userId } = useActing();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string[]>(initialGear ? [initialGear] : []);
  const [holder, setHolder] = useState('');
  const [project, setProject] = useState('');
  const [due, setDue] = useState(at18(1));
  const [cond, setCond] = useState('Good');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState('');
  const [ackNow, setAckNow] = useState(true);
  const [done, setDone] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const free = gear.filter((g) => (g.status === 'available' || g.status === 'reserved') && matchGear(g, q));
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const submit = async () => {
    setBusy(true);
    try {
      const ids = await checkoutGear({ gear_ids: sel, holder_id: holder, project_id: project || null, due_at: due, condition: cond, note, photo_url: photo }, userId);
      if (ackNow && ids?.length) await acknowledgeCheckouts(ids);
      setDone(ids ?? []);
      toast(`${sel.length} item${sel.length > 1 ? 's' : ''} checked out to ${firstName(people, holder)}`);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-white p-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 size={34} /></span>
        <b className="text-xl">Handed over</b>
        <p className="m-0 text-sm text-basil-muted">{nameOf(people, holder)} is responsible until {fmtDateTime(due)}.{!ackNow && ' A request to accept was sent to their phone.'}</p>
        <button type="button" className="btn-primary w-full" onClick={() => { setDone(null); setSel([]); setStep(0); setHolder(''); setNote(''); setPhoto(''); }}>Check out more</button>
      </div>
    );
  }
  const chosen = gear.filter((g) => sel.includes(g.id));
  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={() => (step ? setStep(step - 1) : onBack())} className="flex items-center gap-1 self-start border-0 bg-transparent p-0 text-sm font-bold text-basil"><ArrowLeft size={16} />Back</button>
      <Steps n={step} of={4} />
      {step === 0 && (
        <>
          <h2 className="m-0 text-lg font-extrabold">1 · What is going out?</h2>
          <SearchBox value={q} onChange={setQ} />
          <div className="flex flex-col gap-2">
            {free.map((g) => (
              <button key={g.id} type="button" aria-pressed={sel.includes(g.id)} onClick={() => toggle(g.id)} className={`flex min-h-[60px] items-center gap-3 rounded-2xl border p-3 text-left ${sel.includes(g.id) ? 'border-amber-500 bg-amber-50' : 'border-basil-line bg-white'}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${sel.includes(g.id) ? 'bg-amber-600 text-white' : 'border-2 border-basil-edge'}`}>{sel.includes(g.id) && <Check size={16} />}</span>
                <GearThumb gear={g} size={36} />
                <span className="min-w-0 flex-1"><b className="block truncate">{g.name}</b><span className="text-xs text-basil-muted">{g.tag} · {g.location}</span></span>
                {g.status === 'reserved' && <Pill tone="amber">Reserved</Pill>}
              </button>
            ))}
            {!free.length && <EmptyBox>Nothing available matches “{q}”.</EmptyBox>}
          </div>
          <div className="sticky bottom-24 z-10"><button type="button" className="btn-primary w-full" disabled={!sel.length} onClick={() => setStep(1)}>Next · {sel.length} selected</button></div>
        </>
      )}
      {step === 1 && (
        <>
          <h2 className="m-0 text-lg font-extrabold">2 · Who is taking it, for which project?</h2>
          <PeoplePicker value={holder} onChange={setHolder} />
          <Field label="Project"><ProjectSelect value={project} onChange={setProject} /></Field>
          <Field label="Return by"><DuePicker value={due} onChange={setDue} /></Field>
          <button type="button" className="btn-primary w-full" disabled={!holder} onClick={() => setStep(2)}>Next</button>
        </>
      )}
      {step === 2 && (
        <>
          <h2 className="m-0 text-lg font-extrabold">3 · Condition going out</h2>
          <div className="flex flex-wrap gap-2">{CONDITIONS.filter((c) => c !== 'Damaged').map((c) => <Chip key={c} on={cond === c} onClick={() => setCond(c)}>{c}</Chip>)}</div>
          <Field label="Note (scratches, missing caps…)"><textarea className={`${inputCls} h-20 py-2`} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <PhotoField value={photo} onChange={setPhoto} />
          <button type="button" className="btn-primary w-full" onClick={() => setStep(3)}>Next</button>
        </>
      )}
      {step === 3 && (
        <>
          <h2 className="m-0 text-lg font-extrabold">4 · Hand over</h2>
          <div className="rounded-2xl border border-basil-line bg-white p-3">
            {chosen.map((g) => <div key={g.id} className="flex items-center gap-2 border-b border-basil-line py-2 text-sm last:border-0"><GearThumb gear={g} size={28} /><span className="flex-1">{g.name}</span><span className="font-mono text-xs text-basil-muted">{g.tag}</span></div>)}
            <p className="m-0 mt-2 text-sm">To <b>{nameOf(people, holder)}</b> · {projectName(projects, project)} · back by <b>{fmtDateTime(due)}</b> · condition {cond}</p>
          </div>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-1 text-sm font-bold text-[#33465F]">Borrower acknowledgement</legend>
            <label className="flex min-h-[48px] items-start gap-3 rounded-2xl border border-basil-line bg-white p-3 text-sm"><input type="radio" className="mt-0.5 h-5 w-5" checked={ackNow} onChange={() => setAckNow(true)} /><span>{firstName(people, holder)} is here and confirms receiving these items in the condition above and is responsible until they are checked in.</span></label>
            <label className="flex min-h-[48px] items-start gap-3 rounded-2xl border border-basil-line bg-white p-3 text-sm"><input type="radio" className="mt-0.5 h-5 w-5" checked={!ackNow} onChange={() => setAckNow(false)} /><span>Send to {firstName(people, holder)}’s Basil Media app to accept.</span></label>
          </fieldset>
          <button type="button" className="btn-primary w-full" disabled={busy} onClick={submit}>{busy ? 'Saving…' : `Check out ${sel.length} item${sel.length > 1 ? 's' : ''}`}</button>
        </>
      )}
    </div>
  );
}

function KitFlow({ onBack }: { onBack: () => void }) {
  const { rows: kits } = useTable<Kit>('gear_kits', { order: 'name' });
  const { rows: gear } = useGear();
  const { userId } = useActing();
  const toast = useToast();
  const [kit, setKit] = useState<Kit | null>(null);
  const [holder, setHolder] = useState('');
  const [project, setProject] = useState('');
  const [due, setDue] = useState(at18(1));
  const [packing, setPacking] = useState<KitCheckout | null>(null);
  const names = Object.fromEntries(gear.map((g) => [g.id, g.name]));
  if (packing) return <KitChecklist kc={packing} mode="out" onDone={() => { setPacking(null); setKit(null); onBack(); }} />;
  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={() => (kit ? setKit(null) : onBack())} className="flex items-center gap-1 self-start border-0 bg-transparent p-0 text-sm font-bold text-basil"><ArrowLeft size={16} />Back</button>
      {!kit ? (
        <>
          <h2 className="m-0 text-lg font-extrabold">Choose a kit</h2>
          {kits.map((k) => {
            const avail = k.gear_ids.filter((id) => ['available', 'reserved'].includes(gear.find((g) => g.id === id)?.status ?? '')).length;
            return (
              <button key={k.id} type="button" onClick={() => setKit(k)} className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-basil-line bg-white p-4 text-left">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Boxes size={22} /></span>
                <span className="min-w-0 flex-1"><b className="block">{k.name}</b><span className="text-xs text-basil-muted">{k.code} · {k.gear_ids.length} items + {k.extras.length} extras</span></span>
                <Pill tone={avail === k.gear_ids.length ? 'green' : 'amber'}>{avail}/{k.gear_ids.length} free</Pill>
              </button>
            );
          })}
        </>
      ) : (
        <>
          <h2 className="m-0 text-lg font-extrabold">{kit.name}</h2>
          <p className="m-0 text-sm text-basil-muted">{kit.description}</p>
          <Field label="Who is taking it"><PeoplePicker value={holder} onChange={setHolder} /></Field>
          <Field label="Project"><ProjectSelect value={project} onChange={setProject} /></Field>
          <Field label="Return by"><DuePicker value={due} onChange={setDue} /></Field>
          <button type="button" className="btn-primary w-full" disabled={!holder} onClick={() => startKitCheckout(kit, names, holder, project || null, due, userId).then((kc) => (setPacking(kc), toast('Packing list ready'))).catch((e) => toast(errMsg(e), 'error'))}>Start packing list</button>
        </>
      )}
    </div>
  );
}

/** Packing checklist: tick out when packing, tick in on return. */
export function KitChecklist({ kc, mode, onDone }: { kc: KitCheckout; mode: 'out' | 'in'; onDone: () => void }) {
  const { rows: kits } = useTable<Kit>('gear_kits');
  const { rows: gear } = useGear();
  const { rows: checkouts } = useCheckouts();
  const people = usePeople();
  const projects = useProjects();
  const { userId } = useActing();
  const toast = useToast();
  const [lines, setLines] = useState<KitLine[]>(kc.checklist);
  const [cond, setCond] = useState('Good');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState('');
  const [busy, setBusy] = useState(false);
  const kit = kits.find((k) => k.id === kc.kit_id);
  const relevant = mode === 'out' ? lines : lines.filter((l) => l.out);
  const ticked = relevant.filter((l) => (mode === 'out' ? l.out : l.in)).length;
  const blocked = (l: KitLine) => mode === 'out' && !!l.gear_id && !['available', 'reserved'].includes(gear.find((g) => g.id === l.gear_id)?.status ?? '');
  const tick = (key: string) => {
    const next = lines.map((l) => (l.key === key ? { ...l, [mode]: !l[mode] } : l));
    setLines(next);
    saveChecklist(kc, next).catch(() => undefined);
  };
  const tickAll = () => {
    const next = lines.map((l) => (blocked(l) || (mode === 'in' && !l.out) ? l : { ...l, [mode]: true }));
    setLines(next);
    saveChecklist(kc, next).catch(() => undefined);
  };
  const confirm = async () => {
    setBusy(true);
    try {
      if (mode === 'out') {
        await confirmKitOut(kc, lines, cond, note, photo, userId);
        toast(`${kit?.name} out · ${ticked} lines packed · list sent to ${firstName(people, kc.holder_id)}`);
      } else {
        const all = await kitCheckin(kc, lines, checkouts, cond, note, userId);
        toast(all ? 'Kit fully returned · Asante' : 'Partial return saved — missing lines stay open');
      }
      onDone();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={onDone} className="flex items-center gap-1 self-start border-0 bg-transparent p-0 text-sm font-bold text-basil"><ArrowLeft size={16} />Back</button>
      <div className="rounded-3xl bg-gradient-to-br from-amber-600 to-amber-700 p-4 text-white">
        <span className="font-mono text-[11px] tracking-widest opacity-80">KIT · {kit?.code} · {mode === 'out' ? 'PACKING OUT' : 'CHECK IN'}</span>
        <b className="mt-1 block text-xl">{kit?.name}</b>
        <span className="text-sm opacity-90">{projectName(projects, kc.project_id)} · {nameOf(people, kc.holder_id)} · back {fmtDateTime(kc.due_at)}</span>
        <div className="mt-3 flex items-end justify-between"><span className="font-display text-3xl font-extrabold">{ticked} of {relevant.length}</span><span className="text-sm">{mode === 'out' ? 'packed' : 'returned'}</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/25"><div className="h-2 rounded-full bg-white" style={{ width: `${(ticked / Math.max(1, relevant.length)) * 100}%` }} /></div>
      </div>
      <div className="flex flex-col gap-1.5">
        {relevant.map((l) => {
          const on = mode === 'out' ? l.out : l.in;
          const g = gear.find((x) => x.id === l.gear_id);
          const b = blocked(l);
          return (
            <button key={l.key} type="button" disabled={b} aria-pressed={on} onClick={() => tick(l.key)} className={`flex min-h-[56px] items-center gap-3 rounded-2xl border p-3 text-left ${on ? 'border-emerald-300 bg-emerald-50' : b ? 'border-basil-line bg-slate-50 opacity-70' : 'border-basil-line bg-white'}`}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${on ? 'bg-emerald-600 text-white' : 'border-2 border-basil-edge'}`}>{on && <Check size={16} />}</span>
              <span className="min-w-0 flex-1"><b className="block truncate text-sm">{l.label}</b><span className="text-xs text-basil-muted">{g ? `${g.tag} · ${g.location}` : 'Extra / consumable'}</span></span>
              {b && g && <GearStatusPill status={g.status} />}
            </button>
          );
        })}
      </div>
      <button type="button" className="btn-outline w-full" onClick={tickAll}>Tick all remaining</button>
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1.5 text-sm font-bold text-[#33465F]">Condition {mode === 'out' ? 'going out' : 'on return'}</legend>
        <div className="flex flex-wrap gap-2">{CONDITIONS.map((c) => <Chip key={c} on={cond === c} onClick={() => setCond(c)}>{c}</Chip>)}</div>
      </fieldset>
      <Field label="Note"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      {mode === 'out' && <PhotoField value={photo} onChange={setPhoto} label="Kit photo (link)" />}
      <button type="button" className="btn-primary w-full" disabled={busy || !ticked} onClick={confirm}>{mode === 'out' ? `Confirm packed · hand over to ${firstName(people, kc.holder_id)}` : ticked === relevant.length ? 'Confirm full return' : `Save partial return (${relevant.length - ticked} missing)`}</button>
    </div>
  );
}

// ---------- kits overview ----------
export function KitsPanel() {
  const { rows: kits } = useTable<Kit>('gear_kits', { order: 'name' });
  const { rows: kcs } = useTable<KitCheckout>('kit_checkouts', { order: 'created_at', ascending: false });
  const { rows: gear } = useGear();
  const people = usePeople();
  const toast = useToast();
  const [open, setOpen] = useState<{ kc: KitCheckout; mode: 'out' | 'in' } | null>(null);
  const [creating, setCreating] = useState(false);
  const [nk, setNk] = useState({ name: '', code: '', description: '', gear_ids: [] as string[], extras: '' });
  if (open) return <KitChecklist kc={open.kc} mode={open.mode} onDone={() => setOpen(null)} />;
  const live = kcs.filter((k) => k.status !== 'returned');
  return (
    <div className="flex flex-col gap-3">
      {live.length > 0 && <SectionHead>Kits in motion</SectionHead>}
      {live.map((kc) => {
        const k = kits.find((x) => x.id === kc.kit_id);
        const rel = kc.status === 'packing' ? kc.checklist : kc.checklist.filter((l) => l.out);
        const n = rel.filter((l) => (kc.status === 'packing' ? l.out : l.in)).length;
        return (
          <button key={kc.id} type="button" onClick={() => setOpen({ kc, mode: kc.status === 'packing' ? 'out' : 'in' })} className="rounded-2xl border border-basil-line bg-white p-4 text-left">
            <div className="flex items-center justify-between gap-2"><b>{k?.name}</b><Pill tone={kc.status === 'packing' ? 'amber' : isOverdue({ status: 'out', due_at: kc.due_at }) ? 'red' : 'blue'}>{kc.status === 'packing' ? 'Packing' : isOverdue({ status: 'out', due_at: kc.due_at }) ? lateText(kc.due_at) : 'Out'}</Pill></div>
            <span className="text-xs text-basil-muted">{nameOf(people, kc.holder_id)} · back {fmtDateTime(kc.due_at)}</span>
            <div className="mt-2"><Progress value={n} max={rel.length} tone="blue" /></div>
            <span className="mt-1 block text-xs font-bold">{kc.status === 'packing' ? `${n} of ${rel.length} packed` : `${n} of ${rel.length} returned`} · tap to {kc.status === 'packing' ? 'continue packing' : 'check in'}</span>
          </button>
        );
      })}
      <SectionHead action={<button type="button" className="border-0 bg-transparent text-sm font-bold text-basil" onClick={() => setCreating(true)}><Plus size={14} className="inline" /> New kit</button>}>Kit templates</SectionHead>
      {kits.map((k) => (
        <div key={k.id} className="rounded-2xl border border-basil-line bg-white p-4">
          <b>{k.name}</b> <span className="font-mono text-xs text-basil-muted">{k.code}</span>
          <p className="m-0 mt-1 text-sm text-basil-muted">{k.description}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {k.gear_ids.map((id) => { const g = gear.find((x) => x.id === id); return g ? <Pill key={id} tone={g.status === 'available' ? 'green' : g.status === 'reserved' ? 'amber' : 'red'}>{g.name}</Pill> : null; })}
            {k.extras.map((e) => <Pill key={e} tone="grey">{e}</Pill>)}
          </div>
        </div>
      ))}
      <Sheet open={creating} onClose={() => setCreating(false)} title="New kit">
        <div className="flex flex-col gap-3">
          <Field label="Name"><input className={inputCls} value={nk.name} onChange={(e) => setNk({ ...nk, name: e.target.value })} /></Field>
          <Field label="Code"><input className={inputCls} value={nk.code} onChange={(e) => setNk({ ...nk, code: e.target.value })} placeholder="BM-KIT-…" /></Field>
          <Field label="Description"><input className={inputCls} value={nk.description} onChange={(e) => setNk({ ...nk, description: e.target.value })} /></Field>
          <span className="text-sm font-bold text-[#33465F]">Items</span>
          <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
            {gear.map((g) => <label key={g.id} className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={nk.gear_ids.includes(g.id)} onChange={() => setNk({ ...nk, gear_ids: nk.gear_ids.includes(g.id) ? nk.gear_ids.filter((x) => x !== g.id) : [...nk.gear_ids, g.id] })} />{g.name}</label>)}
          </div>
          <Field label="Extras (one per line)"><textarea className={`${inputCls} h-24 py-2`} value={nk.extras} onChange={(e) => setNk({ ...nk, extras: e.target.value })} /></Field>
          <button type="button" className="btn-primary w-full" onClick={() => (nk.name && nk.gear_ids.length ? insertRow('gear_kits', { ...nk, extras: nk.extras.split('\n').map((s) => s.trim()).filter(Boolean) }).then(() => (toast('Kit saved'), setCreating(false))) : toast('Name and at least one item', 'error'))}>Save kit</button>
        </div>
      </Sheet>
    </div>
  );
}

// ---------- returns ----------
export function ReturnsPanel() {
  const { rows: checkouts } = useCheckouts();
  const { rows: gear } = useGear();
  const { rows: kcs } = useTable<KitCheckout>('kit_checkouts');
  const { rows: kits } = useTable<Kit>('gear_kits');
  const people = usePeople();
  const projects = useProjects();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [checkin, setCheckin] = useState<Checkout | null>(null);
  const [kitIn, setKitIn] = useState<KitCheckout | null>(null);
  if (kitIn) return <KitChecklist kc={kitIn} mode="in" onDone={() => setKitIn(null)} />;
  const open = checkouts.filter((c) => c.status === 'out').filter((c) => { const g = gear.find((x) => x.id === c.gear_id); return !q || (g && matchGear(g, q)) || nameOf(people, c.holder_id).toLowerCase().includes(q.toLowerCase()); }).sort((a, b) => a.due_at.localeCompare(b.due_at));
  const ext = open.filter((c) => c.extension_requested_to);
  const groups: [string, Checkout[]][] = [['Overdue', open.filter(isOverdue)], ['Due today', open.filter(isDueToday)], ['Later', open.filter((c) => !isOverdue(c) && !isDueToday(c))]];
  const g = checkin ? gear.find((x) => x.id === checkin.gear_id) : undefined;
  const liveKits = kcs.filter((k) => k.status === 'out');
  return (
    <div className="flex flex-col gap-3">
      <SearchBox value={q} onChange={setQ} placeholder="Scan tag, serial, item or person" />
      {ext.length > 0 && <SectionHead>Asking for more time</SectionHead>}
      {ext.map((c) => {
        const it = gear.find((x) => x.id === c.gear_id);
        return (
          <div key={c.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm">
            <b>{it?.name}</b> · {nameOf(people, c.holder_id)}<br />
            <span>Due {fmtDateTime(c.due_at)} → asks for <b>{fmtDateTime(c.extension_requested_to)}</b></span>
            {c.extension_reason && <span className="block text-amber-900">“{c.extension_reason}”</span>}
            <div className="mt-2 flex gap-2">
              <button type="button" className="btn-primary flex-1 !min-h-[44px]" onClick={() => decideExtension(c.id, true).then(() => toast('New return time approved'))}>Approve</button>
              <button type="button" className="btn-outline flex-1 !min-h-[44px]" onClick={() => decideExtension(c.id, false).then(() => toast('Declined — holder notified'))}>Decline</button>
            </div>
          </div>
        );
      })}
      {liveKits.length > 0 && <SectionHead>Kits out</SectionHead>}
      {liveKits.map((kc) => <button key={kc.id} type="button" onClick={() => setKitIn(kc)} className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-basil-line bg-white p-3 text-left"><Boxes size={20} className="text-amber-700" /><span className="flex-1"><b>{kits.find((k) => k.id === kc.kit_id)?.name}</b><span className="block text-xs text-basil-muted">{nameOf(people, kc.holder_id)} · due {fmtDateTime(kc.due_at)}</span></span><ClipboardCheck size={18} /></button>)}
      {groups.map(([label, list]) => list.length > 0 && (
        <div key={label} className="flex flex-col gap-2">
          <SectionHead>{label} · {list.length}</SectionHead>
          {list.map((c) => {
            const it = gear.find((x) => x.id === c.gear_id);
            if (!it) return null;
            const late = isOverdue(c);
            return (
              <div key={c.id} className={`flex min-w-0 items-center gap-3 rounded-2xl border bg-white p-3 ${late ? 'border-red-200' : 'border-basil-line'}`}>
                <GearThumb gear={it} />
                <span className="min-w-0 flex-1">
                  <b className="block truncate">{it.name}</b>
                  <span className="block truncate text-xs text-basil-muted">{nameOf(people, c.holder_id)} · {projectName(projects, c.project_id)}</span>
                  <span className={`text-xs font-bold ${late ? 'text-red-700' : 'text-basil-muted'}`}>{late ? lateText(c.due_at) : `Due ${fmtDateTime(c.due_at)}`}{c.return_requested_at && ' · on the way back'}</span>
                </span>
                <button type="button" className="btn-primary !min-h-[44px] !px-3" onClick={() => setCheckin(c)}>Check in</button>
              </div>
            );
          })}
        </div>
      ))}
      {!open.length && <EmptyBox>Everything is back in the store · Asante</EmptyBox>}
      {checkin && g && <CheckinSheet open onClose={() => setCheckin(null)} checkout={checkin} gear={g} />}
    </div>
  );
}

// ---------- who has it now ----------
export function WhoHasIt({ limit }: { limit?: number }) {
  const { rows: checkouts } = useCheckouts();
  const { rows: gear } = useGear();
  const people = usePeople();
  const projects = useProjects();
  const toast = useToast();
  const groups = useMemo(() => {
    const open = checkouts.filter((c) => c.status === 'out');
    const by = new Map<string, Checkout[]>();
    open.forEach((c) => by.set(c.holder_id, [...(by.get(c.holder_id) ?? []), c]));
    return [...by.entries()].map(([holder, list]) => ({ holder, list: list.sort((a, b) => a.due_at.localeCompare(b.due_at)), late: list.filter(isOverdue).length })).sort((a, b) => b.late - a.late || b.list.length - a.list.length);
  }, [checkouts]);
  const remind = (holder: string, list: Checkout[]) => {
    const late = list.filter(isOverdue);
    notify(holder, late.length ? `Overdue gear · ${late.length} item${late.length > 1 ? 's' : ''}` : 'Gear reminder', `${list.map((c) => gear.find((g) => g.id === c.gear_id)?.name).join(', ')} · please return or ask for more time`, '/app', 'alert')
      .then(() => toast(`Reminder sent to ${firstName(people, holder)}`));
  };
  if (!groups.length) return <EmptyBox>Nothing is out right now.</EmptyBox>;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {groups.slice(0, limit).map(({ holder, list, late }) => (
        <div key={holder} className={`min-w-0 rounded-2xl border bg-white p-3 ${late ? 'border-red-200' : 'border-basil-line'}`}>
          <div className="flex items-center gap-3">
            <Avatar name={nameOf(people, holder)} />
            <span className="min-w-0 flex-1"><b className="block">{nameOf(people, holder)}</b><span className="text-xs text-basil-muted">{list.length} item{list.length > 1 ? 's' : ''} · {[...new Set(list.map((c) => projectName(projects, c.project_id)))].join(', ')}</span></span>
            {late > 0 && <Pill tone="red">{late} overdue</Pill>}
          </div>
          <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
            {list.map((c) => {
              const g = gear.find((x) => x.id === c.gear_id);
              return <li key={c.id} className="flex items-center justify-between gap-2 text-sm"><span className="min-w-0 truncate">{g?.name}{!c.acknowledged_at && <span className="ml-1 text-xs text-amber-700">(not acknowledged)</span>}</span><span className={`shrink-0 text-xs font-bold ${isOverdue(c) ? 'text-red-700' : 'text-basil-muted'}`}>{isOverdue(c) ? lateText(c.due_at) : <><Clock size={12} className="inline" /> {fmtDateTime(c.due_at)}</>}</span></li>;
            })}
          </ul>
          <button type="button" onClick={() => remind(holder, list)} className="mt-2 flex min-h-[40px] items-center gap-1.5 border-0 bg-transparent p-0 text-sm font-bold text-basil">{late ? <Bell size={15} /> : <Send size={15} />}{late ? 'Remind now' : 'Send reminder'}</button>
        </div>
      ))}
    </div>
  );
}
