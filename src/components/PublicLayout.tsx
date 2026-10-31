import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer, WhatsAppButton } from './Footer';
import { Cursor } from './Cursor';

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
    <div className="relative min-h-screen bg-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:p-3">Skip to content</a>
      <Header />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
      <WhatsAppButton />
      <Cursor />
    </div>
  );
}
