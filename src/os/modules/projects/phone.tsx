// Stable exports used by the phone apps (Boss, GM/CFO, Project Lead, Staff…). Keep these names stable.
import './seed';
import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CalendarCheck, ChevronRight, Clapperboard, FileText, Lightbulb, MapPin, Plane, Wallet } from 'lucide-react';
import { useActing } from '@/os/lib/session';
import { usePeople } from '@/os/lib/store';
import { useToast } from '@/os/cms/toast';
import { Empty, Pill, Sheet, StageTracker, Stat } from '@/os/ui';
import {
  addDays, cardState, fmtDate, fmtDay, footageAtRisk, isOverdue, PROJECT_STAGES, projectHealth, today, type Project, type Shoot,
} from './lib';
import {
  bookings, moveStage, useAcks, useAnnouncements, useCards, useCopies, useCrew, useDeliverables, useGateCtx, useLeave, useProjects, useReports,
  useShootCrew, useShoots, useTasks, visibleProjects,
} from './data';
import { CallSheet, CardSafety, HealthDot, PostRow, ProjectLine, TaskList, TaskSheet } from './components';
import { ClockCard, LeaveForm, SuggestionForm, WeeklyReportForm } from './people';

export { WeeklyReportForm, SuggestionBox, LeavePanel, AnnouncementsPanel, Directory, Payslips, AttendancePanel } from './people';

function H({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="mb-2 mt-5 flex items-center justify-between first:mt-0"><h2 className="m-0 text-[15px] font-extrabold">{children}</h2>{action}</div>;
}

// ---------- Projects glance (Boss, GM/CFO) ----------
export function ProjectsGlance({ mine = false }: { mine?: boolean }) {
  const { userId } = useActing();
  const { rows: projects } = useProjects();
  const { rows: crew } = useCrew();
  const [open, setOpen] = useState<Project | null>(null);
  const list = (mine ? visibleProjects(projects, crew, userId, false).filter((p) => p.lead_id === userId) : projects).filter((p) => !['Archive', 'Invoice'].includes(p.stage));
  return (
    <div className="flex flex-col gap-2">
      {list.map((p) => <ProjectLine key={p.id} p={p} onOpen={() => setOpen(p)} />)}
      {!list.length && <Empty title="No active projects" />}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.name ?? ''}>{open && <PhoneProject id={open.id} />}</Sheet>
    </div>
  );
}

function PhoneProject({ id }: { id: string }) {
  const { rows: projects } = useProjects();
  const ctx = useGateCtx();
  const { can, userId } = useActing();
  const people = usePeople();
  const toast = useToast();
  const p = projects.find((x) => x.id === id);
  if (!p) return null;
  const h = projectHealth(p, ctx.tasks);
  const ix = PROJECT_STAGES.indexOf(p.stage);
  const tasks = ctx.tasks.filter((t) => t.project_id === p.id);
  const dels = ctx.deliverables.filter((d) => d.project_id === p.id);
  const manage = can('boss', 'gm_cfo') || p.lead_id === userId;
  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm text-basil-muted">{p.service} · {p.location} · due {fmtDate(p.end_date)}</div>
      <StageTracker stages={PROJECT_STAGES} current={ix} />
      <div className={`rounded-2xl p-3 text-sm ${h.tone === 'red' ? 'bg-red-50 text-red-800' : h.tone === 'amber' ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-800'}`}><HealthDot tone={h.tone} label={`Health ${h.label}`} /><div className="mt-1">{h.reasons.join(' · ')}</div></div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Open tasks" value={tasks.filter((t) => t.status !== 'Done').length} />
        <Stat label="Overdue" value={tasks.filter(isOverdue).length} tone={tasks.some(isOverdue) ? 'red' : 'green'} />
        <Stat label="Ready" value={`${dels.filter((d) => d.post_status === 'Ready for review').length}/${dels.length}`} />
      </div>
      {manage && ix < PROJECT_STAGES.length - 1 && <button type="button" className="btn-primary min-h-[48px] justify-center" onClick={() => moveStage(p, PROJECT_STAGES[ix + 1], ctx).then(() => toast(`Moved to ${PROJECT_STAGES[ix + 1]}`)).catch((e) => toast(e.message, 'error'))}>Move to {PROJECT_STAGES[ix + 1]}<ArrowRight size={16} /></button>}
      <H>Tasks</H>
      <TaskList tasks={tasks} people={people} projects={projects} showProject={false} defaults={{ project_id: p.id }} />
      <a href={`/os/projects/${p.id}`} className="btn-outline justify-center">Open full project page</a>
    </div>
  );
}

