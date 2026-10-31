import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Camera, EyeOff, Lock, ScanFace, ShieldCheck, Smartphone } from 'lucide-react';
import { useRows } from '@/hooks/useData';
import { useSeo } from '@/hooks/useSeo';
import { fmtDate } from '@/lib/format';
import { Media } from '@/components/Media';

type Step = 'landing' | 'consent' | 'camera';

export default function FindMe() {
  useSeo('Find my photos', 'Were you at an event Basil Media covered? Find your photos with one selfie.');
  const [params] = useSearchParams();
  const { rows: galleries } = useRows('galleries', { publishedOnly: true });
  const [code, setCode] = useState('');
  const [step, setStep] = useState<Step>('landing');
  const [agree, setAgree] = useState(false);
  const g = galleries.find((x) => x.slug === params.get('g'));
  const open = galleries.filter((x) => x.access_mode !== 'pin' && (!x.expires_on || x.expires_on >= new Date().toISOString().slice(0, 10)));

  return (
    <section className="relative min-h-[80vh] overflow-hidden text-white" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(124,192,245,0.35), transparent 55%), linear-gradient(170deg, #0A2F5C, #061E3D)' }}>
      <div className="container-bm relative max-w-[920px] pb-14 pt-24 sm:pt-32">
        <AnimatePresence mode="wait">
          {step === 'landing' && (
            <motion.div key="l" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-6 text-center">
              <span className="relative flex h-28 w-28 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/30"><span className="absolute inset-0 animate-pulseRing rounded-full" /><ScanFace size={52} className="text-basil-sky" /></span>
              <div className="font-mono text-xs tracking-[0.2em] text-basil-haze">FIND ME · {g ? g.title.toUpperCase() : 'EVENT PHOTOS'}</div>
              <h1 className="m-0 text-[clamp(24px,4vw,46px)] font-bold leading-[1.12] tracking-[-0.02em]">{g ? <>Were you at {g.title}?</> : <>Were you at an event?<br /><span className="text-basil-sky">Find your photos.</span></>}</h1>
              <p className="m-0 max-w-[560px] text-lg text-basil-frost">One selfie, a few seconds, every photo you are in. Your selfie never leaves your phone.</p>
              {g ? (
                <div className="flex flex-wrap justify-center gap-3">
                  {g.face_search_enabled && <button type="button" onClick={() => setStep('consent')} className="flex items-center gap-2 rounded-2xl border-0 bg-white px-7 py-4 font-bold text-basil"><Camera size={20} /> Take a selfie</button>}
                  <Link to={`/g/${g.slug}`} className="btn-ghost px-7 py-4">Browse the full gallery</Link>
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); const s = code.trim().toLowerCase().replace(/^.*\/g\//, ''); if (s) location.assign(`/g/${s}`); }} className="flex w-full max-w-md gap-2 rounded-2xl bg-white/10 p-1.5 ring-1 ring-white/25">
                  <label htmlFor="gcode" className="sr-only">Gallery code or link</label>
                  <input id="gcode" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Gallery code from your QR or SMS" className="min-w-0 flex-1 border-0 bg-transparent px-3 text-white outline-none placeholder:text-basil-haze/70" />
                  <button className="rounded-xl border-0 bg-white px-5 py-3 font-bold text-basil">Open</button>
                </form>
              )}
              {g && !g.face_search_enabled && <p className="m-0 text-sm text-basil-haze">Selfie search is not switched on for this gallery — browse the collections instead.</p>}
              <div className="flex items-center gap-2 text-sm text-basil-haze"><Lock size={14} /> Matching happens on your device. No selfie is uploaded or stored.</div>
              <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-bold tracking-wide text-white"><span className="h-1.5 w-1.5 rounded-full bg-sun shadow-[0_0_10px_#F5B942]" />Powered by Bermi AI</div>
            </motion.div>
          )}
          {step === 'consent' && g && (
            <motion.div key="c" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto flex max-w-[520px] flex-col gap-5 rounded-[28px] bg-white p-7 text-basil-ink">
              <button type="button" onClick={() => setStep('landing')} className="flex items-center gap-1 self-start border-0 bg-transparent font-bold text-basil"><ArrowLeft size={18} /> Back</button>
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-basil-ice text-basil"><ShieldCheck size={32} /></span>
              <div><div className="kicker">STEP 1 OF 2 · YOUR PRIVACY</div><h1 className="m-0 mt-1 text-[28px] font-extrabold">Before we look for you</h1></div>
              <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[15px]">
                <li className="flex gap-3"><Smartphone className="shrink-0 text-basil" size={20} />Your selfie is processed <b>on this phone</b> and is never uploaded.</li>
                <li className="flex gap-3"><EyeOff className="shrink-0 text-basil" size={20} />The image is discarded as soon as the numeric fingerprint is made.</li>
                <li className="flex gap-3"><ScanFace className="shrink-0 text-basil" size={20} />We only match inside <b>{g.title}</b> — never any other gallery.</li>
              </ul>
              <label className="flex items-start gap-3 rounded-2xl bg-basil-mist p-3.5 text-sm"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 accent-basil" /><span><b>I agree</b> to a one-time face match against this gallery. <Link to="/privacy/face-search">Read the privacy page</Link></span></label>
              <button type="button" disabled={!agree} onClick={() => setStep('camera')} className="btn-primary h-14 disabled:opacity-50">Open camera</button>
            </motion.div>
          )}
          {step === 'camera' && g && <CameraStep gallery={g.slug} onBack={() => setStep('consent')} />}
        </AnimatePresence>

        {step === 'landing' && !g && open.length > 0 && (
          <div className="mt-14">
            <h2 className="mb-4 text-xl font-extrabold">Event galleries · tap yours</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {open.map((x, i) => (
                <Link key={x.id} to={`/g/${x.slug}`} className="group no-underline">
                  <Media src={x.cover_url} index={i} className="flex h-48 flex-col justify-end rounded-3xl p-5 text-white">
                    <span className="relative text-xs text-basil-haze">{fmtDate(x.event_date)} · {x.location}</span>
                    <b className="relative font-display text-xl">{x.title}</b>
                  </Media>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function CameraStep({ gallery, onBack }: { gallery: string; onBack: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((s) => { stream = s; if (video.current) video.current.srcObject = s; })
      .catch(() => setErr('Camera permission was not given. You can still browse the gallery.'));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);
  return (
    <motion.div key="cam" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto flex max-w-[420px] flex-col items-center gap-5 text-center">
      <button type="button" onClick={onBack} className="flex items-center gap-1 self-start border-0 bg-transparent font-bold text-basil-sky"><ArrowLeft size={18} /> Back</button>
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[32px] bg-black ring-1 ring-white/20">
        <video ref={video} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
        <div className="pointer-events-none absolute inset-[12%_18%] rounded-[50%] border-2 border-dashed border-basil-sky/80" />
        <span className="absolute left-3 top-3 rounded-full bg-black/50 px-3 py-1 font-mono text-[11px] tracking-[0.14em]">ON-DEVICE · STEP 2 OF 2</span>
      </div>
      <div role="status" className="text-basil-frost">{err || 'Fit your face in the oval, in good light.'}</div>
      <p className="m-0 rounded-2xl bg-white/10 p-4 text-sm text-basil-haze">Selfie matching for this gallery is being prepared by the Basil Media team. Meanwhile, browse every photo in the gallery.</p>
      <Link to={`/g/${gallery}`} className="btn-white h-12 px-6">Browse the gallery</Link>
    </motion.div>
  );
}
