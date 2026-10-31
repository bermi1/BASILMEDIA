// Floating glass header: a pill on desktop, a slim bar on phones. Transparent over the hero, frosted once you scroll.
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useSettings } from '@/hooks/useData';
import { useI18n } from '@/lib/i18n';

export function Header() {
  const { t, lang, setLang } = useI18n();
  const s = useSettings();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [solid, setSolid] = useState(false);
  useEffect(() => setOpen(false), [loc.pathname, loc.hash]);
  useEffect(() => {
    const on = () => setSolid(scrollY > 24);
    on();
    addEventListener('scroll', on, { passive: true });
    return () => removeEventListener('scroll', on);
  }, []);
  // Pages that open with a dark hero let the header float transparent; the rest get the frosted bar.
  const overHero = /^\/($|services|our-work|about|contact|health-news$|subscribe)/.test(loc.pathname);
  const glass = solid || open || !overHero;
  const links: [string, string][] = [['/services', t('services')], ['/our-work', t('ourWork')], ['/about', t('about')], ['/health-news', 'News'], ['/contact', t('contact')]];

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-[max(10px,env(safe-area-inset-top))] sm:px-5 sm:pt-4">
      <div className={`mx-auto flex h-14 max-w-[1240px] items-center justify-between gap-2 rounded-[20px] pl-2 pr-1.5 transition-all duration-300 sm:h-16 sm:rounded-full sm:pl-3 sm:pr-2 ${glass ? 'border border-white/60 bg-white/80 shadow-[0_12px_40px_rgba(10,47,92,0.14)] backdrop-blur-2xl' : 'border border-white/15 bg-white/[0.08] backdrop-blur-md'}`}>
        <Link to="/" aria-label="Basil Media home" className="flex items-center gap-2 no-underline">
          <img src={s.logo_url || '/logo.svg'} alt="" className="h-10 w-10 sm:h-11 sm:w-11" />
          <span className={`whitespace-nowrap font-display text-[16px] font-bold tracking-tight sm:text-[17px] ${glass ? 'text-basil-ink' : 'text-white'}`}>Basil <span className={glass ? 'text-basil' : 'text-basil-sky'}>Media</span></span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-0.5 lg:flex">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `relative whitespace-nowrap rounded-full px-3.5 py-2 text-[14px] font-medium no-underline transition ${isActive ? (glass ? 'bg-basil-ice text-basil' : 'bg-white/15 text-white') : glass ? 'text-basil-ink hover:text-basil' : 'text-white/85 hover:text-white'}`}>{label}</NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setLang(lang === 'en' ? 'sw' : 'en')} aria-label="Switch language" className={`hidden h-10 rounded-full sm:block border-0 px-3 text-[13px] font-bold ${glass ? 'bg-basil-mist text-basil-deep' : 'bg-white/10 text-white'}`}>{lang === 'en' ? 'SW' : 'EN'}</button>
          <Link to="/find-me" className={`hidden h-10 items-center whitespace-nowrap rounded-full px-3 text-[14px] font-medium no-underline xl:flex ${glass ? 'text-basil' : 'text-white'}`}>{t('findPhotos')}</Link>
          <Link to="/#book" className="flex h-10 items-center whitespace-nowrap rounded-full bg-basil px-4 text-[13.5px] font-semibold text-white no-underline shadow-glow hover:bg-basil-deep hover:text-white sm:px-5 sm:text-[14.5px]"><span className="sm:hidden">Book</span><span className="hidden sm:inline">{t('book')}</span></Link>
          <button type="button" onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} className={`flex h-10 w-10 items-center justify-center rounded-full border-0 lg:hidden ${glass ? 'bg-basil-mist text-basil-deep' : 'bg-white/10 text-white'}`}>{open ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav aria-label="Menu" initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} className="mx-auto mt-2 grid max-w-[1240px] grid-cols-2 gap-2 rounded-[22px] border border-white/60 bg-white/95 p-2.5 shadow-[0_20px_50px_rgba(10,47,92,0.18)] backdrop-blur-2xl lg:hidden">
            {[...links, ['/find-me', t('findPhotos')] as [string, string]].map(([to, label]) => (
              <NavLink key={to} to={to} className={({ isActive }) => `rounded-2xl px-4 py-3.5 text-[15px] font-medium no-underline ${isActive ? 'bg-basil text-white' : 'bg-basil-mist text-basil-ink'}`}>{label}</NavLink>
            ))}
            <button type="button" onClick={() => setLang(lang === 'en' ? 'sw' : 'en')} className="rounded-2xl border-0 bg-basil-mist px-4 py-3.5 text-left text-[15px] font-semibold text-basil-ink">{lang === 'en' ? 'Kiswahili' : 'English'}</button>
            <Link to="/login" className="col-span-2 py-2 text-center text-sm font-bold">{t('login')}</Link>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
