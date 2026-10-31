import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Clock, Loader2, Mail, MapPin, MessageSquareText, Navigation, Phone, Send } from 'lucide-react';
import { Sheet } from '@/os/ui';
import { useSettings } from '@/hooks/useData';
import { useSeo } from '@/hooks/useSeo';
import { useI18n } from '@/lib/i18n';
import { submit } from '@/lib/db';
import { isEmail, normaliseTzPhone, waLink } from '@/lib/format';
import { SocialRow } from '@/components/Footer';
import { WhatsApp } from '@/components/icons';

const TOPICS = ['Book a shoot', 'Get a quotation', 'Partnership', 'Media & press', 'Something else'];
const REPLY = [['whatsapp', 'WhatsApp'], ['call', 'Call'], ['email', 'Email']] as const;

export default function Contact() {
  const s = useSettings();
  const { t } = useI18n();
  useSeo('Contact', `WhatsApp, call ${s.phone}, email ${s.contact_email} or visit Basil Media in ${s.address}.`);
  const [topic, setTopic] = useState(TOPICS[0]);
  const [reply, setReply] = useState<(typeof REPLY)[number][0]>('whatsapp');
  const [f, setF] = useState({ name: '', contact: '', message: '' });
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [err, setErr] = useState('');
  const [sheet, setSheet] = useState(false);
  const mapSrc = s.map_embed_url || `https://www.google.com/maps?q=${encodeURIComponent(s.address)}&output=embed`;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.address)}`;

  const send = async () => {
    if (f.name.trim().length < 2) return setErr('Please add your name.');
    if (!isEmail(f.contact) && !normaliseTzPhone(f.contact)) return setErr('Add an email or a Tanzanian phone number (07… or +255…).');
    if (f.message.trim().length < 3) return setErr('Tell us a little about what you need.');
    setErr('');
    setState('sending');
    try {
      await submit('bookings', {
        name: f.name.trim(), contact: normaliseTzPhone(f.contact) ?? f.contact.trim(), service: topic, preferred_date: null,
        message: `${f.message.trim()}\n\nPrefers reply by: ${reply}`, source: 'contact', status: 'new',
      });
      setState('sent');
    } catch (e) {
      setErr((e as Error).message);
      setState('idle');
    }
  };

  const actions = [
    { label: 'WhatsApp', sub: 'Fastest reply', href: waLink(s.whatsapp || s.phone, 'Hello Basil Media, '), icon: <WhatsApp width={24} height={24} />, cls: 'bg-[#25D366] text-white', ext: true },
    { label: 'Call us', sub: s.phone, href: `tel:${s.phone.replace(/\s/g, '')}`, icon: <Phone size={22} />, cls: 'bg-basil text-white' },
    { label: 'Email', sub: s.contact_email, href: `mailto:${s.contact_email}`, icon: <Mail size={22} />, cls: 'bg-basil-deep text-white' },
    { label: 'Directions', sub: 'Open in Maps', href: directions, icon: <Navigation size={22} />, cls: 'bg-white text-basil ring-1 ring-basil-edge', ext: true },
  ];
  const chip = (on: boolean) => `min-h-[40px] shrink-0 rounded-full px-3.5 text-[13.5px] font-semibold transition ${on ? 'border-0 bg-basil text-white shadow-glow' : 'border border-basil-edge bg-white text-basil-deep'}`;

  const form = (
          <AnimatePresence mode="wait">
            {state === 'sent' ? (
              <motion.div key="ok" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} role="status" className="flex flex-col items-center gap-3 py-12 text-center">
                <CheckCircle2 size={56} className="text-basil" />
                <h2 className="m-0 text-2xl font-extrabold">Asante, {f.name.split(' ')[0]}!</h2>
                <p className="m-0 max-w-xs text-basil-muted">We have your message about “{topic}”. Expect a {reply === 'call' ? 'call' : reply === 'email' ? 'reply by email' : 'WhatsApp message'} within one working day.</p>
                <button type="button" onClick={() => (setState('idle'), setF({ name: '', contact: '', message: '' }))} className="btn-outline mt-2">Send another message</button>
              </motion.div>
            ) : (
              <motion.form key="form" exit={{ opacity: 0 }} onSubmit={(e) => (e.preventDefault(), send())} noValidate className="flex flex-col gap-4">
                <div><h2 className="m-0 text-[22px] font-extrabold sm:text-2xl">{t('sendMessage')}</h2><p className="m-0 mt-1 text-sm text-basil-muted">Takes under a minute.</p></div>
                <div>
                  <div className="mb-2 text-[13px] font-bold text-[#33465F]">What’s it about?</div>
                  <div role="group" aria-label="Topic" className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap">
                    {TOPICS.map((x) => <button key={x} type="button" aria-pressed={topic === x} onClick={() => setTopic(x)} className={chip(topic === x)}>{x}</button>)}
                  </div>
                </div>
                <Floating label={t('name')} value={f.name} onChange={(v) => setF({ ...f, name: v })} autoComplete="name" />
                <Floating label="Phone or email" value={f.contact} onChange={(v) => setF({ ...f, contact: v })} autoComplete="tel" inputMode="email" />
                <Floating label={t('message')} value={f.message} onChange={(v) => setF({ ...f, message: v })} textarea />
                <div>
                  <div className="mb-2 text-[13px] font-bold text-[#33465F]">Reply to me by</div>
                  <div role="group" aria-label="Reply by" className="grid grid-cols-3 gap-1 rounded-2xl bg-basil-mist p-1">
                    {REPLY.map(([k, l]) => <button key={k} type="button" aria-pressed={reply === k} onClick={() => setReply(k)} className={`h-10 rounded-xl border-0 text-sm font-bold transition ${reply === k ? 'bg-white text-basil shadow-sm' : 'bg-transparent text-basil-muted'}`}>{l}</button>)}
                  </div>
                </div>
                {err && <p role="alert" className="m-0 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-bold text-red-800">{err}</p>}
                <button type="submit" disabled={state === 'sending'} className="flex h-14 items-center justify-center gap-2 rounded-2xl border-0 bg-basil text-base font-extrabold text-white shadow-glow hover:bg-basil-deep disabled:opacity-70">
                  {state === 'sending' ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}{state === 'sending' ? 'Sending…' : t('sendMsgBtn')}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
  );

  return (
    <div className="bg-[#F3F7FC]">
      <section className="relative overflow-hidden text-white" style={{ background: 'radial-gradient(ellipse at 85% 0%, rgba(124,192,245,0.35), transparent 55%), linear-gradient(160deg, #0A2F5C, #061E3D)' }}>
        <div className="container-bm pb-20 pt-[88px] sm:pb-28 sm:pt-32">
          <div className="font-mono text-[11px] tracking-[0.2em] text-basil-haze sm:text-xs">{t('contact').toUpperCase()} · KARIBU</div>
          <h1 className="mb-1.5 mt-1.5 text-[clamp(23px,3.8vw,46px)] font-bold leading-[1.12] tracking-[-0.02em]">Let’s talk about <span className="text-glow">your next moment.</span></h1>
          <p className="m-0 flex items-center gap-2 text-[15px] text-basil-frost"><Clock size={16} />{s.office_hours || 'We reply within one working day.'}</p>
        </div>
      </section>

      <div className="container-bm relative -mt-14 grid gap-3 pb-6 sm:-mt-20 sm:gap-6 sm:pb-12 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <div className="flex flex-col gap-4 sm:gap-6">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {actions.map((a) => (
              <motion.a whileTap={{ scale: 0.97 }} key={a.label} href={a.href} target={a.ext ? '_blank' : undefined} rel={a.ext ? 'noreferrer' : undefined} className={`flex min-h-[96px] flex-col justify-between rounded-[20px] p-3.5 sm:min-h-[112px] sm:rounded-[22px] sm:p-4 no-underline shadow-[0_14px_30px_rgba(10,47,92,0.14)] transition hover:-translate-y-0.5 ${a.cls}`}>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">{a.icon}</span>
                <span><b className="block font-display text-[15px]">{a.label}</b><span className="block truncate text-[12px] opacity-85">{a.sub}</span></span>
              </motion.a>
            ))}
          </div>

          <button type="button" onClick={() => setSheet(true)} className="flex items-center gap-3 rounded-[20px] border-0 bg-basil-night p-4 text-left text-white shadow-[0_14px_30px_rgba(10,47,92,0.2)] lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15"><MessageSquareText size={20} /></span>
            <span className="flex-1"><b className="block font-display">{t('sendMessage')}</b><span className="text-[12.5px] text-basil-haze">Booking, quotation, partnership…</span></span>
            <Send size={18} />
          </button>
          <div className="overflow-hidden rounded-[22px] border border-basil-line bg-white shadow-[0_14px_30px_rgba(10,47,92,0.08)]">
            <div className="relative hidden h-[280px] sm:block">
              <iframe title="Basil Media office on the map" src={mapSrc} className="h-full w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            </div>
            <div className="flex items-center gap-3 p-3.5 sm:p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-basil-ice text-basil"><MapPin size={20} /></span>
              <div className="min-w-0 flex-1"><b className="block">Basil Media studio</b><span className="text-sm text-basil-muted">{s.address}</span></div>
              <a href={directions} target="_blank" rel="noreferrer" className="btn-primary h-11 min-h-0 px-4 text-sm">Go</a>
            </div>
          </div>
          <div className="hidden flex-col gap-3 rounded-[22px] border border-basil-line bg-white p-4 sm:flex sm:flex-row sm:items-center sm:justify-between">
            <b className="text-sm">Follow our work</b>
            <SocialRow dark={false} />
          </div>
        </div>

        <div className="hidden rounded-[26px] border border-basil-line bg-white p-5 shadow-[0_20px_50px_rgba(10,47,92,0.12)] sm:p-7 lg:sticky lg:top-28 lg:block">{form}</div>
      </div>
      <Sheet open={sheet} onClose={() => setSheet(false)} title={t('sendMessage')}>{form}</Sheet>
    </div>
  );
}

function Floating({ label, value, onChange, textarea, autoComplete, inputMode }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean; autoComplete?: string; inputMode?: 'email' | 'text' }) {
  const cls = 'peer w-full rounded-2xl border border-basil-edge bg-white px-4 pb-2 pt-6 text-[15px] text-basil-ink outline-none transition placeholder:text-transparent focus:border-basil focus:ring-4 focus:ring-basil/10';
  return (
    <label className="relative block">
      {textarea ? (
        <textarea rows={4} placeholder={label} value={value} onChange={(e) => onChange(e.target.value)} className={`${cls} resize-none`} />
      ) : (
        <input placeholder={label} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} inputMode={inputMode} className={`${cls} h-[58px]`} />
      )}
      <span className="pointer-events-none absolute left-4 top-2 text-[11.5px] font-bold text-basil-muted transition-all peer-placeholder-shown:top-[18px] peer-placeholder-shown:text-[15px] peer-placeholder-shown:font-normal peer-focus:top-2 peer-focus:text-[11.5px] peer-focus:font-bold peer-focus:text-basil">{label}</span>
    </label>
  );
}
