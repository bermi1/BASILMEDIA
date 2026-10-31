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

export function LiveHealthFeed() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [zone, setZone] = useState<(typeof ZONES)[number]['key']>('all');
  const [more, setMore] = useState(false);
  const refreshed = useRef(false);
  const [sources, setSources] = useState<{ name: string; url: string }[]>([]);
  useEffect(() => {
    supabase.from('news_sources').select('name,url').eq('enabled', true).order('name').then(({ data }) => setSources((data ?? []) as { name: string; url: string }[]));
  }, []);
  useEffect(() => {
    // Only fresh news: the last 48 hours (72 hours on a quiet day). Older stories are deleted by the server.
    const load = () => supabase.from('health_feed_items').select('id,image_url,title,summary,url,zone,source_name,published_at,critical,critical_reason,fetched_at')
      .gte('published_at', new Date(Date.now() - 72 * 36e5).toISOString()).order('published_at', { ascending: false }).limit(150)
      .then(({ data }) => {
        const all = (data ?? []) as (Item & { fetched_at: string })[];
        const fresh = all.filter((i) => Date.now() - new Date(i.published_at).getTime() <= 48 * 36e5);
        setItems(fresh.length >= 5 ? fresh : all);
        // Feed older than 2 hours? Ask the server to update it (it refuses if someone already did recently).
        const newest = all.reduce((a, i) => (i.fetched_at > a ? i.fetched_at : a), '');
        if (!refreshed.current && (!newest || Date.now() - new Date(newest).getTime() > 2 * 36e5)) {
          refreshed.current = true;
          fetch('/api/news-ingest').then((r) => (r.ok ? r.json() : null)).then((r) => r?.report && load()).catch(() => {});
        }
      });
    load();
  }, []);
  if (items && !items.length) return null;

  const weekAgo = Date.now() - 72 * 36e5;
  const critical = (items ?? []).filter((i) => i.critical && new Date(i.published_at).getTime() > weekAgo).slice(0, 3);
  const list = (items ?? []).filter((i) => zone === 'all' || i.zone === zone);
  const shown = list.slice(0, more ? 24 : 8);
  const updated = items?.length ? ago(items.reduce((a, i) => (i.published_at > a ? i.published_at : a), items[0].published_at)) : '';

  return (
    <section aria-labelledby="live-h" className="mt-8 sm:mt-12">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 id="live-h" className="m-0 flex items-center gap-2 text-2xl font-extrabold"><Radio size={20} className="text-red-600" />Live health news</h2>
        {updated && <span className="text-xs text-basil-muted">Latest {updated} · last 48 hours · updated through the day</span>}
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
        <ul className="m-0 flex list-none flex-col divide-y divide-basil-line rounded-2xl border border-basil-line bg-white p-0">
          {shown.map((i) => (
            <li key={i.id}>
              <a href={i.url} target="_blank" rel="noreferrer" className="group flex items-start gap-3 p-3.5 text-basil-ink no-underline hover:bg-basil-mist hover:text-basil-ink">
                {i.image_url
                  ? <img src={i.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = 'none')} className="h-[68px] w-[92px] shrink-0 rounded-xl bg-basil-mist object-cover sm:h-20 sm:w-28" />
                  : <span aria-hidden="true" className="flex h-[68px] w-[92px] shrink-0 items-center justify-center rounded-xl bg-basil-ice text-basil sm:h-20 sm:w-28"><Radio size={20} /></span>}
                <span className="min-w-0 flex-1">
                  <b className="line-clamp-2 block text-[15px] leading-snug group-hover:text-basil">{i.critical && <AlertTriangle size={14} className="mr-1 inline align-[-2px] text-red-600" aria-label="Critical" />}{i.title}</b>
                  {i.summary && <span className="mt-0.5 hidden text-[13px] leading-snug text-basil-muted sm:line-clamp-2">{i.summary}</span>}
                  <span className="text-xs text-basil-muted">Source: <b className="font-semibold text-basil-deep">{i.source_name}</b> · {host(i.url)} · {ago(i.published_at)}</span>
                </span>
                <ExternalLink size={15} className="mt-1 shrink-0 text-basil-muted" />
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
