// Picks the Supabase URL + public key the website is built with, from whatever the host provides:
// VITE_SUPABASE_*, SUPABASE_* (e.g. Vercel's Supabase integration) or NEXT_PUBLIC_SUPABASE_*.
// - URL and key always come from the SAME group (mixing projects causes "Invalid API key").
// - Stray spaces, line breaks and quotes from copy-paste are removed.
// - A classic anon key (JWT) must belong to the same project as the URL.
// - Secret / service-role keys are refused: they must never reach the browser.
const clean = (v) => (v ?? '').trim().replace(/^['"]|['"]$/g, '').replace(/\s+/g, '');

function jwtPayload(key) {
  try {
    return JSON.parse(Buffer.from(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch {
    return null;
  }
}
const projectRef = (url) => (url.match(/^https:\/\/([a-z0-9]+)\.supabase\.(co|in)/i) ?? [])[1] ?? '';

/** Returns { url, key, source, problems[] } */
export function pickSupabaseEnv(env) {
  const groups = [
    ['VITE_SUPABASE', clean(env.VITE_SUPABASE_URL), clean(env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY)],
    ['SUPABASE', clean(env.SUPABASE_URL), clean(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY)],
    ['NEXT_PUBLIC_SUPABASE', clean(env.NEXT_PUBLIC_SUPABASE_URL), clean(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY)],
  ];
  const problems = [];
  let fallback = null;
  for (const [name, url, key] of groups) {
    if (!url && !key) continue;
    if (!url || !key) { problems.push(`${name}_URL and its key must both be set (one is missing) — ignored`); continue; }
    if (key.startsWith('sb_secret_')) { problems.push(`${name}: the key is a SECRET key — use the publishable/anon key. Ignored.`); continue; }
    if (key.startsWith('eyJ')) {
      const p = jwtPayload(key);
      if (!p) { problems.push(`${name}: the key is not a valid key (damaged when copied?) — ignored`); continue; }
      if (p.role === 'service_role') { problems.push(`${name}: the key is the SERVICE ROLE key — use the anon key. Ignored.`); continue; }
      const ref = projectRef(url);
      if (ref && p.ref && p.ref !== ref) { problems.push(`${name}: the key belongs to project "${p.ref}" but the URL is project "${ref}" — ignored`); continue; }
      return { url: url.replace(/\/+$/, ''), key, source: name, problems };
    }
    if (key.startsWith('sb_publishable_')) return { url: url.replace(/\/+$/, ''), key, source: name, problems };
    problems.push(`${name}: the key does not look like a Supabase key (expected eyJ… or sb_publishable_…)`);
    fallback ??= { url: url.replace(/\/+$/, ''), key, source: name };
  }
  return fallback ? { ...fallback, problems } : { url: '', key: '', source: '', problems };
}
