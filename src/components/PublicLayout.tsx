import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Header } from './Header';
import { Footer, WhatsAppButton } from './Footer';
import { Cursor } from './Cursor';
import { MobileTabBar } from './MobileTabBar';

export function PublicLayout() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 80);
      return () => clearTimeout(t);
    }
    scrollTo({ top: 0 });
  }, [pathname, hash]);
  return (
    <div className="relative min-h-screen bg-white pb-[84px] md:pb-0">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:p-3">Skip to content</a>
      <Header />
      <AnimatePresence mode="wait" initial={false}>
        <motion.main id="main" key={pathname} className={/^\/($|services|our-work|about|contact|health-news$|find-me|subscribe|g\/)/.test(pathname) ? '' : 'pt-24'} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <Outlet />
        </motion.main>
      </AnimatePresence>
      {/* Phones: only the landing page carries the footer; the tab bar does the rest. */}
      <div className={pathname === '/' ? '' : 'hidden md:block'}><Footer /></div>
      <WhatsAppButton />
      <MobileTabBar />
      <Cursor />
    </div>
  );
}
