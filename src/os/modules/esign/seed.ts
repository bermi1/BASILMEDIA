// Demo seed: one completed, one partly signed and one draft document.
import { registerSeed, type Row } from '@/os/lib/store';
import { TEMPLATES } from './lib';

const ago = (days: number, h = 0) => new Date(Date.now() - days * 864e5 - h * 36e5).toISOString();
const ahead = (days: number) => new Date(Date.now() + days * 864e5).toISOString();
const sig = (d: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><path d="${d}" fill="none" stroke="#0A2F5C" stroke-width="3" stroke-linecap="round"/></svg>`)}`;
const UA_PHONE = 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const UA_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

const production = TEMPLATES[0].body
  .replace('{Client}', 'Aga Khan Hospital, Dar es Salaam')
  .replace('{deliverables}', 'a 3-minute patient-care documentary and six 30-second social cut-downs')
  .replace('{amount}', '18,500,000')
  .replace('{dates}', '12/11/2026 to 14/11/2026');
const release = TEMPLATES[1].body.replace('{date}', '20/10/2026').replace('{location}', 'University of Dar es Salaam, Mlimani campus').replace('{project}', 'the UDSM 2027 admissions campaign');

const R = (rows: Record<string, unknown>[]) => rows as Row[];
const doc = (o: Record<string, unknown>) => ({ source_url: '', body_text: '', message: '', doc_hash: '', expires_at: null, sent_at: null, completed_at: null, created_by: 'u-growth', ...o });
const signer = (o: Record<string, unknown>) => ({ email: '', phone: '', fields: ['signature', 'name', 'date'], viewed_at: null, signed_at: null, signed_name: null, signature_data: null, user_agent: null, decline_reason: null, ...o });

registerSeed('esign_documents', () =>
  R([
    doc({ id: 'es-1', title: 'Appearance release · UDSM admissions campaign', source_kind: 'text', body_text: release, signing_order: 'parallel', status: 'Completed', sent_at: ago(16), completed_at: ago(15, 3), expires_at: ahead(14), created_at: ago(17) }),
    doc({ id: 'es-2', title: 'Production services agreement · Aga Khan Hospital', source_kind: 'text', body_text: production, message: 'Dear Dr Juma, please sign the production agreement so we can lock the shoot dates.', signing_order: 'sequential', status: 'Partly signed', sent_at: ago(2), expires_at: ahead(28), created_at: ago(3) }),
    doc({ id: 'es-3', title: 'Mutual NDA · CRDB Bank Foundation', source_kind: 'text', body_text: TEMPLATES[2].body.replace('{Party}', 'CRDB Bank Foundation').replace('{purpose}', 'the 2027 financial-literacy campaign pitch'), signing_order: 'parallel', status: 'Draft', created_at: ago(0, 4) }),
  ]),
);

registerSeed('esign_signers', () =>
  R([
    signer({ id: 'ess-1', document_id: 'es-1', name: 'Asha Mwinyi', phone: '+255754112233', sign_order: 1, token: 'demo-release-asha', status: 'Signed', viewed_at: ago(16, -1), signed_at: ago(16, -2), signed_name: 'Asha Mwinyi', signature_data: sig('M10 70 C 40 10, 60 90, 90 40 S 140 20, 160 60 S 220 80, 280 30'), user_agent: UA_PHONE, created_at: ago(17) }),
    signer({ id: 'ess-2', document_id: 'es-1', name: 'Benedicto Ngowi', email: 'benedicto@basilmedia.co.tz', sign_order: 1, token: 'demo-release-benedicto', status: 'Signed', viewed_at: ago(15, 5), signed_at: ago(15, 3), signed_name: 'Benedicto Ngowi', signature_data: sig('M15 60 Q 50 5, 80 60 T 150 60 Q 190 20, 230 70 L 285 40'), user_agent: UA_MAC, created_at: ago(17) }),
    signer({ id: 'ess-3', document_id: 'es-2', name: 'Emmanuel Basil', email: 'emmanuel@basilmedia.co.tz', sign_order: 1, token: 'demo-agreement-emmanuel', status: 'Signed', viewed_at: ago(2, -1), signed_at: ago(2, -2), signed_name: 'Emmanuel Basil', signature_data: sig('M10 50 C 30 0, 70 100, 100 50 C 130 0, 170 100, 200 50 L 290 55'), user_agent: UA_MAC, created_at: ago(3) }),
    signer({ id: 'ess-4', document_id: 'es-2', name: 'Dr Amina Juma', email: 'amina.juma@agakhan.example', phone: '+255713445566', sign_order: 2, token: 'demo-agreement-amina', status: 'Viewed', viewed_at: ago(1), created_at: ago(3) }),
    signer({ id: 'ess-5', document_id: 'es-3', name: 'Neema Lyimo', email: 'neema@basilmedia.co.tz', sign_order: 1, token: 'demo-nda-neema', status: 'Waiting', created_at: ago(0, 4) }),
    signer({ id: 'ess-6', document_id: 'es-3', name: 'Mr Joseph Mrema', email: 'j.mrema@crdbfoundation.example', sign_order: 2, token: 'demo-nda-joseph', status: 'Waiting', created_at: ago(0, 4) }),
  ]),
);

registerSeed('esign_events', () =>
  R([
    { id: 'ese-1', document_id: 'es-1', signer_id: null, kind: 'sent', detail: 'Sent for signature by Neema Lyimo', user_agent: '', created_at: ago(16) },
    { id: 'ese-2', document_id: 'es-1', signer_id: 'ess-1', kind: 'signed', detail: 'Asha Mwinyi signed', user_agent: UA_PHONE, created_at: ago(16, -2) },
    { id: 'ese-3', document_id: 'es-1', signer_id: 'ess-2', kind: 'signed', detail: 'Benedicto Ngowi signed', user_agent: UA_MAC, created_at: ago(15, 3) },
    { id: 'ese-4', document_id: 'es-1', signer_id: null, kind: 'completed', detail: 'All parties signed', user_agent: '', created_at: ago(15, 3) },
    { id: 'ese-5', document_id: 'es-2', signer_id: null, kind: 'sent', detail: 'Sent for signature by Neema Lyimo', user_agent: '', created_at: ago(2) },
    { id: 'ese-6', document_id: 'es-2', signer_id: 'ess-3', kind: 'signed', detail: 'Emmanuel Basil signed', user_agent: UA_MAC, created_at: ago(2, -2) },
    { id: 'ese-7', document_id: 'es-2', signer_id: 'ess-4', kind: 'viewed', detail: 'Dr Amina Juma opened the document', user_agent: UA_PHONE, created_at: ago(1) },
  ]),
);
