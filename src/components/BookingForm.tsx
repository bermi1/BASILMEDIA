import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { submit } from '@/lib/db';
import { isEmail, normaliseTzPhone } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useRows } from '@/hooks/useData';

export function BookingForm() {
  const { t } = useI18n();
  const { rows: services } = useRows('services', { publishedOnly: true });
  const [f, setF] = useState({ name: '', contact: '', service: '', date: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [fail, setFail] = useState('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const send = async () => {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 2) e.name = 'Please enter your name';
    if (!isEmail(f.contact) && !normaliseTzPhone(f.contact)) e.contact = 'Email or Tanzanian phone';
    setErrors(e);
    if (Object.keys(e).length) return;
    setState('sending');
    setFail('');
    try {
      await submit('bookings', {
        name: f.name.trim(), contact: normaliseTzPhone(f.contact) ?? f.contact.trim(), service: f.service || services[0]?.title || '',
        preferred_date: f.date || null, message: f.message.trim(), source: 'booking', status: 'new',
      });
      setState('sent');
    } catch (err) {
      setFail((err as Error).message);
      setState('idle');
    }
  };

  const label = 'flex flex-col gap-1.5 text-[13px] text-basil-frost';
  const err = (k: string) => errors[k] && <span className="text-[12px] font-bold text-amber-200">{errors[k]}</span>;

  return (
    <div className="relative overflow-hidden rounded-[26px] p-5 text-white sm:rounded-[30px] sm:p-8" style={{ background: 'linear-gradient(140deg, #0F6EC2, #0A2F5C)' }}>
      <h2 className="m-0 mb-1 text-[26px] font-extrabold sm:text-[32px]">{t('bookTitle')}</h2>
      <p className="m-0 mb-4 text-sm text-basil-frost sm:mb-[22px] sm:text-base">{t('bookSub')}</p>
      <AnimatePresence mode="wait">
        {state !== 'sent' ? (
          <motion.form key="form" exit={{ opacity: 0, y: -10 }} onSubmit={(e) => (e.preventDefault(), send())} noValidate className="grid grid-cols-2 items-end gap-2.5 sm:flex sm:flex-wrap">
            <label className={`${label} col-span-2 flex-[1_1_160px]`}>{t('name')}<input className="field" value={f.name} onChange={set('name')} placeholder="Full name" autoComplete="name" aria-invalid={!!errors.name} />{err('name')}</label>
            <label className={`${label} col-span-2 flex-[1_1_180px]`}>Email / phone<input className="field" value={f.contact} onChange={set('contact')} placeholder="+255…" autoComplete="email" aria-invalid={!!errors.contact} />{err('contact')}</label>
            <label className={`${label} flex-[1_1_170px]`}>{t('service')}
              <select className="field" value={f.service} onChange={set('service')}>
                {services.map((s) => <option key={s.id}>{s.title}</option>)}
              </select>
            </label>
            <label className={`${label} flex-[1_1_140px]`}>{t('date')}<input type="date" className="field" value={f.date} onChange={set('date')} min={new Date().toISOString().slice(0, 10)} /></label>
            <label className={`${label} col-span-2 flex-[2_1_220px]`}>{t('message')}<input className="field" value={f.message} onChange={set('message')} placeholder="Tell us about the moment" /></label>
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} type="submit" disabled={state === 'sending'} className="col-span-2 flex h-[50px] flex-none items-center justify-center gap-2 rounded-[14px] border-0 bg-white px-[26px] text-[15px] font-extrabold text-basil disabled:opacity-70">
              {state === 'sending' ? <Loader2 className="animate-spin" size={18} /> : null}
              {state === 'sending' ? 'Sending…' : t('send')}
            </motion.button>
            {fail && <p role="alert" className="m-0 w-full text-sm text-amber-200">{fail}</p>}
          </motion.form>
        ) : (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} role="status" className="flex items-center gap-3 rounded-[18px] bg-white/[0.14] p-5 text-[17px]">
            <CheckCircle2 className="shrink-0 text-basil-sky" />
            <span><b>{t('thanks')}</b> {t('thanksSub')}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
