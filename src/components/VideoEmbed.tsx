import { useEffect, useRef, useState } from 'react';
import { parseVideo } from '@/lib/video';
import { Play } from './icons';

/**
 * Plays YouTube, Vimeo, Instagram or direct video links inside the page.
 * Instagram embeds are cropped (profile bar on top, caption/likes/comments below) so only the video shows.
 */
export function VideoEmbed({
  url, title, poster, autoPlay = false, aspect = '16 / 9', className = '',
}: { url?: string; title: string; poster?: string; autoPlay?: boolean; aspect?: string; className?: string }) {
  const [on, setOn] = useState(autoPlay);
  const v = parseVideo(url);
  const box = `relative w-full overflow-hidden bg-basil-night ${className}`;

  if (v.kind === 'none') {
    return (
      <div className={`${box} flex items-center justify-center`} style={{ aspectRatio: aspect, background: 'linear-gradient(160deg, #2B86DA, #0A2F5C)' }}>
        <span className="px-4 text-center font-mono text-[11px] tracking-[0.14em] text-basil-frost">ADD A YOUTUBE, VIMEO OR INSTAGRAM LINK</span>
      </div>
    );
  }
  if (!on) {
    return (
      <button type="button" onClick={() => setOn(true)} aria-label={`Play ${title}`} className={`${box} group flex cursor-pointer items-center justify-center border-0 p-0`} style={{ aspectRatio: aspect, background: 'linear-gradient(160deg, #2B86DA, #0A2F5C)' }}>
        {poster && <img src={poster} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-90 transition group-hover:scale-105" />}
        <span className="relative flex h-[74px] w-[74px] items-center justify-center rounded-full bg-white/95 shadow-glow transition group-hover:scale-110"><Play /></span>
      </button>
    );
  }
  if (v.kind === 'file') {
    return <video className={box} style={{ aspectRatio: aspect }} src={v.src} poster={poster} controls autoPlay playsInline preload="none" />;
  }
  if (v.kind === 'instagram') return <InstagramEmbed src={v.embed} title={title} className={className} />;
  return (
    <div className={box} style={{ aspectRatio: aspect }}>
      <iframe title={title} src={v.embed} className="absolute inset-0 h-full w-full border-0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />
    </div>
  );
}

/**
 * Instagram's official embed card at its natural size (header, the reel's own cover, play, likes).
 * Instagram reports the card height by postMessage ("MEASURE"); we size the frame to it, so nothing is cut.
 * Reels play in place where Instagram allows it, otherwise its button opens the reel on Instagram.
 */
export function InstagramEmbed({ src, title, className = '' }: { src: string; title: string; aspect?: string; className?: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(0);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (!String(e.origin).includes('instagram.com') || e.source !== ref.current?.contentWindow) return;
      try {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (d?.type === 'MEASURE' && d.details?.height > 100) setH(d.details.height);
      } catch { /* not ours */ }
    };
    addEventListener('message', on);
    return () => removeEventListener('message', on);
  }, []);
  return (
    <div className={`relative w-full overflow-hidden rounded-2xl border border-[#dbdbdb] bg-white ${className}`} style={{ height: h || 520 }}>
      <iframe ref={ref} title={title} src={src} className="h-full w-full border-0" scrolling="no" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" loading="lazy" />
      {!h && <span className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 animate-spin rounded-full border-2 border-basil-line border-t-basil" aria-hidden="true" />}
    </div>
  );
}
