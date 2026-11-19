// Landing-page work showcase: a big player on top for the chosen piece (its poster; the film itself only downloads when "Watch" opens the pop-up player) and
// every other piece in one row beneath it, so all of them are seen; tap one to bring it up. Auto-advances,
// swipes on phones. Portrait films stay
// portrait — they sit on a soft blurred copy of their own poster, so the stage never changes size.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, ChevronLeft, ChevronRight, ExternalLink, Play } from 'lucide-react';
import { parseVideo, type Orientation } from '@/lib/video';
import { useCover } from '@/lib/useCover';
import { gradient } from '@/components/Media';

export type ShowItem = { id: string; title: string; url: string; link?: string; poster: string; sub: string; shape: Orientation; desc?: string; client?: string };
const DWELL = 7000;

export function WorkShowcase({ items, onOpen }: { items: ShowItem[]; onOpen: (i: number) => void }) {
  const [i, setI] = useState(0);
  const [hover, setHover] = useState(false);
  const [dir, setDir] = useState(1);
  const strip = useRef<HTMLOListElement>(null);
  const n = items.length;
  const cur = items[Math.min(i, n - 1)];
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const paused = hover || reduce;

  const go = (to: number) => { setDir(to > i || (i === n - 1 && to === 0) ? 1 : -1); setI(((to % n) + n) % n); };
  useEffect(() => {
    if (paused || n < 2) return;
    const t = setTimeout(() => go(i + 1), DWELL);
    return () => clearTimeout(t);
  }); // re-armed every render on purpose: any change of slide or pause restarts the clock
  // keep the playing item visible in the row below (scrolls the row only, never the page)
  useEffect(() => {
    const row = strip.current, card = row?.children[i] as HTMLElement | undefined;
    if (!row || !card) return;
    const left = card.offsetLeft - (row.clientWidth - card.offsetWidth) / 2;
    row.scrollTo({ left: Math.max(0, left), behavior: reduce ? 'auto' : 'smooth' });
  }, [i, reduce]);
  const nudge = (d: number) => strip.current?.scrollBy({ left: d * strip.current.clientWidth * 0.8, behavior: 'smooth' });

  if (!cur) return null;
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {/* PLAYER — the chosen piece, big */}
      <motion.div
        className="relative aspect-square w-full touch-pan-y overflow-hidden rounded-[22px] bg-basil-night ring-1 ring-white/10 sm:aspect-[16/9] lg:aspect-auto lg:h-[540px]"
        drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.18}
        onDragEnd={(_, d) => { if (d.offset.x < -60) go(i + 1); else if (d.offset.x > 60) go(i - 1); }}
      >
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div key={cur.id} custom={dir} className="absolute inset-0"
            initial={{ opacity: 0, x: dir * 40, scale: 1.02 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}>
            <Stage item={cur} index={i} onOpen={() => onOpen(i)} />
          </motion.div>
        </AnimatePresence>
        {n > 1 && (
          <>
            <button type="button" onClick={() => go(i - 1)} aria-label="Previous" className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-white/15 text-white backdrop-blur-md transition hover:bg-white hover:text-basil-night sm:flex"><ChevronLeft size={18} /></button>
            <button type="button" onClick={() => go(i + 1)} aria-label="Next" className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-white/15 text-white backdrop-blur-md transition hover:bg-white hover:text-basil-night sm:flex"><ChevronRight size={18} /></button>
          </>
        )}
      </motion.div>

      {/* UP NEXT — every piece in one row beneath the player; tap one to bring it up */}
      {n > 1 && (
        <div className="mt-4 sm:mt-5">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <span className="font-mono text-[10.5px] tracking-[0.18em] text-white/60">{items.some((x) => x.url) ? 'MORE FILMS' : 'MORE GALLERIES'}</span>
            <span className="hidden gap-1.5 sm:flex">
              <button type="button" onClick={() => nudge(-1)} aria-label="Scroll left" className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/[0.06] text-white transition hover:bg-white hover:text-basil-night"><ChevronLeft size={15} /></button>
              <button type="button" onClick={() => nudge(1)} aria-label="Scroll right" className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/[0.06] text-white transition hover:bg-white hover:text-basil-night"><ChevronRight size={15} /></button>
            </span>
          </div>
          <ol ref={strip} className="scrollbar-none relative -mx-4 m-0 flex list-none snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-px-4 px-4 py-1.5 sm:mx-0 sm:gap-3 sm:scroll-px-0 sm:px-0 sm:[mask-image:linear-gradient(90deg,transparent,#000_3%,#000_97%,transparent)]">
            {items.map((x, k) => (
              <li key={x.id} className="w-[42vw] max-w-[190px] shrink-0 snap-start sm:w-[200px] sm:max-w-none lg:w-[224px]">
                <button type="button" onClick={() => go(k)} aria-current={k === i} aria-label={`Show ${x.title}`}
                  className={`group block w-full rounded-2xl border-0 bg-transparent p-0 text-left transition duration-300 ${k === i ? '' : 'opacity-70 hover:opacity-100'}`}>
                  <span className={`relative block aspect-[16/10] overflow-hidden rounded-2xl ring-2 transition duration-300 ${k === i ? 'ring-basil-sky shadow-[0_0_28px_rgba(124,192,245,0.45)]' : 'ring-white/5'}`}>
                    <Thumb item={x} index={k} />
                    <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent" />
                    {k === i
                      ? <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-basil-sky px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-basil-night"><Bars paused={paused} />Now {x.url ? 'playing' : 'showing'}</span>
                      : x.url && <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition group-hover:bg-white group-hover:text-basil-night"><Play size={10} /></span>}
                    {k === i && (
                      <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/15">
                        <motion.span key={`${cur.id}-${paused}`} className="block h-full origin-left bg-basil-sky" initial={{ scaleX: 0 }} animate={{ scaleX: paused ? 0 : 1 }} transition={{ duration: paused ? 0 : DWELL / 1000, ease: 'linear' }} />
                      </span>
                    )}
                  </span>
                  <span className="mt-2 block truncate text-[10px] font-bold uppercase tracking-[0.14em] text-basil-sky">{x.sub}</span>
                  <span className={`line-clamp-2 text-[12.5px] font-medium leading-snug ${k === i ? 'text-white' : 'text-white/75 group-hover:text-white'}`}>{x.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function Stage({ item, index, onOpen }: { item: ShowItem; index: number; onOpen: () => void }) {
  const poster = useCover(item.link, item.poster);
  const v = parseVideo(item.url);
  const portrait = item.shape === 'portrait';
  const media = portrait ? 'h-full w-auto max-w-full aspect-[9/16] object-cover' : 'h-full w-full object-cover';

  return (
    <div className="relative flex h-full w-full items-center justify-center" style={{ background: gradient(index) }}>
      {/* soft backdrop from the poster, so portrait films and odd photos never leave bare bars */}
      {poster && <img src={poster} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />}
      {v.kind === 'file' && !poster
        ? <video src={v.src} muted playsInline preload="metadata" className={`relative ${media}`} />
        : poster
          ? <img src={poster} alt="" className={`relative ${media} object-top`} />
          : <span className="relative flex flex-col items-center gap-1 text-white/85"><Camera size={30} /><span className="text-[10px] font-bold uppercase tracking-[0.18em]">Photo gallery</span></span>}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-basil-night/90 via-basil-night/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-6">
        <div className="min-w-0 text-left">
          <span className="block text-[10.5px] font-bold uppercase tracking-[0.16em] text-basil-sky">{item.sub}</span>
          <b className="mt-0.5 line-clamp-2 font-display text-[15px] font-semibold leading-tight text-white sm:text-[19px]">{item.title}</b>
        </div>
        {item.url
          ? <button type="button" onClick={onOpen} className="flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-0 bg-white px-4 text-[13px] font-semibold text-basil-night shadow-[0_0_28px_rgba(124,192,245,0.5)] transition hover:scale-105"><Play size={14} />Watch full film</button>
          : <button type="button" onClick={onOpen} className="flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-0 bg-white px-4 text-[13px] font-semibold text-basil-night transition hover:scale-105"><ExternalLink size={14} />View photos</button>}
      </div>
    </div>
  );
}

/** Three little equaliser bars on the item that is playing. */
function Bars({ paused }: { paused: boolean }) {
  return (
    <span aria-hidden="true" className="flex h-2.5 items-end gap-[2px]">
      {[0, 1, 2].map((k) => <motion.span key={k} className="w-[2px] rounded-full bg-basil-night" animate={paused ? { height: 4 } : { height: [3, 10, 5, 9, 3] }} transition={{ duration: 0.9, repeat: Infinity, delay: k * 0.15 }} />)}
    </span>
  );
}

function Thumb({ item, index }: { item: ShowItem; index: number }) {
  const poster = useCover(item.link, item.poster);
  return (
    <span className="absolute inset-0 block transition duration-500 group-hover:scale-105" style={{ background: gradient(index) }}>
      {poster ? <img src={poster} alt="" className="h-full w-full object-cover object-top" /> : <Camera size={18} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/80" />}
    </span>
  );
}
