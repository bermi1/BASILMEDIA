// Media store & office operations · shared types and helpers (gear, kits, consumables, rentals,
// reception, rooms, transport). Table names here match supabase/migrations/0007_store_ops.sql.
import type { Tone } from '@/os/ui';

export type GearStatus = 'available' | 'out' | 'reserved' | 'in_repair' | 'out_of_service';
export const GEAR_STATUS: Record<GearStatus, { label: string; tone: Tone }> = {
  available: { label: 'Available', tone: 'green' },
  out: { label: 'Out', tone: 'blue' },
  reserved: { label: 'Reserved', tone: 'amber' },
  in_repair: { label: 'In repair', tone: 'amber' },
  out_of_service: { label: 'Out of service', tone: 'red' },
};
export const CATEGORIES = ['Camera', 'Lens', 'Light', 'Audio', 'Drone', 'Gimbal', 'Monitor', 'Laptop', 'Drive', 'Tripod', 'Grip', 'Power', 'Streaming', 'Other'] as const;
export const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor', 'Damaged'] as const;
export const conditionTone = (c?: string): Tone => (c === 'Excellent' || c === 'Good' ? 'green' : c === 'Fair' ? 'amber' : c ? 'red' : 'grey');

export interface Gear {
  id: string;
  tag: string;
  name: string;
  category: string;
  make: string;
  model: string;
  serial: string;
  purchase_date: string | null;
  purchase_price: number;
  supplier: string;
  condition: string;
  location: string;
  accessories: string;
  insurance_expiry: string | null;
  warranty_expiry: string | null;
  photo_url: string;
  day_rate: number;
  useful_life_years: number;
  salvage_value: number;
  holder_id: string | null;
  status: GearStatus;
  notes: string;
  created_at?: string;
}

export interface Checkout {
  id: string;
  gear_id: string;
  kit_checkout_id: string | null;
  holder_id: string;
  project_id: string | null;
  checked_out_by: string;
  out_at: string;
  due_at: string;
  out_condition: string;
  out_note: string;
  out_photo_url: string;
  acknowledged_at: string | null;
  returned_at: string | null;
  in_condition: string | null;
  in_note: string;
  in_photo_url: string;
  checked_in_by: string | null;
  status: 'out' | 'returned';
  return_requested_at: string | null;
  extension_requested_to: string | null;
  extension_reason: string;
  created_at?: string;
}

export interface Kit {
  id: string;
  code: string;
  name: string;
  description: string;
  gear_ids: string[];
  extras: string[];
}
export interface KitLine { key: string; label: string; gear_id: string | null; out: boolean; in: boolean }
export interface KitCheckout {
  id: string;
  kit_id: string;
  holder_id: string;
  project_id: string | null;
  due_at: string;
  out_at: string | null;
  returned_at: string | null;
  checklist: KitLine[];
  status: 'packing' | 'out' | 'returned';
  created_by: string;
  created_at?: string;
}

export interface Reservation {
  id: string;
  gear_id: string;
  project_id: string | null;
  holder_id: string;
  start_date: string;
  end_date: string;
  note: string;
  status: 'reserved' | 'cancelled' | 'collected';
}

export interface Maintenance {
  id: string;
  gear_id: string;
  date: string;
  kind: string;
  description: string;
  vendor: string;
  cost: number;
  status: 'open' | 'done';
  done_at: string | null;
  logged_by: string;
}

export const INCIDENT_DECISIONS = {
  pending: 'Awaiting decision',
  repair: 'Repair (company cost)',
  insurance_claim: 'Insurance claim',
  staff_liable: 'Staff liable (recover cost)',
  client_liable: 'Bill client / renter',
  write_off: 'Write off',
} as const;
export type IncidentDecision = keyof typeof INCIDENT_DECISIONS;
export interface Incident {
  id: string;
  gear_id: string;
  checkout_id: string | null;
  kind: 'damage' | 'loss';
  description: string;
  photo_url: string;
  holder_id: string | null;
  reported_by: string;
  estimated_cost: number;
  decision: IncidentDecision;
  decision_note: string;
  decided_by: string | null;
  status: 'open' | 'closed';
  created_at: string;
}

export interface Consumable {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  min_level: number;
  unit_cost: number;
  location: string;
}
export interface StockMovement {
  id: string;
  consumable_id: string;
  kind: 'issue' | 'receive' | 'adjust';
  quantity: number;
  person_id: string | null;
  project_id: string | null;
  note: string;
  by_id: string;
  created_at: string;
}
export interface StockTake {
  id: string;
  started_by: string;
  started_at: string;
  completed_at: string | null;
  found_ids: string[];
  missing_ids: string[];
  status: 'open' | 'completed';
  note: string;
}

export interface Rental {
  id: string;
  agreement_no: string;
  renter_name: string;
  renter_company: string;
  renter_phone: string;
  renter_id_number: string;
  gear_ids: string[];
  start_date: string;
  end_date: string;
  pricing: 'day' | 'week';
  rate: number;
  deposit: number;
  late_fee_per_day: number;
  status: 'booked' | 'out' | 'returned' | 'closed';
  returned_at: string | null;
  inspection_note: string;
  damage_charge: number;
  deposit_refunded: number;
  created_by: string;
  created_at?: string;
}

export interface Visitor {
  id: string;
  name: string;
  company: string;
  phone: string;
  purpose: string;
  host_id: string | null;
  expected_at: string | null;
  signed_in_at: string | null;
  signed_out_at: string | null;
  status: 'expected' | 'in' | 'out';
  badge_no: string;
  pass_code: string;
  created_by: string;
  created_at: string;
}
export interface Parcel {
  id: string;
  received_at: string;
  courier: string;
  sender: string;
  recipient_id: string | null;
  description: string;
  tracking_no: string;
  status: 'waiting' | 'collected';
  collected_at: string | null;
  collected_by_name: string;
  logged_by: string;
}
export const ROOMS = ['Boardroom', 'Podcast studio', 'Edit suite'] as const;
export const ROOM_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
export interface RoomBooking {
  id: string;
  room: string;
  date: string;
  start_hour: number;
  end_hour: number;
  title: string;
  booked_by: string;
  status: 'booked' | 'cancelled';
}

