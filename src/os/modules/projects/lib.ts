// Projects, production & people: shared types, rules and helpers (mirrors 0005_projects.sql).
import { PROJECT_STAGES } from '@/os/lib/shared-seed';
import type { Person } from '@/os/lib/store';
import type { Tone } from '@/os/ui';

export { PROJECT_STAGES };

// ---------- types ----------
export interface Client { id: string; name: string; sector: string; contact_name: string; phone: string; email: string; address: string; tin: string }
export interface Project {
  id: string; name: string; client_id: string; service: string; stage: string; lead_id: string;
  start_date: string; end_date: string; budget: number; contract_value: number; priority: string;
  location: string; health: string; spent?: number; code?: string; description?: string; template?: string;
}
export type TaskStatus = 'To do' | 'In progress' | 'Done';
export interface CheckItem { text: string; done: boolean }
export interface Task {
  id: string; project_id: string; title: string; description: string; assignee_id: string | null; due_date: string;
  priority: string; status: TaskStatus; checklist: CheckItem[]; minutes_logged: number; created_by: string; created_at: string; completed_at: string | null;
}
export interface TaskComment { id: string; task_id: string; author_id: string; body: string; created_at: string }
export interface Crew { id: string; project_id: string; user_id: string; role: string; days?: number }
export interface Shoot {
  id: string; project_id: string; title: string; shoot_date: string; call_time: string; wrap_time: string; location: string;
  contact_name: string; contact_phone: string; shot_list: CheckItem[]; equipment: string; emergency_contacts: string;
  nearest_hospital: string; notes: string; status: 'Planned' | 'Wrapped'; wrapped_at: string | null;
}
export interface ShootCrew { id: string; shoot_id: string; user_id: string; role: string; call_time: string; confirmed_at: string | null }
export interface Deliverable {
  id: string; project_id: string; title: string; spec: string; owner_id: string | null; due_date: string;
  post_status: string; revision_round: number; delivered_at: string | null;
}
export interface MediaCard { id: string; shoot_id: string; project_id: string; label: string; kind: string; size_gb: number; shot_by: string | null; formatted: boolean; created_at: string }
export interface FootageCopy { id: string; card_id: string; location: string; verified: boolean; verified_by: string | null; created_at: string }
export interface WeeklyReport {
  id: string; author_id: string; week_start: string; activities: string; hours: number; achievements: string;
  challenges: string; next_week: string; support_needed: string; created_at: string;
}
export interface Suggestion {
  id: string; author_id: string | null; anonymous: boolean; category: string; body: string; status: string;
  reply: string; replied_by: string | null; replied_at: string | null; created_at: string;
}
export interface LeaveRequest {
  id: string; user_id: string; leave_type: string; start_date: string; end_date: string; days: number; reason: string;
  status: 'Pending' | 'Approved' | 'Rejected'; decided_by: string | null; decided_at: string | null; decision_note: string; created_at: string;
}
export interface LeaveBalance { id: string; user_id: string; year: number; annual_days: number }
export interface Attendance { id: string; user_id: string; day: string; clock_in: string; clock_out: string | null; lat: number | null; lng: number | null; place: string }
export interface Announcement { id: string; title: string; body: string; author_id: string; pinned: boolean; created_at: string }
export interface AnnouncementAck { id: string; announcement_id: string; user_id: string; created_at: string }
export interface StaffDetail { id: string; user_id: string; job_title: string; department: string; birthday: string; joined: string; emergency_contact: string }

// ---------- constants ----------
export const POST_STEPS = ['Not started', 'Rough cut', 'Fine cut', 'Colour', 'Sound', 'Graphics', 'Export', 'Ready for review'];
export const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];
export const TASK_STATUSES: TaskStatus[] = ['To do', 'In progress', 'Done'];
export const SUGGESTION_CATEGORIES = ['Idea', 'Complaint', 'Concern', 'Safety', 'Praise'];
export const SUGGESTION_STATUSES = ['Under review', 'Accepted', 'Done'];
export const LEAVE_TYPES = ['Annual', 'Sick', 'Compassionate', 'Maternity / Paternity', 'Unpaid'];
export const ANNUAL_LEAVE_DEFAULT = 28;
export const CREW_ROLES = ['Project lead', 'Director', 'Camera A', 'Camera B', 'Drone', 'Sound', 'Photographer', 'Editor', 'Colourist', 'Stream operator', 'Producer', 'Driver', 'Assistant'];
export const LEADER_ROLES = ['boss', 'gm_cfo'] as const;

