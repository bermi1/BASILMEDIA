import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { supabase, isDemo } from '@/lib/supabase';
import { ROLE_LABEL } from '@/lib/auth';
import type { AppRole } from '@/lib/types';
import { PageTitle } from './OsLayout';
import { useToast } from './cms/toast';
import { Avatar, Card, Empty, Pill } from './ui';

const ROLES = Object.keys(ROLE_LABEL) as AppRole[];
interface U { id: string; email: string; full_name: string; phone: string; roles: AppRole[] }

export default function UsersAdmin() {
  const [users, setUsers] = useState<U[] | null>(null);
  const [busy, setBusy] = useState('');
  const toast = useToast();
  const load = () => supabase?.rpc('admin_list_users').then(({ data, error }) => (error ? toast(error.message, 'error') : setUsers(data as U[])));
  useEffect(() => void load(), []);
  const toggle = async (u: U, r: AppRole) => {
    if (!supabase) return;
    const grant = !u.roles.includes(r);
    setBusy(u.id + r);
    const { error } = await supabase.rpc('admin_set_role', { _email: u.email, _role: r, _grant: grant });
    setBusy('');
    if (error) return toast(error.message, 'error');
    toast(`${grant ? 'Granted' : 'Removed'} ${ROLE_LABEL[r]} for ${u.email}`);
    load();
  };
  return (
    <>
      <PageTitle tag="PLATFORM · SECURITY" title="Users & roles" sub="People sign up at /login; the Super Admin then gives them roles. Every change is written to the audit log." />
      {isDemo ? (
        <Empty icon={<ShieldCheck />} title="Connect Supabase to manage real users" sub="In demo mode the Super Admin can try every role from the phone app (More → Switch portal)." action={<a className="btn-primary" href="/app">Open phone app</a>} />
      ) : !users ? (
        <Loader2 className="animate-spin text-basil" />
      ) : (
        <div className="flex flex-col gap-3">
          {users.map((u) => (
            <Card key={u.id}>
              <div className="mb-3 flex items-center gap-3">
                <Avatar name={u.full_name || u.email} />
                <div className="min-w-0 flex-1"><b className="block truncate">{u.full_name || '—'}</b><span className="text-sm text-basil-muted">{u.email}</span></div>
                {u.roles.length === 0 && <Pill tone="amber">Waiting for a role</Pill>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ROLES.map((r) => {
                  const on = u.roles.includes(r);
                  return (
                    <button key={r} type="button" aria-pressed={on} disabled={!!busy} onClick={() => toggle(u, r)} className={`flex min-h-[36px] items-center gap-1 rounded-full px-3 text-sm font-semibold ${on ? 'border-0 bg-basil text-white' : 'border border-basil-edge bg-white text-basil-deep'}`}>
                      {busy === u.id + r && <Loader2 size={14} className="animate-spin" />}{ROLE_LABEL[r]}
                    </button>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
