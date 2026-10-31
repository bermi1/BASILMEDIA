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
      <section className="container-bm flex flex-wrap items-center gap-12 pb-10 pt-16">
        <Reveal className="min-w-0 flex-[1_1_520px]">
          <div className="kicker tracking-[0.2em]">{t('about').toUpperCase()}</div>
          <h1 className="mb-[18px] mt-2.5 text-[clamp(38px,5vw,60px)] font-extrabold leading-[1.04]">A Dar es Salaam studio that <span className="text-basil">tells Tanzania’s stories.</span></h1>
          <p className="m-0 whitespace-pre-line text-lg leading-[1.7] text-basil-muted">{s.about_story}</p>
        </Reveal>
        <Reveal delay={0.1} className="min-w-0 flex-[1_1_380px]">
          <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[30px]" style={{ background: 'radial-gradient(circle at 50% 45%, #EAF3FC, #CFE3F7)' }}>
            {s.about_image_url ? <img src={s.about_image_url} alt="The Basil Media team at work" className="absolute inset-0 h-full w-full object-cover" /> : <img src={s.logo_url} alt="" className="h-[180px] w-[180px] sm:h-[220px] sm:w-[220px]" style={{ filter: 'drop-shadow(0 24px 40px rgba(15,110,194,0.35))' }} />}
          </div>
        </Reveal>
      </section>
      <section className="container-bm grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 pb-14">
        <div className="rounded-[26px] bg-basil p-8 text-white"><div className="font-mono text-xs tracking-[0.18em] text-basil-frost">MISSION</div><p className="mb-0 mt-3 font-display text-xl font-bold leading-normal">{s.mission}</p></div>
        <div className="rounded-[26px] bg-basil-deep p-8 text-white"><div className="font-mono text-xs tracking-[0.18em] text-basil-haze">VISION</div><p className="mb-0 mt-3 font-display text-xl font-bold leading-normal">{s.vision}</p></div>
      </section>
      <section className="bg-basil-mist py-16">
        <div className="container-bm">
          <h2 className="m-0 mb-6 text-[clamp(30px,4vw,44px)] font-extrabold">{t('team')}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fit,minmax(210px,1fr))]">
            {team.map((m, i) => (
              <Reveal key={m.id} delay={i * 0.05}>
                <div className="group overflow-hidden rounded-3xl border border-basil-line bg-white">
                  <div className="relative flex aspect-square items-center justify-center overflow-hidden font-display text-5xl font-extrabold text-basil" style={{ background: 'linear-gradient(160deg, #CFE3F7, #EAF3FC)' }}>
                    {m.photo_url ? <img src={m.photo_url} alt={m.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" /> : m.name[0]}
                  </div>
                  <div className="px-[18px] py-4"><b className="text-[17px]">{m.name}</b><div className="mt-0.5 text-sm text-basil-muted">{m.role}</div>{m.bio && <p className="mb-0 mt-2 text-sm text-basil-muted">{m.bio}</p>}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      <section className="container-bm flex flex-wrap items-center justify-between gap-5 py-14">
        <div className="flex-[1_1_520px]">
          <h2 className="m-0 mb-3.5 text-3xl font-extrabold">{t('partnersWith')}</h2>
          <div className="flex flex-wrap gap-2.5">
            {partners.map((p) => (
              <span key={p.id} className="flex h-14 items-center rounded-[14px] border border-basil-line px-[18px] font-bold text-basil-muted">
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
