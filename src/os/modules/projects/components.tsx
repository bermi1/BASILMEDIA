// Building blocks shared by the desktop pages and the phone screens.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle, Check, CheckCircle2, Clock, ExternalLink, HardDrive, MapPin, MessageCircle, Phone, Plus, Printer, Send, ShieldAlert, Trash2,
} from 'lucide-react';
import { useActing } from '@/os/lib/session';
import { insertRow, updateRow, usePeople, type Person } from '@/os/lib/store';
import { useToast } from '@/os/cms/toast';
import { Avatar, Field, inputCls, Pill, Progress, Sheet, StageTracker, tshShort } from '@/os/ui';
import {
  addDays, callSheetText, cardState, dueLabel, fmtDate, fmtDay, fmtMinutes, fmtWhen, HEALTH_DOT, isOverdue, mapsLink, POST_STEPS, PRIORITIES,
  printCallSheet, priorityTone, projectHealth, taskSms, TASK_STATUSES, telLink, TEMPLATES, today, verifiedCopies, waLink,
  type CheckItem, type Deliverable, type FootageCopy, type MediaCard, type Project, type Shoot, type Task,
} from './lib';
import {
  addComment, addShootCrew, bookings, confirmCallSheet, createProjectFromTemplate, logTime, markDelivered, saveTask, sendBackForRevision,
  setPostStatus, setTaskStatus, toggleCheck, useClients, useComments, useLeave, useProjects, useShootCrew, useShoots, useTasks, verifyCopy,
} from './data';

export const nameOf = (people: Person[], id?: string | null) => people.find((p) => p.id === id)?.full_name ?? '—';
export const firstName = (people: Person[], id?: string | null) => nameOf(people, id).split(' ')[0];

export function HealthDot({ tone, label }: { tone: string; label?: string }) {
  return <span className="inline-flex items-center gap-1.5 text-xs font-bold"><span className={`h-2.5 w-2.5 rounded-full ${HEALTH_DOT[tone] ?? 'bg-slate-400'}`} aria-hidden />{label ?? tone}</span>;
}

export function BudgetBar({ p }: { p: Project }) {
  const spent = Number(p.spent ?? 0), budget = Number(p.budget ?? 0);
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-basil-muted"><span>Spent {tshShort(spent)}</span><span>of {tshShort(budget)}</span></div>
      <Progress value={spent} max={budget} />
    </div>
  );
}

