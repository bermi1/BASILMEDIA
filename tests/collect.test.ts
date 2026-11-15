import { afterEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error plain JS module shared with the Vercel functions
import { collectDesk } from '../api/_news-core.mjs';

const now = new Date().toUTCString();
const old = new Date(Date.now() - 30 * 864e5).toUTCString();
const FEED = `<rss><channel>
<item><title>Bank of Tanzania keeps rate for youth loans</title><link>https://n.example/1</link><pubDate>${now}</pubDate><media:content url="https://i.example/1.jpg" /></item>
<item><title>Bank story without a photo</title><link>https://n.example/2</link><pubDate>${now}</pubDate></item>
<item><title>Old bank story</title><link>https://n.example/3</link><pubDate>${old}</pubDate><media:content url="https://i.example/3.jpg" /></item>
<item><title>Football results</title><link>https://n.example/4</link><pubDate>${now}</pubDate><media:content url="https://i.example/4.jpg" /></item>
</channel></rss>`;

afterEach(() => vi.unstubAllGlobals());

describe('collectDesk (live news, nothing stored)', () => {
  it('keeps recent, on-topic stories with a photo, finding a missing photo on the article page', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === 'https://feed.example/rss') return new Response(FEED);
      if (url === 'https://n.example/2') return new Response('<meta property="og:image" content="https://i.example/2.jpg">');
      return new Response('', { status: 404 });
    }));
    const items = await collectDesk([{ name: 'Feed', url: 'https://feed.example/rss', format: 'rss', zone: 'tanzania', health_only: false, keywords: 'bank' }], 'banking');
    expect(items.map((i: { title: string }) => i.title)).toEqual(expect.arrayContaining(['Bank of Tanzania keeps rate for youth loans', 'Bank story without a photo']));
    expect(items).toHaveLength(2);
    expect(items.find((i: { url: string }) => i.url === 'https://n.example/2').image_url).toBe('https://i.example/2.jpg');
  });
  it('survives a source that fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await collectDesk([{ name: 'X', url: 'https://x.example', format: 'rss', zone: 'world', health_only: false, keywords: '' }], 'youth')).toEqual([]);
  });
});
