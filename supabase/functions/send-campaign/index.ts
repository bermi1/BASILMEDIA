// Audience engine sender. Sends a campaign (or a test message) through the provider chosen in
// app_settings.sms_settings. API keys are Supabase function secrets, never app_settings:
//   supabase secrets set BEEM_API_KEY=… BEEM_SECRET=… AT_USERNAME=… AT_API_KEY=… RESEND_API_KEY=…
//   optional: NEXTSMS_USERNAME, NEXTSMS_PASSWORD, WHATSAPP_TOKEN, CRON_SECRET, INBOUND_TOKEN
// Calls:
//   POST { campaign_id }                       send an Approved/Scheduled campaign now
//   POST { campaign_id, retry_failed: true }   re-send failed messages
//   POST { test: { to, channel, subject, body } }  one test message
//   POST { run_due: true } + header x-cron-secret   send every Scheduled campaign that is due (pg_cron / scheduler)
//   POST ?hook=inbound&token=INBOUND_TOKEN      provider inbound SMS webhook → sms_inbox (STOP opts out in SQL)
//   POST ?hook=dlr&token=INBOUND_TOKEN          provider delivery report → campaign_messages status
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const env = (k: string) => Deno.env.get(k) ?? '';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- settings & SMS maths
interface Settings {
  provider: 'beem' | 'africastalking' | 'nextsms';
  sender_id: string;
  cost_per_sms: number;
  cost_per_whatsapp: number;
  email_provider: 'resend' | 'smtp';
  email_from: string;
  whatsapp_phone_id: string;
  approval_threshold: number;
  require_approval: boolean;
  batch_size: number;
  batch_delay_ms: number;
}
const DEFAULTS: Settings = { provider: 'beem', sender_id: 'BASILMEDIA', cost_per_sms: 28, cost_per_whatsapp: 60, email_provider: 'resend', email_from: 'Basil Health Brief <brief@basilmedia.co.tz>', whatsapp_phone_id: '', approval_threshold: 500, require_approval: true, batch_size: 50, batch_delay_ms: 1000 };

const GSM = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXT = '^{}\\[~]|€\f';
function smsParts(text: string) {
  let units = 0;
  for (const ch of text) {
    if (GSM.includes(ch)) units++;
    else if (GSM_EXT.includes(ch)) units += 2;
    else return text.length <= 70 ? 1 : Math.ceil(text.length / 67);
  }
  return units <= 160 ? 1 : Math.ceil(units / 153);
}
const normPhone = (s: string) => {
  let p = s.replace(/[^0-9]/g, '');
  if (/^0[67]\d{8}$/.test(p)) p = '255' + p.slice(1);
  return /^255[67]\d{8}$/.test(p) ? '+' + p : '';
};
const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());
const firstName = (full: string) => full.replace(/^\s*(dr|prof|mr|mrs|ms|dkt|sr)\.?\s+/i, '').split(/\s+/)[0] ?? '';
const merge = (t: string, r: { full_name: string; title: string; institution: string }) =>
  t.replace(/\{(first_name|title|institution)\}/g, (_, k) => (k === 'first_name' ? firstName(r.full_name) : k === 'title' ? r.title : r.institution) || '').replace(/ {2,}/g, ' ').trim();

// ---------------------------------------------------------------- provider adapters
interface SendResult { ok: boolean; ref?: string; error?: string; cost?: number }
interface Adapter { name: string; send(to: string, body: string, subject?: string): Promise<SendResult> }

const beem = (s: Settings): Adapter => ({
  name: 'beem',
  async send(to, body) {
    const r = await fetch('https://apisms.beem.africa/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + btoa(`${env('BEEM_API_KEY')}:${env('BEEM_SECRET')}`) },
      body: JSON.stringify({ source_addr: s.sender_id, schedule_time: '', encoding: 0, message: body, recipients: [{ recipient_id: 1, dest_addr: to.replace('+', '') }] }),
    });
    const j = await r.json().catch(() => ({}));
    return r.ok && j.successful ? { ok: true, ref: String(j.request_id ?? '') } : { ok: false, error: j.message ?? `Beem HTTP ${r.status}` };
  },
});

