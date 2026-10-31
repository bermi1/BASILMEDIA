import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Globe2, Loader2, type LucideIcon } from 'lucide-react';
import { PORTAL_BLURB, sortPortals } from '@/lib/roles';
import { portalMeta } from '@/os/PortalSwitcher';
import { useAuth } from '@/lib/auth';
import { useSeo } from '@/hooks/useSeo';
import { Fingerprint } from '@/components/icons';
import type { AppRole } from '@/lib/types';

type Portal = { role: AppRole | 'website'; name: string; line: string; to: string; Icon: LucideIcon; accent: string };
const WEBSITE: Portal = { role: 'website', name: 'Website CMS', line: 'Edit pages, pictures, videos and news', to: '/os/website', Icon: Globe2, accent: '#0A2F5C' };
const ALL: AppRole[] = ['boss', 'gm_cfo', 'finance', 'account_manager', 'growth', 'receptionist', 'project_lead', 'staff', 'storekeeper', 'driver', 'client'];

export default function Login() {
  useSeo('Sign in · Basil Media OS');
  const { user, signIn, signUp, resetPassword, canEditWebsite, signOut, loading } = useAuth();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>(params.get('mode') === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const go = async () => {
    setErr('');
    setBusy(true);
    try {
      if (mode === 'signin') await signIn(email.trim(), password);
      else {
        const { needsConfirm } = await signUp(email.trim(), password, name.trim());
        if (needsConfirm) setToast('Check your email to confirm your account, then sign in.');
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Every portal this person can open: own roles, roles the GM covers, and portals given for a project.
  const mine: AppRole[] = !user ? [] : user.roles.includes('super_admin') ? ALL : sortPortals(user.access.map((a) => a.role));
  const portals: Portal[] = [
    ...(canEditWebsite ? [WEBSITE] : []),
    ...mine.map((r) => { const m = portalMeta(r); return { role: r, name: m.label, line: PORTAL_BLURB[r] ?? '', to: '/os', Icon: m.Icon, accent: m.accent }; }),
  ];
  const open = (p: Portal) => {
    if (p.role !== 'website') try { localStorage.setItem('basil-acting-role', p.role); } catch { /* private mode */ }
    if (p.role !== 'website' && matchMedia('(max-width: 767px)').matches) location.assign('/app');
    else nav(p.to);
  };
  const next = params.get('next');
  useEffect(() => {
    if (user && next && next.startsWith('/os')) nav(next, { replace: true });
  }, [user, next, nav]);

  return (
    <div className="flex min-h-screen flex-wrap bg-basil-mist text-basil-ink">
      <section className="relative flex min-h-[230px] flex-[1_1_520px] flex-col justify-between overflow-hidden px-5 pb-16 pt-6 text-white sm:min-h-[340px] sm:px-12 sm:py-10 lg:pb-10" style={{ background: 'linear-gradient(160deg, #0A2F5C, #061E3D)' }}>
        <div aria-hidden="true" className="absolute left-1/2 top-1/2 -ml-[340px] -mt-[400px] h-[680px] w-[680px] animate-glow rounded-full" style={{ background: 'radial-gradient(circle, rgba(124,192,245,0.3), rgba(124,192,245,0) 65%)' }} />
        <div aria-hidden="true" className="absolute -bottom-[240px] -right-[220px] h-[560px] w-[560px] animate-glow rounded-full [animation-delay:-3s]" style={{ background: 'radial-gradient(circle, rgba(15,110,194,0.6), rgba(15,110,194,0) 70%)' }} />
        <Link to="/" className="relative font-display text-sm font-extrabold tracking-[0.16em] text-basil-haze no-underline hover:text-white">← BASIL MEDIA · OS</Link>
        <div className="relative flex items-center gap-4 py-4 sm:flex-col sm:items-start sm:gap-7 sm:py-8">
          <img src="/logo-reverse.svg" alt="Basil Media" className="h-16 w-16 animate-float sm:h-[168px] sm:w-[168px]" style={{ filter: 'drop-shadow(0 24px 50px rgba(0,0,0,0.45))' }} />
          <h1 className="m-0 max-w-[560px] text-[clamp(22px,4vw,58px)] font-extrabold leading-[1.08] tracking-[-0.02em]">Run the office.<br /><span className="text-basil-sky">Reach the audience.</span><br />Tell the story.</h1>
        </div>
        <div className="relative hidden flex-wrap gap-2.5 sm:flex">
          {['Role-based portals', 'Two-step verification', 'Dar es Salaam'].map((x) => (
            <span key={x} className="rounded-full border border-white/30 bg-white/10 px-3.5 py-2.5 text-[13px] text-basil-frost backdrop-blur-xl">{x}</span>
          ))}
        </div>
      </section>

      <section className="relative -mt-12 flex flex-[1.2_1_520px] items-start justify-center px-3 pb-10 sm:px-6 lg:mt-0 lg:items-center lg:py-10">
        <AnimatePresence mode="wait">
          {loading ? (
            <Loader2 key="ld" className="animate-spin text-basil" size={36} />
          ) : !user ? (
            <motion.form key="form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onSubmit={(e) => (e.preventDefault(), go())} className="flex w-full max-w-[460px] flex-col gap-4 rounded-[26px] border border-basil-line bg-white p-5 shadow-[0_20px_50px_rgba(10,47,92,0.16)] sm:gap-[18px] sm:rounded-[28px] sm:p-10">
              <div>
                <div className="font-mono text-[11px] tracking-[0.18em] text-basil">{mode === 'signin' ? 'KARIBU TENA' : 'KARIBU'}</div>
                <h2 className="m-0 mt-1.5 text-[26px] font-extrabold sm:text-[32px]">{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>
                <div className="mt-1.5 text-[15px] text-basil-muted">{mode === 'signin' ? 'Staff, partners and clients use the same door.' : 'The very first account becomes the Super Admin. After that, the Super Admin assigns roles.'}</div>
              </div>
              {mode === 'signin' && (
                <>
                  <button type="button" onClick={() => setToast('Passkey sign-in (fingerprint / Face ID) is switched on by your administrator. Use email for now.')} className="flex h-14 items-center justify-center gap-3 rounded-[18px] border-0 bg-basil text-[15px] font-bold text-white shadow-glow hover:bg-basil-deep sm:h-16 sm:text-base">
                    <Fingerprint /> Fingerprint / Face ID
                  </button>
                  <div className="flex items-center gap-3 text-[13px] text-basil-muted"><span className="h-px flex-1 bg-basil-line" />or with email<span className="h-px flex-1 bg-basil-line" /></div>
                </>
              )}
              {mode === 'signup' && (
                <label className="flex flex-col gap-1.5 text-sm font-bold text-[#33465F]">Full name<input className="h-[52px] rounded-[14px] border border-basil-edge px-3.5 text-base font-normal" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label>
              )}
              <label className="flex flex-col gap-1.5 text-sm font-bold text-[#33465F]">Email<input type="email" required className="h-[52px] rounded-[14px] border border-basil-edge px-3.5 text-base font-normal" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@basilmedia.co.tz" autoComplete="email" /></label>
              <label className="flex flex-col gap-1.5 text-sm font-bold text-[#33465F]">Password<input type="password" required minLength={mode === 'signup' ? 8 : undefined} className="h-[52px] rounded-[14px] border border-basil-edge px-3.5 text-base font-normal" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></label>
              {mode === 'signin' && (
                <div className="flex justify-end">
                  <button type="button" onClick={async () => { if (!email) return setErr('Enter your email first.'); try { await resetPassword(email); setToast('Reset link sent · check your email'); } catch (e) { setErr((e as Error).message); } }} className="min-h-[44px] border-0 bg-transparent p-0 text-sm font-bold text-basil">Forgot password?</button>
                </div>
              )}
              {err && <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{err}</div>}
              <button type="submit" disabled={busy} className="flex h-[54px] items-center justify-center gap-2 rounded-2xl border-[1.5px] border-basil bg-white text-base font-bold text-basil hover:bg-basil-ice disabled:opacity-60">
                {busy && <Loader2 className="animate-spin" size={18} />}{mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
              <div className="text-center text-sm text-basil-muted">
                {mode === 'signin' ? <>First time setting up Basil Media OS? <button type="button" className="border-0 bg-transparent p-0 font-bold text-basil" onClick={() => setMode('signup')}>Create the first account</button></> : <>Already have an account? <button type="button" className="border-0 bg-transparent p-0 font-bold text-basil" onClick={() => setMode('signin')}>Sign in</button></>}
              </div>
            </motion.form>
          ) : (
            <motion.div key="portal" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex w-full max-w-[760px] flex-col gap-5">
              <div>
                <div className="font-mono text-[11px] tracking-[0.18em] text-basil">HABARI, {(user.name || user.email).split(/[ @]/)[0].toUpperCase()}</div>
                <h2 className="m-0 mt-2 text-[34px] font-extrabold">Choose your portal</h2>
                <div className="mt-1.5 text-[15px] text-basil-muted">{portals.length > 1 ? 'Each portal has its own menu — you can switch any time from the top of the app.' : 'Your portal is ready.'}</div>
              </div>
              {portals.length ? (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3.5">
                  {portals.map((p) => { const { role, name: n, line, Icon, accent } = p; return (
                    <button type="button" key={role} onClick={() => open(p)} className="flex min-h-[150px] flex-col gap-3 rounded-[22px] border border-basil-line bg-white p-5 text-left text-basil-ink no-underline transition hover:-translate-y-[3px] hover:border-basil-soft hover:text-basil-ink hover:shadow-[0_18px_36px_rgba(10,47,92,0.14)]">
                      <span className="flex items-start justify-between"><span className="flex h-12 w-12 items-center justify-center rounded-[14px] text-white" style={{ background: accent }}><Icon size={24} /></span><Check size={18} className="text-basil-edge" /></span>
                      <span><span className="block font-display text-lg font-extrabold">{n}</span><span className="mt-1 block text-[13px] leading-[1.45] text-basil-muted">{line}</span></span>
                    </button>
                  ); })}
                </div>
              ) : (
                <div className="rounded-[22px] border border-basil-line bg-white p-6 text-basil-muted">Your account is waiting for a role. Ask the Super Admin to give you access.</div>
              )}
              <button type="button" onClick={signOut} className="self-start border-0 bg-transparent font-bold text-basil-muted">Sign out</button>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {toast && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status" className="absolute bottom-7 left-1/2 max-w-[90%] -translate-x-1/2 rounded-2xl bg-basil-deep px-5 py-3.5 text-sm text-white shadow-[0_12px_30px_rgba(10,47,92,0.35)]">{toast}</motion.div>}
        </AnimatePresence>
      </section>
    </div>
  );
}
