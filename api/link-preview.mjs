// Vercel function: GET /api/link-preview?url=… — the cover picture and title of a Basil Media gallery
// (Pixieset), read from the page's own og: tags. Only basilmedia/basilcreativemedia Pixieset pages are
// allowed; the answer is cached for a day.
const ALLOWED = /^https:\/\/(basilmedia|basilcreativemedia)\.pixieset\.com\/[\w-]+\/?$/i;
const meta = (html, p) => (html.match(new RegExp(`<meta[^>]+property=["']${p}["'][^>]*content=["']([^"']+)`, 'i')) ?? [])[1] ?? '';

export default async function handler(req, res) {
  const url = String(req.query?.url ?? '');
  if (!ALLOWED.test(url)) return res.status(400).json({ error: 'not an allowed gallery link' });
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'BasilMediaSite/1.0 (+https://basilmedia.vercel.app)', Accept: 'text/html' } });
    const html = (await r.text()).slice(0, 200000);
    const image = meta(html, 'og:image');
    res.setHeader('Cache-Control', image ? 'public, s-maxage=86400, stale-while-revalidate=604800' : 'public, s-maxage=600');
    res.status(200).json({ image, title: meta(html, 'og:title') });
  } catch {
    res.status(200).json({ image: '', title: '' });
  }
}
