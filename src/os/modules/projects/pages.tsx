// Desktop pages: projects board, project page, tasks, shoots & crew calendar, post-production, footage safety.
import { useMemo, useState, type DragEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, Clapperboard, HardDrive, LayoutGrid, List, Plus, UserMinus, Users } from 'lucide-react';
import { PageTitle } from '@/os/OsLayout';
import { useActing } from '@/os/lib/session';
import { deleteRow, insertRow, usePeople } from '@/os/lib/store';
import { useToast } from '@/os/cms/toast';
import { Avatar, Card, Empty, Field, inputCls, Pill, Progress, Sheet, StageTracker, Stat, Tabs, tsh, tshShort } from '@/os/ui';
import {
  addDays, cardState, CREW_ROLES, daysBetween, fmtDate, fmtDay, footageAtRisk, HEALTH_DOT, isOverdue, PROJECT_STAGES, projectHealth, today,
  type Project, type Shoot,
} from './lib';
import {
  bookings, moveStage, useCards, useClients, useCopies, useCrew, useDeliverables, useGateCtx, useLeave, useProjects, useShootCrew, useShoots,
  useTasks, visibleProjects, wrapShoot,
} from './data';
import { BudgetBar, CallSheet, CardSafety, firstName, HealthDot, nameOf, NewProjectSheet, PostRow, TaskList } from './components';

const LEADERS = ['boss', 'gm_cfo', 'project_lead'] as const;
function useScope() {
  const { userId, can, scope } = useActing();
  const { rows: projects } = useProjects();
  const { rows: crew } = useCrew();
  const seeAll = can('boss', 'gm_cfo', 'finance', 'project_lead') && !scope;
  return { userId, seeAll, projects: visibleProjects(projects, crew, userId, seeAll, scope), crew };
}

