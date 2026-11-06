// E-sign workflow calls. With Supabase: security-definer SQL functions (send_esign_document, and the
// anon-granted get_sign_request / sign_document / decline_document / verify_document). Demo: JS twins on the browser store.
import { supabase } from '@/lib/supabase';
import { demoTable, newId, nowIso, persistDemo, rpc, type Row } from '@/os/lib/store';
import { notify } from '@/os/lib/notify';
import { sha256Hex } from '@/os/security/lib';
import { hashSource, type DocStatus, type EsignDoc, type EsignSigner, type FieldKind, type SignerStatus } from './lib';
import './seed';

const docs = () => demoTable('esign_documents') as unknown as EsignDoc[];
const signersOf = (id: string) => (demoTable('esign_signers') as unknown as EsignSigner[]).filter((s) => s.document_id === id);
const event = (document_id: string, kind: string, detail: string, signer_id: string | null = null, user_agent = '') =>
  demoTable('esign_events').push({ id: newId(), document_id, signer_id, kind, detail, user_agent, created_at: nowIso() } as Row);

/** Demo: seeded documents get their hash on first use (SubtleCrypto is async, seeds are not). */
async function ensureDemoHash(d: EsignDoc) {
  if (d.status !== 'Draft' && !d.doc_hash) {
    d.doc_hash = await sha256Hex(hashSource(d));
    persistDemo();
  }
}
function expireIfDue(d: EsignDoc) {
  if (d.expires_at && d.expires_at < nowIso() && ['Sent', 'Viewed', 'Partly signed'].includes(d.status)) d.status = 'Expired';
}

export function sendDocument(id: string, actorName: string) {
  return rpc<string>('send_esign_document', { _id: id }, async () => {
    const d = docs().find((x) => x.id === id);
    if (!d) throw new Error('Document not found');
    if (d.status !== 'Draft') throw new Error('Only drafts can be sent');
    const ss = signersOf(id);
    if (!ss.length) throw new Error('Add at least one signer');
    if (!hashSource(d)) throw new Error('The document is empty');
    const first = Math.min(...ss.map((s) => s.sign_order));
    ss.forEach((s) => (s.status = d.signing_order === 'parallel' || s.sign_order === first ? 'Sent' : 'Waiting'));
    Object.assign(d, { status: 'Sent', sent_at: nowIso(), doc_hash: await sha256Hex(hashSource(d)), expires_at: d.expires_at ?? new Date(Date.now() + 30 * 864e5).toISOString() });
    event(id, 'sent', `Sent for signature by ${actorName}`);
    return 'Sent';
  });
}

export interface SignRequest {
  document: Pick<EsignDoc, 'id' | 'title' | 'source_kind' | 'source_url' | 'body_text' | 'message' | 'status' | 'signing_order' | 'expires_at' | 'doc_hash'>;
  signer: { id: string; name: string; status: SignerStatus; fields: FieldKind[]; sign_order: number; signed_at: string | null };
  signers: { name: string; sign_order: number; status: SignerStatus; signed_at: string | null }[];
}

export async function getSignRequest(token: string): Promise<SignRequest | null> {
  if (supabase) {
    const { data, error } = await supabase.rpc('get_sign_request', { _token: token });
    if (error) throw error;
    return (data as SignRequest | null) ?? null;
  }
  const s = (demoTable('esign_signers') as unknown as EsignSigner[]).find((x) => x.token === token);
  const d = s && docs().find((x) => x.id === s.document_id);
  if (!s || !d || d.status === 'Draft') return null;
  expireIfDue(d);
  await ensureDemoHash(d);
  if (s.status === 'Sent' && !['Declined', 'Expired'].includes(d.status)) {
    s.status = 'Viewed';
    s.viewed_at = nowIso();
    if (d.status === 'Sent') d.status = 'Viewed';
    event(d.id, 'viewed', `${s.name} opened the document`, s.id, navigator.userAgent.slice(0, 300));
  }
  persistDemo();
  const { id, title, source_kind, source_url, body_text, message, status, signing_order, expires_at, doc_hash } = d;
  return {
    document: { id, title, source_kind, source_url, body_text, message, status, signing_order, expires_at, doc_hash },
    signer: { id: s.id, name: s.name, status: s.status, fields: s.fields, sign_order: s.sign_order, signed_at: s.signed_at },
    signers: signersOf(d.id).sort((a, b) => a.sign_order - b.sign_order).map((x) => ({ name: x.name, sign_order: x.sign_order, status: x.status, signed_at: x.signed_at })),
  };
}

