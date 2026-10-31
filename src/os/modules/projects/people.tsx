// People / staff portal: weekly reports, suggestion box, leave, attendance, announcements, directory.
// Every panel is mobile-first so the same component serves the desktop page and the phone app.
import { useEffect, useMemo, useState } from 'react';
import { BellRing, Cake, Check, CheckCircle2, EyeOff, Lightbulb, LogIn, LogOut, MapPin, Megaphone, MessageCircle, Phone, Pin, Search, Send, Wallet } from 'lucide-react';
import { PageTitle } from '@/os/OsLayout';
import type { AppRole } from '@/lib/types';
import { useActing } from '@/os/lib/session';
import { insertRow, updateRow, usePeople } from '@/os/lib/store';
import { notify } from '@/os/lib/notify';
import { useToast } from '@/os/cms/toast';
import { Avatar, Card, Empty, Field, inputCls, Pill, Progress, StageTracker, Stat, Tabs } from '@/os/ui';
import {
  addDays, ANNUAL_LEAVE_DEFAULT, fmtDate, fmtDay, fmtTime, fmtWhen, isStaff, LEAVE_TYPES, leaveDays, statusTone, SUGGESTION_CATEGORIES,
  SUGGESTION_STATUSES, telLink, today, waLink, weekStart, type WeeklyReport,
} from './lib';
import {
  bookings, clockIn, clockOut, decideLeave, leaveUsed, replySuggestion, submitLeave, submitSuggestion, useAcks, useAnnouncements, useAttendance,
  useLeave, useLeaveBalances, useReports, useShootCrew, useShoots, useStaffDetails, useSuggestions,
} from './data';
import { firstName, nameOf } from './components';

const isLeader = (can: (...r: AppRole[]) => boolean) => can('boss', 'gm_cfo');
const ta = `${inputCls} h-20 py-2`;

