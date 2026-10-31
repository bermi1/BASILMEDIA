// Creates one test account per role in a Supabase project that already has the schema
// (run supabase/setup.sql first), assigns roles, then signs in as each to prove it works.
//
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SECRET_KEY=sb_secret_… SUPABASE_PUBLISHABLE_KEY=sb_publishable_… \
//   node scripts/create-accounts.mjs [output-file]
//
// The secret key is read from the environment only and is never written anywhere.
// Passwords are random and printed to the output file (default: ./accounts.local.txt, git-ignored).
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const URL_ = process.env.SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const PUB = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!URL_ || !SECRET || !PUB) throw new Error('Set SUPABASE_URL, SUPABASE_SECRET_KEY and SUPABASE_PUBLISHABLE_KEY');
const out = process.argv[2] ?? 'accounts.local.txt';

const ACCOUNTS = [
  ['admin@basilmedia.co.tz', 'Basil Media Admin', ['super_admin']],
  ['ceo@basilmedia.co.tz', 'Emmanuel (CEO)', ['boss']],
  ['gm@basilmedia.co.tz', 'Saul (GM/CFO)', ['gm_cfo']],
  ['finance@basilmedia.co.tz', 'Finance Officer', ['finance']],
  ['lead@basilmedia.co.tz', 'Enock (Project Lead)', ['project_lead', 'staff']],
  ['crew@basilmedia.co.tz', 'Jonathan (Crew)', ['staff']],
  ['store@basilmedia.co.tz', 'Storekeeper', ['storekeeper']],
  ['growth@basilmedia.co.tz', 'Growth & Accounts', ['growth', 'account_manager']],
  ['reception@basilmedia.co.tz', 'Rehema (Reception)', ['receptionist']],
  ['driver@basilmedia.co.tz', 'Driver', ['driver']],
  ['client@basilmedia.co.tz', 'Demo Client', ['client']],
];

const admin = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
const pw = () => `Bm-${randomBytes(9).toString('base64url')}`;
const lines = [`Basil Media OS test accounts · ${new Date().toISOString()}`, `Sign in at /login`, ''];

for (const [email, name, roles] of ACCOUNTS) {
  const password = pw();
  // Create (or reset the password of) the user.
  let r = await fetch(`${URL_}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: name } }) });
  let user = await r.json();
  if (!r.ok) {
    const list = await (await fetch(`${URL_}/auth/v1/admin/users?per_page=200`, { headers: admin })).json();
    user = list.users.find((u) => u.email === email);
    if (!user) throw new Error(`${email}: ${JSON.stringify(user)}`);
    await fetch(`${URL_}/auth/v1/admin/users/${user.id}`, { method: 'PUT', headers: admin, body: JSON.stringify({ password }) });
  }
  // Roles (service role bypasses RLS; duplicates ignored).
  for (const role of roles) {
    await fetch(`${URL_}/rest/v1/user_roles?on_conflict=user_id,role`, { method: 'POST', headers: { ...admin, Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify({ user_id: user.id, role }) });
  }
  // Test: sign in with the publishable key and read back own roles through RLS.
  const s = await (await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: PUB, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json();
  const mine = s.access_token ? await (await fetch(`${URL_}/rest/v1/user_roles?select=role&user_id=eq.${user.id}`, { headers: { apikey: PUB, Authorization: `Bearer ${s.access_token}` } })).json() : [];
  const ok = Array.isArray(mine) && roles.every((r) => mine.some((m) => m.role === r));
  console.log(`${ok ? '✓' : '✗'} ${email.padEnd(30)} ${roles.join(', ')}`);
  lines.push(`${email}\t${password}\t${roles.join(', ')}\t${ok ? 'tested OK' : 'CHECK FAILED'}`);
}
writeFileSync(out, lines.join('\n') + '\n');
console.log(`\nPasswords written to ${out} — share them privately and change them after first sign-in.`);
