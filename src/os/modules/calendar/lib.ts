// Shared calendar — pure helpers. `aggregate()` turns rows from the existing tables (projects, shoots,
// retainer visits, trips, leave, rooms, growth events, invoices/contracts) plus the custom
// `calendar_events` table into one list of CalEvent. No React, no I/O: easy to reason about and test.
// Dates use the browser's local time (Africa/Dar_es_Salaam for the team); weeks start on Monday.
import type { AppRole } from '@/lib/types';

// ---------------------------------------------------------------- types
export type LayerKey = 'events' | 'projects' | 'shoots' | 'retainers' | 'posts' | 'trips' | 'rooms' | 'growth' | 'leave' | 'finance';

export interface CalEvent {
  id: string;
  source: LayerKey;
  title: string;
  /** All-day: 'YYYY-MM-DD'. Timed: full ISO timestamp. */
  start: string;
  /** All-day: last day, inclusive ('YYYY-MM-DD'). Timed: ISO timestamp. */
  end: string;
  allDay: boolean;
  color: string;
  location: string;
  projectId?: string | null;
  clientId?: string | null;
  /** In-app route of the source record, e.g. /os/projects/<id>. */
  link?: string;
  linkLabel?: string;
  /** User ids involved (crew, attendees, lead, driver, owner…) — drives "Only mine". */
  people?: string[];
  /** Label → value rows shown in the event sheet. */
  meta: Record<string, string>;
  /** Pending / unconfirmed: drawn with a dashed outline. */
  tentative?: boolean;
  /** Present only for custom events (source 'events'), so they can be edited. */
  record?: CalendarEventRow;
}

export interface CalendarEventRow {
  id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  color: string;
  project_id: string | null;
  client_id: string | null;
  attendees: string[];
  visibility: 'everyone' | 'staff' | 'private';
  created_by: string | null;
  created_at?: string;
}

type R = Record<string, unknown>;
/** Raw rows per table, as read from Supabase (or the demo store). Missing tables are fine. */
export interface Sources {
  projects?: R[];
  clients?: R[];
  shoots?: R[];
  shoot_crew?: R[];
  retainer_calendar?: R[];
  trips?: R[];
  room_bookings?: R[];
  growth_events?: R[];
  leave_requests?: R[];
  invoices?: R[];
  contracts?: R[];
  calendar_events?: R[];
}

export interface Viewer {
  role: AppRole;
  userId: string;
  /** Client ids the viewer belongs to (client_users) — only used for the client role. */
  clientIds: string[];
}

// ---------------------------------------------------------------- layers
export interface Layer {
  key: LayerKey;
  label: string;
  color: string;
  hint: string;
  /** Hidden until switched on (noisy layers). */
  defaultOff?: boolean;
}
export const LAYERS: Layer[] = [
  { key: 'events', label: 'Team events', color: '#4F46E5', hint: 'Meetings, reviews, holidays' },
  { key: 'projects', label: 'Projects', color: '#0F6EC2', hint: 'Project timelines and due dates' },
  { key: 'shoots', label: 'Shoots', color: '#EA580C', hint: 'Call sheets, call → wrap' },
  { key: 'retainers', label: 'Retainer schedule', color: '#0D9488', hint: 'Client shoots, podcasts, deliveries, reviews' },
  { key: 'posts', label: 'Retainer posts', color: '#64748B', hint: 'Planned social posts', defaultOff: true },
  { key: 'trips', label: 'Transport', color: '#7C3AED', hint: 'Vehicle trips, depart → return' },
  { key: 'rooms', label: 'Rooms', color: '#CA8A04', hint: 'Boardroom, studio, edit suite' },
  { key: 'growth', label: 'Growth events', color: '#E11D48', hint: 'Conferences, networking, awards' },
  { key: 'leave', label: 'Leave', color: '#DB2777', hint: 'Approved and pending leave' },
  { key: 'finance', label: 'Invoices & instalments', color: '#059669', hint: 'Payment due dates (finance only)' },
];
export const layerOf = (k: LayerKey) => LAYERS.find((l) => l.key === k)!;

export const FINANCE_ROLES: AppRole[] = ['boss', 'gm_cfo', 'finance'];
export const LEADER_ROLES: AppRole[] = ['boss', 'gm_cfo'];
const CLIENT_LAYERS: LayerKey[] = ['events', 'projects', 'shoots', 'retainers', 'posts'];

