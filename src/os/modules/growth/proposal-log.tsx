// Proposals are written outside the app. Here we only record that one was sent, to whom, how much,
// the file, and where it stands. One list, one "+" button, tap a stage to move it.
import { useState } from 'react';
import { FileText, Paperclip, Plus } from 'lucide-react';
import { insertRow, updateRow, useTable } from '@/os/lib/store';
import { uploadFile } from '@/lib/storage';
import { useToast } from '@/os/cms/toast';
import { Empty, Field, Pill, Sheet, inputCls, tshShort, type Tone } from '@/os/ui';

const STAGES = ['Sent', 'Working on it', 'Interested', 'Won', 'Lost'] as const;
type Stage = (typeof STAGES)[number];
const TONE: Record<Stage, Tone> = { Sent: 'blue', 'Working on it': 'amber', Interested: 'gold', Won: 'green', Lost: 'grey' };

interface Row { id: string; title: string; client_name: string; amount: number; stage: Stage; file_url: string; note: string; sent_at: string }

export function ProposalLog() {
  const { rows } = useTable<Row>('proposals', { order: 'sent_at', ascending: false });
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'open' | 'closed'>('open');
  const [f, setF] = useState({ client_name: '', title: '', amount: '', file_url: '', note: '' });
  const [busy, setBusy] = useState(false);
  const list = rows.filter((r) => (filter === 'open' ? !['Won', 'Lost'].includes(r.stage) : ['Won', 'Lost'].includes(r.stage)));
  const openValue = rows.filter((r) => !['Won', 'Lost'].includes(r.stage)).reduce((a, r) => a + Number(r.amount || 0), 0);

  const save = async () => {
    if (!f.client_name.trim() || !f.title.trim()) return toast('Add who it was sent to and what it is for', 'error');
    setBusy(true);
    try {
      await insertRow('proposals', { client_name: f.client_name.trim(), title: f.title.trim(), amount: Number(f.amount) || 0, file_url: f.file_url, note: f.note.trim(), stage: 'Sent', status: 'sent' });
      toast('Proposal recorded');
      setF({ client_name: '', title: '', amount: '', file_url: '', note: '' });
      setOpen(false);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const move = async (r: Row, stage: Stage) => {
    try {
      await updateRow('proposals', r.id, { stage, stage_at: new Date().toISOString(), status: stage === 'Won' ? 'accepted' : stage === 'Lost' ? 'declined' : 'sent' });
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-basil-muted">Open: <b className="text-basil-ink">{tshShort(openValue)}</b></div>
        <div role="tablist" className="flex rounded-full bg-white p-1 ring-1 ring-basil-line">
          {(['open', 'closed'] as const).map((k) => (
            <button key={k} role="tab" type="button" aria-selected={filter === k} onClick={() => setFilter(k)} className={`min-h-[36px] rounded-full border-0 px-4 text-sm font-bold ${filter === k ? 'bg-basil text-white' : 'bg-transparent text-basil-deep'}`}>{k === 'open' ? 'In progress' : 'Won / lost'}</button>
          ))}
        </div>
      </div>

      {!list.length && <Empty icon={<FileText />} title={filter === 'open' ? 'No proposals in progress' : 'Nothing won or lost yet'} sub="Record a proposal when you send it." />}
      {list.map((r) => (
        <article key={r.id} className="rounded-2xl border border-basil-line bg-white p-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <b className="block truncate">{r.client_name}</b>
              <span className="block truncate text-sm text-basil-muted">{r.title}{r.amount ? ` · ${tshShort(Number(r.amount))}` : ''}</span>
            </div>
            <Pill tone={TONE[r.stage]}>{r.stage}</Pill>
          </div>
          {r.note && <p className="m-0 mt-2 text-sm text-basil-muted">{r.note}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {STAGES.filter((s) => s !== r.stage).map((s) => (
              <button key={s} type="button" onClick={() => move(r, s)} className="min-h-[36px] rounded-full border border-basil-edge bg-white px-3 text-xs font-bold text-basil-deep">{s}</button>
            ))}
            {r.file_url && <a href={r.file_url} target="_blank" rel="noreferrer" className="ml-auto inline-flex min-h-[36px] items-center gap-1 text-sm font-bold no-underline"><Paperclip size={15} />File</a>}
          </div>
        </article>
      ))}

      <button type="button" onClick={() => setOpen(true)} className="btn-primary"><Plus size={18} />Record a proposal</button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Proposal sent">
        <div className="flex flex-col gap-3">
          <Field label="Sent to"><input className={inputCls} value={f.client_name} onChange={(e) => setF({ ...f, client_name: e.target.value })} placeholder="e.g. Aga Khan Hospital" /></Field>
          <Field label="For"><input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Documentary series 2027" /></Field>
          <Field label="Value (TSH, optional)"><input className={inputCls} inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d]/g, '') })} /></Field>
          <Field label="Proposal file (optional)">
            <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx" className="text-sm" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try { setBusy(true); setF((x) => ({ ...x, file_url: '' })); const url = await uploadFile(file, 'proposals'); setF((x) => ({ ...x, file_url: url })); } catch (err) { toast((err as Error).message, 'error'); } finally { setBusy(false); }
            }} />
          </Field>
          <Field label="Note (optional)"><input className={inputCls} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Who we spoke to, next step" /></Field>
          <button type="button" className="btn-primary" disabled={busy} onClick={save}>Save</button>
        </div>
      </Sheet>
    </div>
  );
}
