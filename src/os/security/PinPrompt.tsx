// A small self-mounting dialog that asks for a 4-digit approval PIN (used by stepUp()).
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { KeyRound, X } from 'lucide-react';

function PinDialog({ mode, reason, error, done }: { mode: 'set' | 'enter'; reason: string; error?: string; done: (pin: string | null) => void }) {
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState(error ?? '');
  const ok = () => {
    if (!/^\d{4}$/.test(pin)) return setErr('Enter 4 digits.');
    if (mode === 'set' && pin !== again) return setErr('The two PINs do not match.');
    done(pin);
  };
  const cls = 'h-14 w-full rounded-xl border border-basil-edge bg-white px-3 text-center font-mono text-2xl tracking-[0.5em] text-basil-ink outline-none focus:border-basil';
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-basil-night/60 sm:items-center sm:p-4" onClick={() => done(null)}>
      <form role="dialog" aria-modal="true" aria-label="Approval PIN" onClick={(e) => e.stopPropagation()} onSubmit={(e) => (e.preventDefault(), ok())} className="flex w-full flex-col gap-3 rounded-t-[28px] bg-white p-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:max-w-sm sm:rounded-[28px]">
        <div className="flex items-center justify-between">
          <h2 className="m-0 flex items-center gap-2 text-lg font-extrabold"><KeyRound size={20} className="text-basil" />{mode === 'set' ? 'Set an approval PIN' : 'Confirm with your PIN'}</h2>
          <button type="button" aria-label="Cancel" onClick={() => done(null)} className="flex h-10 w-10 items-center justify-center rounded-full border-0 bg-basil-mist text-basil-deep"><X size={18} /></button>
        </div>
        <p className="m-0 text-sm text-basil-muted">{reason}</p>
        <label className="flex flex-col gap-1.5 text-sm font-bold text-[#33465F]">{mode === 'set' ? 'New 4-digit PIN' : 'PIN'}
          <input autoFocus inputMode="numeric" pattern="\d{4}" maxLength={4} type="password" autoComplete="off" className={cls} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
        </label>
        {mode === 'set' && (
          <label className="flex flex-col gap-1.5 text-sm font-bold text-[#33465F]">Type it again
            <input inputMode="numeric" maxLength={4} type="password" autoComplete="off" className={cls} value={again} onChange={(e) => setAgain(e.target.value.replace(/\D/g, ''))} />
          </label>
        )}
        {err && <div role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-800">{err}</div>}
        <button type="submit" className="btn-primary min-h-[48px]">{mode === 'set' ? 'Save PIN' : 'Confirm'}</button>
      </form>
    </div>
  );
}

export function askPin(mode: 'set' | 'enter', reason: string, error?: string): Promise<string | null> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(<PinDialog mode={mode} reason={reason} error={error} done={(p) => (root.unmount(), host.remove(), resolve(p))} />);
  });
}
