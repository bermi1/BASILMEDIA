// The six work films (and their posters) ship with the website itself under /media/work/, so Vercel's
// worldwide cache serves them instead of Supabase Storage (whose free monthly bandwidth they used up).
// Rows that still point at the old Supabase copies are read as the website's own copies.
const SHIPPED = /^https:\/\/vodhxhbjncvhogdgkmfy\.supabase\.co\/storage\/v1\/object\/public\/media\/work\/(work-[1-6](?:-poster\.webp|-poster\.jpg|\.mp4))$/;

export function localMedia<T>(value: T): T {
  if (typeof value !== 'string') return value;
  const m = value.match(SHIPPED);
  return (m ? `/media/work/${m[1].replace(/-poster\.jpg$/, '-poster.webp')}` : value) as T;
}

const FIELDS = ['video_url', 'image_url', 'thumbnail_url', 'cover_url'] as const;
/** Same row, with any shipped film or poster address pointed at the website's own copy. */
export function withLocalMedia<R>(row: R): R {
  if (!row || typeof row !== 'object') return row;
  const r = row as Record<string, unknown>;
  if (!FIELDS.some((f) => typeof r[f] === 'string' && SHIPPED.test(r[f] as string))) return row;
  const out = { ...r };
  for (const f of FIELDS) out[f] = localMedia(out[f]);
  return out as R;
}