/** Layers this role may see at all. */
export function layersFor(role: AppRole): Layer[] {
  if (role === 'client') return LAYERS.filter((l) => CLIENT_LAYERS.includes(l.key));
  return LAYERS.filter((l) => l.key !== 'finance' || FINANCE_ROLES.includes(role));
}

export const EVENT_COLORS = [
  { name: 'Basil', value: '#0F6EC2' },
  { name: 'Indigo', value: '#4F46E5' },
  { name: 'Teal', value: '#0D9488' },
  { name: 'Green', value: '#16A34A' },
  { name: 'Amber', value: '#D97706' },
  { name: 'Orange', value: '#EA580C' },
  { name: 'Rose', value: '#E11D48' },
  { name: 'Slate', value: '#475569' },
];

// ---------------------------------------------------------------- date math (local time)
export const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function parseYmd(s: string) {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
export const addMinutes = (d: Date, n: number) => new Date(d.getTime() + n * 60000);
export const startOfWeek = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export function addMonths(d: Date, n: number) {
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  return new Date(t.getFullYear(), t.getMonth(), Math.min(d.getDate(), last));
}
export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export const dayDiff = (a: Date, b: Date) => Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 864e5);
export const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const weekdayShort = (d: Date) => WEEKDAYS[(d.getDay() + 6) % 7];
export const fmtTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const fmtDayLong = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const fmtDayShort = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** Local date + 'HH:MM' → Date. Bad or empty times fall back to `fallback`. */
export function atTime(day: string, hm: string | null | undefined, fallback = '09:00') {
  const m = /^(\d{1,2}):(\d{2})/.exec(hm || '') ?? /^(\d{1,2}):(\d{2})/.exec(fallback)!;
  const d = parseYmd(day);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

export const evStart = (e: CalEvent) => (e.allDay ? parseYmd(e.start) : new Date(e.start));
export const evEnd = (e: CalEvent) => (e.allDay ? addDays(parseYmd(e.end), 1) : new Date(e.end));
/** First and last calendar day the event touches (inclusive). */
export function evDays(e: CalEvent): [Date, Date] {
  if (e.allDay) return [parseYmd(e.start), parseYmd(e.end)];
  const s = new Date(e.start), en = new Date(e.end);
  const last = en.getTime() > s.getTime() && en.getHours() === 0 && en.getMinutes() === 0 ? addDays(startOfDay(en), -1) : startOfDay(en);
  return [startOfDay(s), last < startOfDay(s) ? startOfDay(s) : last];
}
/** Shown in the all-day lane: all-day events and timed ones that cross midnight. */
export const isSpanning = (e: CalEvent) => {
  if (e.allDay) return true;
  const [a, b] = evDays(e);
  return !sameDay(a, b);
};
export const touchesDay = (e: CalEvent, day: Date) => {
  const [a, b] = evDays(e);
  const d = startOfDay(day).getTime();
  return a.getTime() <= d && d <= b.getTime();
};
export function overlapsRange(e: CalEvent, from: Date, toExclusive: Date) {
  const [a, b] = evDays(e);
  return a < toExclusive && b >= startOfDay(from);
}
export const sortEvents = (a: CalEvent, b: CalEvent) =>
  Number(isSpanning(b)) - Number(isSpanning(a)) || evStart(a).getTime() - evStart(b).getTime() || evEnd(b).getTime() - evEnd(a).getTime() || a.title.localeCompare(b.title);

export function timeLabel(e: CalEvent) {
  if (e.allDay) {
    const [a, b] = evDays(e);
    return sameDay(a, b) ? 'All day' : `${fmtDayShort(a)} – ${fmtDayShort(b)}`;
  }
  const s = new Date(e.start), en = new Date(e.end);
  return sameDay(s, en) ? `${fmtTime(s)} – ${fmtTime(en)}` : `${fmtDayShort(s)} ${fmtTime(s)} – ${fmtDayShort(en)} ${fmtTime(en)}`;
}

/** Hex → rgba string. */
export function tint(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export const mapsUrl = (place: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;

// ---------------------------------------------------------------- aggregation
const s = (v: unknown) => (v == null ? '' : String(v));
const ids = (...v: unknown[]) => [...new Set(v.filter((x): x is string => typeof x === 'string' && x !== ''))];
const LONG_PROJECT_DAYS = 45;
const KIND_LABEL: Record<string, string> = { shoot: 'Shoot', podcast: 'Podcast', delivery: 'Delivery', review: 'Review', post: 'Social post' };
const KIND_MIN: Record<string, number> = { shoot: 240, podcast: 150, review: 60, post: 30 };

/** Every event the viewer may see, from every table. Layer toggles / search are applied later. */
export function aggregate(src: Sources, v: Viewer): CalEvent[] {
  const isClient = v.role === 'client';
  const allowed = new Set(layersFor(v.role).map((l) => l.key));
  const mineClient = (cid: unknown) => typeof cid === 'string' && v.clientIds.includes(cid);
  const clientName = new Map((src.clients ?? []).map((c) => [s(c.id), s(c.name)]));
  const projects = new Map((src.projects ?? []).map((p) => [s(p.id), p]));
  const projName = (id: unknown) => s(projects.get(s(id))?.name);
  const out: CalEvent[] = [];
  const push = (e: Omit<CalEvent, 'color'> & { color?: string }) => {
    if (!allowed.has(e.source)) return;
    if (!e.allDay && new Date(e.end) < new Date(e.start)) e.end = e.start;
    if (e.allDay && e.end < e.start) e.end = e.start;
    out.push({ ...e, color: e.color || layerOf(e.source).color });
  };

  // Projects: a span for short projects; kick-off and due-date markers for long ones (retainers).
  for (const p of src.projects ?? []) {
    if (isClient && !mineClient(p.client_id)) continue;
    const a = s(p.start_date).slice(0, 10), b = s(p.end_date).slice(0, 10);
    if (!a && !b) continue;
    const base = {
      source: 'projects' as const, location: s(p.location), projectId: s(p.id), clientId: s(p.client_id) || null,
      link: isClient ? undefined : `/os/projects/${s(p.id)}`, linkLabel: 'Open project', people: ids(p.lead_id),
      meta: { Client: clientName.get(s(p.client_id)) ?? '', Stage: s(p.stage), Service: s(p.service), Code: s(p.code) },
    };
    if (a && b && dayDiff(parseYmd(b), parseYmd(a)) <= LONG_PROJECT_DAYS) push({ ...base, id: `projects:${s(p.id)}`, title: s(p.name), start: a, end: b, allDay: true });
    else {
      if (a) push({ ...base, id: `projects:${s(p.id)}:start`, title: `Kick-off · ${s(p.name)}`, start: a, end: a, allDay: true });
      if (b) push({ ...base, id: `projects:${s(p.id)}:end`, title: `Due · ${s(p.name)}`, start: b, end: b, allDay: true });
    }
  }

  // Shoots (call → wrap), crew from shoot_crew.
  const crewBy = new Map<string, { user_id: string; role: string }[]>();
  for (const c of src.shoot_crew ?? []) {
    const k = s(c.shoot_id);
    crewBy.set(k, [...(crewBy.get(k) ?? []), { user_id: s(c.user_id), role: s(c.role) }]);
  }
  for (const sh of src.shoots ?? []) {
    const p = projects.get(s(sh.project_id));
    if (isClient && !mineClient(p?.client_id)) continue;
    const day = s(sh.shoot_date).slice(0, 10);
    if (!day) continue;
    const st = atTime(day, s(sh.call_time), '07:00');
    let en = atTime(day, s(sh.wrap_time), '17:00');
    if (en <= st) en = addDays(en, 1);
    const crew = crewBy.get(s(sh.id)) ?? [];
    push({
      id: `shoots:${s(sh.id)}`, source: 'shoots', title: s(sh.title), start: st.toISOString(), end: en.toISOString(), allDay: false,
      location: s(sh.location), projectId: s(sh.project_id), clientId: s(p?.client_id) || null,
      link: isClient ? undefined : `/os/projects/${s(sh.project_id)}`, linkLabel: 'Open project & call sheet',
      people: ids(...crew.map((c) => c.user_id), p?.lead_id),
      meta: { Project: projName(sh.project_id), Status: s(sh.status), Contact: [s(sh.contact_name), s(sh.contact_phone)].filter(Boolean).join(' · '), Crew: crew.map((c) => c.role).join(', ') },
    });
  }

  // Retainer schedule (the client's retainer agreement: shoots, podcasts, deliveries, reviews, posts).
  for (const it of src.retainer_calendar ?? []) {
    if (isClient && !mineClient(it.client_id)) continue;
    const day = s(it.date).slice(0, 10);
    if (!day) continue;
    const kind = s(it.kind);
    const crew = (Array.isArray(it.crew) ? it.crew : []) as { user_id?: string; role?: string }[];
    const common = {
      id: `retainers:${s(it.id)}`, source: (kind === 'post' ? 'posts' : 'retainers') as LayerKey, title: `${KIND_LABEL[kind] ?? 'Visit'} · ${s(it.title)}`,
      location: s(it.location), projectId: s(it.project_id) || null, clientId: s(it.client_id),
      link: isClient ? '/app' : `/os/retainers/${s(it.retainer_id)}`, linkLabel: isClient ? 'Open my portal' : 'Open retainer',
      people: ids(...crew.map((c) => c.user_id)),
      meta: { Client: clientName.get(s(it.client_id)) ?? '', Type: KIND_LABEL[kind] ?? kind, Status: s(it.status), 'Crew call': s(it.call_time), Link: s(it.link) },
    };
    if (kind === 'delivery') push({ ...common, start: day, end: day, allDay: true });
    else {
      const st = atTime(day, s(it.time), '09:00');
      push({ ...common, start: st.toISOString(), end: addMinutes(st, KIND_MIN[kind] ?? 60).toISOString(), allDay: false });
    }
  }

  // Transport.
  for (const t of src.trips ?? []) {
    if (!t.depart_at) continue;
    const st = new Date(s(t.depart_at));
    const en = t.return_at ? new Date(s(t.return_at)) : addMinutes(st, 120);
    push({
      id: `trips:${s(t.id)}`, source: 'trips', title: `${s(t.purpose) || 'Trip'} → ${s(t.destination)}`, start: st.toISOString(), end: en.toISOString(), allDay: false,
      location: s(t.destination), projectId: s(t.project_id) || null, link: '/os/transport', linkLabel: 'Open transport',
      people: ids(t.driver_id), meta: { From: s(t.origin), To: s(t.destination), Stage: s(t.stage), Passengers: s(t.passengers), Project: projName(t.project_id) },
    });
  }

  // Meeting rooms.
  for (const b of src.room_bookings ?? []) {
    if (s(b.status) === 'cancelled') continue;
    const day = s(b.date).slice(0, 10);
    const st = atTime(day, `${pad(Number(b.start_hour ?? 9))}:00`), en = atTime(day, `${pad(Number(b.end_hour ?? 10))}:00`);
    push({
      id: `rooms:${s(b.id)}`, source: 'rooms', title: `${s(b.room)} · ${s(b.title)}`, start: st.toISOString(), end: en.toISOString(), allDay: false,
      location: `${s(b.room)}, Basil Media office`, link: '/os/reception', linkLabel: 'Open room bookings', people: ids(b.booked_by), meta: { Room: s(b.room) },
    });
  }

  // Growth events (conferences, networking…).
  for (const g of src.growth_events ?? []) {
    const a = s(g.starts_on).slice(0, 10), b = s(g.ends_on).slice(0, 10) || a;
    if (!a) continue;
    push({
      id: `growth:${s(g.id)}`, source: 'growth', title: s(g.title), start: a, end: b, allDay: true, location: s(g.location),
      link: '/os/growth/events', linkLabel: 'Open growth events', people: ids(g.owner_id), meta: { Type: s(g.kind), 'Our role': s(g.role), Notes: s(g.notes) },
    });
  }

  // Leave (approved + pending; rejected hidden).
  for (const l of src.leave_requests ?? []) {
    const st = s(l.status);
    if (st !== 'Approved' && st !== 'Pending') continue;
    push({
      id: `leave:${s(l.id)}`, source: 'leave', title: `${s(l.leave_type)} leave${st === 'Pending' ? ' (pending)' : ''}`, start: s(l.start_date).slice(0, 10), end: s(l.end_date).slice(0, 10), allDay: true,
      location: '', link: '/os/people/leave', linkLabel: 'Open leave', people: ids(l.user_id), tentative: st === 'Pending', meta: { Status: st, Days: s(l.days) },
    });
  }

  // Finance: invoice due dates, unpaid schedule instalments and contract instalments.
  for (const inv of src.invoices ?? []) {
    const st = s(inv.status);
    if (st === 'paid' || st === 'cancelled') continue;
    const num = s(inv.number) || 'Invoice';
    const base = {
      source: 'finance' as const, allDay: true, location: '', projectId: s(inv.project_id) || null, clientId: s(inv.client_id) || null,
      link: '/os/finance/invoices', linkLabel: 'Open invoices', tentative: st === 'draft',
      meta: { Client: clientName.get(s(inv.client_id)) ?? '', Invoice: num, Status: st.replace('_', ' '), Title: s(inv.title) },
    };
    const sched = (Array.isArray(inv.schedule) ? inv.schedule : []) as { label?: string; pct?: number; due?: string }[];
    if (sched.length) sched.forEach((x, i) => x.due && push({ ...base, id: `finance:${s(inv.id)}:${i}`, title: `${x.label ?? 'Instalment'} (${x.pct ?? 0}%) · ${num}`, start: x.due.slice(0, 10), end: x.due.slice(0, 10) }));
    else if (inv.due_date) push({ ...base, id: `finance:${s(inv.id)}`, title: `Invoice due · ${num}`, start: s(inv.due_date).slice(0, 10), end: s(inv.due_date).slice(0, 10) });
  }
  for (const k of src.contracts ?? []) {
    const inst = (Array.isArray(k.instalments) ? k.instalments : []) as { label?: string; pct?: number; due_date?: string | null; paid?: boolean }[];
    inst.forEach((x, i) => {
      if (!x.due_date || x.paid) return;
      push({
        id: `finance:contract:${s(k.id)}:${i}`, source: 'finance', title: `${x.label ?? 'Instalment'} (${x.pct ?? 0}%) · ${s(k.number)}`, start: x.due_date.slice(0, 10), end: x.due_date.slice(0, 10), allDay: true,
        location: '', clientId: s(k.client_id) || null, link: '/os/growth/contracts', linkLabel: 'Open contracts', meta: { Contract: s(k.title), Client: clientName.get(s(k.client_id)) ?? '' },
      });
    });
  }

  // Custom team events — visibility mirrors the RLS policies in 0012_calendar.sql.
  for (const raw of src.calendar_events ?? []) {
    const e = raw as unknown as CalendarEventRow;
    const att = Array.isArray(e.attendees) ? e.attendees : [];
    const mine = e.created_by === v.userId || att.includes(v.userId);
    const visible = isClient ? mine || (e.visibility === 'everyone' && mineClient(e.client_id)) : mine || e.visibility !== 'private';
    if (!visible) continue;
    const allDay = !!e.all_day;
    const st = new Date(e.starts_at), en = new Date(e.ends_at);
    push({
      id: `events:${e.id}`, source: 'events', title: e.title, allDay, color: e.color || undefined,
      start: allDay ? ymd(st) : st.toISOString(), end: allDay ? ymd(en) : en.toISOString(),
      location: e.location ?? '', projectId: e.project_id, clientId: e.client_id,
      link: e.project_id && !isClient ? `/os/projects/${e.project_id}` : undefined, linkLabel: 'Open project',
      people: ids(e.created_by, ...att), record: { ...e, attendees: att },
      meta: { Project: projName(e.project_id), Client: clientName.get(s(e.client_id)) ?? '', Visibility: e.visibility === 'everyone' ? 'Everyone (incl. client)' : e.visibility === 'staff' ? 'All staff' : 'Private' },
    });
  }

  for (const e of out) for (const k of Object.keys(e.meta)) if (!e.meta[k]) delete e.meta[k];
  return out.sort(sortEvents);
}

export interface Filter {
  layers: Set<LayerKey>;
  onlyMine: boolean;
  userId: string;
  query: string;
}
export function applyFilter(events: CalEvent[], f: Filter) {
  const q = f.query.trim().toLowerCase();
  return events.filter(
    (e) =>
      f.layers.has(e.source) &&
      (!f.onlyMine || (e.people ?? []).includes(f.userId)) &&
      (!q || `${e.title} ${e.location} ${Object.values(e.meta).join(' ')}`.toLowerCase().includes(q)),
  );
}

// ---------------------------------------------------------------- layout
export interface Placed {
  ev: CalEvent;
  /** Minutes from the top of the grid. */
  top: number;
  height: number;
  col: number;
  cols: number;
  /** Columns this event may stretch across (free columns to its right). */
  span: number;
}
/** Side-by-side columns for overlapping timed events on one day (Google-style clusters). */
export function layoutDay(events: CalEvent[], day: Date, fromHour: number, toHour: number): Placed[] {
  const d0 = startOfDay(day).getTime();
  const lo = fromHour * 60, hi = toHour * 60;
  const items = events
    .filter((e) => !isSpanning(e) && touchesDay(e, day))
    .map((ev) => {
      const a = Math.max(lo, (evStart(ev).getTime() - d0) / 60000);
      const b = Math.min(hi, Math.max(a + 20, (evEnd(ev).getTime() - d0) / 60000));
      return { ev, a, b };
    })
    .filter((x) => x.a < hi)
    .sort((x, y) => x.a - y.a || y.b - x.b);
  const out: Placed[] = [];
  let cluster: { ev: CalEvent; a: number; b: number; col: number }[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols = Math.max(0, ...cluster.map((c) => c.col)) + 1;
    for (const c of cluster) {
      let span = 1;
      while (c.col + span < cols && !cluster.some((o) => o.col === c.col + span && o.a < c.b && c.a < o.b)) span++;
      out.push({ ev: c.ev, top: c.a - lo, height: Math.max(c.b - c.a, 20), col: c.col, cols, span });
    }
    cluster = [];
  };
  for (const it of items) {
    if (it.a >= clusterEnd && cluster.length) flush();
    const used = new Set(cluster.filter((c) => c.b > it.a).map((c) => c.col));
    let col = 0;
    while (used.has(col)) col++;
    cluster.push({ ...it, col });
    clusterEnd = Math.max(clusterEnd, it.b);
  }
  if (cluster.length) flush();
  return out;
}

/** Hour range for the time grid: 06–22, stretched to fit any earlier / later events in view. */
export function hourRange(events: CalEvent[], days: Date[]) {
  let from = 6, to = 22;
  for (const d of days) {
    const d0 = startOfDay(d).getTime();
    for (const e of events) {
      if (isSpanning(e) || !touchesDay(e, d)) continue;
      const a = (evStart(e).getTime() - d0) / 36e5, b = (evEnd(e).getTime() - d0) / 36e5;
      from = Math.min(from, Math.max(0, Math.floor(a)));
      to = Math.max(to, Math.min(24, Math.ceil(b)));
    }
  }
  return [from, to] as const;
}

export interface Segment {
  ev: CalEvent;
  /** Column 0–6 within the week. */
  start: number;
  end: number;
  lane: number;
  continuesLeft: boolean;
  continuesRight: boolean;
}
/** Lanes for a run of `n` days (a month-grid week, or the all-day row): spanning bars first, then single-day items. */
export function weekSegments(events: CalEvent[], weekStart: Date, n = 7): Segment[] {
  const weekEnd = addDays(weekStart, n);
  const segs = events
    .filter((e) => overlapsRange(e, weekStart, weekEnd))
    .map((ev) => {
      const [a, b] = evDays(ev);
      const start = Math.max(0, dayDiff(a, weekStart)), end = Math.min(n - 1, dayDiff(b, weekStart));
      return { ev, start, end, lane: 0, continuesLeft: a < weekStart, continuesRight: b >= weekEnd };
    })
    .sort((x, y) => Number(isSpanning(y.ev)) - Number(isSpanning(x.ev)) || y.end - y.start - (x.end - x.start) || x.start - y.start || sortEvents(x.ev, y.ev));
  const lanes: boolean[][] = [];
  for (const sg of segs) {
    let lane = 0;
    for (;;) {
      lanes[lane] ??= Array(n).fill(false);
      let free = true;
      for (let c = sg.start; c <= sg.end; c++) if (lanes[lane][c]) free = false;
      if (free) break;
      lane++;
    }
    for (let c = sg.start; c <= sg.end; c++) lanes[lane][c] = true;
    sg.lane = lane;
  }
  return segs;
}

/** Month grid days (Monday first), 5 or 6 full weeks. */
export function monthGrid(cursor: Date) {
  const first = startOfMonth(cursor);
  const start = startOfWeek(first);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const weeks = Math.ceil((dayDiff(lastDay, start) + 1) / 7);
  return Array.from({ length: weeks }, (_, w) => addDays(start, w * 7));
}
