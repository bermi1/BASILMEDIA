// Small sky-blue dot with a trailing ring that grows over links and buttons. Desktop only.
import { useEffect, useRef } from 'react';

export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.body.classList.add('bm-cursor-on');
    let x = -100, y = -100, rx = -100, ry = -100, big = false, raf = 0;
    const move = (e: PointerEvent) => {
      x = e.clientX; y = e.clientY;
      big = !!(e.target as Element)?.closest?.('a, button, [role="tab"], label');
    };
    const loop = () => {
      rx += (x - rx) * 0.18; ry += (y - ry) * 0.18;
      if (dot.current) dot.current.style.transform = `translate(${x - 4}px, ${y - 4}px)`;
      if (ring.current) ring.current.style.transform = `translate(${rx - 18}px, ${ry - 18}px) scale(${big ? 1.6 : 1})`;
      raf = requestAnimationFrame(loop);
    };
    addEventListener('pointermove', move);
    raf = requestAnimationFrame(loop);
    return () => {
      document.body.classList.remove('bm-cursor-on');
      removeEventListener('pointermove', move);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <>
      <div ref={ring} aria-hidden="true" className="pointer-events-none fixed left-0 top-0 z-[100] hidden h-9 w-9 rounded-full border-2 border-basil-soft/70 transition-[width,height] duration-200 [@media(hover:hover)_and_(pointer:fine)]:block" />
      <div ref={dot} aria-hidden="true" className="pointer-events-none fixed left-0 top-0 z-[100] hidden h-2 w-2 rounded-full bg-basil-soft [@media(hover:hover)_and_(pointer:fine)]:block" />
    </>
  );
}
