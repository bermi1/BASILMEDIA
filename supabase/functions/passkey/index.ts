// Passkeys (WebAuthn) for Basil Media OS, verified server-side with @simplewebauthn/server.
// Stateless challenges: each options response carries an HMAC-signed token (challenge + expiry) that the
// browser returns with its answer, so no challenge table is needed.
// Actions:
//   register-options / register-verify  (signed in)  → stores credential id + public key + counter
//   auth-options / auth-verify  mode 'stepup' (signed in) → records step_up_events
//                               mode 'login'  (anonymous) → returns a one-time magic-link token_hash the browser exchanges for a session
// Secrets (supabase secrets set): PASSKEY_RP_ID (e.g. basilmedia.co.tz), PASSKEY_ORIGINS (comma list, e.g. https://basilmedia.co.tz,http://localhost:5173)
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from 'https://esm.sh/@simplewebauthn/server@10';
import { isoBase64URL } from 'https://esm.sh/@simplewebauthn/server@10/helpers';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const SECRET = Deno.env.get('PASSKEY_SECRET') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

async function hmac(data: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return isoBase64URL.fromBuffer(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))));
}
async function sealChallenge(challenge: string, kind: string, userId = '') {
  const body = `${kind}.${challenge}.${userId}.${Date.now() + 5 * 60_000}`;
  return `${body}.${await hmac(body)}`;
}
async function openChallenge(token: string, kind: string, userId = '') {
  const parts = String(token ?? '').split('.');
  if (parts.length !== 5) throw new Error('Bad challenge');
  const [k, challenge, uid, exp, sig] = parts;
  if (sig !== (await hmac(parts.slice(0, 4).join('.')))) throw new Error('Bad challenge');
  if (k !== kind || uid !== userId || Number(exp) < Date.now()) throw new Error('Challenge expired');
  return challenge;
}

function rp(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const allowed = (Deno.env.get('PASSKEY_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.length && !allowed.includes(origin)) throw new Error('Origin not allowed');
  const rpID = Deno.env.get('PASSKEY_RP_ID') ?? new URL(origin).hostname;
  return { origin: allowed.length ? allowed : [origin], rpID };
}

async function caller(req: Request) {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const { data } = await admin.auth.getUser(jwt);
  return data.user ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json();
    const { action } = body as { action: string };
    const { origin, rpID } = rp(req);
    const user = await caller(req);
    const ua = String(req.headers.get('user-agent') ?? '').slice(0, 300);

    if (action === 'register-options') {
      if (!user) return json({ error: 'Sign in first' }, 401);
      const { data: creds } = await admin.from('passkey_credentials').select('credential_id').eq('user_id', user.id);
      const options = await generateRegistrationOptions({
        rpName: 'Basil Media OS',
        rpID,
        userName: user.email ?? user.id,
        userDisplayName: (user.user_metadata?.full_name as string) ?? user.email ?? '',
        userID: new TextEncoder().encode(user.id),
        attestationType: 'none',
        excludeCredentials: (creds ?? []).map((c) => ({ id: c.credential_id as string })),
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
      });
      return json({ options, token: await sealChallenge(options.challenge, 'reg', user.id) });
    }

    if (action === 'register-verify') {
      if (!user) return json({ error: 'Sign in first' }, 401);
      const expectedChallenge = await openChallenge(body.token, 'reg', user.id);
      const v = await verifyRegistrationResponse({ response: body.response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: false });
      if (!v.verified || !v.registrationInfo) return json({ error: 'Passkey could not be verified' }, 400);
      const { credentialID, credentialPublicKey, counter } = v.registrationInfo;
      const { error } = await admin.from('passkey_credentials').insert({
        user_id: user.id,
        credential_id: credentialID,
        public_key: isoBase64URL.fromBuffer(credentialPublicKey),
        counter,
        device_name: String(body.deviceName ?? 'This device').slice(0, 80),
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'auth-options') {
      const mode = body.mode === 'stepup' ? 'stepup' : 'login';
      if (mode === 'stepup' && !user) return json({ error: 'Sign in first' }, 401);
      let allow: { id: string }[] | undefined;
      if (mode === 'stepup') {
        const { data: creds } = await admin.from('passkey_credentials').select('credential_id').eq('user_id', user!.id);
        allow = (creds ?? []).map((c) => ({ id: c.credential_id as string }));
        if (!allow.length) return json({ error: 'No passkey on this account' }, 400);
      }
      const options = await generateAuthenticationOptions({ rpID, allowCredentials: allow, userVerification: 'preferred' });
      return json({ options, token: await sealChallenge(options.challenge, mode, mode === 'stepup' ? user!.id : '') });
    }

    if (action === 'auth-verify') {
      const mode = body.mode === 'stepup' ? 'stepup' : 'login';
      if (mode === 'stepup' && !user) return json({ error: 'Sign in first' }, 401);
      const expectedChallenge = await openChallenge(body.token, mode, mode === 'stepup' ? user!.id : '');
      const { data: cred } = await admin.from('passkey_credentials').select('*').eq('credential_id', body.response?.id ?? '').maybeSingle();
      if (!cred) return json({ error: 'This passkey is not registered' }, 400);
      if (mode === 'stepup' && cred.user_id !== user!.id) return json({ error: 'Passkey belongs to another account' }, 403);
      const v = await verifyAuthenticationResponse({
        response: body.response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: false,
        authenticator: { credentialID: cred.credential_id, credentialPublicKey: isoBase64URL.toBuffer(cred.public_key), counter: Number(cred.counter) },
      });
      if (!v.verified) return json({ error: 'Passkey could not be verified' }, 400);
      await admin.from('passkey_credentials').update({ counter: v.authenticationInfo.newCounter, last_used_at: new Date().toISOString() }).eq('id', cred.id);

      if (mode === 'stepup') {
        await admin.from('step_up_events').insert({ user_id: cred.user_id, reason: String(body.reason ?? '').slice(0, 300), method: 'passkey', user_agent: ua });
        return json({ ok: true });
      }
      const { data: u } = await admin.auth.admin.getUserById(cred.user_id);
      if (!u.user?.email) return json({ error: 'Account has no email' }, 400);
      const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: u.user.email });
      if (error) return json({ error: error.message }, 400);
      return json({ email: u.user.email, token_hash: link.properties.hashed_token });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
