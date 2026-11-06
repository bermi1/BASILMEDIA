// Security helpers: two-factor settings, login events, SHA-256, and the WebAuthn browser side of passkeys
// (the server side is supabase/functions/passkey). No extra npm packages: base64url ↔ ArrayBuffer by hand.
import { supabase } from '@/lib/supabase';
import { demoTable, insertRow, newId, nowIso, persistDemo } from '@/os/lib/store';
import type { AppRole } from '@/lib/types';

export const DEFAULT_2FA_ROLES: AppRole[] = ['boss', 'gm_cfo', 'finance', 'super_admin'];
export const ua = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent.slice(0, 300));

export async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function required2faRoles(): Promise<AppRole[]> {
  if (!supabase) return DEFAULT_2FA_ROLES;
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'require_2fa_roles').maybeSingle();
  return Array.isArray(data?.value) ? (data!.value as AppRole[]) : DEFAULT_2FA_ROLES;
}

/** Called after every successful sign-in (password or passkey). Never throws. */
export async function recordLoginEvent(method: 'password' | 'passkey' = 'password', demoUserId?: string) {
  try {
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      if (data.user) await supabase.from('login_events').insert({ user_id: data.user.id, method, user_agent: ua() });
      return;
    }
    await insertRow('login_events', { user_id: demoUserId ?? 'demo', method, user_agent: ua() });
  } catch {
    /* best effort */
  }
}

/** Short device label from a user agent string. */
export function deviceLabel(agent: string) {
  const os = /iPhone|iPad/.test(agent) ? 'iPhone/iPad' : /Android/.test(agent) ? 'Android' : /Mac OS X/.test(agent) ? 'Mac' : /Windows/.test(agent) ? 'Windows' : /Linux/.test(agent) ? 'Linux' : 'Device';
  const br = /Edg\//.test(agent) ? 'Edge' : /OPR\//.test(agent) ? 'Opera' : /Chrome\//.test(agent) ? 'Chrome' : /Firefox\//.test(agent) ? 'Firefox' : /Safari\//.test(agent) ? 'Safari' : 'Browser';
  return `${br} on ${os}`;
}

// ---------------- WebAuthn ----------------
const b64uToBuf = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='));
  return Uint8Array.from(b, (c) => c.charCodeAt(0)).buffer;
};
const bufToB64u = (b: ArrayBuffer | null) => (b ? btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : undefined);

export const passkeysSupported = () => typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;

type Json = Record<string, unknown>;
async function fn(body: Json) {
  if (!supabase) throw new Error('Passkeys need Supabase (demo mode keeps everything in this browser).');
  const { data, error } = await supabase.functions.invoke('passkey', { body });
  if (error) {
    let msg = error.message;
    try {
      msg = (await (error as { context?: Response }).context?.json())?.error ?? msg;
    } catch {
      /* keep */
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data as Json;
}

/** Register a passkey for the signed-in user ("Add this device"). */
export async function registerPasskey(deviceName: string) {
  if (!passkeysSupported()) throw new Error('This browser does not support passkeys.');
  if (!supabase) {
    demoTable('passkey_credentials').push({ id: newId(), user_id: 'demo', credential_id: `demo-${newId()}`, device_name: deviceName, counter: 0, last_used_at: null, created_at: nowIso() });
    persistDemo();
    return;
  }
  const { options, token } = (await fn({ action: 'register-options' })) as { options: Json & { user: Json; excludeCredentials?: Json[] }; token: string };
  const o = options as unknown as PublicKeyCredentialCreationOptions & { challenge: string; user: { id: string } };
  const cred = (await navigator.credentials.create({
    publicKey: {
      ...o,
      challenge: b64uToBuf(o.challenge as unknown as string),
      user: { ...o.user, id: b64uToBuf(o.user.id) } as PublicKeyCredentialUserEntity,
      excludeCredentials: ((options.excludeCredentials ?? []) as { id: string; type: 'public-key' }[]).map((c) => ({ ...c, type: 'public-key' as const, id: b64uToBuf(c.id) })),
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('Cancelled');
  const r = cred.response as AuthenticatorAttestationResponse;
  const response = {
    id: cred.id,
    rawId: bufToB64u(cred.rawId),
    type: cred.type,
    clientExtensionResults: cred.getClientExtensionResults(),
    authenticatorAttachment: cred.authenticatorAttachment ?? undefined,
    response: { clientDataJSON: bufToB64u(r.clientDataJSON), attestationObject: bufToB64u(r.attestationObject), transports: r.getTransports?.() ?? [] },
  };
  await fn({ action: 'register-verify', token, response, deviceName });
}

async function assert(mode: 'login' | 'stepup', extra: Json = {}) {
  const { options, token } = (await fn({ action: 'auth-options', mode })) as { options: Json & { challenge: string; allowCredentials?: { id: string }[] }; token: string };
  const cred = (await navigator.credentials.get({
    publicKey: {
      ...(options as unknown as PublicKeyCredentialRequestOptions),
      challenge: b64uToBuf(options.challenge),
      allowCredentials: (options.allowCredentials ?? []).map((c) => ({ ...c, type: 'public-key' as const, id: b64uToBuf(c.id) })),
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('Cancelled');
  const r = cred.response as AuthenticatorAssertionResponse;
  const response = {
    id: cred.id,
    rawId: bufToB64u(cred.rawId),
    type: cred.type,
    clientExtensionResults: cred.getClientExtensionResults(),
    response: { clientDataJSON: bufToB64u(r.clientDataJSON), authenticatorData: bufToB64u(r.authenticatorData), signature: bufToB64u(r.signature), userHandle: bufToB64u(r.userHandle) },
  };
  return fn({ action: 'auth-verify', mode, token, response, ...extra });
}

/** Passwordless sign-in: the function verifies the passkey and hands back a one-time token for a session. */
export async function signInWithPasskey() {
  if (!supabase) throw new Error('Demo mode: passkey sign-in needs Supabase. Use email for now.');
  if (!passkeysSupported()) throw new Error('This browser does not support passkeys.');
  const { token_hash } = (await assert('login')) as { token_hash: string };
  const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'magiclink' });
  if (error) throw error;
  await recordLoginEvent('passkey');
}

export async function passkeyStepUp(reason: string) {
  await assert('stepup', { reason });
}
