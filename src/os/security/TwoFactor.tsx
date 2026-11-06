// Two-factor (TOTP authenticator app) with Supabase MFA: enrolment with QR, sign-in challenge,
// 8 single-use backup codes, and a gate that requires 2FA for the roles in app_settings.require_2fa_roles.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Copy, Download, KeyRound, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { required2faRoles } from './lib';

const codeCls = 'h-14 w-full rounded-xl border border-basil-edge bg-white px-3 text-center font-mono text-2xl tracking-[0.35em] text-basil-ink outline-none focus:border-basil';
const SKIP = 'basil-demo-2fa-skip';

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-3 py-8">
      <div className="flex w-full max-w-[460px] flex-col gap-4 rounded-[26px] border border-basil-line bg-white p-5 text-basil-ink shadow-[0_20px_50px_rgba(10,47,92,0.16)] sm:p-8">{children}</div>
    </div>
  );
}
const Head = ({ kicker, title, sub }: { kicker: string; title: string; sub: string }) => (
  <div>
    <div className="font-mono text-[11px] tracking-[0.18em] text-basil">{kicker}</div>
    <h2 className="m-0 mt-1.5 flex items-center gap-2 text-2xl font-extrabold"><ShieldCheck className="text-basil" />{title}</h2>
    <p className="m-0 mt-1.5 text-[15px] text-basil-muted">{sub}</p>
  </div>
);
const Err = ({ msg }: { msg: string }) => (msg ? <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{msg}</div> : null);

/** Shows the backup codes once, with copy and download. */
export function BackupCodes({ codes, onDone }: { codes: string[]; onDone?: () => void }) {
  const text = `Basil Media OS backup codes (each works once)\n\n${codes.join('\n')}\n`;
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900"><b>Save these now.</b> They are shown only once. Each code works one time if you lose your phone.</div>
      <ol className="m-0 grid list-none grid-cols-2 gap-2 p-0">
        {codes.map((c) => <li key={c} className="rounded-lg bg-basil-ice px-3 py-2 text-center font-mono text-[15px] font-bold text-basil-deep">{c}</li>)}
      </ol>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-outline flex min-h-[44px] items-center gap-2" onClick={() => navigator.clipboard?.writeText(text)}><Copy size={16} />Copy</button>
        <a className="btn-outline flex min-h-[44px] items-center gap-2 no-underline" download="basil-media-backup-codes.txt" href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}><Download size={16} />Download</a>
      </div>
      {onDone && <button type="button" className="btn-primary min-h-[48px]" onClick={onDone}>I have saved my codes</button>}
    </div>
  );
}

export async function regenerateBackupCodes(): Promise<string[]> {
  if (!supabase) return Array.from({ length: 8 }, () => `${rand5()}-${rand5()}`);
  const { data, error } = await supabase.rpc('regenerate_backup_codes');
  if (error) throw error;
  return (data ?? []) as string[];
}
const rand5 = () => [...crypto.getRandomValues(new Uint8Array(3))].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 5).toUpperCase();

