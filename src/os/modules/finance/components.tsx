// Shared Finance & Approvals building blocks used by desktop pages and phone screens.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import {
  AlertTriangle, Check, CheckCircle2, Clock, Copy, ExternalLink, Fingerprint, HelpCircle, KeyRound, Paperclip, Pencil, Receipt, Send, ShieldCheck, Undo2, X,
} from 'lucide-react';
import { useActing } from '@/os/lib/session';
import { personName, usePeople } from '@/os/lib/store';
import { useToast } from '@/os/cms/toast';
import { Avatar, Field, Pill, Progress, Sheet, StageTracker, inputCls, tsh, tshShort, type Tone } from '@/os/ui';
import {
  BUDGET_LINES, METHODS, STATUS_LABEL, ago, answerQuestion, bossDecide, fmtDate, fmtShort, hoursSince, payRequest, reconcileRequest, requestChecks, requestStage,
  retireDue, retireRequest, reviewRequest, saveDraft, statusTone, submitRequest, today, addDays, type Fin, type Method, type MoneyRequest, type RequestDraft, type Urgency,
} from './lib';

export function useNames() {
  const people = usePeople();
  return (id?: string | null) => personName(people, id);
}
export function errMsg(e: unknown) {
  return e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
}

export function StatusPill({ status }: { status: string }) {
  return <Pill tone={statusTone(status) as Tone}>{STATUS_LABEL[status] ?? status}</Pill>;
}

export function waitingHours(r: MoneyRequest) {
  return ['gm_review', 'boss_approval'].includes(r.status) ? hoursSince(r.stage_at ?? r.submitted_at) : 0;
}
export function EscalationPill({ r }: { r: MoneyRequest }) {
  const h = waitingHours(r);
  if (h <= 24) return null;
  return <Pill tone="red"><Clock size={12} />Waiting {Math.round(h)}h</Pill>;
}

export function ReqTracker({ r, fin }: { r: MoneyRequest; fin: Fin }) {
  const name = useNames();
  const s = requestStage(r, fin.stepsFor(r.id), name);
  return <StageTracker stages={s.stages} current={s.current} meta={s.meta} rejected={s.rejected} />;
}

/** Compact list row for a money request. */
export function RequestRow({ r, fin, onOpen, right, selected, onSelect }: { r: MoneyRequest; fin: Fin; onOpen: () => void; right?: ReactNode; selected?: boolean; onSelect?: () => void }) {
  const name = useNames();
  const p = fin.project(r.project_id);
  return (
    <div className={`flex items-center gap-3 rounded-2xl border bg-white p-3 ${selected ? 'border-basil ring-2 ring-basil/20' : 'border-basil-line'}`}>
      {onSelect && (
        <button type="button" onClick={onSelect} aria-pressed={selected} aria-label={`Select ${r.number}`} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 ${selected ? 'border-basil bg-basil text-white' : 'border-basil-edge bg-white text-transparent'}`}><Check size={18} /></button>
      )}
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 border-0 bg-transparent p-0 text-left">
        <Avatar name={name(r.requester_id)} size={40} />
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[15px]">{r.purpose || 'Untitled request'}</b>
          <span className="block truncate text-xs text-basil-muted">{name(r.requester_id).split(' ')[0]} · {p?.name ?? 'No project'} · {r.category}</span>
          <span className="mt-1 flex flex-wrap gap-1">
            <StatusPill status={r.status} />
            <EscalationPill r={r} />
            {r.urgency !== 'normal' && <Pill tone="amber">{r.urgency === 'critical' ? 'Critical' : 'Urgent'}</Pill>}
            {r.over_budget && <Pill tone="red">Over line</Pill>}
            {r.duplicate_of && <Pill tone="amber">Possible duplicate</Pill>}
            {r.question && <Pill tone="blue"><HelpCircle size={12} />Question</Pill>}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <b className="block font-display text-[15px]">{tshShort(Number(r.approved_amount ?? r.amount))}</b>
          <span className="text-[11px] text-basil-muted">{r.number}</span>
        </span>
      </button>
      {right}
    </div>
  );
}

/** Budget line meter used on approval cards and the request form. */
export function LineMeter({ fin, lineId, extra = 0 }: { fin: Fin; lineId: string | null; extra?: number }) {
  const line = fin.line(lineId);
  if (!line) return null;
  const s = fin.lineStats(line);
  const after = s.remaining - extra;
  return (
    <div className="rounded-xl bg-basil-mist p-3">
      <div className="mb-1.5 flex justify-between text-xs"><span className="font-bold">{line.line} line</span><span className="text-basil-muted">{tsh(s.spent + s.committed)} of {tsh(s.allocated)} used</span></div>
      <Progress value={s.spent + s.committed + extra} max={s.allocated} />
      <div className={`mt-1.5 text-xs font-bold ${after < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{after < 0 ? `Over by ${tsh(-after)}` : `${tsh(after)} left${extra ? ' after this' : ''}`}{s.pending ? <span className="font-normal text-basil-muted"> · {tsh(s.pending)} in approval</span> : null}</div>
    </div>
  );
}

export function requesterHistory(fin: Fin, userId: string) {
  const mine = fin.requests.filter((x) => x.requester_id === userId && x.status !== 'draft');
  const since = Date.now() - 90 * 864e5;
  const recent = mine.filter((x) => new Date(x.created_at).getTime() > since);
  const retired = mine.filter((x) => x.retired_at && x.paid_at);
  const onTime = retired.filter((x) => new Date(x.retired_at!).getTime() - new Date(x.paid_at!).getTime() <= fin.settings.retirement_days * 864e5).length;
  const unretired = mine.filter((x) => x.status === 'paid').length;
  return { count: recent.length, total: recent.filter((x) => !['rejected', 'returned'].includes(x.status)).reduce((s, x) => s + Number(x.approved_amount ?? x.amount), 0), rejected: recent.filter((x) => x.status === 'rejected').length, onTimePct: retired.length ? Math.round((onTime / retired.length) * 100) : 100, unretired };
}

// ---------------------------------------------------------------- step-up confirmation
const PK_KEY = 'basil-passkey-id';
const PIN_KEY = 'basil-approval-pin';
const b64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };
async function sha(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return b64(d);
}
export const hasPasskey = () => typeof window !== 'undefined' && !!window.PublicKeyCredential && !!store.get(PK_KEY);
export async function registerPasskey(name: string) {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: 'Basil Media OS' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name, displayName: name },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' }, timeout: 60000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('Fingerprint was not set up');
  store.set(PK_KEY, b64(cred.rawId));
}
async function verifyPasskey() {
  const id = store.get(PK_KEY);
  if (!id) throw new Error('No fingerprint on this device');
  const ok = await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: 'public-key', id: unb64(id) }], userVerification: 'required', timeout: 60000 } });
  if (!ok) throw new Error('Fingerprint not confirmed');
}

