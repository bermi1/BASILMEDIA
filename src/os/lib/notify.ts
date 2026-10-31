import { supabase } from '@/lib/supabase';
import { demoTable, newId, nowIso, persistDemo, registerSeed } from './store';

export type NoteKind = 'info' | 'approval' | 'money' | 'task' | 'alert';

/** In-app notification. With Supabase, SQL triggers usually notify; this is for client-side events. */
export async function notify(userId: string, title: string, body = '', link = '', kind: NoteKind = 'info') {
  if (supabase) {
    await supabase.rpc('notify', { _user: userId, _title: title, _body: body, _link: link, _kind: kind });
    return;
  }
  demoTable('notifications').push({ id: newId(), user_id: userId, title, body, link, kind, read_at: null, created_at: nowIso() });
  persistDemo();
}

const ago = (m: number) => new Date(Date.now() - m * 60000).toISOString();
registerSeed('notifications', () => [
  { id: 'n1', user_id: 'u-boss', title: 'Approval needed · TSH 180,000', body: 'Transport · Tanzania Health Summit · recommended by GM/CFO', link: '/app?tab=approvals', kind: 'approval', read_at: null, created_at: ago(12) },
  { id: 'n2', user_id: 'u-boss', title: 'Invoice overdue 14 days', body: 'Bank Foundation · BM-INV-2026-0031 · TSH 4,200,000', link: '', kind: 'alert', read_at: null, created_at: ago(95) },
  { id: 'n3', user_id: 'u-gm', title: 'New money request #0187', body: 'Enock · TSH 180,000 · Transport', link: '/app?tab=review', kind: 'money', read_at: null, created_at: ago(20) },
  { id: 'n4', user_id: 'u-jonathan', title: 'New shoot assigned', body: 'Graduation · Sat 14 Nov · 07:00 · call sheet attached', link: '', kind: 'task', read_at: null, created_at: ago(40) },
  { id: 'n5', user_id: 'u-fin', title: 'Ready to pay', body: 'TSH 180,000 to Enock · BM-REQ-0187', link: '', kind: 'money', read_at: null, created_at: ago(5) },
  { id: 'n6', user_id: 'u-store', title: 'Camera A overdue', body: 'Jonathan · due back 17:00 yesterday', link: '', kind: 'alert', read_at: null, created_at: ago(300) },
]);
