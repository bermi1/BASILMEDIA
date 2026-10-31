// The compact hero every inner page opens with: same family as the home hero, but short.
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

export function PageHero({ kicker, title, sub, image, children }: { kicker: string; title: ReactNode; sub?: ReactNode; image?: string; children?: ReactNode }) {
  return (
    <section className="grain relative isolate overflow-hidden text-white" style={{ background: 'radial-gradient(ellipse at 88% 0%, rgba(124,192,245,0.32), transparent 55%), radial-gradient(ellipse at 0% 100%, rgba(245,185,66,0.16), transparent 45%), linear-gradient(160deg, #0A2F5C, #061E3D)' }}>
      {image && <><img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-basil-night via-basil-night/75 to-basil-night/40" /></>}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="container-bm relative pb-6 pt-[86px] sm:pb-10 sm:pt-32">
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-basil-haze sm:text-[11px]"><span className="h-1.5 w-1.5 rounded-full bg-sun" />{kicker}</div>
        <h1 className="mb-0 mt-1.5 max-w-[760px] text-[clamp(23px,3.8vw,46px)] font-bold leading-[1.12] tracking-[-0.02em]">{title}</h1>
        {sub && <p className="m-0 mt-2 max-w-[520px] text-[13.5px] text-basil-frost sm:text-base">{sub}</p>}
        {children}
      </motion.div>
    </section>
  );
}