const africasTalking = (s: Settings): Adapter => ({
  name: 'africastalking',
  async send(to, body) {
    const user = env('AT_USERNAME');
    const host = user === 'sandbox' ? 'api.sandbox.africastalking.com' : 'api.africastalking.com';
    const form = new URLSearchParams({ username: user, to, message: body });
    if (s.sender_id) form.set('from', s.sender_id);
    const r = await fetch(`https://${host}/version1/messaging`, {
      method: 'POST',
      headers: { apiKey: env('AT_API_KEY'), Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    const j = await r.json().catch(() => ({}));
    const rec = j?.SMSMessageData?.Recipients?.[0];
    if (rec && (rec.statusCode === 100 || rec.statusCode === 101 || rec.statusCode === 102)) {
      const cost = Number(String(rec.cost ?? '').replace(/[^0-9.]/g, ''));
      return { ok: true, ref: rec.messageId, cost: Number.isFinite(cost) && cost > 0 ? cost : undefined };
    }
    return { ok: false, error: rec?.status ?? j?.SMSMessageData?.Message ?? `Africa's Talking HTTP ${r.status}` };
  },
});

const nextSms = (s: Settings): Adapter => ({
  name: 'nextsms',
  async send(to, body) {
    const r = await fetch('https://messaging-service.co.tz/api/sms/v1/text/single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Basic ' + btoa(`${env('NEXTSMS_USERNAME')}:${env('NEXTSMS_PASSWORD')}`) },
      body: JSON.stringify({ from: s.sender_id, to: to.replace('+', ''), text: body }),
    });
    const j = await r.json().catch(() => ({}));
    const m = j?.messages?.[0];
    return r.ok && m ? { ok: true, ref: String(m.messageId ?? '') } : { ok: false, error: j?.message ?? `NextSMS HTTP ${r.status}` };
  },
});

const resend = (s: Settings): Adapter => ({
  name: 'resend',
  async send(to, body, subject) {
    if (s.email_provider !== 'resend') return { ok: false, error: 'SMTP sending is not available from edge functions; choose Resend' };
    const html = body.split(/\n{2,}/).map((p) => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>`).join('') +
      '<p style="color:#5B6B80;font-size:12px">You receive this because you subscribed to the Basil Health Brief. Reply STOP to unsubscribe.</p>';
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env('RESEND_API_KEY')}` },
      body: JSON.stringify({ from: s.email_from, to: [to], subject: subject || 'Basil Health Brief', text: body, html }),
    });
    const j = await r.json().catch(() => ({}));
    return r.ok && j.id ? { ok: true, ref: j.id } : { ok: false, error: j.message ?? `Resend HTTP ${r.status}` };
  },
});

// WhatsApp Cloud API: business-initiated messages need Meta-approved templates. Stub until templates are approved.
const whatsapp = (_s: Settings): Adapter => ({
  name: 'whatsapp',
  async send() {
    return { ok: false, error: 'WhatsApp adapter not enabled yet: approve a message template in Meta Business Manager, set WHATSAPP_TOKEN and the phone number ID' };
  },
});

function adapterFor(channel: string, s: Settings): Adapter {
  if (channel === 'email') return resend(s);
  if (channel === 'whatsapp') return whatsapp(s);
  return s.provider === 'africastalking' ? africasTalking(s) : s.provider === 'nextsms' ? nextSms(s) : beem(s);
}

// ---------------------------------------------------------------- campaign sending
interface Sub { id: string; full_name: string; title: string; institution: string; phone: string; email: string; language: 'en' | 'sw'; status: string; specialties: string[]; region: string; channel: string; sector: string }
interface Recipient { subscriber_id: string | null; name: string; title: string; institution: string; language: 'en' | 'sw'; address: string }

async function loadSettings(db: SupabaseClient): Promise<Settings> {
  const { data } = await db.from('app_settings').select('value').eq('key', 'sms_settings').maybeSingle();
  const v = typeof data?.value === 'string' ? JSON.parse(data.value) : data?.value;
  return { ...DEFAULTS, ...(v ?? {}) };
}

