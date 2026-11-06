// Reads the real shape of uploaded video files (portrait vs landscape) from their metadata, so a vertical
// film is shown and played vertically even when nobody set its orientation in the CMS.
import { useEffect, useState } from 'react';
import { parseVideo, type Orientation } from './video';

const cache = new Map<string, Orientation>();
const pending = new Map<string, Promise<Orientation | null>>();

function measure(src: string): Promise<Orientation | null> {
  if (cache.has(src)) return Promise.resolve(cache.get(src)!);
  if (!pending.has(src)) {
    pending.set(src, new Promise((resolve) => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      const done = (o: Orientation | null) => { v.removeAttribute('src'); v.load(); if (o) cache.set(src, o); resolve(o); };
      v.onloadedmetadata = () => done(v.videoHeight > v.videoWidth ? 'portrait' : 'landscape');
      v.onerror = () => done(null);
      setTimeout(() => done(null), 12000);
      v.src = src;
    }));
  }
  return pending.get(src)!;
}

/** Shapes of uploaded video files, keyed by URL. Links (YouTube, Instagram…) are not measured. */
export function useMeasuredShapes(urls: (string | undefined | null)[]) {
  const files = urls.filter((u): u is string => !!u && parseVideo(u).kind === 'file');
  const key = files.join('|');
  const [shapes, setShapes] = useState<Record<string, Orientation>>(() => Object.fromEntries(files.filter((u) => cache.has(u)).map((u) => [u, cache.get(u)!])));
  useEffect(() => {
    let alive = true;
    for (const u of files) {
      measure(u).then((o) => alive && o && setShapes((s) => (s[u] === o ? s : { ...s, [u]: o })));
    }
    return () => void (alive = false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return shapes;
}
