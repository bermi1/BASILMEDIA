// Growth, retainers and boss cockpit: shared types, constants and pure helpers (no React).
import type { Tone } from '@/os/ui';

// ---------- dates ----------
export const DAY = 864e5;
export const todayIso = () => new Date().toISOString().slice(0, 10);
export const isoPlus = (days: number, from = new Date()) => new Date(from.getTime() + days * DAY).toISOString().slice(0, 10);
export const monthKey = (d: string | Date = new Date()) => (typeof d === 'string' ? d.slice(0, 7) : d.toISOString().slice(0, 7));
export const addMonths = (key: string, n: number) => {
  const [y, m] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  return dt.toISOString().slice(0, 7);
};
export const daysBetween = (a: string, b: string = todayIso()) => Math.round((new Date(a.slice(0, 10)).getTime() - new Date(b.slice(0, 10)).getTime()) / DAY);
/** DD/MM/YYYY */
export const dmy = (d?: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '—');
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthLabel = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
export const dayLabel = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

// ---------- CRM ----------
export const LEAD_STAGES = ['New', 'Contacted', 'Meeting', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];
export const ORG_TYPES = ['Hospital', 'Bank', 'NGO', 'University', 'Government', 'Corporate', 'Event'] as const;
export const LOST_REASONS = ['Price', 'Timing', 'Chose another supplier', 'No budget', 'No response', 'Scope changed'];

export interface Organisation { id: string; name: string; type: string; sector: string; client_id: string | null; city: string; phone: string; email: string; website: string; notes: string; created_at?: string }
export interface Contact { id: string; organisation_id: string; full_name: string; title: string; phone: string; email: string; is_primary: boolean }
export interface Lead {
  id: string; title: string; organisation_id: string; contact_id: string | null; stage: LeadStage; value: number; probability: number;
  next_action: string; next_action_date: string | null; owner_id: string; source: string; service: string; lost_reason: string;
  booking_id: string | null; notes: string; created_at: string; stage_changed_at: string;
}
export interface LeadActivity { id: string; lead_id: string; kind: 'created' | 'stage' | 'note'; from_stage: string | null; to_stage: string | null; body: string; actor_id: string; created_at: string }

export interface ProposalLine { name: string; amount: number }
export interface Proposal {
  id: string; number: string; lead_id: string | null; organisation_id: string | null; title: string; client_name: string; status: 'draft' | 'awaiting_approval' | 'approved' | 'sent' | 'accepted' | 'declined';
  who_we_are: string; who_you_are: string; what_we_propose: string; client_gains: string; how_we_work: string; why_basil: string;
  lines: ProposalLine[]; discount_pct: number; vat_rate: number; created_by: string; created_at: string; sent_at: string | null;
}
export interface Instalment { label: string; pct: number; due_date: string | null; paid: boolean }
export interface Contract {
  id: string; number: string; title: string; kind: 'Contract' | 'MoU' | 'Retainer'; organisation_id: string | null; client_id: string | null; lead_id: string | null;
  value: number; start_date: string; end_date: string; status: 'draft' | 'awaiting_signature' | 'active' | 'expired' | 'terminated';
  instalments: Instalment[]; renewal_notice_days: number; signed_by_name: string; signed_at: string | null; signed_user_agent: string; created_at: string;
}
export const TENDER_STATUS = ['Identified', 'Preparing', 'Submitted', 'Won', 'Lost', 'Not pursued'] as const;
export interface Tender { id: string; title: string; issuer: string; reference: string; closes_on: string; value_estimate: number; status: (typeof TENDER_STATUS)[number]; owner_id: string; documents_needed: string; notes: string }
export interface GrowthEvent { id: string; title: string; kind: string; starts_on: string; ends_on: string; location: string; role: string; owner_id: string; cost: number; leads_expected: number; notes: string }

