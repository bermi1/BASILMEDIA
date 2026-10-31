import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, ExternalLink, ImagePlus, Images, Inbox, Loader2, QrCode, RotateCcw, Users, Video } from 'lucide-react';
import { useRows, useSettings } from '@/hooks/useData';
import { resetDemo, save, saveSettings, remove } from '@/lib/db';
import { uploadFile } from '@/lib/storage';
import { isDemo } from '@/lib/supabase';
import { fmtDate } from '@/lib/format';
import type { Booking, Gallery, SiteSettings, Stat, Subscriber } from '@/lib/types';
import { FieldInput, type Field } from './fields';
import { ResourceManager, IconBtn } from './ResourceManager';
import { PageTitle } from '../OsLayout';
import { useToast } from './toast';

export function CmsOverview() {
  const counts = {
    projects: useRows('projects_public').rows.length,
    partners: useRows('partners').rows.length,
    highlights: useRows('highlights').rows.length,
    team: useRows('team').rows.length,
    galleries: useRows('galleries').rows.length,
    news: useRows('news_stories').rows.length,
  };
  const { rows: bookings } = useRows('bookings');
  const toast = useToast();
  const cards: [string, number, string][] = [
    ['Projects', counts.projects, '/os/website/projects'], ['Partners', counts.partners, '/os/website/partners'], ['Highlights', counts.highlights, '/os/website/highlights'],
    ['Team', counts.team, '/os/website/team'], ['Galleries', counts.galleries, '/os/website/galleries'], ['News stories', counts.news, '/os/website/news'],
    ['Bookings', bookings.length, '/os/website/bookings'],
  ];
  return (
    <>
      <PageTitle tag="WEBSITE CMS" title="Overview" sub="Everything on the public website — words, pictures, videos and links — is edited here.">
        <a href="/" target="_blank" rel="noreferrer" className="btn-outline"><ExternalLink size={16} />Open website</a>
      </PageTitle>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {cards.map(([l, n, to]) => (
          <Link key={l} to={to} className="card p-4 text-basil-ink no-underline hover:shadow-card"><div className="font-display text-3xl font-extrabold">{n}</div><div className="text-sm text-basil-muted">{l}</div></Link>
        ))}
      </div>
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between"><h2 className="m-0 text-lg font-extrabold">Recent bookings</h2><Link to="/os/website/bookings" className="text-sm font-bold">All bookings →</Link></div>
        <ul className="m-0 flex list-none flex-col divide-y divide-basil-line p-0">
          {bookings.slice(0, 6).map((b) => <li key={b.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span><b>{b.name}</b> · {b.service}</span><span className="text-basil-muted">{b.contact} · {fmtDate(b.created_at)}</span></li>)}
          {!bookings.length && <li className="py-3 text-sm text-basil-muted">No bookings yet. They appear here as soon as someone sends the form.</li>}
        </ul>
      </div>
      {isDemo && (
        <div className="mt-6 rounded-2xl bg-amber-50 p-5 text-sm text-amber-900">
          <b>Demo mode.</b> Content is saved in this browser only. Connect Supabase (see README) so edits go live for every visitor.
          <button type="button" onClick={() => { if (confirm('Reset all demo content to the starter set?')) { resetDemo(); toast('Demo content reset'); } }} className="ml-3 inline-flex items-center gap-1 border-0 bg-transparent font-bold text-amber-900 underline"><RotateCcw size={14} />Reset demo content</button>
        </div>
      )}
    </>
  );
}

const GROUPS: { title: string; fields: Field[] }[] = [
  { title: 'Hero (home page top)', fields: [
    { key: 'hero_kicker', label: 'Small kicker text', type: 'text', wide: true },
    { key: 'tagline', label: 'Tagline (first part)', type: 'text' },
    { key: 'tagline_highlight', label: 'Tagline (highlighted part)', type: 'text' },
    { key: 'hero_subtitle', label: 'Subtitle', type: 'textarea' },
    { key: 'hero_image_url', label: 'Hero background picture', type: 'image', folder: 'site' },
    { key: 'live_ticker', label: 'Live ticker card', type: 'text', wide: true, help: 'e.g. “Gallery delivered · Tanzania Health Summit · 2,431 photos”. Leave empty to hide.' },
    { key: 'services_mega_image_url', label: 'Services menu feature picture', type: 'image', folder: 'site' },
  ] },
  { title: 'Brand', fields: [
    { key: 'logo_url', label: 'Logo (on light backgrounds)', type: 'image', folder: 'brand' },
    { key: 'logo_reverse_url', label: 'Logo (on dark backgrounds)', type: 'image', folder: 'brand' },
  ] },
  { title: 'About us', fields: [
    { key: 'about_story', label: 'Company story', type: 'textarea' },
    { key: 'about_image_url', label: 'About picture', type: 'image', folder: 'site' },
    { key: 'mission', label: 'Mission', type: 'textarea' },
    { key: 'vision', label: 'Vision', type: 'textarea' },
    { key: 'company_profile_url', label: 'Company profile (PDF)', type: 'file', folder: 'documents' },
    { key: 'footer_about', label: 'Footer about text', type: 'textarea' },
  ] },
  { title: 'Contact', fields: [
    { key: 'contact_email', label: 'Email', type: 'text' },
    { key: 'phone', label: 'Phone', type: 'text' },
    { key: 'whatsapp', label: 'WhatsApp number', type: 'text', help: 'International format, e.g. +255712345678' },
    { key: 'address', label: 'Office address', type: 'text' },
    { key: 'map_embed_url', label: 'Google Maps embed URL (optional)', type: 'url', wide: true, help: 'Leave empty to place the pin from the address.' },
  ] },
];
const SOCIAL_KEYS = ['instagram', 'youtube', 'facebook', 'linkedin', 'tiktok', 'x'] as const;

export function SettingsCms() {
  const live = useSettings();
  const [d, setD] = useState<SiteSettings>(live);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => setD(live), [live]);
  const commit = async () => {
    setBusy(true);
    try {
      await saveSettings(d);
      toast('Settings saved ✓');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const setStat = (i: number, patch: Partial<Stat>) => setD({ ...d, stats: d.stats.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  return (
    <>
      <PageTitle tag="WEBSITE · SETTINGS" title="Site settings" sub="Tagline, pictures, contacts, social accounts and numbers.">
        <button type="button" onClick={commit} disabled={busy} className="btn-primary">{busy && <Loader2 size={16} className="animate-spin" />}Save all</button>
      </PageTitle>
      <div className="flex flex-col gap-5">
        {GROUPS.map((g) => (
          <section key={g.title} className="card p-5">
            <h2 className="m-0 mb-4 text-lg font-extrabold">{g.title}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {g.fields.map((f) => (
                <div key={f.key} className={`flex flex-col gap-1.5 ${f.wide || ['textarea', 'image', 'file'].includes(f.type) ? 'md:col-span-2' : ''}`}>
                  <span className="text-sm font-bold text-[#33465F]">{f.label}</span>
                  <FieldInput f={f} value={(d as unknown as Record<string, unknown>)[f.key]} onChange={(v) => setD({ ...d, [f.key]: v })} />
                  {f.help && <span className="text-xs text-basil-muted">{f.help}</span>}
                </div>
              ))}
            </div>
          </section>
        ))}
        <section className="card p-5">
          <h2 className="m-0 mb-4 text-lg font-extrabold">Social media</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {SOCIAL_KEYS.map((k) => (
              <label key={k} className="flex flex-col gap-1.5 text-sm font-bold capitalize text-[#33465F]">{k === 'x' ? 'X (Twitter)' : k}
                <input className="h-11 rounded-xl border border-basil-edge px-3 font-normal" value={d.socials?.[k] ?? ''} onChange={(e) => setD({ ...d, socials: { ...d.socials, [k]: e.target.value } })} placeholder={`https://${k === 'x' ? 'x' : k}.com/basilmedia`} />
              </label>
            ))}
          </div>
          <p className="mb-0 mt-3 text-xs text-basil-muted">Leave a link empty to hide that icon.</p>
        </section>
        <section className="card p-5">
          <h2 className="m-0 mb-4 text-lg font-extrabold">Stats band</h2>
          <div className="flex flex-col gap-2">
            {d.stats.map((s, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <input aria-label="Number" type="number" className="h-11 w-28 rounded-xl border border-basil-edge px-3" value={s.value} onChange={(e) => setStat(i, { value: Number(e.target.value) })} />
                <input aria-label="Suffix" className="h-11 w-20 rounded-xl border border-basil-edge px-3" value={s.suffix ?? ''} onChange={(e) => setStat(i, { suffix: e.target.value })} placeholder="+" />
                <input aria-label="Label" className="h-11 min-w-0 flex-1 rounded-xl border border-basil-edge px-3" value={s.label} onChange={(e) => setStat(i, { label: e.target.value })} />
                <button type="button" onClick={() => setD({ ...d, stats: d.stats.filter((_, j) => j !== i) })} className="btn-outline h-11 min-h-0 text-red-700">Remove</button>
              </div>
            ))}
            <button type="button" onClick={() => setD({ ...d, stats: [...d.stats, { value: 0, suffix: '', label: 'new stat' }] })} className="btn-outline self-start">Add stat</button>
          </div>
        </section>
        <button type="button" onClick={commit} disabled={busy} className="btn-primary self-start">{busy && <Loader2 size={16} className="animate-spin" />}Save all</button>
      </div>
    </>
  );
}

const STATUSES: Booking['status'][] = ['new', 'contacted', 'won', 'lost', 'archived'];
export function BookingsCms() {
  const { rows } = useRows('bookings');
  const [filter, setFilter] = useState<string>('all');
  const toast = useToast();
  const shown = rows.filter((b) => filter === 'all' || b.status === filter);
  return (
    <>
      <PageTitle tag="WEBSITE · LEADS" title="Bookings & enquiries" sub="Booking form, contact form and gallery selections." >
        <button type="button" className="btn-outline" onClick={() => downloadCsv('bookings.csv', rows as unknown as Record<string, unknown>[])}><Download size={16} />Export CSV</button>
      </PageTitle>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {['all', ...STATUSES].map((s) => <button key={s} type="button" aria-pressed={filter === s} onClick={() => setFilter(s)} className={`rounded-full px-3.5 py-2 text-sm font-semibold capitalize ${filter === s ? 'border-0 bg-basil text-white' : 'border border-basil-edge bg-white text-basil-deep'}`}>{s} <span className="opacity-60">{s === 'all' ? rows.length : rows.filter((b) => b.status === s).length}</span></button>)}
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {shown.map((b) => (
          <li key={b.id} className="flex flex-wrap items-start gap-3 rounded-2xl border border-basil-line bg-white p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-basil-ice text-basil"><Inbox size={18} /></span>
            <div className="min-w-0 flex-[1_1_260px]">
              <div className="font-bold">{b.name} <span className="font-normal text-basil-muted">· {b.service}</span></div>
              <div className="text-sm"><a href={b.contact.includes('@') ? `mailto:${b.contact}` : `tel:${b.contact}`}>{b.contact}</a> · {b.source}{b.preferred_date ? ` · wants ${fmtDate(b.preferred_date)}` : ''} · received {fmtDate(b.created_at)}</div>
              {b.message && <p className="mb-0 mt-1.5 whitespace-pre-line text-sm text-basil-muted">{b.message}</p>}
            </div>
            <label className="sr-only" htmlFor={`st-${b.id}`}>Status</label>
            <select id={`st-${b.id}`} value={b.status} onChange={(e) => save('bookings', { id: b.id, status: e.target.value as Booking['status'] }).then(() => toast('Status updated'))} className="h-10 rounded-xl border border-basil-edge bg-white px-2 text-sm capitalize">
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <IconBtn label="Delete" danger onClick={() => confirm('Delete this booking?') && remove('bookings', b.id)}>✕</IconBtn>
          </li>
        ))}
        {!shown.length && <li className="rounded-2xl border border-dashed border-basil-edge bg-white p-10 text-center text-basil-muted">No bookings here yet.</li>}
      </ul>
    </>
  );
}

export function SubscribersCms() {
  const { rows } = useRows('subscribers');
  const toast = useToast();
  const set = (s: Subscriber, status: Subscriber['status']) => save('subscribers', { id: s.id, status }).then(() => toast('Updated'));
  return (
    <>
      <PageTitle tag="AUDIENCE · SUBSCRIBERS" title="Subscribers" sub={`${rows.length} people · ${rows.filter((r) => r.status === 'active').length} active`}>
        <button type="button" className="btn-outline" onClick={() => downloadCsv('subscribers.csv', rows as unknown as Record<string, unknown>[])}><Download size={16} />Export CSV</button>
      </PageTitle>
      <div className="overflow-x-auto rounded-2xl border border-basil-line bg-white">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="bg-basil-mist text-left text-xs uppercase tracking-wider text-basil-muted"><tr>{['Name', 'Specialties', 'Region', 'Contact', 'Channel', 'Joined', 'Status'].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-basil-line">
                <td className="p-3 font-bold">{s.title} {s.full_name || '—'}<div className="text-xs font-normal text-basil-muted">{s.institution}</div></td>
                <td className="p-3">{s.specialties?.join(', ')}</td>
                <td className="p-3">{s.region}</td>
                <td className="p-3">{s.phone || s.email}</td>
                <td className="p-3 uppercase">{s.channel} · {s.language}</td>
                <td className="p-3">{fmtDate(s.created_at)}</td>
                <td className="p-3">
                  <select aria-label="Status" value={s.status} onChange={(e) => set(s, e.target.value as Subscriber['status'])} className="h-9 rounded-lg border border-basil-edge bg-white px-2">
                    {['pending', 'active', 'paused', 'unsubscribed'].map((x) => <option key={x}>{x}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="p-10 text-center text-basil-muted"><Users className="mx-auto mb-2 text-basil-edge" />No subscribers yet. Share the <a href="/subscribe">/subscribe</a> page or its QR code at your next event.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-basil-muted">Personal data is handled under the Tanzania Personal Data Protection Act, 2022. Please have a lawyer confirm the final consent wording.</p>
    </>
  );
}

export function GalleriesCms() {
  const [managing, setManaging] = useState<Gallery | null>(null);
  if (managing) return <GalleryMedia g={managing} onBack={() => setManaging(null)} />;
  return (
    <ResourceManager
      table="galleries" tag="DELIVERY · GALLERIES" title="Galleries" sub="Client and event photo galleries at /g/your-link." publishable
      fields={[
        { key: 'title', label: 'Title', type: 'text', required: true },
        { key: 'slug', label: 'Link (/g/…)', type: 'text', required: true, help: 'Lower case and dashes, e.g. health-summit-2026' },
        { key: 'client_name', label: 'Client', type: 'text' },
        { key: 'event_date', label: 'Event date', type: 'date' },
        { key: 'location', label: 'Location', type: 'text' },
        { key: 'expires_on', label: 'Open until', type: 'date' },
        { key: 'access_mode', label: 'Access', type: 'select', options: ['public', 'link', 'pin'] },
        { key: 'pin', label: 'New PIN (for PIN access)', type: 'text', help: 'Stored encrypted and never shown again. Leave blank to keep the current PIN.' },
        { key: 'selection_limit', label: 'Album selection limit (0 = off)', type: 'number' },
        { key: 'allow_downloads', label: 'Allow downloads', type: 'boolean' },
        { key: 'face_search_enabled', label: 'Find Me (face search)', type: 'boolean', help: 'Off by default. Never for children or schools without the organiser’s written consent.' },
        { key: 'published', label: 'Published', type: 'boolean' },
        { key: 'collections', label: 'Collections', type: 'list' },
        { key: 'cover_url', label: 'Cover picture', type: 'image', folder: 'galleries' },
      ]}
      blank={() => ({ title: '', slug: '', client_name: '', event_date: new Date().toISOString().slice(0, 10), location: 'Dar es Salaam', cover_url: '', collections: ['Highlights'], access_mode: 'link' as const, pin: '', expires_on: new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10), allow_downloads: true, selection_limit: 0, face_search_enabled: false, published: true })}
      summary={(r) => [r.title, `/g/${r.slug} · ${r.access_mode} · open until ${fmtDate(r.expires_on)}`]}
      thumb={(r) => r.cover_url}
      extraActions={(r) => (
        <div className="flex gap-1">
          <button type="button" onClick={() => setManaging(r)} className="btn-outline h-9 min-h-0 px-3 text-sm"><Images size={15} />Photos</button>
          <a href={`https://api.qrserver.com/v1/create-qr-code/?size=1200x1200&margin=20&data=${encodeURIComponent(`${location.origin}/g/${r.slug}`)}`} target="_blank" rel="noreferrer" className="flex h-9 w-9 items-center justify-center rounded-lg border border-basil-line text-basil-deep" aria-label="QR code poster" title="QR code"><QrCode size={16} /></a>
        </div>
      )}
    />
  );
}

function GalleryMedia({ g, onBack }: { g: Gallery; onBack: () => void }) {
  const { rows } = useRows('media_items', { eq: { gallery_id: g.id } });
  const [collection, setCollection] = useState(g.collections[0] ?? '');
  const [queue, setQueue] = useState<{ name: string; pct: number; err?: string }[]>([]);
  const ref = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const uploadAll = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    setQueue(list.map((f) => ({ name: f.name, pct: 0 })));
    let order = Math.max(0, ...rows.map((r) => r.sort_order));
    let i = 0;
    // Three uploads at a time keeps weak connections stable.
    const worker = async () => {
      while (i < list.length) {
        const idx = i++;
        const f = list[idx];
        try {
          const url = await uploadFile(f, `galleries/${g.slug}`, (pct) => setQueue((q) => q.map((x, j) => (j === idx ? { ...x, pct } : x))));
          await save('media_items', { gallery_id: g.id, kind: f.type.startsWith('video/') ? 'video' : 'photo', url, thumb_url: '', collection, caption: f.name.replace(/\.[^.]+$/, ''), sort_order: ++order });
          setQueue((q) => q.map((x, j) => (j === idx ? { ...x, pct: 100 } : x)));
        } catch (e) {
          setQueue((q) => q.map((x, j) => (j === idx ? { ...x, err: (e as Error).message } : x)));
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    toast(`${list.length} file(s) processed`);
  };

  return (
    <>
      <PageTitle tag="DELIVERY · GALLERY PHOTOS" title={g.title} sub={`${rows.length} items · /g/${g.slug}`}>
        <div className="flex gap-2">
          <button type="button" className="btn-outline" onClick={onBack}>← All galleries</button>
          <a className="btn-outline" href={`/g/${g.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={16} />View</a>
        </div>
      </PageTitle>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => (e.preventDefault(), uploadAll(e.dataTransfer.files))}
        className="mb-5 flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-basil-edge bg-white p-8 text-center"
      >
        <ImagePlus size={36} className="text-basil" />
        <b>Drag photos and videos here, or choose files</b>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <label className="text-sm font-bold text-[#33465F]">Into collection{' '}
            <select value={collection} onChange={(e) => setCollection(e.target.value)} className="h-10 rounded-xl border border-basil-edge bg-white px-2">{g.collections.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <input ref={ref} type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => uploadAll(e.target.files)} />
          <button type="button" className="btn-primary" onClick={() => ref.current?.click()}>Choose files</button>
        </div>
        {isDemo && <span className="text-xs text-amber-800">Demo mode: files under 1.5 MB only. Connect storage for full-size uploads.</span>}
      </div>
      {queue.length > 0 && (
        <ul className="mb-5 grid list-none gap-1.5 p-0 sm:grid-cols-2">
          {queue.map((q, i) => (
            <li key={i} className="rounded-xl bg-white p-2.5 text-xs">
              <div className="flex justify-between gap-2"><span className="truncate">{q.name}</span><span className={q.err ? 'text-red-700' : 'text-basil-muted'}>{q.err ? 'failed' : `${q.pct}%`}</span></div>
              <div className="mt-1 h-1 rounded bg-basil-line"><div className={`h-1 rounded ${q.err ? 'bg-red-600' : 'bg-basil'}`} style={{ width: `${q.err ? 100 : q.pct}%` }} /></div>
              {q.err && <div className="mt-1 text-red-700">{q.err}</div>}
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {rows.map((m) => (
          <div key={m.id} className="overflow-hidden rounded-2xl border border-basil-line bg-white">
            <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-basil-bright to-basil-deep">
              {m.url ? (m.kind === 'video' ? <Video className="text-white" /> : <img src={m.url} alt={m.caption} loading="lazy" className="h-full w-full object-cover" />) : <span className="text-xs text-white/70">placeholder</span>}
            </div>
            <div className="flex flex-col gap-1.5 p-2">
              <select aria-label="Collection" value={m.collection} onChange={(e) => save('media_items', { id: m.id, collection: e.target.value })} className="h-8 rounded-lg border border-basil-edge bg-white px-1 text-xs">{g.collections.map((c) => <option key={c}>{c}</option>)}</select>
              <div className="flex gap-1">
                <button type="button" onClick={() => save('galleries', { id: g.id, cover_url: m.url }).then(() => toast('Cover set'))} disabled={!m.url} className="h-8 flex-1 rounded-lg border border-basil-edge bg-white text-xs font-bold text-basil-deep disabled:opacity-40">Set cover</button>
                <IconBtn label="Delete" danger onClick={() => confirm('Delete this item?') && remove('media_items', m.id)}>✕</IconBtn>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(Array.isArray(v) ? v.join('; ') : v ?? '').replace(/"/g, '""')}"`;
  const csv = [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
