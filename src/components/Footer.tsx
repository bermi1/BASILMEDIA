import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRows, useSettings } from '@/hooks/useData';
import { useI18n } from '@/lib/i18n';
import { submit } from '@/lib/db';
import { isEmail, normaliseTzPhone, waLink } from '@/lib/format';
import { SOCIALS } from './icons';

export function SocialRow({ dark = true }: { dark?: boolean }) {
  const s = useSettings();
  return (
    <div className="flex flex-wrap gap-2.5">
      {SOCIALS.filter(({ key }) => s.socials?.[key]).map(({ key, label, Icon }) => (
        <a
          key={key}
          href={s.socials[key]}
          target="_blank"
          rel="noreferrer"
          aria-label={label}
          className={`flex h-11 w-11 items-center justify-center rounded-[14px] border transition ${dark ? 'border-basil-haze/20 bg-white/[0.08] text-white hover:bg-white/20 hover:text-white' : 'border-basil-edge bg-white text-basil hover:bg-basil-ice'}`}
        >
          <Icon />
        </a>
      ))}
    </div>
  );
}

export function Footer() {
  const { t } = useI18n();
  const s = useSettings();
  const { rows: services } = useRows('services', { publishedOnly: true });
  const [contact, setContact] = useState('');
  const [msg, setMsg] = useState('');

  const quickSubscribe = async () => {
    const phone = normaliseTzPhone(contact);
    if (!phone && !isEmail(contact)) return setMsg('Enter a Tanzanian phone (07…) or an email.');
    try {
      await submit('subscribers', {
        full_name: '', phone: phone ?? '', email: phone ? '' : contact.trim(), language: 'en', channel: phone ? 'sms' : 'email',
        sector: 'Health', source: 'website-footer', consent: true, consent_at: new Date().toISOString(), specialties: [], status: 'pending',
      });
      setContact('');
      setMsg('Thank you — check your phone or inbox to confirm.');
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <footer className="relative overflow-hidden bg-basil-night text-basil-haze">
      <div className="container-bm pt-14">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-[32px] border border-white/20 p-7 shadow-[0_30px_70px_rgba(0,0,0,0.35)] sm:p-10" style={{ background: 'radial-gradient(circle at 85% 20%, rgba(124,192,245,0.35), transparent 50%), linear-gradient(135deg, #0F6EC2, #0A2F5C)' }}>
          <div className="min-w-0 flex-[1_1_420px]">
            <div className="font-mono text-xs tracking-[0.2em] text-basil-haze">{t('ready')}</div>
            <div className="mt-2 font-display text-[clamp(30px,4vw,48px)] font-extrabold leading-[1.05] text-white">{t('readyTitle')}</div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/#book" className="rounded-2xl bg-white px-6 py-4 font-extrabold text-basil no-underline hover:bg-basil-ice">{t('book')}</Link>
            <a href={waLink(s.whatsapp || s.phone)} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/45 px-6 py-4 font-bold text-white no-underline hover:bg-white/10 hover:text-white">{t('whatsapp')}</a>
          </div>
        </div>
      </div>
      <div className="container-bm flex flex-wrap gap-10 pb-7 pt-14">
        <div className="flex min-w-0 flex-[2_1_320px] flex-col gap-4">
          <div className="flex items-center gap-3.5">
            <img src={s.logo_url || '/logo.svg'} alt="Basil Media" className="h-20 w-20" />
            <span className="font-display text-2xl font-extrabold text-white">Basil <span className="text-basil-sky">Media</span></span>
          </div>
          <p className="m-0 max-w-[380px] leading-[1.7]">{s.footer_about}</p>
          <SocialRow />
        </div>
        <nav aria-label="Footer" className="flex flex-[1_1_150px] flex-col gap-2.5">
          <b className="font-display text-white">{t('explore')}</b>
          {[['/services', t('services')], ['/our-work', t('ourWork')], ['/about', t('about')], ['/health-news', t('healthNews')], ['/find-me', t('findPhotos')], ['/contact', t('contact')]].map(([to, l]) => (
            <Link key={to} to={to} className="text-basil-haze no-underline hover:text-white">{l}</Link>
          ))}
        </nav>
        <div className="flex flex-[1_1_170px] flex-col gap-2.5">
          <b className="font-display text-white">{t('services')}</b>
          {services.map((x) => (
            <Link key={x.id} to={`/services#${x.slug}`} className="text-basil-haze no-underline hover:text-white">{x.title}</Link>
          ))}
        </div>
        <div className="flex min-w-0 flex-[2_1_280px] flex-col gap-3">
          <b className="font-display text-white">Basil Health Brief</b>
          <span>Weekly health news for clinicians. English or Kiswahili.</span>
          <form onSubmit={(e) => (e.preventDefault(), quickSubscribe())} className="flex gap-2 rounded-2xl border border-basil-haze/25 bg-white/[0.08] p-1.5">
            <label className="sr-only" htmlFor="foot-sub">{t('phoneOrEmail')}</label>
            <input id="foot-sub" value={contact} onChange={(e) => setContact(e.target.value)} placeholder={t('phoneOrEmail')} className="min-w-0 flex-1 border-0 bg-transparent px-2.5 text-white outline-none placeholder:text-basil-haze/70" />
            <button type="submit" className="rounded-xl border-0 bg-basil px-4 py-3 font-bold text-white hover:bg-basil-bright">{t('subscribe')}</button>
          </form>
          {msg && <span role="status" className="text-sm text-basil-sky">{msg}</span>}
          <span className="text-sm">
            <a href={`mailto:${s.contact_email}`} className="text-basil-haze">{s.contact_email}</a> · <a href={`tel:${s.phone.replace(/\s/g, '')}`} className="text-basil-haze">{s.phone}</a> · {s.address}
          </span>
        </div>
      </div>
      <div aria-hidden="true" className="outline-word container-bm overflow-hidden whitespace-nowrap font-display text-[clamp(64px,13vw,190px)] font-extrabold leading-[0.85] tracking-[-0.03em]">BASIL MEDIA</div>
      <div className="container-bm flex flex-wrap justify-between gap-3 border-t border-basil-haze/15 py-5 text-[13px]">
        <span>© {new Date().getFullYear()} Basil Media · Dar es Salaam, Tanzania</span>
        <span className="flex flex-wrap gap-[18px]">
          <Link to="/privacy" className="text-basil-haze">{t('privacy')}</Link>
          <Link to="/privacy/face-search" className="text-basil-haze">{t('faceData')}</Link>
          <Link to="/login" className="text-basil-sky">{t('login')}</Link>
        </span>
      </div>
    </footer>
  );
}

export function WhatsAppButton() {
  const { t } = useI18n();
  const s = useSettings();
  return (
    <a href={waLink(s.whatsapp || s.phone, 'Hello Basil Media, ')} target="_blank" rel="noreferrer" className="fixed bottom-4 right-4 z-30 flex items-center gap-2.5 rounded-full bg-[#25D366] py-3 pl-3.5 pr-4 font-bold text-white no-underline shadow-[0_14px_30px_rgba(37,211,102,0.45)] transition hover:scale-105 hover:text-white sm:bottom-[22px] sm:right-[22px] sm:py-3.5 sm:pr-5">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 20 L5.3 16.2 A8 8 0 1 1 8 18.8 Z" />
      </svg>
      <span className="hidden sm:inline">{t('chat')}</span>
    </a>
  );
}