// ---------- My tasks ----------
export function MyTasks() {
  const { userId } = useActing();
  const { rows: tasks } = useTasks();
  const { rows: projects } = useProjects();
  const people = usePeople();
  const mine = tasks.filter((t) => t.assignee_id === userId);
  return <TaskList tasks={mine} people={people} projects={projects} defaults={{ assignee_id: userId }} empty={<Empty icon={<CalendarCheck />} title="No tasks" sub="Tasks assigned to you show here." />} />;
}

// ---------- Footage alerts (Boss home) ----------
export function FootageAlerts() {
  const { rows: cards } = useCards();
  const { rows: shoots } = useShoots();
  const { rows: copies } = useCopies();
  const { rows: projects } = useProjects();
  const risk = footageAtRisk(cards, shoots, copies);
  if (!risk.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {risk.map((m) => {
        const s = shoots.find((x) => x.id === m.shoot_id);
        const n = copies.filter((c) => c.card_id === m.id && c.verified).length;
        return (
          <div key={m.id} role="alert" className="flex items-start gap-3 rounded-2xl bg-red-600 p-3 text-white">
            <AlertTriangle size={20} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1 text-sm"><b className="block">Footage at risk · {m.label}</b>{projects.find((p) => p.id === m.project_id)?.name} · {s?.title} · {n} verified cop{n === 1 ? 'y' : 'ies'} more than 24 h after wrap.</div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- shoots for me ----------
function useMyShoots(userId: string) {
  const { rows: shoots } = useShoots();
  const { rows: crew } = useShootCrew();
  return useMemo(() => {
    const ids = new Set(crew.filter((c) => c.user_id === userId).map((c) => c.shoot_id));
    return shoots.filter((s) => ids.has(s.id));
  }, [shoots, crew, userId]);
}

function ShootCard({ s, onOpen }: { s: Shoot; onOpen: () => void }) {
  const { userId } = useActing();
  const { rows: crew } = useShootCrew();
  const { rows: projects } = useProjects();
  const me = crew.find((c) => c.shoot_id === s.id && c.user_id === userId);
  const isToday = s.shoot_date === today();
  return (
    <button type="button" onClick={onOpen} className={`flex w-full flex-col gap-2 rounded-2xl p-4 text-left ${isToday ? 'border-0 text-white' : 'border border-basil-line bg-white text-basil-ink'}`} style={isToday ? { background: 'linear-gradient(135deg, var(--accent, #0F6EC2), #0A2F5C)' } : undefined}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><span className={`text-[11px] font-bold uppercase tracking-wider ${isToday ? 'text-white/80' : 'text-basil-muted'}`}>{isToday ? 'Today’s shoot' : fmtDay(s.shoot_date)}</span><b className="block text-[16px] leading-snug">{s.title}</b><span className={`block text-xs ${isToday ? 'text-white/80' : 'text-basil-muted'}`}>{projects.find((p) => p.id === s.project_id)?.name}</span></div>
        <div className="shrink-0 text-right"><span className={`block text-[11px] ${isToday ? 'text-white/80' : 'text-basil-muted'}`}>Call</span><b className="text-xl">{me?.call_time ?? s.call_time}</b></div>
      </div>
      <span className={`flex items-center gap-1 text-xs ${isToday ? 'text-white/90' : 'text-basil-muted'}`}><MapPin size={13} />{s.location}</span>
      <div className="flex items-center gap-2">{me?.role && <Pill tone={isToday ? 'grey' : 'blue'}>{me.role}</Pill>}{me && (me.confirmed_at ? <Pill tone="green">Confirmed</Pill> : <Pill tone="amber">Please confirm</Pill>)}<ChevronRight size={18} className="ml-auto opacity-70" /></div>
    </button>
  );
}

export function MyShoots() {
  const { userId } = useActing();
  const mine = useMyShoots(userId);
  const { rows: projects } = useProjects();
  const [open, setOpen] = useState<Shoot | null>(null);
  const { rows: shoots } = useShoots();
  const upcoming = mine.filter((s) => s.shoot_date >= today());
  const past = mine.filter((s) => s.shoot_date < today()).reverse().slice(0, 4);
  return (
    <div className="flex flex-col gap-2">
      <H>Upcoming call sheets</H>
      {upcoming.map((s) => <ShootCard key={s.id} s={s} onOpen={() => setOpen(s)} />)}
      {!upcoming.length && <Empty icon={<Clapperboard />} title="No shoots booked" />}
      {past.length > 0 && <><H>Recent</H>{past.map((s) => <ShootCard key={s.id} s={s} onOpen={() => setOpen(s)} />)}</>}
      <Sheet open={!!open} onClose={() => setOpen(null)} title="Call sheet">{open && <CallSheet shoot={shoots.find((s) => s.id === open.id) ?? open} project={projects.find((p) => p.id === open.project_id)} compact />}</Sheet>
    </div>
  );
}

// ---------- Staff: My Day ----------
export function StaffMyDay() {
  const { userId } = useActing();
  const people = usePeople();
  const [, setParams] = useSearchParams();
  const mine = useMyShoots(userId);
  const { rows: tasks } = useTasks();
  const { rows: projects } = useProjects();
  const { rows: cards } = useCards();
  const { rows: copies } = useCopies();
  const { rows: shoots } = useShoots();
  const { rows: reports } = useReports();
  const { rows: ann } = useAnnouncements();
  const { rows: acks } = useAcks();
  const [sheet, setSheet] = useState<'report' | 'idea' | 'leave' | null>(null);
  const [openShoot, setOpenShoot] = useState<Shoot | null>(null);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const me = people.find((p) => p.id === userId);
  const todays = mine.filter((s) => s.shoot_date === today());
  const next = mine.filter((s) => s.shoot_date > today()).slice(0, 2);
  const due = tasks.filter((t) => t.assignee_id === userId && t.status !== 'Done' && t.due_date <= addDays(today(), 1));
  const myCards = cards.filter((m) => m.shot_by === userId && cardState(m, shoots.find((s) => s.id === m.shoot_id), copies) !== 'safe');
  const reported = reports.some((r) => r.author_id === userId && r.week_start >= addDays(today(), -6) && r.week_start <= today());
  const unread = ann.filter((a) => !acks.some((x) => x.announcement_id === a.id && x.user_id === userId));
  const quick: [string, typeof Wallet, () => void][] = [
    ['Request money', Wallet, () => setParams((p) => (p.set('tab', 'requests'), p), { replace: true })],
    ['Weekly report', FileText, () => setSheet('report')],
    ['Suggest an idea', Lightbulb, () => setSheet('idea')],
    ['Request leave', Plane, () => setSheet('leave')],
  ];
  return (
    <div className="flex flex-col gap-3">
      <div><span className="text-xs font-bold uppercase tracking-wider text-basil-muted">{fmtDay(today())}</span><h1 className="m-0 font-display text-2xl font-extrabold">Habari, {me?.full_name.split(' ')[0] ?? 'there'}</h1></div>
      {todays.map((s) => <ShootCard key={s.id} s={s} onOpen={() => setOpenShoot(s)} />)}
      <ClockCard />
      {myCards.length > 0 && <div role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200"><AlertTriangle size={18} className="shrink-0" /><span>{myCards.map((m) => m.label).join(', ')} need{myCards.length === 1 ? 's' : ''} a second verified backup. Copy to the NAS before you format.</span></div>}
      <H>Quick actions</H>
      <div className="grid grid-cols-2 gap-2">
        {quick.map(([label, Icon, fn]) => (
          <button key={label} type="button" onClick={fn} className="flex min-h-[64px] items-center gap-2 rounded-2xl border border-basil-line bg-white p-3 text-left text-sm font-bold text-basil-ink">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'color-mix(in srgb, var(--accent, #0F6EC2) 14%, white)', color: 'var(--accent, #0F6EC2)' }}><Icon size={19} /></span>{label}
            {label === 'Weekly report' && !reported && <span className="ml-auto h-2.5 w-2.5 rounded-full bg-amber-500" aria-label="Due" />}
          </button>
        ))}
      </div>
      <H action={<button type="button" className="border-0 bg-transparent text-sm font-bold text-basil" onClick={() => setParams((p) => (p.set('tab', 'tasks'), p), { replace: true })}>All tasks</button>}>Due today & overdue</H>
      {due.map((t) => (
        <button key={t.id} type="button" onClick={() => setOpenTask(t.id)} className="flex w-full items-center gap-3 rounded-2xl border border-basil-line bg-white p-3 text-left">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${isOverdue(t) ? 'bg-red-600' : 'bg-amber-500'}`} />
          <span className="min-w-0 flex-1"><b className="block truncate text-sm text-basil-ink">{t.title}</b><span className="block truncate text-xs text-basil-muted">{projects.find((p) => p.id === t.project_id)?.name}</span></span>
          <span className={`text-xs font-bold ${isOverdue(t) ? 'text-red-700' : 'text-basil-muted'}`}>{isOverdue(t) ? 'Overdue' : t.due_date === today() ? 'Today' : 'Tomorrow'}</span>
        </button>
      ))}
      {!due.length && <p className="m-0 rounded-2xl bg-white p-4 text-center text-sm text-basil-muted">Nothing due today. 🎉</p>}
      {next.length > 0 && <><H>Coming up</H>{next.map((s) => <ShootCard key={s.id} s={s} onOpen={() => setOpenShoot(s)} />)}</>}
      {unread.length > 0 && <div className="rounded-2xl bg-basil-ice p-3 text-sm"><b>{unread.length} unread announcement{unread.length > 1 ? 's' : ''}</b> · {unread[0].title}<span className="block text-xs text-basil-muted">Open More → Announcements to acknowledge.</span></div>}
      <Sheet open={sheet === 'report'} onClose={() => setSheet(null)} title="Weekly report"><WeeklyReportForm onDone={() => setSheet(null)} /></Sheet>
      <Sheet open={sheet === 'idea'} onClose={() => setSheet(null)} title="Suggest an idea"><SuggestionForm onDone={() => setSheet(null)} /></Sheet>
      <Sheet open={sheet === 'leave'} onClose={() => setSheet(null)} title="Request leave"><LeaveForm onDone={() => setSheet(null)} /></Sheet>
      <Sheet open={!!openShoot} onClose={() => setOpenShoot(null)} title="Call sheet">{openShoot && <CallSheet shoot={shoots.find((s) => s.id === openShoot.id) ?? openShoot} project={projects.find((p) => p.id === openShoot.project_id)} compact />}</Sheet>
      <TaskSheet open={!!openTask} onClose={() => setOpenTask(null)} task={tasks.find((t) => t.id === openTask) ?? null} />
    </div>
  );
}

// ---------- Project Lead ----------
function useLeadScope() {
  const { userId, can } = useActing();
  const { rows: projects } = useProjects();
  const { rows: crew } = useCrew();
  const led = projects.filter((p) => p.lead_id === userId);
  const seeAll = can('boss', 'gm_cfo');
  const scope = seeAll ? projects : visibleProjects(projects, crew, userId, false);
  return { userId, led, scope, ids: new Set(scope.map((p) => p.id)) };
}

export function LeadProjects() {
  const { led, scope } = useLeadScope();
  const ctx = useGateCtx();
  const [open, setOpen] = useState<string | null>(null);
  const other = scope.filter((p) => !led.includes(p));
  const reds = led.filter((p) => projectHealth(p, ctx.tasks).tone === 'red').length;
  return (
    <div className="flex flex-col gap-2">
      <FootageAlertsFor ids={new Set(scope.map((p) => p.id))} />
      <div className="grid grid-cols-3 gap-2">
        <Stat label="I lead" value={led.length} />
        <Stat label="Red" value={reds} tone={reds ? 'red' : 'green'} />
        <Stat label="Overdue tasks" value={ctx.tasks.filter((t) => led.some((p) => p.id === t.project_id) && isOverdue(t)).length} tone="amber" />
      </div>
      <H>Projects I lead</H>
      {led.map((p) => <ProjectLine key={p.id} p={p} onOpen={() => setOpen(p.id)} />)}
      {!led.length && <Empty title="You don’t lead a project yet" />}
      {other.length > 0 && <><H>Crew on</H>{other.map((p) => <ProjectLine key={p.id} p={p} onOpen={() => setOpen(p.id)} />)}</>}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={scope.find((p) => p.id === open)?.name ?? ''}>{open && <PhoneProject id={open} />}</Sheet>
    </div>
  );
}

function FootageAlertsFor({ ids }: { ids: Set<string> }) {
  const { rows: cards } = useCards();
  const { rows: shoots } = useShoots();
  const { rows: copies } = useCopies();
  const risk = footageAtRisk(cards.filter((m) => ids.has(m.project_id)), shoots, copies);
  if (!risk.length) return null;
  return <div role="alert" className="flex items-center gap-2 rounded-2xl bg-red-600 p-3 text-sm font-bold text-white"><AlertTriangle size={18} />Footage at risk: {risk.map((m) => m.label).join(', ')}</div>;
}

export function CrewAndShoots() {
  const { ids, scope } = useLeadScope();
  const { rows: shoots } = useShoots();
  const { rows: crew } = useShootCrew();
  const { rows: leave } = useLeave();
  const people = usePeople();
  const [open, setOpen] = useState<Shoot | null>(null);
  const upcoming = shoots.filter((s) => ids.has(s.project_id) && s.shoot_date >= today() && s.shoot_date <= addDays(today(), 14));
  const days = Array.from({ length: 14 }, (_, i) => addDays(today(), i));
  const clashes = people.flatMap((p) => days.map((d) => ({ p, d, b: bookings(p.id, d, shoots, crew, leave) })).filter((x) => x.b.onShoots.length + x.b.onLeave.length > 1));
  return (
    <div className="flex flex-col gap-2">
      {clashes.map(({ p, d, b }) => <div key={p.id + d} className="rounded-2xl bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200"><AlertTriangle size={14} className="mr-1 inline" /><b>{p.full_name}</b> double-booked {fmtDay(d)}: {[...b.onShoots.map((s) => s.title), ...b.onLeave.map((l) => `${l.leave_type} leave`)].join(' + ')}</div>)}
      <H>Next 14 days</H>
      {upcoming.map((s) => <ShootCard key={s.id} s={s} onOpen={() => setOpen(s)} />)}
      {!upcoming.length && <Empty title="No shoots in the next two weeks" />}
      <Sheet open={!!open} onClose={() => setOpen(null)} title="Call sheet">{open && <CallSheet shoot={shoots.find((s) => s.id === open.id) ?? open} project={scope.find((p) => p.id === open.project_id)} compact />}</Sheet>
    </div>
  );
}

export function LeadTasks() {
  const { ids, scope } = useLeadScope();
  const { rows: tasks } = useTasks();
  const people = usePeople();
  return <TaskList tasks={tasks.filter((t) => ids.has(t.project_id))} people={people} projects={scope} defaults={{ project_id: scope[0]?.id }} />;
}

export function CallSheets() {
  const { ids, scope } = useLeadScope();
  const { rows: shoots } = useShoots();
  const [open, setOpen] = useState<Shoot | null>(null);
  const list = shoots.filter((s) => ids.has(s.project_id) && s.status === 'Planned');
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-sm text-basil-muted">Open a call sheet to share it on WhatsApp, print it or add crew.</p>
      {list.map((s) => <ShootCard key={s.id} s={s} onOpen={() => setOpen(s)} />)}
      <Sheet open={!!open} onClose={() => setOpen(null)} title="Call sheet">{open && <CallSheet shoot={shoots.find((s) => s.id === open.id) ?? open} project={scope.find((p) => p.id === open.project_id)} compact />}</Sheet>
    </div>
  );
}

export function FootageBackup() {
  const { ids } = useLeadScope();
  const { rows: cards } = useCards();
  const { rows: shoots } = useShoots();
  const { rows: copies } = useCopies();
  const people = usePeople();
  const order = ['risk', 'pending', 'safe'];
  const list = cards.filter((m) => ids.has(m.project_id)).sort((a, b) => order.indexOf(cardState(a, shoots.find((s) => s.id === a.shoot_id), copies)) - order.indexOf(cardState(b, shoots.find((s) => s.id === b.shoot_id), copies)));
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 rounded-2xl bg-basil-deep p-3 text-sm text-white">Two verified copies before any card is formatted. Red = still under 2 copies 24 h after wrap.</p>
      {list.map((m) => <CardSafety key={m.id} m={m} shoot={shoots.find((s) => s.id === m.shoot_id)} copies={copies} people={people} canEdit />)}
      {!list.length && <Empty title="No cards logged" />}
    </div>
  );
}

export function PostProduction() {
  const { ids, scope, userId } = useLeadScope();
  const { rows: dels } = useDeliverables();
  const people = usePeople();
  const list = dels.filter((d) => ids.has(d.project_id) && !d.delivered_at);
  return (
    <div className="flex flex-col gap-2">
      {list.map((d) => { const p = scope.find((x) => x.id === d.project_id); return <PostRow key={d.id} d={d} people={people} project={p} canEdit={p?.lead_id === userId || d.owner_id === userId} />; })}
      {!list.length && <Empty title="Nothing in the edit" />}
    </div>
  );
}
