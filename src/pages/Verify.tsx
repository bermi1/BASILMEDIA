// Public verification at /verify/:id — recomputes the SHA-256 of the document source and checks it against the recorded hash.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { useSeo } from '@/hooks/useSeo';
import { sha256Hex } from '@/os/security/lib';
import { verifyDocument, type Verification } from '@/os/modules/esign/api';
import { fmtTime, hashSource } from '@/os/modules/esign/lib';
import { Pill } from '@/os/ui';

export default function Verify() {
  useSeo('Verify document · Basil Media');
  const { id = '' } = useParams();
  const [v, setV] = useState<Verification | null | undefined>(undefined);
  const [hash, setHash] = useState('');
  useEffect(() => {
    verifyDocument(id).then(async (r) => { setV(r); if (r) setHash(await sha256Hex(hashSource(r))); }).catch(() => setV(null));
  }, [id]);
  const match = !!v && !!v.doc_hash && hash === v.doc_hash;
  const valid = match && v?.status === 'Completed';
  return (
    <div className="min-h-screen bg-[#F3F7FC] px-4 py-8 text-basil-ink">
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <div className="flex items-center gap-3"><img src="/logo.svg" alt="Basil Media" className="h-10 w-10" /><b className="font-display">Basil Media · Document verification</b></div>
        {v === undefined ? <Loader2 className="mx-auto animate-spin text-basil" size={32} /> : !v ? (
          <div className="rounded-2xl bg-white p-6"><h1 className="m-0 text-xl font-extrabold">No document with this ID</h1><p className="mb-0 text-basil-muted">Check the link on the certificate of completion.</p></div>
        ) : (
          <>
            <div className={`flex items-start gap-3 rounded-2xl p-5 ${valid ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
              {valid ? <CheckCircle2 className="shrink-0" /> : <ShieldAlert className="shrink-0" />}
              <div><b className="text-lg">{valid ? 'Valid and fully signed' : !match ? 'Hash does not match' : `Not completed (${v.status})`}</b><br />
                <span className="text-sm">{match ? 'The document has not changed since it was sent for signature.' : 'The document source differs from what was sent, or it has no hash yet.'}</span></div>
            </div>
            <section className="rounded-2xl border border-basil-line bg-white p-5">
              <h1 className="m-0 text-xl font-extrabold">{v.title}</h1>
              <div className="mt-1 flex flex-wrap gap-2 text-sm text-basil-muted"><Pill tone={v.status === 'Completed' ? 'green' : v.status === 'Declined' || v.status === 'Expired' ? 'red' : 'amber'}>{v.status}</Pill>Sent {fmtTime(v.sent_at)}{v.completed_at && ` · completed ${fmtTime(v.completed_at)}`}</div>
              <dl className="mt-4 grid gap-1 text-sm">
                <dt className="text-basil-muted">Recorded SHA-256</dt><dd className="m-0 break-all font-mono text-xs">{v.doc_hash || '—'}</dd>
                <dt className="mt-2 text-basil-muted">Recomputed now in your browser</dt><dd className="m-0 break-all font-mono text-xs">{hash || '—'}</dd>
              </dl>
              <h2 className="mb-1 mt-5 text-base font-extrabold">Signers</h2>
              <ul className="m-0 list-none p-0 text-sm">{v.signers.map((s, i) => <li key={i} className="flex justify-between gap-2 border-t border-basil-line py-2"><span>{s.signed_name ?? s.name}</span><span className="text-basil-muted">{s.status === 'Signed' ? fmtTime(s.signed_at) : s.status}</span></li>)}</ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