// ================= Board =================
export function ProjectsBoard() {
  const { projects } = useScope();
  const { can } = useActing();
  const people = usePeople();
  const { rows: clients } = useClients();
  const ctx = useGateCtx();
  const toast = useToast();
  const nav = useNavigate();
  const [view, setView] = useState<'board' | 'list' | 'timeline'>('board');
  const [creating, setCreating] = useState(false);
  const [over, setOver] = useState<string | null>(null);
  const health = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, projectHealth(p, ctx.tasks)])), [projects, ctx.tasks]);
  const active = projects.filter((p) => p.stage !== 'Archive');
  const count = (t: string) => active.filter((p) => health[p.id]?.tone === t).length;

  async function move(p: Project, stage: string) {
    if (stage === p.stage) return;
    try {
      await moveStage(p, stage, ctx);
      toast(`${p.name} → ${stage}`);
    } catch (e) { toast((e as Error).message, 'error'); }
  }
  const onDrop = (stage: string) => (e: DragEvent) => {
    e.preventDefault();
    setOver(null);
    const p = projects.find((x) => x.id === e.dataTransfer.getData('text/plain'));
    if (p) move(p, stage);
  };
  const client = (id: string) => clients.find((c) => c.id === id)?.name ?? '';

  return (
    <>
      <PageTitle tag="WORK · PROJECTS" title="Every project, one glance" sub="Drag a card to move it along the pipeline — stage gates check footage, drafts and deliveries first.">
        {can(...LEADERS) && <button type="button" className="btn-primary" onClick={() => setCreating(true)}><Plus size={18} />New project</button>}
      </PageTitle>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active projects" value={active.length} sub={`${tshShort(active.reduce((s, p) => s + Number(p.budget), 0))} in budgets`} />
        <Stat label="On track" value={count('green')} tone="green" sub="Green health" />
        <Stat label="At risk" value={count('amber')} tone="amber" sub="Deadline, spend or tasks slipping" />
        <Stat label="In trouble" value={count('red')} tone="red" sub="Late, over budget or many overdue" />
      </div>
      <div className="mb-4 flex gap-1.5" role="tablist">
        {([['board', 'Board', LayoutGrid], ['list', 'List', List], ['timeline', 'Timeline', CalendarDays]] as const).map(([k, l, I]) => (
          <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`flex min-h-[40px] items-center gap-1.5 rounded-full px-4 text-sm font-semibold ${view === k ? 'border-0 bg-basil text-white' : 'border border-basil-edge bg-white text-basil-deep'}`}><I size={16} />{l}</button>
        ))}
      </div>

      {view === 'board' && (
        <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
          {PROJECT_STAGES.map((stage, si) => {
            const cards = projects.filter((p) => p.stage === stage);
            return (
              <section key={stage} onDragOver={(e) => (e.preventDefault(), setOver(stage))} onDragLeave={() => setOver((o) => (o === stage ? null : o))} onDrop={onDrop(stage)}
                className={`flex w-[264px] shrink-0 flex-col gap-2 rounded-2xl p-2 transition ${over === stage ? 'bg-basil-ice ring-2 ring-basil' : 'bg-[#E9F0F8]'}`} aria-label={stage}>
                <h2 className="m-0 flex items-center justify-between px-1 pt-1 text-sm font-extrabold"><span>{stage}</span><span className="rounded-full bg-white px-2 text-xs text-basil-muted">{cards.length}</span></h2>
                {cards.map((p) => {
                  const h = health[p.id];
                  return (
                    <article key={p.id} draggable={can(...LEADERS)} onDragStart={(e) => e.dataTransfer.setData('text/plain', p.id)} className="cursor-grab rounded-xl border border-basil-line bg-white p-3 shadow-[0_1px_0_rgba(10,47,92,0.05)] active:cursor-grabbing">
                      <Link to={`/os/projects/${p.id}`} className="block font-bold leading-snug text-basil-ink no-underline hover:text-basil">{p.name}</Link>
                      <div className="mt-0.5 text-xs text-basil-muted">{client(p.client_id)} · Due {fmtDate(p.end_date)}</div>
                      <div className="my-2"><BudgetBar p={p} /></div>
                      <div className="flex items-center justify-between">
                        <span title={h.reasons.join(' · ')}><HealthDot tone={h.tone} label={h.label} /></span>
                        <span className="flex items-center gap-1"><Avatar name={nameOf(people, p.lead_id)} size={28} />
                          {can(...LEADERS) && si < PROJECT_STAGES.length - 1 && <button type="button" aria-label={`Move to ${PROJECT_STAGES[si + 1]}`} title={`Move to ${PROJECT_STAGES[si + 1]}`} onClick={() => move(p, PROJECT_STAGES[si + 1])} className="flex h-9 w-9 items-center justify-center rounded-full border border-basil-edge bg-white text-basil"><ArrowRight size={16} /></button>}
                        </span>
                      </div>
                    </article>
                  );
                })}
                {!cards.length && <div className="rounded-xl border border-dashed border-basil-edge p-4 text-center text-xs text-basil-muted">Drop here</div>}
              </section>
            );
          })}
        </div>
      )}

      {view === 'list' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="text-left text-xs text-basil-muted"><th className="py-2">Project</th><th>Stage</th><th>Lead</th><th>Due</th><th className="w-40">Budget</th><th>Health</th></tr></thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-t border-basil-line">
                    <td className="py-2.5"><Link to={`/os/projects/${p.id}`} className="font-bold no-underline">{p.name}</Link><div className="text-xs text-basil-muted">{client(p.client_id)} · {p.service}</div></td>
                    <td>{p.stage}</td><td><LeadName id={p.lead_id} /></td><td>{fmtDate(p.end_date)}</td><td className="pr-4"><BudgetBar p={p} /></td>
                    <td title={health[p.id].reasons.join(' · ')}><HealthDot tone={health[p.id].tone} label={health[p.id].reasons[0]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {view === 'timeline' && <Timeline projects={projects} health={health} />}
      <NewProjectSheet open={creating} onClose={() => setCreating(false)} onCreated={(id) => nav(`/os/projects/${id}`)} />
    </>
  );
}
function LeadName({ id }: { id: string }) {
  const people = usePeople();
  return <>{nameOf(people, id)}</>;
}

