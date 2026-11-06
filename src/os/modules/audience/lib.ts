// Audience engine: types, SMS maths, merge fields, recipients, settings and the campaign workflow
// (Supabase: SQL functions + send-campaign edge function; demo: JS twins that simulate delivery).
import { useEffect, useMemo, useState } from 'react';
import { isDemo, supabase } from '@/lib/supabase';
import { list, save, submit, subscribe } from '@/lib/db';
import type { Subscriber } from '@/lib/types';
import { demoTable, insertRow, newId, nowIso, onChange, persistDemo, rpc, updateRow, useTable } from '@/os/lib/store';
import { notify } from '@/os/lib/notify';
import { DEMO_SUBSCRIBERS } from './seed';

export type Channel = 'sms' | 'email' | 'whatsapp';
export type CampaignStatus = 'Draft' | 'Awaiting approval' | 'Approved' | 'Rejected' | 'Scheduled' | 'Sending' | 'Sent' | 'Cancelled';
export interface SegmentFilters { specialty?: string[]; region?: string[]; language?: string[]; channel?: string[]; status?: string[]; sector?: string[] }
export interface Segment { id: string; name: string; description: string; filters: SegmentFilters; created_at: string }
export interface Campaign {
  id: string; name: string; channel: Channel; audience_type: 'segment' | 'manual' | 'pasted'; segment_id: string | null;
  subscriber_ids: string[]; pasted_list: string[]; subject: string; body_en: string; body_sw: string; status: CampaignStatus;
  scheduled_at: string | null; audience_count: number; est_cost: number; sent: number; delivered: number; failed: number;
  opted_out: number; clicks: number; cost: number; requires_approval: boolean; approved_by: string | null; approved_at: string | null;
  decision_note: string; created_by: string | null; sent_at: string | null; created_at: string;
}
export interface CampaignMessage {
  id: string; campaign_id: string; subscriber_id: string | null; to_address: string; name: string; language: 'en' | 'sw'; body: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'opted_out'; provider: string; provider_ref: string; error: string; parts: number; cost: number;
  clicked_at: string | null; sent_at: string | null; delivered_at: string | null; created_at: string;
}
export interface Template { id: string; key?: string; name: string; category: string; channel: Channel; subject: string; body_en: string; body_sw: string; created_at: string }
export interface InboxMsg { id: string; from_phone: string; body: string; subscriber_id: string | null; campaign_id: string | null; received_at: string; handled: boolean; auto_action: string }
export interface Automation { id: string; key: string; name: string; description: string; trigger: 'subscribe' | 'event_before'; offset_days: number; channel: Channel; template_id: string | null; enabled: boolean; sent_count: number; last_run_at: string | null }
export interface SmsSettings {
  provider: 'beem' | 'africastalking' | 'nextsms'; sender_id: string; cost_per_sms: number; cost_per_whatsapp: number;
  email_provider: 'resend' | 'smtp'; email_from: string; whatsapp_phone_id: string; approval_threshold: number; require_approval: boolean;
  batch_size: number; batch_delay_ms: number; test_number: string;
}
export const DEFAULT_SMS: SmsSettings = {
  provider: 'beem', sender_id: 'BASILMEDIA', cost_per_sms: 28, cost_per_whatsapp: 60, email_provider: 'resend',
  email_from: 'Basil Health Brief <brief@basilmedia.co.tz>', whatsapp_phone_id: '', approval_threshold: 500, require_approval: true,
  batch_size: 50, batch_delay_ms: 1000, test_number: '',
};
export const AUDIENCE_ROLES = ['growth', 'gm_cfo', 'boss'] as const;
export const CHANNEL_LABEL: Record<Channel, string> = { sms: 'SMS', email: 'Email', whatsapp: 'WhatsApp' };
export const STATUS_TONE: Record<CampaignStatus, 'green' | 'amber' | 'red' | 'blue' | 'grey'> = {
  Draft: 'grey', 'Awaiting approval': 'amber', Approved: 'green', Rejected: 'red', Scheduled: 'blue', Sending: 'amber', Sent: 'green', Cancelled: 'grey',
};

