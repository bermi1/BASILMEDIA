import { Link } from 'react-router-dom';
import { Clapperboard, Compass, Download, MapPin, Target } from 'lucide-react';
import { useRows, useSettings } from '@/hooks/useData';
import { useSeo } from '@/hooks/useSeo';
import { useI18n } from '@/lib/i18n';
import { Reveal } from '@/components/Reveal';
import { PageHero } from '@/components/PageHero';
import { Instagram, LinkedIn } from '@/components/icons';
import type { TeamMember } from '@/lib/types';

/** Columns per row that keep the team balanced: 6 → 3+3, 5 → 3+2 centred, 8 → 4+4, 7 → 4+3 centred. */
function lgCols(n: number) {
  if (n <= 4) return n || 1;
  if (n % 4 === 0) return 4;
  if (n % 3 === 0) return 3;
  return 4;
}
const WIDTH: Record<number, string> = {
  1: 'lg:w-[300px]', 2: 'lg:w-[calc((100%-1.5rem)/2)] lg:max-w-[320px]', 3: 'lg:w-[calc((100%-3rem)/3)]', 4: 'lg:w-[calc((100%-4.5rem)/4)]',
};

export default function About() {
  const s = useSettings();
  const { t } = useI18n();
  useSeo('About Us', s.mission);
  const { rows: team } = useRows('team', { publishedOnly: true });
  const { rows: partners } = useRows('partners');
  const { rows: services } = useRows('services', { publishedOnly: true });
  const lead = (s.about_story.match(/^.*?[.!?](\s|$)/)?.[0] ?? s.about_story).trim();
  const cols = lgCols(team.length);

  const cards = [
    { icon: Target, title: 'Mission', body: <p className="m-0">{s.mission}</p> },
    { icon: Compass, title: 'Vision', body: <p className="m-0">{s.vision}</p> },
    { icon: Clapperboard, title: 'What we do', body: <div className="flex flex-wrap gap-1.5">{services.map((x) => <Link key={x.id} to={`/services#${x.slug}`} className="rounded-full bg-basil-ice px-2.5 py-1 text-[12.5px] font-medium text-basil-deep no-underline hover:bg-basil hover:text-white">{x.title}</Link>)}</div> },
    { icon: MapPin, title: 'Where to find us', body: <p className="m-0">{s.address}{s.office_hours && <><br /><span className="text-basil-muted">{s.office_hours}</span></>}</p> },
  ];

  return (
    <>
      <PageHero kicker={t('about').toUpperCase()} title={<>A Dar es Salaam studio that <span className="text-glow">tells Tanzania’s stories.</span></>} image={s.about_image_url || undefined} />

      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="bg-dots fade-mask absolute inset-0" />
        <div className="container-bm section relative">
          <Reveal><p className="m-0 max-w-[820px] font-display text-[clamp(18px,2.4vw,28px)] font-semibold leading-snug tracking-[-0.01em] text-basil-ink">{lead}</p></Reveal>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {cards.map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={i * 0.05}>
                <div className="glow-card flex h-full flex-col gap-3 rounded-[20px] border border-basil-line bg-white/90 p-5 text-[14.5px] leading-relaxed text-[#33465F] backdrop-blur">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-basil text-white"><Icon size={19} /></span>
                  <b className="font-display text-[16px] text-basil-ink">{title}</b>
                  {body}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {team.length > 0 && (
        <section className="section bg-basil-mist">
          <div className="container-bm">
            <div className="mb-6 text-center sm:mb-8"><div className="kicker">THE PEOPLE</div><h2 className="h-section m-0 mt-1">{t('team')}</h2></div>
            <div className={`mx-auto flex flex-wrap justify-center gap-3 sm:gap-6 ${cols === 4 ? "max-w-[1100px]" : "max-w-[880px]"}`}>
              {team.map((m, i) => (
                <Reveal key={m.id} delay={i * 0.04} className={`w-[calc((100%-0.75rem)/2)] sm:w-[calc((100%-3rem)/3)] ${WIDTH[cols]}`}>
                  <Member m={m} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {(partners.length > 0 || s.company_profile_url) && (
        <section className="container-bm section flex flex-col items-center gap-5 text-center">
          {partners.length > 0 && (
            <>
              <div className="kicker">{t('partnersWith').toUpperCase()}</div>
              <div className="flex flex-wrap justify-center gap-x-10 gap-y-5">
                {partners.map((p) => <span key={p.id} className="flex h-12 items-center font-display font-bold text-basil-muted">{p.logo_url ? <img src={p.logo_url} alt={p.name} className="h-10 max-w-[140px] object-contain grayscale transition hover:grayscale-0" loading="lazy" /> : p.name}</span>)}
              </div>
            </>
          )}
          {s.company_profile_url && <a href={s.company_profile_url} target="_blank" rel="noreferrer" download className="btn-primary"><Download size={18} />{t('downloadProfile')}</a>}
        </section>
      )}
    </>
  );
}

function Member({ m }: { m: TeamMember }) {
  const social = (href: string | undefined, label: string, Icon: typeof Instagram) =>
    href ? <a href={href} target="_blank" rel="noreferrer" aria-label={`${m.name} on ${label}`} onClick={(e) => e.stopPropagation()} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white hover:text-basil"><Icon width={17} height={17} /></a> : null;
  return (
    <figure tabIndex={0} className="group relative m-0 aspect-[4/5] overflow-hidden rounded-[22px] shadow-[0_18px_40px_-18px_rgba(10,47,92,0.45)] outline-none" style={{ background: 'linear-gradient(160deg, #2B86DA, #0A2F5C)' }}>
      {m.photo_url ? (
        <img src={m.photo_url} alt={m.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105 group-focus:scale-105" />
      ) : (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center font-display text-[72px] font-bold text-white/20">{m.name[0]}</span>
      )}
      {/* Blue wash on hover/focus */}
      <span aria-hidden="true" className="absolute inset-0 bg-basil/0 transition duration-300 group-hover:bg-basil/55 group-focus:bg-basil/55" />
      {/* Name and role always visible; bio slides in on hover */}
      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-basil-night/90 via-basil-night/40 to-transparent p-3 pt-12 text-white sm:p-4 sm:pt-14">
        <b className="block font-display text-[15px] font-semibold leading-tight sm:text-[17px]">{m.name}</b>
        <span className="block text-[12px] text-basil-frost sm:text-[13px]">{m.role}</span>
        {m.bio && <span className="mt-0 block max-h-0 overflow-hidden text-[12.5px] leading-snug text-white/90 opacity-0 transition-all duration-300 group-hover:mt-2 group-hover:max-h-24 group-hover:opacity-100 group-focus:mt-2 group-focus:max-h-24 group-focus:opacity-100">{m.bio}</span>}
        {(m.instagram_url || m.linkedin_url) && (
          <span className="mt-2 flex gap-1.5">
            {social(m.instagram_url, 'Instagram', Instagram)}
            {social(m.linkedin_url, 'LinkedIn', LinkedIn)}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
