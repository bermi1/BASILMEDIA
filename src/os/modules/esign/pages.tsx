// E-Signature Studio desk pages: list, create/edit draft, document detail and certificate of completion.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Award, Copy, FilePlus2, FileSignature, Loader2, Mail, MessageCircle, Plus, Printer, Send, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { isDemo } from '@/lib/supabase';
import { uploadFile } from '@/lib/storage';
import { useActing } from '@/os/lib/session';
import { deleteRow, fetchRows, insertRow, updateRow, useTable } from '@/os/lib/store';
import { PageTitle } from '@/os/OsLayout';
import { useToast } from '@/os/cms/toast';
import { Card, Empty, Field, Pill, StageTracker, Stat, Tabs, inputCls } from '@/os/ui';
import { sha256Hex, deviceLabel } from '@/os/security/lib';
import { ensureDemoHash, sendDocument } from './api';
import { DocumentView } from './parts';
import { FIELD_LABEL, LEGAL_NOTE, STAGES, TEMPLATES, fmtDate, fmtTime, hashSource, signLink, stageOf, statusTone, verifyLink, type EsignDoc, type EsignEvent, type EsignSigner, type FieldKind } from './lib';

const Legal = () => <div className="rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900"><b>Legal check:</b> {LEGAL_NOTE}</div>;

