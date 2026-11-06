// Portal access: the Boss or GM/CFO gives a person an extra portal — company-wide or for ONE project
// (e.g. a crew member who leads a project, or drives for it). Supabase: grant_portal / revoke_portal.
import { useState } from 'react';
import { CalendarClock, KeyRound, Plus, Trash2 } from 'lucide-react';
import { GRANTABLE, IMPLIED_ROLES } from '@/lib/roles';
import type { AppRole } from '@/lib/types';
import { PageTitle } from './OsLayout';
import { useToast } from './cms/toast';
import { Avatar, Card, Empty, Field, Pill, Sheet, inputCls } from './ui';
import { personName, rpc, useTable, usePeople } from './lib/store';
import { useActing } from './lib/session';
import { portalMeta } from './PortalSwitcher';

export interface PortalGrant { id: string; user_id: string; role: AppRole; project_id: string | null; note: string; expires_at: string | null; granted_by: string; created_at: string }

export async function grantPortal(g: { user_id: string; role: AppRole; project_id: string | null; expires_at: string | null; note: string }) {
  return rpc('grant_portal', { _user: g.user_id, _role: g.role, _project: g.project_id, _expires: g.expires_at, _note: g.note });
}
export const revokePortal = (id: string) => rpc('revoke_portal', { _id: id });

export function PortalAccessPanel() {
  const { userId, canAny } = useActing();
  const people = usePeople();
  const { rows: grants } = useTable<PortalGrant>('portal_grants', { order: 'created_at', ascending: false });
  const { rows: projects } = useTable<{ id: string; name: string; stage: string }>('projects', { order: 'name' });
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const blank = { user_id: '', role: 'project_lead' as AppRole, project_id: '', expires_at: '', note: '' };
  const [f, setF] = useState(blank);
  const today = new Date().toISOString().slice(0, 10);
  const staff = people.filter((p) => !p.roles.every((r) => r === 'client') && p.id !== userId);

  if (!canAny('boss', 'gm_cfo')) return <Empty icon={<KeyRound />} title="Only the Boss or GM/CFO gives portal access" />;

  const save = async () => {
    if (!f.user_id) return toast('Choose a person', 'error');
    try {
      await grantPortal({ user_id: f.user_id, role: f.role, project_id: f.project_id || null, expires_at: f.expires_at || null, note: f.note });
      toast(`${personName(people, f.user_id)} can now open ${portalMeta(f.role).label}${f.project_id ? ` for ${projects.find((p) => p.id === f.project_id)?.name}` : ''}`);
      setOpen(false);
      setF(blank);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <b>GM/CFO also covers:</b>
          {(IMPLIED_ROLES.gm_cfo ?? []).map((r) => <Pill key={r} tone="blue">{portalMeta(r).label}</Pill>)}
          <Pill tone="blue">Logistics &amp; transport</Pill>
          <span className="text-basil-muted">— one person, separate portals, switch at the top.</span>
        </div>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 text-base font-extrabold">Extra portals given ({grants.length})</h2>
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}><Plus size={18} />Give access</button>
      </div>

      {grants.length === 0 && <Empty icon={<KeyRound />} title="No extra portals yet" sub="Give a crew member the Project Lead portal for one project, or the Driver portal for trips." />}
      <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
        {grants.map((g) => {
          const m = portalMeta(g.role);
          const proj = projects.find((p) => p.id === g.project_id);
          const expired = !!g.expires_at && g.expires_at < today;
          return (
            <div key={g.id} className="flex min-w-0 items-start gap-3 rounded-2xl border border-basil-line bg-white p-4">
              <Avatar name={personName(people, g.user_id)} size={42} />
              <div className="min-w-0 flex-1">
                <b className="block truncate">{personName(people, g.user_id)}</b>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold text-white" style={{ background: m.accent }}><m.Icon size={12} />{m.label}</span>
                  <span className="max-w-full truncate"><Pill tone={g.project_id ? 'gold' : 'grey'}>{g.project_id ? `Only ${proj?.name ?? 'one project'}` : 'Whole company'}</Pill></span>
                  {g.expires_at && <Pill tone={expired ? 'red' : 'amber'}><CalendarClock size={12} />{expired ? 'Expired' : 'Until'} {g.expires_at}</Pill>}
                </div>
                {g.note && <p className="m-0 mt-1.5 text-sm text-basil-muted">{g.note}</p>}
              </div>
              <button type="button" aria-label={`Remove ${m.label} access for ${personName(people, g.user_id)}`} onClick={async () => { if (!confirm('Remove this access?')) return; try { await revokePortal(g.id); toast('Access removed'); } catch (e) { toast((e as Error).message, 'error'); } }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-basil-edge bg-white text-red-700"><Trash2 size={18} /></button>
            </div>
          );
        })}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Give portal access">
        <div className="flex flex-col gap-3.5">
          <Field label="Person">
            <select className={inputCls} value={f.user_id} onChange={(e) => setF({ ...f, user_id: e.target.value })}>
              <option value="">Choose…</option>
              {staff.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </Field>
          <Field label="Portal">
            <div className="grid grid-cols-2 gap-2">
              {GRANTABLE.map((r) => {
                const m = portalMeta(r);
                const on = f.role === r;
                return (
                  <button key={r} type="button" aria-pressed={on} onClick={() => setF({ ...f, role: r })} className={`flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-left text-sm font-bold ${on ? 'border-0 text-white' : 'border border-basil-edge bg-white text-basil-ink'}`} style={on ? { background: m.accent } : undefined}>
                    <m.Icon size={16} />{m.label}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Limit to one project" hint="Leave as “Whole company” for full access to this portal.">
            <select className={inputCls} value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}>
              <option value="">Whole company</option>
              {projects.filter((p) => p.stage !== 'Archive').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Until (optional)"><input type="date" className={inputCls} min={today} value={f.expires_at} onChange={(e) => setF({ ...f, expires_at: e.target.value })} /></Field>
          <Field label="Why (optional)"><input className={inputCls} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Leads the bank shoot while Enock is away" /></Field>
          <button type="button" className="btn-primary mt-1" onClick={save}>Give access</button>
        </div>
      </Sheet>
    </div>
  );
}

export default function AccessAdmin() {
  return (
    <>
      <PageTitle tag="PLATFORM · ACCESS" title="Portal access" sub="Give a person an extra portal for the whole company or for one project. They switch portals from the top of the app." />
      <PortalAccessPanel />
    </>
  );
}
