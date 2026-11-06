// Public page: ask Basil Media to remove you (your photos and face data) from a gallery.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import { useRows } from '@/hooks/useData';
import { useSeo } from '@/hooks/useSeo';
import { requestRemoval } from '@/lib/face';

const field = 'h-12 w-full border-0 border-b border-black/20 bg-transparent text-[15px] outline-none focus:border-black';
const lbl = 'block text-[10.5px] uppercase tracking-[0.25em] text-black/50';

export default function RemoveMe() {
  useSeo('Remove me from a gallery', 'Ask Basil Media to remove your photos and face data from an event gallery.');
  const [params] = useSearchParams();
  const { rows: galleries } = useRows('galleries', { publishedOnly: true });
  const [slug, setSlug] = useState(params.get('g') ?? '');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [reason, setReason] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [err, setErr] = useState('');

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setState('sending');
    try {
      const g = galleries.find((x) => x.slug === slug);
      await requestRemoval({ gallery_id: g?.id ?? null, gallery_slug: slug, name: name.trim(), contact: contact.trim(), reason: reason.trim() });
      setState('sent');
    } catch (e2) {
      setErr((e2 as Error).message || 'Could not send. Please try again.');
      setState('idle');
    }
  };

  return (
    <section className="bg-white px-4 pb-20 pt-28 text-[#222] sm:pt-36">
      <div className="mx-auto max-w-[460px]">
        <div className="text-center text-[11px] uppercase tracking-[0.32em] text-black/45">Basil Media · Client galleries</div>
        <h1 className="mb-0 mt-3 text-center text-[clamp(22px,3.2vw,34px)] font-light uppercase tracking-[0.18em]">Remove me</h1>
        <p className="mb-8 mt-3 text-center text-[13.5px] text-black/55">Tell us which gallery. We will take down photos of you and delete any face data for them, and confirm by phone or email.</p>
        {state === 'sent' ? (
          <div role="status" className="flex flex-col items-center gap-3 py-10 text-center">
            <Check size={28} strokeWidth={1.4} />
            <b className="text-[13px] font-medium uppercase tracking-[0.22em]">Request received</b>
            <p className="m-0 text-[13.5px] text-black/55">Our team will contact you within two working days.</p>
            <Link to={slug ? `/g/${slug}` : '/find-me'} className="mt-2 text-[11px] uppercase tracking-[0.22em] text-[#111]">Back to the gallery</Link>
          </div>
        ) : (
          <form onSubmit={send} className="flex flex-col gap-6">
            <label className={lbl}>Gallery
              <select required value={slug} onChange={(e) => setSlug(e.target.value)} className={`${field} mt-1 normal-case tracking-normal text-[#222]`}>
                <option value="">Choose the event</option>
                {galleries.map((g) => <option key={g.id} value={g.slug}>{g.title}</option>)}
              </select>
            </label>
            <label className={lbl}>Your name
              <input required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={`${field} mt-1 normal-case tracking-normal text-[#222]`} />
            </label>
            <label className={lbl}>Phone or email
              <input required minLength={3} maxLength={200} value={contact} onChange={(e) => setContact(e.target.value)} className={`${field} mt-1 normal-case tracking-normal text-[#222]`} />
            </label>
            <label className={lbl}>Reason (optional)
              <textarea maxLength={2000} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full border-0 border-b border-black/20 bg-transparent py-2 text-[15px] normal-case tracking-normal text-[#222] outline-none focus:border-black" />
            </label>
            {err && <p role="alert" className="m-0 text-[13px] text-red-700">{err}</p>}
            <button type="submit" disabled={state === 'sending'} className="flex h-12 items-center justify-center gap-2 border-0 bg-[#111] text-[12px] font-medium uppercase tracking-[0.25em] text-white disabled:opacity-50">
              {state === 'sending' && <Loader2 size={15} className="animate-spin" />}Send request
            </button>
            <p className="m-0 text-center text-[11px] text-black/45">Handled under the Tanzania Personal Data Protection Act, 2022. <Link to="/privacy/face-search" className="text-black/60">Face search privacy</Link></p>
          </form>
        )}
      </div>
    </section>
  );
}
