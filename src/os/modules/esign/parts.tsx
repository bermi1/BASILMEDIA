// Shared e-sign pieces: the document view (PDF iframe or text + signature block at the end) and a touch-friendly signature pad.
import { useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';
import { FIELD_LABEL, fmtDate, type FieldKind } from './lib';

export interface BlockSigner { name: string; fields?: FieldKind[]; status?: string; signed_name?: string | null; signed_at?: string | null; signature_data?: string | null }

export function DocumentView({ kind, url, text, signers }: { kind: 'pdf' | 'text'; url: string; text: string; signers: BlockSigner[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-basil-line bg-white">
      {kind === 'pdf' ? (
        <div>
          <iframe title="Document" src={url} className="h-[70vh] min-h-[420px] w-full border-0 bg-basil-mist" />
          <a href={url} target="_blank" rel="noreferrer" className="block border-t border-basil-line px-4 py-2 text-sm font-bold">Open the PDF in a new tab</a>
        </div>
      ) : (
        <div className="whitespace-pre-wrap break-words px-5 py-6 font-serif text-[15px] leading-relaxed text-[#1d2b3d] sm:px-10">{text}</div>
      )}
      <div className="border-t border-dashed border-basil-edge bg-[#FAFCFF] px-5 py-5 sm:px-10">
        <div className="mb-3 font-mono text-[11px] tracking-[0.16em] text-basil">SIGNATURES</div>
        <div className="grid gap-4 sm:grid-cols-2">
          {signers.map((s, i) => {
            const f = s.fields ?? ['signature', 'name', 'date'];
            return (
              <div key={i} className="rounded-xl border border-basil-line bg-white p-3">
                <div className="text-xs text-basil-muted">Signer {i + 1} · {s.name}</div>
                {f.includes('signature') && (
                  <div className="mt-2 flex h-16 items-end border-b border-basil-ink/40">
                    {s.signature_data ? <img src={s.signature_data} alt={`Signature of ${s.signed_name ?? s.name}`} className="max-h-16 max-w-full" /> : <span className="pb-1 text-xs text-basil-muted">{FIELD_LABEL.signature}</span>}
                  </div>
                )}
                {f.includes('name') && <div className="mt-2 text-sm"><span className="text-basil-muted">{FIELD_LABEL.name}: </span><b>{s.signed_name ?? '—'}</b></div>}
                {f.includes('date') && <div className="text-sm"><span className="text-basil-muted">{FIELD_LABEL.date}: </span><b>{s.signed_at ? fmtDate(s.signed_at) : '—'}</b></div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Draw-your-signature canvas (mouse, pen and finger). Calls onChange with a PNG data URL, or '' when cleared. */
export function SignaturePad({ onChange }: { onChange: (dataUrl: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);
  useEffect(() => {
    const c = ref.current!;
    const fit = () => {
      const r = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      c.width = r.width * dpr;
      c.height = r.height * dpr;
      const ctx = c.getContext('2d')!;
      ctx.scale(dpr, dpr);
      Object.assign(ctx, { lineWidth: 2.4, lineCap: 'round', lineJoin: 'round', strokeStyle: '#0A2F5C' });
      setEmpty(true);
      onChange('');
    };
    fit();
    addEventListener('resize', fit);
    return () => removeEventListener('resize', fit);
  }, []);
  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    ref.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = ref.current!.getContext('2d')!;
    const [x, y] = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = ref.current!.getContext('2d')!;
    const [x, y] = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setEmpty(false);
    onChange(ref.current!.toDataURL('image/png'));
  };
  const clear = () => {
    const c = ref.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
    onChange('');
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <canvas ref={ref} aria-label="Draw your signature here" role="img" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
          className="h-44 w-full cursor-crosshair touch-none rounded-xl border-2 border-dashed border-basil-edge bg-white" />
        {empty && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-basil-muted">Sign here with your finger, pen or mouse</span>}
        <span className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-basil-ink/30" />
      </div>
      <button type="button" onClick={clear} className="flex min-h-[44px] items-center gap-2 self-start border-0 bg-transparent text-sm font-bold text-basil"><Eraser size={16} />Clear</button>
    </div>
  );
}
