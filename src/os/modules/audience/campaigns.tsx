// Campaigns: list, builder (audience, channel, bilingual message, preview, test, schedule) and results.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Copy, Download, Mail, MessageSquare, Phone, RotateCcw, Send, ShieldCheck, Smartphone, XCircle } from 'lucide-react';
import { PageTitle } from '@/os/OsLayout';
import { useToast } from '@/os/cms/toast';
import { useActing } from '@/os/lib/session';
import { insertRow, personName, updateRow, usePeople, useTable } from '@/os/lib/store';
import { Card, Empty, Field, Pill, Progress, Sheet, StageTracker, Stat, Tabs, inputCls, tsh } from '@/os/ui';
import {
  CHANNEL_LABEL, STATUS_TONE, bodyFor, darFmt, darLocalToIso, decideCampaign, downloadCsv, estimate, isoToDarLocal, matches, parsePasted,
  resolveRecipients, runDueDemo, sendCampaign, sendTest, smsInfo, submitCampaign, useSmsSettings, useSubscribers,
  type Campaign, type CampaignMessage, type Channel, type Recipient, type Segment, type Template,
} from './lib';

const err = (e: unknown) => (e as Error).message ?? String(e);
const STAGES = ['Draft', 'Approval', 'Scheduled', 'Sending', 'Sent'];
const stageIndex = (s: Campaign['status']) => ({ Draft: 0, Rejected: 1, Cancelled: 0, 'Awaiting approval': 1, Approved: 2, Scheduled: 2, Sending: 3, Sent: 5 })[s];
const editable = (c: Campaign) => c.status === 'Draft' || c.status === 'Rejected' || ((c.status === 'Scheduled' || c.status === 'Approved') && !c.approved_at);
const ChannelIcon = ({ c }: { c: Channel }) => (c === 'email' ? <Mail size={15} /> : c === 'whatsapp' ? <MessageSquare size={15} /> : <Smartphone size={15} />);

function useAudienceData() {
  const { subscribers } = useSubscribers();
  const { rows: segments } = useTable<Segment>('segments', { order: 'created_at' });
  const settings = useSmsSettings();
  return { subscribers, segments, settings };
}