async function resolveRecipients(db: SupabaseClient, c: Record<string, any>): Promise<Recipient[]> {
  const { data: subs, error } = await db.from('subscribers').select('*');
  if (error) throw error;
  const all = (subs ?? []) as Sub[];
  const ok = (s: Sub) => s.status !== 'unsubscribed' && s.status !== 'paused';
  const addr = (s: Sub) => (c.channel === 'email' ? s.email : s.phone);
  let picked: Sub[] = [];
  const extra: Recipient[] = [];
  if (c.audience_type === 'segment' && c.segment_id) {
    const { data: seg } = await db.from('segments').select('filters').eq('id', c.segment_id).maybeSingle();
    const f = (seg?.filters ?? {}) as Record<string, string[]>;
    const has = (k: string) => Array.isArray(f[k]) && f[k].length > 0;
    picked = all.filter((s) =>
      (!has('specialty') || (s.specialties ?? []).some((x) => f.specialty.includes(x))) &&
      ['region', 'language', 'channel', 'status', 'sector'].every((k) => !has(k) || f[k].includes(String((s as unknown as Record<string, unknown>)[k]))));
  } else if (c.audience_type === 'manual') {
    const ids = new Set<string>(c.subscriber_ids ?? []);
    picked = all.filter((s) => ids.has(s.id));
  } else {
    for (const raw of (c.pasted_list ?? []) as string[]) {
      const a = c.channel === 'email' ? (isEmail(raw) ? raw.trim().toLowerCase() : '') : normPhone(raw);
      if (!a) continue;
      const s = all.find((x) => addr(x)?.toLowerCase() === a);
      if (s) picked.push(s);
      else extra.push({ subscriber_id: null, name: '', title: '', institution: '', language: 'en', address: a });
    }
  }
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const s of picked.filter(ok)) {
    const a = c.channel === 'email' ? s.email?.toLowerCase() : normPhone(s.phone ?? '');
    if (!a || seen.has(a)) continue;
    seen.add(a);
    out.push({ subscriber_id: s.id, name: s.full_name, title: s.title, institution: s.institution, language: s.language, address: a });
  }
  for (const r of extra) if (!seen.has(r.address)) (seen.add(r.address), out.push(r));
  return out;
}

async function sendBatched(db: SupabaseClient, s: Settings, c: Record<string, any>, msgs: Record<string, any>[]) {
  const ad = adapterFor(c.channel, s);
  const unit = c.channel === 'sms' ? s.cost_per_sms : c.channel === 'whatsapp' ? s.cost_per_whatsapp : 0;
  const size = Math.max(1, Math.min(200, s.batch_size || 50));
  for (let i = 0; i < msgs.length; i += size) {
    const batch = msgs.slice(i, i + size);
    await Promise.all(batch.map(async (m) => {
      let r: SendResult;
      try {
        r = await ad.send(m.to_address, m.body, c.subject);
      } catch (e) {
        r = { ok: false, error: (e as Error).message };
      }
      await db.from('campaign_messages').update({
        status: r.ok ? 'sent' : 'failed', provider: ad.name, provider_ref: r.ref ?? '', error: r.error ?? '',
        cost: r.ok ? r.cost ?? m.parts * unit : 0, sent_at: new Date().toISOString(),
      }).eq('id', m.id);
    }));
    if (i + size < msgs.length) await sleep(s.batch_delay_ms || 1000);
  }
}

async function recomputeTotals(db: SupabaseClient, id: string, finalStatus?: string) {
  const { data } = await db.from('campaign_messages').select('status, cost, clicked_at').eq('campaign_id', id);
  const rows = data ?? [];
  const n = (st: string) => rows.filter((r) => r.status === st).length;
  const patch: Record<string, unknown> = {
    sent: rows.filter((r) => r.status === 'sent' || r.status === 'delivered').length,
    delivered: n('delivered'), failed: n('failed'),
    clicks: rows.filter((r) => r.clicked_at).length,
    cost: rows.reduce((a, r) => a + Number(r.cost ?? 0), 0),
  };
  if (finalStatus) Object.assign(patch, { status: finalStatus, sent_at: new Date().toISOString() });
  await db.from('campaigns').update(patch).eq('id', id);
}

async function sendCampaign(db: SupabaseClient, s: Settings, id: string, retry: boolean) {
  const { data: c, error } = await db.from('campaigns').select('*').eq('id', id).single();
  if (error || !c) throw new Error('Campaign not found');
  if (retry) {
    if (c.status !== 'Sent') throw new Error('Only a sent campaign can retry failed messages');
    const { data: failed } = await db.from('campaign_messages').select('*').eq('campaign_id', id).eq('status', 'failed');
    await sendBatched(db, s, c, failed ?? []);
    await recomputeTotals(db, id);
    return { retried: failed?.length ?? 0 };
  }
  if (!['Approved', 'Scheduled'].includes(c.status)) throw new Error(`Campaign is ${c.status}; submit it first`);
  const recipients = await resolveRecipients(db, c);
  // Re-check approval against the real recipient count (the browser's count is only an estimate).
  if (s.require_approval && recipients.length > s.approval_threshold && !c.approved_at) {
    await db.from('campaigns').update({ status: 'Awaiting approval', requires_approval: true, audience_count: recipients.length }).eq('id', id);
    return { awaiting_approval: true, recipients: recipients.length };
  }
  await db.from('campaigns').update({ status: 'Sending', audience_count: recipients.length }).eq('id', id);
  const rows = recipients.map((r) => {
    const tpl = r.language === 'sw' && c.body_sw ? c.body_sw : c.body_en;
    const body = merge(tpl, { full_name: r.name, title: r.title, institution: r.institution });
    return { campaign_id: id, subscriber_id: r.subscriber_id, to_address: r.address, name: r.name, language: r.language, body, parts: c.channel === 'sms' ? smsParts(body) : 1, status: 'queued' };
  });
  const inserted: Record<string, any>[] = [];
  for (let i = 0; i < rows.length; i += 500) {
    const { data, error: e } = await db.from('campaign_messages').insert(rows.slice(i, i + 500)).select();
    if (e) throw e;
    inserted.push(...(data ?? []));
  }
  await sendBatched(db, s, c, inserted);
  await recomputeTotals(db, id, 'Sent');
  return { recipients: inserted.length };
}

