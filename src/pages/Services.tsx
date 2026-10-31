import { Link } from 'react-router-dom';
import { useRows } from '@/hooks/useData';
import { useSeo } from '@/hooks/useSeo';
import { useI18n } from '@/lib/i18n';
import { VideoEmbed } from '@/components/VideoEmbed';
import { Media } from '@/components/Media';
import { Reveal } from '@/components/Reveal';
import { youtubeThumb } from '@/lib/video';

export default function Services() {
  const { t } = useI18n();
  useSeo('Services', 'Video production, photography, podcasts, live streaming, brand storytelling and corporate content from Dar es Salaam.');
  const { rows } = useRows('services', { publishedOnly: true });
  return (
    <>
      <section className="text-white" style={{ background: 'linear-gradient(160deg, #0A2F5C, #061E3D)' }}>
        <div className="container-bm py-14 sm:py-[72px]">
          <div className="font-mono text-xs tracking-[0.2em] text-basil-haze">{t('services').toUpperCase()}</div>
          <h1 className="mb-3 mt-2.5 text-[clamp(40px,5vw,64px)] font-extrabold leading-[1.02]">One team, from brief <span className="text-basil-sky">to final cut.</span></h1>
          <p className="m-0 max-w-[620px] text-lg text-basil-frost">Six services, one crew, one invoice — and a client portal where you approve every step.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {rows.map((s) => (
              <a key={s.id} href={`#${s.slug}`} className="rounded-full border border-white/35 px-4 py-2.5 text-sm text-white no-underline hover:bg-white/10 hover:text-white">{s.title}</a>
            ))}
          </div>
        </div>
      </section>
      <div className="container-bm flex flex-col gap-7 pb-20 pt-10">
        {rows.map((s, i) => (
          <section key={s.id} id={s.slug} className={`flex scroll-mt-28 flex-wrap items-center gap-9 border-b border-[#E3EDF8] py-7 ${i % 2 ? 'flex-row-reverse' : ''}`}>
            <Reveal className="min-w-0 flex-[1_1_460px]">
              <div className="overflow-hidden rounded-[26px] shadow-[0_24px_50px_rgba(10,47,92,0.16)]">
                {s.video_url ? (
                  <VideoEmbed url={s.video_url} title={s.title} poster={s.image_url || youtubeThumb(s.video_url)} />
                ) : (
                  <Media src={s.image_url} index={i} overlay={false} className="aspect-video" />
                )}
              </div>
            </Reveal>
            <Reveal delay={0.08} className="flex min-w-0 flex-[1_1_400px] flex-col gap-3.5">
              <span className="font-display font-extrabold text-basil">{String(i + 1).padStart(2, '0')}</span>
              <h2 className="m-0 text-[34px] font-extrabold">{s.title}</h2>
              <p className="m-0 text-[17px] leading-relaxed text-basil-muted">{s.description}</p>
              <div className="flex flex-wrap gap-2">
                {s.deliverables.map((d) => <span key={d} className="rounded-full bg-basil-ice px-3.5 py-2 text-sm font-medium text-basil-deep">{d}</span>)}
              </div>
              <Link to="/#book" className="btn-primary mt-1.5 self-start">Book {s.title}</Link>
            </Reveal>
          </section>
        ))}
      </div>
    </>
  );
}