/** Enrol an authenticator app: QR code → 6-digit code → backup codes. */
export function TotpEnrol({ onDone }: { onDone: () => void }) {
  const [factor, setFactor] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (!supabase || started.current) return;
    started.current = true;
    (async () => {
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const f of list?.all ?? []) if (f.factor_type === 'totp' && f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`, issuer: 'Basil Media' });
      if (error) return setErr(error.message);
      if (data.type !== 'totp') return;
      setFactor({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })().catch((e) => setErr((e as Error).message));
  }, []);
  const verify = async () => {
    if (!supabase || !factor) return;
    setBusy(true);
    setErr('');
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
      if (error) throw error;
      setCodes(await regenerateBackupCodes());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (codes) return <BackupCodes codes={codes} onDone={onDone} />;
  if (!supabase) return <p className="m-0 text-sm text-basil-muted">Demo mode: authenticator apps need a connected Supabase project.</p>;
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => (e.preventDefault(), verify())}>
      <ol className="m-0 flex flex-col gap-1 pl-5 text-sm text-basil-muted">
        <li>Open Google Authenticator, Microsoft Authenticator or 1Password on your phone.</li>
        <li>Scan this QR code (or type the key).</li>
        <li>Enter the 6-digit code it shows.</li>
      </ol>
      {factor ? (
        <div className="flex flex-col items-center gap-2">
          <img src={factor.qr} alt="QR code for your authenticator app" className="h-48 w-48 rounded-xl border border-basil-line bg-white p-2" />
          <code className="break-all rounded-lg bg-basil-mist px-3 py-1.5 text-center text-xs">{factor.secret}</code>
        </div>
      ) : !err && <Loader2 className="mx-auto animate-spin text-basil" />}
      <label className="flex flex-col gap-1.5 text-sm font-bold text-[#33465F]">6-digit code
        <input className={codeCls} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
      </label>
      <Err msg={err} />
      <button type="submit" disabled={busy || code.length !== 6 || !factor} className="btn-primary flex min-h-[48px] items-center justify-center gap-2 disabled:opacity-60">{busy && <Loader2 className="animate-spin" size={18} />}Turn on two-factor</button>
    </form>
  );
}

/** Sign-in challenge for a user who already has an authenticator. */
export function TotpChallenge({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('');
  const [backup, setBackup] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!supabase) return;
    setBusy(true);
    setErr('');
    try {
      if (backup) {
        const { data, error } = await supabase.rpc('use_backup_code', { _code: code });
        if (error) throw error;
        if (!data) throw new Error('That backup code is not valid or was already used.');
        await supabase.auth.refreshSession();
      } else {
        const { data: f } = await supabase.auth.mfa.listFactors();
        const factor = f?.totp?.[0];
        if (!factor) throw new Error('No authenticator found on this account.');
        const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
        if (error) throw error;
      }
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => (e.preventDefault(), go())}>
      <label className="flex flex-col gap-1.5 text-sm font-bold text-[#33465F]">{backup ? 'Backup code' : '6-digit code from your authenticator app'}
        <input autoFocus className={codeCls} inputMode={backup ? 'text' : 'numeric'} autoComplete="one-time-code" maxLength={backup ? 11 : 6} value={code}
          onChange={(e) => setCode(backup ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, ''))} />
      </label>
      {backup && <p className="m-0 text-xs text-basil-muted">Using a backup code removes your old authenticator; you will set up a new one straight away.</p>}
      <Err msg={err} />
      <button type="submit" disabled={busy || code.length < 6} className="btn-primary flex min-h-[48px] items-center justify-center gap-2 disabled:opacity-60">{busy && <Loader2 className="animate-spin" size={18} />}Verify</button>
      <button type="button" className="min-h-[44px] border-0 bg-transparent text-sm font-bold text-basil" onClick={() => (setBackup(!backup), setCode(''), setErr(''))}><KeyRound size={14} className="mr-1 inline" />{backup ? 'Use my authenticator app' : 'Lost your phone? Use a backup code'}</button>
    </form>
  );
}

type GateState = 'loading' | 'ok' | 'enrol' | 'challenge' | 'demo';

/** Wrap OS / phone content: users in require_2fa_roles must enrol and reach aal2 first; anyone with a factor is challenged. */
export function TwoFactorGate({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const [state, setState] = useState<GateState>('loading');
  const stateRef = useRef(state);
  stateRef.current = state;
  const check = useCallback(async () => {
    if (!user) return setState('ok');
    const roles = await required2faRoles().catch(() => [] as string[]);
    const needs = user.roles.some((r) => roles.includes(r));
    if (!supabase) {
      let skipped = false;
      try {
        skipped = sessionStorage.getItem(SKIP) === '1';
      } catch {
        /* ignore */
      }
      return setState(needs && !skipped ? 'demo' : 'ok');
    }
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === 'aal2') return setState('ok');
    if (aal?.nextLevel === 'aal2') return setState('challenge');
    setState(needs ? 'enrol' : 'ok');
  }, [user]);
  useEffect(() => {
    void check();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((e) => {
      // While enrolling, wait for "I have saved my codes" so the backup codes stay on screen.
      if (stateRef.current !== 'enrol' && (e === 'MFA_CHALLENGE_VERIFIED' || e === 'TOKEN_REFRESHED' || e === 'USER_UPDATED')) void check();
    });
    return () => data.subscription.unsubscribe();
  }, [check]);

  if (state === 'ok') return <>{children}</>;
  if (state === 'loading') return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-basil" size={32} /></div>;
  const out = <button type="button" onClick={signOut} className="flex min-h-[44px] items-center justify-center gap-2 border-0 bg-transparent text-sm font-bold text-basil-muted"><LogOut size={16} />Sign out</button>;
  if (state === 'demo')
    return (
      <Panel>
        <Head kicker="TWO-STEP VERIFICATION" title="Two-factor is required" sub="Your role (Boss, GM/CFO, Finance or Super Admin) must use an authenticator app before opening Basil Media OS." />
        <TotpEnrol onDone={() => void check()} />
        <button type="button" className="btn-outline min-h-[48px]" onClick={() => { try { sessionStorage.setItem(SKIP, '1'); } catch { /* ignore */ } void check(); }}>Demo: skip</button>
        {out}
      </Panel>
    );
  if (state === 'challenge')
    return (
      <Panel>
        <Head kicker="TWO-STEP VERIFICATION" title="Enter your code" sub="Open your authenticator app to finish signing in." />
        <TotpChallenge onDone={() => void check()} />
        {out}
      </Panel>
    );
  return (
    <Panel>
      <Head kicker="TWO-STEP VERIFICATION" title="Set up two-factor" sub="Your role handles money and approvals, so Basil Media requires an authenticator app on your phone." />
      <TotpEnrol onDone={() => void check()} />
      {out}
    </Panel>
  );
}
