// Floating "Chat with us": opens a small card with one-tap WhatsApp, Instagram, and (on computers) a QR code
// to scan with a phone. Links come from Site settings; anything without a real profile link is hidden.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useSettings } from '@/hooks/useData';
import { isProfileUrl, waLink } from '@/lib/format';
import { Instagram, WhatsApp } from './icons';

const qr = (data: string) => `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=8&color=0A2F5C&data=${encodeURIComponent(data)}`;

export function ChatWidget() {
  const s = useSettings();
  const [open, setOpen] = useState(false);
  const wa = s.whatsapp || s.phone;
  const waUrl = wa ? waLink(wa, 'Hello Basil Media, ') : '';
  const ig = isProfileUrl(s.socials?.instagram) ? s.socials.instagram! : '';
  const [scan, setScan] = useState<'instagram' | 'whatsapp'>(ig ? 'instagram' : 'whatsapp');
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [open]);
  if (!waUrl && !ig) return null;
  const scanUrl = scan === 'instagram' ? ig : waUrl;

  return (
    <div className="fixed bottom-[92px] right-3 z-40 md:bottom-6 md:right-6">
      <AnimatePresence>
        {open && (
          <motion.div role="dialog" aria-label="Chat with Basil Media" initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.97 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }} className="absolute bottom-[calc(100%+12px)] right-0 w-[min(320px,calc(100vw-24px))] origin-bottom-right overflow-hidden rounded-[24px] border border-white/60 bg-white/95 shadow-[0_30px_80px_-20px_rgba(10,47,92,0.5)] backdrop-blur-2xl">
            <div className="flex items-center gap-3 px-4 py-3.5 text-white" style={{ background: 'linear-gradient(135deg, #0F6EC2, #0A2F5C)' }}>
              <img src="/logo-reverse.svg" alt="" className="h-9 w-9" />
              <div className="min-w-0 flex-1"><b className="block text-[15px] leading-tight">Basil Media</b><span className="flex items-center gap-1.5 text-[12px] text-basil-frost"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Usually replies within an hour</span></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full border-0 bg-white/15 text-white"><X size={17} /></button>
            </div>
            <div className="flex flex-col gap-2 p-3">
              {waUrl && <a href={waUrl} target="_blank" rel="noreferrer" className="flex h-12 items-center gap-3 rounded-2xl bg-[#25D366] px-4 text-[14.5px] font-semibold text-white no-underline hover:text-white hover:brightness-95"><WhatsApp width={22} height={22} />Chat on WhatsApp</a>}
              {ig && <a href={ig} target="_blank" rel="noreferrer" className="flex h-12 items-center gap-3 rounded-2xl px-4 text-[14.5px] font-semibold text-white no-underline hover:text-white hover:brightness-95" style={{ background: 'linear-gradient(90deg, #F58529, #DD2A7B 45%, #8134AF 75%, #515BD4)' }}><Instagram width={20} height={20} />Follow on Instagram</a>}
              {/* QR: only useful on a computer — scan with your phone */}
              <div className="mt-1 hidden flex-col items-center gap-2 rounded-2xl bg-basil-mist p-3 md:flex">
                {ig && waUrl && (
                  <div role="tablist" className="flex rounded-full bg-white p-0.5 text-[12px] font-semibold">
                    {(['instagram', 'whatsapp'] as const).map((k) => <button key={k} type="button" role="tab" aria-selected={scan === k} onClick={() => setScan(k)} className={`h-7 rounded-full border-0 px-3 capitalize ${scan === k ? 'bg-basil text-white' : 'bg-transparent text-basil-muted'}`}>{k}</button>)}
                  </div>
                )}
                <img src={qr(scanUrl)} alt={`QR code to open Basil Media on ${scan === 'instagram' ? 'Instagram' : 'WhatsApp'}`} width={150} height={150} className="h-[150px] w-[150px] rounded-xl bg-white p-1.5" loading="lazy" />
                <span className="text-center text-[12px] text-basil-muted">Scan with your phone camera to open {scan === 'instagram' ? 'our Instagram' : 'WhatsApp chat'}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button type="button" whileTap={{ scale: 0.94 }} onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? 'Close chat options' : 'Chat with us'} className="relative flex h-[52px] items-center gap-2 rounded-full border-0 bg-[#25D366] pl-[14px] pr-[14px] text-[14.5px] font-semibold text-white shadow-[0_14px_34px_-6px_rgba(37,211,102,0.65)] md:h-14 md:pr-5">
        <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-[#25D366]/35 [animation-duration:2.8s]" aria-hidden="true" />
        {open ? <X size={22} /> : <WhatsApp width={24} height={24} />}
        <span className="hidden md:inline">{open ? 'Close' : 'Chat with us'}</span>
      </motion.button>
    </div>
  );
}
