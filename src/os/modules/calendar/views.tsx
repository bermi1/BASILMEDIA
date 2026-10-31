// Shared calendar — the four views (Month, Week/Day time grid, Schedule) plus the phone week strip
// and the desktop mini-month. Pure presentation: events in, callbacks out.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, MapPin, Repeat2 } from 'lucide-react';
import {
  addDays, dayDiff, evDays, evEnd, evStart, fmtTime, hourRange, isSpanning, isWeekend, layoutDay, layerOf, monthGrid, MONTHS, pad, sameDay, startOfDay,
  startOfMonth, startOfWeek, timeLabel, tint, touchesDay, weekdayShort, weekSegments, WEEKDAYS, addMonths, sortEvents, type CalEvent,
} from './lib';

type Open = (e: CalEvent) => void;

/** Re-render every minute (current-time line, "now" badges). */
export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const eventsOn = (events: CalEvent[], day: Date) => events.filter((e) => touchesDay(e, day)).sort(sortEvents);

// ---------------------------------------------------------------- chips
function barStyle(e: CalEvent): CSSProperties {
  return e.tentative
    ? { background: tint(e.color, 0.1), color: e.color, boxShadow: `inset 0 0 0 1.5px ${tint(e.color, 0.7)}`, backgroundImage: `repeating-linear-gradient(135deg, transparent 0 6px, ${tint(e.color, 0.08)} 6px 12px)` }
    : { background: e.color, color: '#fff' };
}

/** A month-grid bar (all-day / multi-day) or a dotted line item (timed). */
function MonthChip({ e, onOpen, style, continuesLeft, continuesRight }: { e: CalEvent; onOpen: Open; style?: CSSProperties; continuesLeft?: boolean; continuesRight?: boolean }) {
  const spanning = isSpanning(e);
  return (
    <button
      type="button"
      onClick={(ev) => (ev.stopPropagation(), onOpen(e))}
      title={`${e.title} · ${timeLabel(e)}`}
      style={{ ...(spanning ? barStyle(e) : {}), ...style }}
      className={`absolute flex h-[20px] items-center gap-1 overflow-hidden whitespace-nowrap border-0 px-1.5 text-left text-[11.5px] leading-none transition hover:brightness-95 ${
        spanning ? `font-semibold ${continuesLeft ? 'rounded-l-none' : 'rounded-l-md'} ${continuesRight ? 'rounded-r-none' : 'rounded-r-md'}` : 'rounded-md bg-transparent text-basil-ink hover:bg-basil-ice'
      }`}
    >
      {!spanning && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: e.color, boxShadow: e.tentative ? `inset 0 0 0 2px #fff` : undefined, outline: e.tentative ? `1.5px solid ${e.color}` : undefined }} />}
      {!spanning && <span className="shrink-0 tabular-nums text-basil-muted">{fmtTime(evStart(e))}</span>}
      <span className="truncate">{e.title}</span>
    </button>
  );
}