/** "Confirm with fingerprint" — WebAuthn when a passkey is registered on this device, else a 4-digit PIN. */
export function StepUpSheet({ open, onClose, title, sub, onVerified }: { open: boolean; onClose: () => void; title: string; sub?: string; onVerified: (by: 'pin' | 'passkey') => Promise<void> | void }) {
  const [mode, setMode] = useState<'passkey' | 'pin'>('pin');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const hasPin = !!store.get(PIN_KEY);
  useEffect(() => { if (open) { setMode(hasPasskey() ? 'passkey' : 'pin'); setPin(''); setErr(''); setConfirmPin(null); } }, [open]);
  const done = async (by: 'pin' | 'passkey') => { setBusy(true); try { await onVerified(by); onClose(); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); } };
  const scan = async () => { setErr(''); try { await verifyPasskey(); await done('passkey'); } catch (e) { setErr(errMsg(e)); } };
  const press = async (d: string) => {
    if (busy) return;
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length < 4) return;
    if (!hasPin) {
      if (confirmPin === null) { setConfirmPin(next); setPin(''); return; }
      if (confirmPin !== next) { setErr('PINs did not match — try again'); setConfirmPin(null); setPin(''); return; }
      store.set(PIN_KEY, await sha(next));
      await done('pin');
      return;
    }
    if ((await sha(next)) !== store.get(PIN_KEY)) { setErr('Wrong PIN'); setPin(''); return; }
    await done('pin');
  };
  return (
    <Sheet open={open} onClose={onClose} title={mode === 'passkey' ? 'Confirm with fingerprint' : !hasPin ? (confirmPin === null ? 'Set your approval PIN' : 'Repeat your PIN') : 'Enter your approval PIN'}>
      <p className="m-0 mb-4 text-center text-sm text-basil-muted"><b className="block text-base text-basil-ink">{title}</b>{sub}</p>
      {mode === 'passkey' ? (
        <div className="flex flex-col items-center gap-4">
          <button type="button" onClick={scan} disabled={busy} className="relative flex h-28 w-28 items-center justify-center rounded-full border-0 bg-basil-ice text-basil" aria-label="Scan fingerprint">
            <span className="absolute inset-0 animate-pulseRing rounded-full" /><Fingerprint size={56} />
          </button>
          <span className="text-sm text-basil-muted">Touch the sensor or use Face ID</span>
          <button type="button" onClick={() => setMode('pin')} className="border-0 bg-transparent text-sm font-bold text-basil">Use PIN instead</button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-3" aria-label={`${pin.length} of 4 digits`}>{[0, 1, 2, 3].map((i) => <span key={i} className={`h-4 w-4 rounded-full ${i < pin.length ? 'bg-basil' : 'bg-basil-line'}`} />)}</div>
          <div className="grid w-full max-w-[280px] grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k) => k === '' ? <span key="blank" /> : (
              <button key={k} type="button" onClick={() => (k === '⌫' ? setPin(pin.slice(0, -1)) : press(k))} className="h-14 rounded-2xl border-0 bg-basil-mist font-display text-xl font-extrabold text-basil-ink active:bg-basil-ice" aria-label={k === '⌫' ? 'Delete' : k}>{k}</button>
            ))}
          </div>
          {typeof window !== 'undefined' && window.PublicKeyCredential && (
            hasPasskey()
              ? <button type="button" onClick={() => setMode('passkey')} className="flex items-center gap-1.5 border-0 bg-transparent text-sm font-bold text-basil"><Fingerprint size={16} />Use fingerprint</button>
              : <button type="button" onClick={async () => { try { await registerPasskey('Basil Media approver'); setMode('passkey'); } catch (e) { setErr(errMsg(e)); } }} className="flex items-center gap-1.5 border-0 bg-transparent text-sm font-bold text-basil"><Fingerprint size={16} />Set up fingerprint on this device</button>
          )}
          {!hasPin && <span className="text-center text-xs text-basil-muted"><KeyRound size={12} className="inline" /> Your PIN stays on this device and is never shown in chats.</span>}
        </div>
      )}
      {err && <p role="alert" className="m-0 mt-3 text-center text-sm font-bold text-red-700">{err}</p>}
    </Sheet>
  );
}

