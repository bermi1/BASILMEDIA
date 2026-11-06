import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Briefcase, CalendarPlus } from 'lucide-react';
import { useRows } from '@/hooks/useData';
import { useSeo } from '@/hooks/useSeo';
import { fmtDate } from '@/lib/format';
import { Media } from '@/components/Media';
import { Reveal } from '@/components/Reveal';
import { SubscribeForm } from '@/components/SubscribeForm';
import { PageHero } from '@/components/PageHero';
import { NEWS_DESKS } from '@/lib/types';

function icsHref(title: string, date: string, where: string) {
  const d = date.replace(/-/g, '');
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Basil Media//Health Brief//EN', 'BEGIN:VEVENT', `UID:${d}-${title.length}@basilmedia`, `DTSTART;VALUE=DATE:${d}`, `SUMMARY:${title}`, `LOCATION:${where}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(body)}`;
}

const DESK_LINE: Record<string, string> = {
  Health: 'Policy, research, CPD and alerts for health professionals.',
  'Youth & Opportunities': 'Jobs, internships, grants and competitions for young Tanzanians.',
  Innovation: 'Startups, tech and the people building what comes next.',
  'Capital & Business': 'Funding, markets and business insight you can act on.',
  'Banking for Youth': 'Accounts, loans and bank programmes made for young people.',
};

