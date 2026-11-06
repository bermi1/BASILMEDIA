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
