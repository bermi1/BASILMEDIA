// Basil Health live feed: fetch every enabled source, keep health stories, sort them by zone
// (Tanzania → East Africa → Africa → World) and flag outbreaks/emergencies as critical.
// Used by api/news-ingest.mjs (daily on the host) and scripts/news-ingest.mjs (by hand).
// Talks to Supabase over REST with the SERVICE key (server side only — never in the browser).

const HEALTH = /\b(health|hospital|clinic|disease|outbreak|epidemic|virus|vaccin|immuni|malaria|cholera|ebola|marburg|mpox|measles|dengue|polio|tuberculosis|\btb\b|hiv|aids|cancer|diabetes|maternal|newborn|nutrition|malnutrition|doctor|nurse|medic|patient|pharma|drug|medicine|surgery|mental|afya|hospitali|ugonjwa|chanjo|wagonjwa|kipindupindu)/i;

// Critical = an outbreak or emergency. The reason shown to readers is the first rule that matches.
const CRITICAL = [
  [/\b(ebola|marburg)\b/i, 'Ebola/Marburg'],
  [/\bcholera|kipindupindu\b/i, 'Cholera'],
  [/\bmpox|monkeypox\b/i, 'Mpox'],
  [/\b(anthrax|plague|rift valley fever|yellow fever|lassa)\b/i, 'Dangerous outbreak'],
  [/\b(polio|measles|dengue|meningitis)\b.*\b(outbreak|cases|deaths|surge|spread)/i, 'Outbreak'],
  [/\bpublic health emergency|PHEIC\b/i, 'Public health emergency'],
  [/\b(outbreak|epidemic)\b/i, 'Outbreak'],
  [/\b(recall|falsified|substandard)\b.*\b(medicine|drug|vaccine|product)/i, 'Medicine safety alert'],
];

const TZ = /\b(tanzania|dar es salaam|dodoma|zanzibar|arusha|mwanza|mbeya|tanga|morogoro|kilimanjaro|moshi)\b/i;
const EAST = /\b(kenya|uganda|rwanda|burundi|south sudan|ethiopia|somalia|drc|congo|mozambique|malawi|zambia|east africa)\b/i;
const AFRICA = /\b(africa|african|nigeria|ghana|sudan|angola|cameroon|senegal|mali|niger|chad|guinea|sierra leone|liberia|zimbabwe|madagascar|egypt|morocco|south africa|botswana|namibia|côte d'ivoire|ivory coast)\b/i;

/** A source's keyword filter is written once as a Postgres regex (also used in SQL), where \m and \M mark word
 *  edges; JavaScript spells both \b. An empty filter keeps every story. */
export function keywordMatch(keywords, text) {
  return !keywords || new RegExp(keywords.replace(/\\[mM]/g, '\\b'), 'i').test(text);
}

export function zoneOf(text, fallback) {
  if (TZ.test(text)) return 'tanzania';
  if (EAST.test(text)) return fallback === 'tanzania' ? 'tanzania' : 'east_africa';
  if (AFRICA.test(text)) return fallback === 'tanzania' || fallback === 'east_africa' ? fallback : 'africa';
  return fallback;
}
export function criticalOf(text, sourceFormat) {
  for (const [re, why] of CRITICAL) if (re.test(text)) return why;
  return sourceFormat === 'who_don' ? 'WHO disease outbreak notice' : '';
}

const decode = (s) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&#8217;/g, "'")
    .replace(/&#8211;|&#8212;/g, '–').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    // feeds that double-encode their HTML: remove the tags that appear after decoding too
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]) : '';
};
const linkOf = (block) => {
  const atom = block.match(/<link[^>]*href="([^"]+)"/i);
  return (tag(block, 'link') || atom?.[1] || tag(block, 'guid')).trim();
};