// ---------- tasks ----------
export function TaskRow({ t, people, projects, onOpen, showProject = true }: { t: Task; people: Person[]; projects: Project[]; onOpen: () => void; showProject?: boolean }) {
  const late = isOverdue(t);
  const done = t.status === 'Done';
  const checks = t.checklist?.length ? `${t.checklist.filter((c) => c.done).length}/${t.checklist.length}` : '';
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-basil-line bg-white p-3">
      <button type="button" aria-label={done ? 'Mark not done' : 'Mark done'} onClick={() => setTaskStatus(t, done ? 'To do' : 'Done')} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 ${done ? 'border-emerald-600 bg-emerald-600 text-white' : late ? 'border-red-400 bg-white text-transparent' : 'border-basil-edge bg-white text-transparent'}`}><Check size={18} /></button>
      <button type="button" onClick={onOpen} className="min-h-[44px] min-w-0 flex-1 border-0 bg-transparent p-0 text-left">
        <b className={`block truncate text-[15px] ${done ? 'text-basil-muted line-through' : 'text-basil-ink'}`}>{t.title}</b>
        <span className="block truncate text-xs text-basil-muted">{showProject && <>{projects.find((p) => p.id === t.project_id)?.name ?? ''} · </>}{firstName(people, t.assignee_id)}{checks && ` · ☑ ${checks}`}{t.minutes_logged ? ` · ${fmtMinutes(t.minutes_logged)}` : ''}</span>
      </button>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`text-xs font-bold ${late ? 'text-red-700' : done ? 'text-emerald-700' : 'text-basil-muted'}`}>{done ? 'Done' : dueLabel(t.due_date)}</span>
        {t.priority !== 'Normal' && <Pill tone={priorityTone(t.priority)}>{t.priority}</Pill>}
      </div>
    </div>
  );
}

export function TaskSheet({ open, onClose, task, defaults }: { open: boolean; onClose: () => void; task: Task | null; defaults?: Partial<Task> }) {
  const { userId } = useActing();
  const people = usePeople();
  const { rows: projects } = useProjects();
  const toast = useToast();
  const blank = (): Partial<Task> => ({ title: '', description: '', project_id: projects[0]?.id ?? '', assignee_id: userId, due_date: addDays(today(), 2), priority: 'Normal', status: 'To do', checklist: [], ...defaults });
  const [f, setF] = useState<Partial<Task>>(blank);
  const [item, setItem] = useState('');
  const [sms, setSms] = useState<{ text: string; phone: string } | null>(null);
  useEffect(() => { if (open) { setF(task ? { ...task } : blank()); setSms(null); } }, [open, task?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof Task, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const projectName = projects.find((p) => p.id === f.project_id)?.name ?? '';
  const staff = people.filter((p) => !p.roles.includes('client'));

  async function save() {
    if (!f.title?.trim() || !f.project_id) return toast('Add a title and project', 'error');
    try {
      const saved = await saveTask({ ...(f as Task), title: f.title.trim() }, task, { actor: userId, actorName: nameOf(people, userId), projectName });
      const newAssignee = saved.assignee_id && saved.assignee_id !== task?.assignee_id && saved.assignee_id !== userId;
      toast(task ? 'Task saved' : 'Task created');
      if (newAssignee) setSms({ text: taskSms(saved, projectName, nameOf(people, userId)), phone: people.find((p) => p.id === saved.assignee_id)?.phone ?? '' });
      else onClose();
    } catch (e) { toast((e as Error).message, 'error'); }
  }
  const checklist = (f.checklist ?? []) as CheckItem[];
  return (
    <Sheet open={open} onClose={onClose} title={task ? 'Task' : 'New task'}>
      {sms ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 font-bold text-emerald-700"><CheckCircle2 size={20} />Assigned — {nameOf(people, f.assignee_id)} has been notified in the app.</div>
          <div className="rounded-2xl bg-basil-mist p-3 text-sm"><span className="kicker mb-1 block text-[10px]">READY SMS TEXT</span>{sms.text}</div>
          <div className="grid grid-cols-2 gap-2">
            <a className="btn-outline justify-center" href={`sms:${sms.phone}?body=${encodeURIComponent(sms.text)}`}><MessageCircle size={16} />SMS</a>
            <a className="btn-outline justify-center" href={waLink(sms.text, sms.phone)} target="_blank" rel="noreferrer"><Send size={16} />WhatsApp</a>
          </div>
          <button type="button" className="btn-primary justify-center" onClick={onClose}>Done</button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Field label="Title"><input className={inputCls} value={f.title ?? ''} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="Description"><textarea className={`${inputCls} h-20 py-2`} value={f.description ?? ''} onChange={(e) => set('description', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Project"><select className={inputCls} value={f.project_id} onChange={(e) => set('project_id', e.target.value)}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Field label="Assignee"><select className={inputCls} value={f.assignee_id ?? ''} onChange={(e) => set('assignee_id', e.target.value || null)}><option value="">Unassigned</option>{staff.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></Field>
            <Field label="Due date"><input type="date" className={inputCls} value={f.due_date ?? ''} onChange={(e) => set('due_date', e.target.value)} /></Field>
            <Field label="Priority"><select className={inputCls} value={f.priority} onChange={(e) => set('priority', e.target.value)}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
            <Field label="Status"><select className={inputCls} value={f.status} onChange={(e) => set('status', e.target.value)}>{TASK_STATUSES.map((p) => <option key={p}>{p}</option>)}</select></Field>
            <Field label="Time logged"><div className="flex h-12 items-center gap-1.5">
              <span className="text-sm font-bold">{fmtMinutes(task?.minutes_logged ?? 0)}</span>
              {task && [15, 30, 60].map((m) => <button key={m} type="button" className="h-10 rounded-full border border-basil-edge bg-white px-2 text-xs font-bold text-basil-deep" onClick={() => logTime(task, m).then(() => setF((x) => ({ ...x, minutes_logged: (x.minutes_logged ?? 0) + m })))}>+{m}</button>)}
            </div></Field>
          </div>
          <div>
            <div className="mb-1 text-sm font-bold text-[#33465F]">Checklist</div>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {checklist.map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  <label className="flex min-h-[44px] flex-1 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={c.done} onChange={() => { const next = checklist.map((x, j) => (j === i ? { ...x, done: !x.done } : x)); set('checklist', next); if (task) toggleCheck({ ...task, checklist }, i); }} /><span className={c.done ? 'text-basil-muted line-through' : ''}>{c.text}</span></label>
                  <button type="button" aria-label="Remove item" className="flex h-10 w-10 items-center justify-center rounded-full border-0 bg-transparent text-basil-muted" onClick={() => set('checklist', checklist.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
                </li>
              ))}
            </ul>
            <form className="mt-1 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (item.trim()) { set('checklist', [...checklist, { text: item.trim(), done: false }]); setItem(''); } }}>
              <input className={inputCls} placeholder="Add checklist item" value={item} onChange={(e) => setItem(e.target.value)} />
              <button type="submit" aria-label="Add item" className="btn-outline shrink-0"><Plus size={16} /></button>
            </form>
          </div>
          <button type="button" className="btn-primary justify-center" onClick={save}>{task ? 'Save task' : 'Create & notify'}</button>
          {task && <TaskComments taskId={task.id} people={people} />}
        </div>
      )}
    </Sheet>
  );
}

function TaskComments({ taskId, people }: { taskId: string; people: Person[] }) {
  const { userId } = useActing();
  const { rows } = useComments(taskId);
  const [body, setBody] = useState('');
  return (
    <div className="border-t border-basil-line pt-3">
      <div className="mb-2 text-sm font-bold text-[#33465F]">Comments</div>
      <div className="flex flex-col gap-2">
        {rows.map((c) => (
          <div key={c.id} className="flex gap-2"><Avatar name={nameOf(people, c.author_id)} size={28} /><div className="min-w-0 flex-1 rounded-2xl bg-basil-mist px-3 py-2 text-sm"><b>{firstName(people, c.author_id)}</b> <span className="text-xs text-basil-muted">{fmtWhen(c.created_at)}</span><div>{c.body}</div></div></div>
        ))}
        {!rows.length && <span className="text-sm text-basil-muted">No comments yet.</span>}
      </div>
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (body.trim()) addComment(taskId, userId, body.trim()).then(() => setBody('')); }}>
        <input className={inputCls} placeholder="Write a comment" value={body} onChange={(e) => setBody(e.target.value)} aria-label="Comment" />
        <button type="submit" className="btn-primary shrink-0" aria-label="Send comment"><Send size={16} /></button>
      </form>
    </div>
  );
}

/** Task list with filter chips and the task sheet. */
export function TaskList({ tasks, people, projects, showProject = true, defaults, empty }: { tasks: Task[]; people: Person[]; projects: Project[]; showProject?: boolean; defaults?: Partial<Task>; empty?: ReactNode }) {
  const [open, setOpen] = useState<Task | null | 'new'>(null);
  const [filter, setFilter] = useState<'open' | 'late' | 'done' | 'all'>('open');
  const list = tasks.filter((t) => filter === 'all' || (filter === 'done' ? t.status === 'Done' : filter === 'late' ? isOverdue(t) : t.status !== 'Done'));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="scrollbar-none flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
          {(['open', 'late', 'done', 'all'] as const).map((k) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={`min-h-[44px] shrink-0 rounded-full px-3 text-sm font-semibold capitalize ${filter === k ? 'border-0 bg-basil text-white' : 'border border-basil-edge bg-white text-basil-deep'}`}>
              {k === 'late' ? 'Overdue' : k} <span className="opacity-70">{tasks.filter((t) => k === 'all' || (k === 'done' ? t.status === 'Done' : k === 'late' ? isOverdue(t) : t.status !== 'Done')).length}</span>
            </button>
          ))}
        </div>
        <button type="button" className="btn-primary min-h-[44px] shrink-0 px-3 sm:px-4" aria-label="New task" onClick={() => setOpen('new')}><Plus size={18} /><span className="hidden sm:inline">Task</span></button>
      </div>
      {list.map((t) => <TaskRow key={t.id} t={t} people={people} projects={projects} showProject={showProject} onOpen={() => setOpen(t)} />)}
      {!list.length && (empty ?? <p className="m-0 rounded-2xl bg-white p-6 text-center text-sm text-basil-muted">Nothing here.</p>)}
      <TaskSheet open={open !== null} onClose={() => setOpen(null)} task={open === 'new' ? null : open} defaults={defaults} />
    </div>
  );
}

// ---------- new project ----------
export function NewProjectSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (id: string) => void }) {
  const { userId } = useActing();
  const people = usePeople();
  const { rows: clients } = useClients();
  const toast = useToast();
  const [tpl, setTpl] = useState(TEMPLATES[0].key);
  const t = TEMPLATES.find((x) => x.key === tpl)!;
  const [f, setF] = useState({ name: '', client_id: '', lead_id: userId, start_date: addDays(today(), 3), budget: '', contract_value: '', priority: 'Normal', location: 'Dar es Salaam', description: '' });
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const leads = people.filter((p) => p.roles.some((r) => ['project_lead', 'staff', 'boss', 'gm_cfo'].includes(r)));
  async function create() {
    if (!f.name.trim() || !(f.client_id || clients[0])) return toast('Name and client are required', 'error');
    try {
      const id = await createProjectFromTemplate({
        templateKey: tpl, name: f.name.trim(), client_id: f.client_id || clients[0].id, lead_id: f.lead_id || userId, start_date: f.start_date, end_date: addDays(f.start_date, t.days),
        budget: Number(f.budget || t.budget), contract_value: Number(f.contract_value || 0), priority: f.priority, location: f.location, description: f.description || t.blurb,
      }, userId);
      toast(`Project created with ${t.tasks.length} tasks and ${t.deliverables.length} deliverables`);
      onClose();
      onCreated?.(id);
    } catch (e) { toast((e as Error).message, 'error'); }
  }
  return (
    <Sheet open={open} onClose={onClose} title="New project">
      <div className="flex flex-col gap-3">
        <div className="text-sm font-bold text-[#33465F]">Template</div>
        <div className="grid grid-cols-2 gap-2">
          {TEMPLATES.map((x) => (
            <button key={x.key} type="button" aria-pressed={x.key === tpl} onClick={() => setTpl(x.key)} className={`rounded-2xl p-3 text-left text-sm ${x.key === tpl ? 'border-2 border-basil bg-basil-ice' : 'border border-basil-line bg-white'}`}>
              <b className="block text-basil-ink">{x.name}</b><span className="text-xs text-basil-muted">{x.days} days · {x.tasks.length} tasks</span>
            </button>
          ))}
        </div>
        <p className="m-0 text-xs text-basil-muted">{t.blurb} Deliverables: {t.deliverables.map((d) => d[0]).join(', ')}.</p>
        <Field label="Project name"><input className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. World AIDS Day coverage" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client"><select className={inputCls} value={f.client_id} onChange={(e) => set('client_id', e.target.value)}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Project lead"><select className={inputCls} value={f.lead_id} onChange={(e) => set('lead_id', e.target.value)}>{leads.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></Field>
          <Field label="Start date" hint={`Due ${fmtDate(addDays(f.start_date, t.days))}`}><input type="date" className={inputCls} value={f.start_date} onChange={(e) => set('start_date', e.target.value)} /></Field>
          <Field label="Priority"><select className={inputCls} value={f.priority} onChange={(e) => set('priority', e.target.value)}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
          <Field label="Budget (TSH)"><input inputMode="numeric" className={inputCls} value={f.budget} placeholder={String(t.budget)} onChange={(e) => set('budget', e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="Contract value (TSH)"><input inputMode="numeric" className={inputCls} value={f.contract_value} onChange={(e) => set('contract_value', e.target.value.replace(/\D/g, ''))} /></Field>
        </div>
        <Field label="Location"><input className={inputCls} value={f.location} onChange={(e) => set('location', e.target.value)} /></Field>
        <button type="button" className="btn-primary justify-center" onClick={create}>Create project</button>
      </div>
    </Sheet>
  );
}

// ---------- call sheet ----------
export function CallSheet({ shoot, project, compact }: { shoot: Shoot; project?: Project; compact?: boolean }) {
  const { userId, can } = useActing();
  const people = usePeople();
  const toast = useToast();
  const { rows: allCrew } = useShootCrew();
  const { rows: shoots } = useShoots();
  const { rows: leave } = useLeave();
  const crew = allCrew.filter((c) => c.shoot_id === shoot.id).sort((a, b) => a.call_time.localeCompare(b.call_time));
  const mine = crew.find((c) => c.user_id === userId);
  const text = callSheetText(shoot, project, crew, people);
  const manage = can('boss', 'gm_cfo', 'project_lead') || project?.lead_id === userId;
  const [add, setAdd] = useState({ user: '', role: 'Camera B' });
  const clash = add.user ? bookings(add.user, shoot.shoot_date, shoots, allCrew, leave, shoot.id) : null;
  const done = shoot.shot_list.filter((s) => s.done).length;
  async function toggleShot(i: number) {
    await updateRow('shoots', shoot.id, { shot_list: shoot.shot_list.map((s, j) => (j === i ? { ...s, done: !s.done } : s)) });
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl bg-basil-deep p-4 text-white">
        <div className="font-mono text-[10px] tracking-[0.16em] text-basil-sky">CALL SHEET · {fmtDay(shoot.shoot_date).toUpperCase()}</div>
        <div className="mt-1 font-display text-lg font-extrabold leading-tight">{shoot.title}</div>
        <div className="text-sm text-basil-haze">{project?.name}</div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/10 p-2"><div className="text-[11px] text-basil-haze">Date</div><b>{fmtDate(shoot.shoot_date)}</b></div>
          <div className="rounded-xl bg-white/10 p-2"><div className="text-[11px] text-basil-haze">Crew call</div><b>{mine?.call_time ?? shoot.call_time}</b></div>
          <div className="rounded-xl bg-white/10 p-2"><div className="text-[11px] text-basil-haze">Wrap</div><b>{shoot.wrap_time}</b></div>
        </div>
      </div>
      {mine && (mine.confirmed_at
        ? <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800"><CheckCircle2 size={18} />You confirmed this call sheet · {fmtWhen(mine.confirmed_at)}</div>
        : <button type="button" className="btn-primary min-h-[48px] justify-center" onClick={() => confirmCallSheet(mine).then(() => toast('Confirmed — see you at ' + mine.call_time))}><Check size={18} />I have read the call sheet — confirm</button>)}
      <div className={`grid gap-3 ${compact ? '' : 'md:grid-cols-2'}`}>
        <section className="rounded-2xl border border-basil-line bg-white p-4">
          <h3 className="m-0 mb-2 flex items-center gap-2 text-sm font-extrabold"><MapPin size={16} className="text-basil" />Location</h3>
          <p className="m-0 text-sm">{shoot.location}</p>
          <a className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-bold" href={mapsLink(shoot.location)} target="_blank" rel="noreferrer">Open in Google Maps <ExternalLink size={14} /></a>
          {shoot.contact_name && <div className="mt-1 flex items-center justify-between gap-2 border-t border-basil-line pt-2 text-sm"><span>On-site: <b>{shoot.contact_name}</b></span><a className="flex h-11 w-11 items-center justify-center rounded-full bg-basil-ice" href={telLink(shoot.contact_phone)} aria-label={`Call ${shoot.contact_name}`}><Phone size={16} /></a></div>}
          {shoot.notes && <p className="m-0 mt-2 rounded-xl bg-amber-50 p-2 text-sm text-amber-900">{shoot.notes}</p>}
        </section>
        <section className="rounded-2xl border border-basil-line bg-white p-4">
          <h3 className="m-0 mb-2 text-sm font-extrabold">Crew · {crew.filter((c) => c.confirmed_at).length}/{crew.length} confirmed</h3>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {crew.map((c) => {
              const p = people.find((x) => x.id === c.user_id);
              const b = bookings(c.user_id, shoot.shoot_date, shoots, allCrew, leave, shoot.id);
              return (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <Avatar name={p?.full_name ?? '?'} size={32} />
                  <span className="min-w-0 flex-1"><b className="block truncate">{p?.full_name}</b><span className="text-xs text-basil-muted">{c.call_time} · {c.role}</span>
                    {(b.onShoots.length > 0 || b.onLeave.length > 0) && <span className="block text-xs font-bold text-red-700">⚠ Double-booked: {[...b.onShoots.map((s) => s.title), ...b.onLeave.map((l) => `${l.leave_type} leave`)].join(', ')}</span>}
                  </span>
                  {c.confirmed_at ? <Pill tone="green">Confirmed</Pill> : <Pill tone="amber">Not yet</Pill>}
                </li>
              );
            })}
          </ul>
          {manage && (
            <div className="mt-3 flex flex-col gap-2 border-t border-basil-line pt-3">
              <div className="grid grid-cols-2 gap-2">
                <select aria-label="Crew member" className={inputCls} value={add.user} onChange={(e) => setAdd({ ...add, user: e.target.value })}><option value="">Add crew…</option>{people.filter((p) => !p.roles.includes('client') && !crew.some((c) => c.user_id === p.id)).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
                <input aria-label="Role" className={inputCls} value={add.role} onChange={(e) => setAdd({ ...add, role: e.target.value })} />
              </div>
              {clash && (clash.onShoots.length > 0 || clash.onLeave.length > 0) && <p className="m-0 rounded-xl bg-red-50 p-2 text-xs font-bold text-red-800">⚠ {nameOf(people, add.user)} is already booked that day: {[...clash.onShoots.map((s) => s.title), ...clash.onLeave.map((l) => `${l.leave_type} leave (${l.status})`)].join(', ')}</p>}
              <button type="button" className="btn-outline justify-center" disabled={!add.user} onClick={() => addShootCrew(shoot, add.user, add.role, project?.name ?? '').then(() => (setAdd({ user: '', role: add.role }), toast('Crew added and notified')))}><Plus size={16} />Add to call sheet</button>
            </div>
          )}
        </section>
        <section className="rounded-2xl border border-basil-line bg-white p-4">
          <h3 className="m-0 mb-2 text-sm font-extrabold">Shot list · {done} of {shoot.shot_list.length}</h3>
          <ul className="m-0 flex list-none flex-col p-0">
            {shoot.shot_list.map((s, i) => (
              <li key={i}><label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={s.done} onChange={() => toggleShot(i)} /><span className="w-5 font-mono text-xs text-basil-muted">{i + 1}</span><span className={s.done ? 'text-basil-muted line-through' : ''}>{s.text}</span></label></li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-basil-line bg-white p-4">
          <h3 className="m-0 mb-2 text-sm font-extrabold">Equipment</h3>
          <p className="m-0 text-sm">{shoot.equipment || 'To be confirmed with the store.'}</p>
          <h3 className="m-0 mb-1 mt-3 flex items-center gap-1.5 text-sm font-extrabold text-red-700"><ShieldAlert size={16} />Emergency</h3>
          <p className="m-0 text-sm">{shoot.emergency_contacts}</p>
          <p className="m-0 mt-1 text-sm"><b>Nearest hospital:</b> {shoot.nearest_hospital}</p>
        </section>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <a className="btn-primary justify-center" href={waLink(text)} target="_blank" rel="noreferrer"><Send size={16} />Share on WhatsApp</a>
        <button type="button" className="btn-outline justify-center" onClick={() => printCallSheet(shoot, project, crew, people) || toast('Allow pop-ups to print', 'error')}><Printer size={16} />Print</button>
      </div>
    </div>
  );
}

// ---------- post-production ----------
export function PostRow({ d, people, project, canEdit }: { d: Deliverable; people: Person[]; project?: Project; canEdit: boolean }) {
  const toast = useToast();
  const ix = Math.max(0, POST_STEPS.indexOf(d.post_status));
  const ready = d.post_status === 'Ready for review';
  return (
    <div className="rounded-2xl border border-basil-line bg-white p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0"><b className="block">{d.title}</b><span className="text-xs text-basil-muted">{project ? `${project.name} · ` : ''}{d.spec} · {firstName(people, d.owner_id)} · due {fmtDate(d.due_date)}</span></div>
        <div className="flex flex-wrap gap-1.5">
          {d.revision_round > 0 && <Pill tone={d.revision_round >= 3 ? 'red' : 'amber'}>Revision round {d.revision_round}</Pill>}
          {d.delivered_at ? <Pill tone="green">Delivered {fmtDate(d.delivered_at)}</Pill> : <Pill tone={ready ? 'green' : d.due_date < today() ? 'red' : 'blue'}>{d.post_status}</Pill>}
        </div>
      </div>
      <StageTracker stages={POST_STEPS} current={ready ? POST_STEPS.length : ix} />
      {canEdit && !d.delivered_at && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!ready && <button type="button" className="btn-primary" onClick={() => setPostStatus(d, POST_STEPS[ix + 1]).then(() => toast(`${d.title}: ${POST_STEPS[ix + 1]}`))}>Mark “{d.post_status}” done → {POST_STEPS[ix + 1]}</button>}
          {ix > 0 && !ready && <button type="button" className="btn-outline" onClick={() => setPostStatus(d, POST_STEPS[ix - 1])}>Step back</button>}
          {ready && <button type="button" className="btn-outline" onClick={() => sendBackForRevision(d).then(() => toast(`Revision round ${d.revision_round + 1} started`))}>Client asked for changes</button>}
          {ready && <button type="button" className="btn-primary" onClick={() => markDelivered(d).then(() => toast('Marked delivered'))}><Check size={16} />Delivered to client</button>}
        </div>
      )}
    </div>
  );
}

// ---------- footage safety ----------
export function CardSafety({ m, shoot, copies, people, canEdit }: { m: MediaCard; shoot?: Shoot; copies: FootageCopy[]; people: Person[]; canEdit: boolean }) {
  const { userId } = useActing();
  const toast = useToast();
  const mine = copies.filter((c) => c.card_id === m.id);
  const state = cardState(m, shoot, copies);
  const [where, setWhere] = useState('');
  const n = verifiedCopies(m, copies);
  return (
    <div className={`rounded-2xl border p-3 ${state === 'risk' ? 'border-red-300 bg-red-50' : 'border-basil-line bg-white'}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${state === 'risk' ? 'bg-red-600 text-white' : state === 'safe' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}><HardDrive size={18} /></span>
        <div className="min-w-0 flex-1">
          <b className="block">{m.label} <span className="text-xs font-normal text-basil-muted">· {m.kind} · {m.size_gb} GB · {firstName(people, m.shot_by)}</span></b>
          <span className="text-xs text-basil-muted">{shoot?.title}{shoot?.wrapped_at ? ` · wrapped ${fmtWhen(shoot.wrapped_at)}` : ''}</span>
        </div>
        {state === 'risk' ? <Pill tone="red"><AlertTriangle size={12} />Footage at risk</Pill> : state === 'safe' ? <Pill tone="green">Safe · {n} copies</Pill> : <Pill tone="amber">{n}/2 copies</Pill>}
      </div>
      <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
        {mine.map((c) => (
          <li key={c.id} className="flex items-center gap-2 text-sm">
            {c.verified ? <CheckCircle2 size={16} className="text-emerald-600" /> : <Clock size={16} className="text-amber-600" />}
            <span className="flex-1">{c.location}</span>
            {c.verified ? <span className="text-xs text-basil-muted">verified · {firstName(people, c.verified_by)}</span>
              : canEdit && <button type="button" className="min-h-[36px] rounded-full border border-basil-edge bg-white px-3 text-xs font-bold text-basil-deep" onClick={() => verifyCopy(c, userId).then(() => toast('Copy verified'))}>Verify checksum</button>}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (where.trim()) insertRow('footage_copies', { card_id: m.id, location: where.trim(), verified: false, verified_by: null }).then(() => (setWhere(''), toast('Copy logged — verify it next'))); }}>
          <input className={inputCls} list="copy-places" placeholder="Add copy: NAS, backup drive…" value={where} onChange={(e) => setWhere(e.target.value)} aria-label="Copy location" />
          <datalist id="copy-places"><option value="NAS · Projects/2026" /><option value="Backup drive ORANGE-04" /><option value="Backup drive BLUE-02" /><option value="Cloud (offsite)" /></datalist>
          <button type="submit" className="btn-outline shrink-0" aria-label="Add copy"><Plus size={16} /></button>
        </form>
      )}
    </div>
  );
}

// ---------- glance pieces ----------
export function ProjectLine({ p, onOpen }: { p: Project; onOpen?: () => void }) {
  const { rows: tasks } = useTasks();
  const { rows: clients } = useClients();
  const h = useMemo(() => projectHealth(p, tasks), [p, tasks]);
  const C = onOpen ? 'button' : 'div';
  return (
    <C type={onOpen ? 'button' : undefined} onClick={onOpen} className="flex w-full flex-col gap-2 rounded-2xl border border-basil-line bg-white p-3 text-left">
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${HEALTH_DOT[h.tone]}`} title={h.reasons.join(' · ')} />
        <div className="min-w-0 flex-1"><b className="block truncate text-[15px] text-basil-ink">{p.name}</b><span className="block truncate text-xs text-basil-muted">{clients.find((c) => c.id === p.client_id)?.name} · {p.stage}</span></div>
        <span className={`shrink-0 text-xs font-bold ${h.tone === 'red' ? 'text-red-700' : 'text-basil-muted'}`}>Due {fmtDate(p.end_date)}</span>
      </div>
      <BudgetBar p={p} />
    </C>
  );
}
