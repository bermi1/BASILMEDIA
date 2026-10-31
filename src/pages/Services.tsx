import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Briefcase, Camera, Check, Mic, Radio, Sparkles, Video } from 'lucide-react';
import { useRows } from '@/hooks/useData';
import { useSeo } from '@/hooks/useSeo';
import { useI18n } from '@/lib/i18n';
import { VideoEmbed } from '@/components/VideoEmbed';
import { Media } from '@/components/Media';
import { Reveal } from '@/components/Reveal';
import { Sheet } from '@/os/ui';
import { youtubeThumb } from '@/lib/video';

const ICONS: Record<string, typeof Video> = { video: Video, camera: Camera, mic: Mic, radio: Radio, sparkles: Sparkles, briefcase: Briefcase };
const STEPS = [
  ['Brief', 'A short call to understand the moment, audience and budget.'],
  ['Plan', 'Quotation, crew, shot list and schedule — approved by you.'],
  ['Create', 'Shoot, edit and review rounds in your client portal.'],
  ['Deliver', 'Final files, galleries and reports, on time.'],
];

export default function Services() {
  const { t } = useI18n();
  useSeo('Services', 'Video production, photography, podcasts, live streaming, brand storytelling and corporate content from Dar es Salaam.');
  const { rows } = useRows('services', { publishedOnly: true });
  const { hash } = useLocation();
  const nav = useNavigate();
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => setOpen(hash ? hash.slice(1) : null), [hash]);
  const cur = rows.find((s) => s.slug === open);
  const close = () => (setOpen(null), nav('/services', { replace: true }));

  return (
    <>
      <section className="text-white" style={{ background: 'radial-gradient(ellipse at 90% 0%, rgba(124,192,245,0.3), transparent 55%), linear-gradient(160deg, #0A2F5C, #061E3D)' }}>
        <div className="container-bm py-9 sm:py-16">
          <div className="font-mono text-[11px] tracking-[0.2em] text-basil-haze sm:text-xs">{t('services').toUpperCase()}</div>
          <h1 className="mb-2 mt-2 text-[clamp(32px,5vw,60px)] font-extrabold leading-[1.04]">One team, from brief <span className="text-basil-sky">to final cut.</span></h1>
          <p className="m-0 max-w-[560px] text-[15px] text-basil-frost sm:text-lg">Six services, one crew, one invoice — and a client portal where you approve every step.</p>
        </div>
      </section>

      <section className="container-bm section">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
          {rows.map((s, i) => {
            const Icon = ICONS[s.icon] ?? Video;
            return (
              <Reveal key={s.id} delay={i * 0.04}>
                <motion.button whileTap={{ scale: 0.98 }} type="button" id={s.slug} onClick={() => nav(`/services#${s.slug}`, { replace: true })} className="group flex h-full w-full scroll-mt-24 flex-col overflow-hidden rounded-[20px] border border-basil-line bg-white p-0 text-left transition hover:-translate-y-1 hover:border-basil-soft hover:shadow-card sm:rounded-[24px]">
                  <Media src={s.image_url || youtubeThumb(s.video_url)} index={i} className="aspect-[4/3] w-full sm:aspect-video">
                    <span className="absolute left-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white/95 text-basil sm:left-4 sm:top-4 sm:h-11 sm:w-11"><Icon size={18} /></span>
                    {s.video_url && <span className="absolute bottom-2.5 right-2.5 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-extrabold text-basil sm:text-xs">▶ Video</span>}
                  </Media>
                  <span className="flex flex-1 flex-col gap-1.5 p-3 sm:gap-2 sm:p-5">
                    <b className="font-display text-[15px] leading-tight text-basil-ink sm:text-xl">{s.title}</b>
                    <span className="line-clamp-2 text-[12.5px] leading-snug text-basil-muted sm:text-[15px]">{s.short}</span>
                    <span className="mt-auto hidden flex-wrap gap-1.5 pt-1 sm:flex">
                      {s.deliverables.slice(0, 3).map((d) => <span key={d} className="rounded-full bg-basil-ice px-2.5 py-1 text-xs font-medium text-basil-deep">{d}</span>)}
                    </span>
                    <span className="mt-auto flex items-center gap-1 pt-1 text-[13px] font-bold text-basil sm:mt-2 sm:text-sm">Details <ArrowRight size={14} /></span>
                  </span>
                </motion.button>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="bg-basil-mist">
        <div className="container-bm section">
          <div className="kicker">HOW WE WORK</div>
          <h2 className="h-section m-0 mb-5 mt-1">Four steps, no surprises</h2>
          <ol className="m-0 grid list-none grid-cols-2 gap-2.5 p-0 lg:grid-cols-4 sm:gap-4">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="rounded-[20px] bg-white p-4 sm:p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-basil font-display text-sm font-extrabold text-white">{i + 1}</span>
                <b className="mt-2.5 block font-display sm:text-lg">{title}</b>
                <span className="text-[13px] leading-snug text-basil-muted sm:text-sm">{text}</span>
              </li>
            ))}
          </ol>
          <Link to="/#book" className="btn-primary mt-6 h-12 w-full sm:w-auto">{t('book')}</Link>
        </div>
      </section>

      <Sheet open={!!cur} onClose={close} title={cur?.title ?? ''}>
        {cur && (
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-2xl">
              {cur.video_url ? <VideoEmbed url={cur.video_url} title={cur.title} poster={cur.image_url || youtubeThumb(cur.video_url)} /> : <Media src={cur.image_url} index={rows.indexOf(cur)} overlay={false} className="aspect-video" />}
            </div>
            <p className="m-0 leading-relaxed text-basil-muted">{cur.description}</p>
            <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
              {cur.deliverables.map((d) => <li key={d} className="flex items-center gap-2 rounded-xl bg-basil-mist px-3 py-2.5 text-sm font-medium"><Check size={16} className="shrink-0 text-basil" />{d}</li>)}
            </ul>
            <Link to="/#book" className="btn-primary h-12">Book {cur.title}</Link>
          </div>
        )}
      </Sheet>
    </>
  );
}
