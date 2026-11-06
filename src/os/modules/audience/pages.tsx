// Segments, templates & automations, two-way inbox and provider settings.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Filter, KeyRound, MessageCircleReply, Plus, Save, Trash2, Zap } from 'lucide-react';
import { PageTitle } from '@/os/OsLayout';
import { useToast } from '@/os/cms/toast';
import { isDemo } from '@/lib/supabase';
import type { Subscriber } from '@/lib/types';
import { deleteRow, insertRow, updateRow, useTable } from '@/os/lib/store';
import { Avatar, Card, Empty, Field, Pill, Sheet, Tabs, inputCls, tsh } from '@/os/ui';
import {
  CHANNEL_LABEL, DEFAULT_SMS, darFmt, deliverable, facets, matches, receiveReply, saveSmsSettings, smsInfo, useSmsSettings, useSubscribers,
  type Automation, type Campaign, type Channel, type InboxMsg, type Segment, type SegmentFilters, type SmsSettings, type Template,
} from './lib';

const err = (e: unknown) => (e as Error).message ?? String(e);
const FILTER_LABEL: Record<keyof SegmentFilters, string> = { specialty: 'Specialty', region: 'Region', language: 'Language', channel: 'Channel', status: 'Status', sector: 'Sector' };
const valueLabel = (k: string, v: string) => (k === 'language' ? (v === 'sw' ? 'Kiswahili' : 'English') : k === 'channel' ? CHANNEL_LABEL[v as Channel] ?? v : v);