// ================= Weekly report =================
export function WeeklyReportForm({ onDone }: { onDone?: () => void }) {
  const { userId } = useActing();
  const toast = useToast();
  const { rows: reports } = useReports();
  const { rows: att } = useAttendance();
  const week = weekStart();
  const existing = reports.find((r) => r.author_id === userId && r.week_start === week);
  const clocked = useMemo(() => att.filter((a) => a.user_id === userId && a.day >= week && a.clock_out).reduce((s, a) => s + (new Date(a.clock_out!).getTime() - new Date(a.clock_in).getTime()) / 3600e3, 0), [att, userId, week]);
  const [f, setF] = useState({ activities: '', hours: '', achievements: '', challenges: '', next_week: '', support_needed: '' });
  useEffect(() => {
    if (existing) setF({ activities: existing.activities, hours: String(existing.hours), achievements: existing.achievements, challenges: existing.challenges, next_week: existing.next_week, support_needed: existing.support_needed });
    else setF((x) => ({ ...x, hours: x.hours || (clocked ? String(Math.round(clocked)) : '') }));
  }, [existing?.id, clocked]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  async function submit() {
    if (!f.activities.trim()) return toast('Add your activities this week', 'error');
    const row = { ...f, hours: Number(f.hours || 0), author_id: userId, week_start: week };
    if (existing) await updateRow('weekly_reports', existing.id, row);
    else {
      await insertRow('weekly_reports', row);
      await notify('u-gm', 'Weekly report submitted', `${week} · ${row.hours} h`, '/os/people/reports', 'info');
    }
    toast(existing ? 'Report updated' : 'Report sent to Saul');
    onDone?.();
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl bg-basil-ice p-3 text-sm"><b>Week of {fmtDay(week)}</b> – {fmtDay(addDays(week, 5))} · {existing ? <span className="font-bold text-emerald-700">Submitted — you can still edit it</span> : 'Due Saturday 18:00'}{clocked > 0 && <span className="block text-xs text-basil-muted">Clocked this week: {clocked.toFixed(1)} h</span>}</div>
      <Field label="Activities (by project)"><textarea className={ta} value={f.activities} onChange={(e) => set('activities', e.target.value)} placeholder="Summit: Camera A day 1–2 · Graduation: fine cut" /></Field>
      <Field label="Hours worked"><input inputMode="numeric" className={inputCls} value={f.hours} onChange={(e) => set('hours', e.target.value.replace(/[^\d.]/g, ''))} /></Field>
      <Field label="Achievements"><textarea className={ta} value={f.achievements} onChange={(e) => set('achievements', e.target.value)} /></Field>
      <Field label="Challenges"><textarea className={ta} value={f.challenges} onChange={(e) => set('challenges', e.target.value)} /></Field>
      <Field label="Plan for next week"><textarea className={ta} value={f.next_week} onChange={(e) => set('next_week', e.target.value)} /></Field>
      <Field label="Support needed"><textarea className={ta} value={f.support_needed} onChange={(e) => set('support_needed', e.target.value)} /></Field>
      <button type="button" className="btn-primary min-h-[48px] justify-center" onClick={submit}><Send size={16} />{existing ? 'Update report' : 'Submit report'}</button>
    </div>
  );
}

function ReportCard({ r, name }: { r: WeeklyReport; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-basil-line bg-white p-3">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 border-0 bg-transparent p-0 text-left">
        <Avatar name={name} size={34} /><span className="min-w-0 flex-1"><b className="block text-basil-ink">{name}</b><span className="block truncate text-xs text-basil-muted">{r.hours} h · {r.activities}</span></span>
        {r.support_needed && <Pill tone="amber">Needs support</Pill>}
      </button>
      {open && (
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {([['Activities', r.activities], ['Achievements', r.achievements], ['Challenges', r.challenges], ['Next week', r.next_week], ['Support needed', r.support_needed]] as const).map(([k, v]) => <div key={k}><dt className="text-xs font-bold text-basil-muted">{k}</dt><dd className="m-0">{v || '—'}</dd></div>)}
        </dl>
      )}
    </div>
  );
}

export function ReportsManager() {
  const { rows: reports } = useReports();
  const people = usePeople();
  const toast = useToast();
  const [week, setWeek] = useState(weekStart());
  const staff = people.filter((p) => isStaff(p) && !p.roles.includes('boss'));
  const these = reports.filter((r) => r.week_start === week);
  const missing = staff.filter((p) => !these.some((r) => r.author_id === p.id));
  const weeks = [0, 1, 2, 3].map((i) => addDays(weekStart(), -7 * i));
  return (
    <div className="flex flex-col gap-4">
      <Tabs value={week} onChange={setWeek} items={weeks.map((w, i) => ({ value: w, label: i === 0 ? 'This week' : i === 1 ? 'Last week' : fmtDate(w) }))} />
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Submitted" value={these.length} tone="green" />
        <Stat label="Missing" value={missing.length} tone={missing.length ? 'red' : 'green'} />
        <Stat label="Hours" value={these.reduce((s, r) => s + Number(r.hours), 0)} />
      </div>
      {missing.length > 0 && (
        <Card title="Not submitted yet" action={<button type="button" className="btn-outline" onClick={() => Promise.all(missing.map((p) => notify(p.id, 'Weekly report reminder', `Please submit your report for the week of ${fmtDate(week)}.`, '/app', 'task'))).then(() => toast(`Reminded ${missing.length} people`))}><BellRing size={16} />Remind all</button>}>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">{missing.map((p) => <li key={p.id} className="flex items-center gap-2 rounded-full bg-red-50 py-1 pl-1 pr-3 text-sm font-bold text-red-800"><Avatar name={p.full_name} size={26} />{p.full_name}</li>)}</ul>
        </Card>
      )}
      <div className="flex flex-col gap-2">{these.map((r) => <ReportCard key={r.id} r={r} name={nameOf(people, r.author_id)} />)}</div>
    </div>
  );
}

export function WeeklyReportsPage() {
  const { can } = useActing();
  const leader = isLeader(can);
  const [tab, setTab] = useState<'team' | 'mine'>(leader ? 'team' : 'mine');
  return (
    <>
      <PageTitle tag="PEOPLE · WEEKLY REPORTS" title="Weekly reports" sub="Activities, hours, achievements, challenges, next week and support needed." />
      {leader && <div className="mb-4"><Tabs value={tab} onChange={setTab} items={[{ value: 'team', label: 'Team' }, { value: 'mine', label: 'My report' }]} /></div>}
      <div className="max-w-3xl">{tab === 'team' && leader ? <ReportsManager /> : <WeeklyReportForm />}</div>
    </>
  );
}

// ================= Suggestion box =================
export function SuggestionForm({ onDone }: { onDone?: () => void }) {
  const { userId } = useActing();
  const toast = useToast();
  const [anon, setAnon] = useState(true);
  const [cat, setCat] = useState('Idea');
  const [body, setBody] = useState('');
  async function send() {
    if (body.trim().length < 5) return toast('Write a little more', 'error');
    await submitSuggestion(userId, anon, cat, body.trim());
    setBody('');
    toast(anon ? 'Sent anonymously — your name was not stored' : 'Sent — management reads every suggestion weekly');
    onDone?.();
  }
  return (
    <div className="flex flex-col gap-3">
      <label className={`flex min-h-[56px] items-center gap-3 rounded-2xl p-3 ${anon ? 'bg-basil-deep text-white' : 'border border-basil-line bg-white'}`}>
        <input type="checkbox" className="h-5 w-5" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
        <EyeOff size={18} /><span className="flex-1"><b className="block">Send anonymously</b><span className={`text-xs ${anon ? 'text-basil-haze' : 'text-basil-muted'}`}>{anon ? 'Your name is never saved with this message — not even in the database.' : 'Your name is shown so leaders can reply to you.'}</span></span>
      </label>
      <div><div className="mb-1.5 text-sm font-bold text-[#33465F]">Category</div>
        <div className="flex flex-wrap gap-1.5">{SUGGESTION_CATEGORIES.map((c) => <button key={c} type="button" aria-pressed={c === cat} onClick={() => setCat(c)} className={`min-h-[40px] rounded-full px-3.5 text-sm font-semibold ${c === cat ? 'border-0 bg-basil text-white' : 'border border-basil-edge bg-white text-basil-deep'}`}>{c}</button>)}</div>
      </div>
      <Field label="Your message"><textarea className={`${inputCls} h-32 py-2`} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
      <button type="button" className="btn-primary min-h-[48px] justify-center" onClick={send}><Lightbulb size={16} />Send suggestion</button>
    </div>
  );
}

function SuggestionItem({ s, leader }: { s: import('./lib').Suggestion; leader: boolean }) {
  const { userId } = useActing();
  const people = usePeople();
  const toast = useToast();
  const [reply, setReply] = useState(s.reply);
  const [status, setStatus] = useState(s.status);
  return (
    <div className="rounded-2xl border border-basil-line bg-white p-3">
      <div className="mb-1 flex flex-wrap items-center gap-1.5"><Pill tone="blue">{s.category}</Pill><Pill tone={statusTone(s.status)}>{s.status}</Pill><span className="text-xs text-basil-muted">{s.anonymous ? 'Anonymous' : nameOf(people, s.author_id)} · {fmtDate(s.created_at)}</span></div>
      <p className="m-0 text-sm">{s.body}</p>
      {s.reply && !leader && <p className="m-0 mt-2 rounded-xl bg-basil-mist p-2 text-sm"><b>{firstName(people, s.replied_by)}:</b> {s.reply}</p>}
      {leader && (
        <div className="mt-2 flex flex-col gap-2 border-t border-basil-line pt-2">
          <div className="flex flex-wrap gap-1.5">{SUGGESTION_STATUSES.map((x) => <button key={x} type="button" aria-pressed={x === status} onClick={() => setStatus(x)} className={`min-h-[36px] rounded-full px-3 text-xs font-bold ${x === status ? 'border-0 bg-basil-deep text-white' : 'border border-basil-edge bg-white text-basil-deep'}`}>{x}</button>)}</div>
          <div className="flex gap-2"><input aria-label="Reply" className={inputCls} placeholder={s.anonymous ? 'Reply (shown to all staff on the board)' : 'Reply to the author'} value={reply} onChange={(e) => setReply(e.target.value)} />
            <button type="button" className="btn-primary shrink-0" onClick={() => replySuggestion(s, status, reply, userId).then(() => toast('Reply saved'))}><Send size={16} /></button></div>
          {s.replied_by && <span className="text-xs text-basil-muted">Last reply by {nameOf(people, s.replied_by)} · {fmtWhen(s.replied_at)}</span>}
        </div>
      )}
    </div>
  );
}

export function SuggestionBox() {
  const { userId, can } = useActing();
  const leader = isLeader(can);
  const { rows } = useSuggestions();
  const [tab, setTab] = useState<'new' | 'mine' | 'all'>(leader ? 'all' : 'new');
  const [st, setSt] = useState('Under review');
  const mine = rows.filter((s) => s.author_id === userId);
  const answered = rows.filter((s) => s.anonymous && s.reply); // public answers to anonymous suggestions
  return (
    <div className="flex flex-col gap-3">
      <Tabs value={tab} onChange={setTab} items={[{ value: 'new', label: 'Suggest' }, { value: 'mine', label: 'Mine & answers', count: mine.length }, ...(leader ? [{ value: 'all' as const, label: 'Inbox', count: rows.filter((s) => s.status === 'Under review').length }] : [])]} />
      {tab === 'new' && <SuggestionForm onDone={() => setTab('mine')} />}
      {tab === 'mine' && (
        <div className="flex flex-col gap-2">
          {mine.map((s) => <SuggestionItem key={s.id} s={s} leader={false} />)}
          {!mine.length && <p className="m-0 text-sm text-basil-muted">Named suggestions you send appear here. Anonymous ones are not linked to you.</p>}
          {answered.length > 0 && <><h3 className="m-0 mt-2 text-sm font-extrabold">Answers to anonymous suggestions</h3>{answered.map((s) => <SuggestionItem key={s.id} s={s} leader={false} />)}</>}
        </div>
      )}
      {tab === 'all' && leader && (
        <>
          <Tabs value={st} onChange={setSt} items={SUGGESTION_STATUSES.map((x) => ({ value: x, label: x, count: rows.filter((s) => s.status === x).length }))} />
          {rows.filter((s) => s.status === st).map((s) => <SuggestionItem key={s.id} s={s} leader />)}
        </>
      )}
    </div>
  );
}
export function SuggestionsPage() {
  return (<><PageTitle tag="PEOPLE · SUGGESTION BOX" title="Suggestion box" sub="Ideas, complaints and concerns. Anonymous means anonymous: no author is stored. Read by the Boss and GM/CFO." /><div className="max-w-3xl"><SuggestionBox /></div></>);
}

// ================= Leave =================
export function LeaveBalanceCard({ userId }: { userId: string }) {
  const { rows: bal } = useLeaveBalances();
  const { rows: leave } = useLeave();
  const year = new Date().getFullYear();
  const total = bal.find((b) => b.user_id === userId && b.year === year)?.annual_days ?? ANNUAL_LEAVE_DEFAULT;
  const used = leaveUsed(userId, leave, year);
  const pending = leave.filter((l) => l.user_id === userId && l.status === 'Pending' && l.leave_type === 'Annual').reduce((s, l) => s + Number(l.days), 0);
  return (
    <div className="rounded-2xl bg-basil-deep p-4 text-white">
      <div className="text-sm text-basil-haze">Annual leave left · {year}</div>
      <div className="font-display text-3xl font-extrabold">{total - used} days</div>
      <div className="mt-2"><Progress value={used} max={total} tone="blue" /></div>
      <div className="mt-1 text-xs text-basil-haze">{used} used of {total}{pending ? ` · ${pending} pending approval` : ''}</div>
    </div>
  );
}

export function LeaveForm({ onDone }: { onDone?: () => void }) {
  const { userId } = useActing();
  const toast = useToast();
  const { rows: shoots } = useShoots();
  const { rows: crew } = useShootCrew();
  const [f, setF] = useState({ leave_type: 'Annual', start_date: addDays(today(), 7), end_date: addDays(today(), 8), reason: '' });
  const days = f.end_date >= f.start_date ? leaveDays(f.start_date, f.end_date) : 0;
  const clashes: string[] = [];
  for (let d = f.start_date; d <= f.end_date && clashes.length < 5; d = addDays(d, 1)) bookings(userId, d, shoots, crew, []).onShoots.forEach((s) => clashes.push(`${s.title} (${fmtDay(d)})`));
  async function send() {
    if (!days) return toast('Check the dates', 'error');
    await submitLeave({ user_id: userId, leave_type: f.leave_type, start_date: f.start_date, end_date: f.end_date, days, reason: f.reason });
    toast('Leave request sent to Saul');
    onDone?.();
  }
  return (
    <div className="flex flex-col gap-3">
      <div><div className="mb-1.5 text-sm font-bold text-[#33465F]">Type</div>
        <div className="flex flex-wrap gap-1.5">{LEAVE_TYPES.map((t) => <button key={t} type="button" aria-pressed={t === f.leave_type} onClick={() => setF({ ...f, leave_type: t })} className={`min-h-[40px] rounded-full px-3.5 text-sm font-semibold ${t === f.leave_type ? 'border-0 bg-basil text-white' : 'border border-basil-edge bg-white text-basil-deep'}`}>{t}</button>)}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="From"><input type="date" className={inputCls} value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value, end_date: e.target.value > f.end_date ? e.target.value : f.end_date })} /></Field>
        <Field label="To"><input type="date" className={inputCls} value={f.end_date} min={f.start_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></Field>
      </div>
      <div className="text-sm"><b>{days} working day{days === 1 ? '' : 's'}</b> <span className="text-basil-muted">(Sundays not counted)</span></div>
      {clashes.length > 0 && <p className="m-0 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200"><b>Heads-up:</b> you are booked on {clashes.join(', ')}. Saul will see the clash.</p>}
      <Field label="Reason (optional)"><input className={inputCls} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
      <button type="button" className="btn-primary min-h-[48px] justify-center" onClick={send}><Send size={16} />Send leave request</button>
    </div>
  );
}