// ---------- Share Studio ----------
export interface ReferenceItem { id: string; project_id: string | null; title: string; client_name: string; sector: string; kind: string; year: number; thumbnail_url: string; video_url: string; summary: string; results: string; cleared: boolean; cleared_by: string | null; cleared_at: string | null }
export interface Cta { label: string; kind: 'whatsapp' | 'call' | 'email' | 'book' | 'link'; url: string }
export interface ShowcaseContact { name: string; role: string; phone: string; email: string; whatsapp: string }
export interface Showcase {
  id: string; slug: string; title: string; mode: 'linktree' | 'showcase'; recipient_name: string; organisation_id: string | null; lead_id: string | null;
  welcome: string; item_ids: string[]; ctas: Cta[]; contact: ShowcaseContact; published: boolean; expires_on: string | null; created_by: string; created_at: string;
}
export interface ShareEvent { id: string; showcase_id: string; kind: 'view' | 'like' | 'need' | 'cta'; item_id: string | null; visitor_id: string; user_agent: string; created_at: string }
export const DEAL_STEPS = ['Showcase', 'Proposal', 'Quotation', 'Contract signed', 'Deposit', 'Kick-off'];
export interface DealRoom {
  id: string; token: string; lead_id: string; title: string; client_name: string; value: number; showcase_id: string | null; proposal_id: string | null; quotation_url: string;
  contract_id: string | null; contract_terms: string; deposit_pct: number; deposit_paid_at: string | null; kickoff_at: string | null; step: number;
  signed_name: string; signed_at: string | null; signed_user_agent: string; prepared_by: string; expires_on: string; created_at: string;
}

export function leadScore(events: ShareEvent[]): { score: number; temp: 'cold' | 'warm' | 'hot'; tone: Tone } {
  const now = Date.now();
  let score = 0;
  for (const e of events) {
    const w = e.kind === 'need' ? 8 : e.kind === 'cta' ? 5 : e.kind === 'like' ? 3 : 1;
    const age = (now - new Date(e.created_at).getTime()) / DAY;
    score += age <= 7 ? w * 1.5 : age <= 30 ? w : w * 0.5;
  }
  score = Math.round(score);
  return score >= 15 ? { score, temp: 'hot', tone: 'red' } : score >= 5 ? { score, temp: 'warm', tone: 'amber' } : { score, temp: 'cold', tone: 'blue' };
}

// ---------- Retainers ----------
export const UNITS = [
  { key: 'shoot_days', label: 'Shoot days', group: 'Physical', short: 'shoot days' },
  { key: 'podcast_episodes', label: 'Podcast episodes', group: 'Physical', short: 'episodes' },
  { key: 'posts', label: 'Posts', group: 'Digital', short: 'posts' },
  { key: 'reels', label: 'Reels', group: 'Digital', short: 'reels' },
  { key: 'edited_photos', label: 'Edited photos', group: 'Digital', short: 'photos' },
] as const;
export type UnitKey = (typeof UNITS)[number]['key'];
export type Units = Partial<Record<UnitKey, number>>;
/** Extra-charge rate card (TSH, excl. VAT) used when a request goes over allowance. */
export const EXTRA_RATES: Record<UnitKey, number> = { shoot_days: 1800000, podcast_episodes: 900000, posts: 120000, reels: 450000, edited_photos: 15000 };
export const TIERS = ['Essential', 'Growth', 'Premium'] as const;

