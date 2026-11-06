import { supabase } from '@/lib/supabase';

export type NoteKind = 'info' | 'approval' | 'money' | 'task' | 'alert';

/** In-app notification for client-side events (most notifications come from SQL triggers and functions). */
export async function notify(userId: string, title: string, body = '', link = '', kind: NoteKind = 'info') {
  if (!userId) return;
  const { error } = await supabase.rpc('notify', { _user: userId, _title: title, _body: body, _link: link, _kind: kind });
  if (error) console.warn('notify failed', error.message);
}

/** Notify everyone who holds a role (including the GM for the roles they cover). */
export async function notifyRole(role: string, title: string, body = '', link = '', kind: NoteKind = 'info') {
  const { error } = await supabase.rpc('notify_role', { _role: role, _title: title, _body: body, _link: link, _kind: kind });
  if (error) console.warn('notify_role failed', error.message);
}
