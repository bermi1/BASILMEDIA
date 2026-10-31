import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Briefcase, Camera, ChevronDown, HeartPulse, Lightbulb, Mic, Radio, Sparkles, Star, Users, Video } from 'lucide-react';
import { useRows, useSettings } from '@/hooks/useData';
import { useSeo } from '@/hooks/useSeo';
import { useI18n } from '@/lib/i18n';
import { videoLabel, youtubeThumb } from '@/lib/video';
import { HeroSlides } from '@/components/HeroSlides';
import { gradient } from '@/components/Media';
import { VideoEmbed } from '@/components/VideoEmbed';
import { Reveal } from '@/components/Reveal';
import { BookingForm } from '@/components/BookingForm';
import { Play } from '@/components/icons';

const ICONS: Record<string, typeof Video> = { video: Video, camera: Camera, mic: Mic, radio: Radio, sparkles: Sparkles, briefcase: Briefcase };
const PILLARS = [['Health', HeartPulse], ['Innovation', Lightbulb], ['Youth', Users]] as const;

function Head({ kicker, title, to, link }: { kicker: string; title: string; to?: string; link?: string }) {
  return (
    <Reveal className="mb-5 flex items-end justify-between gap-3 sm:mb-7">
      <div className="min-w-0"><div className="kicker">{kicker}</div><h2 className="h-section m-0 mt-1">{title}</h2></div>
      {to && <Link to={to} className="flex shrink-0 items-center gap-1 text-sm font-bold no-underline sm:text-base">{link}<ArrowRight size={16} /></Link>}
    </Reveal>
  );
}