function Timeline({ projects, health }: { projects: Project[]; health: Record<string, { tone: string }> }) {
  const { rows: shoots } = useShoots();
  const from = addDays(today(), -21), to = addDays(today(), 63);
  const span = daysBetween(from, to);
  const pct = (iso: string) => Math.min(100, Math.max(0, (daysBetween(from, iso) / span) * 100));
  const weeks = Array.from({ length: Math.ceil(span / 7) }, (_, i) => addDays(from, i * 7));
  return (
    <Card>
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="relative ml-[200px] h-6 text-[10px] text-basil-muted">{weeks.map((w) => <span key={w} className="absolute" style={{ left: `${pct(w)}%` }}>{fmtDay(w)}</span>)}</div>
          {projects.map((p) => (
            <div key={p.id} className="flex items-center border-t border-basil-line py-2">
              <Link to={`/os/projects/${p.id}`} className="w-[200px] shrink-0 truncate pr-2 text-sm font-bold no-underline">{p.name}</Link>
              <div className="relative h-7 flex-1 rounded bg-basil-mist">
                <div className="absolute inset-y-0 w-px bg-red-500" style={{ left: `${pct(today())}%` }} title="Today" />
                <div className={`absolute top-1 h-5 rounded-full opacity-80 ${HEALTH_DOT[health[p.id]?.tone]}`} style={{ left: `${pct(p.start_date)}%`, width: `${Math.max(1, pct(p.end_date) - pct(p.start_date))}%` }} title={`${fmtDate(p.start_date)} – ${fmtDate(p.end_date)} · ${p.stage}`}>
                  <span className="ml-2 whitespace-nowrap text-[10px] font-bold leading-5 text-white">{p.stage}</span>
                </div>
                {shoots.filter((s) => s.project_id === p.id).map((s) => <span key={s.id} className="absolute top-0 h-7 w-1.5 rounded bg-basil-deep" style={{ left: `${pct(s.shoot_date)}%` }} title={`${s.title} · ${fmtDate(s.shoot_date)}`} />)}
              </div>
            </div>
          ))}
          <p className="m-0 mt-2 text-xs text-basil-muted">Bars: project dates coloured by health · dark ticks: shoot days · red line: today.</p>
        </div>
      </div>
    </Card>
  );
}

