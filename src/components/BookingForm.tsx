// Compact booking card: name + phone, tap a service, write the full inquiry, send.
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { submit } from '@/lib/db';
import { isEmail, normaliseTzPhone } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useRows } from '@/hooks/useData';

export function BookingForm() {
  const { t } = useI18n();
  const { rows: services } = useRows('services', { publishedOnly: true });
  const [f, setF] = useState({ name: '', contact: '', service: '', date: '', message: '' });
  const [err, setErr] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const send = async () => {
    if (f.name.trim().length < 2) return setErr('Please add your name.');
    if (!isEmail(f.contact) && !normaliseTzPhone(f.contact)) return setErr('Add a phone number (07…) or an email.');
    setErr('');
    setState('sending');
    try {
      await submit('bookings', {
        name: f.name.trim(), contact: normaliseTzPhone(f.contact) ?? f.contact.trim(), service: f.service || 'Not sure yet',
        preferred_date: f.date || null, message: f.message.trim(), source: 'booking', status: 'new',
      });
      setState('sent');
    } catch (e) {
      setErr((e as Error).message);
      setState('idle');
    }
  };

  const input = 'h-11 w-full rounded-xl border-0 bg-white/95 px-3.5 text-[14.5px] text-basil-ink outline-none placeholder:text-basil-muted/70 focus:ring-2 focus:ring-basil-sky';
  return (
    <div className="mx-auto max-w-[720px] rounded-[24px] p-5 text-white sm:p-7" style={{ background: 'linear-gradient(140deg, #0F6EC2, #0A2F5C)' }}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div><h2 className="m-0 text-[20px] font-bold sm:text-2xl">{t('bookTitle')}</h2><p className="m-0 mt-0.5 text-[13px] text-basil-frost">{t('bookSub')}</p></div>
      </div>
      <AnimatePresence mode="wait">
        {state === 'sent' ? (
          <motion.div key="ok" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} role="status" className="flex items-center gap-3 rounded-2xl bg-white/[0.14] p-4 text-[15px]">
            <CheckCircle2 className="shrink-0 text-basil-sky" /><span><b>{t('thanks')}</b> {t('thanksSub')}</span>
          </motion.div>
        ) : (
          <motion.form key="f" exit={{ opacity: 0 }} onSubmit={(e) => (e.preventDefault(), send())} noValidate className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <label><span className="sr-only">{t('name')}</span><input className={input} value={f.name} onChange={set('name')} placeholder="Your name" autoComplete="name" /></label>
              <label><span className="sr-only">Phone or email</span><input className={input} value={f.contact} onChange={set('contact')} placeholder="Phone or email" autoComplete="tel" /></label>
            </div>
            <div role="group" aria-label={t('service')} className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
              {services.map((s) => {
                const on = f.service === s.title;
                return <button key={s.id} type="button" aria-pressed={on} onClick={() => setF({ ...f, service: on ? '' : s.title })} className={`h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium transition ${on ? 'border-0 bg-white text-basil' : 'border border-white/30 bg-white/10 text-white'}`}>{s.title}</button>;
              })}
            </div>
            <label><span className="sr-only">Your inquiry</span><textarea rows={3} className={`${input} h-auto resize-y py-2.5`} value={f.message} onChange={set('message')} placeholder="Tell us about it — event, date, venue, what you need…" /></label>
            <div className="flex items-center gap-2.5">
              <label className="flex-1"><span className="sr-only">{t('date')} (optional)</span><input type="date" className={`${input} text-[13.5px]`} value={f.date} onChange={set('date')} min={new Date().toISOString().slice(0, 10)} /></label>
              <button type="submit" disabled={state === 'sending'} className="flex h-11 shrink-0 items-center gap-2 rounded-xl border-0 bg-white px-5 text-[14.5px] font-bold text-basil disabled:opacity-70">
                {state === 'sending' ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}{state === 'sending' ? 'Sending…' : 'Send'}
              </button>
            </div>
            {err && <p role="alert" className="m-0 text-[13px] font-bold text-sun-soft">{err}</p>}
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
