// Turns a pasted YouTube (or Vimeo / direct video) link into something playable in-page. Instagram is not used.
export type VideoSource =
  | { kind: 'youtube'; embed: string; id: string }
  | { kind: 'vimeo'; embed: string }
  | { kind: 'instagram'; embed: string }
  | { kind: 'file'; src: string }
  | { kind: 'none' };

export function parseVideo(url?: string | null): VideoSource {
  const u = (url ?? '').trim();
  if (!u) return { kind: 'none' };
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return { kind: 'youtube', id: m[1], embed: `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1&rel=0&modestbranding=1&playsinline=1` };
  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return { kind: 'vimeo', embed: `https://player.vimeo.com/video/${m[1]}?autoplay=1&title=0&byline=0&portrait=0` };
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(u) || u.startsWith('data:video')) return { kind: 'file', src: u };
  return { kind: 'none' };
}

export function videoLabel(url?: string | null) {
  const v = parseVideo(url);
  return v.kind === 'youtube' ? 'YouTube' : v.kind === 'vimeo' ? 'Vimeo' : v.kind === 'instagram' ? 'Instagram' : v.kind === 'file' ? 'Video' : '';
}

export function youtubeThumb(url?: string | null) {
  const v = parseVideo(url);
  return v.kind === 'youtube' ? `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg` : '';
}

export type Orientation = 'portrait' | 'landscape';
/** Portrait for Instagram reels/posts and YouTube Shorts; landscape for normal YouTube, Vimeo and files.
 *  A CMS editor can override it per item (column `orientation`: 'auto' | 'portrait' | 'landscape'). */
export function videoOrientation(url?: string | null, override?: string | null): Orientation {
  if (override === 'portrait' || override === 'landscape') return override;
  const u = (url ?? '').toLowerCase();
  if (u.includes('instagram.com') || u.includes('/shorts/') || u.includes('tiktok.com')) return 'portrait';
  return 'landscape';
}