function LeaveRow({ l, approver }: { l: import('./lib').LeaveRequest; approver?: boolean }) {
  const { userId } = useActing();
  const people = usePeople();
  const toast = useToast();
  const [note, setNote] = useState('');
  const step = l.status === 'Pending' ? 1 : 2;
  return (
    <div className="rounded-2xl border border-basil-line bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><b>{approver ? `${nameOf(people, l.user_id)} · ` : ''}{l.leave_type} leave · {l.days} day{l.days === 1 ? '' : 's'}</b><div className="text-xs text-basil-muted">{fmtDate(l.start_date)} – {fmtDate(l.end_date)}{l.reason ? ` · ${l.reason}` : ''}</div></div>
        <Pill tone={statusTone(l.status)}>{l.status}</Pill>
      </div>
      <div className="mt-2"><StageTracker stages={['Requested', 'GM/CFO decision', l.status === 'Rejected' ? 'Not approved' : 'Approved']} current={step} rejected={l.status === 'Rejected'} meta={[fmtDate(l.created_at), l.decided_by ? firstName(people, l.decided_by) : undefined, l.decided_at ? fmtDate(l.decided_at) : undefined]} /></div>
      {l.decision_note && <p className="m-0 mt-2 rounded-xl bg-basil-mist p-2 text-sm">{l.decision_note}</p>}
      {approver && l.status === 'Pending' && (l.user_id === userId
        ? <p className="m-0 mt-2 text-xs text-basil-muted">Your own request goes to another approver.</p>
        : (
          <div className="mt-2 flex flex-col gap-2 border-t border-basil-line pt-2 sm:flex-row">
            <input aria-label="Note" className={inputCls} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="grid shrink-0 grid-cols-2 gap-2">
              <button type="button" className="btn-outline text-red-700" onClick={() => decideLeave(l, false, note, userId).then(() => toast('Leave not approved')).catch((e) => toast(e.message, 'error'))}>Decline</button>
              <button type="button" className="btn-primary" onClick={() => decideLeave(l, true, note, userId).then(() => toast('Leave approved')).catch((e) => toast(e.message, 'error'))}><Check size={16} />Approve</button>
            </div>
          </div>
        ))}
    </div>
  );
}

