import { useRef, useState } from 'react';
import { ImagePlus, Link2, Loader2, Trash2, Upload, X } from 'lucide-react';
import { uploadFile } from '@/lib/storage';
import { parseVideo, videoLabel } from '@/lib/video';

export type FieldType = 'text' | 'textarea' | 'number' | 'url' | 'image' | 'video' | 'file' | 'list' | 'select' | 'boolean' | 'date' | 'multiselect';
export interface Field {
  key: string;
  label: string;
  type: FieldType;
  options?: readonly string[];
  help?: string;
  required?: boolean;
  wide?: boolean;
  folder?: string;
}

const input = 'h-11 w-full rounded-xl border border-basil-edge bg-white px-3 text-[15px] outline-none focus:border-basil';

export function FieldInput({ f, value, onChange }: { f: Field; value: unknown; onChange: (v: unknown) => void }) {
  switch (f.type) {
    case 'textarea':
      return <textarea className={`${input} h-auto min-h-[110px] py-2.5`} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'number':
      return <input type="number" className={input} value={(value as number) ?? 0} onChange={(e) => onChange(Number(e.target.value))} />;
    case 'date':
      return <input type="date" className={input} value={((value as string) ?? '').slice(0, 10)} onChange={(e) => onChange(e.target.value)} />;
    case 'boolean':
      return (
        <button type="button" role="switch" aria-checked={!!value} onClick={() => onChange(!value)} className={`relative h-8 w-14 rounded-full border-0 transition ${value ? 'bg-basil' : 'bg-basil-edge'}`}>
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${value ? 'left-7' : 'left-1'}`} />
        </button>
      );
    case 'select':
      return <select className={input} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>{f.options?.map((o) => <option key={o}>{o}</option>)}</select>;
    case 'multiselect': {
      const arr = (value as string[]) ?? [];
      return (
        <div className="flex flex-wrap gap-1.5">
          {f.options?.map((o) => {
            const on = arr.includes(o);
            return <button key={o} type="button" aria-pressed={on} onClick={() => onChange(on ? arr.filter((x) => x !== o) : [...arr, o])} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${on ? 'border-0 bg-basil text-white' : 'border border-basil-edge bg-white text-basil-deep'}`}>{o}</button>;
          })}
        </div>
      );
    }
    case 'list':
      return <ListInput value={(value as string[]) ?? []} onChange={onChange} />;
    case 'image':
      return <UploadInput kind="image" folder={f.folder ?? 'site'} value={(value as string) ?? ''} onChange={onChange} />;
    case 'video':
      return <UploadInput kind="video" folder={f.folder ?? 'video'} value={(value as string) ?? ''} onChange={onChange} />;
    case 'file':
      return <UploadInput kind="file" folder={f.folder ?? 'files'} value={(value as string) ?? ''} onChange={onChange} />;
    default:
      return <input type={f.type === 'url' ? 'url' : 'text'} className={input} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
  }
}

function ListInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    if (!draft.trim()) return;
    onChange([...value, draft.trim()]);
    setDraft('');
  };
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {value.map((v, i) => (
          <span key={i} className="flex items-center gap-1 rounded-full bg-basil-ice py-1 pl-3 pr-1 text-sm text-basil-deep">{v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((_, j) => j !== i))} className="flex h-6 w-6 items-center justify-center rounded-full border-0 bg-transparent text-basil-muted hover:bg-white"><X size={14} /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input className={input} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} placeholder="Type and press Enter" />
        <button type="button" onClick={add} className="btn-outline h-11 min-h-0">Add</button>
      </div>
    </div>
  );
}

/** Upload a picture/video/file to storage, or paste a link (YouTube, Vimeo, Instagram, any URL). */
export function UploadInput({ kind, folder, value, onChange }: { kind: 'image' | 'video' | 'file'; folder: string; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const pick = async (file?: File) => {
    if (!file) return;
    setErr('');
    setBusy(0);
    try {
      onChange(await uploadFile(file, folder, setBusy));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const accept = kind === 'image' ? 'image/*' : kind === 'video' ? 'video/*' : '.pdf,application/pdf,image/*';
  const v = parseVideo(value);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {kind === 'image' && (
          <div className="flex h-20 w-28 items-center justify-center overflow-hidden rounded-xl border border-basil-line bg-basil-mist">
            {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="text-basil-edge" />}
          </div>
        )}
        {kind === 'video' && value && <span className="rounded-lg bg-basil-ice px-2.5 py-1 text-xs font-bold text-basil-deep">{videoLabel(value) || (v.kind === 'none' ? 'Unrecognised link' : 'Video')}</span>}
        <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        <button type="button" onClick={() => ref.current?.click()} disabled={busy !== null} className="btn-outline h-10 min-h-0 text-sm">
          {busy !== null ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
          {busy !== null ? `Uploading ${busy}%` : `Upload ${kind === 'file' ? 'file' : kind}`}
        </button>
        {value && <button type="button" onClick={() => onChange('')} className="flex h-10 items-center gap-1 rounded-xl border-0 bg-transparent px-2 text-sm font-bold text-red-700"><Trash2 size={15} />Remove</button>}
      </div>
      <label className="flex items-center gap-2 text-sm text-basil-muted">
        <Link2 size={16} className="shrink-0" />
        <input className={`${input} h-10 text-sm`} value={value.startsWith('data:') ? '(uploaded in demo mode)' : value} onChange={(e) => onChange(e.target.value)} placeholder={kind === 'video' ? 'or paste a YouTube, Vimeo or Instagram link' : 'or paste a link'} />
      </label>
      {err && <span role="alert" className="text-sm font-bold text-red-700">{err}</span>}
    </div>
  );
}
