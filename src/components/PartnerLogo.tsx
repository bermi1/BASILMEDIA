// Partner logo with a graceful fallback: if the image is missing or broken, the name shows instead.
import { useState } from 'react';
import type { Partner } from '@/lib/types';

export function PartnerLogo({ p, className = '', wrap = false }: { p: Pick<Partner, 'name' | 'logo_url'>; className?: string; wrap?: boolean }) {
  const [broken, setBroken] = useState(false);
  if (!p.logo_url || broken) return <span className={wrap ? 'text-center' : 'whitespace-nowrap'}>{p.name}</span>;
  return <img src={p.logo_url} alt={p.name} onError={() => setBroken(true)} loading="lazy" className={className} />;
}

/** Partners once each (the CMS may hold duplicates). */
export const uniquePartners = <T extends { name: string }>(rows: T[]) => rows.filter((p, i) => rows.findIndex((x) => x.name.trim().toLowerCase() === p.name.trim().toLowerCase()) === i);