// ---------------------------------------------------------------- request detail with role-based actions
export function RequestDetail({ r, fin, onDone }: { r: MoneyRequest; fin: Fin; onDone?: () => void }) {
  const { role, userId } = useActing();
  const actor = { role, userId };
  const name = useNames();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<null | 'return' | 'reject' | 'question' | 'changed' | 'answer' | 'reconcile-query' | 'recommend'>(null);
  const [text, setText] = useState('');
  const [amount, setAmount] = useState(String(r.approved_amount ?? r.amount));
  const [stepUp, setStepUp] = useState<null | { amount?: number }>(null);
  const [pay, setPay] = useState(false);
  const [retire, setRetire] = useState(false);
  const [edit, setEdit] = useState(false);
  const p = fin.project(r.project_id);
  const steps = fin.stepsFor(r.id);
  const ret = fin.retirements.find((x) => x.request_id === r.id);
  const hist = requesterHistory(fin, r.requester_id);
  const dup = r.duplicate_of ? fin.requests.find((x) => x.id === r.duplicate_of) : null;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast(ok); setMode(null); setText(''); onDone?.(); } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };
  const mine = r.requester_id === userId;
  const canReview = role === 'gm_cfo' && r.status === 'gm_review' && !mine;
  const canApprove = role === 'boss' && r.status === 'boss_approval' && !mine;
  const canPay = role === 'finance' && r.status === 'approved' && !mine;
  const canReconcile = role === 'gm_cfo' && r.status === 'retired' && !mine;
  const amt = Number(r.approved_amount ?? r.amount);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Avatar name={name(r.requester_id)} size={44} />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-basil-muted">{name(r.requester_id)} requests · {ago(r.submitted_at ?? r.created_at)}</div>
          <div className="font-display text-[28px] font-extrabold leading-tight">{tsh(amt)}</div>
          {r.approved_amount != null && Number(r.approved_amount) !== Number(r.amount) && <div className="text-xs text-basil-muted">Asked {tsh(r.amount)} · approved {tsh(r.approved_amount)}</div>}
          <div className="mt-1 font-bold">{r.purpose}</div>
          <div className="text-sm text-basil-muted">{p?.name ?? 'No project'} · {r.category} · {r.number}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5"><StatusPill status={r.status} /><EscalationPill r={r} />{r.urgency !== 'normal' && <Pill tone="amber">{r.urgency === 'critical' ? 'Critical' : 'Urgent'}</Pill>}{r.over_budget && <Pill tone="red">Over budget line</Pill>}</div>
      <ReqTracker r={r} fin={fin} />

      {dup && <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><Copy size={16} className="mt-0.5 shrink-0" />Possible duplicate of {dup.number} ({tsh(dup.amount)}, {fmtDate(dup.created_at)}) — same amount and project within 7 days.</div>}
      {r.question && <div className="rounded-xl bg-basil-ice p-3 text-sm"><b className="flex items-center gap-1.5"><HelpCircle size={15} />The Boss asked</b>{r.question}</div>}

      <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <dt className="text-basil-muted">Payee</dt><dd className="m-0 font-semibold">{r.payee || '—'}{r.payee_phone && <span className="block text-xs font-normal text-basil-muted">{r.payee_phone}</span>}</dd>
        <dt className="text-basil-muted">Method</dt><dd className="m-0 font-semibold">{r.method}</dd>
        <dt className="text-basil-muted">Needed by</dt><dd className="m-0 font-semibold">{fmtDate(r.needed_by)}</dd>
        {r.paid_reference && (<><dt className="text-basil-muted">Paid</dt><dd className="m-0 font-semibold">{r.paid_method} · {r.paid_reference}</dd></>)}
        {r.status === 'paid' && (<><dt className="text-basil-muted">Retire by</dt><dd className="m-0 font-semibold text-amber-800">{fmtShort(retireDue(r, fin.settings.retirement_days))}</dd></>)}
      </dl>
      {r.attachment_url && <a href={r.attachment_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-basil-line p-3 text-sm font-bold no-underline"><Paperclip size={16} />Quote / attachment<ExternalLink size={14} className="ml-auto" /></a>}

      {['gm_review', 'boss_approval', 'approved'].includes(r.status) && <LineMeter fin={fin} lineId={r.budget_line_id} extra={r.status === 'approved' ? 0 : Number(r.amount)} />}

      {(role === 'boss' || role === 'gm_cfo') && (
        <div className="rounded-xl border border-basil-line p-3 text-sm">
          <b>Requester history · 90 days</b>
          <div className="text-basil-muted">{hist.count} requests · {tsh(hist.total)} · {hist.onTimePct}% receipts retired on time{hist.rejected ? ` · ${hist.rejected} rejected` : ''}{hist.unretired ? ` · ${hist.unretired} awaiting receipts` : ''}</div>
        </div>
      )}
      {r.recommendation && <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"><b className="block">{r.approved_alone ? 'GM/CFO approved within limit' : 'GM/CFO recommends'}</b>{r.recommendation}</div>}

      {ret && (
        <div className="rounded-xl border border-basil-line p-3 text-sm">
          <b className="flex items-center gap-1.5"><Receipt size={15} />Receipts · {tsh(ret.total_spent)}</b>
          <ul className="m-0 mt-1 list-none p-0">{ret.receipts.map((x, i) => <li key={i} className="flex justify-between gap-2"><a href={x.url} target="_blank" rel="noreferrer">{x.note || `Receipt ${i + 1}`}</a><span>{tsh(x.amount)}</span></li>)}</ul>
          {ret.change_returned > 0 && <div className="mt-1 text-basil-muted">Change returned: {tsh(ret.change_returned)}</div>}
        </div>
      )}

      <details className="rounded-xl border border-basil-line p-3 text-sm">
        <summary className="cursor-pointer font-bold">History · {steps.length} steps</summary>
        <ol className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
          {steps.map((s) => (
            <li key={s.id} className="flex gap-2"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-basil" /><span><b>{name(s.actor_id)}</b> · {s.decision.replace(/_/g, ' ')}{s.amount ? ` · ${tsh(s.amount)}` : ''}{s.verified_by ? ` · ${s.verified_by === 'passkey' ? 'fingerprint' : 'PIN'}` : ''}<span className="block text-xs text-basil-muted">{fmtShort(s.at)}{s.comment ? ` — ${s.comment}` : ''}</span></span></li>
          ))}
        </ol>
      </details>

      {/* ------- actions ------- */}
      {mine && ['gm_review', 'boss_approval', 'approved'].includes(r.status) && role !== 'boss' && <p className="m-0 text-center text-xs text-basil-muted"><ShieldCheck size={12} className="inline" /> You can’t review, approve or pay your own request.</p>}

      {canReview && !mode && (
        <div className="grid gap-2">
          <button type="button" disabled={busy} onClick={() => setMode('recommend')} className="btn-primary min-h-[48px]"><Send size={18} />{Number(r.amount) < fin.settings.approval_limits.gm_cfo_alone_below ? 'Approve · within your limit' : 'Recommend to Boss'}</button>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMode('return')} className="btn-outline min-h-[48px]"><Undo2 size={18} />Return</button>
            <button type="button" onClick={() => setMode('reject')} className="btn-outline min-h-[48px] !text-red-700"><X size={18} />Reject</button>
          </div>
        </div>
      )}
      {canReview && mode && (
        <ReasonBox label={mode === 'recommend' ? 'Note for the Boss (optional)' : mode === 'return' ? 'What needs fixing?' : 'Reason for rejecting'} chips={mode === 'return' ? ['Attach a quote', 'Wrong budget line', 'Split per person', 'Amount too high'] : mode === 'reject' ? ['Not in budget', 'Use in-house resources', 'Duplicate request'] : ['Quote checked', 'Rates match our card', 'Needed for the shoot']} value={text} onChange={setText} busy={busy} onCancel={() => setMode(null)}
          cta={mode === 'recommend' ? 'Send' : mode === 'return' ? 'Send back for correction' : 'Reject request'} danger={mode === 'reject'}
          onSubmit={() => run(() => reviewRequest(r.id, mode as 'recommend' | 'return' | 'reject', text, actor), mode === 'recommend' ? 'Done — moved on' : mode === 'return' ? 'Returned to requester' : 'Rejected')} />
      )}

      {canApprove && !mode && (
        <div className="grid gap-2">
          <button type="button" disabled={busy || !!r.question} onClick={() => setStepUp({})} className="btn-primary min-h-[52px] !bg-emerald-600"><Fingerprint size={20} />Approve {tsh(r.amount)}</button>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setMode('changed')} className="btn-outline min-h-[48px] !px-2 text-sm"><Pencil size={16} />Change</button>
            <button type="button" onClick={() => setMode('question')} className="btn-outline min-h-[48px] !px-2 text-sm"><HelpCircle size={16} />Ask</button>
            <button type="button" onClick={() => setMode('reject')} className="btn-outline min-h-[48px] !px-2 text-sm !text-red-700"><X size={16} />Reject</button>
          </div>
          {r.question && <p className="m-0 text-center text-xs text-basil-muted">Waiting for {name(r.requester_id).split(' ')[0]} to answer your question.</p>}
        </div>
      )}
      {canApprove && mode === 'changed' && (
        <div className="flex flex-col gap-3 rounded-2xl bg-basil-mist p-3">
          <Field label="Approved amount (TSH)"><input inputMode="numeric" className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} /></Field>
          <Field label="Note to requester"><input className={inputCls} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Approve TSH 1,000,000 — two days only" /></Field>
          <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setMode(null)} className="btn-outline">Cancel</button><button type="button" disabled={!Number(amount)} onClick={() => setStepUp({ amount: Number(amount) })} className="btn-primary">Approve {tshShort(Number(amount))}</button></div>
        </div>
      )}
      {canApprove && (mode === 'question' || mode === 'reject') && (
        <ReasonBox label={mode === 'question' ? 'Your question' : 'Reason (the requester will see it)'} chips={mode === 'question' ? ['Can this wait until next week?', 'Is there a cheaper quote?', 'Which shoot day is this for?'] : ['Not in budget', 'Use in-house resources', 'Too expensive']} value={text} onChange={setText} busy={busy} onCancel={() => setMode(null)}
          cta={mode === 'question' ? 'Send question' : 'Reject request'} danger={mode === 'reject'}
          onSubmit={() => run(() => bossDecide(r.id, mode, { comment: text }, actor), mode === 'question' ? 'Question sent' : 'Rejected')} />
      )}
      <StepUpSheet open={!!stepUp} onClose={() => setStepUp(null)} title={`Approving ${tsh(stepUp?.amount ?? r.amount)}`} sub={`to ${name(r.requester_id)} · ${r.purpose}`}
        onVerified={async (by) => { await bossDecide(r.id, stepUp?.amount && stepUp.amount !== Number(r.amount) ? 'approve_changed' : 'approve', { amount: stepUp?.amount, comment: text, verified_by: by }, actor); toast(`Approved · Finance will pay ${name(r.requester_id).split(' ')[0]}`); setMode(null); onDone?.(); }} />

      {canPay && <button type="button" onClick={() => setPay(true)} className="btn-primary min-h-[52px] !bg-emerald-600"><CheckCircle2 size={20} />Mark as paid</button>}
      <Sheet open={pay} onClose={() => setPay(false)} title={`Pay ${tsh(amt)}`}><PayForm r={r} fin={fin} onDone={() => { setPay(false); onDone?.(); }} /></Sheet>

      {mine && r.status === 'paid' && <button type="button" onClick={() => setRetire(true)} className="btn-primary min-h-[52px]"><Receipt size={20} />Retire receipts</button>}
      <Sheet open={retire} onClose={() => setRetire(false)} title="Retire receipts"><RetireForm r={r} onDone={() => { setRetire(false); onDone?.(); }} /></Sheet>

      {mine && r.status === 'boss_approval' && r.question && (
        mode === 'answer'
          ? <ReasonBox label="Your answer" value={text} onChange={setText} busy={busy} onCancel={() => setMode(null)} cta="Send answer" onSubmit={() => run(() => answerQuestion(r.id, text, actor), 'Answer sent to the Boss')} />
          : <button type="button" onClick={() => setMode('answer')} className="btn-primary min-h-[48px]"><HelpCircle size={18} />Answer the Boss</button>
      )}
      {mine && ['draft', 'returned'].includes(r.status) && <button type="button" onClick={() => setEdit(true)} className="btn-primary min-h-[48px]"><Pencil size={18} />{r.status === 'returned' ? 'Fix and resubmit' : 'Edit and submit'}</button>}
      <Sheet open={edit} onClose={() => setEdit(false)} title={r.status === 'returned' ? 'Fix and resubmit' : 'Edit request'}><RequestForm fin={fin} existing={r} onDone={() => { setEdit(false); onDone?.(); }} /></Sheet>

      {canReconcile && (mode === 'reconcile-query'
        ? <ReasonBox label="What is wrong with the receipts?" value={text} onChange={setText} busy={busy} onCancel={() => setMode(null)} cta="Query receipts" danger onSubmit={() => run(() => reconcileRequest(r.id, 'query', text, actor), 'Sent back to requester')} />
        : <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setMode('reconcile-query')} className="btn-outline min-h-[48px]">Query</button><button type="button" disabled={busy} onClick={() => run(() => reconcileRequest(r.id, 'ok', '', actor), 'Reconciled')} className="btn-primary min-h-[48px]"><Check size={18} />Reconcile</button></div>)}
    </div>
  );
}

