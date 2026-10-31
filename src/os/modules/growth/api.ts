// Public (anonymous) calls for showcases and deal rooms. With Supabase these go through
// security-definer SQL functions (get_showcase, get_deal_room, sign_deal_room) and an anon-only insert
// into share_events; in demo mode they read the browser store.
import { supabase } from '@/lib/supabase';
import { demoTable, newId, nowIso, persistDemo } from '@/os/lib/store';
import type { Contract, DealRoom, Proposal, ReferenceItem, Showcase } from './lib';

export interface PublicShowcase { showcase: Showcase; items: ReferenceItem[] }

export async function getShowcase(slug: string): Promise<PublicShowcase | null> {
  if (supabase) {
    const { data, error } = await supabase.rpc('get_showcase', { _slug: slug });
    if (error) throw error;
    return (data as PublicShowcase | null) ?? null;
  }
  const s = demoTable('showcases').find((x) => x.slug === slug && x.published) as unknown as Showcase | undefined;
  if (!s || (s.expires_on && s.expires_on < new Date().toISOString().slice(0, 10))) return null;
  const refs = demoTable('reference_items') as unknown as ReferenceItem[];
  return { showcase: s, items: s.item_ids.map((id) => refs.find((r) => r.id === id && r.cleared)).filter(Boolean) as ReferenceItem[] };
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
  if (supabase) {
    const { error } = await supabase.from('share_events').insert(row);
    if (error) throw error;
    return;
  }
  demoTable('share_events').push({ id: newId(), created_at: nowIso(), ...row });
  persistDemo();
}

export interface PublicDeal { deal: DealRoom; proposal: Proposal | null; contract: Contract | null; showcase_slug: string | null }
export async function getDealRoom(token: string): Promise<PublicDeal | null> {
  if (supabase) {
    const { data, error } = await supabase.rpc('get_deal_room', { _token: token });
    if (error) throw error;
    return (data as PublicDeal | null) ?? null;
  }
  const deal = demoTable('deal_rooms').find((x) => x.token === token) as unknown as DealRoom | undefined;
  if (!deal) return null;
  return {
    deal,
    proposal: (demoTable('proposals').find((p) => p.id === deal.proposal_id) as unknown as Proposal) ?? null,
    contract: (demoTable('contracts').find((c) => c.id === deal.contract_id) as unknown as Contract) ?? null,
    showcase_slug: (demoTable('showcases').find((s) => s.id === deal.showcase_id)?.slug as string) ?? null,
  };
}

/** Typed-name e-signature: stores the name, the server timestamp and the browser user agent. */
export async function signDealRoom(token: string, name: string) {
  const ua = navigator.userAgent.slice(0, 400);
  if (name.trim().length < 3) throw new Error('Type your full name to sign');
  if (supabase) {
    const { error } = await supabase.rpc('sign_deal_room', { _token: token, _name: name.trim(), _user_agent: ua });
    if (error) throw error;
    return;
  }
  const d = demoTable('deal_rooms').find((x) => x.token === token);
  if (!d) throw new Error('Deal room not found');
  if (d.signed_at) throw new Error('Already signed');
  const at = nowIso();
  Object.assign(d, { signed_name: name.trim(), signed_at: at, signed_user_agent: ua, step: Math.max(Number(d.step), 4) });
  const k = demoTable('contracts').find((c) => c.id === d.contract_id);
  if (k) Object.assign(k, { signed_by_name: name.trim(), signed_at: at, signed_user_agent: ua, status: 'active' });
  persistDemo();
}
