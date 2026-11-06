// Live health news from WHO, Africa CDC, ReliefWeb, AllAfrica and more — fetched daily, sorted by zone,
// outbreaks and emergencies flagged as critical. Headlines link to the original source.
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ExternalLink, Info, Radio } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Item { id: string; image_url: string; title: string; summary: string; url: string; zone: string; source_name: string; published_at: string; critical: boolean; critical_reason: string }
const ZONES = [
  { key: 'all', label: 'All' },
  { key: 'world', label: 'World' },
  { key: 'africa', label: 'Africa' },
  { key: 'east_africa', label: 'East Africa' },
  { key: 'tanzania', label: 'Tanzania' },
] as const;

const host = (u: string) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return ''; } };

function ago(iso: string) {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/** How far back each desk looks (hours): [preferred window, fallback window on a quiet day]. */
const WINDOW: Record<string, [number, number]> = { health: [48, 72], business: [96, 168], innovation: [96, 168], banking: [120, 168], youth: [168, 336] };

export function LiveHealthFeed({ desk = 'health', title = 'Live health news' }: { desk?: string; title?: string }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [zone, setZone] = useState<(typeof ZONES)[number]['key']>('all');
  const [more, setMore] = useState(false);
  const refreshed = useRef(false);
  const [sources, setSources] = useState<{ name: string; url: string }[]>([]);
  useEffect(() => {
    supabase.from('news_sources').select('name,url').eq('enabled', true).eq('desk', desk).order('name').then(({ data, error }) =>
      // Databases without desks yet: every source is a health source.
      error ? (desk === 'health' ? supabase.from('news_sources').select('name,url').eq('enabled', true).order('name').then(({ data: d }) => setSources((d ?? []) as { name: string; url: string }[])) : setSources([])) : setSources((data ?? []) as { name: string; url: string }[]));
  }, [desk]);
  useEffect(() => {
    // Only fresh news: the last 48 hours (72 hours on a quiet day). Older stories are deleted by the server.
    const [win, maxWin] = WINDOW[desk] ?? WINDOW.health;
    const query = (withDesk: boolean) => {
      let q = supabase.from('health_feed_items').select('id,image_url,title,summary,url,zone,source_name,published_at,critical,critical_reason,fetched_at')
        .gte('published_at', new Date(Date.now() - maxWin * 36e5).toISOString()).neq('image_url', '').order('published_at', { ascending: false }).limit(150);
      if (withDesk) q = q.eq('desk', desk);
      return q;
    };
    const load = () => query(true)
      .then(async (res) => (res.error ? (desk === 'health' ? await query(false) : { data: [] }) : res))
      .then(({ data }) => {
        const all = (data ?? []) as (Item & { fetched_at: string })[];
        const fresh = all.filter((i) => Date.now() - new Date(i.published_at).getTime() <= win * 36e5);
        setItems(fresh.length >= 5 ? fresh : all);
        // Feed older than 2 hours? Ask the server to update it (it refuses if someone already did recently).
        const newest = all.reduce((a, i) => (i.fetched_at > a ? i.fetched_at : a), '');
        if (!refreshed.current && (!newest || Date.now() - new Date(newest).getTime() > 2 * 36e5)) {
          refreshed.current = true;
          fetch('/api/news-ingest').then((r) => (r.ok ? r.json() : null)).then((r) => r?.report && load()).catch(() => {});
        }
      });
    setItems(null);
    load();
  }, [desk]);
  if (items && !items.length) {
    return <p className="mt-8 rounded-2xl border border-dashed border-basil-edge bg-basil-mist p-6 text-center text-sm text-basil-muted">Stories for this desk appear here as soon as the next update runs (several times a day).</p>;
  }

  const weekAgo = Date.now() - 72 * 36e5;
  const critical = desk === 'health' ? (items ?? []).filter((i) => i.critical && new Date(i.published_at).getTime() > weekAgo).slice(0, 3) : [];
  const list = (items ?? []).filter((i) => zone === 'all' || i.zone === zone);
  const shown = list.slice(0, more ? 30 : 9);
  const updated = items?.length ? ago(items.reduce((a, i) => (i.published_at > a ? i.published_at : a), items[0].published_at)) : '';

  return (
    <section aria-labelledby="live-h" className="mt-8 sm:mt-12">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 id="live-h" className="m-0 flex items-center gap-2 text-2xl font-extrabold"><Radio size={20} className="text-red-600" />{title}</h2>
        {updated && <span className="text-xs text-basil-muted">Latest {updated} · updated through the day</span>}
      </div>

      {critical.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {critical.map((c) => (
            <a key={c.id} href={c.url} target="_blank" rel="noreferrer" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-red-900 no-underline hover:bg-red-100 hover:text-red-900">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <span className="min-w-0">
                <span className="block text-[11px] font-bold uppercase tracking-wide">Critical · {c.critical_reason}</span>
                <b className="line-clamp-2 block text-sm leading-snug">{c.title}</b>
                <span className="text-xs opacity-80">Source: <b>{c.source_name}</b> · {host(c.url)} · {ago(c.published_at)}</span>
              </span>
            </a>
          ))}
        </div>
      )}

      <div role="tablist" aria-label="Zone" className="scrollbar-none -mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {ZONES.map((z) => (
          <button key={z.key} role="tab" type="button" aria-selected={zone === z.key} onClick={() => (setZone(z.key), setMore(false))}
            className={`min-h-[40px] shrink-0 rounded-full px-3.5 text-sm font-semibold ${zone === z.key ? 'border-0 bg-basil text-white' : 'border border-basil-edge bg-white text-basil-deep'}`}>
            {z.label}
          </button>
        ))}
      </div>

      {!items ? (
        <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-basil-mist" />)}</div>
      ) : !list.length ? (
        <p className="rounded-2xl bg-basil-mist p-4 text-sm text-basil-muted">No news for this region in the last 48 hours.</p>
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {shown.map((i) => (
            <li key={i.id} className="min-w-0">
              <a href={i.url} target="_blank" rel="noreferrer" className="group flex h-full flex-col overflow-hidden rounded-2xl border border-basil-line bg-white text-basil-ink no-underline transition hover:-translate-y-0.5 hover:shadow-card hover:text-basil-ink">
                <span className="relative block aspect-[16/9] bg-basil-ice">
                  {i.image_url
                    ? <img src={i.image_url.replace(/&amp;|&#0?38;/g, '&')} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = 'none')} className="absolute inset-0 h-full w-full object-cover object-top" />
                    : <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-basil"><Radio size={26} /></span>}
                  {i.critical && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white"><AlertTriangle size={11} />Critical</span>}
                </span>
                <span className="flex flex-1 flex-col gap-1.5 p-3.5">
                  <span className="text-[10.5px] font-bold uppercase tracking-wide text-basil">{i.source_name}</span>
                  <b className="line-clamp-3 text-[14.5px] leading-snug group-hover:text-basil">{i.title}</b>
                  {i.summary && <span className="line-clamp-2 text-[12.5px] leading-snug text-basil-muted">{i.summary}</span>}
                  <span className="mt-auto flex items-center justify-between gap-2 pt-1 text-[11.5px] text-basil-muted">
                    <span className="truncate">Source: {host(i.url)} · {ago(i.published_at)}</span><ExternalLink size={13} className="shrink-0" />
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {list.length > shown.length && <button type="button" onClick={() => setMore(true)} className="btn-outline mt-3 w-full">Show more</button>}

      {/* How this works — sources, rights and the automatic "critical" label, stated plainly */}
      <details className="group mt-4 rounded-2xl border border-basil-line bg-basil-mist/60 p-4 text-[13.5px] leading-relaxed text-[#33465F]">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-bold text-basil-deep"><Info size={16} />How this news feed works and where it comes from</summary>
        <div className="mt-3 flex flex-col gap-2">
          <p className="m-0">Basil Media does not write these stories. Several times a day our system collects headlines from the public news feeds of the organisations listed below and sorts them by region (World, Africa, East Africa, Tanzania) from the places each story mentions.</p>
          <p className="m-0">Only news from the last 48 hours is shown, and stories are deleted after 72 hours. We show only the headline, a short summary and picture published by the source itself, the source's name and a link to the full article. All rights remain with the original publisher — please read and cite the original.</p>
          <p className="m-0">The <b>Critical</b> label is added automatically when a story mentions an outbreak, a public-health emergency or a medicine-safety alert. It can be wrong, and nothing here is medical advice — follow the Ministry of Health and your clinician.</p>
          <p className="m-0">See an error, or are you a publisher who wants your content removed? Email <a href="mailto:hello@basilmedia.co.tz">hello@basilmedia.co.tz</a> and we will act within one working day.</p>
          {sources.length > 0 && (
            <p className="m-0"><b>Sources:</b> {sources.map((x, k) => <span key={x.url}>{k > 0 && ' · '}<a href={'https://' + host(x.url)} target="_blank" rel="noreferrer">{x.name}</a></span>)}</p>
          )}
        </div>
      </details>
    </section>
  );
}
