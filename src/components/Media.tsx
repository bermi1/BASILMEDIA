// Image with the design's blue gradient as fallback when no picture has been uploaded yet.
import type { CSSProperties, ReactNode } from 'react';

const GRADS = [
  'linear-gradient(200deg, #2B86DA, #0A2F5C)',
  'linear-gradient(200deg, #0F6EC2, #061E3D)',
  'linear-gradient(200deg, #5FA9EC, #0A2F5C)',
  'linear-gradient(200deg, #0A2F5C, #0F6EC2)',
  'linear-gradient(200deg, #0F6EC2, #2B86DA)',
  'linear-gradient(200deg, #061E3D, #0F6EC2)',
];
export const gradient = (i: number) => GRADS[((i % GRADS.length) + GRADS.length) % GRADS.length];

export function Media({
  src, alt = '', index = 0, className = '', style, children, overlay = true,
}: { src?: string; alt?: string; index?: number; className?: string; style?: CSSProperties; children?: ReactNode; overlay?: boolean }) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: gradient(index), ...style }}>
      {src && <img src={src} alt={alt} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />}
      {src && overlay && <div className="absolute inset-0 bg-gradient-to-t from-basil-night/85 via-basil-night/20 to-transparent" />}
      {children}
    </div>
  );
}
