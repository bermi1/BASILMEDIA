// Demo seed for custom calendar events (demo mode only). Dates are relative to today.
import { registerSeed, type Row } from '@/os/lib/store';

const at = (days: number, hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, h, m).toISOString();
};
// Monday of this week + n days (weekly rituals land on a sensible weekday).
const mon = (n: number) => -((new Date().getDay() + 6) % 7) + n;
const created_at = new Date(Date.now() - 5 * 864e5).toISOString();

const ev = (id: string, title: string, start: string, end: string, extra: Partial<Record<string, unknown>> = {}) => ({
  id, title, starts_at: start, ends_at: end, all_day: false, description: '', location: '', color: '', project_id: null, client_id: null,
  attendees: [] as string[], visibility: 'staff', created_by: 'u-boss', created_at, ...extra,
});

registerSeed('calendar_events', () => [
  ev('ce-standup', 'Monday team stand-up', at(mon(0), '08:30'), at(mon(0), '09:15'), {
    location: 'Boardroom, Basil Media office, Mikocheni', description: 'Week plan: shoots, edits, deliveries and who needs the van.',
    attendees: ['u-gm', 'u-enock', 'u-jonathan', 'u-benedicto', 'u-store', 'u-growth', 'u-driver'], created_by: 'u-gm',
  }),
  ev('ce-standup-next', 'Monday team stand-up', at(mon(7), '08:30'), at(mon(7), '09:15'), {
    location: 'Boardroom, Basil Media office, Mikocheni', attendees: ['u-gm', 'u-enock', 'u-jonathan', 'u-benedicto', 'u-store', 'u-growth', 'u-driver'], created_by: 'u-gm',
  }),
  ev('ce-hospital-review', 'Monthly review · National Referral Hospital', at(2, '10:00'), at(2, '11:00'), {
    location: 'National Referral Hospital, Upanga', description: 'Review last month’s care stories and agree next month’s shoot list.',
    client_id: 'c-hospital', project_id: 'p-hospital', attendees: ['u-growth', 'u-jonathan', 'u-client'], visibility: 'everyone', created_by: 'u-growth', color: '#0D9488',
  }),
  ev('ce-cement-ppm', 'Pre-production meeting · Plant safety film', at(1, '14:00'), at(1, '15:30'), {
    location: 'Boardroom, Basil Media office, Mikocheni', project_id: 'p-cement', client_id: 'c-cement', attendees: ['u-benedicto', 'u-enock', 'u-store'], created_by: 'u-benedicto',
  }),
  ev('ce-holiday', 'Office closed · Public holiday', at(9, '00:00'), at(9, '00:00'), {
    all_day: true, visibility: 'everyone', description: 'No shoots booked. Reception closed.', color: '#E11D48',
  }),
  ev('ce-gear-day', 'Gear service day', at(4, '09:00'), at(4, '16:00'), {
    location: 'Media store, Basil Media office', description: 'Sensor cleaning, firmware updates, battery health check.', attendees: ['u-store'], created_by: 'u-store', color: '#D97706',
  }),
  ev('ce-showreel', 'Showreel 2026 screening', at(6, '16:00'), at(6, '17:30'), {
    location: 'Podcast studio, Basil Media office', attendees: ['u-boss', 'u-gm', 'u-enock', 'u-jonathan', 'u-benedicto', 'u-growth'],
  }),
  ev('ce-boss-1to1', '1:1 · Emmanuel & Saul', at(3, '11:30'), at(3, '12:00'), { attendees: ['u-gm'], visibility: 'private', color: '#475569' }),
  ev('ce-training', 'Drone safety refresher', at(-3, '09:00'), at(-2, '13:00'), {
    location: 'Kawe beach field', description: 'Two-day refresher for licensed pilots.', attendees: ['u-benedicto', 'u-jonathan'], created_by: 'u-enock', color: '#16A34A',
  }),
] as unknown as Row[]);
