// Demo seed for the audience engine. Subscribers live in the website demo store (src/lib/db.ts) and are
// added once via `submit`; everything else is registered here with registerSeed.
import { registerSeed, type Row } from '@/os/lib/store';
import type { Subscriber } from '@/lib/types';

const ago = (days: number) => new Date(Date.now() - days * 864e5).toISOString();
const R = (x: unknown) => x as unknown as Row[];

type S = [string, string, string, string, string, string, 'en' | 'sw', Subscriber['channel'], Subscriber['status'], string];
// id, name, title, specialty, institution, region, language, channel, status, phone
const RAW: S[] = [
  ['sub-01', 'Dr Neema Mushi', 'Dr', 'Paediatrics', 'National Referral Hospital', 'Dar es Salaam', 'en', 'sms', 'active', '+255713400101'],
  ['sub-02', 'Dr Baraka Mollel', 'Dr', 'Internal Medicine', 'National Referral Hospital', 'Dar es Salaam', 'sw', 'sms', 'active', '+255754400102'],
  ['sub-03', 'Dr Halima Said', 'Dr', 'Obstetrics & Gynaecology', 'Amana Regional Hospital', 'Dar es Salaam', 'sw', 'sms', 'active', '+255765400103'],
  ['sub-04', 'Prof. Joseph Mbwambo', 'Prof.', 'Cardiology', 'University of Health Sciences', 'Dar es Salaam', 'en', 'email', 'active', '+255715400104'],
  ['sub-05', 'Dr Rose Temba', 'Dr', 'Paediatrics', 'Kilimanjaro University College', 'Kilimanjaro', 'en', 'sms', 'active', '+255762400105'],
  ['sub-06', 'Dr Peter Masanja', 'Dr', 'Surgery', 'Lake Zone Regional Hospital', 'Mwanza', 'sw', 'sms', 'active', '+255716400106'],
  ['sub-07', 'Dr Grace Lema', 'Dr', 'Public Health', 'Mama na Mtoto Foundation', 'Arusha', 'en', 'whatsapp', 'active', '+255754400107'],
  ['sub-08', 'Dr Juma Kassim', 'Dr', 'Internal Medicine', 'Dodoma Regional Hospital', 'Dodoma', 'sw', 'sms', 'active', '+255718400108'],
  ['sub-09', 'Dr Upendo Chacha', 'Dr', 'Obstetrics & Gynaecology', 'Mbeya Zonal Hospital', 'Mbeya', 'sw', 'sms', 'active', '+255767400109'],
  ['sub-10', 'Dr Faraja Mrema', 'Dr', 'Pharmacy', 'Kariakoo Community Pharmacy', 'Dar es Salaam', 'en', 'email', 'active', '+255713400110'],
  ['sub-11', 'Dr Zawadi Mkwawa', 'Dr', 'Paediatrics', 'Temeke Regional Hospital', 'Dar es Salaam', 'sw', 'sms', 'active', '+255755400111'],
  ['sub-12', 'Dr Emmanuel Shayo', 'Dr', 'Cardiology', 'Kilimanjaro Christian Hospital', 'Kilimanjaro', 'en', 'sms', 'active', '+255712400112'],
  ['sub-13', 'Dr Asha Mohamed', 'Dr', 'Public Health', 'Zanzibar Health Directorate', 'Zanzibar', 'sw', 'whatsapp', 'active', '+255777400113'],
  ['sub-14', 'Dr Daniel Mwita', 'Dr', 'Surgery', 'Musoma Regional Hospital', 'Mara', 'en', 'sms', 'active', '+255758400114'],
  ['sub-15', 'Dr Rehema Kombo', 'Dr', 'Internal Medicine', 'Tanga Regional Hospital', 'Tanga', 'sw', 'sms', 'unsubscribed', '+255714400115'],
  ['sub-16', 'Dr Elia Nyange', 'Dr', 'Oncology', 'Ocean Road Cancer Unit', 'Dar es Salaam', 'en', 'email', 'active', '+255719400116'],
  ['sub-17', 'Dr Mwanaidi Hassan', 'Dr', 'Paediatrics', 'Mnazi Mmoja Hospital', 'Zanzibar', 'sw', 'sms', 'active', '+255773400117'],
  ['sub-18', 'Dr Godfrey Mapunda', 'Dr', 'Public Health', 'Ruvuma Regional Hospital', 'Ruvuma', 'sw', 'sms', 'pending', '+255769400118'],
  ['sub-19', 'Dr Catherine Massawe', 'Dr', 'Obstetrics & Gynaecology', 'Mount Meru Hospital', 'Arusha', 'en', 'sms', 'active', '+255756400119'],
  ['sub-20', 'Dr Ibrahim Salum', 'Dr', 'Surgery', 'Dodoma Regional Hospital', 'Dodoma', 'sw', 'sms', 'active', '+255717400120'],
  ['sub-21', 'Dr Lucy Kimaro', 'Dr', 'Pharmacy', 'Mwanza Medical Stores', 'Mwanza', 'en', 'email', 'paused', '+255763400121'],
  ['sub-22', 'Dr Hamza Omari', 'Dr', 'Internal Medicine', 'Morogoro Regional Hospital', 'Morogoro', 'sw', 'sms', 'active', '+255715400122'],
  ['sub-23', 'Dr Agnes Swai', 'Dr', 'Cardiology', 'Heart Institute', 'Dar es Salaam', 'en', 'sms', 'active', '+255754400123'],
  ['sub-24', 'Mr Yusuf Ally', 'Mr', 'Nursing', 'Mwananyamala Regional Hospital', 'Dar es Salaam', 'sw', 'sms', 'active', '+255688400124'],
  ['sub-25', 'Ms Esther Mhando', 'Ms', 'Nursing', 'Iringa Regional Hospital', 'Iringa', 'sw', 'whatsapp', 'active', '+255657400125'],
];
const mail = (name: string) => name.replace(/^(Dr|Prof\.|Mr|Ms)\s+/, '').toLowerCase().replace(/\s+/g, '.') + '@example.co.tz';

