// Cover picture for a Basil Media Pixieset gallery: the saved one, or the gallery's own og:image read by
// /api/link-preview (cached by the host for a day, and in memory for this visit).
import { useEffect, useState } from 'react';

const cache = new Map<string, Promise<string>>();
const isGallery = (u?: string) => !!u && /^https:\/\/(basilmedia|basilcreativemedia)\.pixieset\.com\//i.test(u);

export function useCover(link: string | undefined, saved: string): string {
  const [img, setImg] = useState(saved);
  useEffect(() => {
    setImg(saved);
    if (saved || !isGallery(link)) return;
    if (!cache.has(link!)) cache.set(link!, fetch(`/api/link-preview?url=${encodeURIComponent(link!)}`).then((r) => (r.ok ? r.json() : {})).then((d: { image?: string }) => d.image || '').catch(() => ''));
    let alive = true;
    void cache.get(link!)!.then((u) => alive && u && setImg(u));
    return () => void (alive = false);
  }, [link, saved]);
  return img;
}
