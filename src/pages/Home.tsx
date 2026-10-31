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
      {/* HERO — photos of the team/office behind, big type, then an "at a glance" bento */}
      <section className="grain relative isolate overflow-hidden text-white" style={{ background: 'radial-gradient(ellipse at 12% 18%, rgba(124,192,245,0.38), transparent 50%), radial-gradient(ellipse at 92% 85%, rgba(245,185,66,0.22), transparent 45%), radial-gradient(ellipse at 80% 30%, rgba(15,110,194,0.6), transparent 55%), linear-gradient(160deg, #0A2F5C, #061E3D)' }}>
        <HeroSlides images={photos} />
        {hasPhotos && <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(6,30,61,0.3) 0%, rgba(6,30,61,0.55) 50%, rgba(6,30,61,0.96) 100%)' }} />}
        {hasPhotos && <div className="absolute inset-0 hidden lg:block" style={{ background: 'linear-gradient(95deg, rgba(6,30,61,0.92) 30%, rgba(6,30,61,0.15) 75%)' }} />}
        <div className="container-bm relative grid min-h-[62svh] items-end gap-8 pb-20 pt-14 sm:min-h-[560px] sm:pb-24 lg:min-h-[620px] lg:grid-cols-[1.25fr_1fr] lg:items-center lg:pb-28">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col gap-4 sm:gap-5">
            <div className="flex items-start gap-2 font-mono text-[10px] leading-relaxed tracking-[0.14em] text-basil-haze sm:items-center sm:text-xs sm:tracking-[0.2em]"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sun shadow-[0_0_12px_#F5B942] sm:mt-0" />{s.hero_kicker}</div>
            <h1 className="m-0 text-[clamp(38px,7.2vw,92px)] font-extrabold leading-[0.98] tracking-[-0.035em]">
              {s.tagline} <span className="text-glow">{s.tagline_highlight}</span>
            </h1>
            <p className="m-0 max-w-[540px] text-[15.5px] leading-relaxed text-basil-frost sm:text-lg">{s.hero_subtitle}</p>
            <div className="grid grid-cols-2 gap-2.5 sm:flex sm:gap-3">
              <Link to="/#book" className="group flex h-[52px] items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-white px-4 text-[15px] font-bold sm:px-6 sm:text-base text-basil no-underline shadow-[0_18px_40px_rgba(0,0,0,0.25)] hover:bg-basil-ice sm:h-14">{t('book')}<ArrowRight size={18} className="transition group-hover:translate-x-1" /></Link>
              <Link to="/our-work" className="flex h-[52px] items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-white/35 bg-white/10 px-4 text-[15px] font-bold sm:px-6 sm:text-base text-white no-underline backdrop-blur hover:bg-white/20 hover:text-white sm:h-14"><Play size={16} color="#FFFFFF" />{t('viewWork')}</Link>
            </div>
          </motion.div>
          {!hasPhotos && <div className="relative hidden h-[420px] lg:block"><HeroOrb logo={s.logo_reverse_url || '/logo-reverse.svg'} /></div>}
        </div>
      </section>

      {/* AT A GLANCE — bento overlapping the hero */}
      <section aria-label="At a glance" className="container-bm relative z-10 -mt-14 sm:-mt-16">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          <Link to="/about" className="col-span-2 flex items-center gap-3 rounded-[22px] border border-basil-line bg-white p-4 text-basil-ink no-underline shadow-[0_20px_50px_rgba(10,47,92,0.16)] transition hover:-translate-y-1 hover:text-basil-ink lg:col-span-1">
            <span className="flex -space-x-2.5">
              {(team.length ? team.slice(0, 4) : []).map((m) => (
                <span key={m.id} className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-basil font-display text-sm font-extrabold text-white ring-[3px] ring-white">
                  {m.photo_url ? <img src={m.photo_url} alt="" className="h-full w-full object-cover" /> : m.name[0]}
                </span>
              ))}
            </span>
            <span className="min-w-0"><b className="block font-display">Meet the crew</b><span className="text-[13px] text-basil-muted">{team.length} creatives · Dar es Salaam</span></span>
          </Link>
          <Link to="/find-me" className="flex flex-col justify-between gap-3 rounded-[22px] bg-basil p-4 text-white no-underline shadow-[0_20px_50px_rgba(15,110,194,0.35)] transition hover:-translate-y-1 hover:text-white">
            <span className="flex items-center justify-between"><ScanFace size={24} /><span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold tracking-wide">BERMI AI</span></span>
            <span><b className="block font-display leading-tight">Find your photos</b><span className="text-[12.5px] text-basil-frost">One selfie, every photo</span></span>
          </Link>
          <div className="flex flex-col justify-between gap-3 rounded-[22px] p-4 text-basil-night shadow-[0_20px_50px_rgba(183,121,31,0.25)]" style={{ background: 'linear-gradient(140deg, #FDE7B0, #F5B942)' }}>
            <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide"><span className="h-2 w-2 animate-pulse rounded-full bg-red-600" />LATEST</span>
            <b className="line-clamp-3 font-display text-[14px] leading-tight">{s.live_ticker || (projects[0] ? `Delivered · ${projects[0].title}` : 'New work every week')}</b>
          </div>
          <div className="col-span-2 grid grid-cols-3 gap-2 rounded-[22px] bg-basil-deep p-4 text-white shadow-[0_20px_50px_rgba(10,47,92,0.25)] lg:col-span-1">
            {s.stats.slice(0, 3).map((st) => (
              <div key={st.label} className="min-w-0"><div className="font-display text-[22px] font-extrabold leading-none"><CountUp to={st.value} suffix={st.suffix} /></div><div className="mt-1 truncate text-[11px] text-basil-haze">{st.label}</div></div>
            ))}
          </div>
        </div>
      </section>

      {/* KINETIC BAND */}
      <section aria-hidden="true" className="overflow-hidden py-6 sm:py-10">
        <div className="flex w-max animate-marquee gap-8 whitespace-nowrap font-display text-[44px] font-extrabold leading-none tracking-[-0.03em] sm:text-[88px]" style={{ animationDuration: '40s' }}>
          {[0, 1].map((k) => (
            <span key={k} className="flex gap-8">
              {services.map((x, i) => (
                <span key={x.id + k} className="flex items-center gap-8">
                  <span className={i % 2 ? 'text-basil' : 'outline-word [-webkit-text-stroke:1.5px_#0F6EC2]'}>{x.title}</span>
                  <span className="text-sun">✦</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </section>

      {/* PARTNERS */}
      {partners.length > 0 && (
        <section aria-label="Partners" className="overflow-hidden border-y border-[#E3EDF8] bg-basil-mist">
          <div className="flex w-max animate-marquee gap-10 py-4 font-display text-[14px] font-bold text-[#6A7E99] hover:[animation-play-state:paused] sm:gap-14 sm:py-5 sm:text-base">
            {[...partners, ...partners].map((p, i) => (
              <span key={i} className="flex h-10 items-center" aria-hidden={i >= partners.length}>
                {p.logo_url ? <img src={p.logo_url} alt={p.name} className="h-9 max-w-[140px] object-contain grayscale transition hover:grayscale-0" loading="lazy" /> : p.name}
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
