// Public (anonymous) calls for showcases and deal rooms: security-definer SQL functions
// (get_showcase, get_deal_room, sign_deal_room) and an insert-only share_events table.
import { supabase } from '@/lib/supabase';
import { newId } from '@/os/lib/store';
import type { Contract, DealRoom, Proposal, ReferenceItem, Showcase } from './lib';

export interface PublicShowcase { showcase: Showcase; items: ReferenceItem[] }

export async function getShowcase(slug: string): Promise<PublicShowcase | null> {
  const { data, error } = await supabase.rpc('get_showcase', { _slug: slug });
  if (error) throw error;
  return (data as PublicShowcase | null) ?? null;
}

const visitor = () => {
  try {
    let v = localStorage.getItem('bm-visitor');
    if (!v) localStorage.setItem('bm-visitor', (v = newId()));
    return v;
  } catch {
    return 'anon';
  }
};

/** Lead signal: view, "I like this", "I need something like this", or a CTA click. Insert only — visitors never read events back. */
export async function logShareEvent(showcaseId: string, kind: 'view' | 'like' | 'need' | 'cta', itemId: string | null = null) {
  const row = { showcase_id: showcaseId, kind, item_id: itemId, visitor_id: visitor(), user_agent: navigator.userAgent.slice(0, 250) };
  const { error } = await supabase.from('share_events').insert(row);
  if (error) throw error;
  return;
}

export interface PublicDeal { deal: DealRoom; proposal: Proposal | null; contract: Contract | null; showcase_slug: string | null }
export async function getDealRoom(token: string): Promise<PublicDeal | null> {
  const { data, error } = await supabase.rpc('get_deal_room', { _token: token });
  if (error) throw error;
  return (data as PublicDeal | null) ?? null;
}

/** Typed-name e-signature: stores the name, the server timestamp and the browser user agent. */
export async function signDealRoom(token: string, name: string) {
  const ua = navigator.userAgent.slice(0, 400);
  if (name.trim().length < 3) throw new Error('Type your full name to sign');
  const { error } = await supabase.rpc('sign_deal_room', { _token: token, _name: name.trim(), _user_agent: ua });
  if (error) throw error;
  return;
}
