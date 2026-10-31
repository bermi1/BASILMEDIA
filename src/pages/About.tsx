import { useState } from 'react';
import { Download } from 'lucide-react';
import { useRows, useSettings } from '@/hooks/useData';
import { useSeo } from '@/hooks/useSeo';
import { useI18n } from '@/lib/i18n';
import { Reveal } from '@/components/Reveal';
import { PageHero } from '@/components/PageHero';

export default function About() {
  const s = useSettings();
  const { t } = useI18n();
  useSeo('About Us', s.mission);
  const { rows: partners } = useRows('partners');
  const story = (s.about_story || '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  return (
    <>
      <PageHero kicker={t('about').toUpperCase()} title={<>A Dar es Salaam studio that <span className="text-glow">tells Tanzania’s stories.</span></>} />

      {/* Intro: the whole team photo (never cropped) beside the opening of our story */}
      <section className="container-bm section grid items-center gap-6 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
        <Reveal>
          <img src={s.about_image_url || '/img/team/basil-media-team.jpg'} alt="The Basil Media team" className="block h-auto w-full rounded-[24px] shadow-card" />
        </Reveal>
        <Reveal>
          <div className="font-mono text-[11px] tracking-[0.18em] text-basil">WHO WE ARE</div>
          <p className="m-0 mt-2 font-display text-[19px] font-semibold leading-snug text-basil-ink sm:text-2xl">{story[0]}</p>
        </Reveal>
      </section>

      {/* The rest of the story as a grid of short cards, not one long block of text */}
      {story.length > 1 && (
        <section className="container-bm grid gap-3 pb-10 sm:grid-cols-2 sm:gap-4 sm:pb-14 lg:grid-cols-3">
          {story.slice(1).map((para, i) => (
            <Reveal key={i} delay={i * 0.05}>
              <div className="h-full rounded-[22px] border border-basil-line bg-white p-5 sm:p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-basil-ice font-display font-extrabold text-basil">{i + 1}</span>
                <p className="m-0 mt-3 text-[15px] leading-relaxed text-[#33465F]">{para}</p>
              </div>
            </Reveal>
          ))}
        </section>
      )}
      <section className="container-bm grid grid-cols-2 gap-2.5 pb-10 sm:gap-4 sm:pb-14">
        <div className="rounded-[22px] bg-basil p-4 text-white sm:rounded-[26px] sm:p-8"><div className="font-mono text-[11px] tracking-[0.18em] text-basil-frost">MISSION</div><p className="mb-0 mt-2 font-display text-[14px] font-bold leading-snug sm:mt-3 sm:text-xl sm:leading-normal">{s.mission}</p></div>
        <div className="rounded-[22px] bg-basil-deep p-4 text-white sm:rounded-[26px] sm:p-8"><div className="font-mono text-[11px] tracking-[0.18em] text-basil-haze">VISION</div><p className="mb-0 mt-2 font-display text-[14px] font-bold leading-snug sm:mt-3 sm:text-xl sm:leading-normal">{s.vision}</p></div>
      </section>
      <section className="section bg-basil-mist">
        <div className="container-bm">
          <h2 className="h-section m-0 mb-5">{t('team')}</h2>
          <div className="grid gap-2.5 sm:gap-4 lg:grid-cols-[2fr_1fr]">
            <figure className="relative m-0 overflow-hidden rounded-[22px]">
              <img src="/img/services/event-coverage-team.jpg" alt="Basil Media crew covering an outdoor event" loading="lazy" className="aspect-[16/10] w-full object-cover object-top lg:h-full lg:aspect-auto" />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-basil-night/85 to-transparent p-4 pt-12 text-white sm:p-6"><b className="font-display text-lg sm:text-2xl">One crew, from brief to final cut</b><span className="block text-sm text-white/85">Filmmakers, photographers, editors and producers in Dar es Salaam.</span></figcaption>
            </figure>
            <img src="/img/team/crew-on-set.jpg" alt="Basil Media crew filming at a conference" loading="lazy" className="hidden w-full rounded-[22px] object-cover object-top lg:block lg:aspect-[3/4]" />
          </div>
        </div>
      </section>
      <section className="container-bm section flex flex-wrap items-center justify-between gap-5">
        <div className="w-full">
          <h2 className="m-0 mb-3.5 text-[22px] font-extrabold sm:text-3xl">{t('partnersWith')}</h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {partners.map((p) => (
              <span key={p.id} className="flex h-20 items-center justify-center rounded-[16px] border border-basil-line bg-white px-3 text-center text-sm font-bold text-basil-deep">
                <Logo name={p.name} src={p.logo_url} />
              </span>
            ))}
          </div>
        </div>
        {s.company_profile_url && (
          <a href={s.company_profile_url} target="_blank" rel="noreferrer" download className="flex items-center gap-3 rounded-[18px] bg-basil px-6 py-[18px] font-bold text-white no-underline hover:bg-basil-deep hover:text-white"><Download size={22} />{t('downloadProfile')}</a>
        )}
      </section>
    </>
  );
}

/** Partner logo, or the name if there is no logo or it fails to load. */
function Logo({ name, src }: { name: string; src: string }) {
  const [bad, setBad] = useState(false);
  return src && !bad ? <img src={src} alt={name} loading="lazy" onError={() => setBad(true)} className="max-h-12 max-w-[140px] object-contain" /> : <>{name}</>;
}
