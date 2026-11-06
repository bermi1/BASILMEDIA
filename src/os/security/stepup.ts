// Step-up confirmation for sensitive actions (finance can adopt it: `if (!(await stepUp('Pay TSH 4,200,000'))) return;`).
// Uses a passkey when the user has one, otherwise a 4-digit approval PIN (hashed in approval_pins).
// Every success is recorded in step_up_events (user, reason, method, time, user agent).
import { supabase } from '@/lib/supabase';
import { demoTable, insertRow } from '@/os/lib/store';
import { passkeyStepUp, passkeysSupported, sha256Hex, ua } from './lib';
import { askPin } from './PinPrompt';

const DEMO_USER = 'demo';

export async function hasPasskey(): Promise<boolean> {
  if (!supabase) return demoTable('passkey_credentials').length > 0;
  const { count } = await supabase.from('passkey_credentials').select('id', { count: 'exact', head: true });
  return (count ?? 0) > 0;
}
export async function hasPin(): Promise<boolean> {
  if (!supabase) return demoTable('approval_pins').some((p) => p.user_id === DEMO_USER);
  const { count } = await supabase.from('approval_pins').select('id', { count: 'exact', head: true });
  return (count ?? 0) > 0;
}

/** Set or change the approval PIN. Returns false if the user cancelled. */
export async function setPinInteractive(): Promise<boolean> {
  let error: string | undefined;
  for (;;) {
    const pin = await askPin('set', 'Your PIN confirms approvals and payments when you have no passkey on this device.', error);
    if (!pin) return false;
    try {
      if (supabase) {
        const { error: e } = await supabase.rpc('set_approval_pin', { _pin: pin });
        if (e) throw e;
      } else {
        if (['0000', '1111', '1234', '4321', '2222', '9999'].includes(pin)) throw new Error('Choose a less obvious PIN');
        const rows = demoTable('approval_pins');
        const hash = await sha256Hex(`basil-pin:${pin}`);
        const ex = rows.find((r) => r.user_id === DEMO_USER);
        if (ex) ex.pin_hash = hash;
        else await insertRow('approval_pins', { user_id: DEMO_USER, pin_hash: hash, failed_attempts: 0 });
      }
      return true;
    } catch (e) {
      error = (e as Error).message;
    }
  }
}

async function record(reason: string, method: 'pin' | 'passkey') {
  if (!supabase) await insertRow('step_up_events', { user_id: DEMO_USER, reason, method, user_agent: ua(), at: new Date().toISOString() });
}

/** Ask the user to prove it is really them. Resolves true when confirmed, false when cancelled. */
export async function stepUp(reason: string): Promise<boolean> {
  if (supabase && passkeysSupported() && (await hasPasskey().catch(() => false))) {
    try {
      await passkeyStepUp(reason);
      return true;
    } catch {
      /* cancelled or failed: fall back to PIN */
    }
  }
  if (!(await hasPin().catch(() => false)) && !(await setPinInteractive())) return false;
  let error: string | undefined;
  for (let tries = 0; tries < 5; tries++) {
    const pin = await askPin('enter', reason, error);
    if (!pin) return false;
    try {
      if (supabase) {
        const { data, error: e } = await supabase.rpc('verify_approval_pin', { _pin: pin, _reason: reason, _user_agent: ua() });
        if (e) throw e;
        if (data) return true;
      } else {
        const row = demoTable('approval_pins').find((r) => r.user_id === DEMO_USER);
        if (row && row.pin_hash === (await sha256Hex(`basil-pin:${pin}`))) {
          await record(reason, 'pin');
          return true;
        }
      }
      error = 'That PIN is not correct.';
    } catch (e) {
      error = (e as Error).message;
    }
  }
  return false;
}