// ---------------------------------------------------------------- segments
export function SegmentsPage() {
  const toast = useToast();
  const { subscribers } = useSubscribers();
  const { rows } = useTable<Segment>('segments', { order: 'created_at' });
  const [edit, setEdit] = useState<Partial<Segment> | null>(null);
  const f = facets(subscribers);
  const filters = edit?.filters ?? {};
  const live = subscribers.filter((s) => matches(s, filters));
  const toggle = (k: keyof SegmentFilters, v: string) => {
    const cur = filters[k] ?? [];
    setEdit({ ...edit, filters: { ...filters, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] } });
  };
  const save = async () => {
    if (!edit?.name?.trim()) return toast('Name the segment', 'error');
    try {
      const row = { name: edit.name.trim(), description: edit.description ?? '', filters };
      if (edit.id) await updateRow('segments', edit.id, row);
      else await insertRow('segments', row);
      setEdit(null);
      toast('Segment saved');
    } catch (e) { toast(err(e), 'error'); }
  };
  const summary = (fl: SegmentFilters) => (Object.entries(fl) as [keyof SegmentFilters, string[]][]).filter(([, v]) => v?.length).map(([k, v]) => `${FILTER_LABEL[k]}: ${v.map((x) => valueLabel(k, x)).join(', ')}`).join(' · ') || 'Everyone';
  return (
    <div>
      <PageTitle tag="AUDIENCE · SEGMENTS" title="Segments" sub={`Saved filters over ${subscribers.length} subscribers. Counts update live.`}>
        <button type="button" className="btn-primary inline-flex min-h-[44px] items-center gap-2" onClick={() => setEdit({ name: '', description: '', filters: {} })}><Plus size={16} />New segment</button>
      </PageTitle>
      {rows.length === 0 ? <Empty icon={<Filter />} title="No segments yet" sub="Group subscribers by specialty, region, language, channel, status or sector." /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((s) => {
            const m = subscribers.filter((x) => matches(x, s.filters ?? {}));
            return (
              <Card key={s.id} title={s.name} action={<Pill>{m.filter(deliverable).length} reachable</Pill>}>
                {s.description && <p className="m-0 mb-2 text-sm text-basil-muted">{s.description}</p>}
                <p className="m-0 text-xs text-basil-muted">{summary(s.filters ?? {})}</p>
                <p className="m-0 mt-1 text-xs text-basil-muted">{m.length} match · {m.length - m.filter(deliverable).length} unsubscribed or paused</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="btn-outline min-h-[40px] text-sm" onClick={() => setEdit(s)}>Edit</button>
                  <Link to="/os/audience/new" className="btn-outline inline-flex min-h-[40px] items-center text-sm">Use in campaign</Link>
                  <button type="button" aria-label={`Delete ${s.name}`} className="btn-outline min-h-[40px] text-sm" onClick={() => deleteRow('segments', s.id).then(() => toast('Segment deleted'), (e) => toast(err(e), 'error'))}><Trash2 size={15} /></button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit segment' : 'New segment'}>
        <div className="flex flex-col gap-3">
          <Field label="Name"><input className={inputCls} value={edit?.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label="Description"><input className={inputCls} value={edit?.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
          {(Object.keys(FILTER_LABEL) as (keyof SegmentFilters)[]).map((k) => (
            <fieldset key={k} className="m-0 border-0 p-0">
              <legend className="mb-1.5 text-sm font-bold text-[#33465F]">{FILTER_LABEL[k]} <span className="font-normal text-basil-muted">{filters[k]?.length ? '' : '· any'}</span></legend>
              <div className="flex flex-wrap gap-1.5">
                {f[k].map((v) => {
                  const on = (filters[k] ?? []).includes(v);
                  return <button key={v} type="button" aria-pressed={on} onClick={() => toggle(k, v)} className={`min-h-[36px] rounded-full px-3 text-sm ${on ? 'border-0 bg-basil text-white' : 'border border-basil-edge bg-white text-basil-deep'}`}>{valueLabel(k, v)}</button>;
                })}
              </div>
            </fieldset>
          ))}
          <div className="rounded-xl bg-basil-ice p-3 text-sm"><b>{live.length}</b> subscribers match · <b>{live.filter(deliverable).length}</b> reachable</div>
          <button type="button" className="btn-primary min-h-[48px]" onClick={save}>Save segment</button>
        </div>
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------- templates & automations
export function LibraryPage() {
  const toast = useToast();
  const { rows: templates } = useTable<Template>('message_templates', { order: 'name' });
  const { rows: autos } = useTable<Automation>('automations', { order: 'name' });
  const [tab, setTab] = useState<'templates' | 'automations'>('templates');
  const [edit, setEdit] = useState<Partial<Template> | null>(null);
  const save = async () => {
    if (!edit?.name?.trim() || !edit.body_en?.trim()) return toast('Name and English text are required', 'error');
    try {
      const row = { name: edit.name, category: edit.category || 'General', channel: edit.channel ?? 'sms', subject: edit.subject ?? '', body_en: edit.body_en, body_sw: edit.body_sw ?? '' };
      if (edit.id) await updateRow('message_templates', edit.id, row);
      else await insertRow('message_templates', row);
      setEdit(null);
      toast('Template saved');
    } catch (e) { toast(err(e), 'error'); }
  };
  return (
    <div>
      <PageTitle tag="AUDIENCE · LIBRARY" title="Templates & automations" sub="Reusable bilingual messages and messages that send themselves.">
        {tab === 'templates' && <button type="button" className="btn-primary inline-flex min-h-[44px] items-center gap-2" onClick={() => setEdit({ channel: 'sms', category: 'General' })}><Plus size={16} />New template</button>}
      </PageTitle>
      <div className="mb-4"><Tabs value={tab} onChange={setTab} items={[{ value: 'templates', label: 'Templates', count: templates.length }, { value: 'automations', label: 'Automations', count: autos.length }]} /></div>
      {tab === 'templates' ? (
        <div className="grid gap-3 md:grid-cols-2">
          {templates.map((t) => {
            const info = smsInfo(t.body_en);
            return (
              <Card key={t.id} title={t.name} action={<Pill tone="grey">{t.category}</Pill>}>
                <p className="m-0 text-sm">{t.body_en}</p>
                {t.body_sw && <p className="m-0 mt-2 text-sm text-basil-muted" lang="sw">{t.body_sw}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Pill>{CHANNEL_LABEL[t.channel]}</Pill>
                  {t.channel === 'sms' && <span className="text-xs text-basil-muted">{info.encoding} · {info.parts} part(s)</span>}
                  <button type="button" className="btn-outline ml-auto min-h-[40px] text-sm" onClick={() => setEdit(t)}>Edit</button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {autos.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-basil-line bg-white p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-basil-ice text-basil"><Zap size={18} /></span>
              <div className="min-w-0 flex-1">
                <b className="block">{a.name}</b>
                <span className="text-xs text-basil-muted">{a.description} Template: {templates.find((t) => t.id === a.template_id)?.name ?? '—'} · {a.sent_count} sent{a.last_run_at ? ` · last ${darFmt(a.last_run_at)}` : ''}</span>
              </div>
              <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-bold">
                <input type="checkbox" role="switch" className="h-5 w-5" checked={a.enabled} onChange={(e) => updateRow('automations', a.id, { enabled: e.target.checked }).then(() => toast(e.target.checked ? 'Automation on' : 'Automation off'), (x) => toast(err(x), 'error'))} />
                {a.enabled ? <Pill tone="green">On</Pill> : <Pill tone="grey">Off</Pill>}
              </label>
            </div>
          ))}
          <p className="m-0 text-xs text-basil-muted">Automations run from the send-campaign function on a schedule; switching one off stops it immediately.</p>
        </div>
      )}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit template' : 'New template'}>
        <div className="flex flex-col gap-3">
          <Field label="Name"><input className={inputCls} value={edit?.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category"><input className={inputCls} value={edit?.category ?? ''} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /></Field>
            <Field label="Channel"><select className={inputCls} value={edit?.channel ?? 'sms'} onChange={(e) => setEdit({ ...edit, channel: e.target.value as Channel })}>{(['sms', 'email', 'whatsapp'] as Channel[]).map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}</select></Field>
          </div>
          {edit?.channel === 'email' && <Field label="Subject"><input className={inputCls} value={edit?.subject ?? ''} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} /></Field>}
          <Field label="English" hint="Merge fields: {first_name} {title} {institution}"><textarea rows={4} className={`${inputCls} h-auto py-2.5`} value={edit?.body_en ?? ''} onChange={(e) => setEdit({ ...edit, body_en: e.target.value })} /></Field>
          <Field label="Kiswahili"><textarea rows={4} lang="sw" className={`${inputCls} h-auto py-2.5`} value={edit?.body_sw ?? ''} onChange={(e) => setEdit({ ...edit, body_sw: e.target.value })} /></Field>
          <button type="button" className="btn-primary min-h-[48px]" onClick={save}>Save template</button>
        </div>
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------- inbox
export function InboxPage() {
  const toast = useToast();
  const { subscribers } = useSubscribers();
  const { rows } = useTable<InboxMsg>('sms_inbox', { order: 'received_at', ascending: false });
  const { rows: campaigns } = useTable<Campaign>('campaigns');
  const [tab, setTab] = useState<'open' | 'all'>('open');
  const [from, setFrom] = useState('');
  const [text, setText] = useState('');
  const sub = (m: InboxMsg): Subscriber | undefined => subscribers.find((s) => s.id === m.subscriber_id || s.phone === m.from_phone);
  const shown = rows.filter((m) => tab === 'all' || !m.handled);
  const simulate = async () => {
    try { await receiveReply(from, text); setText(''); toast(/^\s*stop/i.test(text) ? 'Reply logged · subscriber unsubscribed' : 'Reply logged'); } catch (e) { toast(err(e), 'error'); }
  };
  return (
    <div>
      <PageTitle tag="AUDIENCE · INBOX" title="Replies" sub="Two-way SMS. A reply of STOP (or ACHA / SITISHA) unsubscribes the sender automatically." />
      <div className="mb-3"><Tabs value={tab} onChange={setTab} items={[{ value: 'open', label: 'Needs reply', count: rows.filter((m) => !m.handled).length }, { value: 'all', label: 'All', count: rows.length }]} /></div>
      {shown.length === 0 ? <Empty icon={<MessageCircleReply />} title="Inbox clear" sub="New replies to your campaigns appear here." /> : (
        <div className="flex flex-col gap-2">
          {shown.map((m) => {
            const s = sub(m);
            return (
              <div key={m.id} className="flex flex-wrap items-start gap-3 rounded-2xl border border-basil-line bg-white p-4">
                <Avatar name={s?.full_name ?? m.from_phone} />
                <div className="min-w-0 flex-1">
                  <b>{s?.full_name ?? m.from_phone}</b> <span className="text-xs text-basil-muted">{m.from_phone} · {darFmt(m.received_at)}{m.campaign_id ? ` · re ${campaigns.find((c) => c.id === m.campaign_id)?.name ?? 'campaign'}` : ''}</span>
                  <p className="m-0 mt-1 whitespace-pre-wrap">{m.body}</p>
                  {s && <span className="text-xs text-basil-muted">{s.institution} · {s.region} · status {s.status}</span>}
                </div>
                {m.auto_action && <Pill tone="amber">{m.auto_action}</Pill>}
                {!m.handled && <button type="button" className="btn-outline min-h-[40px] text-sm" onClick={() => updateRow('sms_inbox', m.id, { handled: true }).then(() => toast('Marked as handled'))}>Mark handled</button>}
              </div>
            );
          })}
        </div>
      )}
      <Card title={isDemo ? 'Simulate an incoming reply (demo)' : 'Log a reply received by phone'} className="mt-5">
        <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)_auto] sm:items-end">
          <Field label="From"><input className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} placeholder="+2557…" list="audience-phones" /></Field>
          <Field label="Message"><input className={inputCls} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. STOP" /></Field>
          <button type="button" disabled={!from || !text} className="btn-primary min-h-[48px]" onClick={simulate}>Add</button>
        </div>
        <datalist id="audience-phones">{subscribers.filter((s) => s.phone).map((s) => <option key={s.id} value={s.phone}>{s.full_name}</option>)}</datalist>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- provider settings
const PROVIDERS: { value: SmsSettings['provider']; label: string; secrets: string }[] = [
  { value: 'beem', label: 'Beem Africa', secrets: 'BEEM_API_KEY, BEEM_SECRET' },
  { value: 'africastalking', label: "Africa's Talking", secrets: 'AT_USERNAME, AT_API_KEY' },
  { value: 'nextsms', label: 'NextSMS', secrets: 'NEXTSMS_USERNAME, NEXTSMS_PASSWORD' },
];
export function ProviderSettingsPage() {
  const toast = useToast();
  const current = useSmsSettings();
  const [s, setS] = useState<SmsSettings>(DEFAULT_SMS);
  useEffect(() => setS(current), [current]);
  const set = (p: Partial<SmsSettings>) => setS((x) => ({ ...x, ...p }));
  const num = (v: string) => Math.max(0, Number(v) || 0);
  const save = async () => {
    if (!/^[A-Za-z0-9 ]{3,11}$/.test(s.sender_id)) return toast('Sender ID: 3–11 letters or digits', 'error');
    try { await saveSmsSettings(s); toast('Provider settings saved'); } catch (e) { toast(err(e), 'error'); }
  };
  const sms = PROVIDERS.find((p) => p.value === s.provider)!;
  return (
    <div>
      <PageTitle tag="AUDIENCE · PROVIDERS" title="Provider settings" sub="Which gateway sends, the sender ID and the cost used for estimates. Saved in app settings." />
      <div className="mb-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <KeyRound size={20} className="shrink-0" />
        <div>
          <b>API keys never go here.</b> Set them as Supabase function secrets so they stay on the server:
          <pre className="mb-0 mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-white/70 p-3 font-mono text-xs">supabase secrets set BEEM_API_KEY=… BEEM_SECRET=…{'\n'}supabase secrets set AT_USERNAME=… AT_API_KEY=…{'\n'}supabase secrets set RESEND_API_KEY=…{'\n'}supabase secrets set INBOUND_TOKEN=… CRON_SECRET=…</pre>
          <span className="mt-2 block">Point the provider's inbound SMS and delivery-report webhooks at <code>/functions/v1/send-campaign?hook=inbound&amp;token=…</code> and <code>?hook=dlr&amp;token=…</code>.</span>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="SMS">
          <div className="flex flex-col gap-3">
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-1.5 text-sm font-bold text-[#33465F]">Provider</legend>
              {PROVIDERS.map((p) => (
                <label key={p.value} className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-3 ${s.provider === p.value ? 'border-basil bg-basil-ice' : 'border-basil-line'}`}>
                  <input type="radio" name="provider" checked={s.provider === p.value} onChange={() => set({ provider: p.value })} />
                  <span className="flex-1 font-semibold">{p.label}</span><span className="font-mono text-[11px] text-basil-muted">{p.secrets}</span>
                </label>
              ))}
            </fieldset>
            <Field label="Sender ID" hint={`Registered with ${sms.label} and TCRA. Up to 11 characters.`}><input className={inputCls} value={s.sender_id} onChange={(e) => set({ sender_id: e.target.value.toUpperCase() })} /></Field>
            <Field label="Cost per SMS part (TSH)" hint={`Used for estimates: a 2-part message costs ${tsh(s.cost_per_sms * 2)}.`}><input type="number" min={0} className={inputCls} value={s.cost_per_sms} onChange={(e) => set({ cost_per_sms: num(e.target.value) })} /></Field>
            <Field label="My test number"><input className={inputCls} value={s.test_number} onChange={(e) => set({ test_number: e.target.value })} placeholder="+2557…" /></Field>
          </div>
        </Card>
        <div className="flex flex-col gap-4">
          <Card title="Email">
            <div className="flex flex-col gap-3">
              <Field label="Provider"><select className={inputCls} value={s.email_provider} onChange={(e) => set({ email_provider: e.target.value as SmsSettings['email_provider'] })}><option value="resend">Resend (RESEND_API_KEY)</option><option value="smtp">SMTP (relay outside edge functions)</option></select></Field>
              <Field label="From"><input className={inputCls} value={s.email_from} onChange={(e) => set({ email_from: e.target.value })} /></Field>
            </div>
          </Card>
          <Card title="WhatsApp Cloud API">
            <div className="flex flex-col gap-3">
              <Field label="Phone number ID" hint="Token goes in WHATSAPP_TOKEN. Business-initiated messages need approved templates."><input className={inputCls} value={s.whatsapp_phone_id} onChange={(e) => set({ whatsapp_phone_id: e.target.value })} /></Field>
              <Field label="Cost per WhatsApp message (TSH)"><input type="number" min={0} className={inputCls} value={s.cost_per_whatsapp} onChange={(e) => set({ cost_per_whatsapp: num(e.target.value) })} /></Field>
            </div>
          </Card>
          <Card title="Approval & throttling">
            <div className="flex flex-col gap-3">
              <label className="flex min-h-[44px] items-center gap-3 text-sm font-bold"><input type="checkbox" className="h-5 w-5" checked={s.require_approval} onChange={(e) => set({ require_approval: e.target.checked })} />GM/CFO approves large campaigns</label>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Above (recipients)"><input type="number" min={1} className={inputCls} value={s.approval_threshold} onChange={(e) => set({ approval_threshold: num(e.target.value) })} /></Field>
                <Field label="Batch size"><input type="number" min={1} className={inputCls} value={s.batch_size} onChange={(e) => set({ batch_size: num(e.target.value) })} /></Field>
                <Field label="Pause (ms)"><input type="number" min={0} className={inputCls} value={s.batch_delay_ms} onChange={(e) => set({ batch_delay_ms: num(e.target.value) })} /></Field>
              </div>
            </div>
          </Card>
        </div>
      </div>
      <button type="button" className="btn-primary mt-4 inline-flex min-h-[48px] items-center gap-2" onClick={save}><Save size={16} />Save settings</button>
    </div>
  );
}
