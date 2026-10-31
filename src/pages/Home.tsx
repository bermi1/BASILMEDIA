import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useRows, useSettings } from '@/hooks/useData';
import { useSeo } from '@/hooks/useSeo';
import { useI18n } from '@/lib/i18n';
import { videoLabel, youtubeThumb } from '@/lib/video';
import { HeroOrb } from '@/components/HeroOrb';
import { Media, gradient } from '@/components/Media';
import { VideoEmbed } from '@/components/VideoEmbed';
import { Reveal } from '@/components/Reveal';
import { CountUp } from '@/components/CountUp';
import { BookingForm } from '@/components/BookingForm';
import { Play } from '@/components/icons';

// Gap-free featured mosaic: the first tile is 2×2, and the last few tiles widen just enough that every
// row is full at 2, 3 and 4 columns (grid-auto-flow: dense packs the rest).
const WIDE = { 2: 'col-span-2', 3: 'sm:col-span-2', 4: 'lg:col-span-2' } as const;
const NARROW = { 2: '', 3: 'sm:col-span-1', 4: 'lg:col-span-1' } as const;
function mosaicSpan(i: number, n: number) {
  if (i === 0) return 'col-span-2 row-span-2';
  return ([2, 3, 4] as const)
    .map((cols) => {
      const extra = (cols - ((4 + n - 1) % cols)) % cols;
      return i >= n - extra ? WIDE[cols] : NARROW[cols];
    })
    .join(' ');
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
  const featured = (projects.filter((p) => p.featured).length ? projects.filter((p) => p.featured) : projects).slice(0, 7);

  return (
    <>
      {/* HERO */}
      <section className="grain relative overflow-hidden text-white" style={{ background: 'radial-gradient(ellipse at 15% 20%, rgba(124,192,245,0.35), transparent 50%), radial-gradient(ellipse at 90% 80%, rgba(15,110,194,0.6), transparent 55%), linear-gradient(160deg, #0A2F5C, #061E3D)' }}>
        {s.hero_image_url && (
          <>
            <img src={s.hero_image_url} alt="" className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg, rgba(6,30,61,0.95) 25%, rgba(10,47,92,0.55) 65%, rgba(10,47,92,0.2))' }} />
          </>
        )}
        <div className="container-bm relative flex max-h-none flex-wrap items-center gap-8 py-12 sm:py-16 lg:min-h-[min(78vh,640px)] lg:gap-12">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="flex min-w-0 flex-[1_1_520px] flex-col gap-6">
            <div className="font-mono text-[11px] tracking-[0.22em] text-basil-haze sm:text-xs">{s.hero_kicker}</div>
            <h1 className="m-0 text-[clamp(40px,6vw,78px)] font-extrabold leading-none tracking-[-0.02em]">
              {s.tagline} <span className="text-basil-sky">{s.tagline_highlight}</span>
            </h1>
            <p className="m-0 max-w-[560px] text-[17px] leading-relaxed text-basil-frost sm:text-[19px]">{s.hero_subtitle}</p>
            <div className="flex flex-wrap gap-3">
              <Link to="/#book" className="rounded-2xl bg-white px-7 py-4 font-bold text-basil no-underline hover:bg-basil-ice">{t('book')}</Link>
              <Link to="/our-work" className="btn-ghost px-7 py-4">{t('viewWork')}</Link>
            </div>
          </motion.div>
          <div className="relative h-[300px] min-w-0 flex-[1_1_360px] sm:h-[420px]">
            <HeroOrb logo={s.logo_reverse_url || '/logo-reverse.svg'} />
            {s.live_ticker && (
              <div className="absolute right-0 top-0 max-w-[260px] rounded-[20px] border border-white/35 bg-white/[0.12] px-4 py-3.5 backdrop-blur-xl">
                <div className="flex items-center gap-2 text-xs text-basil-haze"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />Live</div>
                <b className="font-display text-sm sm:text-base">{s.live_ticker}</b>
              </div>
            )}
            <Link to="/find-me" className="absolute bottom-0 left-0 rounded-[20px] bg-white px-4 py-3.5 text-basil-ink no-underline shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition hover:-translate-y-1">
              <div className="text-xs text-basil-muted">Were you at an event?</div>
              <b className="font-display text-basil">One selfie → all your photos</b>
            </Link>
          </div>
        </div>
      </section>

      {/* PARTNERS */}
      {partners.length > 0 && (
        <section aria-label="Partners" className="overflow-hidden border-b border-[#E3EDF8] bg-white">
          <div className="flex w-max animate-marquee gap-14 py-[22px] font-display text-lg font-bold text-[#6A7E99] hover:[animation-play-state:paused]">
            {[...partners, ...partners].map((p, i) => (
              <span key={i} className="flex h-12 items-center" aria-hidden={i >= partners.length}>
                {p.logo_url ? <img src={p.logo_url} alt={p.name} className="h-12 max-w-[160px] object-contain grayscale transition hover:grayscale-0" loading="lazy" /> : p.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* FEATURED WORK */}
      <section className="container-bm pb-10 pt-16">
        <Reveal className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div><div className="kicker">{t('featured')}</div><h2 className="h-section m-0 mt-1.5">{t('storiesMade')}</h2></div>
          <Link to="/our-work" className="font-bold">{t('allProjects')}</Link>
        </Reveal>
        <Reveal>
          <div className="grid grid-cols-2 gap-0 overflow-hidden rounded-3xl [grid-auto-flow:dense] [grid-auto-rows:150px] sm:grid-cols-3 sm:[grid-auto-rows:190px] lg:grid-cols-4">
            {featured.map((p, i) => (
              <Link key={p.id} to={`/our-work?p=${p.id}`} className={`group no-underline ${mosaicSpan(i, featured.length)}`}>
                <Media src={p.image_url || youtubeThumb(p.video_url)} index={i} className="flex h-full flex-col justify-end p-4 text-white sm:p-5">
                  {p.video_url && <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 opacity-0 transition group-hover:opacity-100"><Play size={16} /></span>}
                  <span className="relative text-xs text-basil-haze">{p.video_url ? '▶ ' : ''}{[p.category, p.client].filter(Boolean).join(' · ')}</span>
                  <b className={`relative font-display leading-tight ${i === 0 ? 'text-2xl' : 'text-[15px]'}`}>{p.title}</b>
                </Media>
              </Link>
            ))}
          </div>
        </Reveal>
      </section>

      {/* HIGHLIGHTS */}
      {highlights.length > 0 && (
        <section className="bg-basil-mist py-16">
          <div className="container-bm">
            <Reveal>
              <div className="kicker">{t('highlights')}</div>
              <h2 className="h-section m-0 mb-2 mt-1.5">{t('reelsTitle')}</h2>
              <p className="m-0 mb-7 max-w-[640px] text-basil-muted">Tap a reel and it plays right here on the page.</p>
            </Reveal>
            <div className="scrollbar-none -mx-4 flex snap-x scroll-pl-4 gap-4 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] sm:overflow-visible sm:px-0">
              {highlights.map((h, i) => <Reel key={h.id} title={h.title} url={h.video_url} poster={h.thumbnail_url || youtubeThumb(h.video_url)} index={i} />)}
            </div>
          </div>
        </section>
      )}

      {/* SERVICES */}
      <section className="container-bm py-16">
        <Reveal><div className="kicker">{t('services').toUpperCase()}</div><h2 className="h-section m-0 mb-7 mt-1.5">{t('servicesTitle')}</h2></Reveal>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-3.5">
          {services.map((x, i) => (
            <Reveal key={x.id} delay={i * 0.05}>
              <Link to={`/services#${x.slug}`} className="flex h-full flex-col gap-2.5 rounded-[22px] border border-basil-line bg-white p-6 text-basil-ink no-underline transition hover:-translate-y-1 hover:border-basil-soft hover:text-basil-ink hover:shadow-card">
                <span className="font-display text-sm font-extrabold text-basil">{String(i + 1).padStart(2, '0')}</span>
                <b className="font-display text-xl">{x.title}</b>
                <span className="leading-relaxed text-basil-muted">{x.short}</span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* STATS */}
      <section className="bg-basil-deep text-white">
        <div className="container-bm grid grid-cols-2 gap-5 py-12 sm:py-14 lg:grid-cols-4">
          {s.stats.map((st) => (
            <div key={st.label}>
              <div className="font-display text-4xl font-extrabold sm:text-5xl"><CountUp to={st.value} suffix={st.suffix} /></div>
              <div className="text-basil-haze">{st.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      {testimonials.length > 0 && (
        <section className="container-bm py-16">
          <Reveal><h2 className="m-0 mb-7 text-[clamp(30px,4vw,44px)] font-extrabold">{t('partnersWords')}</h2></Reveal>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
            {testimonials.map((x, i) => (
              <Reveal key={x.id} delay={i * 0.06}>
                <figure className="m-0 h-full rounded-3xl border border-basil-line bg-basil-mist p-6">
                  <div className="tracking-[4px] text-basil" aria-label={`${x.rating} out of 5 stars`}>{'★'.repeat(x.rating)}<span className="text-basil-edge">{'★'.repeat(5 - x.rating)}</span></div>
                  <blockquote className="mx-0 my-3 text-[17px] leading-relaxed">“{x.quote}”</blockquote>
                  <figcaption className="font-bold text-basil-muted">{x.company}</figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* BOOKING */}
      <section id="book" className="container-bm scroll-mt-28 pb-20">
        <Reveal><BookingForm /></Reveal>
      </section>
    </>
  );
}

function Reel({ title, url, poster, index }: { title: string; url: string; poster: string; index: number }) {
  const [on, setOn] = useState(false);
  const src = videoLabel(url);
  return (
    <div className="flex w-[64vw] max-w-[260px] shrink-0 snap-start flex-col gap-2.5 sm:w-auto sm:max-w-none">
      {on ? (
        <div className="overflow-hidden rounded-[22px] shadow-card">
          <VideoEmbed url={url} title={title} autoPlay aspect="9 / 16" />
        </div>
      ) : (
        <button type="button" onClick={() => setOn(true)} aria-label={`Play ${title}`} className="group relative overflow-hidden rounded-[22px] border-0 p-0 shadow-card" style={{ aspectRatio: '9 / 16', background: gradient(index) }}>
          {poster && <img src={poster} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />}
          <span className="absolute inset-0 flex items-center justify-center"><span className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-white/90 transition group-hover:scale-110"><Play size={26} /></span></span>
          {src && <span className="absolute right-3 top-3 rounded-lg bg-basil-night/55 px-2 py-1 text-[11px] text-white">{src}</span>}
        </button>
      )}
      <b className="text-[15px]">{title}</b>
    </div>
  );
}