export function EsignList() {
  const { rows: docs, loading } = useTable<EsignDoc>('esign_documents', { order: 'created_at', ascending: false });
  const { rows: signers } = useTable<EsignSigner>('esign_signers');
  const [tab, setTab] = useState<'all' | 'open' | 'done' | 'draft'>('all');
  const open = docs.filter((d) => ['Sent', 'Viewed', 'Partly signed'].includes(d.status));
  const shown = tab === 'open' ? open : tab === 'done' ? docs.filter((d) => d.status === 'Completed') : tab === 'draft' ? docs.filter((d) => d.status === 'Draft') : docs;
  return (
    <div className="flex flex-col gap-4">
      <PageTitle tag="DOCUMENTS · E-SIGNATURE" title="E-Signature Studio" sub="Send agreements, releases and NDAs for signature by link. Every signature is time-stamped and hashed.">
        <Link to="/os/esign/new" className="btn-primary flex min-h-[44px] items-center gap-2 no-underline"><FilePlus2 size={18} />New document</Link>
      </PageTitle>
      <Legal />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Waiting for signatures" value={open.length} tone={open.length ? 'amber' : undefined} />
        <Stat label="Completed" value={docs.filter((d) => d.status === 'Completed').length} tone="green" />
        <Stat label="Drafts" value={docs.filter((d) => d.status === 'Draft').length} />
        <Stat label="Declined / expired" value={docs.filter((d) => d.status === 'Declined' || d.status === 'Expired').length} tone="red" />
      </div>
      <Tabs value={tab} onChange={setTab} items={[{ value: 'all', label: 'All', count: docs.length }, { value: 'open', label: 'Out for signature', count: open.length }, { value: 'done', label: 'Completed' }, { value: 'draft', label: 'Drafts' }]} />
      {loading ? <Loader2 className="animate-spin text-basil" /> : !shown.length ? (
        <Empty icon={<FileSignature />} title="No documents here" sub="Create a document from a PDF or a template and add who must sign." action={<Link to="/os/esign/new" className="btn-primary no-underline">New document</Link>} />
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((d) => {
            const ss = signers.filter((s) => s.document_id === d.id);
            const signed = ss.filter((s) => s.status === 'Signed').length;
            return (
              <Link key={d.id} to={`/os/esign/${d.id}`} className="flex flex-wrap items-center gap-3 rounded-2xl border border-basil-line bg-white p-4 text-basil-ink no-underline hover:border-basil-soft">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-basil-ice text-basil"><FileSignature size={20} /></span>
                <span className="min-w-0 flex-1"><b className="block truncate">{d.title}</b><span className="text-sm text-basil-muted">{signed}/{ss.length} signed · {d.signing_order === 'sequential' ? 'in order' : 'any order'} · created {fmtDate(d.created_at)}</span></span>
                <Pill tone={statusTone(d.status)}>{d.status}</Pill>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface DraftSigner { key: string; name: string; email: string; phone: string; fields: FieldKind[] }
const blankSigner = (): DraftSigner => ({ key: Math.random().toString(36).slice(2), name: '', email: '', phone: '', fields: ['signature', 'name', 'date'] });

export function EsignEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { userId } = useActing();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'text' | 'pdf'>('text');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const [order, setOrder] = useState<'sequential' | 'parallel'>('sequential');
  const [signers, setSigners] = useState<DraftSigner[]>([blankSigner()]);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [d] = await fetchRows<EsignDoc>('esign_documents', { eq: { id } });
      if (!d) return;
      if (d.status !== 'Draft') return nav(`/os/esign/${id}`, { replace: true });
      setTitle(d.title); setKind(d.source_kind); setUrl(d.source_url); setText(d.body_text); setMessage(d.message); setOrder(d.signing_order);
      const ss = await fetchRows<EsignSigner>('esign_signers', { eq: { document_id: id }, order: 'sign_order' });
      if (ss.length) setSigners(ss.map((s) => ({ key: s.id, name: s.name, email: s.email, phone: s.phone, fields: s.fields })));
    })().catch((e) => toast((e as Error).message, 'error'));
  }, [id, nav, toast]);

  const patch = (i: number, p: Partial<DraftSigner>) => setSigners((x) => x.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const move = (i: number, dir: -1 | 1) => setSigners((x) => { const y = [...x]; const j = i + dir; if (j < 0 || j >= y.length) return x; [y[i], y[j]] = [y[j], y[i]]; return y; });
  const upload = async (f: File) => {
    if (f.type !== 'application/pdf') return toast('Choose a PDF file', 'error');
    setBusy(true);
    try { setUrl(await uploadFile(f, 'esign', setPct)); if (!title) setTitle(f.name.replace(/\.pdf$/i, '')); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); setPct(0); }
  };

  const save = async () => {
    if (!title.trim()) return toast('Give the document a title', 'error');
    if (kind === 'pdf' ? !url.trim() : !text.trim()) return toast(kind === 'pdf' ? 'Upload or paste a PDF link' : 'Write or choose the document text', 'error');
    const ready = signers.filter((s) => s.name.trim());
    if (!ready.length) return toast('Add at least one signer', 'error');
    if (ready.some((s) => !s.email.trim() && !s.phone.trim())) return toast('Each signer needs an email or a phone number', 'error');
    setBusy(true);
    try {
      const fields = { title: title.trim(), source_kind: kind, source_url: kind === 'pdf' ? url.trim() : '', body_text: kind === 'text' ? text : '', message: message.trim(), signing_order: order };
      let docId = id;
      if (docId) {
        await updateRow('esign_documents', docId, fields);
        for (const s of await fetchRows<EsignSigner>('esign_signers', { eq: { document_id: docId } })) await deleteRow('esign_signers', s.id);
      } else {
        const d = await insertRow<EsignDoc>('esign_documents', { ...fields, status: 'Draft', doc_hash: '', ...(isDemo ? { created_by: userId, expires_at: null, sent_at: null, completed_at: null } : {}) });
        docId = d.id;
      }
      for (const [i, s] of ready.entries()) {
        await insertRow('esign_signers', {
          document_id: docId, name: s.name.trim(), email: s.email.trim(), phone: s.phone.trim(), sign_order: order === 'parallel' ? 1 : i + 1, fields: s.fields,
          ...(isDemo ? { token: crypto.randomUUID().replace(/-/g, ''), status: 'Waiting', viewed_at: null, signed_at: null, signed_name: null, signature_data: null, user_agent: null, decline_reason: null } : {}),
        });
      }
      toast('Draft saved');
      nav(`/os/esign/${docId}`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageTitle tag="DOCUMENTS · E-SIGNATURE" title={id ? 'Edit draft' : 'New document'} sub="1. The document · 2. Who signs · 3. Save, check and send." />
      <Card title="1 · Document">
        <div className="flex flex-col gap-3">
          <Field label="Title"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Production services agreement · Muhimbili National Hospital" /></Field>
          <Tabs value={kind} onChange={setKind} items={[{ value: 'text', label: 'Template / text' }, { value: 'pdf', label: 'PDF' }]} />
          {kind === 'pdf' ? (
            <>
              <label className="btn-outline flex min-h-[48px] cursor-pointer items-center justify-center gap-2"><Upload size={18} />{busy && pct ? `Uploading ${pct}%` : 'Upload a PDF'}<input type="file" accept="application/pdf" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
              <Field label="…or paste a PDF link"><input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/agreement.pdf" /></Field>
              {url && <iframe title="PDF preview" src={url} className="h-72 w-full rounded-xl border border-basil-line" />}
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map((t) => <button key={t.key} type="button" className="btn-outline min-h-[40px] text-sm" onClick={() => (text.trim() && !confirm('Replace the current text with this template?')) || (setText(t.body), !title && setTitle(t.name))}>{t.name}</button>)}
              </div>
              <Field label="Document text" hint="Replace every {placeholder} before sending. Signature fields are added at the end automatically."><textarea className={`${inputCls} h-72 py-2 font-serif`} value={text} onChange={(e) => setText(e.target.value)} /></Field>
            </>
          )}
          <Field label="Message to signers (optional)"><textarea className={`${inputCls} h-20 py-2`} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
        </div>
      </Card>

      <Card title="2 · Signers">
        <div className="mb-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Signing order">
          {(['sequential', 'parallel'] as const).map((o) => (
            <button key={o} type="button" role="radio" aria-checked={order === o} onClick={() => setOrder(o)} className={`min-h-[44px] rounded-xl px-3 text-sm font-bold ${order === o ? 'border-0 bg-basil text-white' : 'border border-basil-edge bg-white text-basil-deep'}`}>{o === 'sequential' ? 'In order (one after another)' : 'Any order (all at once)'}</button>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {signers.map((s, i) => (
            <div key={s.key} className="rounded-xl border border-basil-line p-3">
              <div className="mb-2 flex items-center justify-between"><b className="text-sm">{order === 'sequential' ? `Signs ${i + 1}${i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'}` : `Signer ${i + 1}`}</b>
                <span className="flex gap-1">
                  {order === 'sequential' && <><button type="button" aria-label="Move up" className="flex h-10 w-10 items-center justify-center rounded-lg border border-basil-edge bg-white" onClick={() => move(i, -1)}><ArrowUp size={16} /></button><button type="button" aria-label="Move down" className="flex h-10 w-10 items-center justify-center rounded-lg border border-basil-edge bg-white" onClick={() => move(i, 1)}><ArrowDown size={16} /></button></>}
                  <button type="button" aria-label="Remove signer" className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700" onClick={() => setSigners((x) => x.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Field label="Full name"><input className={inputCls} value={s.name} onChange={(e) => patch(i, { name: e.target.value })} /></Field>
                <Field label="Email"><input type="email" className={inputCls} value={s.email} onChange={(e) => patch(i, { email: e.target.value })} /></Field>
                <Field label="Phone (WhatsApp)"><input type="tel" className={inputCls} value={s.phone} onChange={(e) => patch(i, { phone: e.target.value })} placeholder="+2557…" /></Field>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                {(Object.keys(FIELD_LABEL) as FieldKind[]).map((f) => (
                  <label key={f} className="flex min-h-[40px] items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={s.fields.includes(f)} disabled={f === 'signature'} onChange={(e) => patch(i, { fields: e.target.checked ? [...s.fields, f] : s.fields.filter((x) => x !== f) })} />{FIELD_LABEL[f]}</label>
                ))}
              </div>
            </div>
          ))}
          <button type="button" className="btn-outline flex min-h-[44px] items-center justify-center gap-2" onClick={() => setSigners((x) => [...x, blankSigner()])}><Plus size={16} />Add signer</button>
        </div>
      </Card>
      <Legal />
      <button type="button" disabled={busy} onClick={save} className="btn-primary flex min-h-[52px] items-center justify-center gap-2 disabled:opacity-60">{busy && <Loader2 size={18} className="animate-spin" />}Save draft</button>
    </div>
  );
}

function useDoc(id: string) {
  const { rows: [doc], loading } = useTable<EsignDoc>('esign_documents', { eq: { id } });
  const { rows: signers } = useTable<EsignSigner>('esign_signers', { eq: { document_id: id }, order: 'sign_order' });
  const { rows: events } = useTable<EsignEvent>('esign_events', { eq: { document_id: id }, order: 'created_at' });
  useEffect(() => void (isDemo && doc && ensureDemoHash(doc)), [doc]);
  return { doc, signers, events, loading };
}

export function EsignDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { doc, signers, events, loading } = useDoc(id);
  const [busy, setBusy] = useState(false);
  if (loading) return <Loader2 className="animate-spin text-basil" />;
  if (!doc) return <Empty title="Document not found" action={<Link to="/os/esign">Back to E-Signature Studio</Link>} />;
  const st = stageOf(doc, signers);
  const meta = [fmtDate(doc.created_at), fmtDate(doc.sent_at), fmtDate(signers.map((s) => s.viewed_at).filter(Boolean).sort()[0]), `${signers.filter((s) => s.status === 'Signed').length}/${signers.length}`, fmtDate(doc.completed_at)];
  const send = async () => {
    setBusy(true);
    try { await sendDocument(doc.id, user?.name || 'staff'); toast('Sent · share each signer’s link below'); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };
  const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => toast('Link copied'));
  return (
    <div className="flex flex-col gap-4">
      <PageTitle tag="DOCUMENTS · E-SIGNATURE" title={doc.title} sub={`${doc.signing_order === 'sequential' ? 'Signed in order' : 'Signed in any order'}${doc.expires_at ? ` · link expires ${fmtDate(doc.expires_at)}` : ''}`}>
        <div className="flex flex-wrap gap-2">
          <Pill tone={statusTone(doc.status)}>{doc.status}</Pill>
          {doc.status === 'Draft' && <>
            <Link to={`/os/esign/${doc.id}/edit`} className="btn-outline min-h-[44px] no-underline">Edit</Link>
            <button type="button" className="btn-outline min-h-[44px] text-red-700" onClick={async () => { if (!confirm('Delete this draft?')) return; await deleteRow('esign_documents', doc.id); nav('/os/esign'); }}>Delete</button>
            <button type="button" disabled={busy} onClick={send} className="btn-primary flex min-h-[44px] items-center gap-2"><Send size={16} />Send for signature</button>
          </>}
          {doc.status === 'Completed' && <Link to={`/os/esign/${doc.id}/certificate`} className="btn-primary flex min-h-[44px] items-center gap-2 no-underline"><Award size={16} />Certificate</Link>}
        </div>
      </PageTitle>
      <Card><StageTracker stages={STAGES} current={st.current} rejected={st.rejected} meta={meta} />{st.rejected && <p className="mb-0 mt-3 text-sm font-bold text-red-700">{doc.status}{signers.find((s) => s.decline_reason) ? ` · “${signers.find((s) => s.decline_reason)!.decline_reason}”` : ''}</p>}</Card>
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <DocumentView kind={doc.source_kind} url={doc.source_url} text={doc.body_text} signers={signers} />
        <div className="flex flex-col gap-4">
          <Card title="Signers">
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {signers.map((s) => (
                <li key={s.id} className="rounded-xl border border-basil-line p-3">
                  <div className="flex items-center justify-between gap-2"><b>{doc.signing_order === 'sequential' ? `${s.sign_order}. ` : ''}{s.name}</b><Pill tone={statusTone(s.status)}>{s.status}</Pill></div>
                  <div className="text-xs text-basil-muted">{[s.email, s.phone].filter(Boolean).join(' · ')}{s.signed_at ? ` · signed ${fmtTime(s.signed_at)}` : s.viewed_at ? ` · opened ${fmtTime(s.viewed_at)}` : ''}</div>
                  {doc.status !== 'Draft' && ['Sent', 'Viewed'].includes(s.status) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button type="button" className="btn-outline flex min-h-[40px] items-center gap-1.5 text-sm" onClick={() => copy(signLink(s.token))}><Copy size={14} />Copy link</button>
                      {s.phone && <a className="btn-outline flex min-h-[40px] items-center gap-1.5 text-sm no-underline" target="_blank" rel="noreferrer" href={`https://wa.me/${s.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Habari ${s.name}, please review and sign “${doc.title}” from Basil Media: ${signLink(s.token)}`)}`}><MessageCircle size={14} />WhatsApp</a>}
                      {s.email && <a className="btn-outline flex min-h-[40px] items-center gap-1.5 text-sm no-underline" href={`mailto:${s.email}?subject=${encodeURIComponent(`Please sign: ${doc.title}`)}&body=${encodeURIComponent(`${doc.message || `Dear ${s.name},`}\n\nPlease review and sign here:\n${signLink(s.token)}\n\nBasil Media`)}`}><Mail size={14} />Email</a>}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </Card>
          <Card title="Activity">
            {events.length ? <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">{events.map((e) => <li key={e.id}><b>{e.detail}</b><span className="block text-xs text-basil-muted">{fmtTime(e.created_at)}{e.user_agent ? ` · ${deviceLabel(e.user_agent)}` : ''}</span></li>)}</ul> : <p className="m-0 text-sm text-basil-muted">Nothing yet.</p>}
          </Card>
          {doc.doc_hash && <Card title="Integrity"><p className="m-0 break-all font-mono text-xs">SHA-256 {doc.doc_hash}</p><Link to={`/verify/${doc.id}`} className="mt-2 inline-flex min-h-[40px] items-center gap-1.5 text-sm font-bold"><ShieldCheck size={14} />Public verification page</Link></Card>}
        </div>
      </div>
    </div>
  );
}

export function EsignCertificate() {
  const { id = '' } = useParams();
  const { doc, signers, events, loading } = useDoc(id);
  const [local, setLocal] = useState('');
  const src = useMemo(() => (doc ? hashSource(doc) : ''), [doc]);
  useEffect(() => void (src && sha256Hex(src).then(setLocal)), [src]);
  if (loading) return <Loader2 className="animate-spin text-basil" />;
  if (!doc) return <Empty title="Document not found" />;
  const ok = !!doc.doc_hash && local === doc.doc_hash;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 print:max-w-none">
      <div className="flex flex-wrap justify-between gap-2 print:hidden">
        <Link to={`/os/esign/${doc.id}`} className="text-sm font-bold">← Back to document</Link>
        <button type="button" className="btn-outline flex min-h-[44px] items-center gap-2" onClick={() => print()}><Printer size={16} />Print / save as PDF</button>
      </div>
      <section className="rounded-2xl border border-basil-line bg-white p-6 sm:p-10">
        <div className="flex items-center gap-3"><img src="/logo.svg" alt="Basil Media" className="h-12 w-12" /><div><div className="font-mono text-[11px] tracking-[0.18em] text-basil">BASIL MEDIA · E-SIGNATURE</div><h1 className="m-0 text-2xl font-extrabold">Certificate of completion</h1></div></div>
        <dl className="mt-6 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[180px_1fr]">
          <dt className="text-basil-muted">Document</dt><dd className="m-0 font-bold">{doc.title}</dd>
          <dt className="text-basil-muted">Document ID</dt><dd className="m-0 break-all font-mono text-xs">{doc.id}</dd>
          <dt className="text-basil-muted">Status</dt><dd className="m-0"><Pill tone={statusTone(doc.status)}>{doc.status}</Pill></dd>
          <dt className="text-basil-muted">Sent</dt><dd className="m-0">{fmtTime(doc.sent_at)}</dd>
          <dt className="text-basil-muted">Completed</dt><dd className="m-0">{fmtTime(doc.completed_at)}</dd>
          <dt className="text-basil-muted">SHA-256 of source</dt><dd className="m-0 break-all font-mono text-xs">{doc.doc_hash || '—'} {local && <Pill tone={ok ? 'green' : 'red'}>{ok ? 'matches' : 'does not match'}</Pill>}</dd>
          <dt className="text-basil-muted">Hashed over</dt><dd className="m-0">{doc.source_kind === 'pdf' ? 'the PDF link (URL bytes)' : 'the document text (UTF-8)'}</dd>
          <dt className="text-basil-muted">Verify online</dt><dd className="m-0 break-all">{verifyLink(doc.id)}</dd>
        </dl>
        <h2 className="mb-2 mt-8 text-base font-extrabold">Signers</h2>
        <div className="flex flex-col gap-3">
          {signers.map((s) => (
            <div key={s.id} className="grid gap-3 rounded-xl border border-basil-line p-3 sm:grid-cols-[160px_1fr]">
              <div className="flex h-16 items-center justify-center rounded-lg bg-basil-mist">{s.signature_data ? <img src={s.signature_data} alt={`Signature of ${s.name}`} className="max-h-14 max-w-full" /> : '—'}</div>
              <div className="text-sm">
                <b>{s.signed_name ?? s.name}</b> <Pill tone={statusTone(s.status)}>{s.status}</Pill>
                <div className="text-basil-muted">{[s.email, s.phone].filter(Boolean).join(' · ')}</div>
                <div>Opened {fmtTime(s.viewed_at)} · Signed {fmtTime(s.signed_at)}</div>
                <div className="break-all text-xs text-basil-muted">Device: {s.user_agent ?? '—'}</div>
              </div>
            </div>
          ))}
        </div>
        <h2 className="mb-2 mt-8 text-base font-extrabold">Audit trail</h2>
        <ul className="m-0 list-none p-0 text-sm">{events.map((e) => <li key={e.id} className="border-t border-basil-line py-1.5">{fmtTime(e.created_at)} · {e.detail}</li>)}</ul>
        <p className="mt-8 text-xs text-basil-muted">Times are East Africa Time (Africa/Dar_es_Salaam). {LEGAL_NOTE}</p>
      </section>
    </div>
  );
}
