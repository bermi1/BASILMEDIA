// Live health news from WHO, Africa CDC, ReliefWeb, AllAfrica and more — fetched daily, sorted by zone,
// outbreaks and emergencies flagged as critical. Headlines link to the original source.
import { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, Radio } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Item { id: string; image_url: string; title: string; summary: string; url: string; zone: string; source_name: string; published_at: string; critical: boolean; critical_reason: string }
const ZONES = [
  { key: 'all', label: 'All' },
  { key: 'world', label: 'World' },
  { key: 'africa', label: 'Africa' },
  { key: 'east_africa', label: 'East Africa' },
  { key: 'tanzania', label: 'Tanzania' },
] as const;

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
  useEffect(() => {
    supabase.from('health_feed_items').select('id,image_url,title,summary,url,zone,source_name,published_at,critical,critical_reason').order('published_at', { ascending: false }).limit(120)
      .then(({ data }) => setItems((data ?? []) as Item[]));
  }, []);
  if (items && !items.length) return null;

  const weekAgo = Date.now() - 7 * 864e5;
  const critical = (items ?? []).filter((i) => i.critical && new Date(i.published_at).getTime() > weekAgo).slice(0, 3);
  const list = (items ?? []).filter((i) => zone === 'all' || i.zone === zone);
  const shown = list.slice(0, more ? 24 : 8);
  const updated = items?.length ? ago(items.reduce((a, i) => (i.published_at > a ? i.published_at : a), items[0].published_at)) : '';

  return (
    <section aria-labelledby="live-h" className="mt-8 sm:mt-12">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 id="live-h" className="m-0 flex items-center gap-2 text-2xl font-extrabold"><Radio size={20} className="text-red-600" />Live health news</h2>
        {updated && <span className="text-xs text-basil-muted">Latest {updated} · updated daily</span>}
      </div>

      {critical.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {critical.map((c) => (
            <a key={c.id} href={c.url} target="_blank" rel="noreferrer" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-red-900 no-underline hover:bg-red-100 hover:text-red-900">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <span className="min-w-0">
                <span className="block text-[11px] font-bold uppercase tracking-wide">Critical · {c.critical_reason}</span>
                <b className="line-clamp-2 block text-sm leading-snug">{c.title}</b>
                <span className="text-xs opacity-80">{c.source_name} · {ago(c.published_at)}</span>
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
        <p className="rounded-2xl bg-basil-mist p-4 text-sm text-basil-muted">No news for this zone in the last weeks.</p>
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
                  <span className="text-xs text-basil-muted">{i.source_name} · {ago(i.published_at)}</span>
                </span>
                <ExternalLink size={15} className="mt-1 shrink-0 text-basil-muted" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {list.length > shown.length && <button type="button" onClick={() => setMore(true)} className="btn-outline mt-3 w-full">Show more</button>}
    </section>
  );
}
