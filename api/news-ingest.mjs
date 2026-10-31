// Vercel function: GET /api/news-ingest — keeps the health news fresh (stories older than 72 h are deleted).
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-only) in the host's environment.
// - Vercel cron (vercel.json) calls it daily with CRON_SECRET as a Bearer token: always runs.
// - The news page calls it when the feed is more than 2 hours old: without the secret it only runs if
//   nobody has updated in the last 2 hours, so visitors cannot run it more often than that.
import { ingest } from './_news-core.mjs';

const MIN_GAP_MS = 2 * 36e5;

export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) return res.status(503).json({ ok: false, error: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set on the host' });
  const secret = process.env.CRON_SECRET;
  const trusted = !!secret && req.headers.authorization === `Bearer ${secret}`;
  try {
    if (!trusted) {
      const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/news_sources?select=last_fetched_at&order=last_fetched_at.desc.nullslast&limit=1`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
      const last = (await r.json())?.[0]?.last_fetched_at;
      if (last && Date.now() - new Date(last).getTime() < MIN_GAP_MS) return res.status(200).json({ ok: true, skipped: 'updated less than 2 hours ago', last });
    }
    const report = await ingest({ url, serviceKey });
    res.status(200).json({ ok: true, report });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
}
