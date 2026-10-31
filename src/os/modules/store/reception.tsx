// Reception / front desk: visitors, pre-registration with QR pass, parcels, meeting rooms, walk-in enquiries.
import { useState } from 'react';
import { CalendarClock, CheckCircle2, LogIn, LogOut, Mail, MessageSquarePlus, QrCode, UserPlus, X } from 'lucide-react';
import { submit } from '@/lib/db';
import { usePeople, useTable } from '@/os/lib/store';
import { useActing } from '@/os/lib/session';
import { useToast } from '@/os/cms/toast';
import { Avatar, Field, Pill, Sheet, Stat, Tabs, inputCls } from '@/os/ui';
import { QR, ROOMS, ROOM_HOURS, addDays, dayKey, fmtDate, fmtDateTime, fmtDay, fmtTime, hourNow, type Parcel, type RoomBooking, type Visitor } from './data';
import { bookRoom, cancelRoom, collectParcel, logParcel, preRegister, signInVisitor, signOutVisitor } from './actions';
import { EmptyBox, PersonSelect, SearchBox, SectionHead, nameOf } from './shared';

const errT = (toast: ReturnType<typeof useToast>) => (e: unknown) => toast((e as Error).message ?? String(e), 'error');
const isToday = (iso?: string | null) => !!iso && dayKey(iso) === dayKey();
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

export function useVisitors() {
  return useTable<Visitor>('visitors', { order: 'created_at', ascending: false }).rows;
}

function VisitorCard({ v, action }: { v: Visitor; action?: React.ReactNode }) {
  const people = usePeople();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-basil-line bg-white p-3">
      <Avatar name={v.name} size={40} />
      <span className="min-w-0 flex-1">
        <b className="block truncate">{v.name}</b>
        <span className="block truncate text-xs text-basil-muted">{v.company || 'Walk-in'} · to see {nameOf(people, v.host_id).split(' ')[0]}</span>
        <span className="block truncate text-xs text-basil-muted">{v.status === 'expected' ? `Expected ${fmtTime(v.expected_at)}` : v.status === 'in' ? `In since ${fmtTime(v.signed_in_at)} · ${v.badge_no}` : `${fmtTime(v.signed_in_at)}–${fmtTime(v.signed_out_at)}`} · {v.purpose}</span>
      </span>
      {action}
    </div>
  );
}

/** Reception desk: who is in, who is expected, parcels waiting. */
export function DeskBoard() {
  const visitors = useVisitors();
  const { rows: parcels } = useTable<Parcel>('parcels', { eq: { status: 'waiting' } });
  const toast = useToast();
  const { userId } = useActing();
  const [pre, setPre] = useState(false);
  const inNow = visitors.filter((v) => v.status === 'in');
  const expected = visitors.filter((v) => v.status === 'expected' && isToday(v.expected_at)).sort((a, b) => (a.expected_at ?? '').localeCompare(b.expected_at ?? ''));
  const today = visitors.filter((v) => isToday(v.signed_in_at) || (v.status === 'expected' && isToday(v.expected_at)));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="In building" value={inNow.length} tone="green" />
        <Stat label="Expected" value={expected.length} tone="amber" />
        <Stat label="Parcels" value={parcels.length} />
      </div>
      <button type="button" className="btn-outline w-full" onClick={() => setPre(true)}><QrCode size={16} />Pre-register a guest</button>
      <section><SectionHead>In the building now · {inNow.length}</SectionHead>
        <div className="flex flex-col gap-2">
          {inNow.map((v) => <VisitorCard key={v.id} v={v} action={<button type="button" className="btn-outline !min-h-[44px] !px-3" onClick={() => signOutVisitor(v.id).then(() => toast(`${v.name} signed out`))}><LogOut size={16} />Out</button>} />)}
          {!inNow.length && <EmptyBox>No visitors in the building.</EmptyBox>}
        </div>
      </section>
      <section><SectionHead>Expected today · {expected.length}</SectionHead>
        <div className="flex flex-col gap-2">
          {expected.map((v) => <VisitorCard key={v.id} v={v} action={<button type="button" className="btn-primary !min-h-[44px] !px-3" onClick={() => signInVisitor(v, userId).then(() => toast(`${v.name} signed in · host notified`)).catch(errT(toast))}><LogIn size={16} />Arrived</button>} />)}
          {!expected.length && <EmptyBox>Nobody else expected today.</EmptyBox>}
        </div>
      </section>
      <section><SectionHead>Today’s visitors · {today.length}</SectionHead>
        <div className="flex flex-col gap-2">{today.filter((v) => v.status === 'out').map((v) => <VisitorCard key={v.id} v={v} action={<Pill tone="grey">Left</Pill>} />)}</div>
      </section>
      <PreRegisterSheet open={pre} onClose={() => setPre(false)} />
    </div>
  );
}

