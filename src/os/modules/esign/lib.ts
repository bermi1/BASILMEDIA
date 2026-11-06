import type { Tone } from '@/os/ui';

export type DocStatus = 'Draft' | 'Sent' | 'Viewed' | 'Partly signed' | 'Completed' | 'Declined' | 'Expired';
export type SignerStatus = 'Waiting' | 'Sent' | 'Viewed' | 'Signed' | 'Declined';
export type FieldKind = 'signature' | 'name' | 'date';

export interface EsignDoc {
  id: string;
  title: string;
  source_kind: 'pdf' | 'text';
  source_url: string;
  body_text: string;
  message: string;
  signing_order: 'sequential' | 'parallel';
  status: DocStatus;
  doc_hash: string;
  expires_at: string | null;
  sent_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
}
export interface EsignSigner {
  id: string;
  document_id: string;
  name: string;
  email: string;
  phone: string;
  sign_order: number;
  fields: FieldKind[];
  token: string;
  status: SignerStatus;
  viewed_at: string | null;
  signed_at: string | null;
  signed_name: string | null;
  signature_data: string | null;
  user_agent: string | null;
  decline_reason: string | null;
  created_at: string;
}
export interface EsignEvent { id: string; document_id: string; signer_id: string | null; kind: string; detail: string; user_agent: string; created_at: string }

export const STAGES = ['Draft', 'Sent', 'Viewed', 'Partly signed', 'Completed'];
export function stageOf(doc: EsignDoc, signers: EsignSigner[]) {
  if (doc.status === 'Completed') return { current: STAGES.length, rejected: false };
  if (doc.status === 'Declined' || doc.status === 'Expired') {
    const signed = signers.some((s) => s.status === 'Signed');
    const viewed = signers.some((s) => s.viewed_at);
    return { current: signed ? 3 : viewed ? 2 : 1, rejected: true };
  }
  return { current: Math.max(0, STAGES.indexOf(doc.status)), rejected: false };
}
export const statusTone = (s: DocStatus | SignerStatus): Tone =>
  s === 'Completed' || s === 'Signed' ? 'green' : s === 'Declined' || s === 'Expired' ? 'red' : s === 'Draft' || s === 'Waiting' ? 'grey' : s === 'Partly signed' ? 'amber' : 'blue';

export const FIELD_LABEL: Record<FieldKind, string> = { signature: 'Signature', name: 'Full name', date: 'Date' };
export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Africa/Dar_es_Salaam' }) : '—');
export const fmtTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
export const signLink = (token: string) => `${location.origin}/sign/${token}`;
export const verifyLink = (id: string) => `${location.origin}/verify/${id}`;
/** Exactly what is hashed (same rule as public.esign_hash in SQL). */
export const hashSource = (d: Pick<EsignDoc, 'source_kind' | 'source_url' | 'body_text'>) => (d.source_kind === 'pdf' ? d.source_url : d.body_text);

export const LEGAL_NOTE =
  "Before relying on e-signatures, the owner should confirm with a lawyer which documents may be signed electronically under Tanzania's Electronic Transactions Act, 2015 (some documents, such as wills, land transfers and negotiable instruments, may still need wet ink or a notary).";

export const TEMPLATES: { key: string; name: string; body: string }[] = [
  {
    key: 'production',
    name: 'Production services agreement',
    body: `PRODUCTION SERVICES AGREEMENT

Between Basil Media Ltd, Dar es Salaam ("Basil Media") and {Client} ("the Client").

1. Services. Basil Media will produce {deliverables} as described in the approved proposal.
2. Fee. The Client will pay TSH {amount} (VAT inclusive): 50% on signing, 50% on delivery.
3. Timeline. Filming on {dates}; first cut within 10 working days of the last shoot day.
4. Revisions. Two rounds of revisions are included. Further rounds are billed at the agreed day rate.
5. Rights. On full payment the Client may use the final videos for the purposes stated in the proposal. Basil Media may show the work in its portfolio unless the Client objects in writing.
6. Consent. The Client is responsible for consent of patients, staff and premises shown, with Basil Media's release forms.
7. Law. This agreement is governed by the laws of the United Republic of Tanzania.`,
  },
  {
    key: 'release',
    name: 'Talent / appearance release',
    body: `APPEARANCE RELEASE

I, the undersigned, agree that Basil Media Ltd may film and photograph me on {date} at {location} and use my image, voice and words in {project} and related promotion, in any medium, without further payment.

I confirm I am over 18 years of age (or that my parent/guardian signs below) and that I have read and understood this release. I may withdraw consent for future uses by writing to Basil Media, but material already published may remain.`,
  },
  {
    key: 'nda',
    name: 'Mutual non-disclosure agreement',
    body: `MUTUAL NON-DISCLOSURE AGREEMENT

Basil Media Ltd and {Party} agree to keep confidential all non-public information shared for the purpose of {purpose}, to use it only for that purpose, and to return or destroy it on request.

This agreement lasts two (2) years from the date of the last signature and is governed by the laws of the United Republic of Tanzania.`,
  },
];