// ---------------------------------------------------------------- webhooks (inbound replies, delivery reports)
async function readBody(req: Request): Promise<Record<string, string>> {
  const t = req.headers.get('content-type') ?? '';
  if (t.includes('json')) return await req.json();
  return Object.fromEntries(new URLSearchParams(await req.text()));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
  try {
    const url = new URL(req.url);
    const hook = url.searchParams.get('hook');
    if (hook) {
      if (!env('INBOUND_TOKEN') || url.searchParams.get('token') !== env('INBOUND_TOKEN')) return json({ error: 'Bad token' }, 401);
      const b = await readBody(req);
      if (hook === 'inbound') {
        // Beem: from/message · Africa's Talking: from/text · NextSMS: from/text
        const from = b.from ?? b.source_addr ?? b.msisdn ?? '';
        const text = b.text ?? b.message ?? b.content ?? '';
        const { error } = await admin.from('sms_inbox').insert({ from_phone: from, body: text });
        if (error) throw error;
        return json({ ok: true });
      }
      if (hook === 'dlr') {
        const ref = b.id ?? b.request_id ?? b.messageId ?? b.dest_ref ?? '';
        const st = String(b.status ?? b.dlr_status ?? '').toLowerCase();
        const status = /deliver|success/.test(st) ? 'delivered' : /fail|reject|expire|undeliver/.test(st) ? 'failed' : 'sent';
        const { data } = await admin.from('campaign_messages').update({ status, delivered_at: status === 'delivered' ? new Date().toISOString() : null, error: status === 'failed' ? String(b.failureReason ?? st) : '' }).eq('provider_ref', ref).select('campaign_id');
        if (data?.[0]) await recomputeTotals(admin, data[0].campaign_id);
        return json({ ok: true });
      }
      return json({ error: 'Unknown hook' }, 400);
    }

    const body = await req.json();
    const s = await loadSettings(admin);

    if (body.run_due) {
      if (!env('CRON_SECRET') || req.headers.get('x-cron-secret') !== env('CRON_SECRET')) return json({ error: 'Not allowed' }, 403);
      const { data: due } = await admin.from('campaigns').select('id').eq('status', 'Scheduled').lte('scheduled_at', new Date().toISOString());
      const results = [];
      for (const d of due ?? []) results.push({ id: d.id, ...(await sendCampaign(admin, s, d.id, false).catch((e) => ({ error: (e as Error).message }))) });
      return json({ ran: results });
    }

    // Everyone else must be signed in as Growth, GM/CFO or Boss (Super Admin passes).
    const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: ok, error: roleErr } = await asUser.rpc('is_audience_staff');
    if (roleErr || !ok) return json({ error: 'Only Growth, GM/CFO or Boss can send campaigns' }, 403);

    if (body.test) {
      const { to, channel = 'sms', subject = '', body: text = '' } = body.test as Record<string, string>;
      const addr = channel === 'email' ? (isEmail(to) ? to.trim() : '') : normPhone(to);
      if (!addr) return json({ error: 'Enter a valid +255 number or email for the test' }, 400);
      const r = await adapterFor(channel, s).send(addr, `[TEST] ${text}`, subject);
      return r.ok ? json({ ok: true, ref: r.ref }) : json({ error: r.error }, 502);
    }
    if (!body.campaign_id) return json({ error: 'campaign_id required' }, 400);
    return json(await sendCampaign(admin, s, String(body.campaign_id), !!body.retry_failed));
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
