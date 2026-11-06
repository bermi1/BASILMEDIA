import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CheckCircle2 } from 'lucide-react';
import { submit } from '@/lib/db';
import { isEmail, normaliseTzPhone } from '@/lib/format';

const TITLES = ['Mr', 'Ms', 'Dr', 'Prof', 'Student', 'Entrepreneur', 'Nurse', 'Pharmacist', 'Other'];
const DESKS = ['Health', 'Youth & Opportunities', 'Innovation', 'Capital & Business', 'Banking for Youth'];
const SPECS = ['Cardiology', 'Paediatrics', 'Oncology', 'Nephrology', 'Obstetrics & Gynaecology', 'Orthopaedics', 'Public health', 'Pharmacy', 'Nursing', 'Laboratory', 'Dental', 'Mental health', 'ICT in health'];
const REGIONS = ['Dar es Salaam', 'Arusha', 'Dodoma', 'Mwanza', 'Mbeya', 'Kilimanjaro', 'Tanga', 'Morogoro', 'Zanzibar', 'Other region'];
const CHANNELS = [['sms', 'SMS'], ['whatsapp', 'WhatsApp'], ['email', 'Email']] as const;

export function SubscribeForm({ source = 'website' }: { source?: string }) {
  const [desks, setDesks] = useState<string[]>([]);
  const [f, setF] = useState({ title: 'Mr', full_name: '', region: 'Dar es Salaam', phone: '', email: '', institution: '' });
  const [specs, setSpecs] = useState<string[]>([]);
  const [channel, setChannel] = useState<'sms' | 'whatsapp' | 'email'>('sms');
  const [language, setLanguage] = useState<'en' | 'sw'>('en');
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState('');
  const [state, setState] = useState<'form' | 'sending' | 'done'>('form');

  const pill = (on: boolean) => `min-h-[44px] rounded-full px-4 text-sm font-semibold transition ${on ? 'border-0 bg-basil text-white' : 'border border-basil-edge bg-white text-basil-deep hover:border-basil'}`;

  const go = async () => {
    const phone = f.phone ? normaliseTzPhone(f.phone.startsWith('0') || f.phone.startsWith('+') ? f.phone : `0${f.phone}`) : null;
    if (f.full_name.trim().length < 2) return setErr('Please add your full name.');
    if (!desks.length) return setErr('Choose at least one topic you want to receive.');
    if (channel !== 'email' && !phone) return setErr('Enter a valid Tanzanian mobile number (7XX XXX XXX).');
    if (channel === 'email' && !isEmail(f.email)) return setErr('Enter a valid email address.');
    if (!consent) return setErr('Please tick the consent box so we may send you updates.');
    setErr('');
    setState('sending');
    try {
      await submit('subscribers', {
        full_name: f.full_name.trim(), title: f.title, profession: f.title, specialties: [...desks, ...specs], institution: f.institution.trim(),
        region: f.region, phone: phone ?? '', email: f.email.trim(), language, channel, sector: desks.join(', '), source,
        consent: true, consent_at: new Date().toISOString(), status: 'pending',
      });
      setState('done');
    } catch (e) {
      setErr((e as Error).message);
      setState('form');
    }
  };

  return (
    <div className="rounded-[28px] bg-white p-6 text-basil-ink shadow-[0_30px_70px_rgba(0,0,0,0.3)] sm:p-8">
      <AnimatePresence mode="wait">
        {state === 'done' ? (
          <motion.div key="ok" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} role="status" className="flex flex-col items-center gap-3 py-10 text-center">
            <CheckCircle2 size={56} className="text-basil" />
            <h3 className="m-0 text-2xl font-extrabold">Karibu, {f.title} {f.full_name.split(' ')[0]}!</h3>
            <p className="m-0 max-w-sm text-basil-muted">We will send a confirmation {channel === 'email' ? 'email' : 'message'}. Your first Basil Brief arrives on Monday.</p>
          </motion.div>
        ) : (
          <motion.form key="f" exit={{ opacity: 0 }} onSubmit={(e) => (e.preventDefault(), go())} noValidate className="flex flex-col gap-5">
            <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
              <label className="flex flex-col gap-1.5 text-sm font-bold text-[#33465F]">Title
                <select className="field-light" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })}>{TITLES.map((x) => <option key={x}>{x}</option>)}</select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-bold text-[#33465F]">Full name
                <input className="field-light" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} placeholder="e.g. Neema Mushi" autoComplete="name" />
              </label>
            </div>
            <div>
              <div className="mb-2 text-sm font-bold text-[#33465F]">What would you like to receive?</div>
              <div role="group" aria-label="Topics" className="flex flex-wrap gap-2">
                {DESKS.map((d) => {
                  const on = desks.includes(d);
                  return <button key={d} type="button" aria-pressed={on} onClick={() => setDesks(on ? desks.filter((x) => x !== d) : [...desks, d])} className={pill(on)}>{d}</button>;
                })}
              </div>
            </div>
            {desks.includes('Health') && <div>
              <div className="mb-2 text-sm font-bold text-[#33465F]">Health specialties <span className="font-normal text-basil-muted">· optional</span></div>
              <div role="group" aria-label="Specialties" className="flex flex-wrap gap-2">
                {SPECS.map((sp) => {
                  const on = specs.includes(sp);
                  return <button key={sp} type="button" aria-pressed={on} onClick={() => setSpecs(on ? specs.filter((x) => x !== sp) : [...specs, sp])} className={pill(on)}>{sp}</button>;
                })}
              </div>
            </div>}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-bold text-[#33465F]">Region
                <select className="field-light" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })}>{REGIONS.map((x) => <option key={x}>{x}</option>)}</select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-bold text-[#33465F]">Institution <span className="sr-only">(optional)</span>
                <input className="field-light" value={f.institution} onChange={(e) => setF({ ...f, institution: e.target.value })} placeholder="School, company, hospital…" />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><div className="mb-2 text-sm font-bold text-[#33465F]">Preferred channel</div>
                <div role="group" aria-label="Preferred channel" className="flex flex-wrap gap-2">{CHANNELS.map(([k, l]) => <button key={k} type="button" aria-pressed={channel === k} onClick={() => setChannel(k)} className={pill(channel === k)}>{l}</button>)}</div>
              </div>
              <div><div className="mb-2 text-sm font-bold text-[#33465F]">Language</div>
                <div role="group" aria-label="Language" className="flex flex-wrap gap-2">{([['en', 'English'], ['sw', 'Kiswahili']] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={language === k} onClick={() => setLanguage(k)} className={pill(language === k)}>{l}</button>)}</div>
              </div>
            </div>
            {channel === 'email' ? (
              <label className="flex flex-col gap-1.5 text-sm font-bold text-[#33465F]">Email<input type="email" className="field-light" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="you@hospital.go.tz" autoComplete="email" /></label>
            ) : (
              <label className="flex flex-col gap-1.5 text-sm font-bold text-[#33465F]">Phone
                <span className="flex h-12 items-center overflow-hidden rounded-xl border border-basil-edge focus-within:border-basil"><span className="flex h-full items-center bg-basil-mist px-3 font-bold text-basil-muted">+255</span><input type="tel" inputMode="tel" className="h-full min-w-0 flex-1 border-0 px-3 text-[15px] outline-none" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="7XX XXX XXX" autoComplete="tel-national" /></span>
              </label>
            )}
            <button type="button" aria-pressed={consent} onClick={() => setConsent(!consent)} className="flex items-start gap-3 rounded-2xl border border-basil-line bg-basil-mist p-3.5 text-left text-sm text-[#33465F]">
              <span className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] text-white ${consent ? 'bg-basil' : 'border-[1.5px] border-[#9DBEE3] bg-white'}`}>{consent && <Check size={15} />}</span>
              <span>I agree to receive updates from Basil Media and know I can stop anytime. <span className="text-basil-muted">Processed under the Tanzania Personal Data Protection Act, 2022.</span></span>
            </button>
            {err && <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{err}</div>}
            <button type="submit" disabled={state === 'sending'} className="h-14 rounded-2xl border-0 bg-basil text-base font-bold text-white shadow-glow hover:bg-basil-deep disabled:opacity-70">{state === 'sending' ? 'Subscribing…' : 'Subscribe to the Basil Brief'}</button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
