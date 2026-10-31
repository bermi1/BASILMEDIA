import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { remove, save } from '@/lib/db';
import { useRows } from '@/hooks/useData';
import type { TableName, Tables } from '@/lib/types';
import { FieldInput, type Field } from './fields';
import { PageTitle } from '../OsLayout';
import { useToast } from './toast';

type AnyRow = Record<string, unknown> & { id: string };

export interface ResourceConfig<T extends TableName> {
  table: T;
  title: string;
  tag: string;
  sub?: string;
  fields: Field[];
  blank: () => Partial<Tables[T]>;
  /** Primary + secondary text for the collapsed row. */
  summary: (r: Tables[T]) => [string, string];
  thumb?: (r: Tables[T]) => string | undefined;
  sortable?: boolean;
  publishable?: boolean;
  searchKeys?: string[];
  readOnlyCreate?: boolean;
  extraActions?: (r: Tables[T]) => React.ReactNode;
}

export function ResourceManager<T extends TableName>(cfg: ResourceConfig<T>) {
  const { rows, loading, error } = useRows(cfg.table);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<AnyRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const toast = useToast();
  const list = rows as unknown as AnyRow[];

  const filtered = useMemo(() => {
    if (!q.trim()) return list;
    const keys = cfg.searchKeys ?? cfg.fields.filter((f) => ['text', 'textarea'].includes(f.type)).map((f) => f.key);
    return list.filter((r) => keys.some((k) => String(r[k] ?? '').toLowerCase().includes(q.toLowerCase())));
  }, [list, q, cfg]);

  const start = (r: AnyRow | null) => {
    if (r) {
      setEditing(r.id);
      setDraft({ ...r });
    } else {
      const maxOrder = Math.max(0, ...list.map((x) => Number(x.sort_order ?? 0)));
      setEditing('new');
      setDraft({ ...(cfg.blank() as AnyRow), ...(cfg.sortable ? { sort_order: maxOrder + 1 } : {}), id: '' });
    }
  };
  const cancel = () => (setEditing(null), setDraft(null));
  const commit = async () => {
    if (!draft) return;
    const missing = cfg.fields.find((f) => f.required && !String(draft[f.key] ?? '').trim());
    if (missing) return toast(`${missing.label} is required`, 'error');
    setBusy(true);
    try {
      const { id, ...rest } = draft;
      await save(cfg.table, (id ? draft : rest) as Partial<Tables[T]>);
      toast('Saved ✓');
      cancel();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const del = async (r: AnyRow) => {
    if (!confirm(`Delete “${cfg.summary(r as unknown as Tables[T])[0]}”? This cannot be undone.`)) return;
    try {
      await remove(cfg.table, r.id);
      toast('Deleted');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const move = async (i: number, dir: -1 | 1) => {
    const a = filtered[i], b = filtered[i + dir];
    if (!a || !b) return;
    await save(cfg.table, { id: a.id, sort_order: b.sort_order } as unknown as Partial<Tables[T]>);
    await save(cfg.table, { id: b.id, sort_order: a.sort_order } as unknown as Partial<Tables[T]>);
  };
  const togglePublish = (r: AnyRow) => save(cfg.table, { id: r.id, published: !r.published } as unknown as Partial<Tables[T]>).then(() => toast(r.published ? 'Hidden from website' : 'Published ✓'));

  const editor = draft && (
    <div className="rounded-2xl border-2 border-basil/40 bg-white p-5 shadow-card">
      <div className="grid gap-4 md:grid-cols-2">
        {cfg.fields.map((f) => (
          <div key={f.key} className={`flex flex-col gap-1.5 ${f.wide || ['textarea', 'image', 'video', 'list', 'multiselect', 'file'].includes(f.type) ? 'md:col-span-2' : ''}`}>
            <span className="text-sm font-bold text-[#33465F]">{f.label}{f.required && <span className="text-red-600"> *</span>}</span>
            <FieldInput f={f} value={draft[f.key]} onChange={(v) => setDraft({ ...draft, [f.key]: v })} />
            {f.help && <span className="text-xs text-basil-muted">{f.help}</span>}
          </div>
        ))}
      </div>
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={commit} disabled={busy} className="btn-primary h-11 min-h-0">{busy && <Loader2 size={16} className="animate-spin" />}Save</button>
        <button type="button" onClick={cancel} className="btn-outline h-11 min-h-0">Cancel</button>
      </div>
    </div>
  );

  return (
    <>
      <PageTitle tag={cfg.tag} title={cfg.title} sub={cfg.sub}>
        {!cfg.readOnlyCreate && <button type="button" onClick={() => start(null)} disabled={editing === 'new'} className="btn-primary"><Plus size={18} />Add new</button>}
      </PageTitle>
      {error && <div role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      <div className="mb-4 flex max-w-sm items-center gap-2 rounded-xl border border-basil-edge bg-white px-3">
        <Search size={16} className="text-basil-muted" />
        <input aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-10 flex-1 border-0 bg-transparent outline-none" />
      </div>
      {editing === 'new' && <div className="mb-4">{editor}</div>}
      {loading ? (
        <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-white" />)}</div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {filtered.map((r, i) => {
            const [a, b] = cfg.summary(r as unknown as Tables[T]);
            const th = cfg.thumb?.(r as unknown as Tables[T]);
            return editing === r.id ? (
              <li key={r.id}>{editor}</li>
            ) : (
              <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-basil-line bg-white p-3">
                {cfg.thumb && <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-basil-bright to-basil-deep">{th && <img src={th} alt="" className="h-full w-full object-cover" />}</div>}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{a}</div>
                  <div className="truncate text-sm text-basil-muted">{b}</div>
                </div>
                {cfg.publishable && r.published === false && <span className="hidden rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 sm:inline">Hidden</span>}
                {cfg.extraActions?.(r as unknown as Tables[T])}
                <div className="flex shrink-0 gap-1">
                  {cfg.sortable && !q && (
                    <>
                      <IconBtn label="Move up" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={16} /></IconBtn>
                      <IconBtn label="Move down" onClick={() => move(i, 1)} disabled={i === filtered.length - 1}><ArrowDown size={16} /></IconBtn>
                    </>
                  )}
                  {cfg.publishable && <IconBtn label={r.published ? 'Hide from website' : 'Publish'} onClick={() => togglePublish(r)}>{r.published ? <Eye size={16} /> : <EyeOff size={16} />}</IconBtn>}
                  <IconBtn label="Edit" onClick={() => start(r)}><Pencil size={16} /></IconBtn>
                  <IconBtn label="Delete" onClick={() => del(r)} danger><Trash2 size={16} /></IconBtn>
                </div>
              </li>
            );
          })}
          {!filtered.length && <li className="rounded-2xl border border-dashed border-basil-edge bg-white p-10 text-center text-basil-muted">Nothing here yet. {!cfg.readOnlyCreate && 'Press “Add new” to create the first one.'}</li>}
        </ul>
      )}
    </>
  );
}

export function IconBtn({ label, onClick, children, disabled, danger }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={`flex h-9 w-9 items-center justify-center rounded-lg border border-basil-line bg-white disabled:opacity-30 ${danger ? 'text-red-700 hover:bg-red-50' : 'text-basil-deep hover:bg-basil-ice'}`}>
      {children}
    </button>
  );
}
