// Workflow steps. Each calls a SECURITY DEFINER SQL function (0007_store_ops.sql) when Supabase is
// configured; in demo mode the JS twin below mimics it against the browser store.
import { demoTable, newId, nowIso, rpc, insertRow, updateRow, type Row } from '@/os/lib/store';
import { notify } from '@/os/lib/notify';
import { supabase } from '@/lib/supabase';
import type { Checkout, Consumable, Gear, KitCheckout, KitLine, Kit, Reservation, RoomBooking, Trip, TripStage, Visitor } from './data';
import { TRIP_STAGES, overlaps, dayKey, fmtDateTime } from './data';

const STORE_KEEPER = 'u-store';
const GM = 'u-gm';
const dnote = (user: string, title: string, body = '', link = '', kind: 'info' | 'alert' | 'task' | 'approval' = 'info') =>
  demoTable('notifications').push({ id: newId(), user_id: user, title, body, link, kind, read_at: null, created_at: nowIso() });
const find = <T,>(table: string, id: string) => demoTable(table).find((r) => r.id === id) as unknown as T | undefined;
const patch = (table: string, id: string, p: Record<string, unknown>) => {
  const rows = demoTable(table);
  const i = rows.findIndex((r) => r.id === id);
  if (i >= 0) rows[i] = { ...rows[i], ...p };
};

// ---------- check-out / check-in ----------
export interface CheckoutInput {
  gear_ids: string[];
  holder_id: string;
  project_id: string | null;
  due_at: string;
  condition: string;
  note: string;
  photo_url: string;
  kit_checkout_id?: string | null;
}
export function checkoutGear(i: CheckoutInput, actor: string) {
  return rpc<string[]>('gear_checkout', {
    _gear_ids: i.gear_ids, _holder: i.holder_id, _project: i.project_id, _due: i.due_at, _condition: i.condition, _note: i.note, _photo: i.photo_url, _kit_checkout: i.kit_checkout_id ?? null,
  });
}

export function acknowledgeCheckouts(ids: string[]) {
  return rpc('gear_acknowledge', { _ids: ids });
}

export function checkinGear(checkoutId: string, condition: string, note: string, photo: string, actor: string) {
  return rpc('gear_checkin', { _checkout: checkoutId, _condition: condition, _note: note, _photo: photo });
}

export function requestReturnHelp(checkoutId: string, kind: 'return' | 'extend', to: string | null, reason: string) {
  return rpc('gear_request_extension', { _checkout: checkoutId, _kind: kind, _to: to, _reason: reason });
}

export function decideExtension(checkoutId: string, approve: boolean) {
  return rpc('gear_decide_extension', { _checkout: checkoutId, _approve: approve });
}

// ---------- kits ----------
export function startKitCheckout(kit: Kit, gearNames: Record<string, string>, holder_id: string, project_id: string | null, due_at: string, actor: string) {
  const checklist: KitLine[] = [
    ...kit.gear_ids.map((g, i) => ({ key: `g${i}`, label: gearNames[g] ?? g, gear_id: g, out: false, in: false })),
    ...kit.extras.map((e, i) => ({ key: `x${i}`, label: e, gear_id: null, out: false, in: false })),
  ];
  return insertRow<KitCheckout>('kit_checkouts', { kit_id: kit.id, holder_id, project_id, due_at, out_at: null, returned_at: null, checklist, status: 'packing', created_by: actor });
}
export const saveChecklist = (kc: KitCheckout, checklist: KitLine[]) => updateRow('kit_checkouts', kc.id, { checklist });

export async function confirmKitOut(kc: KitCheckout, checklist: KitLine[], condition: string, note: string, photo: string, actor: string) {
  const gear = checklist.filter((l) => l.out && l.gear_id).map((l) => l.gear_id!) as string[];
  if (!checklist.some((l) => l.out)) throw new Error('Tick what is packed first');
  if (gear.length) await checkoutGear({ gear_ids: gear, holder_id: kc.holder_id, project_id: kc.project_id, due_at: kc.due_at, condition, note, photo_url: photo, kit_checkout_id: kc.id }, actor);
  await updateRow('kit_checkouts', kc.id, { checklist, status: 'out', out_at: nowIso() });
}

export async function kitCheckin(kc: KitCheckout, checklist: KitLine[], openCheckouts: Checkout[], condition: string, note: string, actor: string) {
  for (const l of checklist) {
    if (!l.in || !l.gear_id) continue;
    const c = openCheckouts.find((x) => x.gear_id === l.gear_id && x.kit_checkout_id === kc.id && x.status === 'out');
    if (c) await checkinGear(c.id, condition, note, '', actor);
  }
  const all = checklist.filter((l) => l.out).every((l) => l.in);
  await updateRow('kit_checkouts', kc.id, { checklist, ...(all ? { status: 'returned', returned_at: nowIso() } : {}) });
  return all;
}

