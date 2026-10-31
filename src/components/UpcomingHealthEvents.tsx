// Upcoming health events (added by an admin in Website CMS → Events) — each links to the event's own site.
import { CalendarPlus, ExternalLink, MapPin } from 'lucide-react';
import { useRows } from '@/hooks/useData';

function ics(title: string, date: string, where: string) {
  const d = date.replace(/-/g, '');
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Basil Media//Health Events//EN', 'BEGIN:VEVENT', `UID:${d}-${title.length}@basilmedia`, `DTSTART;VALUE=DATE:${d}`, `SUMMARY:${title}`, `LOCATION:${where}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(body)}`;
}

export function UpcomingHealthEvents() {
  const { rows } = useRows('events', { publishedOnly: true });
  const today = new Date().toISOString().slice(0, 10);
  const list = rows.filter((e) => e.starts_on >= today && (e.sector || 'Health') === 'Health').sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  return (
    <section aria-labelledby="ev-h">
      <h2 id="ev-h" className="m-0 mb-3 text-2xl font-extrabold">Upcoming health events</h2>
      {!list.length ? (
        <p className="m-0 rounded-2xl bg-basil-mist p-4 text-sm text-basil-muted">New conferences and CPD events appear here as soon as they are announced.</p>
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
          {list.map((e) => {
            const d = new Date(e.starts_on + 'T00:00:00');
            return (
              <li key={e.id} className="flex gap-3.5 rounded-2xl border border-basil-line bg-white p-4">
                <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-basil text-white">
                  <b className="font-display text-xl leading-none">{d.getDate()}</b>
                  <span className="text-[11px] font-bold uppercase">{d.toLocaleDateString('en-GB', { month: 'short' })}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block leading-snug">{e.title}</b>
                  {e.venue && <span className="mt-0.5 flex items-center gap-1 text-[13px] text-basil-muted"><MapPin size={13} className="shrink-0" />{e.venue}</span>}
                  {e.cpd && <span className="mt-1 inline-block rounded-full bg-basil-ice px-2 py-0.5 text-[11px] font-bold text-basil-deep">CPD · {e.cpd}</span>}
                  <span className="mt-2 flex flex-wrap gap-3 text-sm font-bold">
                    {e.link && <a href={e.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 no-underline">Visit site <ExternalLink size={13} /></a>}
                    <a href={ics(e.title, e.starts_on, e.venue)} download={`${e.title.slice(0, 40)}.ics`} className="inline-flex items-center gap-1 text-basil-muted no-underline hover:text-basil"><CalendarPlus size={14} />Add to calendar</a>
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
