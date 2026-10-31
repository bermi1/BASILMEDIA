// Find my photos — a Pixieset-style directory of every published event gallery, plus selfie search.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Camera, EyeOff, Lock, ScanFace, Search, ShieldCheck, Smartphone } from 'lucide-react';
import { useRows } from '@/hooks/useData';
import { useSeo } from '@/hooks/useSeo';
import { fmtDateLong } from '@/lib/format';
import { gradient } from '@/components/Media';

export default function FindMe() {
  useSeo('Find my photos', 'Were you at an event Basil Media covered? Open your gallery or find yourself with one selfie.');
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { rows: galleries } = useRows('galleries', { publishedOnly: true });
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'list' | 'consent' | 'camera'>(params.get('g') ? 'consent' : 'list');
  const [agree, setAgree] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const open = galleries.filter((x) => x.access_mode !== 'pin' && (!x.expires_on || x.expires_on >= today));
  const g = galleries.find((x) => x.slug === params.get('g'));
  const q = code.trim().toLowerCase();
  const list = q ? open.filter((x) => x.title.toLowerCase().includes(q) || x.slug.includes(q) || x.client_name.toLowerCase().includes(q)) : open;

  if (step !== 'list' && g) {
    return (
      <section className="flex min-h-[100svh] items-center justify-center bg-[#0b0b0b] px-4 pb-24 pt-24 text-white">
        <AnimatePresence mode="wait">
          {step === 'consent' ? (
            <motion.div key="c" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full max-w-[440px]">
              <button type="button" onClick={() => nav('/find-me')} className="mb-6 flex items-center gap-1.5 border-0 bg-transparent p-0 text-[11px] uppercase tracking-[0.2em] text-white/60"><ArrowLeft size={14} />All galleries</button>
              <div className="text-[11px] uppercase tracking-[0.3em] text-white/50">Find me · {g.title}</div>
              <h1 className="mb-6 mt-2 text-[26px] font-light leading-tight">Before we look for you</h1>
              <ul className="m-0 flex list-none flex-col gap-4 p-0 text-[14px] text-white/80">
                <li className="flex gap-3"><Smartphone size={18} className="shrink-0 text-basil-sky" />Your selfie is processed on this phone and never uploaded.</li>
                <li className="flex gap-3"><EyeOff size={18} className="shrink-0 text-basil-sky" />The image is discarded once a numeric fingerprint is made.</li>
                <li className="flex gap-3"><ShieldCheck size={18} className="shrink-0 text-basil-sky" />We only search inside {g.title}.</li>
              </ul>
              <label className="mt-7 flex items-start gap-3 text-[13.5px] text-white/80"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 accent-basil" /><span>I agree to a one-time face match in this gallery. <Link to="/privacy/face-search" className="text-basil-sky">Privacy</Link></span></label>
              <button type="button" disabled={!agree} onClick={() => setStep('camera')} className="mt-6 flex h-12 w-full items-center justify-center gap-2 border-0 bg-white text-[12px] font-medium uppercase tracking-[0.25em] text-[#111] disabled:opacity-30"><Camera size={16} />Open camera</button>
              <Link to={`/g/${g.slug}`} className="mt-3 block text-center text-[11px] uppercase tracking-[0.2em] text-white/50">Or browse the gallery</Link>
            </motion.div>
          ) : (
            <CameraStep key="cam" slug={g.slug} onBack={() => setStep('consent')} />
          )}
        </AnimatePresence>
      </section>
    );
  }

  return (
    <div className="bg-white text-[#222]">
      <section className="mx-auto max-w-[1200px] px-4 pb-8 pt-28 text-center sm:pt-36">
        <div className="text-[11px] uppercase tracking-[0.32em] text-black/45">Basil Media · Client galleries</div>
        <h1 className="mb-0 mt-3 text-[clamp(24px,3.6vw,40px)] font-light uppercase tracking-[0.18em]">Find your photos</h1>
        <p className="mx-auto mb-0 mt-3 max-w-[460px] text-[14px] text-black/55">Pick your event, or type the code from your QR card or SMS.</p>
        <form onSubmit={(e) => { e.preventDefault(); const exact = open.find((x) => x.slug === q.replace(/^.*\/g\//, '')); if (exact) nav(`/g/${exact.slug}`); }} className="mx-auto mt-6 flex h-12 max-w-[440px] items-center gap-2 border-b border-black/20 focus-within:border-black">
          <Search size={17} className="text-black/40" />
          <label htmlFor="gcode" className="sr-only">Gallery name or code</label>
          <input id="gcode" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Event name or gallery code" className="h-full min-w-0 flex-1 border-0 bg-transparent text-[15px] outline-none placeholder:text-black/35" />
        </form>
      </section>

      <section className="mx-auto max-w-[1200px] px-4 pb-14">
        {list.length ? (
          <div className="grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((x, i) => (
              <motion.div key={x.id} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 3) * 0.06 }}>
                <Link to={`/g/${x.slug}`} className="group block text-[#222] no-underline">
                  <div className="relative aspect-[4/3] overflow-hidden" style={{ background: gradient(i) }}>
                    {x.cover_url && <img src={x.cover_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" />}
                    {x.face_search_enabled && <span className="absolute right-3 top-3 flex items-center gap-1 bg-white/90 px-2 py-1 text-[10px] uppercase tracking-[0.18em]"><ScanFace size={12} />Find me</span>}
                  </div>
                  <div className="mt-3 text-center">
                    <b className="block text-[13px] font-medium uppercase tracking-[0.2em]">{x.title}</b>
                    <span className="mt-1 block text-[11px] uppercase tracking-[0.2em] text-black/45">{fmtDateLong(x.event_date)}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="py-16 text-center text-[12px] uppercase tracking-[0.2em] text-black/40">{q ? 'No gallery matches that name or code' : 'New galleries appear here after each event'}</p>
        )}
      </section>

      <section className="border-t border-black/5 bg-[#fafafa]">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-3 px-4 py-12 text-center">
          <ScanFace size={28} strokeWidth={1.4} />
          <h2 className="m-0 text-[15px] font-medium uppercase tracking-[0.22em]">Find yourself with one selfie</h2>
          <p className="m-0 max-w-[420px] text-[13.5px] text-black/55">Open your event gallery and tap the face icon. Matching happens on your phone — your selfie never leaves it.</p>
          <span className="mt-1 flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.25em] text-black/45"><Lock size={12} />Powered by <b className="text-[#111]">Bermi AI</b></span>
        </div>
      </section>
    </div>
  );
}

function CameraStep({ slug, onBack }: { slug: string; onBack: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((s) => { stream = s; if (video.current) video.current.srcObject = s; })
      .catch(() => setErr('Camera permission was not given.'));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex w-full max-w-[380px] flex-col items-center gap-5 text-center">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 self-start border-0 bg-transparent p-0 text-[11px] uppercase tracking-[0.2em] text-white/60"><ArrowLeft size={14} />Back</button>
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[28px] bg-black">
        <video ref={video} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
        <div className="pointer-events-none absolute inset-[13%_19%] rounded-[50%] border border-white/70" />
        <motion.div aria-hidden="true" initial={{ top: '14%' }} animate={{ top: ['14%', '84%', '14%'] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} className="pointer-events-none absolute left-[19%] right-[19%] h-px bg-basil-sky shadow-[0_0_14px_#7CC0F5]" />
        <span className="absolute left-3 top-3 text-[10px] uppercase tracking-[0.2em] text-white/70">On device · Bermi AI</span>
      </div>
      <p role="status" className="m-0 text-[13px] text-white/70">{err || 'Fit your face in the oval, in good light.'}</p>
      <p className="m-0 text-[12px] text-white/45">Selfie matching for this gallery is being prepared. Meanwhile browse every photo.</p>
      <Link to={`/g/${slug}`} className="flex h-12 w-full items-center justify-center gap-2 bg-white text-[12px] font-medium uppercase tracking-[0.25em] text-[#111] no-underline">Browse the gallery<ArrowRight size={15} /></Link>
    </motion.div>
  );
}