export function LeavePanel() {
  const { userId, can } = useActing();
  const approver = isLeader(can);
  const { rows: leave } = useLeave();
  const [tab, setTab] = useState<'mine' | 'new' | 'approve' | 'all'>(approver ? 'approve' : 'mine');
  const pending = leave.filter((l) => l.status === 'Pending' && l.user_id !== userId);
  const mineLeave = leave.filter((l) => l.user_id === userId);
  return (
    <div className="flex flex-col gap-3">
      <LeaveBalanceCard userId={userId} />
      <Tabs value={tab} onChange={setTab} items={[{ value: 'mine', label: 'My leave' }, { value: 'new', label: 'Request' }, ...(approver ? [{ value: 'approve' as const, label: 'To approve', count: pending.length }, { value: 'all' as const, label: 'Everyone' }] : [])]} />
      {tab === 'new' && <LeaveForm onDone={() => setTab('mine')} />}
      {tab === 'mine' && (mineLeave.length ? mineLeave.map((l) => <LeaveRow key={l.id} l={l} />) : <Empty title="No leave yet" sub="Your requests and their approval show here." />)}
      {tab === 'approve' && (pending.length ? pending.map((l) => <LeaveRow key={l.id} l={l} approver />) : <Empty title="Nothing to approve" />)}
      {tab === 'all' && leave.map((l) => <LeaveRow key={l.id} l={l} approver />)}
    </div>
  );
}
export function LeavePage() {
  return (<><PageTitle tag="PEOPLE · LEAVE" title="Leave" sub="Balances, requests and GM/CFO approval. The crew calendar updates automatically." /><div className="max-w-3xl"><LeavePanel /></div></>);
}

