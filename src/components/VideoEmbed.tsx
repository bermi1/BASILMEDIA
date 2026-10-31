import { useState } from 'react';
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
  if (v.kind === 'instagram') {
    // Instagram's embed adds a ~54px header and a ~200px caption/footer; we oversize the iframe and clip it.
    return (
      <div className={box} style={{ aspectRatio: aspect }}>
        <iframe
          title={title}
          src={v.embed}
          className="absolute left-0 w-full border-0"
          style={{ top: -56, height: 'calc(100% + 260px)' }}
          scrolling="no"
          allow="autoplay; encrypted-media; picture-in-picture"
          loading="lazy"
        />
      </div>
    );
  }
  return (
    <div className={box} style={{ aspectRatio: aspect }}>
      <iframe title={title} src={v.embed} className="absolute inset-0 h-full w-full border-0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />
    </div>
  );
}
