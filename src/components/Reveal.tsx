import type { ReactNode } from 'react';

/** A plain wrapper. Sections used to fade in as they scrolled into view; that hid content until it was
 *  reached (it looked like lazy loading), so everything now shows at once. `delay` is kept for old callers. */
export function Reveal({ children, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  return <div className={className}>{children}</div>;
}
