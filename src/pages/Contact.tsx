import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useSettings } from '@/hooks/useData';
import { useSeo } from '@/hooks/useSeo';
import { useI18n } from '@/lib/i18n';
import { submit } from '@/lib/db';
import { isEmail, normaliseTzPhone, waLink } from '@/lib/format';
import { SocialRow } from '@/components/Footer';

export default function Contact() {
  const s = useSettings();
  const { t } = useI18n();
  useSeo('Contact', `Email ${s.contact_email}, call ${s.phone} or visit us in ${s.address}.`);
  const [f, setF] = useState({ name: '', contact: '', message: '' });
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [err, setErr] = useState('');
  const mapSrc = s.map_embed_url || `https://www.google.com/maps?q=${encodeURIComponent(s.address)}&output=embed`;

  const send = async () => {
    if (f.name.trim().length < 2 || (!isEmail(f.contact) && !normaliseTzPhone(f.contact)) || f.message.trim().length < 3) {
      return setErr('Please add your name, an email or Tanzanian phone number, and a message.');
    }
    setErr('');
    setState('sending');
    try {
      await submit('bookings', { name: f.name.trim(), contact: normaliseTzPhone(f.contact) ?? f.contact.trim(), message: f.message.trim(), service: 'General enquiry', preferred_date: null, source: 'contact', status: 'new' });
      setState('sent');
    } catch (e) {
      setErr((e as Error).message);
      setState('idle');
    }
  };

  const card = (label: string, value: string, href: string) => (
    <a href={href} className="block rounded-[20px] border border-basil-line bg-basil-mist p-5 text-basil-ink no-underline hover:border-basil-soft hover:text-basil-ink">
      <div className="text-[13px] text-basil-muted">{label}</div><b className="text-lg">{value}</b>
    </a>
  );
  return (
    <>
      <section className="container-bm flex flex-wrap gap-8 py-16">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-3.5">
          <div className="kicker tracking-[0.2em]">{t('contact').toUpperCase()}</div>
          <h1 className="m-0 mb-2 text-[clamp(38px,5vw,56px)] font-extrabold leading-[1.05]">Let’s make something worth remembering.</h1>
          {card('Email', s.contact_email, `mailto:${s.contact_email}`)}
          {card('Phone / WhatsApp', s.phone, waLink(s.whatsapp || s.phone))}
          {card('Office', s.address, `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}`)}
          <div className="mt-1"><SocialRow dark={false} /></div>
        </div>
        <form onSubmit={(e) => (e.preventDefault(), send())} noValidate className="flex min-w-0 flex-[1_1_460px] flex-col gap-3.5 rounded-[28px] p-7 text-white" style={{ background: 'linear-gradient(150deg, #0F6EC2, #0A2F5C)' }}>
          <b className="font-display text-2xl">{t('sendMessage')}</b>
          {state === 'sent' ? (
            <div role="status" className="flex items-center gap-3 rounded-[18px] bg-white/[0.14] p-5 text-[17px]"><CheckCircle2 className="text-basil-sky" />{t('thanks')} {t('thanksSub')}</div>
          ) : (
            <>
              <label className="flex flex-col gap-1.5 text-sm text-basil-frost">{t('name')}<input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Full name" autoComplete="name" /></label>
              <label className="flex flex-col gap-1.5 text-sm text-basil-frost">Email / phone<input className="field" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} placeholder="+255…" /></label>
              <label className="flex flex-col gap-1.5 text-sm text-basil-frost">{t('message')}<textarea rows={5} className="resize-y rounded-[14px] border-0 px-3.5 py-3 text-[15px] text-basil-ink" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="How can we help?" /></label>
              {err && <p role="alert" className="m-0 text-sm text-amber-200">{err}</p>}
              <button type="submit" disabled={state === 'sending'} className="h-[54px] rounded-[14px] border-0 bg-white text-base font-extrabold text-basil hover:bg-basil-ice disabled:opacity-70">{state === 'sending' ? 'Sending…' : t('sendMsgBtn')}</button>
            </>
          )}
        </form>
      </section>
      <section className="container-bm pb-16">
        <div className="h-[320px] overflow-hidden rounded-[28px] border border-basil-line bg-basil-ice">
          <iframe title="Basil Media office on the map" src={mapSrc} className="h-full w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" style={{ filter: 'saturate(0.85) hue-rotate(-8deg)' }} />
        </div>
      </section>
    </>
  );
}
