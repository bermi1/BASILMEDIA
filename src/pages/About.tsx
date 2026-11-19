import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, Building2, CalendarCheck, Camera, Clapperboard, Download, Film, GraduationCap, HeartPulse, Lightbulb, Megaphone, Radio, Sparkles } from 'lucide-react';
import { settingsReady, useRows, useSettings } from '@/hooks/useData';
import { useSeo } from '@/hooks/useSeo';
import { useI18n } from '@/lib/i18n';
import { PageHero } from '@/components/PageHero';

// Basil Media's own words (company profile). Kept here, structured, so the page can lay them out well.
const INTRO = [
  'Basil Media is a media production and digital communications company committed to empowering brands, institutions, organizations, and businesses through creative storytelling, innovative media solutions, and strategic digital visibility.',
  'We specialize in delivering professional media production services that help organizations communicate their impact, tell compelling stories, engage audiences, and strengthen their brand presence.',
];
const SERVICES = [
  { icon: Camera, name: 'Photography', line: 'Corporate, institutional, event, and professional photography.' },
  { icon: Clapperboard, name: 'Videography', line: 'Event coverage, corporate videos, documentaries, and promotional productions.' },
  { icon: Radio, name: 'Live Streaming', line: 'Professional live broadcasting for conferences, meetings, and major events.' },
  { icon: Film, name: 'Documentary Production', line: 'Telling impactful stories through creative visual storytelling.' },
  { icon: Megaphone, name: 'Digital Marketing', line: 'Brand visibility, digital campaigns, and social media management.' },
  { icon: Sparkles, name: 'Content Creation', line: 'Strategic multimedia content for institutions, NGOs, companies, and individuals.' },
  { icon: CalendarCheck, name: 'Event Media Coverage', line: 'Comprehensive photography, videography, interviews, and real-time event updates.' },
];
const FOCUS = [
  { icon: HeartPulse, name: 'Health' },
  { icon: GraduationCap, name: 'Education' },
  { icon: Lightbulb, name: 'Innovation' },
  { icon: Briefcase, name: 'Entrepreneurship' },
  { icon: Building2, name: 'Corporate & Institutional Communications' },
];
const VISION = 'To become a leading African media and communications company, using creativity, technology, and storytelling to inspire change, amplify impact, and create opportunities for the next generation.';
const MISSION = 'To deliver innovative, high-quality media and digital communication solutions while creating opportunities for young people to develop practical skills, gain experience, and participate in the creative economy.';

