// Shared calendar — event details sheet, create/edit form and the "My calendars" layer list.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlignLeft, ArrowUpRight, Check, Clock, Eye, Lock, MapPin, Pencil, Trash2, Users, Building2, FolderKanban } from 'lucide-react';
import { Avatar, Field, inputCls, Sheet } from '@/os/ui';
import { usePeople, type Person } from '@/os/lib/store';
import {
  EVENT_COLORS, evDays, fmtDayLong, fmtTime, layerOf, mapsUrl, parseYmd, sameDay, timeLabel, tint, ymd, addMinutes,
  type CalEvent, type CalendarEventRow, type Layer, type LayerKey,
} from './lib';

// ---------------------------------------------------------------- layer list
export function LayerList({ layers, enabled, onToggle, onlyMine, setOnlyMine, counts }: {
  layers: Layer[]; enabled: Set<LayerKey>; onToggle: (k: LayerKey) => void; onlyMine: boolean; setOnlyMine: (v: boolean) => void; counts?: Partial<Record<LayerKey, number>>;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <button type="button" role="switch" aria-checked={onlyMine} onClick={() => setOnlyMine(!onlyMine)}
        className="mb-2 flex min-h-[48px] items-center justify-between gap-3 rounded-2xl border border-basil-line bg-basil-mist px-3.5 text-left">
        <span className="flex flex-col">
          <span className="text-[14px] font-bold text-basil-ink">Only mine</span>
          <span className="text-[12px] text-basil-muted">Where I’m crew, attendee, lead or driver</span>
        </span>
        <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${onlyMine ? 'bg-basil' : 'bg-basil-edge'}`}>
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${onlyMine ? 'left-[22px]' : 'left-0.5'}`} />
        </span>
      </button>
      <div className="px-1 pb-1 pt-2 font-mono text-[10px] font-bold tracking-[0.16em] text-basil-muted">MY CALENDARS</div>
      {layers.map((l) => {
        const on = enabled.has(l.key);
        return (
          <button key={l.key} type="button" role="checkbox" aria-checked={on} onClick={() => onToggle(l.key)}
            className="group flex min-h-[44px] items-center gap-3 rounded-xl border-0 bg-transparent px-2 text-left transition hover:bg-basil-mist">
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] transition" style={{ background: on ? l.color : 'transparent', boxShadow: on ? undefined : `inset 0 0 0 2px ${l.color}` }}>
              {on && <Check size={13} strokeWidth={3} className="text-white" />}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={`truncate text-[13.5px] font-semibold ${on ? 'text-basil-ink' : 'text-basil-muted'}`}>{l.label}</span>
              <span className="truncate text-[11.5px] text-basil-muted">{l.hint}</span>
            </span>
            {counts?.[l.key] !== undefined && <span className="text-[11px] tabular-nums text-basil-muted">{counts[l.key]}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- details sheet
function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex gap-3.5 py-2.5">
      <span className="mt-0.5 flex w-5 shrink-0 justify-center text-basil-muted">{icon}</span>
      <div className="min-w-0 flex-1 text-[14.5px] text-basil-ink">{children}</div>
    </div>
  );
}

export function EventSheet({ ev, onClose, canEdit, onEdit, onDelete }: { ev: CalEvent | null; onClose: () => void; canEdit: boolean; onEdit: () => void; onDelete: () => Promise<void> }) {
  const people = usePeople();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setConfirm(false), [ev?.id]);
  const e = ev;
  const layer = e ? layerOf(e.source) : null;
  const who = (e?.people ?? []).map((id) => people.find((p) => p.id === id)).filter(Boolean) as Person[];
  const [a, b] = e ? evDays(e) : [new Date(), new Date()];
  return (
    <Sheet open={!!e} onClose={onClose} title={e?.title ?? ''}>
      {e && layer && (
        <div className="-mt-2">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: tint(e.color, 0.12), color: e.color }}>
              <span className="h-2 w-2 rounded-full" style={{ background: e.color }} />{layer.label}
            </span>
            {e.tentative && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-bold text-amber-900 ring-1 ring-amber-200">Pending</span>}
            {e.record?.visibility === 'private' && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-bold text-slate-700"><Lock size={12} />Private</span>}
          </div>
          <div className="divide-y divide-basil-line/70">
            <Row icon={<Clock size={18} />}>
              <div className="font-semibold">{sameDay(a, b) ? fmtDayLong(a) : `${fmtDayLong(a)} – ${fmtDayLong(b)}`}</div>
              <div className="text-[13.5px] text-basil-muted">{e.allDay ? (sameDay(a, b) ? 'All day' : `${Math.round((b.getTime() - a.getTime()) / 864e5) + 1} days`) : timeLabel(e)}</div>
            </Row>
            {e.location && (
              <Row icon={<MapPin size={18} />}>
                <div>{e.location}</div>
                <a href={mapsUrl(e.location)} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-[32px] items-center gap-1 text-[13.5px] font-bold">Open in Google Maps <ArrowUpRight size={14} /></a>
              </Row>
            )}
            {who.length > 0 && (
              <Row icon={<Users size={18} />}>
                <div className="mb-1.5 text-[13px] font-semibold text-basil-muted">{who.length} {who.length === 1 ? 'person' : 'people'}</div>
                <div className="flex flex-col gap-2">
                  {who.map((p) => (
                    <div key={p.id} className="flex items-center gap-2.5">
                      <Avatar name={p.full_name} size={30} />
                      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{p.full_name}</span>
                      {e.record?.created_by === p.id && <span className="text-[11.5px] font-bold text-basil-muted">Organiser</span>}
                    </div>
                  ))}
                </div>
              </Row>
            )}
            {e.record?.description && <Row icon={<AlignLeft size={18} />}><p className="m-0 whitespace-pre-wrap">{e.record.description}</p></Row>}
            {Object.keys(e.meta).length > 0 && (
              <Row icon={<FolderKanban size={18} />}>
                <dl className="m-0 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-[13.5px]">
                  {Object.entries(e.meta).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-basil-muted">{k}</dt>
                      <dd className="m-0 min-w-0 break-words font-semibold">{/^https?:\/\//.test(v) ? <a href={v} target="_blank" rel="noreferrer">{v.replace(/^https?:\/\//, '')}</a> : v}</dd>
                    </div>
                  ))}
                </dl>
              </Row>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {e.link && <Link to={e.link} onClick={onClose} className="btn-primary min-h-[48px] flex-1 text-[15px]">{e.linkLabel ?? 'Open record'}<ArrowUpRight size={16} /></Link>}
            {canEdit && e.record && !confirm && (
              <>
                <button type="button" onClick={onEdit} className="btn-outline min-h-[48px] flex-1"><Pencil size={16} />Edit</button>
                <button type="button" onClick={() => setConfirm(true)} className="btn min-h-[48px] border border-red-200 bg-white text-red-700 hover:bg-red-50" aria-label="Delete event"><Trash2 size={16} /></button>
              </>
            )}
            {confirm && (
              <div className="flex w-full items-center gap-2 rounded-2xl bg-red-50 p-2 pl-4 ring-1 ring-red-200">
                <span className="flex-1 text-[14px] font-semibold text-red-800">Delete this event for everyone?</span>
                <button type="button" onClick={() => setConfirm(false)} className="btn min-h-[44px] bg-white px-4 text-basil-deep">Keep</button>
                <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await onDelete(); } finally { setBusy(false); } }} className="btn min-h-[44px] bg-red-600 px-4 text-white hover:bg-red-700">Delete</button>
              </div>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------- day list sheet ("+N more")
export function DaySheet({ day, events, onClose, renderRow }: { day: Date | null; events: CalEvent[]; onClose: () => void; renderRow: (e: CalEvent, day: Date) => React.ReactNode }) {
  return (
    <Sheet open={!!day} onClose={onClose} title={day ? fmtDayLong(day) : ''}>
      <div className="flex flex-col gap-1.5">{day && events.map((e) => <div key={e.id} onClickCapture={() => onClose()}>{renderRow(e, day)}</div>)}</div>
      {day && !events.length && <p className="text-basil-muted">Nothing planned.</p>}
    </Sheet>
  );
}

// ---------------------------------------------------------------- create / edit form
export interface Draft {
  title: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  location: string;
  description: string;
  color: string;
  project_id: string;
  client_id: string;
  attendees: string[];
  visibility: CalendarEventRow['visibility'];
}

export function draftFrom(row?: Partial<CalendarEventRow> | null, start?: Date, allDay = false): Draft {
  if (row?.starts_at && row.ends_at) {
    const s = new Date(row.starts_at), e = new Date(row.ends_at);
    return {
      title: row.title ?? '', allDay: !!row.all_day, startDate: ymd(s), startTime: fmtTime(s), endDate: ymd(e), endTime: fmtTime(e),
      location: row.location ?? '', description: row.description ?? '', color: row.color ?? '', project_id: row.project_id ?? '', client_id: row.client_id ?? '',
      attendees: row.attendees ?? [], visibility: row.visibility ?? 'staff',
    };
  }
  const s = start ?? (() => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return d; })();
  const e = addMinutes(s, 60);
  return { title: '', allDay, startDate: ymd(s), startTime: fmtTime(s), endDate: ymd(allDay ? s : e), endTime: fmtTime(e), location: '', description: '', color: '', project_id: '', client_id: '', attendees: [], visibility: 'staff' };
}

export function draftToRow(d: Draft) {
  const at = (day: string, hm: string) => {
    const x = parseYmd(day);
    const [h, m] = hm.split(':').map(Number);
    x.setHours(d.allDay ? 0 : h || 0, d.allDay ? 0 : m || 0, 0, 0);
    return x;
  };
  return {
    title: d.title.trim(), all_day: d.allDay, starts_at: at(d.startDate, d.startTime).toISOString(), ends_at: at(d.endDate, d.endTime).toISOString(),
    location: d.location.trim(), description: d.description.trim(), color: d.color, project_id: d.project_id || null, client_id: d.client_id || null,
    attendees: d.attendees, visibility: d.visibility,
  };
}

const VIS: { value: Draft['visibility']; label: string; hint: string; icon: React.ReactNode }[] = [
  { value: 'staff', label: 'Staff', hint: 'Everyone at Basil Media', icon: <Users size={15} /> },
  { value: 'everyone', label: 'Client', hint: 'Staff + the client’s portal', icon: <Eye size={15} /> },
  { value: 'private', label: 'Private', hint: 'Only you and invitees', icon: <Lock size={15} /> },
];

export function EventForm({ open, initial, editing, onClose, onSave, projects, clients }: {
  open: boolean; initial: Draft; editing: boolean; onClose: () => void; onSave: (d: Draft) => Promise<void>;
  projects: { id: string; name: string; client_id?: string | null }[]; clients: { id: string; name: string }[];
}) {
  const [d, setD] = useState<Draft>(initial);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [who, setWho] = useState('');
  const people = usePeople();
  useEffect(() => {
    if (open) (setD(initial), setErr(''), setWho(''));
  }, [open, initial]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const filtered = useMemo(() => people.filter((p) => !who || p.full_name.toLowerCase().includes(who.toLowerCase())), [people, who]);

  const setStartDate = (v: string) => setD((x) => ({ ...x, startDate: v, endDate: x.endDate < v ? v : x.endDate }));
  const setStartTime = (v: string) =>
    setD((x) => {
      const [h, m] = v.split(':').map(Number), [eh, em] = x.endTime.split(':').map(Number), [sh, sm] = x.startTime.split(':').map(Number);
      const dur = eh * 60 + em - (sh * 60 + sm);
      if (x.startDate !== x.endDate || !(dur > 0)) return { ...x, startTime: v };
      const end = Math.min(h * 60 + m + dur, 23 * 60 + 59);
      return { ...x, startTime: v, endTime: `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}` };
    });

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const row = draftToRow(d);
    if (!row.title) return setErr('Give the event a title.');
    if (new Date(row.ends_at) < new Date(row.starts_at)) return setErr('The event must end after it starts.');
    if (d.visibility === 'everyone' && !d.client_id) return setErr('Pick the client who should see this event, or choose “Staff”.');
    setBusy(true);
    try {
      await onSave(d);
    } catch (e) {
      setErr((e as Error).message ?? 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const proj = projects.find((p) => p.id === d.project_id);
  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Edit event' : 'New event'}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <input autoFocus aria-label="Title" placeholder="Add title" value={d.title} onChange={(e) => set('title', e.target.value)}
          className="h-14 w-full border-0 border-b-2 border-basil-line bg-transparent px-1 font-display text-[22px] font-extrabold text-basil-ink outline-none placeholder:text-basil-muted/60 focus:border-basil" />

        <div className="flex flex-col gap-3 rounded-2xl bg-basil-mist p-3">
          <button type="button" role="switch" aria-checked={d.allDay} onClick={() => set('allDay', !d.allDay)} className="flex min-h-[44px] items-center justify-between border-0 bg-transparent px-1 text-[15px] font-bold text-basil-ink">
            All day
            <span className={`relative h-7 w-12 rounded-full transition ${d.allDay ? 'bg-basil' : 'bg-basil-edge'}`}><span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${d.allDay ? 'left-[22px]' : 'left-0.5'}`} /></span>
          </button>
          <div className="grid grid-cols-[1fr,auto] gap-2">
            <Field label="Starts"><input type="date" required className={inputCls} value={d.startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
            {!d.allDay && <Field label={'\u00a0'}><input type="time" aria-label="Start time" required className={`${inputCls} w-[118px]`} value={d.startTime} onChange={(e) => setStartTime(e.target.value)} /></Field>}
            <Field label="Ends"><input type="date" required min={d.startDate} className={inputCls} value={d.endDate} onChange={(e) => set('endDate', e.target.value)} /></Field>
            {!d.allDay && <Field label={'\u00a0'}><input type="time" aria-label="End time" required className={`${inputCls} w-[118px]`} value={d.endTime} onChange={(e) => set('endTime', e.target.value)} /></Field>}
          </div>
        </div>

        <Field label="Location"><input className={inputCls} value={d.location} onChange={(e) => set('location', e.target.value)} placeholder="Boardroom, client office, address…" /></Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Project">
            <select className={inputCls} value={d.project_id} onChange={(e) => { const p = projects.find((x) => x.id === e.target.value); setD((x) => ({ ...x, project_id: e.target.value, client_id: p?.client_id ?? x.client_id })); }}>
              <option value="">No project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Client">
            <select className={inputCls} value={d.client_id} onChange={(e) => set('client_id', e.target.value)}>
              <option value="">No client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        {proj && <span className="-mt-2 flex items-center gap-1.5 text-xs text-basil-muted"><Building2 size={13} />Linked to {proj.name}</span>}

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-[#33465F]">Who can see it</span>
          <div className="grid grid-cols-3 gap-1.5" role="radiogroup">
            {VIS.map((v) => (
              <button key={v.value} type="button" role="radio" aria-checked={d.visibility === v.value} onClick={() => set('visibility', v.value)}
                className={`flex min-h-[64px] flex-col items-start justify-center gap-0.5 rounded-2xl px-3 text-left transition ${d.visibility === v.value ? 'border-0 bg-basil text-white shadow-glow' : 'border border-basil-edge bg-white text-basil-deep'}`}>
                <span className="flex items-center gap-1.5 text-[13px] font-bold">{v.icon}{v.label}</span>
                <span className={`text-[11px] leading-tight ${d.visibility === v.value ? 'text-white/80' : 'text-basil-muted'}`}>{v.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="flex items-center justify-between text-sm font-bold text-[#33465F]">Invite people <span className="text-xs font-semibold text-basil-muted">{d.attendees.length} selected</span></span>
          <input className={inputCls} placeholder="Search the team…" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Search people" />
          <div className="scrollbar-none flex max-h-[176px] flex-col overflow-y-auto rounded-2xl border border-basil-line">
            {filtered.map((p) => {
              const on = d.attendees.includes(p.id);
              return (
                <button key={p.id} type="button" role="checkbox" aria-checked={on} onClick={() => set('attendees', on ? d.attendees.filter((x) => x !== p.id) : [...d.attendees, p.id])}
                  className={`flex min-h-[48px] items-center gap-3 border-0 border-b border-basil-line/70 px-3 text-left last:border-b-0 ${on ? 'bg-basil-ice' : 'bg-white'}`}>
                  <Avatar name={p.full_name} size={30} />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{p.full_name}<span className="ml-1.5 text-[11.5px] font-normal text-basil-muted">{p.roles.includes('client') ? 'client' : p.roles[0]?.replace('_', ' ')}</span></span>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-md ${on ? 'bg-basil text-white' : 'ring-2 ring-basil-edge'}`}>{on && <Check size={14} strokeWidth={3} />}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-[#33465F]">Colour</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => set('color', '')} aria-pressed={!d.color} className={`flex h-11 items-center rounded-full px-3.5 text-[13px] font-bold ${!d.color ? 'border-0 bg-basil-deep text-white' : 'border border-basil-edge bg-white text-basil-deep'}`}>Default</button>
            {EVENT_COLORS.map((c) => (
              <button key={c.value} type="button" onClick={() => set('color', c.value)} aria-label={c.name} aria-pressed={d.color === c.value}
                className="flex h-11 w-11 items-center justify-center rounded-full border-0" style={{ background: c.value, boxShadow: d.color === c.value ? `0 0 0 3px #fff, 0 0 0 5px ${c.value}` : undefined }}>
                {d.color === c.value && <Check size={16} strokeWidth={3} className="text-white" />}
              </button>
            ))}
          </div>
        </div>

        <Field label="Description"><textarea rows={3} className={`${inputCls} h-auto py-2.5`} value={d.description} onChange={(e) => set('description', e.target.value)} placeholder="Agenda, call-in link, what to bring…" /></Field>

        {err && <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{err}</div>}
        <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-basil-line bg-white/95 px-5 pt-3 backdrop-blur">
          <button type="button" onClick={onClose} className="btn-outline min-h-[50px] flex-1">Cancel</button>
          <button type="submit" disabled={busy} className="btn-primary min-h-[50px] flex-[2] disabled:opacity-60">{busy ? 'Saving…' : editing ? 'Save changes' : 'Save event'}</button>
        </div>
      </form>
    </Sheet>
  );
}
