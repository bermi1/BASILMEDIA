import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Download, Heart, Lock, Pause, PlayCircle, ScanFace, Send, Share2, X } from 'lucide-react';
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
  const [play, setPlay] = useState(false);
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

  useEffect(() => {
    if (!play || open === null) return;
    const t = setTimeout(() => setOpen((o) => (o === null ? o : (o + 1) % shown.length)), 3500);
    return () => clearTimeout(t);
  }, [play, open, shown.length]);

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
  const count = (c: string) => (items ?? []).filter((m) => c === 'All' || m.collection === c).length;
  const iconBtn = 'flex h-10 w-10 items-center justify-center rounded-full border-0 bg-transparent text-[#222] transition hover:bg-black/5';

  return (
    <div className="min-h-screen bg-white text-[#222]">
      {/* COVER — full screen, centred title, Pixieset-style */}
      <section aria-label="Gallery cover" className="relative flex h-[100svh] items-center justify-center overflow-hidden bg-[#111] text-white">
        {cover ? <motion.img initial={{ scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: 2.4, ease: 'easeOut' }} src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0" style={{ background: gradient(0) }} />}
        <div className="absolute inset-0 bg-black/35" />
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.8 }} className="relative px-6 text-center">
          <h1 className="m-0 text-[clamp(22px,4vw,44px)] font-light uppercase tracking-[0.28em]">{g.title}</h1>
          <div className="mt-3 text-[12px] uppercase tracking-[0.3em] text-white/80">{fmtDateLong(g.event_date)}</div>
          <a href="#grid" className="mt-8 inline-flex h-11 items-center gap-2 border border-white/80 px-7 text-[12px] font-medium uppercase tracking-[0.25em] text-white no-underline transition hover:bg-white hover:text-[#111]">View gallery</a>
        </motion.div>
        <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-1 text-[10px] uppercase tracking-[0.3em] text-white/70">
          <span className="flex items-center gap-2"><img src="/logo-reverse.svg" alt="" className="h-5 w-5" />Basil Media</span>
        </div>
      </section>

      {/* BAR — name, collections, actions */}
      <div id="grid" className="sticky top-0 z-30 scroll-mt-0 border-b border-black/5 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-3 px-4 sm:h-16 sm:px-8">
          <div className="min-w-0"><b className="block truncate text-[13px] font-medium uppercase tracking-[0.18em]">{g.title}</b><span className="hidden text-[11px] uppercase tracking-[0.2em] text-black/45 sm:block">Basil Media</span></div>
          <div className="flex items-center">
            <button type="button" aria-pressed={onlyFavs} onClick={() => setOnlyFavs(!onlyFavs)} className={iconBtn} aria-label={`Favourites (${favs.length})`}><Heart size={18} fill={onlyFavs ? '#222' : 'none'} /></button>
            {favs.length > 0 && <span className="-ml-1.5 mr-1 text-[11px] font-medium">{favs.length}</span>}
            <button type="button" onClick={() => shown.length && (setOpen(0), setPlay(true))} className={iconBtn} aria-label="Slideshow"><PlayCircle size={18} /></button>
            <button type="button" onClick={() => setSheet('share')} className={iconBtn} aria-label="Share"><Share2 size={18} /></button>
            {g.face_search_enabled && <Link to={`/find-me?g=${g.slug}`} className={iconBtn} aria-label="Find my photos"><ScanFace size={18} /></Link>}
          </div>
        </div>
        <div role="tablist" aria-label="Collections" className="scrollbar-none mx-auto flex max-w-[1600px] gap-6 overflow-x-auto px-4 sm:justify-center sm:px-8">
          {['All', ...g.collections].map((c) => (
            <button key={c} role="tab" type="button" aria-selected={tab === c} onClick={() => setTab(c)} className={`relative h-10 shrink-0 border-0 bg-transparent px-0 text-[11.5px] font-medium uppercase tracking-[0.2em] ${tab === c ? 'text-[#111]' : 'text-black/40 hover:text-black/70'}`}>
              {c} <span className="text-black/30">{count(c)}</span>
              {tab === c && <motion.span layoutId="g-tab" className="absolute inset-x-0 bottom-0 h-px bg-[#111]" />}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-[1600px] px-1.5 py-1.5 sm:px-6 sm:py-6">
        {limit > 0 && (
          <div className="mx-1.5 mb-3 flex flex-wrap items-center justify-between gap-3 border border-black/10 px-4 py-3 sm:mx-0">
            <span className="text-[12px] uppercase tracking-[0.16em]">Album selection · <b>{favs.length}</b> / {limit}</span>
            <button type="button" disabled={!favs.length} onClick={() => setSheet('send')} className="flex h-9 items-center gap-2 border-0 bg-[#111] px-4 text-[11px] font-medium uppercase tracking-[0.2em] text-white disabled:opacity-30"><Send size={14} />Send selection</button>
          </div>
        )}
        {onlyFavs && !shown.length && <p className="py-20 text-center text-[13px] uppercase tracking-[0.2em] text-black/40">No favourites yet — tap the heart on a photo</p>}
        <div className="columns-2 gap-1.5 sm:columns-3 sm:gap-3 xl:columns-4">
          {shown.map((m, i) => <Tile key={m.id} m={m} i={i} fav={favs.includes(m.id)} canDownload={g.allow_downloads} onOpen={() => setOpen(i)} onFav={() => toggleFav(m.id)} />)}
        </div>
        <footer className="mt-16 flex flex-col items-center gap-2 pb-10 text-center text-[11px] uppercase tracking-[0.25em] text-black/45">
          <img src="/logo.svg" alt="" className="h-8 w-8" />
          <span>Delivered by Basil Media · open until {fmtDate(g.expires_on)}</span>
          <span className="flex gap-4"><Link to="/" className="text-black/60">Website</Link><Link to="/find-me" className="text-black/60">Find my photos</Link><Link to="/contact" className="text-black/60">Prints &amp; albums</Link></span>
          <Link to={`/remove-me?g=${g.slug}`} className="text-black/40">Remove me from this gallery</Link>
        </footer>
      </main>

      <AnimatePresence>
        {cur && open !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label={cur.caption} className="fixed inset-0 z-50 flex flex-col bg-[#0b0b0b] text-white">
            <div className="flex items-center justify-between px-3 py-2 sm:px-6">
              <span className="text-[11px] uppercase tracking-[0.2em] text-white/60">{open + 1} / {shown.length}</span>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Favourite" aria-pressed={favs.includes(cur.id)} onClick={() => toggleFav(cur.id)} className="flex h-11 w-11 items-center justify-center border-0 bg-transparent text-white"><Heart size={19} fill={favs.includes(cur.id) ? 'currentColor' : 'none'} /></button>
                <button type="button" aria-label={play ? 'Pause slideshow' : 'Play slideshow'} onClick={() => setPlay(!play)} className="flex h-11 w-11 items-center justify-center border-0 bg-transparent text-white">{play ? <Pause size={19} /> : <PlayCircle size={19} />}</button>
                {g.allow_downloads && cur.url && <a href={cur.url} download aria-label="Download" className="flex h-11 w-11 items-center justify-center text-white hover:text-white"><Download size={19} /></a>}
                <button type="button" aria-label="Close" onClick={() => (setOpen(null), setPlay(false))} className="flex h-11 w-11 items-center justify-center border-0 bg-transparent text-white"><X size={21} /></button>
              </div>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-6 sm:px-16">
              <AnimatePresence mode="wait">
                <motion.div key={cur.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="flex h-full w-full items-center justify-center">
                  {cur.url ? (cur.kind === 'video' ? <video src={cur.url} controls autoPlay playsInline className="max-h-full max-w-full" /> : <img src={cur.url} alt={cur.caption} className="max-h-full max-w-full object-contain" />) : <div className="aspect-[3/2] w-full max-w-3xl" style={{ background: gradient(open) }} />}
                </motion.div>
              </AnimatePresence>
              <button type="button" aria-label="Previous" onClick={() => setOpen((open - 1 + shown.length) % shown.length)} className="absolute left-1 flex h-14 w-11 items-center justify-center border-0 bg-transparent text-white/80 sm:left-4"><ChevronLeft size={30} strokeWidth={1.2} /></button>
              <button type="button" aria-label="Next" onClick={() => setOpen((open + 1) % shown.length)} className="absolute right-1 flex h-14 w-11 items-center justify-center border-0 bg-transparent text-white/80 sm:right-4"><ChevronRight size={30} strokeWidth={1.2} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sheet && <Sheet g={g} kind={sheet} favs={(items ?? []).filter((m) => favs.includes(m.id))} onClose={() => setSheet(null)} />}
      </AnimatePresence>
    </div>
  );
}

function Tile({ m, i, fav, canDownload, onOpen, onFav }: { m: MediaItem; i: number; fav: boolean; canDownload: boolean; onOpen: () => void; onFav: () => void }) {
  return (
    <div className="group relative mb-1.5 break-inside-avoid overflow-hidden sm:mb-3" style={{ background: gradient(i), aspectRatio: m.url ? undefined : i % 3 === 0 ? '3 / 4' : '4 / 3' }}>
      {m.url && <img src={m.thumb_url || m.url} alt={m.caption} loading="lazy" decoding="async" className="block w-full transition duration-500 group-hover:opacity-90" />}
      <button type="button" onClick={onOpen} aria-label={`Open ${m.caption}`} className="absolute inset-0 border-0 bg-transparent" />
      {m.kind === 'video' && <span className="pointer-events-none absolute left-2 top-2 rounded-sm bg-black/50 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-white">Video</span>}
      <div className={`absolute bottom-0 right-0 flex gap-0.5 p-1.5 transition ${fav ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'}`}>
        {canDownload && m.url && <a href={m.url} download aria-label="Download" onClick={(e) => e.stopPropagation()} className="hidden h-9 w-9 items-center justify-center text-white drop-shadow sm:flex"><Download size={17} /></a>}
        <button type="button" onClick={onFav} aria-label={fav ? 'Remove from favourites' : 'Add to favourites'} aria-pressed={fav} className="flex h-9 w-9 items-center justify-center border-0 bg-transparent text-white drop-shadow"><Heart size={17} fill={fav ? 'currentColor' : 'none'} /></button>
      </div>
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
