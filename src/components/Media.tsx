// Image with a calm navy tone behind it while it loads (or when no picture has been uploaded yet).
import type { CSSProperties, ReactNode } from 'react';

// Calm, near-black navy tones behind a picture while it arrives: no bright blue "loading" boxes.
const GRADS = [
  'linear-gradient(200deg, #0E2442, #081830)',
  'linear-gradient(200deg, #0B2039, #06152A)',
  'linear-gradient(200deg, #102846, #0A1B33)',
];
export const gradient = (i: number) => GRADS[((i % GRADS.length) + GRADS.length) % GRADS.length];

export function Media({
  src, alt = '', index = 0, className = '', style, children, overlay = true,
}: { src?: string; alt?: string; index?: number; className?: string; style?: CSSProperties; children?: ReactNode; overlay?: boolean }) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: gradient(index), ...style }}>
      {src && <img src={src} alt={alt} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover object-top" />}
      {src && overlay && <div className="absolute inset-0 bg-gradient-to-t from-basil-night/85 via-basil-night/20 to-transparent" />}
      {children}
    </div>
  );
}