function demoSigner(token: string) {
  const s = (demoTable('esign_signers') as unknown as EsignSigner[]).find((x) => x.token === token);
  if (!s) throw new Error('This signing link is not valid');
  const d = docs().find((x) => x.id === s.document_id)!;
  expireIfDue(d);
  if (!['Sent', 'Viewed', 'Partly signed'].includes(d.status)) throw new Error(`This document is ${d.status.toLowerCase()}`);
  if (!['Sent', 'Viewed'].includes(s.status)) throw new Error('It is not your turn to sign yet, or you have already responded');
  return { s, d };
}

export function signDocument(token: string, name: string, signatureDataUrl: string, userAgent: string) {
  return rpc<DocStatus>('sign_document', { _token: token, _name: name, _signature_data_url: signatureDataUrl, _user_agent: userAgent }, () => {
    const { s, d } = demoSigner(token);
    if (name.trim().length < 2) throw new Error('Type your full name');
    if (!signatureDataUrl.startsWith('data:image/png;base64,')) throw new Error('Draw your signature');
    Object.assign(s, { status: 'Signed', signed_at: nowIso(), signed_name: name.trim(), signature_data: signatureDataUrl, user_agent: userAgent, viewed_at: s.viewed_at ?? nowIso() });
    event(d.id, 'signed', `${name.trim()} signed`, s.id, userAgent);
    const all = signersOf(d.id);
    if (all.every((x) => x.status === 'Signed')) {
      Object.assign(d, { status: 'Completed', completed_at: nowIso() });
      event(d.id, 'completed', 'All parties signed');
      if (d.created_by) void notify(d.created_by, 'Document completed', `${d.title} has been signed by everyone.`, `/os/esign/${d.id}`, 'task');
    } else {
      d.status = 'Partly signed';
      if (d.signing_order === 'sequential') {
        const waiting = all.filter((x) => x.status === 'Waiting');
        const next = Math.min(...waiting.map((x) => x.sign_order));
        waiting.filter((x) => x.sign_order === next).forEach((x) => (x.status = 'Sent'));
      }
      if (d.created_by) void notify(d.created_by, 'Document signed', `${name.trim()} signed ${d.title}`, `/os/esign/${d.id}`, 'info');
    }
    return d.status;
  });
}

export function declineDocument(token: string, reason: string) {
  return rpc<DocStatus>('decline_document', { _token: token, _reason: reason }, () => {
    const { s, d } = demoSigner(token);
    if (reason.trim().length < 3) throw new Error('Give a short reason');
    Object.assign(s, { status: 'Declined', decline_reason: reason.trim() });
    d.status = 'Declined';
    event(d.id, 'declined', `${s.name} declined: ${reason.trim()}`, s.id);
    if (d.created_by) void notify(d.created_by, 'Document declined', `${s.name} declined ${d.title}`, `/os/esign/${d.id}`, 'alert');
    return 'Declined';
  });
}

export interface Verification {
  id: string; title: string; status: DocStatus; doc_hash: string; source_kind: 'pdf' | 'text'; source_url: string; body_text: string;
  sent_at: string | null; completed_at: string | null; signers: { name: string; signed_name: string | null; status: SignerStatus; signed_at: string | null }[];
}
export async function verifyDocument(id: string): Promise<Verification | null> {
  if (supabase) {
    const { data, error } = await supabase.rpc('verify_document', { _id: id });
    if (error) throw error;
    return (data as Verification | null) ?? null;
  }
  const d = docs().find((x) => x.id === id && x.status !== 'Draft');
  if (!d) return null;
  await ensureDemoHash(d);
  return {
    id: d.id, title: d.title, status: d.status, doc_hash: d.doc_hash, source_kind: d.source_kind, source_url: d.source_url, body_text: d.body_text, sent_at: d.sent_at, completed_at: d.completed_at,
    signers: signersOf(d.id).sort((a, b) => a.sign_order - b.sign_order).map((s) => ({ name: s.name, signed_name: s.signed_name, status: s.status, signed_at: s.signed_at })),
  };
}

export { ensureDemoHash };
