// Shared calendar for every role: projects, shoots, client retainer schedules, transport, rooms,
// growth events, leave, finance due dates and custom team events — Google-Calendar-style, built for
// a 390px phone first. `CalendarApp` is the full page (/os/calendar); `CalendarPhone` is the same app
// tuned for the phone shell (/app): sits under its 56px sticky header, FAB above the tab bar.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Layers, Loader2, Plus, Search, X } from 'lucide-react';
import { useActing } from '@/os/lib/session';
import { deleteRow, insertRow, updateRow } from '@/os/lib/store';
import { useToast } from '@/os/cms/toast';
import { Sheet } from '@/os/ui';
import { useCalendarEvents } from './data';
import {
  addDays, addMonths, applyFilter, fmtDayLong, LAYERS, layersFor, LEADER_ROLES, MONTHS, overlapsRange, sameDay, startOfDay, startOfMonth, startOfWeek,
  type CalEvent, type LayerKey,
} from './lib';
import { DaySheet, draftFrom, draftToRow, EventForm, EventSheet, LayerList, type Draft } from './sheets';
import { EventRow, eventsOn, MiniMonth, MonthView, ScheduleView, SearchResults, TimeGridView, useNow, WeekStrip } from './views';

export type CalView = 'month' | 'week' | 'day' | 'schedule';
const VIEWS: { value: CalView; label: string; key: string }[] = [
  { value: 'schedule', label: 'Schedule', key: 'a' },
  { value: 'day', label: 'Day', key: 'd' },
  { value: 'week', label: 'Week', key: 'w' },
  { value: 'month', label: 'Month', key: 'm' },
];

const LS_LAYERS = 'basil-cal-layers-v1';
const LS_MINE = 'basil-cal-only-mine-v1';
const LS_VIEW = 'basil-cal-view-v1';
const lsGet = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const lsSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode / blocked storage: keep in memory */
  }
};

