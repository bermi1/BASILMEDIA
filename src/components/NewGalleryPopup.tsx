// Small pop-up announcing the newest photo gallery (published in the last 7 days), once per visitor.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Images, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCover } from '@/lib/useCover';

interface G { id: string; title: string; client: string; image_url: string; external_url: string }
const KEY = 'basil-gallery-seen';

export function NewGalleryPopup() {
  const [g, setG] = useState<G | null>(null);
  const cover = useCover(g?.external_url, g?.image_url ?? '');
  useEffect(() => {
    const t = setTimeout(() => {
      supabase.from('projects_public').select('id,title,client,image_url,external_url').eq('published', true).eq('category', 'Photo Stories')
        .like('external_url', '%pixieset.com%').gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString())
        .order('created_at', { ascending: false }).limit(1)
        .then(({ data }) => {
          const x = (data?.[0] ?? null) as G | null;
          let seen = '';
          try { seen = localStorage.getItem(KEY) ?? ''; } catch { /* private mode */ }
          if (x && x.id !== seen) setG(x);
        });
    }, 2500);
    return () => clearTimeout(t);
  }, []);
  const close = () => { try { if (g) localStorage.setItem(KEY, g.id); } catch { /* ignore */ } setG(null); };
  return (
    <AnimatePresence>
      {g && (
        <motion.aside role="dialog" aria-label="New photo gallery" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
          className="fixed bottom-[96px] left-3 right-3 z-[60] mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-basil-line bg-white p-2.5 pr-3 shadow-[0_18px_40px_rgba(10,47,92,0.25)] sm:bottom-6 sm:left-6 sm:right-auto">
          <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-basil-ice">
            {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <Images size={22} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-basil" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10.5px] font-bold uppercase tracking-wide text-basil">New photos</span>
            <b className="block truncate text-[14px] text-basil-ink">{g.title}</b>
            <a href={g.external_url} target="_blank" rel="noreferrer" onClick={close} className="text-[13px] font-bold">View photos →</a>
          </span>
          <button type="button" onClick={close} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-0 bg-basil-mist text-basil-deep"><X size={15} /></button>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
