// Pop-up player for a film or photo gallery: the piece plays large (portrait films stay tall), with its
// category, title, client and description beside it, and a short "want something like this?" booking form.
// ← / → move through the list, Esc or the backdrop closes it. Used by Our Work and the landing page.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Camera, ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react';
import { useCover } from '@/lib/useCover';
import { VideoEmbed } from './VideoEmbed';
import { BookingForm } from './BookingForm';
import type { Orientation } from '@/lib/video';

export type WorkPiece = { id: string; title: string; url: string; link?: string; poster: string; sub: string; shape: Orientation; desc?: string; client?: string };

export function WorkPlayer({ items, index, onIndex, onClose }: { items: WorkPiece[]; index: number | null; onIndex: (i: number) => void; onClose: () => void }) {
  const open = index !== null && !!items[index];
  useEffect(() => {
    if (!open) return;
    const n = items.length;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.target as HTMLElement)?.closest?.('input, textarea')) return;
      if (e.key === 'ArrowRight') onIndex(((index ?? 0) + 1) % n);
      if (e.key === 'ArrowLeft') onIndex(((index ?? 0) - 1 + n) % n);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    addEventListener('keydown', key);
    return () => { removeEventListener('keydown', key); document.body.style.overflow = prev; };
  }, [open, index, items.length, onClose, onIndex]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key="work-player" role="dialog" aria-modal="true" aria-label={items[index!].title}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
          className="on-dark fixed inset-0 z-[90] overflow-y-auto bg-[#030C1A]/90 backdrop-blur-xl" onClick={(e) => e.target === e.currentTarget && onClose()}>
          <Piece key={items[index!].id} item={items[index!]} many={items.length > 1}
            onPrev={() => onIndex((index! - 1 + items.length) % items.length)} onNext={() => onIndex((index! + 1) % items.length)} onClose={onClose} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Piece({ item, many, onPrev, onNext, onClose }: { item: WorkPiece; many: boolean; onPrev: () => void; onNext: () => void; onClose: () => void }) {
  const poster = useCover(item.link, item.poster);
  const [book, setBook] = useState(false);
  const portrait = item.shape === 'portrait';
  const isVideo = !!item.url;
  const btn = 'flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-md transition hover:bg-white hover:text-basil-night';
  return (
    <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto flex min-h-full w-full max-w-[1180px] flex-col justify-center gap-4 px-3 py-14 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center lg:gap-8 lg:py-10"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <button type="button" onClick={onClose} aria-label="Close" className={`${btn} fixed right-3 top-3 z-10 sm:right-5 sm:top-5`}><X size={20} /></button>

      {/* THE PIECE */}
      <div className="relative flex items-center justify-center">
        {isVideo ? (
          <div className={`overflow-hidden rounded-[20px] bg-black shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] ring-1 ring-white/10 ${portrait ? 'h-[min(78vh,760px)] aspect-[9/16] max-w-full [&>*]:h-full' : 'w-full'}`}>
            <VideoEmbed url={item.url} title={item.title} poster={poster} autoPlay aspect={portrait ? '9 / 16' : '16 / 9'} />
          </div>
        ) : (
          <a href={item.link} target="_blank" rel="noreferrer" className="group relative block w-full overflow-hidden rounded-[20px] ring-1 ring-white/10">
            {poster
              ? <img src={poster} alt={item.title} className="aspect-[16/10] w-full object-cover transition duration-700 group-hover:scale-[1.03]" />
              : <span className="flex aspect-[16/10] w-full items-center justify-center bg-basil-deep text-white/80"><Camera size={36} /></span>}
            <span className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-basil-night">Open the gallery <ExternalLink size={14} /></span>
          </a>
        )}
        {many && (
          <>
            <button type="button" onClick={onPrev} aria-label="Previous" className={`${btn} absolute left-1 top-1/2 -translate-y-1/2 sm:-left-2 lg:-left-6`}><ChevronLeft size={20} /></button>
            <button type="button" onClick={onNext} aria-label="Next" className={`${btn} absolute right-1 top-1/2 -translate-y-1/2 sm:-right-2 lg:-right-6`}><ChevronRight size={20} /></button>
          </>
        )}
      </div>

      {/* ABOUT IT + BOOK */}
      <aside className="flex flex-col gap-3 text-white">
        <span className="w-fit rounded-full border border-basil-sky/40 bg-basil-sky/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-basil-sky">{item.sub}</span>
        <h2 className="m-0 font-display text-[22px] font-bold leading-tight sm:text-[26px]">{item.title}</h2>
        {item.client && <p className="m-0 text-[13px] text-white/60">For {item.client}</p>}
        <p className="m-0 text-[14.5px] leading-relaxed text-white/80">
          {item.desc || (isVideo ? 'Filmed, edited and delivered by the Basil Media crew in Dar es Salaam.' : 'Photographed and delivered by Basil Media as a private online gallery.')}
        </p>
        <AnimatePresence mode="wait" initial={false}>
          {book ? (
            <motion.div key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <BookingForm interest={{ title: item.title, category: item.sub }} />
            </motion.div>
          ) : (
            <motion.div key="cta" className="mt-1 flex flex-wrap gap-2" exit={{ opacity: 0 }}>
              <button type="button" onClick={() => setBook(true)} className="flex h-11 items-center gap-1.5 rounded-full border-0 bg-white px-5 text-[14px] font-semibold text-basil-night shadow-[0_0_30px_rgba(124,192,245,0.45)] transition hover:scale-[1.03]">Book something like this <ArrowRight size={16} /></button>
              {!isVideo && item.link && <a href={item.link} target="_blank" rel="noreferrer" className="flex h-11 items-center gap-1.5 rounded-full border border-white/25 px-4 text-[14px] font-semibold text-white no-underline hover:bg-white/10 hover:text-white">View photos <ExternalLink size={14} /></a>}
            </motion.div>
          )}
        </AnimatePresence>
      </aside>
    </motion.div>
  );
}