// ================= Project page =================
type PTab = 'overview' | 'tasks' | 'shoots' | 'post' | 'footage';
export function ProjectPage() {
  const { id } = useParams();
  const { rows: projects, loading } = useProjects();
  const { rows: clients } = useClients();
  const { rows: crew } = useCrew();
  const { rows: shoots } = useShoots();
  const { rows: dels } = useDeliverables();
  const { rows: cards } = useCards();
  const { rows: copies } = useCopies();
  const ctx = useGateCtx();
  const people = usePeople();
  const { can, userId } = useActing();
  const toast = useToast();
  const [tab, setTab] = useState<PTab>('overview');
  const [sheet, setSheet] = useState<Shoot | null>(null);
  const [newShoot, setNewShoot] = useState(false);
  const p = projects.find((x) => x.id === id);
  if (!p) return loading ? null : <Empty title="Project not found" action={<Link to="/os/projects" className="btn-outline">Back to projects</Link>} />;
  const h = projectHealth(p, ctx.tasks);
  const ix = PROJECT_STAGES.indexOf(p.stage);
  const manage = can('boss', 'gm_cfo', 'project_lead') || p.lead_id === userId;
  const pTasks = ctx.tasks.filter((t) => t.project_id === p.id);
  const pCrew = crew.filter((c) => c.project_id === p.id);
  const pShoots = shoots.filter((s) => s.project_id === p.id);
  const pDels = dels.filter((d) => d.project_id === p.id);
  const pCards = cards.filter((m) => m.project_id === p.id);
  const risk = footageAtRisk(pCards, pShoots, copies);
  const spent = Number(p.spent ?? 0);
  const margin = Number(p.contract_value) ? Math.round(((Number(p.contract_value) - spent) / Number(p.contract_value)) * 100) : 0;
  const move = (stage: string) => moveStage(p, stage, ctx).then(() => toast(`Moved to ${stage}`)).catch((e) => toast(e.message, 'error'));

  return (
    <>
      <Link to="/os/projects" className="mb-3 inline-flex items-center gap-1 text-sm font-bold no-underline"><ArrowLeft size={16} />Projects board</Link>
      <PageTitle tag={`PROJECT · ${p.code ?? p.id}`} title={p.name} sub={`${clients.find((c) => c.id === p.client_id)?.name ?? ''} · ${p.service} · Lead ${nameOf(people, p.lead_id)} · Due ${fmtDate(p.end_date)}`}>
        <div title={h.reasons.join(' · ')} className={`rounded-2xl px-4 py-2 text-sm font-bold ${h.tone === 'red' ? 'bg-red-50 text-red-800' : h.tone === 'amber' ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-800'}`}><HealthDot tone={h.tone} label={`Health ${h.label}`} /><div className="text-xs font-normal">{h.reasons.join(' · ')}</div></div>
      </PageTitle>
      {risk.length > 0 && <div className="mb-4 flex items-center gap-2 rounded-2xl bg-red-600 p-3 text-sm font-bold text-white"><AlertTriangle size={18} />Footage at risk: {risk.map((m) => m.label).join(', ')} — fewer than 2 verified copies 24 h after wrap.<button type="button" className="ml-auto rounded-full border-0 bg-white px-3 py-1.5 text-red-700" onClick={() => setTab('footage')}>Fix now</button></div>}
      <Card className="mb-4">
        <StageTracker stages={PROJECT_STAGES} current={ix} />
        {manage && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {ix > 0 && <button type="button" className="btn-outline" onClick={() => move(PROJECT_STAGES[ix - 1])}><ArrowLeft size={16} />{PROJECT_STAGES[ix - 1]}</button>}
            {ix < PROJECT_STAGES.length - 1 && <button type="button" className="btn-primary" onClick={() => move(PROJECT_STAGES[ix + 1])}>Move to {PROJECT_STAGES[ix + 1]}<ArrowRight size={16} /></button>}
          </div>
        )}
      </Card>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Contract value" value={tshShort(Number(p.contract_value))} />
        <Stat label="Budget" value={tshShort(Number(p.budget))} sub={<Progress value={spent} max={Number(p.budget)} />} />
        <Stat label="Spent so far" value={tshShort(spent)} tone={spent > Number(p.budget) ? 'red' : spent > Number(p.budget) * 0.8 ? 'amber' : undefined} sub={`${tsh(Number(p.budget) - spent)} left`} />
        <Stat label="Margin now" value={`${margin}%`} tone={margin < 20 ? 'red' : margin < 35 ? 'amber' : 'green'} />
      </div>
      <div className="mb-4"><Tabs<PTab> value={tab} onChange={setTab} items={[
        { value: 'overview', label: 'Overview' }, { value: 'tasks', label: 'Tasks', count: pTasks.filter((t) => t.status !== 'Done').length },
        { value: 'shoots', label: 'Shoots', count: pShoots.length }, { value: 'post', label: 'Deliverables', count: pDels.length }, { value: 'footage', label: 'Footage', count: pCards.length },
      ]} /></div>

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card title="Brief">
            <p className="m-0 text-sm leading-relaxed">{p.description || 'No description yet.'}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-xs text-basil-muted">Dates</dt><dd className="m-0 font-bold">{fmtDate(p.start_date)} – {fmtDate(p.end_date)}</dd></div>
              <div><dt className="text-xs text-basil-muted">Location</dt><dd className="m-0 font-bold">{p.location}</dd></div>
              <div><dt className="text-xs text-basil-muted">Priority</dt><dd className="m-0 font-bold">{p.priority}</dd></div>
              <div><dt className="text-xs text-basil-muted">Overdue tasks</dt><dd className="m-0 font-bold">{pTasks.filter(isOverdue).length}</dd></div>
            </dl>
          </Card>
          <CrewCard projectId={p.id} crew={pCrew} manage={manage} />
        </div>
      )}
      {tab === 'tasks' && <TaskList tasks={pTasks} people={people} projects={projects} showProject={false} defaults={{ project_id: p.id }} />}
      {tab === 'shoots' && (
        <div className="flex flex-col gap-3">
          {manage && <div><button type="button" className="btn-primary" onClick={() => setNewShoot(true)}><Plus size={16} />Schedule shoot</button></div>}
          {pShoots.map((s) => <ShootRow key={s.id} s={s} onOpen={() => setSheet(s)} />)}
          {!pShoots.length && <Empty icon={<Clapperboard />} title="No shoot days yet" sub="Schedule one to unlock the Shoot stage." />}
        </div>
      )}
      {tab === 'post' && (
        <div className="flex flex-col gap-3">
          {pDels.map((d) => <PostRow key={d.id} d={d} people={people} canEdit={manage || d.owner_id === userId} />)}
          {manage && <AddDeliverable projectId={p.id} />}
        </div>
      )}
      {tab === 'footage' && <FootageList shoots={pShoots} cards={pCards} canAdd={manage || pCrew.some((c) => c.user_id === userId)} />}
      <Sheet open={!!sheet} onClose={() => setSheet(null)} title="Call sheet">{sheet && <CallSheet shoot={shoots.find((s) => s.id === sheet.id) ?? sheet} project={p} compact />}</Sheet>
      <NewShootSheet open={newShoot} onClose={() => setNewShoot(false)} project={p} />
    </>
  );
}