export default function HealthNews() {
  useSeo('Basil Brief — News', 'Health, youth opportunities, innovation, capital & business and banking for youth — curated by Basil Media.');
  const { rows: stories } = useRows('news_stories', { publishedOnly: true });
  const { rows: opps } = useRows('opportunities', { publishedOnly: true });
  const { rows: events } = useRows('events', { publishedOnly: true });
  const [desk, setDesk] = useState('All');
  const [oppKind, setOppKind] = useState('All');
  const filtered = stories.filter((s) => desk === 'All' || s.sector === desk);
  const featured = filtered.find((s) => s.featured) ?? filtered[0];
  const rest = filtered.filter((s) => s !== featured);
  const upcoming = events.filter((e) => e.starts_on >= new Date().toISOString().slice(0, 10)).slice(0, 5);
  const oppKinds = ['All', ...Array.from(new Set(opps.map((o) => o.kind)))];
  const oppList = opps.filter((o) => oppKind === 'All' || o.kind === oppKind);
  const showOpps = desk === 'All' || desk === 'Youth & Opportunities' || desk === 'Capital & Business';

  return (
    <>
      <PageHero kicker="BASIL BRIEF" title={<>News that moves <span className="text-glow">Tanzania forward.</span></>}>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/subscribe" className="flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold text-basil no-underline hover:bg-basil-ice">Subscribe free <ArrowRight size={16} /></Link>
          <a href="#opportunities" className="flex h-11 items-center rounded-full border border-white/30 bg-white/10 px-5 text-[14px] font-semibold text-white no-underline backdrop-blur hover:bg-white/20 hover:text-white">Opportunities</a>
        </div>
      </PageHero>

      <div className="sticky top-[76px] z-20 border-b border-basil-line bg-white/92 backdrop-blur-xl sm:top-[92px]">
        <div role="tablist" aria-label="News desks" className="container-bm scrollbar-none flex gap-5 overflow-x-auto sm:gap-7">
          {['All', ...NEWS_DESKS].map((d) => {
            const on = desk === d;
            const n = d === 'All' ? stories.length : stories.filter((s) => s.sector === d).length;
            return (
              <button key={d} type="button" role="tab" aria-selected={on} onClick={() => setDesk(d)} className={`relative flex h-12 shrink-0 items-center gap-1.5 whitespace-nowrap border-0 bg-transparent px-0 text-[14px] font-medium ${on ? 'text-basil-ink' : 'text-basil-muted hover:text-basil-ink'}`}>
                {d}{n > 0 && <span className={`rounded-full px-1.5 text-[11px] font-bold ${on ? 'bg-basil text-white' : 'bg-basil-mist text-basil-muted'}`}>{n}</span>}
                {on && <motion.span layoutId="desk-line" className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-basil" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="container-bm grid gap-8 py-7 sm:py-10 lg:grid-cols-[1fr_320px] lg:gap-10">
        <div className="min-w-0">
          {desk !== 'All' && <p className="m-0 mb-5 text-[14.5px] text-basil-muted">{DESK_LINE[desk]}</p>}
          {featured ? (
            <Reveal>
              <Link to={`/health-news/${featured.id}`} className="glow-card group mb-6 grid overflow-hidden rounded-[22px] border border-basil-line bg-white text-basil-ink no-underline hover:text-basil-ink md:grid-cols-2">
                <Media src={featured.image_url} index={0} overlay={false} className="min-h-[180px] md:min-h-[260px]" />
                <div className="flex flex-col gap-2 p-5 sm:p-7">
                  <div className="flex flex-wrap gap-1.5 text-[11px] font-bold uppercase tracking-wide"><span className="text-basil">{featured.sector}</span><span className="text-basil-muted">· {featured.tag}</span></div>
                  <h2 className="m-0 text-[20px] font-bold leading-tight group-hover:text-basil sm:text-[26px]">{featured.title}</h2>
                  <p className="m-0 line-clamp-3 text-[14.5px] text-basil-muted">{featured.dek}</p>
                  <span className="mt-auto pt-2 text-[12.5px] text-basil-muted">{fmtDate(featured.published_at)} · {featured.read_minutes} min read</span>
                </div>
              </Link>
            </Reveal>
          ) : (
            <div className="rounded-[22px] border border-dashed border-basil-edge bg-basil-mist px-6 py-12 text-center">
              <b className="block">New stories land here every week.</b>
              <span className="text-sm text-basil-muted">Subscribe and we’ll send them to your phone first.</span>
              <div className="mt-4"><Link to="/subscribe" className="btn-primary h-11 min-h-0">Subscribe free</Link></div>
            </div>
          )}
          <div className="flex flex-col divide-y divide-basil-line">
            {rest.map((s, i) => (
              <Link key={s.id} to={`/health-news/${s.id}`} className="group flex gap-3.5 py-4 text-basil-ink no-underline hover:text-basil-ink">
                <Media src={s.image_url} index={i + 1} overlay={false} className="h-[78px] w-[104px] shrink-0 rounded-xl sm:h-[96px] sm:w-[150px]" />
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-basil">{s.sector}</span>
                  <h3 className="m-0 mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug group-hover:text-basil sm:text-[17px]">{s.title}</h3>
                  <span className="text-[12px] text-basil-muted">{fmtDate(s.published_at)} · {s.read_minutes} min</span>
                </div>
              </Link>
            ))}
          </div>

          {showOpps && (
            <section id="opportunities" aria-labelledby="opp-h" className="mt-8 scroll-mt-40 rounded-[22px] bg-basil-mist p-4 sm:p-6">
              <div className="mb-4">
                <div className="kicker">OPPORTUNITIES BOARD</div>
                <h2 id="opp-h" className="m-0 mt-1 text-[19px] font-bold sm:text-2xl">Jobs, grants, funding &amp; competitions</h2>
              </div>
              <div role="group" aria-label="Opportunity type" className="scrollbar-none -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1">
                {oppKinds.map((k) => <button key={k} type="button" aria-pressed={oppKind === k} onClick={() => setOppKind(k)} className={`h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium ${oppKind === k ? 'border-0 bg-basil text-white' : 'border border-basil-edge bg-white text-basil-deep'}`}>{k}</button>)}
              </div>
              <div className="flex flex-col gap-2">
                {oppList.map((o) => (
                  <a key={o.id} href={o.link || undefined} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-basil-line bg-white p-3.5 text-basil-ink no-underline hover:border-basil-soft hover:text-basil-ink">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-basil-ice text-basil"><Briefcase size={18} /></span>
                    <span className="min-w-0 flex-1"><b className="block truncate text-[14.5px]">{o.title}</b><span className="block truncate text-[12.5px] text-basil-muted">{o.org} · {o.location} · closes {fmtDate(o.closes_on)}</span></span>
                    <span className="hidden rounded-full bg-basil-ice px-2.5 py-1 text-[11px] font-bold text-basil-deep sm:inline">{o.kind}</span>
                  </a>
                ))}
                {!oppList.length && <p className="m-0 py-4 text-center text-sm text-basil-muted">New opportunities are posted every week.</p>}
              </div>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-5">
          <section aria-labelledby="cpd-h" className="rounded-[22px] border border-basil-line p-5">
            <div className="kicker">CALENDAR</div>
            <h2 id="cpd-h" className="m-0 mb-4 mt-1 text-[17px] font-bold">Upcoming events</h2>
            <div className="flex flex-col gap-3">
              {upcoming.map((e) => {
                const d = new Date(`${e.starts_on}T12:00:00`);
                return (
                  <div key={e.id} className="flex items-center gap-3">
                    <div className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-basil-ice py-1.5 text-basil-deep"><span className="text-[10px] font-bold uppercase">{d.toLocaleString('en-GB', { month: 'short' })}</span><span className="font-display text-lg font-bold leading-none">{d.getDate()}</span></div>
                    <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-semibold">{e.title}</div><div className="truncate text-[12px] text-basil-muted">{e.venue}{e.cpd ? ` · ${e.cpd}` : ''}</div></div>
                    <a href={icsHref(e.title, e.starts_on, e.venue)} download={`${e.title}.ics`} aria-label={`Add ${e.title} to calendar`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-basil-edge text-basil hover:bg-basil-ice"><CalendarPlus size={17} /></a>
                  </div>
                );
              })}
              {!upcoming.length && <p className="m-0 text-sm text-basil-muted">No upcoming events listed.</p>}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

export function SubscribeSection({ source = 'health-news', standalone }: { source?: string; standalone?: boolean }) {
  return (
    <section id="subscribe" className="scroll-mt-24 text-white" style={{ background: 'radial-gradient(ellipse at 10% 10%, rgba(124,192,245,0.3), transparent 50%), linear-gradient(160deg, #0F6EC2, #0A2F5C 60%, #061E3D)' }}>
      <div className={`container-bm max-w-[460px] pb-12 ${standalone ? 'pt-24 sm:pt-32' : 'pt-10'}`}>
        <div className="font-mono text-[11px] tracking-[0.2em] text-basil-haze">BASIL BRIEF · JIUNGE</div>
        <h1 className="mb-1 mt-2 text-[26px] font-bold leading-tight sm:text-[32px]">Get the brief every Monday.</h1>
        <p className="m-0 mb-5 text-[14px] text-basil-frost">Free. Pick your topics.</p>
        <SubscribeForm source={source} />
      </div>
    </section>
  );
}
