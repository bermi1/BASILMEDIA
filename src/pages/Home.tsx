import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Briefcase, Camera, Mic, Radio, ScanFace, Sparkles, Star, Video } from 'lucide-react';
import { useRows, useSettings } from '@/hooks/useData';
import { useSeo } from '@/hooks/useSeo';
import { useI18n } from '@/lib/i18n';
import { videoLabel, youtubeThumb } from '@/lib/video';
import { HeroOrb } from '@/components/HeroOrb';
import { HeroSlides } from '@/components/HeroSlides';
import { Media, gradient } from '@/components/Media';
import { VideoEmbed } from '@/components/VideoEmbed';
import { Reveal } from '@/components/Reveal';
import { CountUp } from '@/components/CountUp';
import { BookingForm } from '@/components/BookingForm';
import { Play } from '@/components/icons';

const ICONS: Record<string, typeof Video> = { video: Video, camera: Camera, mic: Mic, radio: Radio, sparkles: Sparkles, briefcase: Briefcase };

// Gap-free featured mosaic: first tile 2×2, the last few widen so every row is full at 2, 3 and 4 columns.
const WIDE = { 2: 'col-span-2', 3: 'sm:col-span-2', 4: 'lg:col-span-2' } as const;
const NARROW = { 2: '', 3: 'sm:col-span-1', 4: 'lg:col-span-1' } as const;
function mosaicSpan(i: number, n: number) {
  if (i === 0) return 'col-span-2 row-span-2';
  return ([2, 3, 4] as const).map((cols) => (i >= n - ((cols - ((4 + n - 1) % cols)) % cols) ? WIDE[cols] : NARROW[cols])).join(' ');
}