// ---------------------------------------------------------------- SMS maths
const GSM = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXT = '^{}\\[~]|€\f';
export interface SmsInfo { encoding: 'GSM-7' | 'Unicode'; length: number; parts: number; perPart: number; remaining: number; offending: string[] }
export function smsInfo(text: string): SmsInfo {
  let units = 0;
  const off = new Set<string>();
  for (const ch of text) {
    if (GSM.includes(ch)) units++;
    else if (GSM_EXT.includes(ch)) units += 2;
    else off.add(ch);
  }
  if (off.size) {
    const n = text.length; // UCS-2 code units
    const parts = n <= 70 ? 1 : Math.ceil(n / 67), per = parts === 1 ? 70 : 67;
    return { encoding: 'Unicode', length: n, parts: Math.max(1, parts), perPart: per, remaining: parts * per - n, offending: [...off] };
  }
  const parts = units <= 160 ? 1 : Math.ceil(units / 153), per = parts === 1 ? 160 : 153;
  return { encoding: 'GSM-7', length: units, parts: Math.max(1, parts), perPart: per, remaining: parts * per - units, offending: [] };
}

// ---------------------------------------------------------------- merge fields & addresses
export const firstName = (full: string) => full.replace(/^\s*(dr|prof|mr|mrs|ms|dkt|sr)\.?\s+/i, '').split(/\s+/)[0] ?? '';
export interface MergeData { full_name: string; title: string; institution: string }
export const merge = (t: string, r: MergeData) =>
  t.replace(/\{(first_name|title|institution)\}/g, (_, k: string) => (k === 'first_name' ? firstName(r.full_name) : k === 'title' ? r.title : r.institution) || '').replace(/ {2,}/g, ' ').trim();
export function normPhone(s: string) {
  let p = s.replace(/[^0-9]/g, '');
  if (/^0[67]\d{8}$/.test(p)) p = '255' + p.slice(1);
  return /^255[67]\d{8}$/.test(p) ? '+' + p : '';
}
export const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());
export function parsePasted(text: string, channel: Channel) {
  const ok: string[] = [], bad: string[] = [];
  for (const raw of text.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean)) {
    const a = channel === 'email' ? (isEmail(raw) ? raw.toLowerCase() : '') : normPhone(raw);
    if (a) { if (!ok.includes(a)) ok.push(a); } else bad.push(raw);
  }
  return { ok, bad };
}

// ---------------------------------------------------------------- dates (Africa/Dar_es_Salaam, UTC+3, no DST)
export const darFmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
export const darLocalToIso = (v: string) => new Date(`${v}:00+03:00`).toISOString();
export const isoToDarLocal = (iso: string) => new Date(new Date(iso).getTime() + 3 * 36e5).toISOString().slice(0, 16);

// ---------------------------------------------------------------- subscribers (website store)
let seeding: Promise<void> | null = null;
const SEED_FLAG = 'basil-audience-subs-seeded';
function seedDemoSubscribers() {
  if (seeding) return seeding;
  let done = false;
  try { done = localStorage.getItem(SEED_FLAG) === '1'; localStorage.setItem(SEED_FLAG, '1'); } catch { /* ignore */ }
  seeding = done ? Promise.resolve() : (async () => { for (const s of DEMO_SUBSCRIBERS) await submit('subscribers', s); })();
  return seeding;
}
export function useSubscribers() {
  const [rows, setRows] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        let r = await list('subscribers');
        if (isDemo && r.length === 0) { await seedDemoSubscribers(); r = await list('subscribers'); }
        if (alive) setRows(r);
      } catch { /* RLS or offline: keep last */ }
      if (alive) setLoading(false);
    };
    load();
    const a = subscribe(load), b = onChange(load);
    return () => { alive = false; a(); b(); };
  }, []);
  return { subscribers: rows, loading };
}
export const deliverable = (s: Subscriber) => s.status !== 'unsubscribed' && s.status !== 'paused';
export function matches(s: Subscriber, f: SegmentFilters) {
  const has = (a?: string[]) => !!a && a.length > 0;
  if (has(f.specialty) && !(s.specialties ?? []).some((x) => f.specialty!.includes(x))) return false;
  for (const k of ['region', 'language', 'channel', 'status', 'sector'] as const) if (has(f[k]) && !f[k]!.includes(String(s[k]))) return false;
  return true;
}
export function facets(subs: Subscriber[]) {
  const u = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort();
  return {
    specialty: u(subs.flatMap((s) => s.specialties ?? [])), region: u(subs.map((s) => s.region)), language: ['en', 'sw'],
    channel: ['sms', 'email', 'whatsapp'], status: ['active', 'pending', 'paused', 'unsubscribed'], sector: u(subs.map((s) => s.sector)),
  };
}

