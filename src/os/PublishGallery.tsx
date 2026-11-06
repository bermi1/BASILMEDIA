// Staff: publish a finished Pixieset gallery to the website in one step, then share it on WhatsApp.
import { useState } from 'react';
import { CheckCircle2, Images, Loader2, Send } from 'lucide-react';
import { rpc } from './lib/store';
import { uploadFile } from '@/lib/storage';
import { Field, inputCls } from './ui';

export function PublishGallery() {
  const [f, setF] = useState({ title: '', client: '', url: '', cover: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const go = async () => {
    setErr('');
    setBusy(true);
    try {
      await rpc('publish_gallery', { _title: f.title, _client: f.client, _url: f.url.trim().split('?')[0], _cover: f.cover });
      setDone(f.url.trim().split('?')[0]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (done) {
    const text = encodeURIComponent(`New photos from Basil Media: ${f.title}\n${done}`);
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-6 text-center">
        <CheckCircle2 size={44} className="text-emerald-600" />
        <b className="text-lg">Gallery is live on the website</b>
        <p className="m-0 text-sm text-basil-muted">It is first on Our Work, marked New, and shown to visitors when they open the site.</p>
        <a href={`https://wa.me/?text=${text}`} target="_blank" rel="noreferrer" className="btn-primary w-full"><Send size={16} />Share on WhatsApp</a>
        <button type="button" className="btn-outline w-full" onClick={() => (setDone(''), setF({ title: '', client: '', url: '', cover: '' }))}>Publish another</button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3.5 rounded-2xl bg-white p-4 sm:p-5">
      <p className="m-0 flex items-start gap-2 text-sm text-basil-muted"><Images size={18} className="mt-0.5 shrink-0 text-basil" />Finished editing and uploaded to Pixieset? Paste the gallery link and it goes live on the website.</p>
      <Field label="Gallery title"><input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. CRDB Bank Marathon 2026" /></Field>
      <Field label="Client / event (optional)"><input className={inputCls} value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })} placeholder="e.g. CRDB Bank Foundation" /></Field>
      <Field label="Pixieset link"><input className={inputCls} inputMode="url" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://basilmedia.pixieset.com/…" /></Field>
      <Field label="Cover photo (the one shown on Pixieset)" hint="Pixieset does not let other sites read its covers, so add it here once.">
        <input type="file" accept="image/*" className="text-sm" onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try { setBusy(true); const url = await uploadFile(file, 'galleries'); setF((x) => ({ ...x, cover: url })); } catch (er) { setErr((er as Error).message); } finally { setBusy(false); }
        }} />
        {f.cover && <img src={f.cover} alt="" className="mt-2 h-24 w-full rounded-xl object-cover" />}
      </Field>
      {err && <p role="alert" className="m-0 text-sm font-bold text-red-700">{err}</p>}
      <button type="button" className="btn-primary" disabled={busy || !f.title || !f.url} onClick={go}>{busy && <Loader2 size={16} className="animate-spin" />}Publish to website</button>
    </div>
  );
}