// ================= Attendance =================
export function ClockCard() {
  const { userId } = useActing();
  const toast = useToast();
  const { rows } = useAttendance();
  const [busy, setBusy] = useState(false);
  const open = rows.find((a) => a.user_id === userId && a.day === today() && !a.clock_out);
  const done = rows.find((a) => a.user_id === userId && a.day === today() && a.clock_out);
  async function go() {
    setBusy(true);
    try {
      if (open) { await clockOut(open); toast(`Clocked out ${fmtTime(new Date().toISOString())}`); }
      else { const a = await clockIn(userId); toast(`Clocked in ${fmtTime(a.clock_in)}${a.lat ? ' · location saved' : ''}`); }
    } finally { setBusy(false); }
  }
  return (
    <button type="button" disabled={busy} onClick={go} className={`flex w-full items-center gap-3 rounded-2xl border-0 p-4 text-left text-white ${open ? 'bg-emerald-700' : 'bg-basil'}`}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15">{open ? <LogOut size={22} /> : <LogIn size={22} />}</span>
      <span className="flex-1"><b className="block text-[17px]">{busy ? 'Finding your location…' : open ? 'Clock out' : 'Clock in'}</b>
        <span className="text-xs text-white/80">{open ? `In since ${fmtTime(open.clock_in)}${open.place ? ` · ${open.place}` : ''}` : done ? `Today ${fmtTime(done.clock_in)}–${fmtTime(done.clock_out)}` : 'Location is added if you allow it'}</span></span>
      <MapPin size={18} className="opacity-70" />
    </button>
  );
}

