// /os/security — two-factor, backup codes, passkeys ("Add this device"), approval PIN, sign-ins and devices.
import { useEffect, useState } from 'react';
import { Fingerprint, KeyRound, Laptop, Loader2, LogOut, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { isDemo, supabase } from '@/lib/supabase';
import { deleteRow, useTable } from '@/os/lib/store';
import { PageTitle } from '@/os/OsLayout';
import { useToast } from '@/os/cms/toast';
import { Card, Empty, Field, Pill, Sheet, inputCls } from '@/os/ui';
import { deviceLabel, passkeysSupported, registerPasskey, ua } from './lib';
import { hasPin, setPinInteractive, stepUp } from './stepup';
import { BackupCodes, TotpEnrol, regenerateBackupCodes } from './TwoFactor';

const when = (iso?: unknown) => (iso ? new Date(String(iso)).toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

interface Factor { id: string; friendly_name?: string; status: string; created_at: string }

export default function SecurityPage() {
  const { user } = useAuth();
  const toast = useToast();
  const uid = isDemo ? 'demo' : user?.id ?? '';
  const [factors, setFactors] = useState<Factor[]>([]);
  const [aal, setAal] = useState('');
  const [enrolOpen, setEnrolOpen] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [deviceName, setDeviceName] = useState(deviceLabel(ua()));
  const [busy, setBusy] = useState('');
  const [pinSet, setPinSet] = useState(false);
  const { rows: passkeys } = useTable<{ id: string; device_name: string; created_at: string; last_used_at: string | null }>('passkey_credentials', { eq: { user_id: uid }, order: 'created_at' });
  const { rows: backups } = useTable<{ id: string; used_at: string | null }>('backup_codes', { eq: { user_id: uid } });
  const { rows: logins } = useTable<{ id: string; user_agent: string; method: string; created_at: string }>('login_events', { eq: { user_id: user?.id ?? '' }, order: 'created_at', ascending: false, limit: 50 });
  const { rows: stepups } = useTable<{ id: string; reason: string; method: string; at: string; user_agent: string }>('step_up_events', { eq: { user_id: uid }, order: 'at', ascending: false, limit: 10 });

  const loadFactors = async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(((data?.all ?? []) as Factor[]).filter((f) => f.status === 'verified'));
    const { data: a } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setAal(a?.currentLevel ?? '');
  };
  useEffect(() => {
    void loadFactors();
    hasPin().then(setPinSet).catch(() => undefined);
  }, []);

  const devices = Object.values(
    logins.reduce<Record<string, { agent: string; last: string; count: number }>>((m, l) => {
      const k = l.user_agent || 'Unknown';
      m[k] = m[k] ? { ...m[k], count: m[k].count + 1 } : { agent: k, last: l.created_at, count: 1 };
      return m;
    }, {}),
  );

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try {
      await fn();
      if (ok) toast(ok);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy('');
    }
  };
  const unused = backups.filter((b) => !b.used_at).length;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <PageTitle tag="ACCOUNT · SECURITY" title="Security" sub="Two-factor, passkeys, your approval PIN and where you are signed in." />

      <Card title={<span className="flex items-center gap-2"><ShieldCheck size={18} className="text-basil" />Two-factor (authenticator app)</span>} action={factors.length ? <Pill tone="green">On{aal === 'aal2' ? ' · verified now' : ''}</Pill> : <Pill tone="amber">Off</Pill>}>
        {isDemo && <p className="mt-0 text-sm text-basil-muted">Demo mode: authenticator apps need a connected Supabase project. The sign-in gate still appears for Boss, GM/CFO, Finance and Super Admin, with a “Demo: skip” button.</p>}
        {factors.map((f) => (
          <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-basil-line py-2 last:border-0">
            <span><b>{f.friendly_name || 'Authenticator app'}</b><span className="block text-xs text-basil-muted">Added {when(f.created_at)}</span></span>
            <button type="button" className="btn-outline flex min-h-[44px] items-center gap-2" disabled={!!busy}
              onClick={() => confirm('Remove this authenticator? If your role requires two-factor you must add a new one.') && run('rm', async () => { const { error } = await supabase!.auth.mfa.unenroll({ factorId: f.id }); if (error) throw error; await loadFactors(); }, 'Authenticator removed')}><Trash2 size={16} />Remove</button>
          </div>
        ))}
        <div className="mt-3 flex flex-wrap gap-2">
          {!factors.length && !isDemo && <button type="button" className="btn-primary min-h-[44px]" onClick={() => setEnrolOpen(true)}>Set up authenticator</button>}
          {(factors.length > 0 || isDemo) && (
            <button type="button" className="btn-outline flex min-h-[44px] items-center gap-2" disabled={!!busy} onClick={() => run('codes', async () => setCodes(await regenerateBackupCodes()))}>
              {busy === 'codes' && <Loader2 size={16} className="animate-spin" />}New backup codes
            </button>
          )}
          {factors.length > 0 && <span className="self-center text-sm text-basil-muted">{unused} of 8 backup codes left</span>}
        </div>
      </Card>

      <Card title={<span className="flex items-center gap-2"><Fingerprint size={18} className="text-basil" />Passkeys (fingerprint / Face ID)</span>}>
        <p className="mt-0 text-sm text-basil-muted">A passkey lets you sign in and confirm approvals with this device’s fingerprint, face or screen lock. Basil Media keeps only the passkey’s public key, never your fingerprint.</p>
        {passkeys.length ? passkeys.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-basil-line py-2 last:border-0">
            <span className="flex items-center gap-2"><Smartphone size={18} className="text-basil" /><span><b>{p.device_name}</b><span className="block text-xs text-basil-muted">Added {when(p.created_at)} · last used {when(p.last_used_at)}</span></span></span>
            <button type="button" aria-label={`Remove ${p.device_name}`} className="btn-outline flex min-h-[44px] items-center gap-2" onClick={() => confirm('Remove this passkey?') && run('rmpk', () => deleteRow('passkey_credentials', p.id), 'Passkey removed')}><Trash2 size={16} />Remove</button>
          </div>
        )) : <p className="text-sm text-basil-muted">No passkeys yet.</p>}
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1"><Field label="Name for this device"><input className={inputCls} value={deviceName} onChange={(e) => setDeviceName(e.target.value)} /></Field></div>
          <button type="button" className="btn-primary flex min-h-[48px] items-center gap-2" disabled={!!busy || !passkeysSupported()} onClick={() => run('pk', () => registerPasskey(deviceName.trim() || 'This device'), isDemo ? 'Demo: passkey saved in this browser' : 'Passkey added')}>
            {busy === 'pk' ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={16} />}Add this device
          </button>
        </div>
        {!passkeysSupported() && <p className="text-sm text-amber-800">This browser does not support passkeys.</p>}
      </Card>

      <Card title={<span className="flex items-center gap-2"><KeyRound size={18} className="text-basil" />Approval PIN</span>} action={<Pill tone={pinSet ? 'green' : 'grey'}>{pinSet ? 'Set' : 'Not set'}</Pill>}>
        <p className="mt-0 text-sm text-basil-muted">Sensitive actions ask you to confirm it is really you: with a passkey if you have one, otherwise with this 4-digit PIN.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline min-h-[44px]" onClick={() => run('pin', async () => { if (await setPinInteractive()) { setPinSet(true); toast('PIN saved'); } })}>{pinSet ? 'Change PIN' : 'Set PIN'}</button>
          <button type="button" className="btn-outline min-h-[44px]" onClick={() => run('test', async () => toast((await stepUp('Test confirmation from the Security page')) ? 'Confirmed' : 'Cancelled'))}>Test confirmation</button>
        </div>
        {stepups.length > 0 && (
          <ul className="m-0 mt-3 list-none p-0 text-sm">
            {stepups.map((s) => <li key={s.id} className="border-t border-basil-line py-1.5"><b>{s.reason}</b> · {s.method} · {when(s.at)} · <span className="text-basil-muted">{deviceLabel(s.user_agent)}</span></li>)}
          </ul>
        )}
      </Card>

      <Card title={<span className="flex items-center gap-2"><Laptop size={18} className="text-basil" />Devices and sign-ins</span>}
        action={<button type="button" className="flex min-h-[44px] items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-bold text-red-800" onClick={() => confirm('Sign out on every device, including this one?') && run('out', async () => { if (supabase) await supabase.auth.signOut({ scope: 'global' }); location.href = '/login'; })}><LogOut size={16} />Sign out everywhere</button>}>
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-basil-ice px-3 py-2 text-sm"><Pill tone="blue">This device</Pill>{deviceLabel(ua())}</div>
        {devices.length ? (
          <ul className="m-0 list-none p-0">
            {devices.map((d) => <li key={d.agent} className="flex flex-wrap justify-between gap-2 border-b border-basil-line py-2 text-sm last:border-0"><span><b>{deviceLabel(d.agent)}</b><span className="block max-w-[520px] truncate text-xs text-basil-muted">{d.agent}</span></span><span className="text-basil-muted">Last sign-in {when(d.last)} · {d.count}×</span></li>)}
          </ul>
        ) : <Empty title="No sign-ins recorded yet" sub="Each sign-in from now on is recorded with its device and time." />}
      </Card>

      <Sheet open={enrolOpen} onClose={() => setEnrolOpen(false)} title="Set up two-factor">
        <TotpEnrol onDone={() => (setEnrolOpen(false), void loadFactors())} />
      </Sheet>
      <Sheet open={!!codes} onClose={() => setCodes(null)} title="Backup codes">
        {codes && <BackupCodes codes={codes} onDone={() => setCodes(null)} />}
      </Sheet>
    </div>
  );
}
