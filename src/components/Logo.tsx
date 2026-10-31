import { Link } from 'react-router-dom';
import { useSettings } from '@/hooks/useData';

export function Logo({ size = 64, dark = false, to = '/' }: { size?: number; dark?: boolean; to?: string }) {
  const s = useSettings();
  return (
    <Link to={to} className="flex items-center gap-3 no-underline" aria-label="Basil Media home">
      <img src={s.logo_url || '/logo.svg'} alt="" width={size} height={size} style={{ width: size, height: size }} className="shrink-0 object-contain" />
      <span className={`font-display text-[22px] font-extrabold ${dark ? 'text-white' : 'text-basil-ink'}`}>
        Basil <span className={dark ? 'text-basil-sky' : 'text-basil'}>Media</span>
      </span>
    </Link>
  );
}
