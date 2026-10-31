import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type Kind = 'ok' | 'error';
const Ctx = createContext<(msg: string, kind?: Kind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: Kind }[]>([]);
  const push = useCallback((msg: string, kind: Kind = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, msg, kind }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status" className={`rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-lg ${t.kind === 'error' ? 'bg-red-700' : 'bg-basil-deep'}`}>{t.msg}</motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