// ---------------------------------------------------------------- list
export function CampaignsPage() {
  const { rows } = useTable<Campaign>('campaigns', { order: 'created_at', ascending: false });
  const { subscribers, segments, settings } = useAudienceData();
  const [tab, setTab] = useState<'all' | 'active' | 'sent' | 'draft'>('all');
  useEffect(() => { runDueDemo(subscribers, segments, settings); }, [subscribers, segments, settings]);
  const since = Date.now() - 30 * 864e5;
  const sent = rows.filter((c) => c.status === 'Sent');
  const recent = sent.filter((c) => new Date(c.sent_at ?? c.created_at).getTime() >= since);
  const delivered = recent.reduce((a, c) => a + c.delivered, 0), attempted = recent.reduce((a, c) => a + c.sent + c.failed, 0);
  const shown = rows.filter((c) => tab === 'all' || (tab === 'sent' ? c.status === 'Sent' : tab === 'draft' ? c.status === 'Draft' || c.status === 'Rejected' : !['Sent', 'Draft', 'Rejected', 'Cancelled'].includes(c.status)));
  return (
    <div>
      <PageTitle tag="AUDIENCE · CAMPAIGNS" title="Campaigns" sub="Bulk SMS, email and WhatsApp to Basil Health Brief subscribers.">
        <Link to="/os/audience/new" className="btn-primary inline-flex min-h-[44px] items-center gap-2"><Send size={16} />New campaign</Link>
      </PageTitle>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sent · last 30 days" value={recent.length} sub={`${sent.length} campaigns in total`} />
        <Stat label="Delivered · 30 days" value={delivered.toLocaleString('en-GB')} sub={`${attempted.toLocaleString('en-GB')} attempted`} tone="green" />
        <Stat label="Delivery rate" value={attempted ? `${Math.round((delivered / attempted) * 100)}%` : '—'} tone={attempted && delivered / attempted < 0.85 ? 'amber' : 'green'} />
        <Stat label="Spend · 30 days" value={tsh(recent.reduce((a, c) => a + Number(c.cost), 0))} sub={`${tsh(settings.cost_per_sms)} per SMS`} />
      </div>
      <div className="mb-3"><Tabs value={tab} onChange={setTab} items={[{ value: 'all', label: 'All', count: rows.length }, { value: 'active', label: 'In progress', count: rows.filter((c) => ['Awaiting approval', 'Approved', 'Scheduled', 'Sending'].includes(c.status)).length }, { value: 'sent', label: 'Sent', count: sent.length }, { value: 'draft', label: 'Drafts', count: rows.filter((c) => c.status === 'Draft' || c.status === 'Rejected').length }]} /></div>
      {shown.length === 0 ? <Empty icon={<Send />} title="No campaigns here" sub="Create a campaign to reach your subscribers by SMS, email or WhatsApp." action={<Link to="/os/audience/new" className="btn-primary">New campaign</Link>} /> : (
        <div className="flex flex-col gap-2">
          {shown.map((c) => (
            <Link key={c.id} to={`/os/audience/campaigns/${c.id}`} className="flex flex-wrap items-center gap-3 rounded-2xl border border-basil-line bg-white p-4 text-basil-ink no-underline hover:border-basil-soft">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-basil-ice text-basil"><ChannelIcon c={c.channel} /></span>
              <div className="min-w-0 flex-1">
                <b className="block truncate">{c.name}</b>
                <span className="text-xs text-basil-muted">{CHANNEL_LABEL[c.channel]} · {c.audience_count} recipients · {c.status === 'Sent' ? `sent ${darFmt(c.sent_at)}` : c.scheduled_at ? `scheduled ${darFmt(c.scheduled_at)}` : `created ${darFmt(c.created_at)}`}</span>
              </div>
              {c.status === 'Sent' && <span className="text-sm text-basil-muted">{c.delivered}/{c.sent + c.failed} delivered · {tsh(c.cost)}</span>}
              <Pill tone={STATUS_TONE[c.status]}>{c.status}</Pill>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- builder
interface Draft { name: string; channel: Channel; audience_type: Campaign['audience_type']; segment_id: string; subscriber_ids: string[]; pasted: string; subject: string; body_en: string; body_sw: string; when: 'now' | 'later'; at: string }
const blank: Draft = { name: '', channel: 'sms', audience_type: 'segment', segment_id: '', subscriber_ids: [], pasted: '', subject: '', body_en: '', body_sw: '', when: 'now', at: '' };

function MessageBox({ label, value, onChange, channel, lang }: { label: string; value: string; onChange: (v: string) => void; channel: Channel; lang: string }) {
  const info = smsInfo(value);
  const insert = (tag: string) => onChange(`${value}${value && !value.endsWith(' ') ? ' ' : ''}${tag}`);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5 text-sm font-bold text-[#33465F]">{label}
        <textarea lang={lang} rows={channel === 'email' ? 7 : 4} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} h-auto py-2.5`} />
      </label>
      <div className="flex flex-wrap items-center gap-1.5">
        {['{first_name}', '{title}', '{institution}'].map((t) => <button key={t} type="button" onClick={() => insert(t)} className="min-h-[32px] rounded-full border border-basil-edge bg-white px-2.5 font-mono text-xs text-basil-deep">{t}</button>)}
        {channel === 'sms' && value && (
          <span className="ml-auto flex flex-wrap items-center gap-1.5 text-xs text-basil-muted">
            <Pill tone={info.encoding === 'GSM-7' ? 'green' : 'amber'}>{info.encoding}</Pill>
            {info.length} chars · {info.parts} SMS part{info.parts > 1 ? 's' : ''} · {info.remaining} left
          </span>
        )}
      </div>
      {channel === 'sms' && info.offending.length > 0 && <span className="text-xs text-amber-800">Unicode because of: {info.offending.map((c) => (c === '\n' ? '↵' : c)).join(' ')} — replace them to fit 160 characters per SMS.</span>}
    </div>
  );
}

function PhonePreview({ channel, subject, text, sample }: { channel: Channel; subject: string; text: string; sample?: Recipient }) {
  return (
    <div className="mx-auto w-[260px] rounded-[36px] border-[10px] border-basil-night bg-basil-night shadow-card">
      <div className="flex min-h-[420px] flex-col rounded-[26px] bg-[#F3F6FA]">
        <div className="rounded-t-[26px] bg-white px-4 pb-2 pt-4 text-center">
          <div className="mx-auto mb-2 h-1.5 w-14 rounded-full bg-slate-200" />
          <b className="text-sm">{channel === 'email' ? 'Inbox' : channel === 'whatsapp' ? 'Basil Media' : 'BASILMEDIA'}</b>
          <div className="text-[11px] text-basil-muted">{sample ? `to ${sample.name || sample.address}` : 'No sample recipient'}</div>
        </div>
        <div className="flex-1 p-3">
          {channel === 'email' && <div className="mb-1 text-xs font-bold">{subject || '(no subject)'}</div>}
          <div className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[13px] leading-snug ${channel === 'whatsapp' ? 'bg-[#DCF8C6]' : 'bg-white'} shadow-sm`}>{text || 'Your message preview appears here.'}</div>
        </div>
      </div>
    </div>
  );
}

export function CampaignBuilder() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { userId, can } = useActing();
  const people = usePeople();
  const { subscribers, segments, settings } = useAudienceData();
  const { rows: existing } = useTable<Campaign>('campaigns', { eq: { id: id ?? '00000000-0000-0000-0000-000000000000' } });
  const { rows: templates } = useTable<Template>('message_templates', { order: 'name' });
  const [d, setD] = useState<Draft>(blank);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sampleIdx, setSampleIdx] = useState(0);
  const [testTo, setTestTo] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const c0 = existing[0];

  useEffect(() => {
    if (c0 && loadedId !== c0.id) {
      setLoadedId(c0.id);
      setD({ name: c0.name, channel: c0.channel, audience_type: c0.audience_type, segment_id: c0.segment_id ?? '', subscriber_ids: c0.subscriber_ids ?? [], pasted: (c0.pasted_list ?? []).join('\n'), subject: c0.subject, body_en: c0.body_en, body_sw: c0.body_sw, when: c0.scheduled_at ? 'later' : 'now', at: c0.scheduled_at ? isoToDarLocal(c0.scheduled_at) : '' });
    }
  }, [c0, loadedId]);
  useEffect(() => { if (!testTo) setTestTo(settings.test_number || people.find((p) => p.id === userId)?.phone || ''); }, [settings.test_number, people, userId, testTo]);
  useEffect(() => { if (!d.segment_id && segments[0] && d.audience_type === 'segment') set({ segment_id: segments[0].id }); }, [segments, d.segment_id, d.audience_type]);

  const pasted = useMemo(() => parsePasted(d.pasted, d.channel), [d.pasted, d.channel]);
  const shape = { channel: d.channel, audience_type: d.audience_type, segment_id: d.segment_id || null, subscriber_ids: d.subscriber_ids, pasted_list: pasted.ok };
  const recips = useMemo(() => resolveRecipients(shape, subscribers, segments), [JSON.stringify(shape), subscribers, segments]); // eslint-disable-line react-hooks/exhaustive-deps
  const est = estimate(d, recips, settings);
  const needsApproval = settings.require_approval && recips.length > settings.approval_threshold;
  const sample = recips.find((r) => r.name) ? recips.filter((r) => r.name)[sampleIdx % Math.max(1, recips.filter((r) => r.name).length)] : recips[0];
  const previewText = sample ? bodyFor(d, sample) : d.body_en;
  const segCount = (s: Segment) => subscribers.filter((x) => matches(x, s.filters ?? {})).length;
  const filtered = subscribers.filter((s) => !search || `${s.full_name} ${s.institution} ${s.region} ${(s.specialties ?? []).join(' ')}`.toLowerCase().includes(search.toLowerCase()));

  if (id && c0 && !editable(c0)) return <Empty title="This campaign can no longer be edited" sub={`It is ${c0.status}. Duplicate it to send a new version.`} action={<Link className="btn-outline" to={`/os/audience/campaigns/${c0.id}`}>Open results</Link>} />;
  if (!can('growth', 'gm_cfo', 'boss')) return <Empty title="No access" sub="Campaigns are for Growth, GM/CFO and the Boss." />;

  const valid = () => {
    if (!d.name.trim()) return 'Give the campaign a name';
    if (!d.body_en.trim()) return 'Write the English message';
    if (d.channel === 'email' && !d.subject.trim()) return 'Add an email subject';
    if (!recips.length) return 'The audience has no reachable recipients';
    if (d.when === 'later' && (!d.at || new Date(darLocalToIso(d.at)) <= new Date())) return 'Pick a future send time';
    return '';
  };
  const persist = async (): Promise<Campaign> => {
    const row = { name: d.name.trim(), channel: d.channel, audience_type: d.audience_type, segment_id: d.audience_type === 'segment' ? d.segment_id || null : null, subscriber_ids: d.audience_type === 'manual' ? d.subscriber_ids : [], pasted_list: d.audience_type === 'pasted' ? pasted.ok : [], subject: d.subject, body_en: d.body_en, body_sw: d.body_sw, audience_count: recips.length, est_cost: est.cost, scheduled_at: d.when === 'later' && d.at ? darLocalToIso(d.at) : null };
    if (c0) return updateRow<Campaign>('campaigns', c0.id, { ...row, status: 'Draft' });
    return insertRow<Campaign>('campaigns', { ...row, status: 'Draft', sent: 0, delivered: 0, failed: 0, opted_out: 0, clicks: 0, cost: 0, requires_approval: false, approved_by: null, approved_at: null, decision_note: '', sent_at: null, ...(userId ? { created_by: userId } : {}) });
  };
  const saveDraft = async () => {
    if (!d.name.trim()) return toast('Give the campaign a name', 'error');
    setBusy(true);
    try { const c = await persist(); toast('Draft saved'); nav(`/os/audience/campaigns/${c.id}/edit`, { replace: true }); } catch (e) { toast(err(e), 'error'); } finally { setBusy(false); }
  };
  const go = async () => {
    const v = valid();
    if (v) return toast(v, 'error');
    setBusy(true);
    try {
      const c = await persist();
      const status = await submitCampaign(c, settings, c.scheduled_at);
      if (status === 'Approved') {
        await sendCampaign({ ...c, status }, { subs: subscribers, segments, settings });
        toast(`Sent to ${recips.length} recipients`);
      } else toast(status === 'Scheduled' ? `Scheduled for ${darFmt(c.scheduled_at)} (Dar es Salaam)` : 'Sent to GM/CFO for approval');
      nav(`/os/audience/campaigns/${c.id}`);
    } catch (e) { toast(err(e), 'error'); } finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true);
    try { await sendTest(testTo, d.channel, d.subject, previewText); toast(`Test sent to ${testTo}`); } catch (e) { toast(err(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageTitle tag="AUDIENCE · CAMPAIGN BUILDER" title={c0 ? `Edit · ${c0.name}` : 'New campaign'} sub="Pick an audience, write in English and Kiswahili, preview, test and send." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card title="1 · Campaign">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name"><input className={inputCls} value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Flash alert · malaria guideline update" /></Field>
              <Field label="Start from a template">
                <select className={inputCls} value="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) set({ body_en: t.body_en, body_sw: t.body_sw, subject: t.subject || d.subject, channel: t.channel, name: d.name || t.name }); }}>
                  <option value="">Choose a template…</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name} · {CHANNEL_LABEL[t.channel]}</option>)}
                </select>
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Channel">
              {(['sms', 'email', 'whatsapp'] as Channel[]).map((ch) => (
                <button key={ch} type="button" role="radio" aria-checked={d.channel === ch} onClick={() => set({ channel: ch })} className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 font-semibold ${d.channel === ch ? 'border-0 bg-basil text-white' : 'border border-basil-edge bg-white text-basil-deep'}`}><ChannelIcon c={ch} />{CHANNEL_LABEL[ch]}</button>
              ))}
            </div>
            {d.channel === 'whatsapp' && <p className="mb-0 mt-2 text-xs text-amber-800">WhatsApp needs a Meta-approved template before business-initiated messages can be delivered.</p>}
          </Card>

          <Card title="2 · Audience" action={<Pill tone={recips.length ? 'blue' : 'amber'}>{recips.length} reachable</Pill>}>
            <Tabs value={d.audience_type} onChange={(v) => set({ audience_type: v })} items={[{ value: 'segment', label: 'Segment' }, { value: 'manual', label: 'Pick people' }, { value: 'pasted', label: 'Paste a list' }]} />
            <div className="mt-3">
              {d.audience_type === 'segment' && (
                segments.length ? (
                  <div className="flex flex-col gap-2">
                    {segments.map((s) => (
                      <label key={s.id} className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${d.segment_id === s.id ? 'border-basil bg-basil-ice' : 'border-basil-line'}`}>
                        <input type="radio" name="segment" checked={d.segment_id === s.id} onChange={() => set({ segment_id: s.id })} />
                        <span className="min-w-0 flex-1"><b className="block">{s.name}</b><span className="text-xs text-basil-muted">{s.description}</span></span>
                        <Pill>{segCount(s)}</Pill>
                      </label>
                    ))}
                    <Link to="/os/audience/segments" className="text-sm">Manage segments</Link>
                  </div>
                ) : <Empty title="No segments yet" action={<Link to="/os/audience/segments" className="btn-outline">Create a segment</Link>} />
              )}
              {d.audience_type === 'manual' && (
                <div>
                  <input className={inputCls} placeholder="Search name, institution, region, specialty" value={search} onChange={(e) => setSearch(e.target.value)} />
                  <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-basil-line">
                    {filtered.map((s) => (
                      <label key={s.id} className="flex min-h-[44px] items-center gap-3 border-b border-basil-line px-3 py-2 last:border-0">
                        <input type="checkbox" checked={d.subscriber_ids.includes(s.id)} onChange={(e) => set({ subscriber_ids: e.target.checked ? [...d.subscriber_ids, s.id] : d.subscriber_ids.filter((x) => x !== s.id) })} />
                        <span className="min-w-0 flex-1 text-sm"><b>{s.full_name}</b> <span className="text-basil-muted">· {s.institution} · {s.region}</span></span>
                        {s.status !== 'active' && <Pill tone={s.status === 'unsubscribed' ? 'red' : 'amber'}>{s.status}</Pill>}
                      </label>
                    ))}
                  </div>
                  <span className="text-xs text-basil-muted">{d.subscriber_ids.length} picked · unsubscribed and paused people are skipped automatically.</span>
                </div>
              )}
              {d.audience_type === 'pasted' && (
                <Field label={d.channel === 'email' ? 'Email addresses' : '+255 phone numbers'} hint={`${pasted.ok.length} valid${pasted.bad.length ? ` · ${pasted.bad.length} not recognised: ${pasted.bad.slice(0, 5).join(', ')}` : ''}. One per line or separated by commas; 07… numbers become +255…`}>
                  <textarea rows={6} className={`${inputCls} h-auto py-2.5 font-mono text-sm`} value={d.pasted} onChange={(e) => set({ pasted: e.target.value })} placeholder={d.channel === 'email' ? 'name@hospital.go.tz' : '+255712345678\n0754 123 456'} />
                </Field>
              )}
            </div>
          </Card>

          <Card title="3 · Message">
            <div className="flex flex-col gap-4">
              {d.channel === 'email' && <Field label="Subject"><input className={inputCls} value={d.subject} onChange={(e) => set({ subject: e.target.value })} /></Field>}
              <MessageBox label="English" lang="en" value={d.body_en} onChange={(v) => set({ body_en: v })} channel={d.channel} />
              <MessageBox label="Kiswahili (sent to subscribers who chose Kiswahili)" lang="sw" value={d.body_sw} onChange={(v) => set({ body_sw: v })} channel={d.channel} />
            </div>
          </Card>

          <Card title="4 · When">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => set({ when: 'now' })} className={`min-h-[44px] rounded-xl px-4 font-semibold ${d.when === 'now' ? 'border-0 bg-basil text-white' : 'border border-basil-edge bg-white text-basil-deep'}`}>Send now</button>
              <button type="button" onClick={() => set({ when: 'later' })} className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 font-semibold ${d.when === 'later' ? 'border-0 bg-basil text-white' : 'border border-basil-edge bg-white text-basil-deep'}`}><CalendarClock size={16} />Schedule</button>
            </div>
            {d.when === 'later' && <div className="mt-3 max-w-xs"><Field label="Date and time (Africa/Dar_es_Salaam)"><input type="datetime-local" className={inputCls} value={d.at} onChange={(e) => set({ at: e.target.value })} /></Field></div>}
            {needsApproval && <p className="mb-0 mt-3 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><ShieldCheck size={16} />More than {settings.approval_threshold} recipients: GM/CFO approval is needed before this sends.</p>}
          </Card>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          <Card title="Preview">
            <PhonePreview channel={d.channel} subject={d.subject} text={previewText} sample={sample} />
            {recips.filter((r) => r.name).length > 1 && <button type="button" onClick={() => setSampleIdx((i) => i + 1)} className="btn-outline mt-3 min-h-[40px] w-full text-sm">Show another contact ({sample?.language === 'sw' ? 'Kiswahili' : 'English'})</button>}
          </Card>
          <Card title="Estimate">
            <dl className="m-0 grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-basil-muted">Recipients</dt><dd className="m-0 text-right font-bold">{recips.length.toLocaleString('en-GB')}</dd>
              {d.channel === 'sms' && <><dt className="text-basil-muted">SMS parts</dt><dd className="m-0 text-right font-bold">{est.parts.toLocaleString('en-GB')}</dd></>}
              <dt className="text-basil-muted">Cost</dt><dd className="m-0 text-right font-bold">{tsh(est.cost)}</dd>
            </dl>
            <p className="mb-0 mt-2 text-xs text-basil-muted">{d.channel === 'sms' ? `${tsh(settings.cost_per_sms)} per SMS part via ${settings.provider}.` : d.channel === 'whatsapp' ? `${tsh(settings.cost_per_whatsapp)} per WhatsApp message.` : 'Email is sent through Resend at no per-message cost here.'}</p>
          </Card>
          <Card title="Test send">
            <div className="flex gap-2">
              <input aria-label="Test recipient" className={inputCls} value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder={d.channel === 'email' ? 'you@basilmedia.co.tz' : '+2557…'} />
              <button type="button" disabled={busy || !previewText} onClick={test} className="btn-outline min-h-[48px] shrink-0"><Phone size={16} /></button>
            </div>
          </Card>
          <div className="flex flex-col gap-2">
            <button type="button" disabled={busy} onClick={go} className="btn-primary inline-flex min-h-[48px] items-center justify-center gap-2"><Send size={16} />{needsApproval ? 'Submit for approval' : d.when === 'later' ? 'Schedule' : `Send now to ${recips.length}`}</button>
            <button type="button" disabled={busy} onClick={saveDraft} className="btn-outline min-h-[44px]">Save draft</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- detail & results
export function CampaignDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { userId, can } = useActing();
  const people = usePeople();
  const { subscribers, segments, settings } = useAudienceData();
  const { rows, loading } = useTable<Campaign>('campaigns', { eq: { id } });
  const { rows: msgs } = useTable<CampaignMessage>('campaign_messages', { eq: { campaign_id: id }, order: 'created_at' });
  const [filter, setFilter] = useState<'all' | CampaignMessage['status']>('all');
  const [decide, setDecide] = useState<null | boolean>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const c = rows[0];
  if (!c) return loading ? null : <Empty title="Campaign not found" action={<Link to="/os/audience" className="btn-outline">All campaigns</Link>} />;

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast(ok); } catch (e) { toast(err(e), 'error'); } finally { setBusy(false); }
  };
  const opts = { subs: subscribers, segments, settings };
  const canDecide = c.status === 'Awaiting approval' && can('gm_cfo', 'boss') && c.created_by !== userId;
  const attempted = c.sent + c.failed;
  const shown = msgs.filter((m) => filter === 'all' || m.status === filter);
  const duplicate = () => act(async () => {
    const n = await insertRow<Campaign>('campaigns', { ...Object.fromEntries(Object.entries(c).filter(([k]) => !['id', 'created_at'].includes(k))), name: `${c.name} (copy)`, status: 'Draft', sent: 0, delivered: 0, failed: 0, opted_out: 0, clicks: 0, cost: 0, approved_by: null, approved_at: null, decision_note: '', sent_at: null, scheduled_at: null, requires_approval: false, ...(userId ? { created_by: userId } : {}) });
    nav(`/os/audience/campaigns/${n.id}/edit`);
  }, 'Copied as a new draft');
  const exportCsv = () => downloadCsv(`${c.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-results.csv`, [
    ['Name', 'To', 'Language', 'Status', 'Error', 'SMS parts', 'Cost (TSH)', 'Clicked', 'Sent at (EAT)', 'Message'],
    ...msgs.map((m) => [m.name, m.to_address, m.language, m.status, m.error, m.parts, m.cost, m.clicked_at ? 'yes' : '', darFmt(m.sent_at), m.body]),
  ]);

  return (
    <div>
      <PageTitle tag={`AUDIENCE · ${CHANNEL_LABEL[c.channel].toUpperCase()} CAMPAIGN`} title={c.name} sub={`${c.audience_count} recipients · created ${darFmt(c.created_at)} by ${personName(people, c.created_by)}`}>
        <div className="flex flex-wrap gap-2">
          {editable(c) && <Link to={`/os/audience/campaigns/${c.id}/edit`} className="btn-outline inline-flex min-h-[44px] items-center">{c.status === 'Draft' || c.status === 'Rejected' ? 'Edit & send' : 'Edit'}</Link>}
          {(c.status === 'Approved' || c.status === 'Scheduled') && <button type="button" disabled={busy} className="btn-primary inline-flex min-h-[44px] items-center gap-2" onClick={() => act(() => sendCampaign(c, opts), 'Campaign sent')}><Send size={16} />Send now</button>}
          {['Draft', 'Awaiting approval', 'Approved', 'Scheduled'].includes(c.status) && <button type="button" disabled={busy} className="btn-outline min-h-[44px]" onClick={() => act(() => updateRow('campaigns', c.id, { status: 'Cancelled' }), 'Campaign cancelled')}>Cancel</button>}
          <button type="button" disabled={busy} className="btn-outline inline-flex min-h-[44px] items-center gap-2" onClick={duplicate}><Copy size={16} />Duplicate</button>
        </div>
      </PageTitle>

      <Card className="mb-4">
        <StageTracker stages={STAGES} current={stageIndex(c.status)} rejected={c.status === 'Rejected'} meta={[darFmt(c.created_at), c.approved_at ? `${personName(people, c.approved_by)} · ${darFmt(c.approved_at)}` : c.requires_approval ? 'GM/CFO' : 'not needed', c.scheduled_at ? darFmt(c.scheduled_at) : 'send now', undefined, c.sent_at ? darFmt(c.sent_at) : undefined]} />
        <div className="mt-3 flex flex-wrap items-center gap-2"><Pill tone={STATUS_TONE[c.status]}>{c.status}</Pill>{c.decision_note && <span className="text-sm text-basil-muted">Note: {c.decision_note}</span>}</div>
        {canDecide && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-3">
            <span className="flex-1 text-sm text-amber-900"><b>Your approval is needed.</b> {c.audience_count} recipients · estimated {tsh(c.est_cost)}.</span>
            <button type="button" className="btn-primary inline-flex min-h-[44px] items-center gap-2" onClick={() => setDecide(true)}><CheckCircle2 size={16} />Approve</button>
            <button type="button" className="btn-outline inline-flex min-h-[44px] items-center gap-2" onClick={() => setDecide(false)}><XCircle size={16} />Reject</button>
          </div>
        )}
        {c.status === 'Awaiting approval' && !canDecide && <p className="mb-0 mt-3 text-sm text-basil-muted">Waiting for GM/CFO approval. The person who created a campaign cannot approve it.</p>}
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        <Stat label="Recipients" value={c.audience_count} />
        <Stat label="Sent" value={c.sent} />
        <Stat label="Delivered" value={c.delivered} tone="green" sub={attempted ? `${Math.round((c.delivered / attempted) * 100)}%` : undefined} />
        <Stat label="Failed" value={c.failed} tone={c.failed ? 'red' : undefined} onClick={c.failed ? () => setFilter('failed') : undefined} />
        <Stat label="Opted out" value={c.opted_out} tone={c.opted_out ? 'amber' : undefined} />
        <Stat label="Clicks" value={c.clicks} />
        <Stat label="Cost" value={tsh(c.status === 'Sent' || c.status === 'Sending' ? c.cost : c.est_cost)} sub={c.status === 'Sent' ? undefined : 'estimate'} />
      </div>
      {attempted > 0 && <div className="mb-4"><Progress value={c.delivered} max={attempted} tone="green" /></div>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card title="Messages" action={
          <div className="flex flex-wrap gap-2">
            {c.status === 'Sent' && c.failed > 0 && <button type="button" disabled={busy} className="btn-outline inline-flex min-h-[40px] items-center gap-1.5 text-sm" onClick={() => act(() => sendCampaign(c, { ...opts, retryFailed: true }), 'Retried failed messages')}><RotateCcw size={15} />Retry failed</button>}
            <button type="button" disabled={!msgs.length} className="btn-outline inline-flex min-h-[40px] items-center gap-1.5 text-sm" onClick={exportCsv}><Download size={15} />CSV</button>
          </div>
        }>
          <div className="mb-3"><Tabs value={filter} onChange={setFilter} items={(['all', 'delivered', 'sent', 'failed', 'queued'] as const).map((v) => ({ value: v, label: v === 'all' ? 'All' : v[0].toUpperCase() + v.slice(1), count: v === 'all' ? msgs.length : msgs.filter((m) => m.status === v).length }))} /></div>
          {shown.length === 0 ? <p className="m-0 text-sm text-basil-muted">{msgs.length ? 'Nothing in this view.' : 'Messages appear here once the campaign is sent.'}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-basil-muted"><th className="py-2 pr-3">Recipient</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Parts</th><th className="py-2 pr-3">Cost</th><th className="py-2">Sent</th></tr></thead>
                <tbody>
                  {shown.map((m) => (
                    <tr key={m.id} className="border-t border-basil-line align-top">
                      <td className="py-2 pr-3"><b className="block">{m.name || m.to_address}</b><span className="text-xs text-basil-muted">{m.to_address} · {m.language === 'sw' ? 'Kiswahili' : 'English'}</span></td>
                      <td className="py-2 pr-3"><Pill tone={m.status === 'delivered' ? 'green' : m.status === 'failed' ? 'red' : m.status === 'opted_out' ? 'amber' : 'blue'}>{m.status}</Pill>{m.error && <span className="mt-1 block text-xs text-red-700">{m.error}</span>}{m.clicked_at && <span className="mt-1 block text-xs text-emerald-700">clicked</span>}</td>
                      <td className="py-2 pr-3">{m.parts}</td>
                      <td className="py-2 pr-3">{tsh(m.cost)}</td>
                      <td className="py-2 text-xs text-basil-muted">{darFmt(m.sent_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Message">
          {c.subject && <p className="m-0 mb-2 text-sm"><b>Subject:</b> {c.subject}</p>}
          <span className="kicker">English</span>
          <p className="mt-1 whitespace-pre-wrap text-sm">{c.body_en}</p>
          {c.body_sw && <><span className="kicker">Kiswahili</span><p className="mt-1 whitespace-pre-wrap text-sm">{c.body_sw}</p></>}
          {c.channel === 'sms' && <p className="m-0 text-xs text-basil-muted">{smsInfo(c.body_en).encoding} · {smsInfo(c.body_en).parts} part(s) before merge fields</p>}
        </Card>
      </div>

      <Sheet open={decide !== null} onClose={() => setDecide(null)} title={decide ? 'Approve campaign' : 'Reject campaign'}>
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm">{c.name} · {c.audience_count} recipients · {tsh(c.est_cost)}</p>
          <Field label={decide ? 'Note (optional)' : 'Reason'}><textarea rows={3} className={`${inputCls} h-auto py-2.5`} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <button type="button" disabled={busy || (!decide && !note.trim())} className="btn-primary min-h-[48px]" onClick={() => act(async () => {
            const next = await decideCampaign(c, !!decide, note, userId);
            setDecide(null);
            if (next === 'Approved') await sendCampaign({ ...c, status: next, approved_at: new Date().toISOString() }, opts);
          }, decide ? 'Approved' : 'Rejected')}>{decide ? (c.scheduled_at && new Date(c.scheduled_at) > new Date() ? 'Approve for the scheduled time' : 'Approve and send now') : 'Reject'}</button>
        </div>
      </Sheet>
    </div>
  );
}