function SectionHead({ kicker, title, to, link }: { kicker: string; title: string; to?: string; link?: string }) {
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
  const { rows: team } = useRows('team', { publishedOnly: true });
  const { rows: testimonials } = useRows('testimonials', { publishedOnly: true, columns: 'id,company,quote,rating,sort_order,published' });
  const featured = (projects.filter((p) => p.featured).length ? projects.filter((p) => p.featured) : projects).slice(0, 7);
  const photos = s.hero_images?.length ? s.hero_images : s.hero_image_url ? [s.hero_image_url] : [];
  const hasPhotos = photos.length > 0;

  return (
    <>
      {/* HERO — short on phones, team/office photos behind, crew at a glance */}
      <section className="grain relative isolate overflow-hidden text-white" style={{ background: 'radial-gradient(ellipse at 15% 20%, rgba(124,192,245,0.35), transparent 50%), radial-gradient(ellipse at 90% 80%, rgba(15,110,194,0.6), transparent 55%), linear-gradient(160deg, #0A2F5C, #061E3D)' }}>
        <HeroSlides images={photos} />
        {hasPhotos && <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(6,30,61,0.35) 0%, rgba(6,30,61,0.55) 45%, rgba(6,30,61,0.95) 100%)' }} />}
        {hasPhotos && <div className="absolute inset-0 hidden lg:block" style={{ background: 'linear-gradient(95deg, rgba(6,30,61,0.92) 30%, rgba(6,30,61,0.2) 75%)' }} />}
        <div className={`container-bm relative flex min-h-[64svh] flex-col justify-end gap-6 pb-9 pt-16 sm:min-h-[560px] sm:pb-14 lg:flex-row lg:items-center lg:justify-between lg:py-16 ${hasPhotos ? '' : 'lg:min-h-[600px]'}`}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="flex max-w-[640px] flex-col gap-4 sm:gap-5">
            <div className="font-mono text-[10.5px] tracking-[0.2em] text-basil-haze sm:text-xs">{s.hero_kicker}</div>
            <h1 className="m-0 text-[clamp(34px,6vw,74px)] font-extrabold leading-[1.02] tracking-[-0.02em]">
              {s.tagline} <span className="text-basil-sky">{s.tagline_highlight}</span>
            </h1>
            <p className="m-0 max-w-[540px] text-[15.5px] leading-relaxed text-basil-frost sm:text-lg">{s.hero_subtitle}</p>
            <div className="grid grid-cols-2 gap-2.5 sm:flex sm:gap-3">
              <Link to="/#book" className="flex h-12 items-center justify-center rounded-2xl bg-white px-6 font-bold text-basil no-underline hover:bg-basil-ice sm:h-14">{t('book')}</Link>
              <Link to="/our-work" className="flex h-12 items-center justify-center rounded-2xl border border-white/40 bg-white/10 px-6 font-bold text-white no-underline backdrop-blur hover:bg-white/20 hover:text-white sm:h-14">{t('viewWork')}</Link>
            </div>
            {/* At a glance */}
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-3">
              {team.length > 0 && (
                <Link to="/about" className="flex items-center gap-2.5 text-white no-underline hover:text-white">
                  <span className="flex -space-x-2.5">
                    {team.slice(0, 5).map((m) => (
                      <span key={m.id} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-basil-ice font-display text-sm font-extrabold text-basil ring-2 ring-basil-night">
                        {m.photo_url ? <img src={m.photo_url} alt="" className="h-full w-full object-cover" /> : m.name[0]}
                      </span>
                    ))}
                  </span>
                  <span className="text-[13px] leading-tight text-basil-frost"><b className="block text-white">Meet the crew</b>{team.length} people · Dar es Salaam</span>
                </Link>
              )}
              {s.stats[0] && <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[13px] backdrop-blur"><b>{s.stats[0].value}{s.stats[0].suffix}</b> {s.stats[0].label}</span>}
            </div>
          </motion.div>
          <div className="hidden w-[400px] shrink-0 flex-col gap-3 lg:flex">
            {!hasPhotos && <div className="relative h-[340px]"><HeroOrb logo={s.logo_reverse_url || '/logo-reverse.svg'} /></div>}
            {s.live_ticker && (
              <div className="rounded-[20px] border border-white/30 bg-white/[0.12] px-4 py-3.5 backdrop-blur-xl">
                <div className="flex items-center gap-2 text-xs text-basil-haze"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />Live from the studio</div>
                <b className="font-display">{s.live_ticker}</b>
              </div>
            )}
            <Link to="/find-me" className="flex items-center gap-3 rounded-[20px] bg-white px-4 py-3.5 text-basil-ink no-underline shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition hover:-translate-y-1 hover:text-basil-ink">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-basil-ice text-basil"><ScanFace size={22} /></span>
              <span><span className="block text-xs text-basil-muted">Were you at an event?</span><b className="font-display text-basil">One selfie → all your photos</b></span>
            </Link>
          </div>
        </div>
      </section>

      {/* PARTNERS */}
      {partners.length > 0 && (
        <section aria-label="Partners" className="overflow-hidden border-b border-[#E3EDF8] bg-white">
          <div className="flex w-max animate-marquee gap-10 py-4 font-display text-[15px] font-bold text-[#6A7E99] hover:[animation-play-state:paused] sm:gap-14 sm:py-[22px] sm:text-lg">
            {[...partners, ...partners].map((p, i) => (
              <span key={i} className="flex h-10 items-center sm:h-12" aria-hidden={i >= partners.length}>
                {p.logo_url ? <img src={p.logo_url} alt={p.name} className="h-9 max-w-[140px] object-contain grayscale transition hover:grayscale-0 sm:h-12" loading="lazy" /> : p.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* SERVICES — grid */}
      <section className="container-bm section">
        <SectionHead kicker={t('services').toUpperCase()} title={t('servicesTitle')} to="/services" link="All" />
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 lg:grid-cols-3">
          {services.map((x, i) => {
            const Icon = ICONS[x.icon] ?? Video;
            return (
              <Reveal key={x.id} delay={i * 0.04}>
                <Link to={`/services#${x.slug}`} className="group flex h-full flex-col gap-2 rounded-[20px] border border-basil-line bg-white p-3.5 text-basil-ink no-underline transition hover:-translate-y-1 hover:border-basil-soft hover:text-basil-ink hover:shadow-card sm:gap-3 sm:rounded-[22px] sm:p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-basil-ice text-basil transition group-hover:bg-basil group-hover:text-white sm:h-12 sm:w-12"><Icon size={20} /></span>
                  <b className="font-display text-[15px] leading-tight sm:text-xl">{x.title}</b>
                  <span className="line-clamp-2 text-[13px] leading-snug text-basil-muted sm:text-[15px] sm:leading-relaxed">{x.short}</span>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* FEATURED WORK */}
      <section className="container-bm pb-10 sm:pb-14">
        <SectionHead kicker={t('featured')} title={t('storiesMade')} to="/our-work" link="All" />
        <Reveal>
          <div className="grid grid-cols-2 gap-0 overflow-hidden rounded-[22px] [grid-auto-flow:dense] [grid-auto-rows:118px] sm:grid-cols-3 sm:rounded-3xl sm:[grid-auto-rows:180px] lg:grid-cols-4">
            {featured.map((p, i) => (
              <Link key={p.id} to={`/our-work?p=${p.id}`} className={`group no-underline ${mosaicSpan(i, featured.length)}`}>
                <Media src={p.image_url || youtubeThumb(p.video_url)} index={i} className="flex h-full flex-col justify-end p-3 text-white sm:p-5">
                  {p.video_url && <span className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 sm:opacity-0 sm:transition sm:group-hover:opacity-100"><Play size={14} /></span>}
                  <span className="relative hidden text-xs text-basil-haze sm:block">{[p.category, p.client].filter(Boolean).join(' · ')}</span>
                  <b className={`relative line-clamp-2 font-display leading-tight ${i === 0 ? 'text-lg sm:text-2xl' : 'text-[13px] sm:text-[15px]'}`}>{p.title}</b>
                </Media>
              </Link>
            ))}
          </div>
        </Reveal>
      </section>

      {/* HIGHLIGHTS — compact reels */}
      {highlights.length > 0 && (
        <section className="section bg-basil-mist">
          <div className="container-bm">
            <SectionHead kicker={t('highlights')} title={t('reelsTitle')} />
            <div className="snap-row sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible">
              {highlights.slice(0, 4).map((h, i) => <Reel key={h.id} title={h.title} url={h.video_url} poster={h.thumbnail_url || youtubeThumb(h.video_url)} index={i} />)}
            </div>
          </div>
        </section>
      )}

      {/* STATS */}
      <section className="bg-basil-deep text-white">
        <div className="container-bm grid grid-cols-4 gap-2 py-6 text-center sm:gap-5 sm:py-12 sm:text-left">
          {s.stats.slice(0, 4).map((st) => (
            <div key={st.label}>
              <div className="font-display text-[22px] font-extrabold sm:text-5xl"><CountUp to={st.value} suffix={st.suffix} /></div>
              <div className="text-[11px] leading-tight text-basil-haze sm:text-base">{st.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS — swipe on phones */}
      {testimonials.length > 0 && (
        <section className="container-bm section">
          <SectionHead kicker="TESTIMONIALS" title={t('partnersWords')} />
          <div className="snap-row sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible lg:grid-cols-4">
            {testimonials.map((x) => (
              <figure key={x.id} className="m-0 flex w-[82vw] max-w-[340px] shrink-0 snap-start flex-col rounded-[22px] border border-basil-line bg-basil-mist p-5 sm:w-auto sm:max-w-none">
                <div className="flex gap-0.5 text-basil" aria-label={`${x.rating} out of 5 stars`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} size={15} fill={i < x.rating ? 'currentColor' : 'none'} />)}</div>
                <blockquote className="mx-0 my-3 line-clamp-5 text-[15px] leading-relaxed">“{x.quote}”</blockquote>
                <figcaption className="mt-auto text-sm font-bold text-basil-muted">{x.company}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* BOOKING */}
      <section id="book" className="container-bm scroll-mt-24 pb-12 sm:pb-20">
        <Reveal><BookingForm /></Reveal>
      </section>
    </>
  );
}

function Reel({ title, url, poster, index }: { title: string; url: string; poster: string; index: number }) {
  const [on, setOn] = useState(false);
  const src = videoLabel(url);
  return (
    <div className="flex w-[42vw] max-w-[190px] shrink-0 snap-start flex-col gap-2 sm:w-auto sm:max-w-none">
      {on ? (
        <div className="overflow-hidden rounded-[18px] shadow-card"><VideoEmbed url={url} title={title} autoPlay aspect="9 / 16" /></div>
      ) : (
        <button type="button" onClick={() => setOn(true)} aria-label={`Play ${title}`} className="group relative overflow-hidden rounded-[18px] border-0 p-0 shadow-card" style={{ aspectRatio: '9 / 16', background: gradient(index) }}>
          {poster && <img src={poster} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />}
          <span className="absolute inset-0 bg-gradient-to-t from-basil-night/70 to-transparent" />
          <span className="absolute inset-0 flex items-center justify-center"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 transition group-hover:scale-110 sm:h-16 sm:w-16"><Play size={20} /></span></span>
          {src && <span className="absolute right-2 top-2 rounded-md bg-basil-night/55 px-1.5 py-0.5 text-[10px] text-white">{src}</span>}
          <b className="absolute inset-x-2.5 bottom-2.5 line-clamp-2 text-left text-[12.5px] leading-tight text-white sm:text-sm">{title}</b>
        </button>
      )}
    </div>
  );
}
