// Small touches that make the site respond to the visitor: a reading-progress line under the header,
// and cards that light up (and tilt slightly, on a computer) where the pointer is.
import { useEffect } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.3 });
  return <motion.div aria-hidden="true" style={{ scaleX }} className="fixed inset-x-0 top-0 z-[70] h-[3px] origin-left bg-gradient-to-r from-basil-sky via-basil to-sun" />;
}

/** One listener for the whole page: sets --mx/--my (spotlight) and --rx/--ry (tilt) on the card under the pointer. */
export function useCardSpotlight() {
  useEffect(() => {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let last: HTMLElement | null = null;
    const move = (e: PointerEvent) => {
      const card = (e.target as Element)?.closest?.('.glow-card') as HTMLElement | null;
      if (last && last !== card) { last.style.removeProperty('--rx'); last.style.removeProperty('--ry'); }
      last = card;
      if (!card) return;
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
      if (!still && card.dataset.tilt !== undefined) {
        card.style.setProperty('--rx', `${(0.5 - py) * 6}deg`);
        card.style.setProperty('--ry', `${(px - 0.5) * 8}deg`);
      }
    };
    addEventListener('pointermove', move, { passive: true });
    return () => removeEventListener('pointermove', move);
  }, []);
}
