import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Briefcase, CalendarDays, Camera, ChevronDown, HeartPulse, Lightbulb, Mic, Radio, Sparkles, Star, Users, Video } from 'lucide-react';
import { useRows, useSettings } from '@/hooks/useData';
import { useSeo } from '@/hooks/useSeo';
import { useI18n } from '@/lib/i18n';
import { videoLabel, videoOrientation, youtubeThumb, type Orientation } from '@/lib/video';
import { HeroSlides } from '@/components/HeroSlides';
import { gradient } from '@/components/Media';
import { VideoEmbed } from '@/components/VideoEmbed';
import { Reveal } from '@/components/Reveal';
import { BookingForm } from '@/components/BookingForm';
import { Play } from '@/components/icons';

const STEPS: [string, string][] = [
  ['Brief', 'We listen and agree the plan and budget.'],
  ['Shoot', 'Our crew films and photographs on location or in studio.'],
  ['Edit', 'Edit, colour, sound and subtitles in EN / SW.'],
  ['Deliver', 'Files, gallery and reels on the agreed date.'],
];
const ICONS: Record<string, typeof Video> = { video: Video, camera: Camera, mic: Mic, radio: Radio, sparkles: Sparkles, briefcase: Briefcase, heart: HeartPulse, calendar: CalendarDays };
const PILLARS = [['Health', HeartPulse], ['Innovation', Lightbulb], ['Youth', Users]] as const;

