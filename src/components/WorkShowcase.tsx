// Landing-page work showcase: one stage that plays the selected piece (muted preview, tap for sound),
// a rail of the other pieces with a progress line, auto-advance, swipe on phones. Portrait films stay
// portrait — they sit on a soft blurred copy of their own poster, so the stage never changes size.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, ChevronLeft, ChevronRight, ExternalLink, Volume2 } from 'lucide-react';
import { parseVideo, type Orientation } from '@/lib/video';
import { useCover } from '@/lib/useCover';
import { gradient } from '@/components/Media';
import { VideoEmbed } from '@/components/VideoEmbed';

export type ShowItem = { id: string; title: string; url: string; link?: string; poster: string; sub: string; shape: Orientation };
const DWELL = 7000;

export function WorkShowcase({ items }: { items: ShowItem[] }) {
  const [i, setI] = useState(0);
  const [sound, setSound] = useState(false); // playing with sound: stop auto-advance
  const [hover, setHover] = useState(false);
  const [dir, setDir] = useState(1);
  const n = items.length;
  const cur = items[Math.min(i, n - 1)];
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const paused = sound || hover || reduce;

  const go = (to: number) => { setDir(to > i || (i === n - 1 && to === 0) ? 1 : -1); setSound(false); setI(((to % n) + n) % n); };
  useEffect(() => {
    if (paused || n < 2) return;
    const t = setTimeout(() => go(i + 1), DWELL);
    return () => clearTimeout(t);
  }); // re-armed every render on purpose: any change of slide or pause restarts the clock

  if (!cur) return null;
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_300px] lg:gap-5" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {/* STAGE */}
      <div className="relative">
        <motion.div
          className="relative aspect-square w-full touch-pan-y overflow-hidden rounded-[22px] bg-basil-night ring-1 ring-white/10 sm:aspect-[16/10] lg:aspect-auto lg:h-[480px]"
          drag={sound ? false : 'x'} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.18}
          onDragEnd={(_, d) => { if (d.offset.x < -60) go(i + 1); else if (d.offset.x > 60) go(i - 1); }}
        >
          <AnimatePresence initial={false} custom={dir} mode="popLayout">
            <motion.div key={cur.id} custom={dir} className="absolute inset-0"
              initial={{ opacity: 0, x: dir * 40, scale: 1.02 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: dir * -40 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}>
              <Stage item={cur} index={i} sound={sound} onSound={() => setSound(true)} />
            </motion.div>
          </AnimatePresence>
          {n > 1 && !sound && (
            <>
              <button type="button" onClick={() => go(i - 1)} aria-label="Previous" className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-white/15 text-white backdrop-blur-md transition hover:bg-white hover:text-basil-night sm:flex"><ChevronLeft size={18} /></button>
              <button type="button" onClick={() => go(i + 1)} aria-label="Next" className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-white/15 text-white backdrop-blur-md transition hover:bg-white hover:text-basil-night sm:flex"><ChevronRight size={18} /></button>
            </>
          )}
        </motion.div>
        {/* phones: dots under the stage */}
        {n > 1 && (
          <div className="mt-3 flex justify-center gap-1.5 lg:hidden">
            {items.map((x, k) => <button key={x.id} type="button" onClick={() => go(k)} aria-label={`Show ${x.title}`} className={`h-1.5 rounded-full border-0 p-0 transition-all ${k === i ? 'w-6 bg-white' : 'w-1.5 bg-white/30'}`} />)}
          </div>
        )}
      </div>

      {/* RAIL (desktop): every piece, the active one with a filling progress line */}
      <ol className="m-0 hidden list-none flex-col gap-2 overflow-y-auto p-0 lg:flex lg:max-h-[480px]">
        {items.map((x, k) => (
          <li key={x.id}>
            <button type="button" onClick={() => go(k)} aria-current={k === i} className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border-0 p-2 text-left transition ${k === i ? 'bg-white/[0.12] ring-1 ring-white/25' : 'bg-white/[0.04] hover:bg-white/[0.08]'}`}>
              <Thumb item={x} index={k} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[10.5px] font-bold uppercase tracking-[0.14em] text-basil-sky">{x.sub}</span>
                <span className={`line-clamp-2 text-[13.5px] font-medium leading-snug ${k === i ? 'text-white' : 'text-white/70 group-hover:text-white'}`}>{x.title}</span>
              </span>
              {k === i && (
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-white/10">
                  <motion.span key={`${cur.id}-${paused}`} className="block h-full origin-left bg-basil-sky" initial={{ scaleX: 0 }} animate={{ scaleX: paused ? 0 : 1 }} transition={{ duration: paused ? 0 : DWELL / 1000, ease: 'linear' }} />
                </span>
              )}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Stage({ item, index, sound, onSound }: { item: ShowItem; index: number; sound: boolean; onSound: () => void }) {
  const poster = useCover(item.link, item.poster);
  const v = parseVideo(item.url);
  const portrait = item.shape === 'portrait';
  const vid = useRef<HTMLVideoElement>(null);
  // iOS only autoplays when the element is muted before it starts
  useEffect(() => { const el = vid.current; if (el) { el.defaultMuted = true; el.muted = true; el.play().catch(() => {}); } }, [item.url]);
  const media = portrait ? 'h-full w-auto max-w-full aspect-[9/16] object-cover' : 'h-full w-full object-cover';

  if (sound && item.url) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black">
        <div className={portrait ? 'h-full aspect-[9/16] [&>*]:h-full' : 'w-full'}><VideoEmbed url={item.url} title={item.title} poster={poster} autoPlay aspect={portrait ? '9 / 16' : '16 / 9'} /></div>
      </div>
    );
  }
  return (
    <div className="relative flex h-full w-full items-center justify-center" style={{ background: gradient(index) }}>
      {/* soft backdrop from the poster, so portrait films and odd photos never leave bare bars */}
      {poster && <img src={poster} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />}
      {v.kind === 'file'
        ? <video ref={vid} src={v.src} poster={poster || undefined} muted loop autoPlay playsInline preload="metadata" className={`relative ${media}`} />
        : poster
          ? <img src={poster} alt="" className={`relative ${media} object-top`} />
          : <span className="relative flex flex-col items-center gap-1 text-white/85"><Camera size={30} /><span className="text-[10px] font-bold uppercase tracking-[0.18em]">Photo gallery</span></span>}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-basil-night/90 via-basil-night/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-6">
        <div className="min-w-0 text-left">
          <span className="block text-[10.5px] font-bold uppercase tracking-[0.16em] text-basil-sky">{item.sub}</span>
          <b className="mt-0.5 line-clamp-2 font-display text-[17px] font-semibold leading-tight text-white sm:text-[22px]">{item.title}</b>
        </div>
        {item.url
          ? <button type="button" onClick={onSound} className="flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-0 bg-white px-4 text-[13px] font-semibold text-basil-night shadow-[0_0_28px_rgba(124,192,245,0.5)] transition hover:scale-105"><Volume2 size={15} />{v.kind === 'file' ? 'Watch with sound' : 'Play'}</button>
          : item.link && <a href={item.link} target="_blank" rel="noreferrer" className="flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-4 text-[13px] font-semibold text-basil-night no-underline transition hover:scale-105 hover:text-basil-night"><ExternalLink size={14} />View photos</a>}
      </div>
    </div>
  );
}

function Thumb({ item, index }: { item: ShowItem; index: number }) {
  const poster = useCover(item.link, item.poster);
  return (
    <span className="relative h-14 w-20 shrink-0 overflow-hidden rounded-xl" style={{ background: gradient(index) }}>
      {poster ? <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover object-top" /> : <Camera size={18} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/80" />}
    </span>
  );
}