/** Card used in the schedule / day lists. */
export function EventRow({ e, onOpen, day }: { e: CalEvent; onOpen: Open; day?: Date }) {
  const [a, b] = evDays(e);
  const multi = !sameDay(a, b);
  const nth = day && multi ? dayDiff(day, a) + 1 : 0;
  const total = dayDiff(b, a) + 1;
  const time = e.allDay ? (multi ? `All day · day ${nth} of ${total}` : 'All day') : multi && day && !sameDay(day, a) ? `Until ${fmtTime(evEnd(e))}${sameDay(day, b) ? '' : ' (continues)'}` : `${fmtTime(evStart(e))} – ${fmtTime(evEnd(e))}`;
  return (
    <button
      type="button"
      onClick={() => onOpen(e)}
      className="group flex min-h-[52px] w-full items-stretch gap-3 rounded-2xl border-0 p-0 text-left transition active:scale-[0.99]"
      style={{ background: tint(e.color, e.tentative ? 0.05 : 0.09) }}
    >
      <span className="my-2 ml-2 w-1 shrink-0 rounded-full" style={{ background: e.tentative ? `repeating-linear-gradient(${e.color} 0 4px, transparent 4px 7px)` : e.color }} />
      <span className="flex min-w-0 flex-1 flex-col justify-center py-2.5 pr-3">
        <span className="truncate text-[14.5px] font-bold leading-snug text-basil-ink">{e.title}</span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12.5px] text-basil-muted">
          <span className="shrink-0 tabular-nums">{time}</span>
          {e.location && <><span aria-hidden>·</span><MapPin size={12} className="shrink-0" /><span className="truncate">{e.location}</span></>}
        </span>
      </span>
      <span className="mr-3 hidden self-center rounded-full px-2 py-0.5 min-[420px]:inline text-[10.5px] font-bold" style={{ color: e.color, background: tint(e.color, 0.12) }}>
        {layerOf(e.source).label.split(' ')[0]}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------- month
export function MonthView({ cursor, events, compact, onOpen, onPickDay, onCreateAt, onMore, now }: {
  cursor: Date; events: CalEvent[]; compact: boolean; now: Date;
  onOpen: Open; onPickDay: (d: Date) => void; onCreateAt: (d: Date) => void; onMore: (d: Date) => void;
}) {
  const weeks = monthGrid(cursor);
  const month = cursor.getMonth();
  if (compact) {
    return (
      <div className="select-none">
        <div className="grid grid-cols-7 pb-1">{WEEKDAYS.map((w) => <div key={w} className="text-center text-[11px] font-bold uppercase tracking-wide text-basil-muted">{w.slice(0, 1)}</div>)}</div>
        <div className="grid grid-cols-7 gap-y-1">
          {weeks.flatMap((ws) =>
            Array.from({ length: 7 }, (_, i) => {
              const d = addDays(ws, i);
              const list = eventsOn(events, d);
              const colors = [...new Set(list.map((e) => e.color))].slice(0, 3);
              const sel = sameDay(d, cursor), today = sameDay(d, now), out = d.getMonth() !== month;
              return (
                <button key={d.toISOString()} type="button" onClick={() => onPickDay(d)} aria-label={`${d.toDateString()}, ${list.length} events`} aria-pressed={sel}
                  className={`flex h-[52px] flex-col items-center justify-start gap-1 rounded-2xl border-0 pt-1.5 transition ${sel ? 'bg-basil-ice' : 'bg-transparent active:bg-basil-mist'}`}>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[14px] tabular-nums ${today ? 'bg-basil font-bold text-white' : sel ? 'font-bold text-basil' : out ? 'text-basil-muted/45' : 'font-semibold text-basil-ink'}`}>{d.getDate()}</span>
                  <span className="flex h-1.5 gap-[3px]">{colors.map((c) => <span key={c} className="h-1.5 w-1.5 rounded-full" style={{ background: c, opacity: out ? 0.4 : 1 }} />)}</span>
                </button>
              );
            }),
          )}
        </div>
      </div>
    );
  }
  const LANES = 4, LANE_H = 22, TOP = 30;
  return (
    <div className="overflow-hidden rounded-3xl border border-basil-line bg-white">
      <div className="grid grid-cols-7 border-b border-basil-line bg-basil-mist/60">
        {WEEKDAYS.map((w, i) => <div key={w} className={`py-2 text-center text-[11px] font-bold uppercase tracking-[0.12em] ${i >= 5 ? 'text-basil-muted/70' : 'text-basil-muted'}`}>{w}</div>)}
      </div>
      {weeks.map((ws, wi) => {
        const segs = weekSegments(events, ws);
        const total = Array.from({ length: 7 }, (_, c) => segs.filter((s) => s.start <= c && c <= s.end).length);
        const limit = total.map((t) => (t > LANES ? LANES - 1 : LANES));
        const shown = segs.filter((s) => s.lane < Math.min(...limit.slice(s.start, s.end + 1)));
        const hidden = total.map((t, c) => t - shown.filter((s) => s.start <= c && c <= s.end).length);
        return (
          <div key={ws.toISOString()} className={`relative grid h-[124px] grid-cols-7 ${wi ? 'border-t border-basil-line' : ''}`}>
            {Array.from({ length: 7 }, (_, c) => {
              const d = addDays(ws, c);
              const today = sameDay(d, now), out = d.getMonth() !== month;
              return (
                <div key={c} role="button" tabIndex={-1} aria-label={`Create on ${d.toDateString()}`} onClick={() => onCreateAt(d)}
                  className={`relative cursor-pointer ${c ? 'border-l border-basil-line' : ''} ${out ? 'bg-[#FAFCFE]' : isWeekend(d) ? 'bg-basil-mist/40' : ''} transition hover:bg-basil-ice/40`}>
                  <button type="button" onClick={(e) => (e.stopPropagation(), onPickDay(d))}
                    className={`absolute left-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full border-0 px-1 text-[12.5px] tabular-nums transition ${today ? 'bg-basil font-bold text-white' : out ? 'bg-transparent text-basil-muted/50 hover:bg-basil-ice' : 'bg-transparent font-semibold text-basil-ink hover:bg-basil-ice'}`}>
                    {d.getDate() === 1 ? `${MONTHS[d.getMonth()].slice(0, 3)} 1` : d.getDate()}
                  </button>
                  {hidden[c] > 0 && (
                    <button type="button" onClick={(e) => (e.stopPropagation(), onMore(d))} style={{ top: TOP + (LANES - 1) * LANE_H }}
                      className="absolute left-1 right-1 h-[20px] rounded-md border-0 bg-transparent px-1.5 text-left text-[11.5px] font-bold text-basil-muted hover:bg-basil-ice hover:text-basil">
                      +{hidden[c]} more
                    </button>
                  )}
                </div>
              );
            })}
            {shown.map((s) => (
              <MonthChip key={s.ev.id} e={s.ev} onOpen={onOpen} continuesLeft={s.continuesLeft} continuesRight={s.continuesRight}
                style={{ top: TOP + s.lane * LANE_H, left: `calc(${(s.start / 7) * 100}% + ${s.continuesLeft ? 0 : 4}px)`, width: `calc(${((s.end - s.start + 1) / 7) * 100}% - ${(s.continuesLeft ? 0 : 4) + (s.continuesRight ? 0 : 4)}px)` }} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- week / day time grid
export function TimeGridView({ days, events, compact, onOpen, onPickDay, onCreateAt, now }: {
  days: Date[]; events: CalEvent[]; compact: boolean; now: Date;
  onOpen: Open; onPickDay: (d: Date) => void; onCreateAt: (start: Date, allDay: boolean) => void;
}) {
  const HOUR = compact ? 48 : 52;
  const [from, to] = hourRange(events, days);
  const allDaySegs = weekSegments(events.filter(isSpanning), days[0], days.length);
  const lanes = allDaySegs.reduce((m, s) => Math.max(m, s.lane + 1), 0);
  const [expanded, setExpanded] = useState(false);
  const MAXL = 3;
  const visibleLanes = expanded ? lanes : Math.min(lanes, MAXL);
  const gutter = compact ? 40 : 56;
  const single = days.length === 1;
  const scroller = useRef<HTMLDivElement>(null);
  const cols = { gridTemplateColumns: `${gutter}px repeat(${days.length}, minmax(0, 1fr))` };

  const clickSlot = (d: Date, ev: React.MouseEvent<HTMLDivElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const mins = Math.max(0, Math.floor((((ev.clientY - r.top) / HOUR) * 60) / 30) * 30) + from * 60;
    const st = startOfDay(d);
    st.setMinutes(Math.min(mins, 23 * 60 + 30));
    onCreateAt(st, false);
  };

  return (
    <div ref={scroller} className={`overflow-hidden bg-white ${compact ? '-mx-4 border-y' : 'rounded-3xl border'} border-basil-line`}>
      {/* day headers */}
      <div className="grid border-b border-basil-line" style={cols}>
        <div className="flex items-end justify-center pb-1.5 text-[10px] font-semibold text-basil-muted">{compact ? '' : 'EAT'}</div>
        {days.map((d) => {
          const today = sameDay(d, now);
          return (
            <button key={d.toISOString()} type="button" onClick={() => onPickDay(d)}
              className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 border-0 border-l border-basil-line bg-transparent ${single ? 'items-start pl-3' : ''}`}>
              <span className={`text-[11px] font-bold uppercase tracking-wide ${today ? 'text-basil' : 'text-basil-muted'}`}>{compact && !single ? weekdayShort(d).slice(0, 1) : weekdayShort(d)}</span>
              <span className={`flex h-8 w-8 items-center justify-center rounded-full font-display text-[17px] font-extrabold tabular-nums ${today ? 'bg-basil text-white' : 'text-basil-ink'}`}>{d.getDate()}</span>
            </button>
          );
        })}
      </div>
      {/* all-day lane */}
      {lanes > 0 && (
        <div className="relative grid border-b border-basil-line bg-basil-mist/40" style={{ ...cols, height: visibleLanes * 22 + 8 + (lanes > MAXL ? 0 : 0) }}>
          <div className="flex items-start justify-center pt-1.5">
            {lanes > MAXL ? (
              <button type="button" onClick={() => setExpanded((x) => !x)} className="rounded-md border-0 bg-transparent px-1 text-[10px] font-bold text-basil" aria-label={expanded ? 'Show fewer all-day events' : 'Show all all-day events'}>
                {expanded ? 'less' : `+${lanes - MAXL}`}
              </button>
            ) : (
              <span className="text-[10px] font-semibold text-basil-muted">{compact ? '' : 'all-day'}</span>
            )}
          </div>
          {days.map((d) => <div key={d.toISOString()} className="cursor-pointer border-l border-basil-line" onClick={() => onCreateAt(startOfDay(d), true)} />)}
          {allDaySegs.filter((s) => s.lane < visibleLanes).map((s) => (
            <button key={s.ev.id} type="button" onClick={() => onOpen(s.ev)} title={s.ev.title}
              className={`absolute h-[20px] overflow-hidden truncate whitespace-nowrap border-0 px-1.5 text-left text-[11.5px] font-semibold leading-[20px] ${s.continuesLeft ? 'rounded-l-none' : 'rounded-l-md'} ${s.continuesRight ? 'rounded-r-none' : 'rounded-r-md'}`}
              style={{ ...barStyle(s.ev), top: 4 + s.lane * 22, left: `calc(${gutter}px + (100% - ${gutter}px) * ${s.start / days.length} + 2px)`, width: `calc((100% - ${gutter}px) * ${(s.end - s.start + 1) / days.length} - 4px)` }}>
              {s.ev.title}
            </button>
          ))}
        </div>
      )}
      {/* hours */}
      <div className="relative grid" style={cols}>
        <div className="relative" style={{ height: (to - from) * HOUR }}>
          {Array.from({ length: to - from }, (_, i) => (
            <span key={i} className="absolute right-1.5 -translate-y-1/2 text-[10.5px] tabular-nums text-basil-muted" style={{ top: i * HOUR }}>{i === 0 ? '' : `${pad(from + i)}:00`}</span>
          ))}
        </div>
        {days.map((d) => {
          const placed = layoutDay(events, d, from, to);
          const today = sameDay(d, now);
          const nowMin = (now.getHours() - from) * 60 + now.getMinutes();
          return (
            <div key={d.toISOString()} className={`relative cursor-pointer border-l border-basil-line ${isWeekend(d) && !single ? 'bg-basil-mist/40' : ''}`} style={{ height: (to - from) * HOUR }} onClick={(e) => clickSlot(d, e)}
              role="presentation">
              {Array.from({ length: to - from }, (_, i) => (
                <div key={i} className="pointer-events-none absolute inset-x-0 border-t border-basil-line/80" style={{ top: i * HOUR }}>
                  <div className="absolute inset-x-0 border-t border-dashed border-basil-line/50" style={{ top: HOUR / 2 }} />
                </div>
              ))}
              {placed.map((p) => {
                const h = (p.height / 60) * HOUR;
                const e = p.ev;
                // Crowded clusters cascade (Google-style): each block overlaps its right neighbour so titles stay legible.
                const frac = Math.min(1 - p.col / p.cols, (p.span / p.cols) * (p.cols > 2 && p.col + p.span < p.cols ? 1.7 : 1));
                const tight = (compact && !single) || frac < (single ? 0.2 : 0.55);
                const lines = Math.max(1, Math.floor((h - 8) / 14));
                return (
                  <button key={e.id} type="button" onClick={(ev) => (ev.stopPropagation(), onOpen(e))} title={`${e.title} · ${timeLabel(e)}`}
                    className="absolute flex flex-col items-stretch justify-start overflow-hidden rounded-lg border-0 px-1.5 py-1 text-left ring-1 ring-white transition hover:z-10 hover:shadow-card"
                    style={{
                      top: (p.top / 60) * HOUR + 1, height: h - 2, zIndex: p.col + 1,
                      left: `calc(${(p.col / p.cols) * 100}% + 1px)`, width: `calc(${frac * 100}% - ${p.col + p.span >= p.cols ? 4 : 2}px)`,
                      background: e.tentative ? '#fff' : `linear-gradient(${tint(e.color, 0.16)}, ${tint(e.color, 0.16)}), #fff`, borderLeft: `3px solid ${e.color}`,
                      boxShadow: e.tentative ? `inset 0 0 0 1px ${tint(e.color, 0.6)}` : undefined,
                    }}>
                    <span className={`block font-semibold leading-[14px] text-basil-ink ${tight ? 'text-[10.5px]' : 'text-[12px]'}`}
                      style={tight ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'clip' } : { display: '-webkit-box', WebkitLineClamp: Math.min(lines, 3), WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{e.title}</span>
                    {h >= 40 && !tight && <span className="block truncate text-[10.5px] tabular-nums" style={{ color: e.color }}>{fmtTime(evStart(e))} – {fmtTime(evEnd(e))}</span>}
                    {h >= 40 && tight && <span className="block overflow-hidden whitespace-nowrap text-[10px] tabular-nums" style={{ color: e.color }}>{fmtTime(evStart(e))}</span>}
                    {h >= 72 && e.location && !tight && <span className="mt-0.5 block truncate text-[10.5px] text-basil-muted">{e.location}</span>}
                  </button>
                );
              })}
              {today && nowMin >= 0 && nowMin <= (to - from) * 60 && (
                <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: (nowMin / 60) * HOUR }}>
                  <div className="absolute -left-[5px] -top-[5px] h-[10px] w-[10px] rounded-full bg-red-500" />
                  <div className="h-[2px] bg-red-500" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- schedule / agenda
const BANNERS = [
  'linear-gradient(120deg,#0A2F5C 0%,#0F6EC2 60%,#7CC0F5 100%)',
  'linear-gradient(120deg,#0F6EC2 0%,#2B86DA 50%,#F5B942 130%)',
  'linear-gradient(120deg,#061E3D 0%,#0D9488 120%)',
];
export function ScheduleView({ from, events, compact, onOpen, now, onPickDay }: { from: Date; events: CalEvent[]; compact: boolean; now: Date; onOpen: Open; onPickDay: (d: Date) => void }) {
  const [span, setSpan] = useState(60);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => setSpan(60), [from]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((es) => es.some((x) => x.isIntersecting) && setSpan((s) => Math.min(s + 60, 730)), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const days = useMemo(() => {
    const out: { day: Date; list: CalEvent[] }[] = [];
    const start = startOfDay(from);
    const relevant = events.filter((e) => evDays(e)[1] >= start && evDays(e)[0] < addDays(start, span));
    for (let i = 0; i < span; i++) {
      const d = addDays(start, i);
      const list = eventsOn(relevant, d);
      if (list.length || sameDay(d, now) || i === 0) out.push({ day: d, list });
    }
    return out;
  }, [from, events, span, now]);

  let lastMonth = -1;
  return (
    <div className="flex flex-col">
      {days.map(({ day, list }, i) => {
        const banner = day.getMonth() !== lastMonth && (i > 0 || day.getDate() <= 7);
        lastMonth = day.getMonth();
        const today = sameDay(day, now);
        return (
          <div key={day.toISOString()}>
            {banner && (
              <div className="relative mb-3 mt-4 flex h-[72px] items-end overflow-hidden rounded-3xl px-5 pb-3 text-white first:mt-0" style={{ background: BANNERS[day.getMonth() % BANNERS.length] }}>
                <div className="bg-dots-dark absolute inset-0 opacity-60" />
                <div className="absolute -right-6 -top-10 h-32 w-32 rounded-full bg-white/10" />
                <span className="relative font-display text-[22px] font-extrabold tracking-tight">{MONTHS[day.getMonth()]} <span className="font-semibold text-white/70">{day.getFullYear()}</span></span>
              </div>
            )}
            <div className={`flex gap-3 py-2 ${compact ? '' : 'pl-1'}`}>
              <button type="button" onClick={() => onPickDay(day)} className="flex w-12 shrink-0 flex-col items-center border-0 bg-transparent pt-1" aria-label={`Open ${day.toDateString()}`}>
                <span className={`text-[11px] font-bold uppercase tracking-wide ${today ? 'text-basil' : 'text-basil-muted'}`}>{weekdayShort(day)}</span>
                <span className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-full font-display text-[19px] font-extrabold tabular-nums ${today ? 'bg-basil text-white shadow-glow' : 'text-basil-ink'}`}>{day.getDate()}</span>
              </button>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1">
                {list.length ? list.map((e) => <EventRow key={e.id} e={e} day={day} onOpen={onOpen} />) : (
                  <div className="flex min-h-[52px] items-center rounded-2xl border border-dashed border-basil-edge px-4 text-[13.5px] text-basil-muted">{today ? 'Nothing else planned today' : 'Nothing planned'}</div>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={sentinel} className="flex justify-center py-6">
        {span < 730 ? (
          <button type="button" onClick={() => setSpan((s) => s + 60)} className="btn-outline min-h-[44px] text-sm"><Repeat2 size={16} />Load more</button>
        ) : (
          <span className="text-sm text-basil-muted">That’s two years ahead.</span>
        )}
      </div>
    </div>
  );
}

/** Flat result list for search (all dates, grouped by day). */
export function SearchResults({ events, onOpen, query }: { events: CalEvent[]; onOpen: Open; query: string }) {
  const groups = useMemo(() => {
    const m = new Map<string, { day: Date; list: CalEvent[] }>();
    for (const e of [...events].sort((a, b) => evStart(a).getTime() - evStart(b).getTime())) {
      const d = evDays(e)[0];
      const k = d.toISOString();
      if (!m.has(k)) m.set(k, { day: d, list: [] });
      m.get(k)!.list.push(e);
    }
    return [...m.values()];
  }, [events]);
  if (!groups.length) return <div className="rounded-3xl border border-dashed border-basil-edge bg-white px-6 py-12 text-center text-basil-muted">No events match “{query}”.</div>;
  return (
    <div className="flex flex-col gap-1">
      <div className="mb-1 text-[13px] font-semibold text-basil-muted">{events.length} result{events.length === 1 ? '' : 's'}</div>
      {groups.map(({ day, list }) => (
        <div key={day.toISOString()} className="flex gap-3 py-1.5">
          <div className="w-16 shrink-0 pt-2 text-[12px] font-bold leading-tight text-basil-muted">{weekdayShort(day)}<br /><span className="text-[15px] text-basil-ink">{day.getDate()} {MONTHS[day.getMonth()].slice(0, 3)}</span><br />{day.getFullYear()}</div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">{list.map((e) => <EventRow key={e.id} e={e} onOpen={onOpen} />)}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- phone week strip
export function WeekStrip({ cursor, events, now, onPick, onShift }: { cursor: Date; events: CalEvent[]; now: Date; onPick: (d: Date) => void; onShift: (weeks: number) => void }) {
  const ws = startOfWeek(cursor);
  const [dir, setDir] = useState(0);
  const shift = (n: number) => (setDir(n), onShift(n));
  return (
    <div className="relative -mx-1 overflow-hidden">
      <AnimatePresence initial={false} custom={dir} mode="popLayout">
        <motion.div
          key={ws.toISOString()}
          custom={dir}
          initial={{ x: dir * 120, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: dir * -120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.35}
          onDragEnd={(_, info) => (info.offset.x < -40 || info.velocity.x < -400 ? shift(1) : info.offset.x > 40 || info.velocity.x > 400 ? shift(-1) : undefined)}
          className="grid touch-pan-y grid-cols-7"
        >
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(ws, i);
            const sel = sameDay(d, cursor), today = sameDay(d, now);
            const colors = [...new Set(eventsOn(events, d).map((e) => e.color))].slice(0, 3);
            return (
              <button key={i} type="button" onClick={() => onPick(d)} aria-pressed={sel} aria-label={d.toDateString()}
                className="flex min-h-[64px] flex-col items-center justify-center gap-1 border-0 bg-transparent">
                <span className={`text-[11px] font-bold uppercase ${sel ? 'text-basil' : 'text-basil-muted'}`}>{weekdayShort(d).slice(0, 1)}</span>
                <span className={`flex h-9 w-9 items-center justify-center rounded-full font-display text-[16px] font-extrabold tabular-nums transition ${sel ? 'bg-basil text-white shadow-glow' : today ? 'text-basil ring-2 ring-basil/30' : 'text-basil-ink'}`}>{d.getDate()}</span>
                <span className="flex h-1.5 gap-[3px]">{colors.map((c) => <span key={c} className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />)}</span>
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------- desktop mini month
export function MiniMonth({ cursor, now, events, onPick }: { cursor: Date; now: Date; events: CalEvent[]; onPick: (d: Date) => void }) {
  const [shown, setShown] = useState(() => startOfMonth(cursor));
  useEffect(() => setShown(startOfMonth(cursor)), [cursor]);
  const weeks = monthGrid(shown);
  const busy = useMemo(() => {
    const set = new Set<string>();
    const a = weeks[0], b = addDays(weeks[weeks.length - 1], 7);
    for (const e of events) {
      const [s, t] = evDays(e);
      if (t < a || s >= b) continue;
      for (let d = s < a ? a : s; d <= t && d < b; d = addDays(d, 1)) set.add(d.toDateString());
    }
    return set;
  }, [events, weeks]);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between pl-1">
        <span className="font-display text-[14px] font-extrabold">{MONTHS[shown.getMonth()]} {shown.getFullYear()}</span>
        <span className="flex">
          <button type="button" aria-label="Previous month" onClick={() => setShown(addMonths(shown, -1))} className="flex h-8 w-8 items-center justify-center rounded-full border-0 bg-transparent text-basil-muted hover:bg-basil-ice"><ChevronLeft size={16} /></button>
          <button type="button" aria-label="Next month" onClick={() => setShown(addMonths(shown, 1))} className="flex h-8 w-8 items-center justify-center rounded-full border-0 bg-transparent text-basil-muted hover:bg-basil-ice"><ChevronRight size={16} /></button>
        </span>
      </div>
      <div className="grid grid-cols-7 text-center">
        {WEEKDAYS.map((w) => <span key={w} className="py-1 text-[10px] font-bold text-basil-muted">{w.slice(0, 1)}</span>)}
        {weeks.flatMap((ws) => Array.from({ length: 7 }, (_, i) => {
          const d = addDays(ws, i);
          const sel = sameDay(d, cursor), today = sameDay(d, now), out = d.getMonth() !== shown.getMonth();
          return (
            <button key={d.toISOString()} type="button" onClick={() => onPick(d)} aria-label={d.toDateString()}
              className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-full border-0 text-[12px] tabular-nums transition ${today ? 'bg-basil font-bold text-white' : sel ? 'bg-basil-ice font-bold text-basil' : out ? 'bg-transparent text-basil-muted/45 hover:bg-basil-mist' : 'bg-transparent text-basil-ink hover:bg-basil-mist'}`}>
              {d.getDate()}
              {busy.has(d.toDateString()) && !today && <span className="absolute bottom-[3px] h-1 w-1 rounded-full bg-basil/60" />}
            </button>
          );
        }))}
      </div>
    </div>
  );
}

export { eventsOn };
