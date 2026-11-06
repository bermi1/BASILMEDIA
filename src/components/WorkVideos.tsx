// A few hand-picked films, each with a short label: they play silently in place while on screen,
// and open full screen with sound on tap. Instagram/YouTube links open in the player instead.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { parseVideo, youtubeThumb } from '@/lib/video';
import { useSettings } from '@/hooks/useData';
import { VideoEmbed } from './VideoEmbed';
import { gradient } from './Media';
import { Instagram, Play, YouTube } from './icons';

export interface WorkVideo { id: string; title: string; video_url: string; image_url: string }

const quiet = () => {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return matchMedia('(prefers-reduced-motion: reduce)').matches || !!c?.saveData;
};

function Tile({ v, i, onOpen }: { v: WorkVideo; i: number; onOpen: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const isFile = parseVideo(v.video_url).kind === 'file';
  const poster = v.image_url || youtubeThumb(v.video_url);
  useEffect(() => {
    const el = ref.current;
    if (!el || quiet()) return;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? el.play().catch(() => {}) : el.pause()), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <button type="button" onClick={onOpen} aria-label={`Play ${v.title}`} className="group relative block aspect-video w-full overflow-hidden rounded-[18px] border-0 p-0" style={{ background: gradient(i) }}>
      {isFile ? (
        <video ref={ref} src={v.video_url} poster={poster} muted loop playsInline preload="none" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]" />
      ) : (
        poster && <img src={poster} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]" />
      )}
      <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/25" />
      <span className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 opacity-90 shadow-lg transition group-hover:scale-110 sm:opacity-0 sm:group-hover:opacity-100"><Play size={16} /></span>
    </button>
  );
}

export function WorkGrid({ items, max = 8, dark = false }: { items: WorkVideo[]; max?: number; dark?: boolean }) {
  const [open, setOpen] = useState<WorkVideo | null>(null);
  const list = items.filter((v) => v.video_url).slice(0, max);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    addEventListener('keydown', k);
    return () => (removeEventListener('keydown', k), void (document.body.style.overflow = ''));
  }, [open]);
  if (!list.length) return null;
  const odd = list.length % 2 === 1;
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        {list.map((v, i) => (
          <figure key={v.id} className={`m-0 ${odd && i === 0 ? 'sm:col-span-2' : ''}`}>
            <Tile v={v} i={i} onOpen={() => setOpen(v)} />
            <figcaption className={`mt-2 px-1 text-[13.5px] font-medium leading-snug ${dark ? 'text-white/85' : 'text-basil-ink'}`}>{v.title}</figcaption>
          </figure>
        ))}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(null)} role="dialog" aria-modal="true" aria-label={open.title} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95 p-3 sm:p-10">
            <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border-0 bg-white/10 text-white sm:right-6 sm:top-6"><X size={20} /></button>
            <motion.div initial={{ scale: 0.97 }} animate={{ scale: 1 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-[1200px] overflow-hidden rounded-xl">
              {parseVideo(open.video_url).kind === 'file' ? (
                <video src={open.video_url} poster={open.image_url} controls autoPlay playsInline className="aspect-video w-full bg-black" />
              ) : (
                <VideoEmbed url={open.video_url} title={open.title} autoPlay aspect={parseVideo(open.video_url).kind === 'instagram' ? '9 / 16' : '16 / 9'} className={parseVideo(open.video_url).kind === 'instagram' ? 'mx-auto max-w-[420px]' : ''} />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** "Watch more" — sends people to the full archive on Instagram and YouTube. */
export function WatchMore({ dark = false }: { dark?: boolean }) {
  const s = useSettings();
  const ig = s.socials?.instagram, yt = s.socials?.youtube;
  const cls = `flex h-11 items-center gap-2 whitespace-nowrap rounded-full px-5 text-[14px] font-semibold no-underline transition ${dark ? 'border border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white' : 'border border-basil-edge bg-white text-basil-ink hover:border-basil hover:text-basil'}`;
  if (!ig && !yt) return null;
  return (
    <div className="mt-6 flex flex-col items-center gap-3 text-center sm:mt-8">
      <span className={`text-[13px] ${dark ? 'text-basil-haze' : 'text-basil-muted'}`}>Watch more of our work</span>
      <div className="flex flex-wrap justify-center gap-2">
        {ig && <a href={ig} target="_blank" rel="noreferrer" className={cls}><Instagram width={18} height={18} />Instagram</a>}
        {yt && <a href={yt} target="_blank" rel="noreferrer" className={cls}><YouTube width={18} height={18} />YouTube</a>}
      </div>
    </div>
  );
}