export interface Vehicle {
  id: string;
  registration: string;
  make_model: string;
  seats: number;
  status: 'available' | 'on_trip' | 'in_service' | 'out_of_service';
  insurance_expiry: string | null;
  inspection_expiry: string | null;
  odometer: number;
  notes: string;
}
export const TRIP_STAGES = ['Scheduled', 'Dispatched', 'Arrived', 'Delivered', 'Returned'] as const;
export type TripStage = (typeof TRIP_STAGES)[number];
export interface Trip {
  id: string;
  vehicle_id: string;
  driver_id: string;
  project_id: string | null;
  purpose: string;
  origin: string;
  destination: string;
  depart_at: string;
  return_at: string | null;
  passengers: string;
  cargo: string;
  stage: TripStage;
  stage_log: { stage: TripStage; at: string; by: string }[];
  issue_note: string;
  created_at?: string;
}
export interface FuelLog {
  id: string;
  vehicle_id: string;
  trip_id: string | null;
  project_id: string | null;
  driver_id: string;
  date: string;
  litres: number;
  cost: number;
  odometer: number;
  station: string;
  receipt_url: string;
}
export interface VehicleIssue {
  id: string;
  vehicle_id: string;
  reported_by: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'resolved';
  created_at: string;
}

export interface ProjectRef { id: string; name: string; client_id?: string }

// ---------- dates (Africa/Dar_es_Salaam, DD/MM/YYYY) ----------
const TZ = 'Africa/Dar_es_Salaam';
export const fmtDate = (iso?: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00+03:00` : iso).toLocaleDateString('en-GB', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
export const fmtTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) : '—');
export const fmtDay = (iso?: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00+03:00` : iso).toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }) : '—');
export const fmtDateTime = (iso?: string | null) => (iso ? `${fmtDay(iso)} · ${fmtTime(iso)}` : '—');
/** YYYY-MM-DD in Dar es Salaam. */
export const dayKey = (d: Date | string = new Date()) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ });
export const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T12:00:00+03:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return dayKey(d);
};
export const hourNow = () => Number(new Date().toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }));
export const isOverdue = (c: Pick<Checkout, 'status' | 'due_at'>) => c.status === 'out' && new Date(c.due_at).getTime() < Date.now();
export const isDueToday = (c: Pick<Checkout, 'status' | 'due_at'>) => c.status === 'out' && !isOverdue(c) && dayKey(c.due_at) === dayKey();
export const hoursLate = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 36e5));
export const lateText = (iso: string) => {
  const h = hoursLate(iso);
  return h >= 48 ? `${Math.floor(h / 24)} days late` : `${h} h late`;
};
export const daysBetween = (a: string, b: string) => Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 864e5));
/** Local datetime-input value (YYYY-MM-DDTHH:mm) for an ISO time. */
export const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
export const fromLocalInput = (v: string) => new Date(v).toISOString();
export const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) => aStart <= bEnd && bStart <= aEnd;

// ---------- money ----------
/** Straight-line depreciation: book value today. */
export function bookValue(g: Pick<Gear, 'purchase_price' | 'purchase_date' | 'useful_life_years' | 'salvage_value'>, at = new Date()) {
  if (!g.purchase_date) return g.purchase_price;
  const years = (at.getTime() - new Date(g.purchase_date).getTime()) / (365.25 * 864e5);
  const life = g.useful_life_years || 4;
  const perYear = (g.purchase_price - (g.salvage_value || 0)) / life;
  return Math.max(g.salvage_value || 0, Math.round(g.purchase_price - perYear * Math.max(0, years)));
}
/** Days this item was out on project check-outs. */
export function daysOut(gearId: string, checkouts: Checkout[]) {
  return checkouts.filter((c) => c.gear_id === gearId).reduce((s, c) => s + daysBetween(c.out_at, c.returned_at ?? new Date().toISOString()), 0);
}
export function rentalDays(r: Pick<Rental, 'start_date' | 'end_date'>) {
  return Math.max(1, Math.round((new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) / 864e5) + 1);
}
export function rentalLateDays(r: Pick<Rental, 'end_date' | 'returned_at' | 'status'>) {
  const end = new Date(`${r.end_date}T18:00:00+03:00`).getTime();
  const back = r.returned_at ? new Date(r.returned_at).getTime() : r.status === 'out' ? Date.now() : end;
  return Math.max(0, Math.ceil((back - end) / 864e5));
}
export function rentalTotals(r: Rental) {
  const days = rentalDays(r);
  const base = r.pricing === 'week' ? Math.ceil(days / 7) * r.rate : days * r.rate;
  const late = rentalLateDays(r) * r.late_fee_per_day;
  const total = base + late + (r.damage_charge || 0);
  return { days, base, late, total, vat: 0 };
}
/** Rental income per gear item: each rental's base split evenly across its items. */
export function rentalIncome(gearId: string, rentals: Rental[]) {
  return rentals.filter((r) => r.gear_ids.includes(gearId) && r.status !== 'booked').reduce((s, r) => s + rentalTotals(r).base / Math.max(1, r.gear_ids.length), 0);
}

export const QR = (data: string, size = 300) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
export const assetUrl = (id: string) => `${typeof location !== 'undefined' ? location.origin : ''}/os/store/asset/${id}`;
export const abbr = (s: string) => s.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
