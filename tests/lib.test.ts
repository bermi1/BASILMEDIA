import { describe, expect, it } from 'vitest';
import { parseVideo, videoOrientation, youtubeThumb } from '../src/lib/video';
import { isEmail, isProfileUrl, normaliseTzPhone, waLink } from '../src/lib/format';

describe('video links', () => {
  it('recognises YouTube, Shorts, Vimeo and uploaded files', () => {
    expect(parseVideo('https://youtu.be/dQw4w9WgXcQ').kind).toBe('youtube');
    expect(parseVideo('https://www.youtube.com/shorts/dQw4w9WgXcQ').kind).toBe('youtube');
    expect(parseVideo('https://vimeo.com/123456').kind).toBe('vimeo');
    expect(parseVideo('https://x.supabase.co/storage/v1/object/public/media/work/work-1.mp4').kind).toBe('file');
    expect(parseVideo('').kind).toBe('none');
    expect(parseVideo('https://example.com/page').kind).toBe('none');
  });
  it('gives a YouTube poster only for YouTube', () => {
    expect(youtubeThumb('https://youtu.be/dQw4w9WgXcQ')).toContain('dQw4w9WgXcQ');
    expect(youtubeThumb('https://vimeo.com/1')).toBe('');
  });
  it('treats reels and Shorts as portrait unless the CMS overrides it', () => {
    expect(videoOrientation('https://www.instagram.com/reel/abc/')).toBe('portrait');
    expect(videoOrientation('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('portrait');
    expect(videoOrientation('https://youtu.be/dQw4w9WgXcQ')).toBe('landscape');
    expect(videoOrientation('https://youtu.be/dQw4w9WgXcQ', 'portrait')).toBe('portrait');
  });
});

describe('contact helpers', () => {
  it('normalises Tanzanian phone numbers', () => {
    expect(normaliseTzPhone('0712 345 678')).toBe('+255712345678');
    expect(normaliseTzPhone('255612345678')).toBe('+255612345678');
    expect(normaliseTzPhone('+255 712 345 678')).toBe('+255712345678');
    expect(normaliseTzPhone('0512345678')).toBeNull();
    expect(normaliseTzPhone('12345')).toBeNull();
  });
  it('checks emails and WhatsApp links', () => {
    expect(isEmail('info@basilmedia.co.tz')).toBe(true);
    expect(isEmail('not an email')).toBe(false);
    expect(waLink('+255 712 345 678', 'Hi')).toBe('https://wa.me/255712345678?text=Hi');
  });
  it('accepts only real social profile links', () => {
    expect(isProfileUrl('https://www.instagram.com/basilmedia_tz/')).toBe(true);
    expect(isProfileUrl('https://www.instagram.com/')).toBe(false);
    expect(isProfileUrl('')).toBe(false);
    expect(isProfileUrl('nonsense')).toBe(false);
  });
});

import { localMedia, withLocalMedia } from '../src/lib/media';
describe('work films served by the website', () => {
  const base = 'https://vodhxhbjncvhogdgkmfy.supabase.co/storage/v1/object/public/media/work/';
  it('points the shipped films and posters at /media/work/', () => {
    expect(localMedia(`${base}work-3.mp4`)).toBe('/media/work/work-3.mp4');
    expect(localMedia(`${base}work-3-poster.jpg`)).toBe('/media/work/work-3-poster.webp');
    expect(withLocalMedia({ title: 'x', video_url: `${base}work-1.mp4`, image_url: `${base}work-1-poster.webp` })).toEqual({ title: 'x', video_url: '/media/work/work-1.mp4', image_url: '/media/work/work-1-poster.webp' });
  });
  it('swaps the 13 MB founder photo for the small copy', () => {
    expect(localMedia('https://vodhxhbjncvhogdgkmfy.supabase.co/storage/v1/object/public/media/site/img-6631-jpg-mw526q2jfsff.jpeg')).toBe('/img/team/ceo.webp');
  });
  it('plays the new hero reel', () => {
    expect(localMedia('/media/hero/basil-hero-reel.mp4')).toBe('/media/hero/basil-reel-2026.mp4');
  });
  it('leaves everything else alone', () => {
    expect(localMedia(`${base}work-7.mp4`)).toBe(`${base}work-7.mp4`);
    expect(localMedia('https://www.youtube.com/watch?v=x')).toBe('https://www.youtube.com/watch?v=x');
  });
});
