// Public signing page at /sign/:token — no sign-in. Read the document, type your name, draw your signature, agree, sign (or decline).
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useSeo } from '@/hooks/useSeo';
import { declineDocument, getSignRequest, signDocument, type SignRequest } from '@/os/modules/esign/api';
import { DocumentView, SignaturePad } from '@/os/modules/esign/parts';
import { fmtDate, fmtTime } from '@/os/modules/esign/lib';
import { Pill, Sheet, StageTracker } from '@/os/ui';

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-[#F3F7FC] text-basil-ink">
    <header className="border-b border-basil-line bg-white"><div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4"><img src="/logo.svg" alt="Basil Media" className="h-9 w-9" /><b className="font-display">Basil Media · Secure signing</b></div></header>
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">{children}</main>
  </div>
);

export default function Sign() {
  useSeo('Sign document · Basil Media');
  const { token = '' } = useParams();
  const [req, setReq] = useState<SignRequest | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [sig, setSig] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState('');
  const load = () => getSignRequest(token).then((r) => { setReq(r); if (r && !name) setName(r.signer.name); }).catch(() => setReq(null));
  useEffect(() => void load(), [token]); // eslint-disable-line

  if (req === undefined) return <Frame><Loader2 className="mx-auto animate-spin text-basil" size={32} /></Frame>;
  if (!req) return <Frame><div className="rounded-2xl bg-white p-8 text-center"><h1 className="m-0 text-2xl font-extrabold">This signing link is not available</h1><p className="text-basil-muted">It may be wrong or withdrawn. Ask your Basil Media contact for a new link.</p></div></Frame>;
  const { document: d, signer: me, signers } = req;
  const canSign = ['Sent', 'Viewed'].includes(me.status) && ['Sent', 'Viewed', 'Partly signed'].includes(d.status);
  const done = signers.filter((s) => s.status === 'Signed').length;

  const sign = async () => {
    setErr('');
    if (name.trim().length < 2) return setErr('Type your full name.');
    if (!sig) return setErr('Draw your signature in the box.');
    if (!agree) return setErr('Tick the box to agree to sign electronically.');
    setBusy(true);
    try { await signDocument(token, name.trim(), sig, navigator.userAgent.slice(0, 300)); await load(); scrollTo({ top: 0 }); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const decline = async () => {
    setBusy(true);
    try { await declineDocument(token, reason); setDeclineOpen(false); await load(); } catch (e) { setErr((e as Error).message); setDeclineOpen(false); } finally { setBusy(false); }
  };

  return (
    <Frame>
      <div>
        <div className="font-mono text-[11px] tracking-[0.18em] text-basil">FOR {me.name.toUpperCase()}</div>
        <h1 className="m-0 mt-1 text-2xl font-extrabold sm:text-3xl">{d.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-basil-muted"><Pill tone={d.status === 'Completed' ? 'green' : d.status === 'Declined' || d.status === 'Expired' ? 'red' : 'blue'}>{d.status}</Pill>{done}/{signers.length} signed{d.expires_at && ` · sign by ${fmtDate(d.expires_at)}`}</div>
      </div>
      <div className="rounded-2xl bg-white p-3"><StageTracker stages={signers.map((s) => s.name)} current={signers.filter((s) => s.status === 'Signed').length} meta={signers.map((s) => (s.signed_at ? fmtDate(s.signed_at) : s.status))} rejected={d.status === 'Declined' || d.status === 'Expired'} /></div>
      {d.message && <div className="rounded-2xl bg-basil-ice p-4 text-[15px]">{d.message}</div>}

      {me.status === 'Signed' && <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-900"><CheckCircle2 /><div><b>You signed on {fmtTime(me.signed_at)}.</b><br />{d.status === 'Completed' ? 'Everyone has signed. ' : 'We will let the others know. '}<a href={`/verify/${d.id}`} className="font-bold">Verify this document</a></div></div>}
      {me.status === 'Declined' && <div className="flex items-center gap-3 rounded-2xl bg-red-50 p-4 text-red-900"><XCircle /><b>You declined to sign. Basil Media has been told.</b></div>}
      {me.status === 'Waiting' && d.status !== 'Declined' && d.status !== 'Expired' && <div className="rounded-2xl bg-amber-50 p-4 text-amber-900"><b>It is not your turn yet.</b> This document is signed in order; you will be able to sign after {signers.filter((s) => s.sign_order < me.sign_order && s.status !== 'Signed').map((s) => s.name).join(', ')}.</div>}
      {(d.status === 'Declined' || d.status === 'Expired') && me.status !== 'Declined' && <div className="rounded-2xl bg-red-50 p-4 text-red-900"><b>This document is {d.status.toLowerCase()}</b> and can no longer be signed.</div>}

      <DocumentView kind={d.source_kind} url={d.source_url} text={d.body_text} signers={signers.map((s) => ({ name: s.name, status: s.status, signed_at: s.signed_at, signed_name: s.status === 'Signed' ? s.name : null }))} />

      {canSign && (
        <section className="flex flex-col gap-4 rounded-2xl border border-basil-line bg-white p-4 sm:p-6">
          <h2 className="m-0 text-lg font-extrabold">Sign as {me.name}</h2>
          {me.fields.includes('name') && <label className="flex flex-col gap-1.5 text-sm font-bold text-[#33465F]">Your full name<input className="h-12 rounded-xl border border-basil-edge px-3 text-base font-normal" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>}
          <div className="flex flex-col gap-1.5 text-sm font-bold text-[#33465F]">Your signature<SignaturePad onChange={setSig} /></div>
          {me.fields.includes('date') && <div className="text-sm">Date: <b>{fmtDate(new Date().toISOString())}</b></div>}
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I have read this document and agree to sign it electronically. My electronic signature has the same effect as my handwritten signature.</label>
          {err && <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{err}</div>}
          <button type="button" disabled={busy} onClick={sign} className="btn-primary flex min-h-[52px] items-center justify-center gap-2 text-base disabled:opacity-60">{busy && <Loader2 className="animate-spin" size={18} />}Sign document</button>
          <button type="button" onClick={() => setDeclineOpen(true)} className="min-h-[44px] border-0 bg-transparent text-sm font-bold text-red-700">Decline to sign</button>
          <p className="m-0 text-xs text-basil-muted">We record your name, signature, the time and your device (browser) for the certificate of completion.</p>
        </section>
      )}

      <Sheet open={declineOpen} onClose={() => setDeclineOpen(false)} title="Decline to sign">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-bold text-[#33465F]">Reason<textarea className="h-28 rounded-xl border border-basil-edge p-3 text-base font-normal" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. The fee in clause 2 is not what we agreed." /></label>
          <button type="button" disabled={busy || reason.trim().length < 3} onClick={decline} className="min-h-[48px] rounded-xl border-0 bg-red-700 font-bold text-white disabled:opacity-50">Decline</button>
        </div>
      </Sheet>
    </Frame>
  );
}
