import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ExternalLink, Images, X } from 'lucide-react';
import { useRows } from '@/hooks/useData';
import { useSeo } from '@/hooks/useSeo';
import { useI18n } from '@/lib/i18n';
import { WORK_CATEGORIES } from '@/lib/types';
import { parseVideo, videoLabel, youtubeThumb } from '@/lib/video';
import { Media } from '@/components/Media';
import { VideoEmbed } from '@/components/VideoEmbed';
import { Play } from '@/components/icons';
import { PageHero } from '@/components/PageHero';
import { useCover } from '@/lib/useCover';

const isPixieset = (u?: string) => !!u && /pixieset\.com/i.test(u);
const isNew = (d?: string) => !!d && Date.now() - new Date(d).getTime() < 7 * 864e5;

export default function OurWork() {
  const { t } = useI18n();
  useSeo('Our Work', 'Films, reels, photo stories, podcasts and corporate work by Basil Media.');
  const { rows } = useRows('projects_public', { publishedOnly: true });
  const [params, setParams] = useSearchParams();
  const filter = params.get('c') ?? '';
  const openId = params.get('p');
  const items = useMemo(() => rows.filter((p) => !filter || p.category === filter), [rows, filter]);
  const cur = rows.find((p) => p.id === openId);
  const curIndex = rows.findIndex((p) => p.id === openId);
  const spotlight = rows.find((p) => p.featured && (p.image_url || p.video_url)) ?? rows[0];
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
      <PageHero kicker={`${t('ourWork').toUpperCase()} · ${rows.length} STORIES`} title={<>Every frame, <span className="text-glow">on purpose.</span></>} sub="Films, reels, photo stories and podcasts — pick a category." />

      {/* Underline tab filter — scrolls sideways on phones, sticks under the header */}
      <div className="sticky top-[76px] z-20 border-b border-basil-line bg-white/92 backdrop-blur-xl sm:top-[92px]">
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

      <section className="relative">
      <div aria-hidden="true" className="bg-dots fade-mask pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-80" />
      <div className="container-bm relative pb-12 pt-4 sm:pb-20 sm:pt-6">
        {!filter && spotlight && (
          <motion.button type="button" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} onClick={() => setQ({ p: spotlight.id })} className="group relative mb-8 block aspect-[4/5] w-full overflow-hidden rounded-[26px] border-0 p-0 text-left shadow-[0_30px_80px_-24px_rgba(10,47,92,0.55)] sm:mb-12 sm:aspect-[21/9]">
            <Media src={spotlight.image_url || youtubeThumb(spotlight.video_url)} index={0} className="flex h-full flex-col justify-end p-5 text-white sm:p-10">
              <span className="relative mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] backdrop-blur"><span className="h-1.5 w-1.5 rounded-full bg-sun shadow-[0_0_10px_#F5B942]" />Spotlight</span>
              <b className="relative max-w-[720px] font-display text-[22px] font-bold leading-tight sm:text-[40px]">{spotlight.title}</b>
              <span className="relative mt-1 text-[13px] text-basil-frost sm:text-base">{[spotlight.category, spotlight.client].filter(Boolean).join(' · ')}</span>
              <span className="relative mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[13px] font-semibold text-basil transition group-hover:shadow-[0_0_30px_rgba(124,192,245,0.7)]"><Play size={14} />{spotlight.video_url ? 'Watch the story' : 'Open the story'}</span>
            </Media>
          </motion.button>
        )}
        {filter ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {items.map((p) => <Card key={p.id} p={p} index={rows.indexOf(p)} onOpen={() => setQ({ p: p.id })} />)}
          </div>
        ) : (
          <div className="flex flex-col gap-8 sm:gap-12">
            {WORK_CATEGORIES.map((c) => {
              const list = rows.filter((p) => p.category === c);
              if (!list.length) return null;
              return (
                <section key={c} aria-label={c}>
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <h2 className="m-0 font-display text-[17px] font-bold sm:text-[22px]">{c} <span className="text-[13px] font-bold text-basil-muted">{list.length}</span></h2>
                    <button type="button" onClick={() => setQ({ c })} className="flex items-center gap-1 border-0 bg-transparent p-0 text-sm font-bold text-basil">See all <ArrowRight size={15} /></button>
                  </div>
                  <div className="snap-row">
                    {list.map((p) => <div key={p.id} className="w-[44vw] max-w-[260px] shrink-0 snap-start sm:w-[260px]"><Card p={p} index={rows.indexOf(p)} onOpen={() => setQ({ p: p.id })} /></div>)}
                  </div>
                </section>
              );
            })}
          </div>
        )}
        {!items.length && <p className="text-basil-muted">No projects in this category yet.</p>}
      </div>
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

function Card({ p, index, onOpen }: { p: { title: string; category: string; client: string; image_url: string; video_url: string; external_url: string; created_at?: string }; index: number; onOpen: () => void }) {
  const src = videoLabel(p.video_url);
  const cover = useCover(p.external_url, p.image_url || youtubeThumb(p.video_url));
  return (
    <button type="button" onClick={onOpen} className="group relative block aspect-[4/5] w-full overflow-hidden rounded-[18px] border-0 p-0 text-left shadow-card ring-1 ring-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-14px_rgba(15,110,194,0.55)] hover:ring-basil-sky/60 sm:rounded-[22px]">
      <Media src={cover} index={index} className="flex h-full flex-col justify-end gap-1 p-3 text-white sm:p-5">
        {!cover && isPixieset(p.external_url) && <span aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-white/85"><Images size={30} /><span className="text-[10px] font-bold uppercase tracking-[0.18em]">Photo gallery</span></span>}
        <span className="absolute left-2.5 top-2.5 flex gap-1 sm:left-4 sm:top-4">
          {src && <span className="rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-extrabold text-basil sm:text-xs">{src}</span>}
          {isNew(p.created_at) && <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-extrabold text-white sm:text-xs">New</span>}
          {isPixieset(p.external_url) && <span className="rounded-full bg-sun px-2 py-0.5 text-[10px] font-extrabold text-basil-night sm:text-xs">Gallery</span>}
        </span>
        {p.video_url && <span className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 transition group-hover:scale-110 sm:right-4 sm:top-4 sm:h-11 sm:w-11"><Play size={15} /></span>}
        <span className="relative line-clamp-1 text-[11px] text-basil-frost sm:text-xs">{[p.category, p.client].filter(Boolean).join(' · ')}</span>
        <b className="relative line-clamp-3 font-display text-[14px] leading-tight sm:text-[17px]">{p.title}</b>
      </Media>
    </button>
  );
}
