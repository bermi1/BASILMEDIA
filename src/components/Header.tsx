import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Briefcase, Camera, ChevronDown, Menu, Mic, Radio, Sparkles, Video, X } from 'lucide-react';
import { useRows } from '@/hooks/useData';
import { useSettings } from '@/hooks/useData';
import { useI18n } from '@/lib/i18n';
import { Logo } from './Logo';
import { Media } from './Media';

export const SERVICE_ICONS: Record<string, typeof Video> = { video: Video, camera: Camera, mic: Mic, radio: Radio, sparkles: Sparkles, briefcase: Briefcase };

const WORK_MENU = [
  { label: 'All Projects', cat: '' },
  { label: 'Films & Documentaries', cat: 'Films & Documentaries' },
  { label: 'Photo Stories', cat: 'Photo Stories' },
  { label: 'Podcasts', cat: 'Podcasts' },
  { label: 'Corporate', cat: 'Corporate' },
];

export function Header() {
  const { t, lang, setLang } = useI18n();
  const settings = useSettings();
  const { rows: services } = useRows('services', { publishedOnly: true });
  const { rows: projects } = useRows('projects_public', { publishedOnly: true });
  const [mega, setMega] = useState<'services' | 'work' | null>(null);
  const [mobile, setMobile] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const loc = useLocation();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    setMega(null);
    setMobile(false);
  }, [loc.pathname, loc.hash]);
  useEffect(() => {
    const on = () => setScrolled(scrollY > 8);
    on();
    addEventListener('scroll', on, { passive: true });
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && (setMega(null), setMobile(false));
    addEventListener('keydown', esc);
    return () => (removeEventListener('scroll', on), removeEventListener('keydown', esc));
  }, []);

  const coverFor = (cat: string) => projects.find((p) => (!cat || p.category === cat) && p.image_url)?.image_url;
  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `rounded-xl px-3.5 py-3 no-underline ${isActive ? 'bg-basil-ice font-bold text-basil' : 'text-basil-ink hover:text-basil'}`;
  const megaBtn = (key: 'services' | 'work', label: string) => (
    <button
      type="button"
      aria-expanded={mega === key}
      onClick={() => setMega(mega === key ? null : key)}
      onMouseEnter={() => matchMedia('(hover: hover)').matches && setMega(key)}
      className={`flex items-center gap-1 rounded-xl border-0 px-3.5 py-3 font-medium ${mega === key ? 'bg-basil-ice text-basil' : 'bg-transparent text-basil-ink hover:text-basil'}`}
    >
      {label} <ChevronDown size={16} className={`transition ${mega === key ? 'rotate-180' : ''}`} />
    </button>
  );

  return (
    <header ref={ref} onMouseLeave={() => setMega(null)} className={`sticky top-0 z-40 border-b transition ${scrolled || mega ? 'border-[#E3EDF8] bg-white/90 shadow-[0_10px_30px_rgba(10,47,92,0.06)] backdrop-blur-xl' : 'border-transparent bg-white/80 backdrop-blur-md'}`}>
      <div className="container-bm flex items-center justify-between gap-3 py-2.5 sm:py-3">
        <Logo size={scrolled ? 56 : 64} />
        <nav aria-label="Main" className="hidden items-center gap-1 text-[15px] lg:flex">
          {megaBtn('services', t('services'))}
          {megaBtn('work', t('ourWork'))}
          <NavLink to="/about" className={linkCls}>{t('about')}</NavLink>
          <NavLink to="/contact" className={linkCls}>{t('contact')}</NavLink>
          <NavLink to="/find-me" className="rounded-xl px-3.5 py-3 font-bold text-basil no-underline">{t('findPhotos')}</NavLink>
        </nav>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setLang(lang === 'en' ? 'sw' : 'en')} aria-label="Switch language" className="h-11 rounded-full border border-basil-edge bg-white px-3 text-sm font-bold text-basil-deep">
            {lang === 'en' ? 'SW' : 'EN'}
          </button>
          <Link to="/#book" className="hidden rounded-full bg-basil px-[22px] py-[13px] text-[15px] font-bold text-white no-underline shadow-glow hover:bg-basil-deep hover:text-white sm:inline-flex">
            {t('book')}
          </Link>
          <button type="button" className="flex h-11 w-11 items-center justify-center rounded-xl border border-basil-edge bg-white text-basil-deep lg:hidden" aria-label={mobile ? 'Close menu' : 'Open menu'} aria-expanded={mobile} onClick={() => setMobile(!mobile)}>
            {mobile ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mega && (
          <motion.div key={mega} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="hidden border-t border-[#E3EDF8] bg-white shadow-[0_30px_60px_rgba(10,47,92,0.12)] lg:block">
            {mega === 'services' ? (
              <div className="container-bm flex gap-5 py-6">
                <div className="grid flex-[2] grid-cols-2 gap-2">
                  {services.map((s) => {
                    const Icon = SERVICE_ICONS[s.icon] ?? Video;
                    return (
                      <Link key={s.id} to={`/services#${s.slug}`} className="flex gap-3.5 rounded-2xl bg-basil-mist p-3.5 text-basil-ink no-underline transition hover:bg-basil-ice hover:text-basil-ink">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-basil text-white"><Icon size={20} /></span>
                        <span><b className="block">{s.title}</b><span className="text-[13px] text-basil-muted">{s.short}</span></span>
                      </Link>
                    );
                  })}
                </div>
                <Link to="/services" className="group flex-1 no-underline">
                  <Media src={settings.services_mega_image_url || coverFor('')} index={1} className="flex h-full min-h-[220px] flex-col justify-end gap-2 rounded-[22px] p-6 text-white">
                    <b className="relative font-display text-[22px]">End-to-end production, one team.</b>
                    <span className="relative text-basil-frost">Explore Services →</span>
                  </Media>
                </Link>
              </div>
            ) : (
              <div className="container-bm grid grid-cols-5 gap-3 py-6">
                {WORK_MENU.map((w, i) => (
                  <Link key={w.label} to={w.cat ? `/our-work?c=${encodeURIComponent(w.cat)}` : '/our-work'} className="group no-underline">
                    <Media src={coverFor(w.cat)} index={i} className="flex h-[260px] flex-col justify-end rounded-[22px] p-5 text-white">
                      <b className="relative font-display text-lg leading-tight">{w.label}</b>
                      <span className="relative text-sm text-basil-frost">View →</span>
                    </Media>
                  </Link>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mobile && (
          <motion.nav aria-label="Mobile" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-[#E3EDF8] bg-white lg:hidden">
            <div className="container-bm flex flex-col gap-1 py-4 text-[16px]">
              {[
                ['/services', t('services')], ['/our-work', t('ourWork')], ['/about', t('about')], ['/contact', t('contact')],
                ['/health-news', t('healthNews')], ['/find-me', t('findPhotos')],
              ].map(([to, label]) => (
                <NavLink key={to} to={to} className={linkCls}>{label}</NavLink>
              ))}
              <Link to="/#book" className="btn-primary mt-2">{t('book')}</Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
