import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRows } from '@/hooks/useData';
import { useSeo } from '@/hooks/useSeo';
import { useI18n } from '@/lib/i18n';
import { videoOrientation, youtubeThumb } from '@/lib/video';
import { useMeasuredShapes } from '@/lib/videoShape';
import { PageHero } from '@/components/PageHero';
import { WatchMore } from '@/components/WorkVideos';
import { JustifiedRows, type GlanceItem } from './Home';

// A short, curated portfolio: Videos and Photos (Pixieset galleries). Videos keep their real shape —
// portrait films stay tall, landscape films stay wide — in balanced rows. The full archive is on Instagram/YouTube.
export default function OurWork() {
  const { t } = useI18n();
  useSeo('Our Work', 'Films and photo galleries by Basil Media. Watch more on Instagram and YouTube.');
  const { rows } = useRows('projects_public', { publishedOnly: true });
  const measured = useMeasuredShapes(rows.map((p) => p.video_url));
  const isPhoto = (p: (typeof rows)[number]) => p.category === 'Photo Stories' || /pixieset\.com/i.test(p.external_url ?? '');
  const toItem = (p: (typeof rows)[number]): GlanceItem => {
    const o = (p as { orientation?: string }).orientation;
    return {
      id: p.id, title: p.title, url: isPhoto(p) ? '' : p.video_url, link: p.external_url, poster: p.image_url || youtubeThumb(p.video_url),
      sub: isPhoto(p) ? 'Photo gallery' : p.category,
      shape: isPhoto(p) ? 'landscape' : o === 'portrait' || o === 'landscape' ? o : measured[p.video_url] ?? videoOrientation(p.video_url),
    };
  };
  const videos = rows.filter((p) => !isPhoto(p) && p.video_url).map(toItem);
  const photos = rows.filter(isPhoto).map(toItem);
  const tabs = [['Videos', videos], ['Photos', photos]] as const;
  const [tab, setTab] = useState<'Videos' | 'Photos'>('Videos');
  const list = (tab === 'Videos' ? videos : photos).slice(0, 12);

  return (
    <>
      <PageHero kicker={t('ourWork').toUpperCase()} title={<>Every frame, <span className="text-glow">on purpose.</span></>} />
      <section className="container-bm max-w-[1240px] pb-14 pt-6 sm:pb-20 sm:pt-10">
        <div role="tablist" aria-label="Work type" className="mx-auto mb-6 flex w-fit rounded-full bg-basil-mist p-1 sm:mb-8">
          {tabs.map(([k, items]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} disabled={!items.length} className={`relative h-10 rounded-full border-0 bg-transparent px-6 text-[14px] font-semibold disabled:opacity-40 ${tab === k ? 'text-white' : 'text-basil-deep'}`}>
              {tab === k && <motion.span layoutId="work-tab" className="absolute inset-0 rounded-full bg-basil" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <span className="relative">{k} <span className="opacity-70">{items.length}</span></span>
            </button>
          ))}
        </div>
        {list.length ? <JustifiedRows key={tab} items={list} keepAll /> : <p className="py-16 text-center text-basil-muted">New work is added every month.</p>}
        <WatchMore />
      </section>
    </>
  );
}