export function AttendancePanel() {
  const { userId, can } = useActing();
  const leader = can('boss', 'gm_cfo', 'project_lead');
  const { rows } = useAttendance();
  const people = usePeople();
  const staff = people.filter((p) => isStaff(p) && !p.roles.includes('boss'));
  const todayRows = rows.filter((a) => a.day === today());
  const mine = rows.filter((a) => a.user_id === userId).slice(0, 10);
  const hrs = (a: { clock_in: string; clock_out: string | null }) => a.clock_out ? ((new Date(a.clock_out).getTime() - new Date(a.clock_in).getTime()) / 3600e3).toFixed(1) + ' h' : 'in';
  return (
    <div className="flex flex-col gap-4">
      <ClockCard />
      {leader && (
        <Card title={`Today · ${todayRows.length}/${staff.length} clocked in`}>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {staff.map((p) => { const a = todayRows.find((x) => x.user_id === p.id); return (
              <li key={p.id} className="flex items-center gap-2 text-sm"><Avatar name={p.full_name} size={30} /><span className="flex-1"><b>{p.full_name}</b>{a?.place && <span className="block text-xs text-basil-muted"><MapPin size={11} className="inline" /> {a.place}</span>}</span>
                {a ? <Pill tone={a.clock_out ? 'grey' : 'green'}>{fmtTime(a.clock_in)}{a.clock_out ? `–${fmtTime(a.clock_out)}` : ' · in'}</Pill> : <Pill tone="amber">Not in</Pill>}</li>); })}
          </ul>
        </Card>
      )}
      <Card title="My recent days">
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">{mine.map((a) => <li key={a.id} className="flex justify-between border-b border-basil-line py-1.5 last:border-0"><span>{fmtDay(a.day)}</span><span>{fmtTime(a.clock_in)}–{a.clock_out ? fmtTime(a.clock_out) : '…'} · <b>{hrs(a)}</b></span></li>)}</ul>
        {!mine.length && <p className="m-0 text-sm text-basil-muted">No clock-ins yet.</p>}
      </Card>
    </div>
  );
}
export function AttendancePage() {
  return (<><PageTitle tag="PEOPLE · ATTENDANCE" title="Clock in / out" sub="Attendance with optional location. Leaders see who is in today." /><div className="max-w-3xl"><AttendancePanel /></div></>);
}