export interface Recipient { subscriber_id: string | null; name: string; title: string; institution: string; language: 'en' | 'sw'; address: string }
export function resolveRecipients(c: Pick<Campaign, 'channel' | 'audience_type' | 'segment_id' | 'subscriber_ids' | 'pasted_list'>, subs: Subscriber[], segments: Segment[]): Recipient[] {
  const addr = (s: Subscriber) => (c.channel === 'email' ? (s.email ?? '').toLowerCase() : normPhone(s.phone ?? ''));
  let picked: Subscriber[] = [];
  const extra: Recipient[] = [];
  if (c.audience_type === 'segment') {
    const seg = segments.find((x) => x.id === c.segment_id);
    picked = seg ? subs.filter((s) => matches(s, seg.filters ?? {})) : [];
  } else if (c.audience_type === 'manual') {
    const ids = new Set(c.subscriber_ids ?? []);
    picked = subs.filter((s) => ids.has(s.id));
  } else {
    for (const a of c.pasted_list ?? []) {
      const s = subs.find((x) => addr(x) === a);
      if (s) picked.push(s);
      else extra.push({ subscriber_id: null, name: '', title: '', institution: '', language: 'en', address: a });
    }
  }
  const seen = new Set<string>(), out: Recipient[] = [];
  for (const s of picked.filter(deliverable)) {
    const a = addr(s);
    if (!a || seen.has(a)) continue;
    seen.add(a);
    out.push({ subscriber_id: s.id, name: s.full_name, title: s.title, institution: s.institution, language: s.language, address: a });
  }
  for (const r of extra) if (!seen.has(r.address)) { seen.add(r.address); out.push(r); }
  return out;
}
export const bodyFor = (c: Pick<Campaign, 'body_en' | 'body_sw'>, r: Recipient) => merge(r.language === 'sw' && c.body_sw.trim() ? c.body_sw : c.body_en, { full_name: r.name, title: r.title, institution: r.institution });
export function estimate(c: Pick<Campaign, 'channel' | 'body_en' | 'body_sw'>, recips: Recipient[], s: SmsSettings) {
  if (c.channel === 'email') return { parts: recips.length, cost: 0 };
  if (c.channel === 'whatsapp') return { parts: recips.length, cost: recips.length * s.cost_per_whatsapp };
  const parts = recips.reduce((a, r) => a + smsInfo(bodyFor(c, r)).parts, 0);
  return { parts, cost: parts * s.cost_per_sms };
}

// ---------------------------------------------------------------- settings
export function useSmsSettings(): SmsSettings {
  const { rows } = useTable<{ key: string; value: unknown }>('app_settings', { eq: { key: 'sms_settings' } });
  return useMemo(() => {
    let v = rows[0]?.value;
    if (typeof v === 'string') try { v = JSON.parse(v); } catch { v = {}; }
    return { ...DEFAULT_SMS, ...((v as object) ?? {}) };
  }, [rows]);
}
export async function saveSmsSettings(value: SmsSettings) {
  if (supabase) {
    const { error } = await supabase.from('app_settings').upsert({ key: 'sms_settings', value, updated_at: nowIso() });
    if (error) throw error;
    return;
  }
  const rows = demoTable('app_settings');
  const i = rows.findIndex((r) => r.key === 'sms_settings');
  if (i >= 0) rows[i] = { ...rows[i], value };
  else rows.push({ id: 'sms_settings', key: 'sms_settings', value });
  persistDemo();
}

// ---------------------------------------------------------------- workflow
const demoCampaign = (id: string) => demoTable('campaigns').find((r) => r.id === id) as unknown as Campaign | undefined;