function ReasonBox({ label, chips, value, onChange, onSubmit, onCancel, cta, busy, danger }: { label: string; chips?: string[]; value: string; onChange: (v: string) => void; onSubmit: () => void; onCancel: () => void; cta: string; busy: boolean; danger?: boolean }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-basil-mist p-3">
      <Field label={label}><textarea rows={3} className={`${inputCls} h-auto py-2`} value={value} onChange={(e) => onChange(e.target.value)} /></Field>
      {chips && <div className="flex flex-wrap gap-1.5">{chips.map((c) => <button key={c} type="button" onClick={() => onChange(value ? `${value}. ${c}` : c)} className="min-h-[36px] rounded-full border border-basil-edge bg-white px-3 text-xs font-semibold">{c}</button>)}</div>}
      <div className="grid grid-cols-2 gap-2"><button type="button" onClick={onCancel} className="btn-outline">Cancel</button><button type="button" disabled={busy} onClick={onSubmit} className={`btn-primary ${danger ? '!bg-red-700' : ''}`}>{cta}</button></div>
    </div>
  );
}

// ---------------------------------------------------------------- pay / retire forms
export function PayForm({ r, fin, onDone }: { r: MoneyRequest; fin: Fin; onDone: () => void }) {
  const { role, userId } = useActing();
  const toast = useToast();
  const name = useNames();
  const [method, setMethod] = useState<string>(r.method);
  const [reference, setReference] = useState('');
  const [proof, setProof] = useState('');
  const defaultAcc = (m: string) => fin.accounts.find((a) => (m === 'Cash' ? a.kind === 'cash' : m === 'Bank transfer' ? a.kind === 'bank' : a.kind === 'mobile'))?.id ?? fin.accounts[0]?.id ?? null;
  const [account, setAccount] = useState<string | null>(defaultAcc(r.method));
  const [busy, setBusy] = useState(false);
  return (
    <form className="flex flex-col gap-3" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true);
      try { await payRequest(r.id, { method, reference, proof_url: proof, account_id: account }, { role, userId }); toast(`Paid · ${name(r.requester_id).split(' ')[0]} gets the reference and a retire link`); onDone(); } catch (x) { toast(errMsg(x), 'error'); } finally { setBusy(false); }
    }}>
      <div className="rounded-xl bg-basil-mist p-3 text-sm"><b className="block font-display text-xl">{tsh(r.approved_amount ?? r.amount)}</b>to {r.payee || name(r.requester_id)}{r.payee_phone && ` · ${r.payee_phone}`}<span className="block text-basil-muted">{r.purpose} · {r.number}</span></div>
      <Field label="Payment method">
        <div className="grid grid-cols-3 gap-1.5">{METHODS.map((m) => <button key={m} type="button" aria-pressed={method === m} onClick={() => { setMethod(m); setAccount(defaultAcc(m)); }} className={`min-h-[44px] rounded-xl px-1 text-xs font-bold ${method === m ? 'border-0 bg-basil text-white' : 'border border-basil-edge bg-white'}`}>{m}</button>)}</div>
      </Field>
      <Field label="Paid from"><select className={inputCls} value={account ?? ''} onChange={(e) => setAccount(e.target.value || null)}>{fin.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
      <Field label={method === 'Cash' ? 'Reference (optional)' : 'Transaction reference'} hint={method === 'Bank transfer' ? 'Bank transfer reference' : method === 'Cash' ? 'Cash voucher number' : 'Mobile money confirmation code, e.g. QJ71K8XP2'}><input className={inputCls} value={reference} onChange={(e) => setReference(e.target.value.toUpperCase())} required={method !== 'Cash'} /></Field>
      <Field label="Proof of payment (photo or PDF link)"><input className={inputCls} type="url" value={proof} onChange={(e) => setProof(e.target.value)} placeholder="https://…" /></Field>
      <button type="submit" disabled={busy} className="btn-primary min-h-[52px] !bg-emerald-600"><CheckCircle2 size={20} />Mark as paid</button>
      <p className="m-0 text-center text-xs text-basil-muted"><ShieldCheck size={12} className="inline" /> Finance pays only what has been approved — never your own request.</p>
    </form>
  );
}

