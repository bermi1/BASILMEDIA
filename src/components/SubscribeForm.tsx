// Minimal Basil Brief sign-up: name, phone or email, topics, consent.
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CheckCircle2 } from 'lucide-react';
import { submit } from '@/lib/db';
import { isEmail, normaliseTzPhone } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { NEWS_DESKS } from '@/lib/types';

export function SubscribeForm({ source = 'website' }: { source?: string }) {
  const { lang } = useI18n();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [desks, setDesks] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState('');
  const [state, setState] = useState<'form' | 'sending' | 'done'>('form');

  const go = async () => {
    const phone = normaliseTzPhone(contact);
    if (name.trim().length < 2) return setErr('Please add your name.');
    if (!phone && !isEmail(contact)) return setErr('Enter a phone number (07…) or an email.');
    if (!desks.length) return setErr('Pick at least one topic.');
    if (!consent) return setErr('Please tick the box so we may send you the brief.');
    setErr('');
    setState('sending');
    try {
      await submit('subscribers', {
        full_name: name.trim(), title: '', profession: '', specialties: desks, institution: '', region: '',
        phone: phone ?? '', email: phone ? '' : contact.trim(), language: lang, channel: phone ? 'sms' : 'email',
        sector: desks.join(', '), source, consent: true, consent_at: new Date().toISOString(), status: 'pending',
      });
      setState('done');
    } catch (e) {
      setErr((e as Error).message);
      setState('form');
    }
  };

  const input = 'h-12 w-full rounded-xl border border-basil-edge bg-white px-3.5 text-[15px] outline-none focus:border-basil';
  return (
    <div className="rounded-[24px] bg-white p-5 text-basil-ink shadow-[0_24px_60px_rgba(0,0,0,0.25)] sm:p-6">
      <AnimatePresence mode="wait">
        {state === 'done' ? (
          <motion.div key="ok" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} role="status" className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 size={44} className="text-basil" />
            <b className="text-lg">Karibu, {name.split(' ')[0]}!</b>
            <span className="text-sm text-basil-muted">Your first Basil Brief arrives on Monday.</span>
          </motion.div>
        ) : (
          <motion.form key="f" exit={{ opacity: 0 }} onSubmit={(e) => (e.preventDefault(), go())} noValidate className="flex flex-col gap-3">
            <label><span className="sr-only">Your name</span><input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" /></label>
            <label><span className="sr-only">Phone or email</span><input className={input} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone (07…) or email" autoComplete="tel" /></label>
            <div role="group" aria-label="Topics" className="flex flex-wrap gap-1.5">
              {NEWS_DESKS.map((d) => {
                const on = desks.includes(d);
                return <button key={d} type="button" aria-pressed={on} onClick={() => setDesks(on ? desks.filter((x) => x !== d) : [...desks, d])} className={`h-9 rounded-full px-3 text-[13px] font-medium transition ${on ? 'border-0 bg-basil text-white' : 'border border-basil-edge bg-white text-basil-deep'}`}>{d}</button>;
              })}
            </div>
            <button type="button" aria-pressed={consent} onClick={() => setConsent(!consent)} className="flex items-center gap-2.5 border-0 bg-transparent p-0 text-left text-[12.5px] text-basil-muted">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white ${consent ? 'bg-basil' : 'border-[1.5px] border-[#9DBEE3] bg-white'}`}>{consent && <Check size={13} />}</span>
              Send me the Basil Brief. I can stop anytime (reply STOP).
            </button>
            {err && <p role="alert" className="m-0 text-[13px] font-bold text-red-700">{err}</p>}
            <button type="submit" disabled={state === 'sending'} className="h-12 rounded-xl border-0 bg-basil text-[15px] font-bold text-white shadow-glow hover:bg-basil-deep disabled:opacity-70">{state === 'sending' ? 'Subscribing…' : 'Subscribe'}</button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
