// Shared building blocks for every OS module and phone app. Status colours are fixed everywhere:
// green = on track / approved, amber = pending / at risk, red = late / rejected, blue = information.
import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

export const tsh = (n: number | string | null | undefined) => `TSH ${Math.round(Number(n ?? 0)).toLocaleString('en-GB')}`;
export const tshShort = (n: number) => (Math.abs(n) >= 1e6 ? `TSH ${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `TSH ${Math.round(n / 1e3)}K` : tsh(n));

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'grey' | 'gold';
const TONES: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-900 ring-amber-200',
  red: 'bg-red-50 text-red-800 ring-red-200',
  blue: 'bg-basil-ice text-basil-deep ring-basil-edge',
  grey: 'bg-slate-100 text-slate-700 ring-slate-200',
  gold: 'bg-[#FBF4E2] text-[#7A5E12] ring-[#EBD9A6]',
};
export function Pill({ tone = 'blue', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${TONES[tone]}`}>{children}</span>;
}

/** Horizontal stage tracker: completed stages ticked, current one glowing, who/when under each. */
export function StageTracker({ stages, current, meta, rejected }: { stages: string[]; current: number; meta?: (string | undefined)[]; rejected?: boolean }) {
  return (
    <ol className="scrollbar-none m-0 flex list-none items-start gap-0 overflow-x-auto p-0" aria-label="Progress">
      {stages.map((s, i) => {
        const done = i < current, now = i === current;
        return (
          <li key={s} className="flex min-w-[92px] flex-1 flex-col items-center text-center" aria-current={now ? 'step' : undefined}>
            <div className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${i === 0 ? 'opacity-0' : done || now ? 'bg-basil' : 'bg-basil-line'}`} />
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${now && rejected ? 'bg-red-600 text-white' : done ? 'bg-basil text-white' : now ? 'bg-white text-basil ring-4 ring-basil/25 shadow-[0_0_0_6px_rgba(15,110,194,0.12)]' : 'bg-basil-line text-basil-muted'}`}>
                {now && rejected ? <X size={15} /> : done ? <Check size={15} /> : i + 1}
              </span>
              <span className={`h-0.5 flex-1 ${i === stages.length - 1 ? 'opacity-0' : done ? 'bg-basil' : 'bg-basil-line'}`} />
            </div>
            <span className={`mt-1.5 px-1 text-[11px] leading-tight ${now ? 'font-bold text-basil-ink' : 'text-basil-muted'}`}>{s}</span>
            {meta?.[i] && <span className="px-1 text-[10px] leading-tight text-basil-muted">{meta[i]}</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function Stat({ label, value, sub, tone, onClick, icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; onClick?: () => void; icon?: ReactNode }) {
  const C = onClick ? 'button' : 'div';
  return (
    <C type={onClick ? 'button' : undefined} onClick={onClick} className={`flex min-w-0 flex-col gap-1 rounded-2xl border border-basil-line bg-white p-4 text-left ${onClick ? 'cursor-pointer transition hover:border-basil-soft hover:shadow-card' : ''}`}>
      <span className="flex items-center justify-between gap-2 text-[13px] text-basil-muted">{label}{icon}</span>
      <span className={`truncate font-display text-2xl font-extrabold ${tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700' : tone === 'green' ? 'text-emerald-700' : tone === 'gold' ? 'text-[#8a6d1f]' : 'text-basil-ink'}`}>{value}</span>
      {sub && <span className="text-xs text-basil-muted">{sub}</span>}
    </C>
  );
}

export function Card({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-basil-line bg-white p-4 sm:p-5 ${className}`}>
      {(title || action) && <div className="mb-3 flex items-center justify-between gap-2"><h2 className="m-0 text-base font-extrabold">{title}</h2>{action}</div>}
      {children}
    </section>
  );
}

export function Empty({ icon, title, sub, action }: { icon?: ReactNode; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-basil-edge bg-white px-6 py-10 text-center">
      {icon && <span className="flex h-14 w-14 items-center justify-center rounded-full bg-basil-ice text-basil">{icon}</span>}
      <b>{title}</b>
      {sub && <span className="max-w-sm text-sm text-basil-muted">{sub}</span>}
      {action}
    </div>
  );
}

export function Progress({ value, max, tone }: { value: number; max: number; tone?: Tone }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const auto: Tone = pct >= 100 ? 'red' : pct >= 80 ? 'amber' : 'green';
  const t = tone ?? auto;
  const bar = t === 'red' ? 'bg-red-600' : t === 'amber' ? 'bg-amber-500' : t === 'green' ? 'bg-emerald-600' : 'bg-basil';
  return <div className="h-2 w-full overflow-hidden rounded-full bg-basil-line" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><div className={`h-2 rounded-full ${bar}`} style={{ width: `${pct}%` }} /></div>;
}

/** Bottom sheet on phones, centred dialog on desktop. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[70] flex items-end justify-center bg-basil-night/55 sm:items-center sm:p-4">
          <motion.div role="dialog" aria-modal="true" aria-label={title} initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} transition={{ type: 'spring', damping: 26, stiffness: 300 }} onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] bg-white p-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-[28px]">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-basil-line sm:hidden" />
            <div className="mb-4 flex items-center justify-between"><h2 className="m-0 text-lg font-extrabold">{title}</h2><button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full border-0 bg-basil-mist text-basil-deep"><X size={18} /></button></div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-bold text-[#33465F]">
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-basil-muted">{hint}</span>}
    </label>
  );
}
export const inputCls = 'h-12 w-full rounded-xl border border-basil-edge bg-white px-3 text-[15px] font-normal text-basil-ink outline-none focus:border-basil';

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase() || '?';
  return <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-basil-ice font-display font-extrabold text-basil" style={{ width: size, height: size, fontSize: size * 0.38 }}>{ini}</span>;
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="scrollbar-none flex gap-1.5 overflow-x-auto">
      {items.map((i) => (
        <button key={i.value} role="tab" type="button" aria-selected={value === i.value} onClick={() => onChange(i.value)} className={`min-h-[40px] shrink-0 rounded-full px-3.5 text-sm font-semibold ${value === i.value ? 'border-0 bg-basil text-white' : 'border border-basil-edge bg-white text-basil-deep'}`}>
          {i.label}{i.count !== undefined && <span className="ml-1 opacity-70">{i.count}</span>}
        </button>
      ))}
    </div>
  );
}