function useMedia(q: string) {
  const get = () => (typeof matchMedia !== 'undefined' ? matchMedia(q).matches : false);
  const [m, setM] = useState(get);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

export interface CalendarAppProps {
  /** 'phone' forces the compact phone layout (schedule-first, week strip, FAB above the tab bar). */
  variant?: 'page' | 'phone';
  /** Px offset for the sticky toolbar (height of the host's sticky header). Defaults: page 64, phone 56. */
  stickyTop?: number;
}

export function CalendarApp({ variant = 'page', stickyTop }: CalendarAppProps) {
  const { role, userId } = useActing();
  const toast = useToast();
  const narrow = useMedia('(max-width: 640px)');
  const wide = useMedia('(min-width: 1180px)');
  const compact = variant === 'phone' || narrow;
  const sidebar = variant === 'page' && wide;
  const top = stickyTop ?? (variant === 'phone' ? 56 : 64);
  const now = useNow();

  const { events: all, loading, error, sources } = useCalendarEvents();
  const available = useMemo(() => layersFor(role), [role]);

  const [view, setViewState] = useState<CalView>(() => {
    const saved = lsGet(LS_VIEW) as CalView | null;
    if (variant === 'phone' || (typeof matchMedia !== 'undefined' && matchMedia('(max-width: 640px)').matches)) return saved === 'month' || saved === 'day' || saved === 'week' ? saved : 'schedule';
    return saved && saved !== 'schedule' ? saved : 'month';
  });
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [dir, setDir] = useState(0);
  const [layers, setLayers] = useState<Set<LayerKey>>(() => {
    try {
      const saved = JSON.parse(lsGet(LS_LAYERS) ?? 'null') as LayerKey[] | null;
      if (Array.isArray(saved)) return new Set(saved);
    } catch {
      /* ignore */
    }
    return new Set(LAYERS.filter((l) => !l.defaultOff).map((l) => l.key));
  });
  const [onlyMine, setOnlyMineState] = useState(() => lsGet(LS_MINE) === '1');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [selected, setSelected] = useState<CalEvent | null>(null);
  const [moreDay, setMoreDay] = useState<Date | null>(null);
  const [form, setForm] = useState<{ open: boolean; draft: Draft; editId: string | null }>({ open: false, draft: draftFrom(), editId: null });

  const setView = (v: CalView) => {
    setDir(0);
    setViewState(v);
    lsSet(LS_VIEW, v);
  };
  const toggleLayer = (k: LayerKey) =>
    setLayers((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      lsSet(LS_LAYERS, JSON.stringify([...n]));
      return n;
    });
  const setOnlyMine = (v: boolean) => {
    setOnlyMineState(v);
    lsSet(LS_MINE, v ? '1' : '0');
  };

  const visibleLayers = useMemo(() => new Set(available.filter((l) => layers.has(l.key)).map((l) => l.key)), [available, layers]);
  const events = useMemo(() => applyFilter(all, { layers: visibleLayers, onlyMine, userId, query: '' }), [all, visibleLayers, onlyMine, userId]);
  const results = useMemo(() => (query.trim() ? applyFilter(all, { layers: visibleLayers, onlyMine, userId, query }) : []), [all, visibleLayers, onlyMine, userId, query]);
  const counts = useMemo(() => {
    const c: Partial<Record<LayerKey, number>> = {};
    const a = addDays(startOfWeek(now), -7), b = addDays(a, 42);
    for (const e of all) if (overlapsRange(e, a, b)) c[e.source] = (c[e.source] ?? 0) + 1;
    return c;
  }, [all, now]);

  const canCreate = role !== 'client';
  const canEdit = (e: CalEvent | null) => !!e?.record && (e.record.created_by === userId || LEADER_ROLES.includes(role));

  // ---------- navigation
  const step = useCallback(
    (n: number) => {
      setDir(n);
      setCursor((c) => (view === 'month' ? (compact ? addMonths(c, n) : startOfMonth(addMonths(c, n))) : addDays(c, n * (view === 'day' ? 1 : 7))));
    },
    [view, compact],
  );
  const goToday = () => {
    const t = startOfDay(new Date());
    setDir(t < cursor ? -1 : t > cursor ? 1 : 0);
    setCursor(t);
  };
  const pickDay = (d: Date, toDay = false) => {
    setDir(d < cursor ? -1 : d > cursor ? 1 : 0);
    setCursor(startOfDay(d));
    if (toDay) setView('day');
  };

  // keyboard shortcuts (desktop): t today, ←/→ (or j/k) period, m/w/d/a views, / search, c create
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || /input|textarea|select/i.test(t.tagName) || t.isContentEditable || selected || form.open || moreDay || layersOpen) return;
      const v = VIEWS.find((x) => x.key === e.key);
      if (v) setView(v.value);
      else if (e.key === 't') goToday();
      else if (e.key === 'ArrowRight' || e.key === 'k') step(1);
      else if (e.key === 'ArrowLeft' || e.key === 'j') step(-1);
      else if (e.key === '/') (e.preventDefault(), setSearchOpen(true));
      else if (e.key === 'c' && canCreate) openCreate();
      else return;
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  });

  // ---------- create / edit
  const openCreate = (start?: Date, allDay = false) => {
    if (!canCreate) return;
    const s = start ?? (() => {
      const d = new Date(cursor);
      const n = new Date();
      d.setHours(sameDay(d, n) ? Math.min(n.getHours() + 1, 23) : 9, 0, 0, 0);
      return d;
    })();
    setForm({ open: true, draft: draftFrom(null, s, allDay), editId: null });
  };
  const openEdit = (e: CalEvent) => {
    if (!e.record) return;
    setSelected(null);
    setForm({ open: true, draft: draftFrom(e.record), editId: e.record.id });
  };
  const save = async (d: Draft) => {
    const row = draftToRow(d);
    if (form.editId) {
      await updateRow('calendar_events', form.editId, row);
      toast('Event updated');
    } else {
      await insertRow('calendar_events', { ...row, created_by: userId });
      toast('Event added to the shared calendar');
      const s = new Date(row.starts_at);
      if (!sameDay(s, cursor) && view !== 'month') pickDay(s);
    }
    setForm((f) => ({ ...f, open: false }));
  };
  const remove = async () => {
    if (!selected?.record) return;
    try {
      await deleteRow('calendar_events', selected.record.id);
      toast('Event deleted');
      setSelected(null);
    } catch (e) {
      toast((e as Error).message ?? 'Could not delete', 'error');
    }
  };

  // ---------- labels
  const ws = startOfWeek(cursor);
  const title = (() => {
    if (view === 'week') {
      const we = addDays(ws, 6);
      if (ws.getMonth() === we.getMonth()) return `${MONTHS[ws.getMonth()]} ${ws.getFullYear()}`;
      return ws.getFullYear() === we.getFullYear()
        ? `${MONTHS[ws.getMonth()].slice(0, 3)} – ${MONTHS[we.getMonth()].slice(0, 3)} ${we.getFullYear()}`
        : `${MONTHS[ws.getMonth()].slice(0, 3)} ${ws.getFullYear()} – ${MONTHS[we.getMonth()].slice(0, 3)} ${we.getFullYear()}`;
    }
    if (view === 'day' && !compact) return fmtDayLong(cursor);
    return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  })();
  const periodKey = view === 'month' ? `m${cursor.getFullYear()}-${cursor.getMonth()}` : view === 'week' ? `w${ws.toISOString()}` : `d${cursor.toISOString()}`;
  const showStrip = compact && (view === 'schedule' || view === 'day');
  const searching = query.trim().length > 0;

  // ---------- pieces
  const iconBtn = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-basil-deep transition hover:bg-basil-ice active:bg-basil-ice';
  const segmented = (
    <div role="tablist" aria-label="Calendar view" className={`relative grid grid-cols-4 rounded-full bg-basil-ice/80 p-1 ${compact ? 'min-w-0 flex-1' : 'w-[340px]'}`}>
      {VIEWS.map((v) => (
        <button key={v.value} role="tab" type="button" aria-selected={view === v.value} onClick={() => setView(v.value)}
          className={`relative z-10 flex h-9 items-center justify-center rounded-full border-0 bg-transparent ${compact ? 'text-[12.5px]' : 'text-[13px]'} font-bold transition-colors ${view === v.value ? 'text-basil-deep' : 'text-basil-muted hover:text-basil-deep'}`}>
          {view === v.value && <motion.span layoutId={`cal-seg-${variant}`} className="absolute inset-0 -z-10 rounded-full bg-white shadow-[0_2px_8px_rgba(10,47,92,0.12)]" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          {v.label}
        </button>
      ))}
    </div>
  );
  const searchBox = (
    <label className={`flex h-11 items-center gap-2 rounded-full border border-basil-edge bg-white px-3.5 transition focus-within:border-basil focus-within:shadow-[0_0_0_4px_rgba(15,110,194,0.12)] ${compact ? 'w-full' : 'w-[260px]'}`}>
      <Search size={17} className="shrink-0 text-basil-muted" />
      <input autoFocus={compact} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events, places, clients" aria-label="Search calendar"
        className="min-w-0 flex-1 border-0 bg-transparent text-[14.5px] text-basil-ink outline-none placeholder:text-basil-muted/70" />
      {(query || compact) && <button type="button" aria-label="Clear search" onClick={() => (setQuery(''), compact && setSearchOpen(false))} className="-mr-1 flex h-8 w-8 items-center justify-center rounded-full border-0 bg-transparent text-basil-muted hover:bg-basil-ice"><X size={16} /></button>}
    </label>
  );

  const header = (
    <div className={`sticky z-20 ${compact ? '-mx-4 px-4' : '-mx-6 px-6'} border-b border-basil-line/80 bg-white/90 pb-2 pt-2 backdrop-blur-xl`} style={{ top }}>
      {compact ? (
        <>
          <div className="flex h-12 items-center gap-1">
            <button type="button" onClick={() => setView('month')} className="mr-auto flex min-w-0 items-center gap-1 border-0 bg-transparent p-0 text-left" aria-label="Show month">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={title} initial={{ y: dir >= 0 ? 10 : -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: dir >= 0 ? -10 : 10, opacity: 0 }} transition={{ duration: 0.18 }}
                  className="truncate font-display text-[20px] font-extrabold tracking-tight text-basil-ink">{title}</motion.span>
              </AnimatePresence>
            </button>
            <button type="button" className={iconBtn} aria-label="Previous" onClick={() => step(-1)}><ChevronLeft size={20} /></button>
            <button type="button" className={iconBtn} aria-label="Next" onClick={() => step(1)}><ChevronRight size={20} /></button>
            <button type="button" className={`${iconBtn} ${searchOpen ? 'bg-basil-ice' : ''}`} aria-label="Search" aria-expanded={searchOpen} onClick={() => (setSearchOpen((x) => !x), setQuery(''))}><Search size={19} /></button>
            <button type="button" className={`${iconBtn} relative`} aria-label="Calendars and filters" onClick={() => setLayersOpen(true)}>
              <Layers size={19} />
              {(onlyMine || visibleLayers.size < available.filter((l) => !l.defaultOff).length) && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-sun ring-2 ring-white" />}
            </button>
          </div>
          <AnimatePresence initial={false}>
            {searchOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="pb-2 pt-1">{searchBox}</div>
              </motion.div>
            )}
          </AnimatePresence>
          {!searching && (
            <div className="flex items-center gap-2 pt-1">
              <button type="button" onClick={goToday} aria-label="Go to today" className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-basil-edge bg-white pl-2.5 pr-3.5 text-[13px] font-bold text-basil-deep active:bg-basil-ice">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-basil text-[11px] font-extrabold tabular-nums text-white">{now.getDate()}</span>Today
              </button>
              {segmented}
            </div>
          )}
          {showStrip && !searching && <div className="pt-1"><WeekStrip cursor={cursor} events={events} now={now} onPick={(d) => pickDay(d)} onShift={(n) => pickDay(addDays(cursor, n * 7))} /></div>}
        </>
      ) : (
        <div className="flex h-14 items-center gap-2">
          <button type="button" onClick={goToday} className="btn-outline min-h-[40px] rounded-full px-4 text-sm">Today</button>
          <button type="button" className={iconBtn} aria-label="Previous" onClick={() => step(-1)}><ChevronLeft size={20} /></button>
          <button type="button" className={`${iconBtn} -ml-2`} aria-label="Next" onClick={() => step(1)}><ChevronRight size={20} /></button>
          <h1 className="m-0 min-w-0 truncate font-display text-[24px] font-extrabold tracking-tight">{title}</h1>
          <div className="ml-auto flex items-center gap-2">
            {searchBox}
            {!sidebar && (
              <button type="button" className={`${iconBtn} relative border border-basil-edge`} aria-label="Calendars and filters" onClick={() => setLayersOpen(true)}>
                <Layers size={18} />
                {(onlyMine || visibleLayers.size < available.filter((l) => !l.defaultOff).length) && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-sun ring-2 ring-white" />}
              </button>
            )}
            {segmented}
          </div>
        </div>
      )}
    </div>
  );

  const days = view === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(ws, i)) : [cursor];
  const body = searching ? (
    <SearchResults events={results} query={query} onOpen={setSelected} />
  ) : view === 'month' ? (
    <>
      <MonthView cursor={cursor} events={events} compact={compact} now={now} onOpen={setSelected} onPickDay={(d) => (compact ? pickDay(d) : pickDay(d, true))} onCreateAt={(d) => { const s = new Date(d); s.setHours(9, 0, 0, 0); openCreate(s); }} onMore={setMoreDay} />
      {compact && (
        <div className="mt-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="m-0 text-[15px] font-extrabold">{fmtDayLong(cursor)}</h2>
            <button type="button" onClick={() => setView('day')} className="min-h-[44px] border-0 bg-transparent text-[13px] font-bold text-basil">Open day</button>
          </div>
          <div className="flex flex-col gap-1.5">
            {eventsOn(events, cursor).map((e) => <EventRow key={e.id} e={e} day={cursor} onOpen={setSelected} />)}
            {!eventsOn(events, cursor).length && <div className="flex min-h-[56px] items-center justify-center rounded-2xl border border-dashed border-basil-edge text-[13.5px] text-basil-muted">Nothing planned</div>}
          </div>
        </div>
      )}
    </>
  ) : view === 'schedule' ? (
    <ScheduleView from={cursor} events={events} compact={compact} now={now} onOpen={setSelected} onPickDay={(d) => pickDay(d, true)} />
  ) : (
    <TimeGridView days={days} events={events} compact={compact} now={now} onOpen={setSelected} onPickDay={(d) => pickDay(d, view === 'week')} onCreateAt={(s, allDay) => openCreate(s, allDay)} />
  );

  return (
    <div className={`relative ${compact ? '-mt-4' : '-mt-6'}`}>
      {header}
      <div className={`flex gap-6 ${compact ? 'pt-3' : 'pt-5'}`}>
        {sidebar && (
          <aside className="sticky flex w-[256px] shrink-0 flex-col gap-5 self-start" style={{ top: top + 80 }}>
            {canCreate && (
              <button type="button" onClick={() => openCreate()} className="flex h-14 w-fit items-center gap-3 rounded-2xl border-0 bg-white pl-4 pr-6 text-[15px] font-bold text-basil-deep shadow-[0_6px_20px_rgba(10,47,92,0.14)] transition hover:shadow-card">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-basil text-white"><Plus size={20} /></span>Create
              </button>
            )}
            <div className="rounded-3xl border border-basil-line bg-white p-3"><MiniMonth cursor={cursor} now={now} events={events} onPick={(d) => pickDay(d)} /></div>
            <div className="rounded-3xl border border-basil-line bg-white p-2"><LayerList layers={available} enabled={visibleLayers} onToggle={toggleLayer} onlyMine={onlyMine} setOnlyMine={setOnlyMine} /></div>
          </aside>
        )}
        <div className="min-w-0 flex-1">
          {error && <div className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">Some calendars could not load: {error}</div>}
          {loading && !all.length ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-basil" size={30} /></div>
          ) : (
            <AnimatePresence mode="wait" initial={false} custom={dir}>
              <motion.div
                key={searching ? 'search' : `${view}:${periodKey}`}
                custom={dir}
                initial={{ opacity: 0, x: dir * 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: dir * -28 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                drag={compact && view === 'month' && !searching ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.25}
                dragDirectionLock
                onDragEnd={(_, info) => { if (info.offset.x < -60) step(1); else if (info.offset.x > 60) step(-1); }}
                className={compact && view === 'month' ? 'touch-pan-y' : undefined}
              >
                {body}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {canCreate && (
        <div className={`pointer-events-none fixed inset-x-0 z-30 ${variant === 'phone' ? 'mx-auto max-w-xl px-4' : 'px-4 sm:px-6'} flex justify-end ${sidebar ? 'hidden' : ''}`}
          style={{ bottom: variant === 'phone' ? 'calc(100px + env(safe-area-inset-bottom))' : 'calc(20px + env(safe-area-inset-bottom))' }}>
          <motion.button type="button" whileTap={{ scale: 0.92 }} onClick={() => openCreate()} aria-label="New event"
            className="pointer-events-auto flex h-14 items-center gap-2 rounded-2xl border-0 bg-basil pl-4 pr-5 text-[15px] font-bold text-white shadow-[0_12px_28px_rgba(15,110,194,0.45)] hover:bg-basil-deep">
            <Plus size={22} strokeWidth={2.4} />{compact ? '' : 'New event'}
          </motion.button>
        </div>
      )}

      <EventSheet ev={selected} onClose={() => setSelected(null)} canEdit={canEdit(selected)} onEdit={() => selected && openEdit(selected)} onDelete={remove} />
      <DaySheet day={moreDay} events={moreDay ? eventsOn(events, moreDay) : []} onClose={() => setMoreDay(null)} renderRow={(e, d) => <EventRow e={e} day={d} onOpen={setSelected} />} />
      <Sheet open={layersOpen} onClose={() => setLayersOpen(false)} title="Calendars">
        <LayerList layers={available} enabled={visibleLayers} onToggle={toggleLayer} onlyMine={onlyMine} setOnlyMine={setOnlyMine} counts={counts} />
      </Sheet>
      <EventForm
        open={form.open}
        initial={form.draft}
        editing={!!form.editId}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        onSave={save}
        projects={(sources.projects ?? []).map((p) => ({ id: String(p.id), name: String(p.name), client_id: (p.client_id as string) ?? null }))}
        clients={(sources.clients ?? []).map((c) => ({ id: String(c.id), name: String(c.name) }))}
      />
    </div>
  );
}

/** The calendar for the phone app (/app): drop it into the main column under the 56px header. */
export function CalendarPhone() {
  return <CalendarApp variant="phone" stickyTop={56} />;
}
