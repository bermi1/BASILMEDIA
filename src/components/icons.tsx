// Brand-specific stroke icons from the design; general UI icons come from lucide-react.
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, 'aria-hidden': true } as const;

export const Instagram = (p: P) => (<svg {...base} {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r="0.9" fill="currentColor" /></svg>);
export const YouTube = (p: P) => (<svg {...base} {...p}><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="M10 9.5 L15 12 L10 14.5 Z" fill="currentColor" /></svg>);
export const Facebook = (p: P) => (<svg {...base} {...p}><path d="M14 21 V12.5 H17 L17.5 9 H14 V7 C14 6 14.5 5.5 15.5 5.5 H17.5 V2.5 H15 C12.5 2.5 10.5 4 10.5 7 V9 H7.5 V12.5 H10.5 V21" /></svg>);
export const LinkedIn = (p: P) => (<svg {...base} {...p}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 10.5 V17 M8 7.2 V7.4 M12 17 V10.5 M12 13 C12 11 16.5 10 16.5 13 V17" /></svg>);
export const TikTok = (p: P) => (<svg {...base} {...p}><path d="M14 3 V15.5 A3.5 3.5 0 1 1 10.5 12 M14 3 C14.5 5.5 16.5 7.5 19 7.5" /></svg>);
export const XLogo = (p: P) => (<svg {...base} strokeWidth={2} {...p}><path d="M4 4 L20 20 M20 4 L4 20" /></svg>);
export const WhatsApp = (p: P) => (
  <svg {...base} width={24} height={24} strokeLinejoin="round" {...p}>
    <path d="M4 20 L5.3 16.2 A8 8 0 1 1 8 18.8 Z" />
    <path d="M9 9.5 c0 3 2.5 5.5 5.5 5.5 l1-1.3 -2-1 -0.8 0.7 a4 4 0 0 1 -2.1-2.1 l0.7-0.8 -1-2 Z" fill="currentColor" strokeWidth={0.8} />
  </svg>
);
export const Fingerprint = (p: P) => (
  <svg {...base} width={28} height={28} strokeWidth={1.6} strokeLinecap="round" {...p}>
    <path d="M6.5 9.5 a5.5 5.5 0 0 1 11 0 v3" /><path d="M9 10 a3 3 0 0 1 6 0 v4 a5 5 0 0 1 -1 3" /><path d="M12 10.5 v4.5 a7 7 0 0 1 -2 4.5" /><path d="M6.5 13 v1 a7 7 0 0 0 1 3.5" /><path d="M4 8 a9 9 0 0 1 16 0" />
  </svg>
);
export const Play = ({ size = 28, color = '#0F6EC2' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5 L19 12 L8 19 Z" fill={color} /></svg>
);

export const SOCIALS = [
  { key: 'instagram', label: 'Instagram', Icon: Instagram },
  { key: 'youtube', label: 'YouTube', Icon: YouTube },
  { key: 'facebook', label: 'Facebook', Icon: Facebook },
  { key: 'linkedin', label: 'LinkedIn', Icon: LinkedIn },
  { key: 'tiktok', label: 'TikTok', Icon: TikTok },
  { key: 'x', label: 'X', Icon: XLogo },
] as const;