export function RetireForm({ r, onDone }: { r: MoneyRequest; onDone: () => void }) {
  const { role, userId } = useActing();
  const toast = useToast();
  const amt = Number(r.approved_amount ?? r.amount);
  const [rows, setRows] = useState([{ url: '', amount: String(amt), note: '' }]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const spent = rows.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const change = Math.max(amt - spent, 0);
  return (
    <form className="flex flex-col gap-3" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true);
      try { await retireRequest(r.id, rows.filter((x) => x.url || Number(x.amount)).map((x) => ({ url: x.url, amount: Number(x.amount) || 0, note: x.note })), change, note, { role, userId }); toast('Receipts retired · GM/CFO will reconcile'); onDone(); } catch (x) { toast(errMsg(x), 'error'); } finally { setBusy(false); }
    }}>
      <div className="rounded-xl bg-basil-mist p-3 text-sm">Paid {tsh(amt)} · {r.purpose}</div>
      {rows.map((x, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border border-basil-line p-3">
          <Field label={`Receipt ${i + 1} photo link`}><input className={inputCls} type="url" required value={x.url} onChange={(e) => setRows(rows.map((y, j) => (j === i ? { ...y, url: e.target.value } : y)))} placeholder="https://… (photo of the receipt)" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Amount"><input className={inputCls} inputMode="numeric" value={x.amount} onChange={(e) => setRows(rows.map((y, j) => (j === i ? { ...y, amount: e.target.value.replace(/[^\d]/g, '') } : y)))} /></Field>
            <Field label="What for"><input className={inputCls} value={x.note} onChange={(e) => setRows(rows.map((y, j) => (j === i ? { ...y, note: e.target.value } : y)))} placeholder="Fuel" /></Field>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => setRows([...rows, { url: '', amount: '', note: '' }])} className="btn-outline">+ Add another receipt</button>
      <div className={`rounded-xl p-3 text-sm ${spent > amt ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-900'}`}>Receipts {tsh(spent)} · {spent > amt ? `over by ${tsh(spent - amt)} — the extra is not refunded automatically` : `change to return ${tsh(change)}`}</div>
      <Field label="Note (optional)"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder={change ? 'Change returned by M-Pesa to Basil Media till' : ''} /></Field>
      <button type="submit" disabled={busy} className="btn-primary min-h-[52px]"><Receipt size={20} />Retire receipts</button>
    </form>
  );
}

