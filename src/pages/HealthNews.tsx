import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase } from 'lucide-react';
import { Check } from 'lucide-react';
import { useRows } from '@/hooks/useData';
import { supabase } from '@/lib/supabase';
import { LiveHealthFeed } from '@/components/LiveHealthFeed';
import { UpcomingHealthEvents } from '@/components/UpcomingHealthEvents';
import { useSeo } from '@/hooks/useSeo';
import { fmtDate } from '@/lib/format';
import { Media } from '@/components/Media';
import { Reveal } from '@/components/Reveal';
import { SubscribeForm } from '@/components/SubscribeForm';

export default function HealthNews() {
  useSeo('Basil Health Brief — Health News', 'Policy, research, CPD and opportunities across Tanzania’s health sector, curated weekly by Basil Media.');
  const { rows: stories } = useRows('news_stories', { publishedOnly: true });
  const { rows: opps } = useRows('opportunities', { publishedOnly: true });
  const [tag, setTag] = useState('All');
  const [oppKind, setOppKind] = useState('All');
  const tags = useMemo(() => ['All', ...Array.from(new Set(stories.map((s) => s.tag)))], [stories]);
  const filtered = stories.filter((s) => tag === 'All' || s.tag === tag);
  const featured = filtered.find((s) => s.featured) ?? filtered[0];
  const rest = filtered.filter((s) => s !== featured);
  const oppList = opps.filter((o) => oppKind === 'All' || o.kind === oppKind);

  return (
    <>
      <section className="relative overflow-hidden text-white" style={{ background: 'radial-gradient(ellipse at 85% 10%, rgba(124,192,245,0.3), transparent 50%), linear-gradient(160deg, #0A2F5C, #061E3D)' }}>
        <div className="container-bm relative flex flex-wrap items-end gap-5 pb-6 pt-24 sm:gap-8 sm:pb-10 sm:pt-32">
          <div className="min-w-0 flex-[1_1_520px]">
            <div className="font-mono text-xs tracking-[0.2em] text-basil-haze">HEALTH NEWS · LIVE FROM VERIFIED SOURCES</div>
            <h1 className="my-2 text-[clamp(26px,4.5vw,56px)] font-bold leading-[1.05] tracking-[-0.02em] sm:my-3">Basil Health <span className="text-basil-sky">Brief</span></h1>
            <p className="m-0 max-w-[620px] text-[15px] text-basil-frost sm:text-lg">Health news from Tanzania, Africa and the world, collected automatically several times a day from trusted newsrooms and health agencies. Only the last 48 hours, only stories with their own photo, always with the source and a link to the original.</p>
          </div>
          <NewsStats />
        </div>
        <div className={`container-bm relative pb-6 ${stories.length ? '' : 'hidden'}`}>
          <div role="group" aria-label="Filter by topic" className="scrollbar-none flex gap-2 overflow-x-auto">
            {tags.map((t) => (
              <button key={t} type="button" aria-pressed={tag === t} onClick={() => setTag(t)} className={`min-h-[44px] shrink-0 rounded-full px-4 text-sm font-semibold ${tag === t ? 'border-0 bg-white text-basil' : 'border border-white/35 bg-transparent text-white hover:bg-white/10'}`}>
                {t} <span className="opacity-60">{t === 'All' ? stories.length : stories.filter((s) => s.tag === t).length}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="container-bm py-8 sm:py-12">
        <div className="min-w-0">
          <LiveHealthFeed />
          <div className="mt-10 sm:mt-14"><UpcomingHealthEvents /></div>
          {stories.length > 0 && <h2 className="m-0 mb-4 mt-10 text-2xl font-extrabold sm:mt-14">From Basil Media</h2>}
          {featured && (
            <Reveal>
              <Link to={`/health-news/${featured.id}`} className="group mb-7 grid overflow-hidden rounded-[22px] sm:mb-10 sm:rounded-[28px] border border-basil-line bg-white text-basil-ink no-underline transition hover:shadow-card hover:text-basil-ink md:grid-cols-2">
                <Media src={featured.image_url} index={0} overlay={false} className="min-h-[170px] sm:min-h-[240px]" />
                <div className="flex flex-col gap-2.5 p-4 sm:gap-3 sm:p-8">
                  <div className="flex gap-2 text-xs font-bold"><span className="rounded-full bg-basil px-2.5 py-1 text-white">Featured</span><span className="rounded-full bg-basil-ice px-2.5 py-1 text-basil-deep">{featured.tag}</span></div>
                  <h2 className="m-0 text-[20px] font-extrabold leading-tight group-hover:text-basil sm:text-[28px]">{featured.title}</h2>
                  <p className="m-0 text-basil-muted">{featured.dek}</p>
                  <div className="mt-auto flex justify-between text-sm text-basil-muted"><span>{fmtDate(featured.published_at)} · {featured.read_minutes} min read</span><span className="font-bold text-basil">Read the brief ›</span></div>
                </div>
              </Link>
            </Reveal>
          )}
          <div className={`mb-4 flex items-baseline justify-between ${stories.length ? "" : "hidden"}`}><h3 className="m-0 text-xl font-extrabold">{tag === 'All' ? 'Latest stories' : tag}</h3><span className="font-mono text-xs text-basil-muted">{rest.length} STORIES</span></div>
          <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-4">
            {rest.map((s, i) => (
              <Reveal key={s.id} delay={i * 0.04}>
                <Link to={`/health-news/${s.id}`} className="group flex h-full overflow-hidden rounded-[18px] border border-basil-line bg-white text-basil-ink no-underline transition hover:-translate-y-1 hover:shadow-card hover:text-basil-ink sm:flex-col sm:rounded-3xl">
                  <Media src={s.image_url} index={i + 1} overlay={false} className="w-[104px] shrink-0 sm:h-40 sm:w-auto" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1 p-3 sm:gap-2 sm:p-5">
                    <span className="text-xs font-bold text-basil">{s.tag}</span>
                    <h3 className="m-0 line-clamp-3 text-[15px] font-extrabold leading-snug group-hover:text-basil sm:text-lg">{s.title}</h3>
                    <div className="mt-auto flex justify-between text-[12px] text-basil-muted sm:text-[13px]"><span>{fmtDate(s.published_at)}</span><span>{s.read_minutes} min</span></div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          {stories.length > 0 && !rest.length && !featured && <p className="text-basil-muted">No stories in this topic yet.</p>}


          {opps.length > 0 && (
          <section aria-labelledby="opp-h" className="mt-8 rounded-[22px] bg-basil-mist p-4 sm:mt-12 sm:rounded-[28px] sm:p-8">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div><div className="kicker">OPPORTUNITIES BOARD</div><h2 id="opp-h" className="m-0 mt-1 text-2xl font-extrabold">Jobs, fellowships &amp; calls for abstracts</h2></div>
              <div role="group" aria-label="Opportunity type" className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 sm:flex-wrap">
                {['All', 'Job', 'Fellowship', 'Scholarship', 'Call for abstracts'].map((k) => (
                  <button key={k} type="button" aria-pressed={oppKind === k} onClick={() => setOppKind(k)} className={`min-h-[40px] shrink-0 rounded-full px-3.5 text-sm font-semibold ${oppKind === k ? 'border-0 bg-basil text-white' : 'border border-basil-edge bg-white text-basil-deep'}`}>{k}</button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              {oppList.map((o) => (
                <div key={o.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-basil-line bg-white p-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-basil-ice text-basil"><Briefcase size={20} /></span>
                  <div className="min-w-0 flex-[1_1_220px]"><div className="font-bold">{o.title}</div><div className="text-sm text-basil-muted">{o.org} · {o.location}</div></div>
                  <span className="rounded-full bg-basil-ice px-3 py-1 text-xs font-bold text-basil-deep">{o.kind}</span>
                  <span className="text-sm text-basil-muted">Closes {fmtDate(o.closes_on)}</span>
                  {o.link && <a href={o.link} target="_blank" rel="noreferrer" className="btn-outline h-10 min-h-0 px-4 text-sm">Apply</a>}
                </div>
              ))}
              {!oppList.length && <p className="m-0 text-basil-muted">Nothing open right now in this category.</p>}
            </div>
          </section>
          )}
        </div>

      </div>

      <SubscribeSection />
    </>
  );
}

export function SubscribeSection({ source = 'health-news', standalone }: { source?: string; standalone?: boolean }) {
  return (
    <section id="subscribe" className="scroll-mt-24 text-white" style={{ background: 'radial-gradient(ellipse at 10% 10%, rgba(124,192,245,0.3), transparent 50%), linear-gradient(160deg, #0F6EC2, #0A2F5C 60%, #061E3D)' }}>
      <div className={`container-bm grid items-center gap-6 pb-10 sm:gap-10 sm:pb-16 lg:grid-cols-[1fr_1.2fr] ${standalone ? 'pt-24 sm:pt-32' : 'pt-10 sm:pt-16'}`}>
        <div>
          <div className="font-mono text-xs tracking-[0.2em] text-basil-haze">SUBSCRIBE · JIUNGE</div>
          <h2 className="my-2 text-[clamp(22px,3.4vw,42px)] font-bold leading-[1.1] sm:my-3">Health news and events,<br /><span className="text-basil-sky">on your phone.</span></h2>
          <p className="m-0 max-w-[460px] text-[15px] text-basil-frost sm:text-lg">The week's health news from Tanzania, Africa and the world, upcoming health events, and urgent alerts when they matter.</p>
          <ul className="mt-4 hidden list-none flex-col gap-2.5 p-0 sm:mt-6 sm:flex">
            {['Free for health workers', 'Stop anytime — reply STOP', 'Your data stays in line with the PDPA 2022'].map((x) => (
              <li key={x} className="flex items-center gap-2.5"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20"><Check size={14} /></span>{x}</li>
            ))}
          </ul>
        </div>
        <SubscribeForm source={source} />
      </div>
    </section>
  );
}

/** Live figures about the news feed, straight from the database. */
function NewsStats() {
  const [st, setSt] = useState<{ stories: number; critical: number; sources: number; tz: number; updated: string } | null>(null);
  useEffect(() => {
    const since = new Date(Date.now() - 48 * 36e5).toISOString();
    const head = { count: 'exact' as const, head: true };
    Promise.all([
      supabase.from('health_feed_items').select('id', head).gte('published_at', since).neq('image_url', ''),
      supabase.from('health_feed_items').select('id', head).gte('published_at', since).neq('image_url', '').eq('critical', true),
      supabase.from('health_feed_items').select('id', head).gte('published_at', since).neq('image_url', '').eq('zone', 'tanzania'),
      supabase.from('news_sources').select('id', head).eq('enabled', true),
      supabase.from('news_sources').select('last_fetched_at').eq('enabled', true).order('last_fetched_at', { ascending: false, nullsFirst: false }).limit(1),
    ]).then(([a, c, t, src, last]) => setSt({ stories: a.count ?? 0, critical: c.count ?? 0, tz: t.count ?? 0, sources: src.count ?? 0, updated: (last.data?.[0] as { last_fetched_at?: string } | undefined)?.last_fetched_at ?? '' }));
  }, []);
  const ago = (iso: string) => { if (!iso) return '—'; const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
  const tiles: [string, string][] = [
    [st ? String(st.stories) : '·', 'stories, last 48 h'],
    [st ? String(st.tz) : '·', 'from Tanzania'],
    [st ? String(st.critical) : '·', 'critical alerts'],
    [st ? String(st.sources) : '·', 'verified sources'],
  ];
  return (
    <div className="w-full flex-[0_1_380px] rounded-3xl border border-white/20 bg-white/10 p-4 backdrop-blur-xl sm:p-5">
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-2 sm:gap-3">
        {tiles.map(([v, l]) => (
          <div key={l} className="rounded-2xl bg-white/10 px-2 py-2.5 text-center sm:px-3 sm:py-3 sm:text-left">
            <b className="block font-display text-xl leading-none sm:text-3xl">{v}</b>
            <span className="mt-1 block text-[10.5px] leading-tight text-basil-haze sm:text-xs">{l}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11.5px] text-basil-haze sm:text-xs"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />Updated {st ? ago(st.updated) : '…'} · refreshes every 2 hours</div>
    </div>
  );
}