export const DEMO_SUBSCRIBERS: Partial<Subscriber>[] = RAW.map(([id, full_name, title, sp, institution, region, language, channel, status, phone], i) => ({
  id, full_name, title, profession: title === 'Mr' || title === 'Ms' ? 'Nurse' : sp === 'Pharmacy' ? 'Pharmacist' : 'Medical Doctor',
  specialties: [sp], institution, region, phone, email: mail(full_name), language, channel, sector: sp === 'Pharmacy' ? 'Pharma' : 'Health',
  source: i % 4 === 0 ? 'event' : 'website', consent: true, consent_at: ago(120 - i * 3), status,
}));

// ---------- templates & automations ----------
const TPL = [
  ['tpl-welcome', 'welcome', 'Welcome to the Basil Health Brief', 'Welcome', 'sms', '',
    'Karibu {title} {first_name}! You are now subscribed to the Basil Health Brief. One brief a week plus urgent drug alerts. Reply STOP to opt out.',
    'Karibu {title} {first_name}! Umejiunga na Basil Health Brief. Taarifa moja kwa wiki na tahadhari za dawa. Jibu STOP kujiondoa.'],
  ['tpl-event', 'event_reminder', 'Event reminder', 'Event', 'sms', '',
    'Reminder {title} {first_name}: the event you registered for starts soon. Venue and programme: basilmedia.co.tz/events. Reply STOP to opt out.',
    'Kumbusho {title} {first_name}: tukio ulilojisajili linaanza hivi karibuni. Ukumbi na ratiba: basilmedia.co.tz/events. Jibu STOP kujiondoa.'],
  ['tpl-flash', 'flash_alert', 'Flash alert (drug / outbreak)', 'Alert', 'sms', '',
    'URGENT {title} {first_name}: new safety alert for your specialty. Read the full notice at basilmedia.co.tz/health-news. Reply STOP to opt out.',
    'DHARURA {title} {first_name}: tahadhari mpya ya usalama kwa fani yako. Soma zaidi: basilmedia.co.tz/health-news. Jibu STOP kujiondoa.'],
  ['tpl-invoice', 'invoice_reminder', 'Invoice reminder', 'Finance', 'email', 'Invoice reminder from Basil Media',
    'Dear {title} {first_name}, this is a friendly reminder that an invoice for {institution} is now due. Please contact accounts@basilmedia.co.tz with any questions.',
    'Ndugu {title} {first_name}, tunakukumbusha kuwa ankara ya {institution} imefikia muda wa kulipwa. Wasiliana na accounts@basilmedia.co.tz kwa maswali.'],
  ['tpl-weekly', 'weekly_brief', 'Weekly brief', 'Newsletter', 'email', 'Your Basil Health Brief this week',
    "Hello {title} {first_name}, here are this week's top stories for clinicians in Tanzania: basilmedia.co.tz/health-news",
    'Habari {title} {first_name}, hizi ni habari kuu za wiki hii kwa wataalamu wa afya Tanzania: basilmedia.co.tz/health-news'],
];
registerSeed('message_templates', () => R(TPL.map(([id, key, name, category, channel, subject, body_en, body_sw], i) => ({ id, key, name, category, channel, subject, body_en, body_sw, created_at: ago(60 - i) }))));
registerSeed('automations', () => R([
  { id: 'au-welcome', key: 'welcome_sms', name: 'Welcome SMS after subscribe', description: 'Sent when a subscriber is confirmed active.', trigger: 'subscribe', offset_days: 0, channel: 'sms', template_id: 'tpl-welcome', enabled: true, sent_count: 214, last_run_at: ago(1), created_at: ago(60) },
  { id: 'au-ev7', key: 'event_7d', name: 'Event reminder · 7 days before', description: 'Sent to registered attendees one week before the event.', trigger: 'event_before', offset_days: 7, channel: 'sms', template_id: 'tpl-event', enabled: true, sent_count: 388, last_run_at: ago(3), created_at: ago(60) },
  { id: 'au-ev1', key: 'event_1d', name: 'Event reminder · 1 day before', description: 'Sent to registered attendees the day before the event.', trigger: 'event_before', offset_days: 1, channel: 'sms', template_id: 'tpl-event', enabled: false, sent_count: 0, last_run_at: null, created_at: ago(60) },
]));

