import { CheckCheck, CircleDollarSign, ClipboardList, Info, ShieldAlert, Stamp } from 'lucide-react';
import { useActing } from '@/os/lib/session';
import { updateRow, useTable } from '@/os/lib/store';
import { Empty } from '@/os/ui';
import '@/os/lib/notify';

interface Note { id: string; title: string; body: string; link: string; kind: string; read_at: string | null; created_at: string }
const ICON = { approval: Stamp, money: CircleDollarSign, task: ClipboardList, alert: ShieldAlert, info: Info } as const;

export function timeAgo(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function Alerts() {
  const { userId } = useActing();
  const { rows } = useTable<Note>('notifications', { eq: { user_id: userId }, order: 'created_at', ascending: false, limit: 60 });
  const unread = rows.filter((r) => !r.read_at);
  if (!rows.length) return <Empty icon={<CheckCheck />} title="All caught up" sub="New approvals, tasks and alerts appear here." />;
  return (
    <div className="flex flex-col gap-2">
      {unread.length > 0 && <button type="button" onClick={() => Promise.all(unread.map((n) => updateRow('notifications', n.id, { read_at: new Date().toISOString() })))} className="self-end border-0 bg-transparent text-sm font-bold text-basil">Mark all read</button>}
      {rows.map((n) => {
        const Icon = ICON[n.kind as keyof typeof ICON] ?? Info;
        return (
          <button key={n.id} type="button" onClick={() => { if (!n.read_at) updateRow('notifications', n.id, { read_at: new Date().toISOString() }); if (n.link) location.assign(n.link); }} className={`flex items-start gap-3 rounded-2xl border p-3 text-left ${n.read_at ? 'border-basil-line bg-white' : 'border-basil-edge bg-basil-ice/60'}`}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${n.kind === 'alert' ? 'bg-red-50 text-red-700' : 'bg-white text-basil'}`}><Icon size={18} /></span>
            <span className="min-w-0 flex-1"><b className="block text-[15px] leading-snug">{n.title}</b><span className="block text-sm text-basil-muted">{n.body}</span><span className="text-xs text-basil-muted">{timeAgo(n.created_at)}</span></span>
            {!n.read_at && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-basil" aria-label="unread" />}
          </button>
        );
      })}
    </div>
  );
}
