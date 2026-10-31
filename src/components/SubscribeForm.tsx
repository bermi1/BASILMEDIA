// Basil Health Brief sign-up — deliberately short: name, occupation, phone, consent.
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CheckCircle2, Loader2 } from 'lucide-react';
import { submit } from '@/lib/db';
import { normaliseTzPhone } from '@/lib/format';

const OCCUPATIONS = ['Doctor', 'Nurse', 'Pharmacist', 'Lab scientist', 'Student', 'Other'];

export function SubscribeForm({ source = 'website' }: { source?: string }) {
  const [name, setName] = useState('');
  const [job, setJob] = useState('Doctor');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState('');
  const [state, setState] = useState<'form' | 'sending' | 'done'>('form');

  const go = async () => {
    const tel = phone ? normaliseTzPhone(phone.startsWith('0') || phone.startsWith('+') ? phone : `0${phone}`) : null;
    if (name.trim().length < 2) return setErr('Please add your name.');
    if (!tel) return setErr('Enter a valid Tanzanian mobile number (7XX XXX XXX).');
    if (!consent) return setErr('Please tick the box so we may send you health news.');
    setErr('');
    setState('sending');
    try {
      await submit('subscribers', {
        full_name: name.trim(), title: job, profession: job, specialties: [], phone: tel, language: 'en', channel: 'whatsapp',
        sector: 'Health', source, consent: true, consent_at: new Date().toISOString(), status: 'pending',
      });
      setState('done');
    } catch (e) {
      setErr((e as Error).message);
      setState('form');
    }
  };

  const label = 'flex flex-col gap-1.5 text-sm font-bold text-[#33465F]';
  return (
    <div className="rounded-[24px] bg-white p-5 text-basil-ink shadow-[0_24px_60px_rgba(0,0,0,0.25)] sm:p-7">
      <AnimatePresence mode="wait">
        {state === 'done' ? (
          <motion.div key="ok" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} role="status" className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 size={52} className="text-basil" />
            <h3 className="m-0 text-2xl font-extrabold">Karibu, {name.split(' ')[0]}!</h3>
            <p className="m-0 max-w-sm text-basil-muted">You are subscribed. Health news and events will come to your phone.</p>
          </motion.div>
        ) : (
          <motion.form key="f" exit={{ opacity: 0 }} onSubmit={(e) => (e.preventDefault(), go())} noValidate className="flex flex-col gap-4">
            <label className={label}>Name
              <input className="field-light" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Neema Mushi" autoComplete="name" />
            </label>
            <div className={label} role="group" aria-label="Occupation">Occupation
              <div className="flex flex-wrap gap-1.5">
                {OCCUPATIONS.map((o) => (
                  <button key={o} type="button" aria-pressed={job === o} onClick={() => setJob(o)} className={`min-h-[40px] rounded-full px-3.5 text-sm font-semibold transition ${job === o ? 'border-0 bg-basil text-white' : 'border border-basil-edge bg-white text-basil-deep'}`}>{o}</button>
                ))}
              </div>
            </div>
            <label className={label}>Phone (WhatsApp / SMS)
              <span className="flex h-12 items-center overflow-hidden rounded-xl border border-basil-edge focus-within:border-basil"><span className="flex h-full items-center bg-basil-mist px-3 font-bold text-basil-muted">+255</span><input type="tel" inputMode="tel" className="h-full min-w-0 flex-1 border-0 px-3 text-[15px] outline-none" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="7XX XXX XXX" autoComplete="tel-national" /></span>
            </label>
            <button type="button" aria-pressed={consent} onClick={() => setConsent(!consent)} className="flex items-start gap-3 rounded-2xl border border-basil-line bg-basil-mist p-3 text-left text-[13px] text-[#33465F]">
              <span className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] text-white ${consent ? 'bg-basil' : 'border-[1.5px] border-[#9DBEE3] bg-white'}`}>{consent && <Check size={15} />}</span>
              <span>I agree to receive health news and events from Basil Media. I can stop anytime by replying STOP.</span>
            </button>
            {err && <p role="alert" className="m-0 text-sm font-bold text-red-700">{err}</p>}
            <button type="submit" disabled={state === 'sending'} className="btn-primary h-12 text-[15px]">{state === 'sending' && <Loader2 className="animate-spin" size={18} />}Subscribe free</button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
