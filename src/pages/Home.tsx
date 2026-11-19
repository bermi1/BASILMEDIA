import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Briefcase, CalendarDays, Camera, ChevronDown, ChevronLeft, ChevronRight, HeartPulse, Lightbulb, Mic, Radio, Sparkles, Star, Users, Video } from 'lucide-react';
import { settingsReady, useRows, useSettings } from '@/hooks/useData';
import { useSeo } from '@/hooks/useSeo';
import { useMeasuredShapes } from '@/lib/videoShape';
import { useI18n } from '@/lib/i18n';
import { useCover } from '@/lib/useCover';
import { parseVideo, videoLabel, videoOrientation, youtubeThumb, type Orientation } from '@/lib/video';
import { HeroSlides } from '@/components/HeroSlides';
import { gradient } from '@/components/Media';
import { VideoEmbed } from '@/components/VideoEmbed';
import { Reveal } from '@/components/Reveal';
import { BookingForm } from '@/components/BookingForm';
import { WorkShowcase } from '@/components/WorkShowcase';
import { WorkPlayer } from '@/components/WorkPlayer';
import { Play } from '@/components/icons';

const HERO_WORDS_SECONDS = 10;
const CEO_MESSAGE = 'We started Basil Media to make health information something people actually want to watch. Every film, photo and podcast we make is built with clinicians and told for the people it is meant to help. Thank you for trusting us with your stories — let us keep telling them, together.';
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
  const { rows: allPartners } = useRows('partners');
  // one logo per partner, even if the same partner was saved twice
  const partners = allPartners.filter((p, i, a) => a.findIndex((q) => q.name.trim().toLowerCase() === p.name.trim().toLowerCase()) === i);
  const { rows: projects } = useRows('projects_public', { publishedOnly: true });
  const { rows: highlights } = useRows('highlights', { publishedOnly: true });
  const { rows: services } = useRows('services', { publishedOnly: true });
  const { rows: testimonials } = useRows('testimonials', { publishedOnly: true, columns: 'id,company,quote,rating,sort_order,published' });
  const photos = s.hero_images?.length ? s.hero_images : s.hero_image_url ? [s.hero_image_url] : [];
  // Work at a glance: the reels first, then featured projects. Uploaded files are measured so a
  // vertical film is laid out (and plays) vertically unless the CMS says otherwise.
  const measured = useMeasuredShapes([...highlights.map((h) => h.video_url), ...projects.map((p) => p.video_url)]);
  const shapeOf = (url: string, override?: string | null) => (override === 'portrait' || override === 'landscape' ? override : measured[url] ?? videoOrientation(url, override));
  const glance = [
    ...highlights.filter((h) => parseVideo(h.video_url).kind !== 'instagram').map((h) => ({ id: h.id, title: h.title, url: h.video_url, poster: h.thumbnail_url || youtubeThumb(h.video_url), sub: videoLabel(h.video_url) || 'Reel', cat: 'Reels', shape: shapeOf(h.video_url, h.orientation) })),
    ...projects.map((p) => {
      const photo = p.category === 'Photo Stories' || /pixieset\.com/i.test(p.external_url ?? '');
      return { id: p.id, title: p.title, url: photo ? '' : p.video_url, link: p.external_url, poster: p.image_url || youtubeThumb(p.video_url), sub: photo ? 'Photo gallery' : p.category, cat: p.category as string, shape: photo ? 'landscape' as const : shapeOf(p.video_url, p.orientation), desc: p.description, client: p.client };
    }),
  ]
    // nothing without a picture or a film: no empty placeholder boxes on the page
    .filter((g) => g.poster || parseVideo(g.url).kind === 'file');
  // Four simple buttons: Videos · Photos · Live stream · Podcasts (a button shows only when it has items).
  const kind = (g: { cat: string; title: string; link?: string; url: string }) =>
    g.cat === 'Photo Stories' || /pixieset\.com/i.test(g.link ?? '') ? 'Photos' : g.cat === 'Podcasts' ? 'Podcasts' : /\blive\b/i.test(g.title) ? 'Live stream' : 'Videos';
  const cats = ['Videos', 'Photos', 'Live stream', 'Podcasts'].filter((k) => glance.some((g) => kind(g) === k));
  const [catState, setCat] = useState('Videos');
  const [more, setMore] = useState(false);
  const [playing, setPlaying] = useState<number | null>(null);
  // Hero words show for the first seconds of the film (again each time it starts over), then the film plays clean.
  const [heroWords, setHeroWords] = useState(true);
  const cat = cats.includes(catState) ? catState : cats[0] ?? 'Videos';
  const shown = glance.filter((g) => kind(g) === cat);

  return (
    <>
      {/* HERO — the picture/video speaks; few words */}
      <section className="on-dark relative isolate flex h-[calc(76px+56.25vw)] items-end justify-center overflow-hidden text-center text-white sm:h-auto sm:min-h-[80vh]" style={{ background: 'radial-gradient(ellipse at 15% 20%, rgba(124,192,245,0.35), transparent 50%), radial-gradient(ellipse at 90% 85%, rgba(245,185,66,0.2), transparent 45%), linear-gradient(160deg, #0A2F5C, #061E3D)' }}>
        <div className="absolute inset-x-0 bottom-0 top-[76px] overflow-hidden sm:top-0"><HeroSlides images={photos} video={s.hero_video_url} onTime={(t) => setHeroWords(t < HERO_WORDS_SECONDS)} /></div>
        <div className={`absolute inset-x-0 bottom-0 top-[76px] transition-opacity duration-1000 sm:top-0 ${heroWords ? 'opacity-100' : 'opacity-0'}`} style={{ background: 'linear-gradient(180deg, rgba(6,30,61,0.35) 0%, rgba(6,30,61,0) 35%, rgba(6,30,61,0.6) 72%, rgba(6,30,61,0.92) 100%)' }} />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={heroWords ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }} transition={{ duration: heroWords ? 0.7 : 1, ease: [0.22, 1, 0.36, 1] }} aria-hidden={!heroWords} style={{ pointerEvents: heroWords ? undefined : 'none' }} className="container-bm relative flex flex-col items-center pb-3 pt-0 sm:pb-16 sm:pt-24">
          <h1 className="m-0 max-w-[640px] text-[15px] font-bold leading-[1.2] tracking-[-0.01em] sm:text-[clamp(20px,3vw,36px)] sm:leading-[1.15] sm:tracking-[-0.02em]">
            {settingsReady() && <>{s.tagline} <span className="text-glow">{s.tagline_highlight}</span></>}
          </h1>
          {s.hero_subtitle && <p className="m-0 mt-3 hidden max-w-[440px] text-base text-basil-frost sm:block">{s.hero_subtitle}</p>}
          <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:mt-6 sm:gap-3">
            <Link to="/#book" className="group flex h-8 items-center gap-1 whitespace-nowrap rounded-full bg-white px-3.5 text-[12px] font-semibold sm:gap-1.5 text-basil no-underline hover:bg-basil-ice sm:h-12 sm:px-6 sm:text-[15px]">{t('book')}<ArrowRight size={16} className="transition group-hover:translate-x-1" /></Link>
            <Link to="/our-work" className="flex h-8 items-center gap-1 whitespace-nowrap rounded-full border border-white/35 bg-white/10 px-3.5 text-[12px] font-semibold sm:gap-1.5 text-white no-underline backdrop-blur hover:bg-white/20 hover:text-white sm:h-12 sm:px-6 sm:text-[15px]"><Play size={15} color="#FFFFFF" />{t('viewWork')}</Link>
          </div>
        </motion.div>
        <a href="#trusted" aria-label="Scroll down" className="absolute bottom-[104px] right-5 hidden h-12 w-12 animate-float items-center justify-center rounded-full border border-white/30 text-white no-underline sm:bottom-8 sm:flex"><ChevronDown size={20} /></a>
      </section>

      {/* TRUSTED BY — two rows of partner logos scrolling in opposite directions (logos or name badges, set in the CMS) */}
      {partners.length > 0 && (
        <section id="trusted" aria-label="Trusted by" className="border-b border-[#E3EDF8] bg-white py-5 sm:py-7">
          <div className="container-bm mb-3 font-mono text-[10.5px] tracking-[0.18em] text-basil-muted">TRUSTED BY</div>
          <div className="flex flex-col gap-3 [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
            {[partners.filter((_, i) => i % 2 === 0), partners.filter((_, i) => i % 2 === 1)].filter((row) => row.length).map((row, r) => (
              <div key={r} className="overflow-hidden">
                <ul className={`m-0 flex w-max list-none items-center gap-3 p-0 hover:[animation-play-state:paused] ${r ? 'animate-marquee-reverse' : 'animate-marquee'}`}>
                  {[...row, ...row, ...row, ...row].map((p, i) => (
                    <li key={i} aria-hidden={i >= row.length} className="keep-light flex h-16 shrink-0 items-center justify-center rounded-2xl border border-basil-line bg-white px-5 sm:h-[76px] sm:px-6">
                      <PartnerMark name={p.name} logo={p.logo_url} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
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
            <h2 className="mb-0 mt-2 font-display text-[clamp(18px,2.2vw,28px)] font-bold leading-[1.2] tracking-[-0.015em]">{s.home_about_title}</h2>
            <p className="m-0 mt-3 max-w-[560px] text-[14px] leading-relaxed text-basil-muted sm:text-[15.5px]">{s.home_about_text}</p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {PILLARS.map(([label, Icon]) => <span key={label} className="flex items-center gap-1.5 rounded-full bg-basil-ice px-3 py-1.5 text-[13px] font-semibold text-basil-deep"><Icon size={16} className="text-basil" />{label}</span>)}
              <Link to="/about" className="ml-1 flex items-center gap-1 text-sm font-bold no-underline">Our story <ArrowRight size={15} /></Link>
            </div>
          </div>
          {settingsReady() && s.about_image_url && (
            <div className="relative rounded-[28px] p-[1.5px] shadow-[0_30px_80px_-20px_rgba(15,110,194,0.45)]" style={{ background: 'linear-gradient(135deg, #7CC0F5, #0F6EC2 45%, #F5B942)' }}>
              <img src={s.about_image_url} alt="Basil Media studio" className="aspect-[16/10] w-full rounded-[26px] object-cover" />
              <span className="absolute -bottom-3 left-5 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-basil-deep shadow-card"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />Studio · Upanga, Dar es Salaam</span>
            </div>
          )}
        </Reveal>
        </div>
      </section>

      {/* A WORD FROM OUR CEO */}
      <section className="container-bm section">
        <Reveal>
          <figure className="on-dark relative m-0 overflow-hidden rounded-[24px] bg-gradient-to-br from-basil-deep to-basil-night p-5 text-white sm:p-8">
            <div aria-hidden="true" className="aurora -right-16 -top-16 h-64 w-64 bg-basil" />
            <div className="relative grid items-center gap-5 sm:grid-cols-[auto_1fr] sm:gap-8">
              <div className="flex items-center gap-4 sm:flex-col sm:items-start">
                {/* Founder photo: a clean rectangular portrait card */}
                {!settingsReady() ? <span className="aspect-[4/5] w-24 shrink-0 rounded-2xl bg-white/10 sm:w-36" /> : s.ceo_photo_url
                  ? <img src={s.ceo_photo_url} alt={s.ceo_name} className="aspect-[4/5] w-24 shrink-0 rounded-2xl object-cover object-top shadow-[0_18px_40px_-14px_rgba(0,0,0,0.6)] ring-1 ring-white/15 sm:w-36" />
                  : <span className="flex aspect-[4/5] w-24 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 sm:w-36"><img src="/logo-reverse.svg" alt="" className="h-12 w-12 sm:h-16 sm:w-16" /></span>}
                <figcaption className="leading-tight">
                  <span className="block font-mono text-[10.5px] tracking-[0.18em] text-basil-haze">A WORD FROM OUR CEO</span>
                  <b className="mt-1 block font-display text-lg sm:text-xl">{s.ceo_name || 'Emmanuel Basil'}</b>
                  <span className="text-sm text-basil-haze">{s.ceo_title || 'Founder & CEO, Basil Media'}</span>
                </figcaption>
              </div>
              <div>
              <blockquote className={`m-0 text-[14.5px] leading-relaxed text-white/90 sm:text-[17px] sm:leading-[1.6] ${more ? '' : 'line-clamp-5 sm:line-clamp-none'}`}>
                <span aria-hidden="true" className="mr-1 font-display text-4xl leading-none text-basil-sky">“</span>{(s.ceo_message || CEO_MESSAGE).replace(/”[^”]*$/, (tail) => (s.ceo_name && tail.includes(s.ceo_name.split(' ')[0]) ? '”' : tail))}
              </blockquote>
              {!more && <button type="button" onClick={() => setMore(true)} className="mt-2 border-0 bg-transparent p-0 text-[13px] font-semibold text-basil-sky sm:hidden">Read more</button>}
              </div>
            </div>
          </figure>
        </Reveal>
      </section>

      {/* WORK AT A GLANCE — an interactive showcase */}
      {glance.length > 0 && (
        <section className="section relative overflow-hidden bg-basil-night">
          <div aria-hidden="true" className="bg-dots-dark fade-mask absolute inset-0" />
          <div aria-hidden="true" className="aurora -left-20 top-0 h-80 w-80 bg-basil" />
          <div aria-hidden="true" className="aurora -right-16 bottom-0 h-64 w-64 bg-sun/60 [animation-delay:-4s]" />
          <div className="container-bm relative">
            <Head dark kicker="OUR WORK AT A GLANCE" title="Stories we have told" to="/our-work" link="All work" />
            <div role="tablist" aria-label="Filter work" className="scrollbar-none -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              {cats.map((c) => (
                <button key={c} type="button" role="tab" aria-selected={cat === c} onClick={() => setCat(c)} className={`h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium transition ${cat === c ? 'border-0 bg-white text-basil-night shadow-[0_0_24px_rgba(124,192,245,0.55)]' : 'border border-white/20 bg-white/[0.06] text-white/80 backdrop-blur hover:bg-white/15'}`}>{c}</button>
              ))}
            </div>
            {/* Player on top; every video (or every photo gallery) in one row beneath it */}
            <WorkShowcase key={cat} items={shown} onOpen={setPlaying} />
            <WorkPlayer items={shown} index={playing} onIndex={setPlaying} onClose={() => setPlaying(null)} />
          </div>
        </section>
      )}

      {/* SERVICES — one sliding row of compact icon cards (no photos), then how we work */}
      <section className="relative">
        <div aria-hidden="true" className="bg-dots fade-mask absolute inset-0 opacity-70" />
        <div className="container-bm section relative">
          <Head kicker={t('services').toUpperCase()} title={t('servicesTitle')} to="/services" link="All" />
          <ServiceCarousel services={services} />
          {/* How we work */}
          <div className="mt-5 rounded-[22px] border border-basil-line bg-white/90 p-4 backdrop-blur sm:mt-6 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <b className="font-display text-base">How we work</b>
              <Link to="/#book" className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full bg-basil px-4 text-sm font-bold text-white no-underline hover:bg-basil-deep hover:text-white">{t('book')} <ArrowRight size={15} /></Link>
            </div>
            <Steps />
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
                <blockquote className="mx-0 my-2 line-clamp-4 text-[13px] leading-snug sm:text-[14px] sm:leading-relaxed">“{x.quote}”</blockquote>
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

/** Services as one sliding row: moves on by one card every few seconds, loops, pauses when touched or hovered,
 *  swipes with a finger. A thin bar shows where you are in the row. */
function ServiceCarousel({ services }: { services: { id: string; slug: string; title: string; short: string; icon: string }[] }) {
  const row = useRef<HTMLDivElement>(null);
  const [hold, setHold] = useState(false);
  const [pos, setPos] = useState(0); // 0..1 across the row
  const step = (d: number) => {
    const el = row.current;
    if (!el) return;
    const card = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? 240;
    const end = el.scrollWidth - el.clientWidth;
    const next = d > 0 && el.scrollLeft >= end - 4 ? 0 : d < 0 && el.scrollLeft <= 4 ? end : el.scrollLeft + d * (card + 12);
    el.scrollTo({ left: next, behavior: 'smooth' });
  };
  useEffect(() => {
    if (hold || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => step(1), 3200);
    return () => clearInterval(t);
  }, [hold]);
  return (
    <div onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} onTouchStart={() => setHold(true)} onFocus={() => setHold(true)}>
      <div ref={row} onScroll={(e) => { const el = e.currentTarget; setPos(el.scrollLeft / Math.max(1, el.scrollWidth - el.clientWidth)); }}
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 py-2 sm:mx-0 sm:scroll-px-0 sm:px-0">
        {services.map((x) => {
          const Icon = ICONS[x.icon] ?? Video;
          return (
            <Link key={x.id} to={`/services#${x.slug}`} data-tilt className="glow-card group flex w-[74vw] max-w-[300px] shrink-0 snap-start items-start gap-3 rounded-[20px] border border-basil-line bg-white/90 p-4 text-basil-ink no-underline backdrop-blur hover:text-basil-ink sm:w-[280px]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-basil-ice text-basil transition group-hover:bg-basil group-hover:text-white"><Icon size={20} /></span>
              <span className="min-w-0">
                <b className="block font-display text-[14px] font-semibold leading-tight sm:text-[15px]">{x.title}</b>
                <span className="mt-1 line-clamp-2 block text-[12.5px] leading-snug text-basil-muted">{x.short}</span>
                <span className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-bold text-basil">Learn more <ArrowRight size={13} className="transition group-hover:translate-x-0.5" /></span>
              </span>
            </Link>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-basil-line">
          <span className="absolute inset-y-0 left-0 w-1/4 rounded-full bg-basil transition-[left] duration-300" style={{ left: `${pos * 75}%` }} />
        </span>
        <button type="button" onClick={() => step(-1)} aria-label="Previous services" className="flex h-8 w-8 items-center justify-center rounded-full border border-basil-line bg-white text-basil-deep transition hover:bg-basil hover:text-white"><ChevronLeft size={15} /></button>
        <button type="button" onClick={() => step(1)} aria-label="More services" className="flex h-8 w-8 items-center justify-center rounded-full border border-basil-line bg-white text-basil-deep transition hover:bg-basil hover:text-white"><ChevronRight size={15} /></button>
      </div>
    </div>
  );
}

/** How we work: the four steps light up one after another; point at (or tap) a step to hold it. */
function Steps() {
  const [on, setOn] = useState(0);
  const [hold, setHold] = useState(false);
  useEffect(() => {
    if (hold) return;
    const t = setInterval(() => setOn((n) => (n + 1) % STEPS.length), 2600);
    return () => clearInterval(t);
  }, [hold]);
  return (
    <ol className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-4" onMouseLeave={() => setHold(false)}>
      {STEPS.map(([title, line], i) => (
        <li key={title}>
          <button type="button" onMouseEnter={() => (setOn(i), setHold(true))} onClick={() => (setOn(i), setHold(true))} aria-pressed={on === i}
            className={`relative flex h-full w-full gap-2.5 overflow-hidden rounded-2xl border-0 p-2.5 text-left transition duration-300 ${on === i ? 'bg-basil-ice' : 'bg-transparent'}`}>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-extrabold transition duration-300 ${on === i ? 'scale-110 bg-basil text-white shadow-glow' : 'bg-basil-ice text-basil'}`}>{i + 1}</span>
            <span className="min-w-0"><b className="block text-[13px] text-basil-ink">{title}</b><span className="block text-[12px] leading-snug text-basil-muted">{line}</span></span>
            {on === i && !hold && <motion.span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-basil" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 2.6, ease: 'linear' }} />}
          </button>
        </li>
      ))}
    </ol>
  );
}

/** Partner logo, or the name as a badge if there is no logo or it fails to load (never a broken image). */
function PartnerMark({ name, logo }: { name: string; logo: string }) {
  const [failed, setFailed] = useState(false);
  return logo && !failed
    ? <img src={logo} alt={name} onError={() => setFailed(true)} className="h-11 max-w-[160px] object-contain transition duration-300 sm:h-[54px] md:opacity-70 md:grayscale md:hover:opacity-100 md:hover:grayscale-0" />
    : <span className="whitespace-nowrap font-display text-[14px] font-bold text-basil-deep sm:text-[15px]">{name}</span>;
}

export type GlanceItem = { id: string; title: string; url: string; link?: string; poster: string; sub: string; shape: Orientation; desc?: string; client?: string };
export function JustifiedRows({ items, keepAll = false, onOpen }: { items: GlanceItem[]; keepAll?: boolean; onOpen?: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const gap = w < 640 ? 12 : 16;
  const target = w < 640 ? 250 : w < 1024 ? 240 : 280;
  const ar = (g: GlanceItem) => (g.shape === 'portrait' ? 9 / 16 : 16 / 9);
  const rows: GlanceItem[][] = [];
  let row: GlanceItem[] = [];
  for (const g of items) {
    row.push(g);
    const natural = row.reduce((a, x) => a + ar(x), 0) * target + gap * (row.length - 1);
    if (natural >= w) (rows.push(row), (row = []));
  }
  // A short leftover row would either stretch huge or leave a gap — keep it only if it is the only row.
  if (row.length && (!rows.length || row.reduce((a, x) => a + ar(x), 0) * target + gap * (row.length - 1) >= w * 0.75)) rows.push(row);
  // keepAll: never drop work — a short last row is shown at its natural height, centred.
  const leftover = keepAll && row.length && rows[rows.length - 1] !== row ? row : null;
  if (leftover) rows.push(leftover);
  return (
    <div ref={ref} className="flex flex-col" style={{ gap }}>
      {w > 0 && rows.map((r, ri) => {
        const sum = r.reduce((a, x) => a + ar(x), 0);
        const h = r === leftover ? Math.min(target, (w - gap * (r.length - 1)) / sum) : Math.min((w - gap * (r.length - 1)) / sum, target * 1.6);
        return (
          <div key={ri} className="flex justify-center" style={{ gap, height: h }}>
            {r.map((g, i) => <div key={g.id} style={{ width: ar(g) * h, height: h }}><GlanceCard {...g} index={ri * 4 + i} onOpen={onOpen && (() => onOpen(items.indexOf(g)))} /></div>)}
          </div>
        );
      })}
    </div>
  );
}

export function GlanceCard({ title, url, link, poster: saved, sub, index, shape, onOpen }: { title: string; url: string; link?: string; poster: string; sub: string; index: number; shape: Orientation; onOpen?: () => void }) {
  const [on, setOn] = useState(false);
  const poster = useCover(link, saved);
  const aspect = shape === 'portrait' ? '9 / 16' : '16 / 9';
  return (
    <div className="h-full w-full">
      {on && url ? (
        <div className="h-full overflow-hidden rounded-2xl shadow-card [&>div]:h-full"><VideoEmbed url={url} title={title} autoPlay aspect={aspect} /></div>
      ) : (
        <button type="button" onClick={() => (onOpen ? onOpen() : url ? setOn(true) : link && window.open(link, '_blank', 'noopener'))} aria-label={url ? `Play ${title}` : `Open the ${title} gallery`} title={title} className="group relative block h-full w-full overflow-hidden rounded-2xl border-0 p-0 ring-1 ring-white/10 transition duration-300 hover:ring-white/40" style={{ background: gradient(index) }}>
          {poster && <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />}
          {!poster && link && <span aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-white/85"><Camera size={26} /><span className="text-[10px] font-bold uppercase tracking-[0.18em]">Photo gallery</span></span>}
          {/* minimal overlay: a thin fade at the very bottom, a small play icon in the corner */}
          <span className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/60 to-transparent" />
          {url && <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/35 text-white ring-1 ring-white/30 backdrop-blur-md transition group-hover:bg-white group-hover:text-basil-night"><Play size={11} /></span>}
          <span className="absolute inset-x-2.5 bottom-2 truncate text-left text-[11px] font-medium leading-tight text-white/90 sm:text-[12px]">
            {sub && shape === 'landscape' && <span className="mr-1 font-bold uppercase tracking-wide text-white/60">{sub} ·</span>}{title}
          </span>
        </button>
      )}
    </div>
  );
}