/** Draft → Awaiting approval (audience above threshold) / Scheduled / Approved (ready to send now). */
export function submitCampaign(c: Campaign, s: SmsSettings, scheduledIso: string | null) {
  return rpc<CampaignStatus>('audience_submit_campaign', { _id: c.id, _scheduled_at: scheduledIso }, async () => {
    const need = s.require_approval && c.audience_count > s.approval_threshold && !c.approved_at;
    const next: CampaignStatus = need ? 'Awaiting approval' : scheduledIso && new Date(scheduledIso) > new Date() ? 'Scheduled' : 'Approved';
    await updateRow('campaigns', c.id, { status: next, scheduled_at: scheduledIso, requires_approval: need });
    if (need) await notify('u-gm', 'Campaign awaiting approval', `${c.name} · ${c.audience_count} recipients`, `/os/audience/campaigns/${c.id}`, 'approval');
    return next;
  });
}

/** GM/CFO or Boss approves/rejects; the creator cannot approve their own campaign. */
export function decideCampaign(c: Campaign, approve: boolean, note: string, userId: string) {
  return rpc<CampaignStatus>('audience_decide_campaign', { _id: c.id, _approve: approve, _note: note }, async () => {
    if (c.status !== 'Awaiting approval') throw new Error('Campaign is not awaiting approval');
    if (c.created_by === userId) throw new Error('You cannot approve a campaign you created');
    const next: CampaignStatus = !approve ? 'Rejected' : c.scheduled_at && new Date(c.scheduled_at) > new Date() ? 'Scheduled' : 'Approved';
    await updateRow('campaigns', c.id, { status: next, decision_note: note, approved_by: approve ? userId : null, approved_at: approve ? nowIso() : null });
    if (c.created_by) await notify(c.created_by, `Campaign ${next.toLowerCase()}`, c.name + (note ? ` · ${note}` : ''), `/os/audience/campaigns/${c.id}`, 'approval');
    return next;
  });
}

async function invoke(body: Record<string, unknown>) {
  const { data, error } = await supabase!.functions.invoke('send-campaign', { body });
  if (error) throw new Error((data as { error?: string } | null)?.error ?? error.message);
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as Record<string, unknown>;
}