export default function Home() {
  const s = useSettings();
  const { t } = useI18n();
  useSeo('Basil Media — Video, Photography, Podcasts & Live Streaming in Dar es Salaam', s.hero_subtitle);
  const { rows: partners } = useRows('partners');
  const { rows: projects } = useRows('projects_public', { publishedOnly: true });
  const { rows: highlights } = useRows('highlights', { publishedOnly: true });
  const { rows: services } = useRows('services', { publishedOnly: true });
  const { rows: testimonials } = useRows('testimonials', { publishedOnly: true, columns: 'id,company,quote,rating,sort_order,published' });
  const photos = s.hero_images?.length ? s.hero_images : s.hero_image_url ? [s.hero_image_url] : [];
  // Work at a glance: the reels first, then featured projects.
  const glance = [
    ...highlights.map((h) => ({ id: h.id, title: h.title, url: h.video_url, poster: h.thumbnail_url || youtubeThumb(h.video_url), sub: videoLabel(h.video_url) })),
    ...projects.filter((p) => p.featured).map((p) => ({ id: p.id, title: p.title, url: p.video_url, poster: p.image_url || youtubeThumb(p.video_url), sub: p.category })),
  ].slice(0, 10);

  return (
    <>
      {/* HERO — the picture/video speaks; few words */}
      <section className="relative isolate flex min-h-[54svh] items-end overflow-hidden text-white sm:min-h-[78vh]" style={{ background: 'radial-gradient(ellipse at 15% 20%, rgba(124,192,245,0.35), transparent 50%), radial-gradient(ellipse at 90% 85%, rgba(245,185,66,0.2), transparent 45%), linear-gradient(160deg, #0A2F5C, #061E3D)' }}>
        <HeroSlides images={photos} video={s.hero_video_url} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(6,30,61,0.45) 0%, rgba(6,30,61,0.1) 35%, rgba(6,30,61,0.85) 78%, rgba(6,30,61,0.98) 100%)' }} />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="container-bm relative pb-7 pt-24 sm:pb-20">
          <h1 className="m-0 max-w-[760px] text-[clamp(26px,5vw,64px)] font-bold leading-[1.08] tracking-[-0.025em]">
            {s.tagline} <span className="text-glow">{s.tagline_highlight}</span>
          </h1>
          {s.hero_subtitle && <p className="m-0 mt-2.5 max-w-[480px] text-[14px] text-basil-frost sm:mt-4 sm:text-lg">{s.hero_subtitle}</p>}
          <div className="mt-5 flex flex-wrap gap-2 sm:mt-7 sm:gap-3">
            <Link to="/#book" className="group flex h-11 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-5 text-[14px] font-semibold text-basil no-underline hover:bg-basil-ice sm:h-12 sm:px-6 sm:text-[15px]">{t('book')}<ArrowRight size={16} className="transition group-hover:translate-x-1" /></Link>
            <Link to="/our-work" className="flex h-11 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/35 bg-white/10 px-5 text-[14px] font-semibold text-white no-underline backdrop-blur hover:bg-white/20 hover:text-white sm:h-12 sm:px-6 sm:text-[15px]"><Play size={15} color="#FFFFFF" />{t('viewWork')}</Link>
          </div>
        </motion.div>
        <a href="#trusted" aria-label="Scroll down" className="absolute bottom-[104px] right-5 hidden h-12 w-12 animate-float items-center justify-center rounded-full border border-white/30 text-white no-underline sm:bottom-8 sm:flex"><ChevronDown size={20} /></a>
      </section>

      {/* TRUSTED BY — partner logos added by the admin */}
      {partners.length > 0 && (
        <section id="trusted" aria-label="Trusted by" className="border-b border-[#E3EDF8] bg-white">
          <div className="container-bm flex items-center gap-4 py-5 sm:gap-8 sm:py-7">
            <span className="shrink-0 font-mono text-[10.5px] tracking-[0.18em] text-basil-muted">TRUSTED BY</span>
            <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
              <div className="flex w-max animate-marquee items-center gap-10 sm:gap-14">
                {[...partners, ...partners].map((p, i) => (
                  <span key={i} className="flex h-9 items-center font-display text-[14px] font-bold text-[#6A7E99] sm:h-11 sm:text-base" aria-hidden={i >= partners.length}>
                    {p.logo_url ? <img src={p.logo_url} alt={p.name} className="h-8 max-w-[130px] object-contain opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0 sm:h-11" loading="lazy" /> : p.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* WHO WE ARE */}
      <section className="container-bm section">
        <Reveal className="grid items-center gap-6 lg:grid-cols-[1.3fr_1fr] lg:gap-12">
          <div>
            <div className="kicker">WHO WE ARE</div>
            <h2 className="mb-0 mt-2 font-display text-[clamp(20px,2.6vw,34px)] font-bold leading-[1.2] tracking-[-0.015em]">{s.home_about_title}</h2>
            <p className="m-0 mt-3 max-w-[560px] text-[14.5px] leading-relaxed text-basil-muted sm:text-[17px]">{s.home_about_text}</p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {PILLARS.map(([label, Icon]) => <span key={label} className="flex items-center gap-1.5 rounded-full bg-basil-ice px-3 py-1.5 text-[13px] font-semibold text-basil-deep"><Icon size={16} className="text-basil" />{label}</span>)}
              <Link to="/about" className="ml-1 flex items-center gap-1 text-sm font-bold no-underline">Our story <ArrowRight size={15} /></Link>
            </div>
          </div>
          {s.about_image_url && <img src={s.about_image_url} alt="Basil Media studio" loading="lazy" className="aspect-[16/10] w-full rounded-[26px] object-cover shadow-card" />}
        </Reveal>
      </section>

      {/* WORK AT A GLANCE — swipe */}
      {glance.length > 0 && (
        <section className="section bg-basil-mist">
          <div className="container-bm">
            <Head kicker="OUR WORK AT A GLANCE" title="Swipe through the stories" to="/our-work" link="All work" />
            <div className="snap-row pb-1">
              {glance.map((g, i) => <GlanceCard key={g.id} {...g} index={i} />)}
            </div>
          </div>
        </section>
      )}

      {/* SERVICES */}
      <section className="container-bm section">
        <Head kicker={t('services').toUpperCase()} title={t('servicesTitle')} to="/services" link="All" />
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 lg:grid-cols-3">
          {services.map((x) => {
            const Icon = ICONS[x.icon] ?? Video;
            return (
              <Link key={x.id} to={`/services#${x.slug}`} className="group flex flex-col gap-2 rounded-[20px] border border-basil-line bg-white p-3.5 text-basil-ink no-underline transition hover:-translate-y-1 hover:border-basil-soft hover:text-basil-ink hover:shadow-card sm:gap-3 sm:p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-basil-ice text-basil transition group-hover:bg-basil group-hover:text-white sm:h-12 sm:w-12"><Icon size={20} /></span>
                <b className="font-display text-[14px] font-semibold leading-tight sm:text-lg">{x.title}</b>
                <span className="line-clamp-2 text-[13px] leading-snug text-basil-muted sm:text-[15px]">{x.short}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* WORDS FROM OUR PARTNERS — compact on phones */}
      {testimonials.length > 0 && (
        <section className="container-bm pb-10 sm:pb-16">
          <Head kicker="TESTIMONIALS" title={t('partnersWords')} />
          <div className="snap-row sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible lg:grid-cols-4">
            {testimonials.map((x) => (
              <figure key={x.id} className="m-0 flex w-[72vw] max-w-[300px] shrink-0 snap-start flex-col rounded-[18px] border border-basil-line bg-white p-4 sm:w-auto sm:max-w-none sm:p-5">
                <div className="flex gap-0.5 text-sun-deep" aria-label={`${x.rating} out of 5 stars`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} size={13} fill={i < x.rating ? 'currentColor' : 'none'} />)}</div>
                <blockquote className="mx-0 my-2 line-clamp-4 text-[13.5px] leading-snug sm:text-[15px] sm:leading-relaxed">“{x.quote}”</blockquote>
                <figcaption className="mt-auto text-[12.5px] font-bold text-basil-muted sm:text-sm">{x.company}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section id="book" className="container-bm scroll-mt-24 pb-12 sm:pb-20">
        <Reveal><BookingForm /></Reveal>
      </section>
    </>
  );
}

function GlanceCard({ title, url, poster, sub, index }: { title: string; url: string; poster: string; sub: string; index: number }) {
  const [on, setOn] = useState(false);
  return (
    <div className="w-[46vw] max-w-[230px] shrink-0 snap-start">
      {on && url ? (
        <div className="overflow-hidden rounded-[20px] shadow-card"><VideoEmbed url={url} title={title} autoPlay aspect="9 / 16" /></div>
      ) : (
        <button type="button" onClick={() => setOn(true)} aria-label={`Play ${title}`} className="group relative block w-full overflow-hidden rounded-[20px] border-0 p-0 shadow-card" style={{ aspectRatio: '9 / 16', background: gradient(index) }}>
          {poster && <img src={poster} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />}
          <span className="absolute inset-0 bg-gradient-to-t from-basil-night/85 via-transparent to-transparent" />
          {url && <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 transition group-hover:scale-110"><Play size={18} /></span>}
          <span className="absolute inset-x-3 bottom-3 text-left text-white">
            {sub && <span className="block text-[10.5px] font-bold uppercase tracking-wide text-basil-haze">{sub}</span>}
            <b className="line-clamp-2 text-[13px] leading-tight sm:text-[14.5px]">{title}</b>
          </span>
        </button>
      )}
    </div>
  );
}