export interface Retainer {
  id: string; number: string; client_id: string; tier: string; monthly_fee: number; start_date: string; end_date: string; status: 'active' | 'paused' | 'ended';
  allowances: Units; rollover: 'none' | 'next_month'; rollover_cap_pct: number; account_manager_id: string; notes: string;
}
export interface LedgerRow { id: string; retainer_id: string; client_id: string; month: string; unit: UnitKey; qty: number; kind: 'usage' | 'adjustment'; source_id: string | null; note: string; created_at: string }
export const SHOOT_STATUS = ['Scheduled', 'Crew confirmed', 'On the way', 'Arrived', 'In progress', 'Wrapped', 'Completed'] as const;
export type ShootStatus = (typeof SHOOT_STATUS)[number];
export interface CrewSlot { user_id: string; role: string }
export interface CalItem {
  id: string; retainer_id: string; client_id: string; date: string; time: string; kind: 'shoot' | 'podcast' | 'delivery' | 'review' | 'post';
  title: string; location: string; map_url: string; status: string; crew: CrewSlot[]; call_time: string; checklist: { label: string; done: boolean }[];
  units: Units; signoff: { outcome: 'completed' | 'issue'; rating: number; comment: string; at: string; by: string } | null; gallery_slug: string; link: string;
}
export const REQUEST_STATUS = ['New', 'Reviewing', 'Quote needed', 'Scheduled', 'Declined'] as const;
export type RequestStatus = (typeof REQUEST_STATUS)[number];
export const REQUEST_TYPES = [
  { key: 'shoot', label: 'A shoot (photo + video)', units: { shoot_days: 1, edited_photos: 40 } as Units },
  { key: 'podcast', label: 'A podcast episode', units: { podcast_episodes: 1 } as Units },
  { key: 'reel', label: 'A reel / short video', units: { reels: 1 } as Units },
  { key: 'posts', label: 'Social posts (set of 4)', units: { posts: 4 } as Units },
  { key: 'photos', label: 'Edited photos (set of 30)', units: { edited_photos: 30 } as Units },
] as const;
export interface ClientRequest {
  id: string; number: string; client_id: string; retainer_id: string; type: string; title: string; preferred_dates: string[]; location: string; deliverables: string;
  urgency: 'Normal' | 'Soon' | 'Urgent'; status: RequestStatus; units: Units; over_allowance: boolean; quote_amount: number; quote_status: 'none' | 'sent' | 'accepted' | 'declined';
  requested_by: string; note: string; created_at: string;
}
export interface Concern { id: string; client_id: string; subject: string; body: string; severity: 'Low' | 'Medium' | 'High'; status: 'Open' | 'In progress' | 'Resolved'; raised_by: string; response: string; created_at: string }

export interface Balance { unit: UnitKey; label: string; allowance: number; carried: number; used: number; left: number; pct: number }

/** Per-unit balance for a month: monthly allowance + capped rollover of last month's unused, minus usage. Rollover expires after one month. */
export function balanceFor(r: Retainer, ledger: LedgerRow[], month: string): Balance[] {
  const usedIn = (m: string, u: UnitKey) => ledger.filter((l) => l.retainer_id === r.id && l.month === m && l.unit === u).reduce((s, l) => s + Number(l.qty), 0);
  const startMonth = monthKey(r.start_date);
  return UNITS.filter((u) => (r.allowances[u.key] ?? 0) > 0).map((u) => {
    const allowance = Number(r.allowances[u.key] ?? 0);
    const prev = addMonths(month, -1);
    const carried = r.rollover === 'next_month' && prev >= startMonth ? Math.min(Math.max(0, allowance - usedIn(prev, u.key)), Math.floor((allowance * r.rollover_cap_pct) / 100)) : 0;
    const used = usedIn(month, u.key);
    const total = allowance + carried;
    return { unit: u.key, label: u.label, allowance, carried, used, left: total - used, pct: total > 0 ? Math.round((used / total) * 100) : 0 };
  });
}
export const overallUse = (b: Balance[]) => {
  const t = b.reduce((s, x) => s + x.allowance + x.carried, 0);
  return t ? Math.round((b.reduce((s, x) => s + Math.min(x.used, x.allowance + x.carried), 0) / t) * 100) : 0;
};

/** What a request would do to the balance; extra units are quoted from the rate card. */
export function requestImpact(units: Units, balance: Balance[]) {
  const lines = (Object.entries(units) as [UnitKey, number][]).map(([unit, qty]) => {
    const b = balance.find((x) => x.unit === unit);
    const left = b ? b.left : 0;
    const extra = Math.max(0, qty - Math.max(0, left));
    return { unit, label: UNITS.find((u) => u.key === unit)!.label, qty, left, extra, cost: extra * EXTRA_RATES[unit] };
  });
  return { lines, over: lines.some((l) => l.extra > 0), quote: lines.reduce((s, l) => s + l.cost, 0) };
}