export function PreRegisterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { userId } = useActing();
  const toast = useToast();
  const [f, setF] = useState({ name: '', company: '', phone: '', purpose: '', host_id: '', date: dayKey(), time: '10:00' });
  const [done, setDone] = useState<Visitor | null>(null);
  const save = async () => {
    if (!f.name || !f.host_id) return toast('Guest name and host are required', 'error');
    try {
      const v = await preRegister({ name: f.name, company: f.company, phone: f.phone, purpose: f.purpose, host_id: f.host_id, expected_at: new Date(`${f.date}T${f.time}:00+03:00`).toISOString() }, userId);
      setDone(v);
    } catch (e) {
      errT(toast)(e);
    }
  };
  const close = () => { setDone(null); setF({ ...f, name: '', company: '', phone: '', purpose: '' }); onClose(); };
  return (
    <Sheet open={open} onClose={close} title={done ? 'Guest pass' : 'Pre-register a guest'}>
      {done ? (
        <div className="flex flex-col items-center gap-2 text-center">
          <img src={QR(`BASIL-MEDIA-VISITOR:${done.pass_code}:${done.name}`, 240)} alt={`QR pass for ${done.name}`} className="h-48 w-48 rounded-xl border border-basil-line" />
          <b className="font-mono text-lg">{done.pass_code}</b>
          <p className="m-0 text-sm text-basil-muted">{done.name} · {fmtDateTime(done.expected_at)}. Send this pass by WhatsApp or SMS — show it at reception for a fast sign-in.</p>
          {done.phone && <a className="btn-primary w-full" href={`https://wa.me/${done.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Karibu Basil Media! Your visitor pass ${done.pass_code} for ${fmtDateTime(done.expected_at)}. Mikocheni, Dar es Salaam.`)}`} target="_blank" rel="noreferrer">Send by WhatsApp</a>}
          <button type="button" className="btn-outline w-full" onClick={close}>Done</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Field label="Guest name"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field></div>
          <Field label="Company"><input className={inputCls} value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} /></Field>
          <Field label="Phone"><input className={inputCls} type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Date"><input className={inputCls} type="date" min={dayKey()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Time"><input className={inputCls} type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
          <div className="col-span-2"><Field label="Host"><PersonSelect value={f.host_id} onChange={(v) => setF({ ...f, host_id: v })} label="Who are they seeing" /></Field></div>
          <div className="col-span-2"><Field label="Purpose"><input className={inputCls} value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} /></Field></div>
          <button type="button" className="btn-primary col-span-2" onClick={save}>Create pass</button>
        </div>
      )}
    </Sheet>
  );
}

/** Fast visitor sign-in. Matches pre-registered guests by name or pass code. */
export function SignInForm() {
  const visitors = useVisitors();
  const { userId } = useActing();
  const toast = useToast();
  const blank = { name: '', company: '', phone: '', purpose: '', host_id: '' };
  const [f, setF] = useState(blank);
  const [match, setMatch] = useState<Visitor | null>(null);
  const expected = visitors.filter((v) => v.status === 'expected');
  const hits = f.name.length >= 2 && !match ? expected.filter((v) => v.name.toLowerCase().includes(f.name.toLowerCase()) || v.pass_code.toLowerCase() === f.name.toLowerCase()) : [];
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim() || !f.host_id) return toast('Name and host are required', 'error');
    try {
      await signInVisitor({ ...(match ? { id: match.id } : {}), ...f }, userId);
      toast(`${f.name} signed in · host notified`);
      setF(blank);
      setMatch(null);
    } catch (err) {
      errT(toast)(err);
    }
  };
  const purposes = ['Meeting', 'Interview', 'Delivery', 'Client review', 'Shoot booking'];
  return (
    <form onSubmit={go} className="flex flex-col gap-3">
      <Field label="Visitor name or pass code"><input className={inputCls} autoComplete="off" value={f.name} onChange={(e) => (setF({ ...f, name: e.target.value }), setMatch(null))} placeholder="e.g. Faraja or BMV-9X4T" /></Field>
      {hits.map((v) => (
        <button key={v.id} type="button" onClick={() => (setMatch(v), setF({ name: v.name, company: v.company, phone: v.phone, purpose: v.purpose, host_id: v.host_id ?? '' }))} className="flex min-h-[52px] items-center gap-3 rounded-2xl border border-teal-300 bg-teal-50 p-3 text-left text-sm">
          <CheckCircle2 size={18} className="text-teal-700" /><span className="flex-1"><b>{v.name}</b> · pre-registered for {fmtTime(v.expected_at)}</span>
        </button>
      ))}
      {match && <Pill tone="green">Pre-registered · {match.pass_code}</Pill>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Company"><input className={inputCls} value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} /></Field>
        <Field label="Phone"><input className={inputCls} type="tel" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      </div>
      <Field label="Host"><PersonSelect value={f.host_id} onChange={(v) => setF({ ...f, host_id: v })} label="Who are they seeing" /></Field>
      <Field label="Purpose"><input className={inputCls} value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} /></Field>
      <div className="flex flex-wrap gap-2">{purposes.map((p) => <button key={p} type="button" onClick={() => setF({ ...f, purpose: p })} className="min-h-[40px] rounded-full border border-basil-edge bg-white px-3 text-sm">{p}</button>)}</div>
      <button type="submit" className="btn-primary w-full !min-h-[56px] text-lg"><UserPlus size={20} />Sign in & notify host</button>
    </form>
  );
}

export function ParcelsPanel() {
  const { rows } = useTable<Parcel>('parcels', { order: 'received_at', ascending: false });
  const people = usePeople();
  const { userId } = useActing();
  const toast = useToast();
  const [tab, setTab] = useState<'waiting' | 'collected'>('waiting');
  const [adding, setAdding] = useState(false);
  const [collect, setCollect] = useState<Parcel | null>(null);
  const [by, setBy] = useState('');
  const [f, setF] = useState({ courier: 'DHL Express', sender: '', recipient_id: '', description: '', tracking_no: '' });
  const save = () => (!f.recipient_id || !f.description ? toast('Recipient and description required', 'error') : logParcel(f, userId).then(() => (toast(`Logged · ${nameOf(people, f.recipient_id)} notified`), setAdding(false), setF({ ...f, sender: '', description: '', tracking_no: '' }))).catch(errT(toast)));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={tab} onChange={setTab} items={[{ value: 'waiting', label: 'Waiting', count: rows.filter((p) => p.status === 'waiting').length }, { value: 'collected', label: 'Collected' }]} />
        <button type="button" className="btn-primary" onClick={() => setAdding(true)}><Mail size={16} />Log parcel</button>
      </div>
      {rows.filter((p) => p.status === tab).map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-basil-line bg-white p-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Mail size={20} /></span>
          <span className="min-w-0 flex-1">
            <b className="block truncate">{p.description}</b>
            <span className="block truncate text-xs text-basil-muted">For {nameOf(people, p.recipient_id)} · {p.courier} · from {p.sender}</span>
            <span className="text-xs text-basil-muted">{p.status === 'waiting' ? `Arrived ${fmtDateTime(p.received_at)}` : `Collected by ${p.collected_by_name} · ${fmtDateTime(p.collected_at)}`}</span>
          </span>
          {p.status === 'waiting' && <button type="button" className="btn-outline !min-h-[44px] !px-3" onClick={() => (setCollect(p), setBy(nameOf(people, p.recipient_id)))}>Collected</button>}
        </div>
      ))}
      {!rows.some((p) => p.status === tab) && <EmptyBox>No parcels {tab}.</EmptyBox>}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Log a parcel">
        <div className="flex flex-col gap-3">
          <Field label="For"><PersonSelect value={f.recipient_id} onChange={(v) => setF({ ...f, recipient_id: v })} label="Recipient" /></Field>
          <Field label="What is it"><input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Courier"><select className={inputCls} value={f.courier} onChange={(e) => setF({ ...f, courier: e.target.value })}>{['DHL Express', 'EMS Posta', 'Fargo Courier', 'G4S', 'Bolt / boda', 'Hand delivery'].map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Tracking no."><input className={inputCls} value={f.tracking_no} onChange={(e) => setF({ ...f, tracking_no: e.target.value })} /></Field>
          </div>
          <Field label="Sender"><input className={inputCls} value={f.sender} onChange={(e) => setF({ ...f, sender: e.target.value })} /></Field>
          <button type="button" className="btn-primary w-full" onClick={save}>Log & notify</button>
        </div>
      </Sheet>
      <Sheet open={!!collect} onClose={() => setCollect(null)} title="Confirm collection">
        <div className="flex flex-col gap-3">
          <Field label="Collected by"><input className={inputCls} value={by} onChange={(e) => setBy(e.target.value)} /></Field>
          <button type="button" className="btn-primary w-full" onClick={() => collectParcel(collect!.id, by).then(() => (toast('Collection confirmed'), setCollect(null)))}>Confirm</button>
        </div>
      </Sheet>
    </div>
  );
}

/** Meeting rooms: hourly grid 08:00–18:00; book a free slot, cancel your own. Shared with every staff role. */
export function RoomsBoard() {
  const { userId, can } = useActing();
  const people = usePeople();
  const toast = useToast();
  const [date, setDate] = useState(dayKey());
  const [room, setRoom] = useState<string>(ROOMS[0]);
  const { rows } = useTable<RoomBooking>('room_bookings', { eq: { date } });
  const live = rows.filter((b) => b.status === 'booked');
  const [slot, setSlot] = useState<{ room: string; hour: number } | null>(null);
  const [title, setTitle] = useState('');
  const [len, setLen] = useState(1);
  const past = (h: number) => date < dayKey() || (date === dayKey() && h < hourNow());
  const at = (r: string, h: number) => live.find((b) => b.room === r && b.start_hour <= h && b.end_hour > h);
  const maxLen = slot ? ROOM_HOURS.filter((h) => h >= slot.hour).findIndex((h) => at(slot.room, h)) : 0;
  const book = () => bookRoom({ room: slot!.room, date, start_hour: slot!.hour, end_hour: slot!.hour + len, title: title || 'Meeting', booked_by: userId }, live)
    .then(() => (toast(`${slot!.room} booked ${hh(slot!.hour)}–${hh(slot!.hour + len)}`), setSlot(null), setTitle(''), setLen(1))).catch(errT(toast));
  const canCancel = (b: RoomBooking) => b.booked_by === userId || can('receptionist', 'gm_cfo', 'boss');
  return (
    <div className="flex flex-col gap-3">
      <div className="scrollbar-none flex gap-1.5 overflow-x-auto">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => { const d = addDays(dayKey(), i); return <button key={d} type="button" aria-pressed={date === d} onClick={() => setDate(d)} className={`min-h-[52px] min-w-[64px] shrink-0 rounded-2xl px-2 text-xs font-bold ${date === d ? 'border-0 bg-teal-600 text-white' : 'border border-basil-edge bg-white'}`}>{i === 0 ? 'Today' : fmtDay(d).split(',')[0]}<br />{fmtDate(d).slice(0, 5)}</button>; })}
      </div>
      <div className="md:hidden"><Tabs value={room} onChange={setRoom} items={ROOMS.map((r) => ({ value: r, label: r }))} /></div>
      <div className="grid gap-3 md:grid-cols-3">
        {ROOMS.map((r) => (
          <div key={r} className={`${r === room ? '' : 'hidden'} md:block`}>
            <h3 className="m-0 mb-2 hidden text-sm font-extrabold md:block">{r}</h3>
            <div className="flex flex-col gap-1">
              {ROOM_HOURS.map((h) => {
                const b = at(r, h);
                if (b && b.start_hour !== h) return null;
                const span = b ? b.end_hour - b.start_hour : 1;
                return b ? (
                  <div key={h} className={`flex items-start gap-2 rounded-xl p-2.5 text-sm ${b.booked_by === userId ? 'bg-teal-600 text-white' : 'bg-basil-ice text-basil-deep'}`} style={{ minHeight: span * 48 + (span - 1) * 4 }}>
                    <span className="w-12 shrink-0 font-mono text-xs">{hh(h)}</span>
                    <span className="min-w-0 flex-1"><b className="block truncate">{b.title}</b><span className="text-xs opacity-80">{nameOf(people, b.booked_by)} · until {hh(b.end_hour)}</span></span>
                    {canCancel(b) && <button type="button" aria-label="Cancel booking" onClick={() => cancelRoom(b.id).then(() => toast('Booking cancelled'))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-0 bg-white/25"><X size={16} /></button>}
                  </div>
                ) : (
                  <button key={h} type="button" disabled={past(h)} onClick={() => (setSlot({ room: r, hour: h }), setLen(1))} className="flex min-h-[48px] items-center gap-2 rounded-xl border border-dashed border-basil-edge bg-white px-2.5 text-left text-sm disabled:opacity-40">
                    <span className="w-12 font-mono text-xs">{hh(h)}</span><span className="text-basil-muted">{past(h) ? '—' : 'Free · tap to book'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <Sheet open={!!slot} onClose={() => setSlot(null)} title={slot ? `Book ${slot.room}` : ''}>
        {slot && (
          <div className="flex flex-col gap-3">
            <p className="m-0 text-sm text-basil-muted">{fmtDay(date)} from {hh(slot.hour)}</p>
            <Field label="What for"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Client review, podcast record…" /></Field>
            <Field label="How long">
              <div className="flex flex-wrap gap-2">{[1, 2, 3, 4].filter((n) => slot.hour + n <= 18 && (maxLen < 0 || n <= maxLen)).map((n) => <button key={n} type="button" aria-pressed={len === n} onClick={() => setLen(n)} className={`min-h-[44px] rounded-xl px-4 text-sm font-bold ${len === n ? 'border-0 bg-teal-600 text-white' : 'border border-basil-edge bg-white'}`}>{n} h · to {hh(slot.hour + n)}</button>)}</div>
            </Field>
            <button type="button" className="btn-primary w-full" onClick={book}><CalendarClock size={16} />Book</button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

/** Walk-in enquiry → website bookings inbox (source 'contact', status 'new'). */
export function WalkInEnquiry() {
  const toast = useToast();
  const blank = { name: '', contact: '', service: 'Corporate Video', preferred_date: '', message: '' };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.name.trim().length < 2 || f.contact.trim().length < 5) return toast('Name and phone/email are required', 'error');
    setBusy(true);
    try {
      await submit('bookings', { name: f.name, contact: f.contact, service: f.service, preferred_date: f.preferred_date || null, message: `[Walk-in at reception] ${f.message}`, source: 'contact', status: 'new' });
      toast('Enquiry sent to the Growth team');
      setF(blank);
    } catch (err) {
      errT(toast)(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={go} className="flex flex-col gap-3">
      <p className="m-0 flex items-center gap-2 text-sm text-basil-muted"><MessageSquarePlus size={16} />Goes straight to the bookings inbox for the Growth team.</p>
      <Field label="Name"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Phone or email"><input className={inputCls} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></Field>
      <Field label="Service"><select className={inputCls} value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}>{['Corporate Video', 'Event Coverage', 'Live Streaming', 'Documentary', 'Photography', 'Podcast Series', 'Monthly Retainer', 'Equipment rental', 'Other'].map((s) => <option key={s}>{s}</option>)}</select></Field>
      <Field label="Preferred date"><input className={inputCls} type="date" value={f.preferred_date} onChange={(e) => setF({ ...f, preferred_date: e.target.value })} /></Field>
      <Field label="What do they need?"><textarea className={`${inputCls} h-24 py-2`} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></Field>
      <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? 'Sending…' : 'Send enquiry'}</button>
    </form>
  );
}

export function VisitorLog() {
  const visitors = useVisitors();
  const [q, setQ] = useState('');
  const list = visitors.filter((v) => !q || `${v.name} ${v.company} ${v.purpose}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => (b.signed_in_at ?? b.expected_at ?? '').localeCompare(a.signed_in_at ?? a.expected_at ?? ''));
  return (
    <div className="flex flex-col gap-3">
      <SearchBox value={q} onChange={setQ} placeholder="Search name, company, purpose" />
      {list.map((v) => <VisitorCard key={v.id} v={v} action={<Pill tone={v.status === 'in' ? 'green' : v.status === 'expected' ? 'amber' : 'grey'}>{v.status === 'in' ? 'In' : v.status === 'expected' ? fmtDate(v.expected_at) : fmtDate(v.signed_in_at)}</Pill>} />)}
    </div>
  );
}
