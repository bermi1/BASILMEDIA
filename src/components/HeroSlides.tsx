// Crossfading hero photos (team, office, studio — set in the CMS). Each photo is shown whole (never cropped or
// zoomed, so no heads are cut) over a soft blurred copy of itself that fills the rest of the hero.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { parseVideo } from '@/lib/video';

export function HeroSlides({ images, video, interval = 6000 }: { images: string[]; video?: string; interval?: number }) {
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (images.length < 2 || reduce) return;
    const t = setInterval(() => setI((x) => (x + 1) % images.length), interval);
    return () => clearInterval(t);
  }, [images.length, interval, reduce]);
  useEffect(() => {
    // Warm the next photo so the crossfade never flashes.
    const next = images[(i + 1) % images.length];
    if (next) new Image().src = next;
  }, [i, images]);
  const v = parseVideo(video);
  if (v.kind === 'file') {
    // Built-in hero loops (public/media/hero) come in a wide and a tall version: phones get the tall one.
    const tall = typeof matchMedia !== 'undefined' && matchMedia('(orientation: portrait)').matches;
    const builtIn = v.src.startsWith('/media/hero/') && v.src.endsWith('.mp4');
    const src = builtIn && tall ? v.src.replace(/\.mp4$/, '-portrait.mp4') : v.src;
    const poster = builtIn ? src.replace(/\.mp4$/, '-poster.jpg') : images[0];
    if (reduce) return <img aria-hidden="true" src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />;
    return <video key={src} aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" src={src} poster={poster} autoPlay muted loop playsInline preload="auto" />;
  }
  if (v.kind === 'youtube') {
    return (
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <iframe title="" tabIndex={-1} src={`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&mute=1&loop=1&playlist=${v.id}&controls=0&modestbranding=1&playsinline=1&rel=0`} allow="autoplay; encrypted-media" className="absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2 border-0" />
      </div>
    );
  }
  if (!images.length) return null;
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <AnimatePresence initial={false}>
        <motion.div key={images[i]} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.2 }}>
          <img src={images[i]} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl" />
          <img src={images[i]} alt="" {...{ fetchpriority: i === 0 ? 'high' : 'auto' }} className="absolute inset-0 h-full w-full object-contain" />
        </motion.div>
      </AnimatePresence>
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 sm:bottom-5">
          {images.map((src, j) => <span key={src + j} className={`h-1.5 rounded-full transition-all ${j === i ? 'w-6 bg-white' : 'w-1.5 bg-white/45'}`} />)}
        </div>
      )}
    </div>
  );
}
