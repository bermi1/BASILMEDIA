import { Download } from 'lucide-react';
import { useRows, useSettings } from '@/hooks/useData';
import { useSeo } from '@/hooks/useSeo';
import { useI18n } from '@/lib/i18n';
import { Reveal } from '@/components/Reveal';

export default function About() {
  const s = useSettings();
  const { t } = useI18n();
  useSeo('About Us', s.mission);
  const { rows: team } = useRows('team', { publishedOnly: true });
  const { rows: partners } = useRows('partners');
  return (
    <>
      <section className="container-bm flex flex-wrap items-center gap-6 pb-8 pt-8 sm:gap-12 sm:pb-10 sm:pt-16">
        <Reveal className="min-w-0 flex-[1_1_520px]">
          <div className="kicker tracking-[0.2em]">{t('about').toUpperCase()}</div>
          <h1 className="mb-3 mt-2 text-[clamp(30px,5vw,60px)] font-extrabold leading-[1.05] sm:mb-[18px]">A Dar es Salaam studio that <span className="text-basil">tells Tanzania’s stories.</span></h1>
          <p className="m-0 whitespace-pre-line text-[15.5px] leading-[1.7] text-basil-muted sm:text-lg">{s.about_story}</p>
        </Reveal>
        <Reveal delay={0.1} className="min-w-0 flex-[1_1_380px]">
          <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-[24px] sm:aspect-[4/3] sm:rounded-[30px]" style={{ background: 'radial-gradient(circle at 50% 45%, #EAF3FC, #CFE3F7)' }}>
            {s.about_image_url ? <img src={s.about_image_url} alt="The Basil Media team at work" className="absolute inset-0 h-full w-full object-cover" /> : <img src={s.logo_url} alt="" className="h-[180px] w-[180px] sm:h-[220px] sm:w-[220px]" style={{ filter: 'drop-shadow(0 24px 40px rgba(15,110,194,0.35))' }} />}
          </div>
        </Reveal>
      </section>
      <section className="container-bm grid grid-cols-2 gap-2.5 pb-10 sm:gap-4 sm:pb-14">
        <div className="rounded-[22px] bg-basil p-4 text-white sm:rounded-[26px] sm:p-8"><div className="font-mono text-[11px] tracking-[0.18em] text-basil-frost">MISSION</div><p className="mb-0 mt-2 font-display text-[14px] font-bold leading-snug sm:mt-3 sm:text-xl sm:leading-normal">{s.mission}</p></div>
        <div className="rounded-[22px] bg-basil-deep p-4 text-white sm:rounded-[26px] sm:p-8"><div className="font-mono text-[11px] tracking-[0.18em] text-basil-haze">VISION</div><p className="mb-0 mt-2 font-display text-[14px] font-bold leading-snug sm:mt-3 sm:text-xl sm:leading-normal">{s.vision}</p></div>
      </section>
      <section className="section bg-basil-mist">
        <div className="container-bm">
          <h2 className="h-section m-0 mb-5">{t('team')}</h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {team.map((m, i) => (
              <Reveal key={m.id} delay={i * 0.05}>
                <figure tabIndex={0} className="group relative m-0 aspect-[3/4] overflow-hidden rounded-[22px] outline-none" style={{ background: 'linear-gradient(160deg, #2B86DA, #0A2F5C)' }}>
                  {m.photo_url ? (
                    <img src={m.photo_url} alt={m.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105 group-focus:scale-105" />
                  ) : (
                    <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center font-display text-[64px] font-extrabold text-white/25">{m.name[0]}</span>
                  )}
                  {/* phones: name always on a blue fade; desktop: full blue overlay on hover/focus */}
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-basil/95 via-basil/60 to-transparent p-3 pt-10 text-white transition duration-300 sm:translate-y-full sm:p-5 sm:pt-5 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:group-focus:translate-y-0 sm:group-focus:opacity-100">
                    <b className="block font-display text-[15px] leading-tight sm:text-xl">{m.name}</b>
                    <span className="block text-[12px] text-basil-frost sm:text-sm">{m.role}</span>
                    {m.bio && <span className="mt-2 hidden text-sm leading-snug text-white/90 sm:line-clamp-3">{m.bio}</span>}
                  </figcaption>
                  <span aria-hidden="true" className="pointer-events-none absolute inset-0 hidden bg-basil/35 opacity-0 mix-blend-multiply transition duration-300 group-hover:opacity-100 sm:block" />
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      <section className="container-bm section flex flex-wrap items-center justify-between gap-5">
        <div className="flex-[1_1_520px]">
          <h2 className="m-0 mb-3.5 text-[22px] font-extrabold sm:text-3xl">{t('partnersWith')}</h2>
          <div className="flex flex-wrap gap-2.5">
            {partners.map((p) => (
              <span key={p.id} className="flex h-11 items-center rounded-[14px] border border-basil-line px-3.5 text-sm font-bold text-basil-muted sm:h-14 sm:px-[18px] sm:text-base">
                {p.logo_url ? <img src={p.logo_url} alt={p.name} className="h-9 max-w-[140px] object-contain" loading="lazy" /> : p.name}
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
