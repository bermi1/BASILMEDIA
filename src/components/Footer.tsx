import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '@/hooks/useData';
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
          className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${dark ? 'border-basil-haze/20 bg-white/[0.08] text-white hover:bg-white/20 hover:text-white' : 'border-basil-edge bg-white text-basil hover:bg-basil-ice'}`}
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
      <div className="container-bm pt-8 sm:pt-12">
        <div className="flex flex-col gap-4 rounded-[24px] border border-white/20 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:rounded-[30px] sm:p-8" style={{ background: 'radial-gradient(circle at 85% 20%, rgba(124,192,245,0.35), transparent 50%), linear-gradient(135deg, #0F6EC2, #0A2F5C)' }}>
          <div className="min-w-0">
            <div className="font-mono text-[10px] tracking-[0.2em] text-basil-haze">{t('ready')}</div>
            <div className="mt-1 font-display text-[18px] font-bold leading-[1.15] text-white sm:text-[clamp(21px,2.4vw,28px)]">{t('readyTitle')}</div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
            <Link to="/#book" className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-full bg-white px-4 text-[13px] font-bold text-basil no-underline hover:bg-basil-ice">{t('book')}</Link>
            <a href={waLink(s.whatsapp || s.phone)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-full border border-white/45 px-4 text-[13px] font-bold text-white no-underline hover:bg-white/10 hover:text-white">WhatsApp</a>
          </div>
        </div>
      </div>
      <div className="container-bm grid grid-cols-2 gap-x-6 gap-y-7 pb-5 pt-8 sm:pt-12 lg:grid-cols-[1.6fr_1fr_1fr_1.6fr] lg:gap-10">
        <div className="col-span-2 flex flex-col gap-3.5 lg:col-span-1">
          <img src={s.logo_reverse_url && !s.logo_reverse_url.endsWith('/logo-reverse.svg') ? s.logo_reverse_url : '/brand/basil-media-logo-white.svg'} alt="Basil Media — Health Education Innovation" className="h-16 w-auto self-start sm:h-20" />
          <p className="m-0 max-w-[380px] text-[13px] leading-relaxed">{s.footer_about}</p>
          <SocialRow />
        </div>
        <nav aria-label="Footer" className="flex flex-col gap-1.5 text-[13px]">
          <b className="font-display text-white">{t('explore')}</b>
          {[['/services', t('services')], ['/our-work', t('ourWork')], ['/about', t('about')], ['/health-news', t('healthNews')], ['/find-me', t('findPhotos')], ['/contact', t('contact')]].map(([to, l]) => (
            <Link key={to} to={to} className="text-basil-haze no-underline hover:text-white">{l}</Link>
          ))}
        </nav>
        <div className="flex flex-col gap-1.5 text-[13px]">
          <b className="font-display text-white">{t('contact')}</b>
          <a href={`tel:${s.phone.replace(/\s/g, '')}`} className="text-basil-haze no-underline hover:text-white">{s.phone}</a>
          <a href={`mailto:${s.contact_email}`} className="break-all text-basil-haze no-underline hover:text-white">{s.contact_email}</a>
          <span>{s.address}</span>
          {s.office_hours && <span className="text-xs">{s.office_hours}</span>}
        </div>
        <div className="col-span-2 flex flex-col gap-2.5 lg:col-span-1">
          <b className="font-display text-white">Basil Health Brief</b>
          <span className="text-[13px]">Weekly health news for clinicians · English or Kiswahili.</span>
          <form onSubmit={(e) => (e.preventDefault(), quickSubscribe())} className="flex gap-2 rounded-2xl border border-basil-haze/25 bg-white/[0.08] p-1.5">
            <label className="sr-only" htmlFor="foot-sub">{t('phoneOrEmail')}</label>
            <input id="foot-sub" value={contact} onChange={(e) => setContact(e.target.value)} placeholder={t('phoneOrEmail')} className="min-w-0 flex-1 border-0 bg-transparent px-2.5 text-white outline-none placeholder:text-basil-haze/70" />
            <button type="submit" className="rounded-xl border-0 bg-basil px-4 py-2.5 font-bold text-white hover:bg-basil-bright">{t('subscribe')}</button>
          </form>
          {msg && <span role="status" className="text-sm text-basil-sky">{msg}</span>}
        </div>
      </div>
      <div aria-hidden="true" className="outline-word container-bm hidden overflow-hidden whitespace-nowrap font-display text-[clamp(48px,9vw,120px)] font-extrabold leading-[0.85] tracking-[-0.03em] md:block">BASIL MEDIA</div>
      <div className="container-bm flex flex-wrap justify-between gap-x-4 gap-y-2 border-t border-basil-haze/15 py-4 text-[11.5px] sm:text-xs">
        <span>© {new Date().getFullYear()} Basil Media · Dar es Salaam · <span className="text-basil-haze/80">Designed &amp; powered by <b className="text-white">Bermi Techs</b></span></span>
        <span className="flex flex-wrap gap-4">
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
    <a href={waLink(s.whatsapp || s.phone, 'Hello Basil Media, ')} target="_blank" rel="noreferrer" className="fixed bottom-[22px] right-[22px] z-30 hidden h-14 w-14 items-center justify-center md:flex gap-2.5 rounded-full bg-[#25D366] font-bold text-white no-underline shadow-[0_14px_30px_rgba(37,211,102,0.45)] transition hover:scale-105 hover:text-white md:bottom-[22px] md:right-[22px] md:h-auto md:w-auto md:py-3.5 md:pl-4 md:pr-5" aria-label="Chat with us on WhatsApp">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 20 L5.3 16.2 A8 8 0 1 1 8 18.8 Z" />
      </svg>
      <span className="hidden md:inline">{t('chat')}</span>
    </a>
  );
}