function Head({ kicker, title, to, link, dark }: { kicker: string; title: string; to?: string; link?: string; dark?: boolean }) {
  return (
    <Reveal className="mb-5 flex items-end justify-between gap-3 sm:mb-7">
      <div className="min-w-0"><div className={`kicker ${dark ? '!text-basil-sky' : ''}`}>{kicker}</div><h2 className={`h-section m-0 mt-1 ${dark ? 'text-white' : ''}`}>{title}</h2></div>
      {to && <Link to={to} className={`flex shrink-0 items-center gap-1 text-sm font-bold no-underline sm:text-base ${dark ? 'text-basil-sky hover:text-white' : ''}`}>{link}<ArrowRight size={16} /></Link>}
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
    ...highlights.map((h) => ({ id: h.id, title: h.title, url: h.video_url, poster: h.thumbnail_url || youtubeThumb(h.video_url), sub: videoLabel(h.video_url) || 'Reel', cat: 'Reels', shape: videoOrientation(h.video_url, h.orientation) })),
    ...projects.map((p) => ({ id: p.id, title: p.title, url: p.video_url, poster: p.image_url || youtubeThumb(p.video_url), sub: p.category, cat: p.category as string, shape: videoOrientation(p.video_url, p.orientation) })),
  ];
  const [cat, setCat] = useState('All');
  const cats = ['All', ...Array.from(new Set(glance.map((g) => g.cat)))];
  const shown = glance.filter((g) => cat === 'All' || g.cat === cat).slice(0, 12);
  const { rows: news } = useRows('news_stories', { publishedOnly: true, limit: 3 });

  return (
    <>
      {/* HERO — the picture/video speaks; few words */}
      <section className="relative isolate flex min-h-[60svh] items-end justify-center overflow-hidden text-center text-white sm:min-h-[80vh]" style={{ background: 'radial-gradient(ellipse at 15% 20%, rgba(124,192,245,0.35), transparent 50%), radial-gradient(ellipse at 90% 85%, rgba(245,185,66,0.2), transparent 45%), linear-gradient(160deg, #0A2F5C, #061E3D)' }}>
        <HeroSlides images={photos} video={s.hero_video_url} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(6,30,61,0.45) 0%, rgba(6,30,61,0.1) 35%, rgba(6,30,61,0.85) 78%, rgba(6,30,61,0.98) 100%)' }} />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="container-bm relative flex flex-col items-center pb-8 pt-24 sm:pb-16">
          <h1 className="m-0 max-w-[640px] text-[clamp(22px,3.6vw,44px)] font-bold leading-[1.15] tracking-[-0.02em]">
            {s.tagline} <span className="text-glow">{s.tagline_highlight}</span>
          </h1>
          {s.hero_subtitle && <p className="m-0 mt-2 max-w-[440px] text-[13.5px] text-basil-frost sm:mt-3 sm:text-base">{s.hero_subtitle}</p>}
          <div className="mt-5 flex flex-wrap justify-center gap-2 sm:mt-6 sm:gap-3">
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
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="bg-dots fade-mask absolute inset-0" />
        <div aria-hidden="true" className="aurora -right-24 top-10 h-72 w-72 bg-basil-sky" />
        <div className="container-bm section relative">
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
          {s.about_image_url && (
            <div className="relative rounded-[28px] p-[1.5px] shadow-[0_30px_80px_-20px_rgba(15,110,194,0.45)]" style={{ background: 'linear-gradient(135deg, #7CC0F5, #0F6EC2 45%, #F5B942)' }}>
              <img src={s.about_image_url} alt="Basil Media studio" loading="lazy" className="aspect-[16/10] w-full rounded-[26px] object-cover" />
              <span className="absolute -bottom-3 left-5 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-basil-deep shadow-card"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />Studio · Upanga, Dar es Salaam</span>
            </div>
          )}
        </Reveal>
        </div>
      </section>

      {/* WORK AT A GLANCE — swipe */}
      {glance.length > 0 && (
        <section className="section relative overflow-hidden bg-basil-night">
          <div aria-hidden="true" className="bg-dots-dark fade-mask absolute inset-0" />
          <div aria-hidden="true" className="aurora -left-20 top-0 h-80 w-80 bg-basil" />
          <div aria-hidden="true" className="aurora -right-16 bottom-0 h-64 w-64 bg-sun/60 [animation-delay:-4s]" />
          <div className="container-bm relative">
            <Head dark kicker="OUR WORK AT A GLANCE" title="Swipe through the stories" to="/our-work" link="All work" />
            <div role="tablist" aria-label="Filter work" className="scrollbar-none -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              {cats.map((c) => (
                <button key={c} type="button" role="tab" aria-selected={cat === c} onClick={() => setCat(c)} className={`h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium transition ${cat === c ? 'border-0 bg-white text-basil-night shadow-[0_0_24px_rgba(124,192,245,0.55)]' : 'border border-white/20 bg-white/[0.06] text-white/80 backdrop-blur hover:bg-white/15'}`}>{c}</button>
              ))}
            </div>
            {/* Wide films: a swipe row on phones, a grid on desktop. Tall reels: their own swipe row of portrait cards. */}
            {shown.some((g) => g.shape === 'landscape') && (
              <div className="snap-row mb-4 pb-1 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible lg:grid-cols-3">
                {shown.filter((g) => g.shape === 'landscape').map((g, i) => <GlanceCard key={g.id} {...g} index={i} />)}
              </div>
            )}
            {shown.some((g) => g.shape === 'portrait') && (
              <div className="snap-row pb-1">
                {shown.filter((g) => g.shape === 'portrait').map((g, i) => <GlanceCard key={g.id} {...g} index={i} />)}
              </div>
            )}
          </div>
        </section>
      )}

      {/* SERVICES — photo cards: a swipe row on phones, a grid with one large lead card on desktop */}
      <section className="relative">
        <div aria-hidden="true" className="bg-dots fade-mask absolute inset-0 opacity-70" />
        <div className="container-bm section relative">
          <Head kicker={t('services').toUpperCase()} title={t('servicesTitle')} to="/services" link="All" />
          <div className="snap-row pb-1 lg:grid lg:auto-rows-[220px] lg:grid-cols-4 lg:gap-4 lg:overflow-visible">
            {services.map((x, i) => {
              const Icon = ICONS[x.icon] ?? Video;
              const lead = i === 0;
              // the last card stretches so the desktop grid never ends with an empty slot
              const gap = (4 - ((services.length + 3) % 4)) % 4;
              const stretch = i === services.length - 1 && i > 0 ? (['', 'lg:col-span-2', 'lg:col-span-3', 'lg:col-span-4'][gap] ?? '') : '';
              return (
                <Link key={x.id} to={`/services#${x.slug}`}
                  className={`group relative block w-[72vw] max-w-[300px] shrink-0 snap-start overflow-hidden rounded-[22px] text-white no-underline hover:text-white lg:w-auto lg:max-w-none ${lead ? 'lg:col-span-2 lg:row-span-2' : stretch}`}
                  style={{ background: gradient(i) }}>
                  <div className="aspect-[4/5] lg:aspect-auto lg:h-full">
                    {x.image_url && <img src={x.image_url} alt={x.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />}
                    <span className="absolute inset-0 bg-gradient-to-t from-basil-night/90 via-basil-night/30 to-transparent" />
                    <span className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 text-basil backdrop-blur"><Icon size={19} /></span>
                    <span className="absolute inset-x-4 bottom-4 flex flex-col gap-1.5">
                      <b className={`font-display font-bold leading-tight ${lead ? 'text-[20px] lg:text-[30px]' : 'text-[19px]'}`}>{x.title}</b>
                      <span className={`text-[13.5px] leading-snug text-white/85 ${lead ? 'lg:max-w-md lg:text-base' : 'line-clamp-2'}`}>{x.short}</span>
                      {lead && x.deliverables?.length > 0 && (
                        <span className="mt-1 hidden flex-wrap gap-1.5 lg:flex">{x.deliverables.slice(0, 4).map((d) => <span key={d} className="rounded-full bg-white/15 px-2.5 py-1 text-xs backdrop-blur">{d}</span>)}</span>
                      )}
                      <span className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-basil-sky">Learn more <ArrowRight size={15} className="transition group-hover:translate-x-0.5" /></span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* How we work */}
          <div className="mt-6 rounded-[22px] border border-basil-line bg-white/90 p-4 backdrop-blur sm:mt-8 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <b className="font-display text-lg">How we work</b>
              <Link to="/#book" className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full bg-basil px-4 text-sm font-bold text-white no-underline hover:bg-basil-deep hover:text-white">{t('book')} <ArrowRight size={15} /></Link>
            </div>
            <ol className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4">
              {STEPS.map(([title, line], i) => (
                <li key={title} className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-basil-ice font-display text-sm font-extrabold text-basil">{i + 1}</span>
                  <span className="min-w-0"><b className="block text-[14px]">{title}</b><span className="text-[12.5px] leading-snug text-basil-muted">{line}</span></span>
                </li>
              ))}
            </ol>
          </div>
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

      {news.length > 0 && (
        <section className="container-bm pb-10 sm:pb-16">
          <Head kicker="BASIL HEALTH BRIEF" title="Latest from the newsroom" to="/health-news" link="All news" />
          <div className="snap-row sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible">
            {news.map((n, i) => (
              <Link key={n.id} to={`/health-news/${n.id}`} className="glow-card group flex w-[72vw] max-w-[300px] shrink-0 snap-start flex-col overflow-hidden rounded-[18px] border border-basil-line bg-white text-basil-ink no-underline hover:text-basil-ink sm:w-auto sm:max-w-none">
                <div className="aspect-[16/9] w-full" style={{ background: n.image_url ? `center/cover url(${n.image_url})` : gradient(i) }} />
                <div className="flex flex-1 flex-col gap-1 p-3.5">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-basil">{n.tag}</span>
                  <b className="line-clamp-2 text-[14px] leading-snug group-hover:text-basil">{n.title}</b>
                </div>
              </Link>
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

function GlanceCard({ title, url, poster, sub, index, shape }: { title: string; url: string; poster: string; sub: string; index: number; shape: Orientation }) {
  const [on, setOn] = useState(false);
  const aspect = shape === 'portrait' ? '9 / 16' : '16 / 9';
  return (
    <div className={shape === 'portrait' ? 'w-[46vw] max-w-[230px] shrink-0 snap-start' : 'w-[80vw] max-w-[360px] shrink-0 snap-start sm:w-auto sm:max-w-none'}>
      {on && url ? (
        <div className="overflow-hidden rounded-[20px] shadow-card"><VideoEmbed url={url} title={title} autoPlay aspect={aspect} /></div>
      ) : (
        <button type="button" onClick={() => setOn(true)} aria-label={`Play ${title}`} className="group relative block w-full overflow-hidden rounded-[20px] border-0 p-0 ring-1 ring-white/10 transition duration-300 hover:-translate-y-1 hover:ring-basil-sky/60 hover:shadow-[0_0_40px_-6px_rgba(124,192,245,0.55)]" style={{ aspectRatio: aspect, background: gradient(index) }}>
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