// ---------------------------------------------------------------- request money form with smart checks
export function RequestForm({ fin, existing, onDone }: { fin: Fin; existing?: MoneyRequest; onDone: () => void }) {
  const { role, userId } = useActing();
  const toast = useToast();
  const [f, setF] = useState<RequestDraft>(() => ({
    project_id: existing?.project_id ?? fin.projects[0]?.id ?? null, budget_line_id: existing?.budget_line_id ?? null, amount: Number(existing?.amount ?? 0),
    purpose: existing?.purpose ?? '', category: existing?.category ?? '', needed_by: existing?.needed_by ?? addDays(today(), 2), payee: existing?.payee ?? '',
    payee_phone: existing?.payee_phone ?? '', method: (existing?.method ?? 'M-Pesa') as Method, urgency: (existing?.urgency ?? 'normal') as Urgency, attachment_url: existing?.attachment_url ?? '', comment: '',
  }));
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof RequestDraft>(k: K, v: RequestDraft[K]) => setF((x) => ({ ...x, [k]: v }));
  const lines = fin.lines.filter((l) => l.project_id === f.project_id).sort((a, b) => BUDGET_LINES.indexOf(a.line as never) - BUDGET_LINES.indexOf(b.line as never));
  useEffect(() => { if (!lines.some((l) => l.id === f.budget_line_id)) set('budget_line_id', lines[0]?.id ?? null); }, [f.project_id, lines.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const checks = useMemo(() => requestChecks(fin, { id: existing?.id, requester_id: userId, project_id: f.project_id, budget_line_id: f.budget_line_id, amount: Number(f.amount) }), [fin, f, userId, existing?.id]);
  const submit = async (asDraft: boolean) => {
    setBusy(true);
    try {
      const data = { ...f, amount: Number(f.amount), category: fin.line(f.budget_line_id)?.line ?? f.category };
      if (asDraft) { await saveDraft(data, existing?.id ?? null, { role, userId }); toast('Draft saved'); }
      else { await submitRequest(data, existing?.id ?? null, { role, userId }); toast(role === 'gm_cfo' ? 'Sent to the Boss' : 'Sent to GM/CFO for review'); }
      onDone();
    } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void submit(false); }}>
      {checks.blocked && (
        <div role="alert" className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800"><AlertTriangle size={18} className="shrink-0" /><span><b>Retire your receipts first.</b> {checks.unretired.map((x) => `${x.number} (${tsh(x.approved_amount ?? x.amount)})`).join(', ')} {checks.unretired.length > 1 ? 'are' : 'is'} past the {fin.settings.retirement_days}-day limit.</span></div>
      )}
      <Field label="Project"><select className={inputCls} value={f.project_id ?? ''} onChange={(e) => set('project_id', e.target.value || null)}>{fin.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      <Field label="Budget line">
        <select className={inputCls} value={f.budget_line_id ?? ''} onChange={(e) => set('budget_line_id', e.target.value || null)}>
          {lines.map((l) => <option key={l.id} value={l.id}>{l.line} · {tshShort(fin.lineStats(l).remaining)} left</option>)}
          {!lines.length && <option value="">No budget lines yet</option>}
        </select>
      </Field>
      <Field label="Amount (TSH)"><input className={`${inputCls} font-display text-xl font-extrabold`} inputMode="numeric" required value={f.amount ? Number(f.amount).toLocaleString('en-GB') : ''} onChange={(e) => set('amount', Number(e.target.value.replace(/[^\d]/g, '')))} placeholder="0" /></Field>
      <LineMeter fin={fin} lineId={f.budget_line_id} extra={Number(f.amount) || 0} />
      {checks.overLine && <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle size={16} className="mt-0.5 shrink-0" />This is more than the line has left. You can still send it — the Boss will see it flagged “over line”.</div>}
      {checks.duplicate && <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><Copy size={16} className="mt-0.5 shrink-0" />You asked for the same amount on this project {ago(checks.duplicate.created_at)} ({checks.duplicate.number}). Is this a duplicate?</div>}
      <Field label="What is it for?"><textarea className={`${inputCls} h-auto py-2`} rows={2} required value={f.purpose} onChange={(e) => set('purpose', e.target.value)} placeholder="e.g. Fuel + driver to JNICC, 3 shoot days" /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Needed by"><input type="date" className={inputCls} value={f.needed_by ?? ''} onChange={(e) => set('needed_by', e.target.value)} /></Field>
        <Field label="Urgency"><select className={inputCls} value={f.urgency} onChange={(e) => set('urgency', e.target.value as Urgency)}><option value="normal">Normal</option><option value="urgent">Urgent</option><option value="critical">Critical (shoot blocked)</option></select></Field>
      </div>
      <Field label="Pay to (name)"><input className={inputCls} value={f.payee} onChange={(e) => set('payee', e.target.value)} placeholder="Payee or supplier" /></Field>
      <Field label="Payment method">
        <div className="grid grid-cols-3 gap-1.5">{METHODS.map((m) => <button key={m} type="button" aria-pressed={f.method === m} onClick={() => set('method', m)} className={`min-h-[44px] rounded-xl px-1 text-xs font-bold ${f.method === m ? 'border-0 bg-basil text-white' : 'border border-basil-edge bg-white'}`}>{m}</button>)}</div>
      </Field>
      {f.method !== 'Cash' && <Field label={f.method === 'Bank transfer' ? 'Bank account (bank · account no.)' : 'Mobile money number'}><input className={inputCls} value={f.payee_phone} onChange={(e) => set('payee_phone', e.target.value)} placeholder={f.method === 'Bank transfer' ? 'CRDB · 0150…' : '+255 7…'} /></Field>}
      <Field label="Quote / attachment link (optional)"><input type="url" className={inputCls} value={f.attachment_url} onChange={(e) => set('attachment_url', e.target.value)} placeholder="https://…" /></Field>
      {existing?.status === 'returned' && <Field label="What did you change?"><input className={inputCls} value={f.comment ?? ''} onChange={(e) => set('comment', e.target.value)} /></Field>}
      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <button type="button" disabled={busy} onClick={() => submit(true)} className="btn-outline min-h-[52px]">Save draft</button>
        <button type="submit" disabled={busy || checks.blocked} className="btn-primary min-h-[52px]"><Send size={18} />Submit request</button>
      </div>
      <p className="m-0 text-center text-xs text-basil-muted">{role === 'gm_cfo' ? 'Your requests go straight to the Boss.' : 'GM/CFO checks it first, then the Boss approves. Finance pays.'}</p>
    </form>
  );
}

// ---------------------------------------------------------------- Boss swipe card
export function SwipeApproveCard({ r, fin, onOpen, onApprove, onReject }: { r: MoneyRequest; fin: Fin; onOpen: () => void; onApprove: () => void; onReject: () => void }) {
  const name = useNames();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-6, 6]);
  const okOpacity = useTransform(x, [20, 120], [0, 1]);
  const noOpacity = useTransform(x, [-120, -20], [1, 0]);
  const p = fin.project(r.project_id);
  const line = fin.line(r.budget_line_id);
  const left = line ? fin.lineStats(line).remaining : null;
  const end = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 110) onApprove();
    else if (info.offset.x < -110) onReject();
  };
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center justify-between rounded-3xl px-5 font-bold" aria-hidden>
        <motion.span style={{ opacity: noOpacity }} className="flex items-center gap-1.5 text-red-700"><X size={20} />Reject</motion.span>
        <motion.span style={{ opacity: okOpacity }} className="flex items-center gap-1.5 text-emerald-700">Approve<Fingerprint size={20} /></motion.span>
      </div>
      <motion.div drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.6} onDragEnd={end} style={{ x, rotate }} whileTap={{ scale: 0.99 }} className="relative touch-pan-y rounded-3xl border border-basil-line bg-white p-4 shadow-[0_8px_24px_rgba(10,47,92,0.08)]">
        <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 border-0 bg-transparent p-0 text-left">
          <Avatar name={name(r.requester_id)} size={44} />
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-basil-muted">{name(r.requester_id)} · {ago(r.submitted_at)}</span>
            <b className="block font-display text-2xl">{tsh(r.amount)}</b>
            <span className="block text-[15px] font-semibold">{r.purpose}</span>
            <span className="block text-xs text-basil-muted">{p?.name} · {r.category}</span>
          </span>
        </button>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {left !== null && <Pill tone={left - Number(r.amount) < 0 ? 'red' : 'green'}>{left - Number(r.amount) < 0 ? 'Over line' : `${tshShort(left)} left on line`}</Pill>}
          {r.reviewed_by ? <Pill tone="green"><Check size={12} />GM/CFO recommends</Pill> : <Pill tone="blue">From GM/CFO</Pill>}
          <EscalationPill r={r} />
          {r.urgency !== 'normal' && <Pill tone="amber">Urgent</Pill>}
          {r.question && <Pill tone="blue"><HelpCircle size={12} />Waiting for answer</Pill>}
          {r.duplicate_of && <Pill tone="amber">Possible duplicate</Pill>}
        </div>
        {r.recommendation && <p className="m-0 mt-2 line-clamp-2 text-sm text-basil-muted">“{r.recommendation}”</p>}
        <div className="mt-3 grid grid-cols-[1fr_1fr_2fr] gap-2">
          <button type="button" onClick={onReject} className="min-h-[48px] rounded-2xl border border-red-200 bg-red-50 text-sm font-bold text-red-700" aria-label={`Reject ${r.number}`}><X size={18} className="mx-auto" /></button>
          <button type="button" onClick={onOpen} className="min-h-[48px] rounded-2xl border border-basil-edge bg-white text-sm font-bold text-basil-deep">Details</button>
          <button type="button" disabled={!!r.question} onClick={onApprove} className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl border-0 bg-emerald-600 text-sm font-bold text-white disabled:opacity-50"><Fingerprint size={18} />Approve</button>
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------- charts (plain SVG/Tailwind)
export function IncomeExpenseBars({ data }: { data: { key: string; income: number; expenses: number }[] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expenses]));
  return (
    <div>
      <div className="mb-2 flex gap-4 text-xs"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-basil" />Income</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />Expenses</span></div>
      <div className="flex h-44 items-end gap-2 sm:gap-4" role="img" aria-label="Monthly income versus expenses">
        {data.map((d) => (
          <div key={d.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex h-36 w-full items-end justify-center gap-1">
              <div className="w-1/2 max-w-[22px] rounded-t-md bg-basil" style={{ height: `${(d.income / max) * 100}%` }} title={`Income ${tsh(d.income)}`} />
              <div className="w-1/2 max-w-[22px] rounded-t-md bg-amber-400" style={{ height: `${(d.expenses / max) * 100}%` }} title={`Expenses ${tsh(d.expenses)}`} />
            </div>
            <span className="text-[11px] text-basil-muted">{new Date(d.key + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short' })}</span>
            <span className="hidden text-[10px] font-bold sm:block">{(d.income / 1e6).toFixed(1)} / {(d.expenses / 1e6).toFixed(1)}M</span>
          </div>
        ))}
      </div>
    </div>
  );
}
export function HBars({ rows }: { rows: { label: string; value: number; sub?: string; tone?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex justify-between gap-2 text-sm"><span className="truncate">{r.label}</span><b className="shrink-0">{tshShort(r.value)}{r.sub && <span className="ml-1 font-normal text-basil-muted">{r.sub}</span>}</b></div>
          <div className="h-2 rounded-full bg-basil-line"><div className={`h-2 rounded-full ${r.tone ?? 'bg-basil'}`} style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
