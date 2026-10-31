import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ExternalLink, GalleryHorizontalEnd, Images, LayoutGrid, X } from 'lucide-react';
import { useRows } from '@/hooks/useData';
import { useSeo } from '@/hooks/useSeo';
import { useI18n } from '@/lib/i18n';
import { WORK_CATEGORIES } from '@/lib/types';
import { parseVideo, videoLabel, youtubeThumb } from '@/lib/video';
import { Media } from '@/components/Media';
import { VideoEmbed } from '@/components/VideoEmbed';
import { Play } from '@/components/icons';

const isPixieset = (u?: string) => !!u && /pixieset\.com/i.test(u);

export default function OurWork() {
  const { t } = useI18n();
  useSeo('Our Work', 'Films, reels, photo stories, podcasts and corporate work by Basil Media.');
  const { rows } = useRows('projects_public', { publishedOnly: true });
  const [params, setParams] = useSearchParams();
  const [layout, setLayout] = useState<'grid' | 'swipe'>('grid');
  const filter = params.get('c') ?? '';
  const openId = params.get('p');
  const items = useMemo(() => rows.filter((p) => !filter || p.category === filter), [rows, filter]);
  const cur = rows.find((p) => p.id === openId);
  const curIndex = rows.findIndex((p) => p.id === openId);
  const setQ = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };
  useEffect(() => {
    document.body.style.overflow = cur ? 'hidden' : '';
    return () => void (document.body.style.overflow = '');
  }, [cur]);
  const cats = ['', ...WORK_CATEGORIES];
  const vertical = cur ? parseVideo(cur.video_url).kind === 'instagram' : false;

  return (
    <>
      <section className="container-bm pt-7 sm:pt-12">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="kicker tracking-[0.2em]">{t('ourWork').toUpperCase()} · {rows.length}</div>
            <h1 className="m-0 mt-1 text-[clamp(30px,5vw,60px)] font-extrabold leading-[1.04] tracking-[-0.02em]">Every frame, <span className="text-basil">on purpose.</span></h1>
          </div>
          <div role="group" aria-label="Layout" className="flex shrink-0 rounded-xl bg-basil-mist p-1">
            <button type="button" aria-label="Grid" aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')} className={`flex h-9 w-9 items-center justify-center rounded-lg border-0 ${layout === 'grid' ? 'bg-white text-basil shadow-sm' : 'bg-transparent text-basil-muted'}`}><LayoutGrid size={17} /></button>
            <button type="button" aria-label="Swipe" aria-pressed={layout === 'swipe'} onClick={() => setLayout('swipe')} className={`flex h-9 w-9 items-center justify-center rounded-lg border-0 ${layout === 'swipe' ? 'bg-white text-basil shadow-sm' : 'bg-transparent text-basil-muted'}`}><GalleryHorizontalEnd size={17} /></button>
          </div>
        </div>
      </section>

      {/* Underline tab filter — scrolls sideways on phones, sticks under the header */}
      <div className="sticky top-[56px] z-20 mt-4 border-b border-basil-line bg-white/92 backdrop-blur-xl sm:top-[88px] sm:mt-6">
        <div role="tablist" aria-label="Filter projects" className="container-bm scrollbar-none flex gap-5 overflow-x-auto sm:gap-8">
          {cats.map((c) => {
            const on = c === filter;
            const n = c ? rows.filter((p) => p.category === c).length : rows.length;
            return (
              <button key={c || 'all'} type="button" role="tab" aria-selected={on} onClick={() => setQ({ c: c || null })} className={`relative flex h-12 shrink-0 items-center gap-1.5 border-0 bg-transparent px-0 text-[14.5px] font-semibold transition sm:h-14 sm:text-[15px] ${on ? 'text-basil-ink' : 'text-basil-muted hover:text-basil-ink'}`}>
                {c || t('all')}
                <span className={`rounded-full px-1.5 text-[11px] font-bold ${on ? 'bg-basil text-white' : 'bg-basil-mist text-basil-muted'}`}>{n}</span>
                {on && <motion.span layoutId="work-underline" className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-basil" />}
              </button>
            );
          })}
        </div>
      </div>

      <section className="container-bm pb-12 pt-4 sm:pb-20 sm:pt-6">
        {layout === 'grid' ? (
          <motion.div layout className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {items.map((p, i) => (
                <motion.div layout key={p.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className={i % 5 === 0 ? 'row-span-2' : ''}>
                  <Card p={p} index={rows.indexOf(p)} tall={i % 5 === 0} onOpen={() => setQ({ p: p.id })} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="snap-row pb-2">
            {items.map((p) => (
              <div key={p.id} className="w-[78vw] max-w-[360px] shrink-0 snap-center sm:w-[320px]">
                <Card p={p} index={rows.indexOf(p)} tall onOpen={() => setQ({ p: p.id })} />
              </div>
            ))}
          </div>
        )}
        {!items.length && <p className="text-basil-muted">No projects in this category yet.</p>}
      </section>

      <AnimatePresence>
        {cur && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setQ({ p: null })} className="fixed inset-0 z-50 flex items-end justify-center bg-basil-night/80 backdrop-blur-md sm:items-center sm:p-6">
            <motion.div role="dialog" aria-modal="true" aria-label={cur.title} initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={(e) => e.stopPropagation()} className={`max-h-[94vh] w-full overflow-auto rounded-t-[28px] bg-white shadow-[0_40px_100px_rgba(0,0,0,0.4)] sm:rounded-[28px] ${vertical ? 'sm:max-w-[820px]' : 'sm:max-w-[980px]'}`}>
              <div className={vertical ? 'sm:grid sm:grid-cols-[minmax(0,380px)_1fr]' : ''}>
                <div className="relative bg-basil-night">
                  {cur.video_url ? (
                    <VideoEmbed url={cur.video_url} title={cur.title} poster={cur.image_url || youtubeThumb(cur.video_url)} aspect={vertical ? '9 / 16' : '16 / 9'} className={vertical ? 'mx-auto max-h-[70vh] max-w-[400px]' : ''} />
                  ) : (
                    <Media src={cur.image_url} index={curIndex} overlay={false} className="aspect-video" />
                  )}
                  <button type="button" onClick={() => setQ({ p: null })} aria-label="Close" className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border-0 bg-basil-night/60 text-white"><X /></button>
                </div>
                <div className="flex flex-col gap-3 p-5 sm:p-7">
                  <div className="flex flex-wrap gap-1.5 text-xs font-bold"><span className="rounded-full bg-basil-ice px-2.5 py-1 text-basil-deep">{cur.category}</span>{cur.client && <span className="rounded-full bg-basil-mist px-2.5 py-1 text-basil-muted">{cur.client}</span>}</div>
                  <h2 className="m-0 text-[22px] font-extrabold leading-tight sm:text-[28px]">{cur.title}</h2>
                  <p className="m-0 whitespace-pre-line leading-relaxed text-basil-muted">{cur.description}</p>
                  <div className="mt-auto grid grid-cols-1 gap-2 pt-2 sm:flex sm:flex-wrap">
                    {cur.external_url && <a href={cur.external_url} target="_blank" rel="noreferrer" className="btn-outline h-12">{isPixieset(cur.external_url) ? <Images size={16} /> : <ExternalLink size={16} />}{isPixieset(cur.external_url) ? 'View the full gallery' : 'Open link'}</a>}
                    <Link to="/#book" className="btn-primary h-12">{t('needLike')}</Link>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Card({ p, index, tall, onOpen }: { p: { title: string; category: string; client: string; image_url: string; video_url: string; external_url: string }; index: number; tall?: boolean; onOpen: () => void }) {
  const src = videoLabel(p.video_url);
  return (
    <button type="button" onClick={onOpen} className={`group relative block w-full overflow-hidden rounded-[18px] border-0 p-0 text-left shadow-card sm:rounded-[24px] ${tall ? 'h-[300px] sm:h-[460px]' : 'h-[146px] sm:h-[222px]'}`}>
      <Media src={p.image_url || youtubeThumb(p.video_url)} index={index} className="flex h-full flex-col justify-end gap-1 p-3 text-white sm:p-5">
        <span className="absolute left-2.5 top-2.5 flex gap-1 sm:left-4 sm:top-4">
          {src && <span className="rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-extrabold text-basil sm:text-xs">{src}</span>}
          {isPixieset(p.external_url) && <span className="rounded-full bg-sun px-2 py-0.5 text-[10px] font-extrabold text-basil-night sm:text-xs">Gallery</span>}
        </span>
        {p.video_url && <span className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 transition group-hover:scale-110 sm:right-4 sm:top-4 sm:h-11 sm:w-11"><Play size={15} /></span>}
        <span className="relative line-clamp-1 text-[11px] text-basil-frost sm:text-xs">{[p.category, p.client].filter(Boolean).join(' · ')}</span>
        <b className={`relative line-clamp-3 font-display leading-tight ${tall ? 'text-[17px] sm:text-2xl' : 'text-[13px] sm:text-[17px]'}`}>{p.title}</b>
      </Media>
    </button>
  );
}