// ---------- reservations ----------
export function reservationConflicts(gear_id: string, start: string, end: string, reservations: Reservation[], checkouts: Checkout[], ignoreId?: string) {
  const res = reservations.filter((r) => r.id !== ignoreId && r.gear_id === gear_id && r.status === 'reserved' && overlaps(start, end, r.start_date, r.end_date));
  const out = checkouts.filter((c) => c.gear_id === gear_id && c.status === 'out' && dayKey(c.due_at) >= start);
  return { res, out };
}
export async function reserveGear(r: Omit<Reservation, 'id' | 'status'>, reservations: Reservation[], checkouts: Checkout[]) {
  if (r.end_date < r.start_date) throw new Error('End date is before start date');
  const { res } = reservationConflicts(r.gear_id, r.start_date, r.end_date, reservations, checkouts);
  if (res.length) throw new Error(`Clashes with an existing reservation ${res[0].start_date} → ${res[0].end_date}`);
  const row = await insertRow('gear_reservations', { ...r, status: 'reserved' });
  if (!supabase) {
    const g = find<Gear>('gear_items', r.gear_id);
    if (g?.status === 'available' && r.start_date <= dayKey()) patch('gear_items', r.gear_id, { status: 'reserved' });
  }
  return row;
}

// ---------- consumables ----------
export function moveStock(c: Consumable, kind: 'issue' | 'receive' | 'adjust', qty: number, person: string | null, project: string | null, note: string, actor: string) {
  return rpc('stock_move', { _consumable: c.id, _kind: kind, _qty: qty, _person: person, _project: project, _note: note });
}
export function requestRestock(c: Consumable, qty: number) {
  return notify(GM, `Restock request · ${c.name}`, `${qty} ${c.unit} · est. TSH ${(qty * c.unit_cost).toLocaleString('en-GB')} · ${c.quantity} left (min ${c.min_level})`, '/os/store/consumables', 'approval');
}

// ---------- reception ----------
const code = () => `BMV-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
export function signInVisitor(v: Partial<Visitor> & { name: string }, actor: string) {
  return rpc<string>('visitor_sign_in', { _visitor: v.id ?? null, _name: v.name, _company: v.company ?? '', _phone: v.phone ?? '', _purpose: v.purpose ?? '', _host: v.host_id ?? null });
}
export function preRegister(v: Pick<Visitor, 'name' | 'company' | 'phone' | 'purpose' | 'host_id' | 'expected_at'>, actor: string) {
  return insertRow<Visitor>('visitors', { ...v, signed_in_at: null, signed_out_at: null, status: 'expected', badge_no: '', pass_code: code(), created_by: actor });
}
export const signOutVisitor = (id: string) => updateRow('visitors', id, { status: 'out', signed_out_at: nowIso() });

export async function logParcel(p: { courier: string; sender: string; recipient_id: string; description: string; tracking_no: string }, actor: string) {
  const row = await insertRow('parcels', { ...p, received_at: nowIso(), status: 'waiting', collected_at: null, collected_by_name: '', logged_by: actor });
  await notify(p.recipient_id, 'A parcel is waiting at reception', `${p.description} · from ${p.sender}`, '', 'task');
  return row;
}
export const collectParcel = (id: string, by: string) => updateRow('parcels', id, { status: 'collected', collected_at: nowIso(), collected_by_name: by });

export async function bookRoom(b: Omit<RoomBooking, 'id' | 'status'>, existing: RoomBooking[]) {
  if (b.end_hour <= b.start_hour) throw new Error('End must be after start');
  if (b.start_hour < 8 || b.end_hour > 18) throw new Error('Rooms can be booked 08:00–18:00');
  const clash = existing.find((x) => x.status === 'booked' && x.room === b.room && x.date === b.date && b.start_hour < x.end_hour && x.start_hour < b.end_hour);
  if (clash) throw new Error(`${b.room} is already booked ${String(clash.start_hour).padStart(2, '0')}:00–${String(clash.end_hour).padStart(2, '0')}:00 (${clash.title})`);
  return insertRow('room_bookings', { ...b, status: 'booked' });
}
export const cancelRoom = (id: string) => updateRow('room_bookings', id, { status: 'cancelled' });

// ---------- transport ----------
export function advanceTrip(t: Trip, to: TripStage, actor: string, note = '') {
  return rpc('trip_advance', { _trip: t.id, _stage: to, _note: note });
}

export const asRows = <T,>(x: T[]) => x as unknown as Row[];
