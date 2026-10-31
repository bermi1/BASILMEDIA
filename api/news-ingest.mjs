// Vercel function: GET /api/news-ingest — run daily by the cron in vercel.json.
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-only) in the host's environment.
// If CRON_SECRET is set, Vercel cron sends it as a Bearer token and other callers are refused.
import { ingest } from './_news-core.mjs';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'unauthorized' });
  try {
    const report = await ingest({
      url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
    });
    res.status(200).json({ ok: true, report });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
}
