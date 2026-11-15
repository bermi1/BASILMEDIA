// Vercel function: GET /api/news?desk=health — fresh stories for one news desk, read straight from the
// desk's newsrooms (RSS / WHO). Nothing is written, so it needs no secret key: the list of sources is public
// (news_sources, read with the site's public key). The answer is cached on Vercel's network for 2 hours, so
// visitors get it instantly and the newsrooms are asked at most every 2 hours per desk.
import { collectDesk, DESK_MAX_AGE_HOURS } from './_news-core.mjs';

// The public project address and public (publishable) key the website itself uses (.env.production).
// Not the SUPABASE_URL / SUPABASE_ANON_KEY saved on Vercel: that pair is refused by this database (401).
const URL_ = 'https://vodhxhbjncvhogdgkmfy.supabase.co';
const KEY = 'sb_publishable__sBG8Fjlu-S4PYwaDTNAww_4oL-0cLm';

export default async function handler(req, res) {
  const desk = String(req.query?.desk ?? 'health');
  if (!(desk in DESK_MAX_AGE_HOURS)) return res.status(400).json({ error: 'unknown desk' });
  try {
    const q = `news_sources?select=name,url,format,zone,health_only,keywords,desk&enabled=eq.true&desk=eq.${desk}`;
    let r = await fetch(`${URL_.replace(/\/$/, '')}/rest/v1/${q}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    // databases without desks yet: every source is a health source
    if (!r.ok && desk === 'health') r = await fetch(`${URL_.replace(/\/$/, '')}/rest/v1/news_sources?select=name,url,format,zone,health_only&enabled=eq.true`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    const sources = r.ok ? await r.json() : [];
    const sourceStatus = r.status;
    const items = await collectDesk(sources, desk);
    res.setHeader('Cache-Control', items.length ? 'public, s-maxage=7200, stale-while-revalidate=86400' : 'public, s-maxage=300');
    res.status(200).json({ desk, updated: new Date().toISOString(), sources: Array.isArray(sources) ? sources.length : 0, sourceStatus, items });
  } catch (e) {
    res.setHeader('Cache-Control', 'public, s-maxage=120');
    res.status(200).json({ desk, items: [], error: String(e?.message ?? e).slice(0, 200) });
  }
}