// ---------- segments ----------
registerSeed('segments', () => R([
  { id: 'seg-dar-paeds', name: 'Dar es Salaam paediatricians', description: 'Paediatrics specialists in Dar es Salaam, all channels.', filters: { specialty: ['Paediatrics'], region: ['Dar es Salaam'] }, created_by: 'u-growth', created_at: ago(30) },
  { id: 'seg-sw-sms', name: 'Kiswahili SMS readers', description: 'Everyone who reads in Kiswahili and chose SMS.', filters: { language: ['sw'], channel: ['sms'] }, created_by: 'u-growth', created_at: ago(20) },
]));

// ---------- campaigns ----------
const SENT_BODY_EN = 'Hello {title} {first_name}, the Tanzania Health Summit opens 14 Nov at JNICC. Register: basilmedia.co.tz/events. Reply STOP to opt out.';
const SENT_BODY_SW = 'Habari {title} {first_name}, Tanzania Health Summit inaanza 14 Nov JNICC. Jisajili: basilmedia.co.tz/events. Jibu STOP kujiondoa.';
const fname = (n: string) => n.replace(/^(Dr|Prof\.|Mr|Ms)\s+/, '').split(' ')[0];
const sentRecipients = DEMO_SUBSCRIBERS.filter((s) => s.phone && s.id !== 'sub-18' && s.id !== 'sub-21');
const OUTCOME = (i: number) => (i === 4 || i === 13 ? 'failed' : i === 9 ? 'sent' : 'delivered');
registerSeed('campaign_messages', () => R(sentRecipients.map((s, i) => {
  const st = OUTCOME(i);
  const tpl = s.language === 'sw' ? SENT_BODY_SW : SENT_BODY_EN;
  return {
    id: `cm-${i}`, campaign_id: 'cmp-summit', subscriber_id: s.id, to_address: s.phone, name: s.full_name, language: s.language,
    body: tpl.replace('{title}', s.title!).replace('{first_name}', fname(s.full_name!)).replace(/ {2,}/g, ' '),
    status: st, provider: 'beem', provider_ref: `BM${100200 + i}`, error: st === 'failed' ? (i === 4 ? 'Absent subscriber' : 'Number not reachable') : '',
    parts: 1, cost: st === 'failed' ? 0 : 28, clicked_at: i % 5 === 1 ? ago(5) : null, sent_at: ago(6), delivered_at: st === 'delivered' ? ago(6) : null, created_at: ago(6),
  };
})));
const sentCount = sentRecipients.length;
registerSeed('campaigns', () => R([
  {
    id: 'cmp-summit', name: 'Tanzania Health Summit · registration open', channel: 'sms', audience_type: 'manual', segment_id: null, subscriber_ids: sentRecipients.map((s) => s.id), pasted_list: [],
    subject: '', body_en: SENT_BODY_EN, body_sw: SENT_BODY_SW, status: 'Sent', scheduled_at: null, audience_count: sentCount, est_cost: sentCount * 28,
    sent: sentCount - 2, delivered: sentCount - 3, failed: 2, opted_out: 1, clicks: sentRecipients.filter((_, i) => i % 5 === 1).length, cost: (sentCount - 2) * 28,
    requires_approval: false, approved_by: null, approved_at: null, decision_note: '', created_by: 'u-growth', sent_at: ago(6), created_at: ago(7),
  },
  {
    id: 'cmp-flash', name: 'Flash alert · paediatric amoxicillin batch recall', channel: 'sms', audience_type: 'segment', segment_id: 'seg-dar-paeds', subscriber_ids: [], pasted_list: [],
    subject: '', body_en: TPL[2][6], body_sw: TPL[2][7], status: 'Scheduled', scheduled_at: new Date(Date.now() + 2 * 864e5).toISOString(), audience_count: 3, est_cost: 84,
    sent: 0, delivered: 0, failed: 0, opted_out: 0, clicks: 0, cost: 0, requires_approval: false, approved_by: null, approved_at: null, decision_note: '', created_by: 'u-growth', sent_at: null, created_at: ago(1),
  },
  {
    id: 'cmp-weekly', name: 'Weekly brief · November week 2', channel: 'email', audience_type: 'manual', segment_id: null, subscriber_ids: ['sub-04', 'sub-10', 'sub-16'], pasted_list: [],
    subject: TPL[4][5], body_en: TPL[4][6], body_sw: TPL[4][7], status: 'Draft', scheduled_at: null, audience_count: 3, est_cost: 0,
    sent: 0, delivered: 0, failed: 0, opted_out: 0, clicks: 0, cost: 0, requires_approval: false, approved_by: null, approved_at: null, decision_note: '', created_by: 'u-growth', sent_at: null, created_at: ago(0),
  },
]));

// ---------- two-way inbox ----------
registerSeed('sms_inbox', () => R([
  { id: 'in-1', from_phone: '+255714400115', body: 'STOP', subscriber_id: 'sub-15', campaign_id: 'cmp-summit', received_at: ago(5.8), handled: true, auto_action: 'Unsubscribed', created_at: ago(5.8) },
  { id: 'in-2', from_phone: '+255754400102', body: 'Asante. Je, kuna CPD points kwa summit hii?', subscriber_id: 'sub-02', campaign_id: 'cmp-summit', received_at: ago(5.5), handled: false, auto_action: '', created_at: ago(5.5) },
  { id: 'in-3', from_phone: '+255762400105', body: 'Please register me and one colleague from KUC paediatrics.', subscriber_id: 'sub-05', campaign_id: 'cmp-summit', received_at: ago(5), handled: false, auto_action: '', created_at: ago(5) },
  { id: 'in-4', from_phone: '+255716400106', body: 'Nimepokea, nitahudhuria.', subscriber_id: 'sub-06', campaign_id: 'cmp-summit', received_at: ago(4.6), handled: true, auto_action: '', created_at: ago(4.6) },
]));
