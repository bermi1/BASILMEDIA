// Native-style bottom tab bar for the public site on phones (hidden from tablet width up).
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clapperboard, Home, LayoutGrid, Newspaper, Phone } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export function MobileTabBar() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const tabs = [
    { to: '/', label: 'Home', icon: Home, match: (p: string) => p === '/' },
    { to: '/services', label: t('services'), icon: LayoutGrid, match: (p: string) => p.startsWith('/services') },
    { to: '/our-work', label: t('ourWork').replace('Our ', ''), icon: Clapperboard, match: (p: string) => p.startsWith('/our-work') },
    { to: '/health-news', label: 'News', icon: Newspaper, match: (p: string) => p.startsWith('/health-news') || p === '/subscribe' },
    { to: '/contact', label: t('contact'), icon: Phone, match: (p: string) => p.startsWith('/contact') },
  ];
  return (
    <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-40 px-2.5 pb-[max(8px,env(safe-area-inset-bottom))] md:hidden">
      <div className="grid grid-cols-5 rounded-[24px] border border-white/70 bg-white/90 p-1 shadow-[0_14px_36px_rgba(10,47,92,0.22)] backdrop-blur-xl">
        {tabs.map(({ to, label, icon: Icon, match }) => {
          const on = match(pathname);
          return (
            <NavLink key={to} to={to} aria-current={on ? 'page' : undefined} className="relative flex h-[54px] flex-col items-center justify-center gap-0.5 rounded-[19px] text-[10.5px] font-semibold no-underline">
              {on && <motion.span layoutId="pub-tab" className="absolute inset-0 rounded-[19px] bg-basil-ice" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />}
              <Icon size={21} strokeWidth={on ? 2.3 : 1.8} className={`relative ${on ? 'text-basil' : 'text-basil-muted'}`} />
              <span className={`relative ${on ? 'text-basil' : 'text-basil-muted'}`}>{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
