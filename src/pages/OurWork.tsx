import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ExternalLink, X } from 'lucide-react';
import { useRows } from '@/hooks/useData';
import { useSeo } from '@/hooks/useSeo';
import { useI18n } from '@/lib/i18n';
import { WORK_CATEGORIES } from '@/lib/types';
import { videoLabel, youtubeThumb } from '@/lib/video';
import { Media } from '@/components/Media';
import { VideoEmbed } from '@/components/VideoEmbed';

export default function OurWork() {
  const { t } = useI18n();
  useSeo('Our Work', 'Films, documentaries, photo stories, podcasts and corporate work by Basil Media.');
  const { rows } = useRows('projects_public', { publishedOnly: true });
  const [params, setParams] = useSearchParams();
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

  return (
    <>
      <section className="container-bm pb-4 pt-8 sm:pb-6 sm:pt-14">
        <div className="kicker tracking-[0.2em]">{t('ourWork').toUpperCase()}</div>
        <h1 className="mb-4 mt-1.5 text-[clamp(30px,5vw,60px)] font-extrabold leading-tight sm:mb-[22px]">Every frame, on purpose.</h1>
        <div role="tablist" aria-label="Filter projects" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {['', ...WORK_CATEGORIES].map((c) => {
            const on = c === filter;
            return (
              <button key={c || 'all'} type="button" role="tab" aria-selected={on} onClick={() => setQ({ c: c || null })} className={`relative h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition sm:h-11 sm:px-[18px] sm:text-[15px] ${on ? 'border-0 text-white' : 'border border-basil-edge bg-white text-basil-deep hover:border-basil'}`}>
                {on && <motion.span layoutId="work-pill" className="absolute inset-0 rounded-full bg-basil" transition={{ type: 'spring', duration: 0.4 }} />}
                <span className="relative">{c || t('all')}</span>
              </button>
            );
          })}
        </div>
      </section>
      <section className="container-bm pb-12 pt-2 sm:pb-20">
        <motion.div layout className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] sm:gap-4">
          <AnimatePresence mode="popLayout">
            {items.map((p) => (
              <motion.button layout key={p.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} type="button" onClick={() => setQ({ p: p.id })} className="group block h-[210px] overflow-hidden rounded-[20px] border-0 p-0 text-left shadow-card sm:h-[300px] sm:rounded-3xl">
                <Media src={p.image_url || youtubeThumb(p.video_url)} index={rows.indexOf(p)} className="flex h-full flex-col justify-end gap-1 p-3 text-white sm:gap-1.5 sm:p-[22px]">
                  {p.video_url && <span className="absolute right-2.5 top-2.5 rounded-full bg-white px-2 py-1 text-[10px] font-extrabold text-basil sm:right-4 sm:top-4 sm:px-3 sm:py-1.5 sm:text-xs">▶ {videoLabel(p.video_url) || 'Video'}</span>}
                  <span className="relative line-clamp-1 text-[11px] text-basil-frost sm:text-xs">{[p.category, p.client].filter(Boolean).join(" · ")}</span>
                  <b className="relative line-clamp-3 font-display text-[14px] leading-tight sm:text-[22px]">{p.title}</b>
                </Media>
              </motion.button>
            ))}
          </AnimatePresence>
        </motion.div>
        {!items.length && <p className="text-basil-muted">No projects in this category yet.</p>}
      </section>

      <AnimatePresence>
        {cur && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setQ({ p: null })} className="fixed inset-0 z-50 flex items-center justify-center bg-basil-night/75 p-3 backdrop-blur-md sm:p-6">
            <motion.div role="dialog" aria-modal="true" aria-label={cur.title} initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96 }} onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-[980px] overflow-auto rounded-[28px] bg-white shadow-[0_40px_100px_rgba(0,0,0,0.4)]">
              <div className="relative">
                {cur.video_url ? (
                  <VideoEmbed url={cur.video_url} title={cur.title} poster={cur.image_url || youtubeThumb(cur.video_url)} />
                ) : (
                  <Media src={cur.image_url} index={curIndex} overlay={false} className="aspect-video" />
                )}
                <button type="button" onClick={() => setQ({ p: null })} aria-label="Close" className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border-0 bg-basil-night/60 text-white"><X /></button>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-4 px-5 pb-6 pt-5 sm:gap-5 sm:px-7 sm:pb-7 sm:pt-6">
                <div className="min-w-0 flex-[1_1_420px]">
                  <div className="text-[13px] font-bold text-basil">{[cur.category, cur.client].filter(Boolean).join(" · ")}</div>
                  <h2 className="mb-2 mt-1 text-[22px] font-extrabold leading-tight sm:text-[28px]">{cur.title}</h2>
                  <p className="m-0 whitespace-pre-line leading-relaxed text-basil-muted">{cur.description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {cur.external_url && <a href={cur.external_url} target="_blank" rel="noreferrer" className="btn-outline"><ExternalLink size={16} /> Visit</a>}
                  <Link to="/#book" className="btn-primary">{t('needLike')}</Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
