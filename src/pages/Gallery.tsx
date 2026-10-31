import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ChevronLeft, ChevronRight, Columns3, Download, Heart, LayoutGrid, Lock, ScanFace, Send, Share2, X } from 'lucide-react';
import { galleryMedia, get, submit } from '@/lib/db';
import { fmtDate, fmtDateLong, waLink } from '@/lib/format';
import type { Gallery as G, MediaItem } from '@/lib/types';
import { useSeo } from '@/hooks/useSeo';
import { gradient } from '@/components/Media';

const favKey = (slug: string) => `basil-favs-${slug}`;

export default function Gallery() {
  const { slug = '' } = useParams();
  const [g, setG] = useState<G | null | undefined>(undefined);
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [pin, setPin] = useState('');
  const [pinErr, setPinErr] = useState('');
  const [tab, setTab] = useState('All');
  const [layout, setLayout] = useState<'grid' | 'strip'>('grid');
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [favs, setFavs] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(favKey(slug)) ?? '[]'); } catch { return []; }
  });
  const [open, setOpen] = useState<number | null>(null);
  const [sheet, setSheet] = useState<'send' | 'share' | null>(null);
  useSeo(g?.title ?? 'Gallery', g ? `${g.title} — photos delivered by Basil Media.` : undefined);

  useEffect(() => {
    get('galleries', 'slug', slug).then((x) => setG(x && x.published ? x : null)).catch(() => setG(null));
  }, [slug]);
  useEffect(() => {
    if (g && g.access_mode !== 'pin') galleryMedia(g.id, g.slug).then(setItems).catch(() => setItems([]));
  }, [g]);
  useEffect(() => {
    try { localStorage.setItem(favKey(slug), JSON.stringify(favs)); } catch { /* private mode */ }
  }, [favs, slug]);

  const shown = useMemo(() => (items ?? []).filter((m) => (tab === 'All' || m.collection === tab) && (!onlyFavs || favs.includes(m.id))), [items, tab, onlyFavs, favs]);
  const expired = g?.expires_on && g.expires_on < new Date().toISOString().slice(0, 10);
  const limit = g?.selection_limit || 0;
  const toggleFav = (id: string) => setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : limit && f.length >= limit ? f : [...f, id]));

  useEffect(() => {
    if (open === null) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') setOpen((o) => (o === null ? o : (o + 1) % shown.length));
      if (e.key === 'ArrowLeft') setOpen((o) => (o === null ? o : (o - 1 + shown.length) % shown.length));
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [open, shown.length]);

  if (g === undefined) return <div className="container-bm py-24 text-basil-muted">Opening gallery…</div>;
  if (!g) return <div className="container-bm py-24"><h1>Gallery not found</h1><p className="text-basil-muted">Check the link or QR code, or ask the Basil Media team.</p><Link to="/find-me">Find my photos</Link></div>;
  if (expired) return <div className="container-bm py-24"><h1>This gallery has closed</h1><p className="text-basil-muted">It was open until {fmtDate(g.expires_on)}. Contact Basil Media to reopen it.</p><Link to="/contact">Contact us</Link></div>;

  if (g.access_mode === 'pin' && !items) {
    return (
      <section className="flex min-h-[70vh] items-center justify-center p-6" style={{ background: 'linear-gradient(160deg, #0A2F5C, #061E3D)' }}>
        <form onSubmit={async (e) => { e.preventDefault(); try { setItems(await galleryMedia(g.id, g.slug, pin)); } catch { setPinErr('That PIN is not right. Check the message from Basil Media.'); } }} className="flex w-full max-w-sm flex-col gap-4 rounded-[28px] bg-white p-8 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-basil-ice text-basil"><Lock /></span>
          <h1 className="m-0 text-2xl font-extrabold">{g.title}</h1>
          <p className="m-0 text-basil-muted">This gallery is private. Enter the PIN you received.</p>
          <label className="sr-only" htmlFor="pin">Gallery PIN</label>
          <input id="pin" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} className="field-light text-center font-display text-2xl tracking-[0.4em]" placeholder="••••" />
          {pinErr && <p role="alert" className="m-0 text-sm font-bold text-red-700">{pinErr}</p>}
          <button className="btn-primary h-12">Open gallery</button>
        </form>
      </section>
    );
  }

  const cover = g.cover_url || items?.find((m) => m.url)?.url;
  const cur = open !== null ? shown[open] : null;
  const pct = limit ? Math.min(100, (favs.length / limit) * 100) : 0;

  return (
    <>
      <section aria-label="Gallery cover" className="grain relative flex min-h-[460px] items-end overflow-hidden text-white sm:min-h-[560px]" style={{ background: gradient(0) }}>
        {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-basil-night via-basil-night/40 to-transparent" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="container-bm relative pb-10">
          <div className="font-mono text-[11px] tracking-[0.18em] text-basil-haze">CLIENT GALLERY · {location.host.toUpperCase()}/G/{g.slug.toUpperCase()}</div>
          <h1 className="my-3 text-[clamp(40px,6vw,76px)] font-extrabold leading-none">{g.title}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-basil-frost">
            <span>{fmtDateLong(g.event_date)} · {g.location}</span><span>{items?.length ?? 0} photos · {g.collections.length} collections</span>
            <span className="flex items-center gap-1.5"><img src="/logo-reverse.svg" alt="" className="h-5 w-5" />Delivered by Basil Media</span>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#grid" className="flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5 font-bold text-basil-deep no-underline hover:bg-basil-ice">Enter gallery <ArrowDown size={18} /></a>
            {g.face_search_enabled && <Link to={`/find-me?g=${g.slug}`} className="btn-ghost px-6 py-3.5"><ScanFace size={18} /> Find my photos</Link>}
          </div>
        </motion.div>
      </section>

      <div id="grid" className="sticky top-[74px] z-20 scroll-mt-20 border-b border-basil-line bg-white/90 backdrop-blur-xl sm:top-[88px]">
        <div className="container-bm flex flex-wrap items-center justify-between gap-3 py-3">
          <div role="tablist" aria-label="Collections" className="scrollbar-none flex gap-1.5 overflow-x-auto">
            {['All', ...g.collections].map((c) => (
              <button key={c} role="tab" aria-selected={tab === c} type="button" onClick={() => setTab(c)} className={`min-h-[40px] shrink-0 rounded-full px-3.5 text-sm font-semibold ${tab === c ? 'border-0 bg-basil text-white' : 'border border-basil-edge bg-white text-basil-deep'}`}>
                {c} <span className="opacity-60">{(items ?? []).filter((m) => c === 'All' || m.collection === c).length}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Layout" className="flex rounded-xl border border-basil-edge p-0.5">
              <button type="button" aria-pressed={layout === 'grid'} aria-label="Grid" onClick={() => setLayout('grid')} className={`flex h-9 w-9 items-center justify-center rounded-lg border-0 ${layout === 'grid' ? 'bg-basil-ice text-basil' : 'bg-transparent text-basil-muted'}`}><LayoutGrid size={16} /></button>
              <button type="button" aria-pressed={layout === 'strip'} aria-label="Cinematic strip" onClick={() => setLayout('strip')} className={`flex h-9 w-9 items-center justify-center rounded-lg border-0 ${layout === 'strip' ? 'bg-basil-ice text-basil' : 'bg-transparent text-basil-muted'}`}><Columns3 size={16} /></button>
            </div>
            <button type="button" aria-pressed={onlyFavs} onClick={() => setOnlyFavs(!onlyFavs)} className={`flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold ${onlyFavs ? 'border-0 bg-basil text-white' : 'border border-basil-edge bg-white text-basil-deep'}`}><Heart size={16} fill="currentColor" /> Favourites ({favs.length})</button>
            <button type="button" onClick={() => setSheet('share')} className="flex h-10 items-center gap-1.5 rounded-xl border border-basil-edge bg-white px-3 text-sm font-bold text-basil-deep"><Share2 size={16} /> Share</button>
          </div>
        </div>
      </div>

      <main className="container-bm py-8">
        {limit > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-4 rounded-3xl bg-basil-mist p-4 sm:p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-basil"><Heart size={20} fill="currentColor" /></span>
            <div className="min-w-0 flex-[1_1_240px]">
              <div className="font-bold">Choose up to {limit} for your album — {favs.length} chosen</div>
              <div className="text-sm text-basil-muted">{favs.length >= limit ? 'Limit reached. Remove one to add another.' : `${limit - favs.length} left to choose.`}</div>
              <div className="mt-2 h-1.5 rounded-full bg-basil-line"><div className="h-1.5 rounded-full bg-basil transition-all" style={{ width: `${pct}%` }} /></div>
            </div>
            <button type="button" disabled={!favs.length} onClick={() => setSheet('send')} className="btn-primary disabled:opacity-50"><Send size={18} /> Send my selection</button>
          </div>
        )}
        {onlyFavs && !shown.length && <div className="rounded-3xl border border-dashed border-basil-edge p-10 text-center"><b>No favourites yet</b><p className="mb-0 text-basil-muted">Tap the heart on any photo to add it to your album selection.</p></div>}
        {layout === 'grid' ? (
          <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
            {shown.map((m, i) => <Tile key={m.id} m={m} i={i} fav={favs.includes(m.id)} onOpen={() => setOpen(i)} onFav={() => toggleFav(m.id)} tall={i % 3 === 0} />)}
          </div>
        ) : (
          <div className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4">
            {shown.map((m, i) => <div key={m.id} className="w-[78vw] max-w-[640px] shrink-0 snap-center"><Tile m={m} i={i} fav={favs.includes(m.id)} onOpen={() => setOpen(i)} onFav={() => toggleFav(m.id)} wide /></div>)}
          </div>
        )}
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-basil-line p-6"><div className="kicker">GALLERY OPEN UNTIL</div><div className="my-1 font-display text-2xl font-extrabold">{fmtDate(g.expires_on)}</div><div className="text-sm text-basil-muted">Download your favourites before then. Your album selection locks once you send it.</div></div>
          <div className="rounded-3xl bg-basil-mist p-6"><div className="kicker">PRINTS &amp; ALBUMS</div><div className="my-1 font-display text-xl font-extrabold">Lay-flat albums and prints</div><div className="text-sm text-basil-muted">Ask the team for album and print options printed in Dar es Salaam.</div></div>
          <div className="rounded-3xl bg-basil p-6 text-white"><div className="font-mono text-xs tracking-[0.18em] text-basil-frost">CAN’T FIND YOURSELF?</div><div className="my-1 font-display text-xl font-extrabold">Search by selfie</div><Link to={`/find-me?g=${g.slug}`} className="mt-2 inline-flex rounded-xl bg-white px-4 py-2.5 font-bold text-basil no-underline">Find my photos</Link></div>
        </div>
      </main>

      <AnimatePresence>
        {cur && open !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label={cur.caption} className="fixed inset-0 z-50 flex flex-col bg-basil-night/95 backdrop-blur-md">
            <div className="flex items-center justify-between p-3 text-white">
              <span className="text-sm text-basil-haze">{open + 1} / {shown.length} · {cur.caption}</span>
              <div className="flex gap-2">
                <button type="button" aria-label="Favourite" aria-pressed={favs.includes(cur.id)} onClick={() => toggleFav(cur.id)} className="flex h-11 w-11 items-center justify-center rounded-full border-0 bg-white/10 text-white"><Heart size={20} fill={favs.includes(cur.id) ? 'currentColor' : 'none'} /></button>
                {g.allow_downloads && cur.url && <a href={cur.url} download aria-label="Download" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:text-white"><Download size={20} /></a>}
                <button type="button" aria-label="Close" onClick={() => setOpen(null)} className="flex h-11 w-11 items-center justify-center rounded-full border-0 bg-white/10 text-white"><X size={20} /></button>
              </div>
            </div>
            <div className="relative flex flex-1 items-center justify-center p-3">
              {cur.url ? (cur.kind === 'video' ? <video src={cur.url} controls autoPlay playsInline className="max-h-full max-w-full rounded-xl" /> : <img src={cur.url} alt={cur.caption} className="max-h-full max-w-full rounded-xl object-contain" />) : <div className="aspect-[3/2] w-full max-w-3xl rounded-xl" style={{ background: gradient(open) }} />}
              <button type="button" aria-label="Previous" onClick={() => setOpen((open - 1 + shown.length) % shown.length)} className="absolute left-3 flex h-12 w-12 items-center justify-center rounded-full border-0 bg-white/15 text-white"><ChevronLeft /></button>
              <button type="button" aria-label="Next" onClick={() => setOpen((open + 1) % shown.length)} className="absolute right-3 flex h-12 w-12 items-center justify-center rounded-full border-0 bg-white/15 text-white"><ChevronRight /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sheet && <Sheet g={g} kind={sheet} favs={(items ?? []).filter((m) => favs.includes(m.id))} onClose={() => setSheet(null)} />}
      </AnimatePresence>
    </>
  );
}

function Tile({ m, i, fav, onOpen, onFav, tall, wide }: { m: MediaItem; i: number; fav: boolean; onOpen: () => void; onFav: () => void; tall?: boolean; wide?: boolean }) {
  return (
    <div className="group relative mb-3 break-inside-avoid overflow-hidden rounded-2xl" style={{ background: gradient(i), aspectRatio: m.url ? undefined : wide ? '3 / 2' : tall ? '3 / 4' : '4 / 3' }}>
      {m.url && <img src={m.thumb_url || m.url} alt={m.caption} loading="lazy" decoding="async" className={`block w-full transition duration-500 group-hover:scale-[1.03] ${wide ? 'aspect-[3/2] object-cover' : ''}`} />}
      <button type="button" onClick={onOpen} aria-label={`Open ${m.caption}`} className="absolute inset-0 border-0 bg-transparent" />
      {!m.url && <span className="pointer-events-none absolute bottom-3 left-3 text-xs text-basil-frost">{m.caption}</span>}
      <button type="button" onClick={onFav} aria-label={fav ? 'Remove from favourites' : 'Add to favourites'} aria-pressed={fav} className={`absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full border-0 transition ${fav ? 'bg-white text-basil' : 'bg-basil-night/45 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100'}`}>
        <Heart size={18} fill={fav ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}

function Sheet({ g, kind, favs, onClose }: { g: G; kind: 'send' | 'share'; favs: MediaItem[]; onClose: () => void }) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}/g/${g.slug}`;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 flex items-end justify-center bg-basil-night/60 p-3 sm:items-center">
      <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="w-full max-w-md rounded-[28px] bg-white p-6">
        {kind === 'share' ? (
          <div className="flex flex-col gap-3">
            <h2 className="m-0 text-xl font-extrabold">Share this gallery</h2>
            <a className="btn-primary" href={waLink('', `${g.title} — photos by Basil Media: ${link}`)} target="_blank" rel="noreferrer">Share on WhatsApp</a>
            <a className="btn-outline" href={`sms:?&body=${encodeURIComponent(`${g.title} photos: ${link}`)}`}>Send by SMS</a>
            <a className="btn-outline" href={`mailto:?subject=${encodeURIComponent(g.title)}&body=${encodeURIComponent(link)}`}>Send by email</a>
            <button type="button" className="btn-outline" onClick={() => navigator.clipboard?.writeText(link).then(() => setCopied(true))}>{copied ? 'Link copied ✓' : 'Copy link'}</button>
          </div>
        ) : done ? (
          <div role="status" className="py-6 text-center"><h2 className="m-0 text-xl font-extrabold">Selection sent ✓</h2><p className="text-basil-muted">The Basil Media team has your {favs.length} photos and will be in touch.</p><button className="btn-primary" onClick={onClose}>Close</button></div>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={async (e) => {
            e.preventDefault();
            await submit('bookings', { name, contact, service: `Gallery selection · ${g.title}`, preferred_date: null, source: 'gallery-selection', status: 'new', message: favs.map((f) => f.caption || f.id).join(', ') });
            setDone(true);
          }}>
            <h2 className="m-0 text-xl font-extrabold">Send {favs.length} photos to Basil Media</h2>
            <label className="flex flex-col gap-1 text-sm font-bold">Your name<input required className="field-light" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="flex flex-col gap-1 text-sm font-bold">Phone or email<input required className="field-light" value={contact} onChange={(e) => setContact(e.target.value)} /></label>
            <button className="btn-primary h-12">Send my selection</button>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}
