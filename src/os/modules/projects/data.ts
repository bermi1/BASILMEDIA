// Data hooks and workflow actions for the projects module. Every action works in demo mode and,
// with Supabase, calls the matching SQL function in 0005_projects.sql.
import { demoTable, insertRow, nowIso, rpc, updateRow, useTable, type Person } from '@/os/lib/store';
import { notify } from '@/os/lib/notify';
import { supabase } from '@/lib/supabase';
import {
  addDays, checkMove, fmtDate, PROJECT_STAGES, taskSms, today, TEMPLATES,
  type AnnouncementAck, type Announcement, type Attendance, type Client, type Crew, type Deliverable, type FootageCopy,
  type GateCtx, type LeaveBalance, type LeaveRequest, type MediaCard, type Project, type Shoot, type ShootCrew,
  type StaffDetail, type Suggestion, type Task, type TaskComment, type WeeklyReport,
} from './lib';

export const useProjects = () => useTable<Project>('projects', { order: 'end_date' });
export const useClients = () => useTable<Client>('clients', { order: 'name' });
export const useTasks = () => useTable<Task>('tasks', { order: 'due_date' });
export const useCrew = () => useTable<Crew>('project_crew');
export const useShoots = () => useTable<Shoot>('shoots', { order: 'shoot_date' });
export const useShootCrew = () => useTable<ShootCrew>('shoot_crew');
export const useDeliverables = () => useTable<Deliverable>('deliverables', { order: 'due_date' });
export const useCards = () => useTable<MediaCard>('media_cards', { order: 'created_at' });
export const useCopies = () => useTable<FootageCopy>('footage_copies', { order: 'created_at' });
export const useComments = (taskId: string) => useTable<TaskComment>('task_comments', { eq: { task_id: taskId }, order: 'created_at' });
export const useReports = () => useTable<WeeklyReport>('weekly_reports', { order: 'week_start', ascending: false });
export const useSuggestions = () => useTable<Suggestion>('suggestions', { order: 'created_at', ascending: false });
export const useLeave = () => useTable<LeaveRequest>('leave_requests', { order: 'start_date', ascending: false });
export const useLeaveBalances = () => useTable<LeaveBalance>('leave_balances');
export const useAttendance = () => useTable<Attendance>('attendance', { order: 'clock_in', ascending: false });
export const useAnnouncements = () => useTable<Announcement>('announcements', { order: 'created_at', ascending: false });
export const useAcks = () => useTable<AnnouncementAck>('announcement_acks');
export const useStaffDetails = () => useTable<StaffDetail>('staff_details');

/** Everything the stage gates need. */
export function useGateCtx(): GateCtx {
  const { rows: tasks } = useTasks();
  const { rows: shoots } = useShoots();
  const { rows: deliverables } = useDeliverables();
  const { rows: cards } = useCards();
  const { rows: copies } = useCopies();
  return { tasks, shoots, deliverables, cards, copies };
}

/** Projects the acting person may see: leaders see all, others only those they lead or crew on. */
export function visibleProjects(projects: Project[], crew: Crew[], userId: string, seeAll: boolean, scope: string[] | null = null) {
  // A project-only portal grant limits even a "see all" portal (e.g. Project Lead for one project).
  if (scope) return projects.filter((p) => scope.includes(p.id) || p.lead_id === userId);
  if (seeAll) return projects;
  const mine = new Set(crew.filter((c) => c.user_id === userId).map((c) => c.project_id));
  return projects.filter((p) => p.lead_id === userId || mine.has(p.id));
}

// ---------- projects ----------
export async function createProjectFromTemplate(input: {
  templateKey: string; name: string; client_id: string; lead_id: string; start_date: string; end_date: string;
  budget: number; contract_value: number; priority: string; location: string; description: string;
}, actor: string) {
  const tpl = TEMPLATES.find((t) => t.key === input.templateKey)!;
  return rpc<string>('create_project_from_template', {
    _template: tpl.key, _name: input.name, _client: input.client_id, _lead: input.lead_id, _start: input.start_date, _end: input.end_date,
    _budget: input.budget, _contract: input.contract_value, _priority: input.priority, _location: input.location, _description: input.description,
    _tasks: tpl.tasks.map(([title, due]) => ({ title, due: addDays(input.start_date, due) })), _deliverables: tpl.deliverables.map(([title, spec]) => ({ title, spec })),
  });
}

/** Move a project along the pipeline. Gates are re-checked in SQL (move_project_stage). */
export async function moveStage(p: Project, stage: string, ctx: GateCtx) {
  const back = PROJECT_STAGES.indexOf(stage) < PROJECT_STAGES.indexOf(p.stage);
  const why = back ? null : checkMove(p, stage, ctx);
  if (why) throw new Error(why);
  return rpc('move_project_stage', { _project: p.id, _stage: stage });
}

