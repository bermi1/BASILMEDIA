const TZ = 'Africa/Dar_es_Salaam';

/** DD/MM/YYYY in Dar es Salaam time. */
export function fmtDate(d?: string | Date | null) {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d.length === 10 ? `${d}T12:00:00` : d) : d;
  return date.toLocaleDateString('en-GB', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
}
export function fmtDateLong(d?: string | null) {
  if (!d) return '';
  return new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
export function fmtTsh(n: number) {
  return `TSH ${Math.round(n).toLocaleString('en-GB')}`;
}
/** Normalise Tanzanian numbers to +255XXXXXXXXX (07xx / 06xx / 255… / +255…). */
export function normaliseTzPhone(raw: string) {
  const d = raw.replace(/[^\d+]/g, '');
  if (/^\+255[67]\d{8}$/.test(d)) return d;
  if (/^255[67]\d{8}$/.test(d)) return `+${d}`;
  if (/^0[67]\d{8}$/.test(d)) return `+255${d.slice(1)}`;
  return null;
}
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
export function waLink(phone: string, text = '') {
  return `https://wa.me/${phone.replace(/[^\d]/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