export default function About() {
  const s = useSettings();
  const { t } = useI18n();
  useSeo('About Us', INTRO[0]);
  const { rows: allPartners } = useRows('partners');
  // one logo per partner, even if the same partner was saved twice
  const partners = allPartners.filter((p, i, a) => a.findIndex((q) => q.name.trim().toLowerCase() === p.name.trim().toLowerCase()) === i);

  return (
    <>
      <PageHero kicker={t('about').toUpperCase()} image="/img/team/crew-on-set.webp"
        title={<>Empowering the next generation <span className="text-glow">through media.</span></>}
        sub="Media production and digital communications for brands, institutions, organizations and businesses." />

      {/* WHO WE ARE — the team beside our own words */}
      <section className="container-bm section grid items-center gap-6 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
        <div className="relative">
          {settingsReady()
            ? <img src={s.about_image_url || '/img/team/basil-media-team.webp'} alt="The Basil Media team" className="block h-auto w-full rounded-[24px] shadow-card" />
            : <div className="aspect-[16/10] w-full rounded-[24px] bg-basil-mist" />}
          <span className="absolute -bottom-3 left-4 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-basil-deep shadow-card"><span className="h-2 w-2 rounded-full bg-emerald-500" />Upanga, Dar es Salaam</span>
        </div>
        <div className="pt-2 lg:pt-0">
          <div className="kicker">WHO WE ARE</div>
          <p className="m-0 mt-2 font-display text-[18px] font-semibold leading-snug text-basil-ink sm:text-[22px]">{INTRO[0]}</p>
          <p className="m-0 mt-3 text-[14.5px] leading-relaxed text-basil-muted sm:text-[15.5px]">{INTRO[1]}</p>
        </div>
      </section>

      {/* WHAT WE DO */}
      <section className="bg-basil-mist">
        <div className="container-bm section">
          <div className="kicker">WHAT WE DO</div>
          <h2 className="h-section m-0 mt-1">Our services</h2>
          <ul className="m-0 mt-5 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
            {SERVICES.map(({ icon: Icon, name, line }, i) => (
              <li key={name} className={`glow-card flex gap-3 rounded-[20px] border border-basil-line bg-white p-4 sm:flex-col sm:p-5 ${i === SERVICES.length - 1 ? 'sm:col-span-2 lg:col-span-1' : ''}`}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-basil-ice text-basil"><Icon size={21} /></span>
                <span className="min-w-0">
                  <b className="block font-display text-[15px] leading-tight">{name}</b>
                  <span className="mt-1 block text-[13px] leading-snug text-basil-muted">{line}</span>
                </span>
              </li>
            ))}
            <li className="hidden lg:block">
              <Link to="/#book" className="flex h-full flex-col justify-between gap-3 rounded-[20px] bg-basil p-5 text-white no-underline hover:bg-basil-deep hover:text-white">
                <b className="font-display text-[15px] leading-tight">Have a project in mind?</b>
                <span className="inline-flex items-center gap-1 text-[13px] font-semibold">Book a session <ArrowRight size={14} /></span>
              </Link>
            </li>
          </ul>
        </div>
      </section>

      {/* FOCUS AREAS */}
      <section className="container-bm section">
        <div className="kicker">OUR FOCUS AREAS</div>
        <h2 className="h-section m-0 mt-1">Where our stories come from</h2>
        <ul className="m-0 mt-5 flex list-none flex-wrap gap-2 p-0 sm:gap-2.5">
          {FOCUS.map(({ icon: Icon, name }) => (
            <li key={name} className="flex items-center gap-2 rounded-full border border-basil-line bg-white py-2 pl-2 pr-4 text-[13.5px] font-semibold text-basil-ink sm:text-[14.5px]">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-basil-ice text-basil"><Icon size={16} /></span>{name}
            </li>
          ))}
        </ul>
      </section>

      {/* VISION + MISSION */}
      <section className="container-bm grid gap-3 pb-10 sm:grid-cols-2 sm:gap-4 sm:pb-14">
        <div className="on-dark relative overflow-hidden rounded-[24px] bg-basil p-5 text-white sm:p-7">
          <div aria-hidden="true" className="aurora -right-16 -top-16 h-48 w-48 bg-basil-sky" />
          <div className="relative font-mono text-[11px] tracking-[0.18em] text-basil-frost">OUR VISION</div>
          <p className="relative mb-0 mt-2 font-display text-[16px] font-semibold leading-snug sm:text-[19px]">{VISION}</p>
        </div>
        <div className="on-dark relative overflow-hidden rounded-[24px] bg-basil-deep p-5 text-white sm:p-7">
          <div aria-hidden="true" className="aurora -bottom-16 -left-16 h-48 w-48 bg-sun/50" />
          <div className="relative font-mono text-[11px] tracking-[0.18em] text-basil-haze">OUR MISSION</div>
          <p className="relative mb-0 mt-2 font-display text-[16px] font-semibold leading-snug sm:text-[19px]">{MISSION}</p>
        </div>
      </section>

      {/* PARTNERS */}
      {partners.length > 0 && (
        <section className="container-bm pb-10 sm:pb-14">
          <h2 className="m-0 mb-4 text-center text-[20px] font-extrabold sm:text-2xl">{t('partnersWith')}</h2>
          {/* Centred, wrapping rows: the last row is balanced instead of leaving empty cells */}
          <div className="flex flex-wrap justify-center gap-2.5 sm:gap-4">
            {partners.map((p) => (
              <span key={p.id} className="keep-light glow-card flex h-20 w-[calc((100%-0.625rem)/2)] items-center justify-center rounded-[16px] border border-basil-line bg-white px-3 text-center text-sm font-bold text-basil-deep sm:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-4rem)/5)]">
                <Logo name={p.name} src={p.logo_url} />
              </span>
            ))}
          </div>
        </section>
      )}

      {/* CLOSING LINE */}
      <section className="container-bm pb-12 sm:pb-20">
        <div className="on-dark flex flex-col items-start gap-4 rounded-[24px] p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8" style={{ background: 'radial-gradient(circle at 85% 20%, rgba(124,192,245,0.35), transparent 50%), linear-gradient(135deg, #0F6EC2, #0A2F5C)' }}>
          <p className="m-0 font-display text-[19px] font-bold leading-snug sm:text-[24px]">Basil Media — <span className="text-glow">Empowering the Next Generation Through Media.</span></p>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link to="/#book" className="inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-5 text-[14px] font-semibold text-basil no-underline hover:bg-basil-ice">{t('book')} <ArrowRight size={15} /></Link>
            {s.company_profile_url && (
              <a href={s.company_profile_url} target="_blank" rel="noreferrer" download className="inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/40 px-5 text-[14px] font-semibold text-white no-underline hover:bg-white/10 hover:text-white"><Download size={16} />{t('downloadProfile')}</a>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

/** Partner logo, or the name if there is no logo or it fails to load. */
function Logo({ name, src }: { name: string; src: string }) {
  const [bad, setBad] = useState(false);
  return src && !bad ? <img src={src} alt={name} onError={() => setBad(true)} className="max-h-12 max-w-[140px] object-contain" /> : <>{name}</>;
}