// ================= Announcements =================
export function AnnouncementsPanel() {
  const { userId, can } = useActing();
  const leader = isLeader(can);
  const { rows } = useAnnouncements();
  const { rows: acks } = useAcks();
  const people = usePeople();
  const toast = useToast();
  const staffCount = people.filter(isStaff).length;
  const [f, setF] = useState({ title: '', body: '', pinned: false });
  const sorted = [...rows].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  async function post() {
    if (!f.title.trim() || !f.body.trim()) return toast('Title and message are required', 'error');
    await insertRow('announcements', { ...f, author_id: userId });
    await Promise.all(people.filter((p) => isStaff(p) && p.id !== userId).map((p) => notify(p.id, `Announcement: ${f.title}`, f.body.slice(0, 120), '/app', 'info')));
    setF({ title: '', body: '', pinned: false });
    toast('Announcement sent to all staff');
  }
  return (
    <div className="flex flex-col gap-3">
      {leader && (
        <Card title="New announcement">
          <div className="flex flex-col gap-2">
            <input aria-label="Title" className={inputCls} placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            <textarea aria-label="Message" className={ta} placeholder="Message" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
            <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} />Pin to top</label>
            <button type="button" className="btn-primary justify-center" onClick={post}><Megaphone size={16} />Send to all staff</button>
          </div>
        </Card>
      )}
      {sorted.map((a) => {
        const these = acks.filter((x) => x.announcement_id === a.id);
        const mine = these.some((x) => x.user_id === userId);
        return (
          <article key={a.id} className={`rounded-2xl border bg-white p-4 ${a.pinned ? 'border-basil' : 'border-basil-line'}`}>
            <div className="mb-1 flex items-center gap-2 text-xs text-basil-muted">{a.pinned && <Pin size={13} className="text-basil" />}{nameOf(people, a.author_id)} · {fmtDate(a.created_at)}</div>
            <h3 className="m-0 text-base font-extrabold">{a.title}</h3>
            <p className="m-0 mt-1 text-sm leading-relaxed">{a.body}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              {mine ? <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-700"><CheckCircle2 size={16} />Acknowledged</span>
                : <button type="button" className="btn-primary" onClick={() => insertRow('announcement_acks', { announcement_id: a.id, user_id: userId }).then(() => toast('Thanks — acknowledged'))}><Check size={16} />I have read this</button>}
              {leader && <span className="text-xs text-basil-muted" title={these.map((x) => nameOf(people, x.user_id)).join(', ')}>{these.length}/{staffCount} acknowledged</span>}
            </div>
          </article>
        );
      })}
      {!rows.length && <Empty icon={<Megaphone />} title="No announcements" />}
    </div>
  );
}
export function AnnouncementsPage() {
  return (<><PageTitle tag="PEOPLE · ANNOUNCEMENTS" title="Announcements" sub="Company news with read receipts." /><div className="max-w-3xl"><AnnouncementsPanel /></div></>);
}

