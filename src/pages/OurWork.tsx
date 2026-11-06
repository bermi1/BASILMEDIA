import { useSeo } from '@/hooks/useSeo';
import { useRows } from '@/hooks/useData';
import { useI18n } from '@/lib/i18n';
import { PageHero } from '@/components/PageHero';
import { WatchMore, WorkGrid } from '@/components/WorkVideos';

// A short, curated showreel — a few films, no labels — with the full archive on Instagram and YouTube.
export default function OurWork() {
  const { t } = useI18n();
  useSeo('Our Work', 'A few films from Basil Media. Watch more on Instagram and YouTube.');
  const { rows } = useRows('projects_public', { publishedOnly: true });
  return (
    <>
      <PageHero kicker={t('ourWork').toUpperCase()} title={<>Every frame, <span className="text-glow">on purpose.</span></>} />
      <section className="container-bm max-w-[1180px] pb-14 pt-6 sm:pb-20 sm:pt-10">
        <WorkGrid items={rows} max={8} />
        <WatchMore />
      </section>
    </>
  );
}