function CrewCard({ projectId, crew, manage }: { projectId: string; crew: { id: string; user_id: string; role: string }[]; manage: boolean }) {
  const people = usePeople();
  const toast = useToast();
  const [f, setF] = useState({ user: '', role: 'Camera A' });
  return (
    <Card title={<span className="flex items-center gap-2"><Users size={18} />Crew</span>}>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {crew.map((c) => (
          <li key={c.id} className="flex items-center gap-2 text-sm"><Avatar name={nameOf(people, c.user_id)} size={32} /><span className="flex-1"><b className="block">{nameOf(people, c.user_id)}</b><span className="text-xs text-basil-muted">{c.role}</span></span>
            {manage && c.role !== 'Project lead' && <button type="button" aria-label="Remove from crew" className="flex h-10 w-10 items-center justify-center rounded-full border-0 bg-transparent text-basil-muted" onClick={() => deleteRow('project_crew', c.id)}><UserMinus size={16} /></button>}
          </li>
        ))}
      </ul>
      {manage && (
        <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
          <select aria-label="Person" className={inputCls} value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })}><option value="">Add person…</option>{people.filter((p) => !p.roles.includes('client') && !crew.some((c) => c.user_id === p.id)).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
          <select aria-label="Role" className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{CREW_ROLES.map((r) => <option key={r}>{r}</option>)}</select>
          <button type="button" className="btn-primary" disabled={!f.user} onClick={() => insertRow('project_crew', { project_id: projectId, user_id: f.user, role: f.role, days: 0 }).then(() => (setF({ ...f, user: '' }), toast('Added to crew')))}><Plus size={16} /></button>
        </div>
      )}
    </Card>
  );
}

