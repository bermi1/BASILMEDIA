// Living hero: a particle sphere with two orbit rings that follows the pointer (canvas 2D, ~0 KB of assets).
// Static frame on reduced-motion or Save-Data so it never costs a slow phone anything.
import { useEffect, useRef } from 'react';

export function HeroOrb({ logo }: { logo: string }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = cv.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches || !!conn?.saveData;
    const pts: { x: number; y: number; z: number; k: number }[] = [];
    const N = innerWidth < 640 ? 380 : 700;
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = i * 2.399963;
      pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r, k: 0 });
    }
    for (let ring = 0; ring < 2; ring++) {
      for (let i = 0; i < 220; i++) {
        const a = (i / 220) * Math.PI * 2;
        const R = ring ? 1.55 : 1.3;
        const tA = ring ? 1.1 : -0.5;
        const z0 = Math.sin(a) * R;
        pts.push({ x: Math.cos(a) * R, y: z0 * Math.sin(tA), z: z0 * Math.cos(tA), k: ring + 1 });
      }
    }
    let t = 0, sx = 0, sy = 0, raf = 0;
    const frame = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      t += 0.004;
      sx += (pointer.current.x - sx) * 0.05;
      sy += (pointer.current.y - sy) * 0.05;
      const ry = t + sx * 1.4, rx = 0.25 + sy * 0.9;
      const cy = Math.cos(ry), sY = Math.sin(ry), cx = Math.cos(rx), sX = Math.sin(rx);
      const S = Math.min(w, h) * 0.3;
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, S * 1.8);
      g.addColorStop(0, 'rgba(15,110,194,0.45)');
      g.addColorStop(1, 'rgba(15,110,194,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (const p of pts) {
        const x = p.x * cy - p.z * sY;
        let z = p.x * sY + p.z * cy;
        const y = p.y * cx - z * sX;
        z = p.y * sX + z * cx;
        const f = 3 / (3 + z);
        const depth = (1 - z) / 2;
        const a = p.k ? 0.35 + depth * 0.65 : 0.12 + depth * 0.55;
        ctx.fillStyle = p.k === 2 ? `rgba(124,192,245,${a})` : `rgba(255,255,255,${a})`;
        ctx.beginPath();
        ctx.arc(w / 2 + x * S * f, h / 2 + y * S * f, (p.k ? 1.9 : 1.3) * f, 0, 6.283);
        ctx.fill();
      }
      if (!still) raf = requestAnimationFrame(frame);
    };
    frame();
    const io = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      if (e.isIntersecting && !still) raf = requestAnimationFrame(frame);
    });
    io.observe(canvas);
    return () => (cancelAnimationFrame(raf), io.disconnect());
  }, []);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        pointer.current = { x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 };
      }}
    >
      <canvas ref={cv} aria-hidden="true" className="absolute inset-0 h-full w-full" />
      <img src={logo} alt="" className="relative h-[120px] w-[120px] animate-float sm:h-[150px] sm:w-[150px]" style={{ filter: 'drop-shadow(0 0 60px rgba(124,192,245,0.75))' }} />
    </div>
  );
}