// ---------- tasks ----------
export async function saveTask(t: Partial<Task> & { project_id: string; title: string }, prev: Task | null, ctx: { actor: string; actorName: string; projectName: string }) {
  const row = { description: '', checklist: [], minutes_logged: 0, priority: 'Normal', status: 'To do', completed_at: null, ...t };
  let saved: Task;
  if (prev) saved = await updateRow<Task>('tasks', prev.id, row);
  else saved = await insertRow<Task>('tasks', { ...row, created_by: ctx.actor });
  if (saved.assignee_id && saved.assignee_id !== prev?.assignee_id && saved.assignee_id !== ctx.actor) {
    // With Supabase the tasks_notify trigger sends this; in demo the client does it.
    if (!supabase)
      await notify(saved.assignee_id, `New task: ${saved.title}`, taskSms(saved, ctx.projectName, ctx.actorName), '/app?tab=tasks', 'task');
  }
  return saved;
}
export const setTaskStatus = (t: Task, status: string) => updateRow('tasks', t.id, { status, completed_at: status === 'Done' ? nowIso() : null });
export const logTime = (t: Task, minutes: number) => updateRow('tasks', t.id, { minutes_logged: (t.minutes_logged ?? 0) + minutes });
export const toggleCheck = (t: Task, i: number) => updateRow('tasks', t.id, { checklist: t.checklist.map((c, j) => (j === i ? { ...c, done: !c.done } : c)) });
export const addComment = (task_id: string, author_id: string, body: string) => insertRow('task_comments', { task_id, author_id, body });

// ---------- shoots ----------
export async function confirmCallSheet(sc: ShootCrew) {
  return rpc('confirm_call_sheet', { _id: sc.id });
}
export async function addShootCrew(shoot: Shoot, user_id: string, role: string, projectName: string) {
  await insertRow('shoot_crew', { shoot_id: shoot.id, user_id, role, call_time: shoot.call_time, confirmed_at: null });
  if (!supabase)
    await notify(user_id, `New shoot: ${projectName}`, `${shoot.title} · ${fmtDate(shoot.shoot_date)} · call ${shoot.call_time} · ${shoot.location}. Read and confirm the call sheet.`, '/app?tab=shoots', 'task');
}
export const wrapShoot = (s: Shoot) => updateRow('shoots', s.id, { status: 'Wrapped', wrapped_at: nowIso() });

/** People already booked (other shoots or approved leave) on a date. */
export function bookings(userId: string, date: string, shoots: Shoot[], crew: ShootCrew[], leave: LeaveRequest[], exceptShoot?: string) {
  const onShoots = crew.filter((c) => c.user_id === userId && c.shoot_id !== exceptShoot).map((c) => shoots.find((s) => s.id === c.shoot_id)).filter((s): s is Shoot => !!s && s.shoot_date === date);
  const onLeave = leave.filter((l) => l.user_id === userId && l.status !== 'Rejected' && l.start_date <= date && l.end_date >= date);
  return { onShoots, onLeave };
}

// ---------- post-production & footage ----------
export const setPostStatus = (d: Deliverable, post_status: string) => updateRow('deliverables', d.id, { post_status });
export const sendBackForRevision = (d: Deliverable) => updateRow('deliverables', d.id, { post_status: 'Fine cut', revision_round: (d.revision_round ?? 0) + 1 });
export const markDelivered = (d: Deliverable) => updateRow('deliverables', d.id, { delivered_at: nowIso() });
export const verifyCopy = (c: FootageCopy, by: string) => updateRow('footage_copies', c.id, { verified: true, verified_by: by });

// ---------- people ----------
export async function decideLeave(l: LeaveRequest, approve: boolean, note: string, actor: string) {
  if (l.user_id === actor) throw new Error('You cannot approve your own leave.');
  return rpc('decide_leave', { _id: l.id, _approve: approve, _note: note });
}
export async function submitLeave(row: Omit<LeaveRequest, 'id' | 'created_at' | 'status' | 'decided_by' | 'decided_at' | 'decision_note'>) {
  const r = await insertRow<LeaveRequest>('leave_requests', { ...row, status: 'Pending', decided_by: null, decided_at: null, decision_note: '' });
  if (!supabase) await notify('u-gm', 'Leave request to approve', `${row.leave_type} · ${row.days} day(s) from ${fmtDate(row.start_date)}`, '/os/people/leave', 'approval');
  return r;
}
/** Anonymous suggestions never store the author (SQL trigger also nulls it). */
export const submitSuggestion = (author: string, anonymous: boolean, category: string, body: string) =>
  insertRow('suggestions', { author_id: anonymous ? null : author, anonymous, category, body, status: 'Under review', reply: '', replied_by: null, replied_at: null });
export async function replySuggestion(s: Suggestion, status: string, reply: string, actor: string) {
  return rpc('reply_suggestion', { _id: s.id, _status: status, _reply: reply });
}

export function leaveUsed(userId: string, leave: LeaveRequest[], year = new Date().getFullYear()) {
  return leave.filter((l) => l.user_id === userId && l.leave_type === 'Annual' && l.status === 'Approved' && l.start_date.startsWith(String(year))).reduce((s, l) => s + Number(l.days), 0);
}

export async function clockIn(userId: string) {
  const pos = await new Promise<GeolocationPosition | null>((res) => {
    if (!('geolocation' in navigator)) return res(null);
    navigator.geolocation.getCurrentPosition(res, () => res(null), { timeout: 6000, maximumAge: 60000 });
  });
  return insertRow<Attendance>('attendance', {
    user_id: userId, day: today(), clock_in: nowIso(), clock_out: null,
    lat: pos?.coords.latitude ?? null, lng: pos?.coords.longitude ?? null, place: pos ? `GPS ±${Math.round(pos.coords.accuracy)} m` : '',
  });
}
export const clockOut = (a: Attendance) => updateRow('attendance', a.id, { clock_out: nowIso() });

export const personById = (people: Person[], id?: string | null) => people.find((p) => p.id === id);
