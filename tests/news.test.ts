import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS module shared with the Vercel function
import { criticalOf, keywordMatch, parseFeed, zoneOf } from '../api/_news-core.mjs';

const RSS = `<rss><channel>
<item><title>Cholera outbreak in Dodoma</title><link>https://news.example/a</link>
<description>Cases rise</description><pubDate>Fri, 06 Nov 2026 08:00:00 GMT</pubDate>
<media:content url="https://news.example/a.jpg" /></item>
<item><title><![CDATA[Bank of Tanzania keeps rate]]></title><link>https://news.example/b</link><description>BoT decision</description></item>
</channel></rss>`;

describe('news fetcher', () => {
  it('reads RSS items with their photo, link and date', () => {
    const items = parseFeed(RSS);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ title: 'Cholera outbreak in Dodoma', url: 'https://news.example/a', image_url: 'https://news.example/a.jpg' });
    expect(items[1].title).toBe('Bank of Tanzania keeps rate');
  });
  it('decodes &amp; in photo addresses', () => {
    const [it0] = parseFeed('<rss><item><title>x</title><link>https://n.example/c?a=1&amp;b=2</link><media:content url="https://i.example/p.jpg?fit=2000%2C1062&amp;ssl=1" /></item></rss>');
    expect(it0.image_url).toBe('https://i.example/p.jpg?fit=2000%2C1062&ssl=1');
    expect(it0.url).toBe('https://n.example/c?a=1&b=2');
  });
  it('sorts stories into zones, Tanzania first', () => {
    expect(zoneOf('Clinic opens in Mwanza', 'world')).toBe('tanzania');
    expect(zoneOf('Kenya rolls out vaccine', 'world')).toBe('east_africa');
    expect(zoneOf('Nigeria budget', 'world')).toBe('africa');
    expect(zoneOf('Global markets', 'world')).toBe('world');
  });
  it('flags outbreaks as critical', () => {
    expect(criticalOf('Cholera outbreak in Dodoma', 'rss')).toBeTruthy();
    expect(criticalOf('New hospital wing opens', 'rss')).toBeFalsy();
  });
  it('applies a desk keyword filter written for Postgres', () => {
    const banking = 'bank|loan|\\mdse\\M|bot\\M';
    expect(keywordMatch(banking, 'DSE shares rally')).toBe(true);
    expect(keywordMatch(banking, 'BoT holds the rate')).toBe(true);
    expect(keywordMatch(banking, 'Robotics startup raises funds')).toBe(false);
    expect(keywordMatch('', 'anything')).toBe(true);
  });
});
