import { Link } from 'react-router-dom';
import { Clapperboard, Compass, Download, MapPin, Target } from 'lucide-react';
import { useRows, useSettings } from '@/hooks/useData';
import { useSeo } from '@/hooks/useSeo';
import { useI18n } from '@/lib/i18n';
import { Reveal } from '@/components/Reveal';
import { PageHero } from '@/components/PageHero';
import { PartnerLogo, uniquePartners } from '@/components/PartnerLogo';

export default function About() {
  const s = useSettings();
  const { t } = useI18n();
  useSeo('About Us', s.mission);
  const { rows: partnerRows } = useRows('partners');
  const partners = uniquePartners(partnerRows);
  const { rows: services } = useRows('services', { publishedOnly: true });
  const lead = (s.about_story.match(/^.*?[.!?](\s|$)/)?.[0] ?? s.about_story).trim();

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

      {(partners.length > 0 || s.company_profile_url) && (
        <section className="container-bm section flex flex-col items-center gap-5 text-center">
          {partners.length > 0 && (
            <>
              <div className="kicker">{t('partnersWith').toUpperCase()}</div>
              <div className="flex flex-wrap justify-center gap-x-10 gap-y-5">
                {partners.map((p) => <span key={p.id} className="flex min-h-12 max-w-full items-center font-display font-bold text-basil-muted"><PartnerLogo wrap p={p} className="h-10 max-w-[140px] object-contain grayscale transition hover:grayscale-0" /></span>)}
              </div>
            </>
          )}
          {s.company_profile_url && <a href={s.company_profile_url} target="_blank" rel="noreferrer" download className="btn-primary"><Download size={18} />{t('downloadProfile')}</a>}
        </section>
      )}
    </>
  );
}
