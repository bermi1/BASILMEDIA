// The six work films (and their posters) ship with the website itself under /media/work/, so Vercel's
// worldwide cache serves them instead of Supabase Storage (whose free monthly bandwidth they used up).
// Rows that still point at the old Supabase copies are read as the website's own copies.
const SHIPPED = /^https:\/\/vodhxhbjncvhogdgkmfy\.supabase\.co\/storage\/v1\/object\/public\/media\/work\/(work-[1-6](?:-poster\.webp|-poster\.jpg|\.mp4))$/;

// Other large uploads that ship as small copies (the original founder photo was a 13 MB, 3840 px JPEG).
const EXACT: Record<string, string> = {
  // the hero reel was replaced (Nov 2026): a new file name, so no browser keeps showing the old one
  '/media/hero/basil-hero-reel.mp4': '/media/hero/basil-reel-2026.mp4',
  'https://vodhxhbjncvhogdgkmfy.supabase.co/storage/v1/object/public/media/site/img-6631-jpg-mw526q2jfsff.jpeg': '/img/team/ceo.webp',
  'https://vodhxhbjncvhogdgkmfy.supabase.co/storage/v1/object/public/media/projects/2t7a4311-mw50hl047cmz.jpg': '/img/work/health-summit-2026.webp',
};

export function localMedia<T>(value: T): T {
  if (typeof value !== 'string') return value;
  if (EXACT[value]) return EXACT[value] as T;
  const m = value.match(SHIPPED);
  return (m ? `/media/work/${m[1].replace(/-poster\.jpg$/, '-poster.webp')}` : value) as T;
}

const FIELDS = ['video_url', 'image_url', 'thumbnail_url', 'cover_url'] as const;
/** Same row, with any shipped film or poster address pointed at the website's own copy. */
export function withLocalMedia<R>(row: R): R {
  if (!row || typeof row !== 'object') return row;
  const r = row as Record<string, unknown>;
  if (!FIELDS.some((f) => typeof r[f] === 'string' && (SHIPPED.test(r[f] as string) || EXACT[r[f] as string]))) return row;
  const out = { ...r };
  for (const f of FIELDS) out[f] = localMedia(out[f]);
  return out as R;
}

/** Site settings with any shipped picture pointed at the website's own copy. */
export function settingsWithLocalMedia<S extends Record<string, unknown>>(s: S): S {
  const out: Record<string, unknown> = { ...s };
  for (const k of ['ceo_photo_url', 'about_image_url', 'hero_image_url', 'hero_video_url', 'logo_url']) out[k] = localMedia(out[k]);
  if (Array.isArray(out.hero_images)) out.hero_images = (out.hero_images as unknown[]).map(localMedia);
  return out as S;
}

/** Films with black cinema bars baked in: how much to enlarge them so the bars fall outside the frame
 *  (the file itself stays exactly as delivered — full quality, nothing re-encoded). */
export const LETTERBOX: Record<string, number> = {
  '/media/hero/basil-reel-2026.mp4': 576 / 484, // 1024x576 with 46 px bars top and bottom
};