// ================= Directory =================
export function Directory() {
  const people = usePeople();
  const { rows: details } = useStaffDetails();
  const [q, setQ] = useState('');
  const staff = people.filter(isStaff);
  const det = (id: string) => details.find((d) => d.user_id === id);
  const month = today().slice(5, 7);
  const bdays = staff.filter((p) => det(p.id)?.birthday?.slice(5, 7) === month).sort((a, b) => (det(a.id)!.birthday.slice(8) > det(b.id)!.birthday.slice(8) ? 1 : -1));
  const list = staff.filter((p) => `${p.full_name} ${det(p.id)?.job_title ?? ''} ${det(p.id)?.department ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  const bday = (iso: string) => new Date(`2000-${iso.slice(5)}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  return (
    <div className="flex flex-col gap-3">
      {bdays.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-[#FBF4E2] to-white p-4 ring-1 ring-[#EBD9A6]">
          <h3 className="m-0 mb-2 flex items-center gap-2 text-sm font-extrabold text-[#7A5E12]"><Cake size={16} />Birthdays this month</h3>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">{bdays.map((p) => { const b = det(p.id)!.birthday; const isToday = b.slice(5) === today().slice(5); return <li key={p.id} className={`rounded-full px-3 py-1.5 text-sm ${isToday ? 'bg-gold font-bold text-white' : 'bg-white'}`}>{isToday ? '🎂 Today: ' : ''}{p.full_name} · {bday(b)}</li>; })}</ul>
        </div>
      )}
      <label className="relative"><span className="sr-only">Search staff</span><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-basil-muted" /><input className={`${inputCls} pl-10`} placeholder="Search name, role or team" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 md:grid-cols-2">
        {list.map((p) => { const d = det(p.id); return (
          <li key={p.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-basil-line bg-white p-3">
            <Avatar name={p.full_name} size={44} />
            <span className="min-w-0 flex-1"><b className="block truncate">{p.full_name}</b><span className="block truncate text-xs text-basil-muted">{d?.job_title ?? p.roles.join(', ')}{d?.department ? ` · ${d.department}` : ''}</span>{d?.birthday && <span className="block text-xs text-basil-muted"><Cake size={11} className="inline" /> {bday(d.birthday)}</span>}</span>
            {p.phone && <><a href={telLink(p.phone)} aria-label={`Call ${p.full_name}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-basil-ice text-basil"><Phone size={17} /></a><a href={waLink('Habari ' + p.full_name.split(' ')[0] + ', ', p.phone)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${p.full_name}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><MessageCircle size={17} /></a></>}
          </li>); })}
      </ul>
    </div>
  );
}
export function DirectoryPage() {
  return (<><PageTitle tag="PEOPLE · DIRECTORY" title="Staff directory" sub="Everyone at Basil Media, with phone, WhatsApp and birthdays." /><Directory /></>);
}

// ================= Payslips placeholder =================
export function Payslips() {
  return <Empty icon={<Wallet />} title="Payslips" sub="Your monthly payslips appear here once payroll is run by Finance. Ask Grace if you need a copy now." />;
}

export function PeopleHome() {
  const { userId } = useActing();
  const { rows: reports } = useReports();
  const { rows: ann } = useAnnouncements();
  const { rows: acks } = useAcks();
  const submitted = reports.some((r) => r.author_id === userId && r.week_start === weekStart());
  const unread = ann.filter((a) => !acks.some((x) => x.announcement_id === a.id && x.user_id === userId)).length;
  return (
    <>
      <PageTitle tag="PEOPLE" title="Staff portal" sub="Reports, ideas, leave, attendance and news in one place." />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Weekly report" value={submitted ? 'Sent' : 'Due'} tone={submitted ? 'green' : 'amber'} />
        <Stat label="Unread announcements" value={unread} tone={unread ? 'amber' : 'green'} />
        <div className="col-span-2"><ClockCard /></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2"><Card title="Announcements"><AnnouncementsPanel /></Card><Card title="Directory"><Directory /></Card></div>
    </>
  );
}