/** RSS 2.0, RDF/RSS 1.0 and Atom. */
export function parseFeed(xml) {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
  return blocks.map((b) => ({
    image_url: (b.match(/<media:(?:content|thumbnail)[^>]*url="([^"]+)"/i) ?? b.match(/<enclosure[^>]*url="([^"]+\.(?:jpe?g|png|webp)[^"]*)"/i) ?? b.match(/<img[^>]*src="(https?:[^"]+)"/i) ?? [])[1] ?? '',
    title: tag(b, 'title'),
    url: linkOf(b),
    summary: (tag(b, 'description') || tag(b, 'summary') || tag(b, 'content')).slice(0, 400),
    published_at: tag(b, 'pubDate') || tag(b, 'dc:date') || tag(b, 'published') || tag(b, 'updated'),
  }));
}
/** The article's own preview picture and description (og:/twitter: meta tags). */
const meta = (html, prop) =>
  (html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i')) ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, 'i')) ?? [])[1] ?? '';
export async function articleMeta(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': 'BasilMediaHealthNews/1.0 (+https://basilmedia.co.tz)', Accept: 'text/html' } });
    clearTimeout(t);
    if (!r.ok) return {};
    const html = (await r.text()).slice(0, 200000);
    let image = decode(meta(html, 'og:image') || meta(html, 'twitter:image') || meta(html, 'og:image:url'));
    if (image && image.startsWith('/')) image = new URL(image, url).toString();
    return { image: /^https?:\/\//.test(image) ? image : '', description: decode(meta(html, 'og:description') || meta(html, 'description')).slice(0, 400) };
  } catch {
    return {};
  }
}
async function inBatches(items, size, fn) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

/** WHO Disease Outbreak News JSON API. */
export function parseWhoDon(json) {
  return (json.value ?? []).map((v) => ({
    title: v.Title ?? '',
    url: v.ItemDefaultUrl ? `https://www.who.int/emergencies/disease-outbreak-news/item${v.ItemDefaultUrl}` : '',
    summary: decode(v.Summary ?? v.Overview ?? '').slice(0, 400),
    published_at: v.PublicationDateAndTime ?? v.PublicationDate ?? '',
  }));
}

async function sb(base, key, path, init = {}) {
  const r = await fetch(`${base.replace(/\/$/, '')}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`${path.split('?')[0]}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json().catch(() => null);
}

/** Fetch all enabled sources and upsert their items. Returns a per-source report. */
/** How long stories are kept, per desk. Health is the most time-sensitive. */
export const MAX_AGE_HOURS = 72;
export const DESK_MAX_AGE_HOURS = { health: 72, business: 168, innovation: 168, banking: 168, youth: 336 };
export async function ingest({ url: base, serviceKey: key, maxAgeHours = MAX_AGE_HOURS }) {
  if (!base || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  const sources = await sb(base, key, 'news_sources?enabled=eq.true&select=*');
  const cutoff = Date.now() - maxAgeHours * 36e5;
  const cutoffFor = (desk) => Date.now() - (DESK_MAX_AGE_HOURS[desk] ?? maxAgeHours) * 36e5;
  const report = [];
  for (const s of sources) {
    let kept = 0, error = '';
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(s.url, { signal: ctrl.signal, headers: { 'User-Agent': 'BasilMediaHealthNews/1.0 (+https://basilmedia.co.tz)', Accept: '*/*' } });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = s.format === 'who_don' ? parseWhoDon(await res.json()) : parseFeed(await res.text());
      const rows = [];
      for (const it of raw) {
        if (!it.title || !/^https?:\/\//.test(it.url)) continue;
        const text = `${it.title} ${it.summary}`;
        if (s.health_only && !HEALTH.test(text)) continue;
        if (!keywordMatch(s.keywords, text)) continue;
        const when = new Date(it.published_at || Date.now());
        const at = isNaN(when.getTime()) ? new Date() : when;
        if (at.getTime() < cutoffFor(s.desk ?? 'health')) continue;
        const why = (s.desk ?? 'health') === 'health' ? criticalOf(text, s.format) : '';
        rows.push({ source_id: s.id, source_name: s.name, title: it.title.slice(0, 300), summary: it.summary, url: it.url, image_url: it.image_url ?? '', zone: zoneOf(text, s.zone), published_at: at.toISOString(), critical: !!why, critical_reason: why, fetched_at: new Date().toISOString(), ...(s.desk ? { desk: s.desk } : {}) });
      }
      const unique = [...new Map(rows.map((r) => [r.url, r])).values()];
      // Picture + description from the article itself, only for stories we do not have a picture for yet.
      const known = new Map(((await sb(base, key, `health_feed_items?source_id=eq.${s.id}&select=url,image_url,summary`)) ?? []).map((k) => [k.url, k]));
      const need = unique.filter((r) => !r.image_url && !known.get(r.url)?.image_url).slice(0, 40);
      await inBatches(need, 6, async (r) => {
        const m = await articleMeta(r.url);
        if (m.image) r.image_url = m.image;
        if (m.description && m.description.length > r.summary.length) r.summary = m.description;
      });
      for (const r of unique) if (!r.image_url && known.get(r.url)?.image_url) r.image_url = known.get(r.url).image_url;
      // Only stories with a real photo: drop those without one, and a source's generic placeholder
      // (the same picture used for several different stories).
      const seen = new Map();
      for (const r of unique) if (r.image_url) seen.set(r.image_url, (seen.get(r.image_url) ?? 0) + 1);
      const withPhoto = unique.filter((r) => r.image_url && (seen.get(r.image_url) ?? 0) < 3);
      unique.length = 0;
      unique.push(...withPhoto);
      if (unique.length) await sb(base, key, 'health_feed_items?on_conflict=url', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(unique) });
      kept = unique.length;
    } catch (e) {
      error = String(e?.message ?? e).slice(0, 300);
    }
    await sb(base, key, `news_sources?id=eq.${s.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ last_fetched_at: new Date().toISOString(), last_error: error }) }).catch(() => {});
    report.push({ source: s.name, kept, error });
  }
  // Delete old stories so stale news never stays on the site: per desk when desks exist, else 72 hours for all.
  const hasDesks = sources.some((s) => 'desk' in s);
  if (hasDesks) {
    for (const [desk, hours] of Object.entries(DESK_MAX_AGE_HOURS)) {
      const before = new Date(Date.now() - hours * 36e5).toISOString();
      await sb(base, key, `health_feed_items?desk=eq.${desk}&published_at=lt.${before}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => {});
    }
  } else {
    await sb(base, key, `health_feed_items?published_at=lt.${new Date(cutoff).toISOString()}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => {});
  }
  return report;
}