// ---------- dates (Africa/Dar_es_Salaam, DD/MM/YYYY) ----------
export const today = () => isoDay(new Date());
export function isoDay(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
export const addDays = (iso: string, n: number) => isoDay(new Date(new Date(iso + 'T12:00:00').getTime() + n * 864e5));
export const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 864e5);
export function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
export function fmtDay(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
export function fmtTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dar_es_Salaam' });
}
export function fmtWhen(iso?: string | null) {
  if (!iso) return '—';
  return `${fmtDate(iso)} ${fmtTime(iso)}`;
}
export const fmtMinutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim() : `${m} min`);
/** Monday of the week containing `iso`. */
export function weekStart(iso = today()) {
  const d = new Date(iso + 'T12:00:00');
  const dow = (d.getDay() + 6) % 7;
  return addDays(iso, -dow);
}
export function dueLabel(iso: string) {
  const n = daysBetween(today(), iso);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  return n < 0 ? `${-n} days late` : n < 7 ? fmtDay(iso) : fmtDate(iso);
}
export const isOverdue = (t: Task) => t.status !== 'Done' && !!t.due_date && t.due_date < today();

// ---------- health ----------
export interface Health { tone: 'green' | 'amber' | 'red'; label: string; reasons: string[] }
const EARLY = PROJECT_STAGES.indexOf('Final Delivery');
/** Auto health from deadline, budget and overdue tasks. */
export function projectHealth(p: Project, tasks: Task[]): Health {
  const red: string[] = [], amber: string[] = [];
  const stageIx = PROJECT_STAGES.indexOf(p.stage);
  const left = daysBetween(today(), p.end_date);
  const spent = Number(p.spent ?? 0), budget = Number(p.budget ?? 0);
  const overdue = tasks.filter((t) => t.project_id === p.id && isOverdue(t)).length;
  if (stageIx < EARLY && left < 0) red.push(`Past deadline by ${-left} day${left === -1 ? '' : 's'}`);
  else if (stageIx < EARLY && left <= 3) amber.push(`Deadline in ${left} day${left === 1 ? '' : 's'}`);
  if (budget > 0 && spent > budget) red.push(`Over budget by ${Math.round(((spent - budget) / budget) * 100)}%`);
  else if (budget > 0 && spent >= budget * 0.8) amber.push(`${Math.round((spent / budget) * 100)}% of budget spent`);
  if (overdue >= 3) red.push(`${overdue} overdue tasks`);
  else if (overdue > 0) amber.push(`${overdue} overdue task${overdue > 1 ? 's' : ''}`);
  if (red.length) return { tone: 'red', label: 'Red', reasons: [...red, ...amber] };
  if (amber.length) return { tone: 'amber', label: 'Amber', reasons: amber };
  return { tone: 'green', label: 'Green', reasons: ['On time, within budget'] };
}
export const HEALTH_DOT: Record<string, string> = { green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-600' };

// ---------- templates ----------
export interface Template {
  key: string; name: string; service: string; days: number; budget: number; blurb: string;
  tasks: [string, number, string][]; // title, due offset (days from start), crew role who owns it
  deliverables: [string, string][]; // title, spec
  shootDays: number;
}
export const TEMPLATES: Template[] = [
  { key: 'event', name: 'Event Coverage', service: 'Event Coverage', days: 14, budget: 6000000, shootDays: 1, blurb: 'One-day event, highlights film and photos.',
    tasks: [['Confirm run of show with client', 1, 'Project lead'], ['Recce venue and power points', 3, 'Camera A'], ['Book crew and kit', 3, 'Project lead'], ['Back up all cards (2 copies)', 6, 'Camera A'], ['Rough cut of highlights', 9, 'Editor'], ['Deliver photo gallery', 10, 'Photographer']],
    deliverables: [['Highlights film', '3–5 min · 1080p'], ['Social cut', '60 s · 9:16'], ['Photo gallery', '120 edited photos']] },
  { key: 'documentary', name: 'Documentary', service: 'Documentary', days: 45, budget: 9000000, shootDays: 4, blurb: 'Research, interviews, b-roll and a long-form edit.',
    tasks: [['Research and story outline', 5, 'Director'], ['Book interviews and releases', 10, 'Producer'], ['Location recce', 12, 'Director'], ['Transcribe interviews', 22, 'Assistant'], ['Paper edit', 25, 'Director'], ['Rough cut', 32, 'Editor'], ['Subtitles (English & Swahili)', 40, 'Editor']],
    deliverables: [['Documentary film', '12–20 min · 4K master'], ['Trailer', '90 s'], ['Subtitled version', 'SRT EN + SW']] },
  { key: 'corporate', name: 'Corporate Video', service: 'Corporate Video', days: 21, budget: 5000000, shootDays: 2, blurb: 'Script, interviews, b-roll and a brand film.',
    tasks: [['Agree script with client', 3, 'Producer'], ['Shot list and schedule', 5, 'Director'], ['Interview prep and releases', 7, 'Producer'], ['Rough cut', 13, 'Editor'], ['Graphics and logo animation', 15, 'Editor']],
    deliverables: [['Corporate film', '2–3 min · 1080p'], ['Cut-downs', '3 × 30 s']] },
  { key: 'podcast', name: 'Podcast Series', service: 'Podcast Series', days: 84, budget: 2400000, shootDays: 6, blurb: 'Studio recording, video and audio episodes.',
    tasks: [['Guest list and topics', 4, 'Producer'], ['Studio set and sound check', 6, 'Sound'], ['Record episodes 1–3', 14, 'Camera A'], ['Edit episode 1', 18, 'Editor'], ['Publish schedule', 20, 'Producer']],
    deliverables: [['Episode 1', 'Video 30 min + audio'], ['Episode 2', 'Video 30 min + audio'], ['Episode 3', 'Video 30 min + audio'], ['Shorts pack', '6 × 45 s']] },
  { key: 'live', name: 'Live Stream', service: 'Live Streaming', days: 10, budget: 8000000, shootDays: 2, blurb: 'Multi-camera stream with recap reels.',
    tasks: [['Internet and bandwidth test at venue', 2, 'Stream operator'], ['Stream keys and platforms set up', 3, 'Stream operator'], ['Graphics: lower thirds and slates', 3, 'Editor'], ['Rehearsal with run of show', 4, 'Director'], ['Recap reel day 1', 6, 'Editor']],
    deliverables: [['Live stream recording', 'Full sessions · 1080p'], ['Daily recap reel', '90 s each'], ['Closing highlights film', '3 min']] },
  { key: 'photo', name: 'Photography Gallery', service: 'Photography', days: 7, budget: 1800000, shootDays: 1, blurb: 'Shoot, select, retouch and deliver a gallery.',
    tasks: [['Shot list with client', 1, 'Photographer'], ['Back up RAW files', 2, 'Photographer'], ['Selects and retouch', 4, 'Photographer'], ['Upload watermarked gallery', 5, 'Photographer']],
    deliverables: [['Edited gallery', '80–150 photos · JPEG'], ['Print-ready selects', '10 × TIFF']] },
  { key: 'retainer', name: 'Monthly Retainer', service: 'Monthly Retainer', days: 30, budget: 3200000, shootDays: 2, blurb: 'Recurring monthly content for a retainer client.',
    tasks: [['Monthly content plan with client', 2, 'Producer'], ['Shoot story 1 and 2', 8, 'Camera A'], ['Shoot story 3 and 4', 15, 'Camera A'], ['Edit stories', 22, 'Editor'], ['Monthly report to client', 29, 'Project lead']],
    deliverables: [['Story 1', '90 s'], ['Story 2', '90 s'], ['Story 3', '90 s'], ['Story 4', '90 s']] },
];

// ---------- stage gates ----------
export interface GateCtx { tasks: Task[]; shoots: Shoot[]; deliverables: Deliverable[]; cards: MediaCard[]; copies: FootageCopy[] }
/** Reason a project may not enter `stage`, or null. Checked for every stage passed on a forward move. */
export function gateFor(p: Project, stage: string, c: GateCtx): string | null {
  const shoots = c.shoots.filter((s) => s.project_id === p.id);
  const dels = c.deliverables.filter((d) => d.project_id === p.id);
  const cards = c.cards.filter((m) => m.project_id === p.id);
  switch (stage) {
    case 'Pre-production':
      return p.lead_id ? null : 'Assign a project lead first.';
    case 'Shoot':
      return shoots.length ? null : 'Schedule at least one shoot day with a call sheet first.';
    case 'Edit': {
      const unsafe = cards.filter((m) => verifiedCopies(m, c.copies) < 2);
      return unsafe.length ? `Footage not safe: ${unsafe.map((m) => m.label).join(', ')} need 2 verified copies.` : null;
    }
    case 'Internal Review':
      return dels.some((d) => POST_STEPS.indexOf(d.post_status) >= 1) ? null : 'At least one deliverable needs a rough cut.';
    case 'Client Review':
      return dels.some((d) => d.post_status === 'Ready for review') ? null : 'Client Review needs a draft deliverable marked "Ready for review".';
    case 'Final Delivery':
      return dels.length && dels.every((d) => d.post_status === 'Ready for review') ? null : 'Every deliverable must be "Ready for review" (client approved).';
    case 'Invoice':
      return dels.every((d) => d.delivered_at) ? null : 'Mark every deliverable as delivered to the client first.';
    case 'Archive': {
      const open = c.tasks.filter((t) => t.project_id === p.id && t.status !== 'Done').length;
      return open ? `Close the ${open} open task${open > 1 ? 's' : ''} first.` : null;
    }
  }
  return null;
}
export function checkMove(p: Project, target: string, c: GateCtx): string | null {
  const from = PROJECT_STAGES.indexOf(p.stage), to = PROJECT_STAGES.indexOf(target);
  for (let i = Math.max(from + 1, 0); i <= to; i++) {
    const why = gateFor(p, PROJECT_STAGES[i], c);
    if (why) return `${PROJECT_STAGES[i]}: ${why}`;
  }
  return null;
}

// ---------- footage safety ----------
export const verifiedCopies = (m: MediaCard, copies: FootageCopy[]) => copies.filter((c) => c.card_id === m.id && c.verified).length;
export type FootageState = 'safe' | 'pending' | 'risk';
/** Red "at risk" when a card has fewer than 2 verified copies 24 h after wrap. */
export function cardState(m: MediaCard, shoot: Shoot | undefined, copies: FootageCopy[]): FootageState {
  if (verifiedCopies(m, copies) >= 2) return 'safe';
  const wrapped = shoot?.wrapped_at ? new Date(shoot.wrapped_at).getTime() : null;
  if (wrapped && Date.now() - wrapped > 24 * 3600e3) return 'risk';
  return 'pending';
}
export function footageAtRisk(cards: MediaCard[], shoots: Shoot[], copies: FootageCopy[]) {
  return cards.filter((m) => cardState(m, shoots.find((s) => s.id === m.shoot_id), copies) === 'risk');
}

// ---------- messages ----------
export const mapsLink = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
export const waLink = (text: string, phone?: string) => `https://wa.me/${(phone ?? '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
export const telLink = (phone: string) => `tel:${phone.replace(/\s/g, '')}`;

export function taskSms(t: Pick<Task, 'title' | 'due_date' | 'priority'>, projectName: string, assigner: string) {
  return `Basil Media: ${assigner} assigned you "${t.title}" (${projectName}). Due ${fmtDate(t.due_date)}, priority ${t.priority}. Open the app: basilmedia.co.tz/app?tab=tasks`;
}

export function callSheetText(s: Shoot, p: Project | undefined, crew: ShootCrew[], people: Person[]) {
  const name = (id: string) => people.find((x) => x.id === id)?.full_name ?? 'Crew';
  const lines = [
    `*BASIL MEDIA · CALL SHEET*`,
    `*${p?.name ?? ''}* — ${s.title}`,
    `📅 ${fmtDay(s.shoot_date)} ${fmtDate(s.shoot_date)}`,
    `⏰ Crew call ${s.call_time} · wrap ${s.wrap_time}`,
    `📍 ${s.location}`,
    `Map: ${mapsLink(s.location)}`,
    `On-site contact: ${s.contact_name} ${s.contact_phone}`,
    ``,
    `*Crew*`,
    ...crew.map((c) => `• ${c.call_time} ${name(c.user_id)} — ${c.role}`),
    ``,
    `*Shot list*`,
    ...s.shot_list.map((x, i) => `${i + 1}. ${x.text}`),
    ``,
    `*Kit*: ${s.equipment}`,
    `*Emergency*: ${s.emergency_contacts}`,
    `*Nearest hospital*: ${s.nearest_hospital}`,
    s.notes ? `\nNotes: ${s.notes}` : '',
    `\nPlease reply ✅ or confirm in the Basil Media app.`,
  ];
  return lines.filter((l) => l !== '').join('\n').replace(/\n{3,}/g, '\n\n');
}

const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** Opens a clean printable call sheet in a new window. */
export function printCallSheet(s: Shoot, p: Project | undefined, crew: ShootCrew[], people: Person[]) {
  const name = (id: string) => people.find((x) => x.id === id);
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Call sheet · ${esc(s.title)}</title>
<style>body{font-family:'DM Sans',system-ui,sans-serif;color:#0B1B33;margin:28px;font-size:13px}h1{font-size:22px;margin:4px 0}h2{font-size:14px;margin:18px 0 6px;color:#0A2F5C;border-bottom:2px solid #0F6EC2;padding-bottom:3px}
table{width:100%;border-collapse:collapse}td,th{border:1px solid #DCE8F5;padding:5px 7px;text-align:left;vertical-align:top}th{background:#EAF3FC}.k{font:700 10px monospace;letter-spacing:.15em;color:#0F6EC2}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.box{border:1px solid #DCE8F5;border-radius:8px;padding:8px 10px}.red{color:#B91C1C;font-weight:700}</style></head><body>
<div class="k">BASIL MEDIA · CALL SHEET</div><h1>${esc(p?.name ?? '')} — ${esc(s.title)}</h1>
<div>${fmtDay(s.shoot_date)} ${fmtDate(s.shoot_date)} · Crew call <b>${esc(s.call_time)}</b> · Wrap ${esc(s.wrap_time)}</div>
<div class="grid" style="margin-top:12px"><div class="box"><b>Location</b><br>${esc(s.location)}<br><small>${esc(mapsLink(s.location))}</small></div><div class="box"><b>On-site contact</b><br>${esc(s.contact_name)} · ${esc(s.contact_phone)}</div></div>
<h2>Crew</h2><table><tr><th>Call</th><th>Name</th><th>Role</th><th>Phone</th><th>Confirmed</th></tr>${crew.map((c) => `<tr><td>${esc(c.call_time)}</td><td>${esc(name(c.user_id)?.full_name ?? '')}</td><td>${esc(c.role)}</td><td>${esc(name(c.user_id)?.phone ?? '')}</td><td>${c.confirmed_at ? '✓' : '—'}</td></tr>`).join('')}</table>
<h2>Shot list</h2><table><tr><th>#</th><th>Shot</th><th>Done</th></tr>${s.shot_list.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.text)}</td><td>${x.done ? '✓' : '☐'}</td></tr>`).join('')}</table>
<h2>Equipment</h2><div>${esc(s.equipment)}</div>
<h2>Emergency</h2><div class="red">${esc(s.emergency_contacts)}</div><div><b>Nearest hospital:</b> ${esc(s.nearest_hospital)}</div>
${s.notes ? `<h2>Notes</h2><div>${esc(s.notes)}</div>` : ''}
<p style="margin-top:24px;color:#4A5D78;font-size:11px">Footage rule: no card is formatted until it has two verified copies.</p>
<script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
  return true;
}

// ---------- misc ----------
export const priorityTone = (p: string): Tone => (p === 'Urgent' ? 'red' : p === 'High' ? 'amber' : p === 'Low' ? 'grey' : 'blue');
export const statusTone = (s: string): Tone =>
  ['Done', 'Approved', 'Accepted', 'Ready for review', 'Wrapped', 'safe'].includes(s) ? 'green' : ['Rejected', 'risk'].includes(s) ? 'red' : ['Pending', 'Under review', 'In progress', 'pending'].includes(s) ? 'amber' : 'blue';
export const STAFF_ROLES = ['boss', 'gm_cfo', 'finance', 'project_lead', 'staff', 'storekeeper', 'growth', 'account_manager', 'receptionist', 'driver'];
export const isStaff = (p: Person) => p.roles.some((r) => STAFF_ROLES.includes(r));
export const leaveDays = (start: string, end: string) => {
  let n = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) if (new Date(d + 'T12:00:00').getDay() !== 0) n++; // Sundays off
  return n;
};