function AddDeliverable({ projectId }: { projectId: string }) {
  const people = usePeople();
  const [f, setF] = useState({ title: '', spec: '', owner_id: '', due_date: addDays(today(), 7) });
  return (
    <form className="grid gap-2 rounded-2xl border border-dashed border-basil-edge bg-white p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); if (f.title.trim()) insertRow('deliverables', { project_id: projectId, ...f, owner_id: f.owner_id || null, post_status: 'Not started', revision_round: 0, delivered_at: null }).then(() => setF({ ...f, title: '', spec: '' })); }}>
      <input aria-label="Deliverable" className={inputCls} placeholder="New deliverable" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <input aria-label="Spec" className={inputCls} placeholder="Spec (length, format)" value={f.spec} onChange={(e) => setF({ ...f, spec: e.target.value })} />
      <select aria-label="Owner" className={inputCls} value={f.owner_id} onChange={(e) => setF({ ...f, owner_id: e.target.value })}><option value="">Owner…</option>{people.filter((p) => !p.roles.includes('client')).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
      <input aria-label="Due" type="date" className={inputCls} value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
      <button type="submit" className="btn-primary"><Plus size={16} />Add</button>
    </form>
  );
}

export function ShootRow({ s, onOpen }: { s: Shoot; onOpen: () => void }) {
  const { rows: crew } = useShootCrew();
  const { rows: projects } = useProjects();
  const people = usePeople();
  const c = crew.filter((x) => x.shoot_id === s.id);
  const conf = c.filter((x) => x.confirmed_at).length;
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-2xl border border-basil-line bg-white p-3 text-left">
      <span className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ${s.shoot_date === today() ? 'bg-basil text-white' : 'bg-basil-ice text-basil-deep'}`}><span className="text-[10px] font-bold uppercase">{fmtDay(s.shoot_date).split(' ')[0]}</span><b className="text-lg leading-none">{s.shoot_date.slice(8)}</b></span>
      <span className="min-w-0 flex-1"><b className="block truncate text-basil-ink">{s.title}</b><span className="block truncate text-xs text-basil-muted">{projects.find((p) => p.id === s.project_id)?.name} · call {s.call_time} · {s.location}</span><span className="block truncate text-xs text-basil-muted">{c.map((x) => firstName(people, x.user_id)).join(', ')}</span></span>
      {s.status === 'Wrapped' ? <Pill tone="grey">Wrapped</Pill> : <Pill tone={conf === c.length ? 'green' : 'amber'}>{conf}/{c.length} confirmed</Pill>}
    </button>
  );
}

function NewShootSheet({ open, onClose, project }: { open: boolean; onClose: () => void; project: Project }) {
  const toast = useToast();
  const [f, setF] = useState({ title: '', shoot_date: addDays(today(), 3), call_time: '07:00', wrap_time: '17:00', location: project.location, contact_name: '', contact_phone: '', nearest_hospital: '', equipment: '', shots: '', notes: '' });
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  async function save() {
    if (!f.title.trim()) return toast('Give the shoot day a title', 'error');
    const { shots, ...rest } = f;
    await insertRow('shoots', { ...rest, project_id: project.id, shot_list: shots.split('\n').map((t) => t.trim()).filter(Boolean).map((text) => ({ text, done: false })), emergency_contacts: 'Police · Fire · Ambulance 112 · Saul (GM/CFO) +255712000002', status: 'Planned', wrapped_at: null });
    toast('Shoot scheduled — add crew on the call sheet');
    onClose();
  }
  return (
    <Sheet open={open} onClose={onClose} title="Schedule shoot day">
      <div className="flex flex-col gap-3">
        <Field label="Title"><input className={inputCls} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Day 1 · interviews" /></Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Date"><input type="date" className={inputCls} value={f.shoot_date} onChange={(e) => set('shoot_date', e.target.value)} /></Field>
          <Field label="Call"><input type="time" className={inputCls} value={f.call_time} onChange={(e) => set('call_time', e.target.value)} /></Field>
          <Field label="Wrap"><input type="time" className={inputCls} value={f.wrap_time} onChange={(e) => set('wrap_time', e.target.value)} /></Field>
        </div>
        <Field label="Location (used for the Google Maps link)"><input className={inputCls} value={f.location} onChange={(e) => set('location', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="On-site contact"><input className={inputCls} value={f.contact_name} onChange={(e) => set('contact_name', e.target.value)} /></Field>
          <Field label="Contact phone"><input className={inputCls} value={f.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} /></Field>
        </div>
        <Field label="Nearest hospital"><input className={inputCls} value={f.nearest_hospital} onChange={(e) => set('nearest_hospital', e.target.value)} placeholder="Name, area · phone" /></Field>
        <Field label="Equipment"><textarea className={`${inputCls} h-16 py-2`} value={f.equipment} onChange={(e) => set('equipment', e.target.value)} /></Field>
        <Field label="Shot list" hint="One shot per line"><textarea className={`${inputCls} h-24 py-2`} value={f.shots} onChange={(e) => set('shots', e.target.value)} /></Field>
        <Field label="Notes"><input className={inputCls} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        <button type="button" className="btn-primary justify-center" onClick={save}>Schedule</button>
      </div>
    </Sheet>
  );
}

function FootageList({ shoots, cards, canAdd }: { shoots: Shoot[]; cards: { id: string; shoot_id: string }[]; canAdd: boolean }) {
  const { rows: allCards } = useCards();
  const { rows: copies } = useCopies();
  const people = usePeople();
  const { userId } = useActing();
  const toast = useToast();
  const [f, setF] = useState({ shoot: '', label: '', kind: 'Memory card', size: '256' });
  const list = allCards.filter((m) => cards.some((c) => c.id === m.id));
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl bg-basil-deep p-4 text-sm text-white"><b>3-2-1 backup rule.</b> Three copies, two different drives, one offsite. No card is formatted until it has at least two verified copies. A card is flagged red when it still has fewer than two verified copies 24 hours after wrap.</div>
      {shoots.map((s) => {
        const sc = list.filter((m) => m.shoot_id === s.id);
        if (!sc.length && s.status !== 'Wrapped') return null;
        return (
          <Card key={s.id} title={`${s.title} · ${fmtDate(s.shoot_date)}`} action={s.status === 'Planned' && s.shoot_date <= today() ? <button type="button" className="btn-outline" onClick={() => wrapShoot(s).then(() => toast('Shoot wrapped — back up every card within 24 h'))}>Mark wrapped</button> : <Pill tone="grey">{s.status}</Pill>}>
            <div className="flex flex-col gap-2">
              {sc.map((m) => <CardSafety key={m.id} m={m} shoot={s} copies={copies} people={people} canEdit={canAdd} />)}
              {!sc.length && <p className="m-0 text-sm text-basil-muted">No cards logged for this shoot.</p>}
            </div>
          </Card>
        );
      })}
      {canAdd && shoots.length > 0 && (
        <form className="grid gap-2 rounded-2xl border border-dashed border-basil-edge bg-white p-3 sm:grid-cols-[1.4fr_1fr_1fr_0.6fr_auto]" onSubmit={(e) => { e.preventDefault(); const s = shoots.find((x) => x.id === (f.shoot || shoots[0].id))!; if (f.label.trim()) insertRow('media_cards', { shoot_id: s.id, project_id: s.project_id, label: f.label.trim(), kind: f.kind, size_gb: Number(f.size), shot_by: userId, formatted: false }).then(() => (setF({ ...f, label: '' }), toast('Card logged'))); }}>
          <select aria-label="Shoot" className={inputCls} value={f.shoot} onChange={(e) => setF({ ...f, shoot: e.target.value })}>{shoots.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select>
          <input aria-label="Card label" className={inputCls} placeholder="Card A003" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
          <select aria-label="Kind" className={inputCls} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option>Memory card</option><option>Drive</option></select>
          <input aria-label="Size GB" inputMode="numeric" className={inputCls} value={f.size} onChange={(e) => setF({ ...f, size: e.target.value.replace(/\D/g, '') })} />
          <button type="submit" className="btn-primary"><HardDrive size={16} />Log</button>
        </form>
      )}
    </div>
  );
}

// ================= Tasks =================
export function TasksPage() {
  const { userId, can } = useActing();
  const { projects } = useScope();
  const { rows: all } = useTasks();
  const people = usePeople();
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const pids = new Set(projects.map((p) => p.id));
  const tasks = all.filter((t) => (scope === 'mine' ? t.assignee_id === userId : pids.has(t.project_id)));
  return (
    <>
      <PageTitle tag="WORK · TASKS" title={scope === 'mine' ? 'My tasks' : 'All tasks'} sub="Assigning a task notifies the person in the app with a ready SMS text." />
      {can('boss', 'gm_cfo', 'project_lead') && <div className="mb-4"><Tabs value={scope} onChange={setScope} items={[{ value: 'mine', label: 'My tasks', count: all.filter((t) => t.assignee_id === userId && t.status !== 'Done').length }, { value: 'all', label: 'Everyone', count: tasks.length }]} /></div>}
      <TaskList tasks={tasks} people={people} projects={projects} />
    </>
  );
}

// ================= Shoots & crew calendar =================
export function ShootsPage() {
  const { projects } = useScope();
  const { rows: shoots } = useShoots();
  const { rows: crew } = useShootCrew();
  const { rows: leave } = useLeave();
  const people = usePeople();
  const [open, setOpen] = useState<Shoot | null>(null);
  const pids = new Set(projects.map((p) => p.id));
  const mineShoots = shoots.filter((s) => pids.has(s.project_id));
  const upcoming = mineShoots.filter((s) => s.shoot_date >= today());
  const days = Array.from({ length: 14 }, (_, i) => addDays(today(), i));
  const staff = people.filter((p) => p.roles.some((r) => ['staff', 'project_lead', 'driver', 'growth'].includes(r)));
  const doubles = staff.flatMap((p) => days.filter((d) => { const b = bookings(p.id, d, shoots, crew, leave); return b.onShoots.length + b.onLeave.length > 1; }).map((d) => ({ p, d })));
  return (
    <>
      <PageTitle tag="WORK · SHOOTS" title="Shoots & crew calendar" sub="Call sheets for the next two weeks, crew confirmations and double-booking warnings." />
      {doubles.length > 0 && <div className="mb-4 flex flex-col gap-1 rounded-2xl bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">{doubles.map(({ p, d }) => <span key={p.id + d}><AlertTriangle size={14} className="mr-1 inline" /><b>{p.full_name}</b> is double-booked on {fmtDay(d)}: {[...bookings(p.id, d, shoots, crew, leave).onShoots.map((s) => s.title), ...bookings(p.id, d, shoots, crew, leave).onLeave.map((l) => `${l.leave_type} leave`)].join(' + ')}</span>)}</div>}
      <Card title="Crew availability · next 14 days" className="mb-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-separate border-spacing-1 text-xs">
            <thead><tr><th className="w-36 text-left">Crew</th>{days.map((d) => <th key={d} className={`font-semibold ${d === today() ? 'text-basil' : 'text-basil-muted'}`}>{fmtDay(d).replace(' ', '\n')}</th>)}</tr></thead>
            <tbody>
              {staff.map((p) => (
                <tr key={p.id}>
                  <td className="truncate text-sm font-bold">{p.full_name}</td>
                  {days.map((d) => {
                    const b = bookings(p.id, d, shoots, crew, leave);
                    const n = b.onShoots.length + b.onLeave.length;
                    const label = [...b.onShoots.map((s) => s.title), ...b.onLeave.map((l) => `${l.leave_type} leave (${l.status})`)].join(' · ');
                    return <td key={d} title={label || 'Free'} className={`h-9 rounded text-center font-bold ${n > 1 ? 'bg-red-600 text-white' : b.onLeave.length ? 'bg-amber-200 text-amber-900' : n ? 'bg-basil text-white' : 'bg-basil-mist text-basil-muted'}`}>{n > 1 ? '!!' : b.onLeave.length ? 'L' : n ? '●' : ''}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="m-0 mt-2 text-xs text-basil-muted">● on a shoot · L leave · !! double-booked</p>
      </Card>
      <h2 className="mb-2 text-base font-extrabold">Upcoming shoots</h2>
      <div className="flex flex-col gap-2">{upcoming.map((s) => <ShootRow key={s.id} s={s} onOpen={() => setOpen(s)} />)}</div>
      {!upcoming.length && <Empty title="No shoots scheduled" />}
      <Sheet open={!!open} onClose={() => setOpen(null)} title="Call sheet">{open && <CallSheet shoot={shoots.find((s) => s.id === open.id) ?? open} project={projects.find((p) => p.id === open.project_id)} compact />}</Sheet>
    </>
  );
}

// ================= Post-production =================
export function PostPage() {
  const { projects } = useScope();
  const { rows: dels } = useDeliverables();
  const { can, userId } = useActing();
  const people = usePeople();
  const [f, setF] = useState<'active' | 'review' | 'done'>('active');
  const pids = new Set(projects.map((p) => p.id));
  const mine = dels.filter((d) => pids.has(d.project_id));
  const list = mine.filter((d) => (f === 'done' ? d.delivered_at : f === 'review' ? !d.delivered_at && d.post_status === 'Ready for review' : !d.delivered_at && d.post_status !== 'Ready for review'));
  return (
    <>
      <PageTitle tag="WORK · POST-PRODUCTION" title="Post-production tracker" sub="Not started → Rough cut → Fine cut → Colour → Sound → Graphics → Export → Ready for review. Revision rounds are counted." />
      <div className="mb-4"><Tabs value={f} onChange={setF} items={[{ value: 'active', label: 'In the edit', count: mine.filter((d) => !d.delivered_at && d.post_status !== 'Ready for review').length }, { value: 'review', label: 'With client', count: mine.filter((d) => !d.delivered_at && d.post_status === 'Ready for review').length }, { value: 'done', label: 'Delivered', count: mine.filter((d) => d.delivered_at).length }]} /></div>
      <div className="flex flex-col gap-3">{list.map((d) => { const p = projects.find((x) => x.id === d.project_id); return <PostRow key={d.id} d={d} people={people} project={p} canEdit={can('boss', 'gm_cfo', 'project_lead') || d.owner_id === userId || p?.lead_id === userId} />; })}</div>
      {!list.length && <Empty title="Nothing here" />}
    </>
  );
}

// ================= Footage safety =================
export function FootagePage() {
  const { projects } = useScope();
  const { rows: shoots } = useShoots();
  const { rows: cards } = useCards();
  const { rows: copies } = useCopies();
  const people = usePeople();
  const pids = new Set(projects.map((p) => p.id));
  const mine = cards.filter((m) => pids.has(m.project_id));
  const risk = footageAtRisk(mine, shoots, copies);
  const states = mine.map((m) => cardState(m, shoots.find((s) => s.id === m.shoot_id), copies));
  const sorted = [...mine].sort((a, b) => ['risk', 'pending', 'safe'].indexOf(cardState(a, shoots.find((s) => s.id === a.shoot_id), copies)) - ['risk', 'pending', 'safe'].indexOf(cardState(b, shoots.find((s) => s.id === b.shoot_id), copies)));
  return (
    <>
      <PageTitle tag="WORK · FOOTAGE SAFETY" title="Footage safety" sub="Memory cards and drives with their backup copies. Two verified copies within 24 hours of wrap, always." />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Safe" value={states.filter((s) => s === 'safe').length} tone="green" />
        <Stat label="Backing up" value={states.filter((s) => s === 'pending').length} tone="amber" sub="Within 24 h of wrap" />
        <Stat label="At risk" value={risk.length} tone="red" sub="< 2 copies after 24 h" />
      </div>
      <div className="flex flex-col gap-2">
        {sorted.map((m) => <div key={m.id}><div className="mb-1 text-xs font-bold text-basil-muted">{projects.find((p) => p.id === m.project_id)?.name}</div><CardSafety m={m} shoot={shoots.find((s) => s.id === m.shoot_id)} copies={copies} people={people} canEdit /></div>)}
      </div>
    </>
  );
}