export interface Health { tone: 'green' | 'amber' | 'red'; score: number; reasons: string[] }
/** Client health: rating, open concerns, renewal distance, allowance pace and stalled requests. */
export function clientHealth(r: Retainer, opts: { balance: Balance[]; concerns: Concern[]; items: CalItem[]; requests: ClientRequest[]; overdueInvoices?: number }): Health {
  let score = 100;
  const reasons: string[] = [];
  const open = opts.concerns.filter((c) => c.client_id === r.client_id && c.status !== 'Resolved');
  if (open.length) { score -= open.some((c) => c.severity === 'High') ? 30 : 15; reasons.push(`${open.length} open concern${open.length > 1 ? 's' : ''}`); }
  const rated = opts.items.filter((i) => i.client_id === r.client_id && i.signoff?.rating);
  const avg = rated.length ? rated.reduce((s, i) => s + (i.signoff!.rating || 0), 0) / rated.length : 5;
  if (avg < 3.5) { score -= 25; reasons.push(`Average shoot rating ${avg.toFixed(1)}★`); } else if (avg < 4.2) { score -= 10; reasons.push(`Average shoot rating ${avg.toFixed(1)}★`); }
  const issues = opts.items.filter((i) => i.client_id === r.client_id && i.signoff?.outcome === 'issue').length;
  if (issues) { score -= 10 * issues; reasons.push(`${issues} shoot${issues > 1 ? 's' : ''} reported with an issue`); }
  const days = daysBetween(r.end_date);
  if (days <= 30) { score -= 20; reasons.push(`Renews in ${days} days`); } else if (days <= 60) { score -= 10; reasons.push(`Renews in ${days} days`); }
  const use = overallUse(opts.balance);
  if (use < 30 && new Date().getDate() > 20) { score -= 15; reasons.push(`Only ${use}% of allowance used this month`); }
  const stalled = opts.requests.filter((q) => q.client_id === r.client_id && ['New', 'Reviewing'].includes(q.status) && daysBetween(todayIso(), q.created_at) > 3).length;
  if (stalled) { score -= 10; reasons.push(`${stalled} request${stalled > 1 ? 's' : ''} waiting over 3 days`); }
  if (opts.overdueInvoices) { score -= 15; reasons.push('Invoice overdue'); }
  score = Math.max(0, score);
  return { tone: score >= 75 ? 'green' : score >= 50 ? 'amber' : 'red', score, reasons };
}
export const renewalBand = (end: string) => {
  const d = daysBetween(end);
  return d < 0 ? null : d <= 30 ? 30 : d <= 60 ? 60 : d <= 90 ? 90 : null;
};

// ---------- Boss ----------
export interface Target { id: string; year: number; metric: string; label: string; unit: 'tsh' | 'count' | 'pct'; target: number; actual: number; sort_order: number }
export interface Decision { id: string; decided_on: string; title: string; context: string; decision: string; decided_by: string; owner_id: string; review_on: string | null; status: 'Active' | 'Reviewed' | 'Reversed'; created_at: string }

export const stageTone = (s: string): Tone => (s === 'Won' ? 'green' : s === 'Lost' ? 'red' : s === 'Negotiation' || s === 'Proposal Sent' ? 'amber' : 'blue');
export const fmtUnit = (t: Target, v: number) => (t.unit === 'tsh' ? (Math.abs(v) >= 1e6 ? `TSH ${(v / 1e6).toFixed(1)}M` : `TSH ${Math.round(v).toLocaleString('en-GB')}`) : t.unit === 'pct' ? `${v}%` : v.toLocaleString('en-GB'));

/** Generic reader for finance rows whose schema is owned by another module. */
export const rowAmount = (r: Record<string, unknown>) => Number(r.amount ?? r.total ?? r.amount_tsh ?? r.total_amount ?? 0) || 0;
export const rowDate = (r: Record<string, unknown>) => String(r.date ?? r.received_on ?? r.paid_on ?? r.spent_on ?? r.issued_on ?? r.created_at ?? '').slice(0, 10);