export async function sendTest(to: string, channel: Channel, subject: string, body: string) {
  const addr = channel === 'email' ? (isEmail(to) ? to.trim() : '') : normPhone(to);
  if (!addr) throw new Error(channel === 'email' ? 'Enter a valid email for the test' : 'Enter a valid +255 number for the test');
  if (supabase) return invoke({ test: { to: addr, channel, subject, body } });
  await new Promise((r) => setTimeout(r, 500));
  return { ok: true, simulated: true };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function recomputeDemo(id: string, final?: Partial<Campaign>) {
  const msgs = demoTable('campaign_messages').filter((m) => m.campaign_id === id) as unknown as CampaignMessage[];
  const n = (st: string) => msgs.filter((m) => m.status === st).length;
  return updateRow('campaigns', id, {
    sent: msgs.filter((m) => m.status === 'sent' || m.status === 'delivered').length, delivered: n('delivered'), failed: n('failed'),
    clicks: msgs.filter((m) => m.clicked_at).length, cost: msgs.reduce((a, m) => a + Number(m.cost ?? 0), 0), ...final,
  });
}

/** Send now (or retry failed). Supabase: edge function. Demo: simulated delivery with realistic outcomes. */
export async function sendCampaign(c: Campaign, opts: { retryFailed?: boolean; subs: Subscriber[]; segments: Segment[]; settings: SmsSettings }) {
  if (supabase) return invoke({ campaign_id: c.id, retry_failed: !!opts.retryFailed });
  const s = opts.settings;
  const unit = c.channel === 'sms' ? s.cost_per_sms : c.channel === 'whatsapp' ? s.cost_per_whatsapp : 0;
  const provider = c.channel === 'email' ? 'resend' : c.channel === 'whatsapp' ? 'whatsapp' : s.provider;
  if (opts.retryFailed) {
    const failed = demoTable('campaign_messages').filter((m) => m.campaign_id === c.id && m.status === 'failed');
    await sleep(700);
    for (const m of failed) Object.assign(m, Math.random() < 0.6 ? { status: 'delivered', error: '', cost: Number(m.parts) * unit, delivered_at: nowIso() } : { error: 'Still unreachable' });
    await recomputeDemo(c.id);
    return { retried: failed.length };
  }
  const cur = demoCampaign(c.id) ?? c;
  if (!['Approved', 'Scheduled'].includes(cur.status)) throw new Error(`Campaign is ${cur.status}; submit it first`);
  const recips = resolveRecipients(c, opts.subs, opts.segments);
  if (s.require_approval && recips.length > s.approval_threshold && !cur.approved_at) {
    await updateRow('campaigns', c.id, { status: 'Awaiting approval', requires_approval: true, audience_count: recips.length });
    return { awaiting_approval: true };
  }
  await updateRow('campaigns', c.id, { status: 'Sending', audience_count: recips.length });
  await sleep(1200);
  const table = demoTable('campaign_messages');
  let optedOut = 0;
  for (const r of recips) {
    const body = bodyFor(c, r), parts = c.channel === 'sms' ? smsInfo(body).parts : 1, x = Math.random();
    const status = c.channel === 'whatsapp' ? 'failed' : x < 0.88 ? 'delivered' : x < 0.94 ? 'sent' : 'failed';
    const err = c.channel === 'whatsapp' ? 'WhatsApp adapter not enabled yet' : status === 'failed' ? (x < 0.97 ? 'Absent subscriber' : 'Number not reachable') : '';
    table.push({
      id: newId(), campaign_id: c.id, subscriber_id: r.subscriber_id, to_address: r.address, name: r.name, language: r.language, body, status,
      provider, provider_ref: `DEMO-${Math.floor(Math.random() * 1e8)}`, error: err, parts, cost: status === 'failed' ? 0 : parts * unit,
      clicked_at: status === 'delivered' && /https?:|\.co\.tz|\.com/.test(body) && Math.random() < 0.15 ? nowIso() : null,
      sent_at: nowIso(), delivered_at: status === 'delivered' ? nowIso() : null, created_at: nowIso(),
    });
    if (c.channel === 'sms' && status === 'delivered' && r.subscriber_id && Math.random() < 0.02) {
      optedOut++;
      await receiveReply(r.address, 'STOP', c.id);
    }
  }
  await recomputeDemo(c.id, { status: 'Sent', sent_at: nowIso(), opted_out: (cur.opted_out ?? 0) + optedOut });
  return { recipients: recips.length };
}

/** Demo only: scheduled campaigns whose time has come are sent when the campaigns page is open. */
export async function runDueDemo(subs: Subscriber[], segments: Segment[], settings: SmsSettings) {
  if (!isDemo || !subs.length) return;
  const due = (demoTable('campaigns') as unknown as Campaign[]).filter((c) => c.status === 'Scheduled' && c.scheduled_at && new Date(c.scheduled_at) <= new Date());
  for (const c of due) await sendCampaign(c, { subs, segments, settings }).catch(() => {});
}

export function optOut(phone: string) {
  return rpc<number>('opt_out_subscriber', { _phone: phone }, async () => {
    const p = normPhone(phone);
    const subs = (await list('subscribers')).filter((s) => s.phone === p && s.status !== 'unsubscribed');
    for (const s of subs) await save('subscribers', { ...s, status: 'unsubscribed' });
    return subs.length;
  });
}
export const isStop = (body: string) => /^\s*(stop|unsubscribe|acha|sitisha|jiondoe)\b/i.test(body);

/** Log an inbound reply. In SQL a trigger links the subscriber and handles STOP; demo mirrors it. */
export async function receiveReply(from: string, body: string, campaignId: string | null = null) {
  const phone = normPhone(from) || from;
  if (supabase) return insertRow('sms_inbox', { from_phone: phone, body, campaign_id: campaignId });
  const sub = (await list('subscribers')).find((s) => s.phone === phone);
  const stop = isStop(body);
  if (stop) await optOut(phone);
  return insertRow('sms_inbox', { from_phone: phone, body, subscriber_id: sub?.id ?? null, campaign_id: campaignId, received_at: nowIso(), handled: stop, auto_action: stop ? 'Unsubscribed' : '' });
}

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
