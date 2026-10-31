// Demo seed for growth, retainers and the boss cockpit. Dates are relative to today so the demo stays fresh.
import { registerSeed, type Row } from '@/os/lib/store';
import '@/os/lib/shared-seed';
import { addMonths, isoPlus, monthKey, type CalItem, type LedgerRow, type UnitKey, type Units } from './lib';

const d = (n: number) => isoPlus(n);
const ago = (days: number, h = 9) => new Date(Date.now() - days * 864e5 - h * 36e5 + 9 * 36e5).toISOString();
const R = (x: unknown) => x as unknown as Row[];

// ---------- organisations & contacts ----------
const ORGS = [
  ['o-hospital', 'National Referral Hospital', 'Hospital', 'Health', 'c-hospital', 'Upanga, Dar es Salaam'],
  ['o-bank', 'Bank Foundation', 'Bank', 'Finance', 'c-bank', 'Posta, Dar es Salaam'],
  ['o-uni', 'University of Health Sciences', 'University', 'Education', 'c-uni', 'Upanga West, Dar es Salaam'],
  ['o-summit', 'Tanzania Health Summit', 'Event', 'Health', 'c-summit', 'JNICC, Dar es Salaam'],
  ['o-cement', 'Cement Co.', 'Corporate', 'Industry', 'c-cement', 'Wazo Hill, Dar es Salaam'],
  ['o-beverage', 'Beverage Co.', 'Corporate', 'Consumer', 'c-beverage', 'Mikocheni, Dar es Salaam'],
  ['o-coastal', 'Coastal Commercial Bank', 'Bank', 'Finance', null, 'Samora Avenue, Dar es Salaam'],
  ['o-agribank', 'Agricultural Development Bank', 'Bank', 'Agribusiness', null, 'Kivukoni, Dar es Salaam'],
  ['o-afya', 'Afya Bora NGO', 'NGO', 'Health', null, 'Sinza, Dar es Salaam'],
  ['o-mama', 'Mama na Mtoto Foundation', 'NGO', 'Health', null, 'Arusha'],
  ['o-lakezone', 'Lake Zone Regional Hospital', 'Hospital', 'Health', null, 'Mwanza'],
  ['o-kili', 'Kilimanjaro University College', 'University', 'Education', null, 'Moshi'],
  ['o-moh', 'Ministry of Health · Health Promotion Section', 'Government', 'Government', null, 'Dodoma'],
  ['o-council', 'Dar es Salaam City Council', 'Government', 'Government', null, 'Kariakoo, Dar es Salaam'],
  ['o-women', 'Women in Finance Network', 'NGO', 'Finance', null, 'Masaki, Dar es Salaam'],
] as const;
const CONTACTS = [
  ['ct-1', 'o-hospital', 'Dr Amina Juma', 'Head of Communications', '+255712000011', 'communications@nrh.go.tz'],
  ['ct-2', 'o-bank', 'Faraja Mrema', 'Foundation Manager', '+255754210300', 'foundation@bank.co.tz'],
  ['ct-3', 'o-uni', 'Prof. Joseph Mbwambo', 'Public Relations Officer', '+255765440120', 'pro@uhs.ac.tz'],
  ['ct-4', 'o-coastal', 'Neema Kileo', 'Head of Marketing', '+255713441209', 'marketing@coastalbank.co.tz'],
  ['ct-5', 'o-agribank', 'Joseph Mushi', 'Corporate Affairs Manager', '+255767338120', 'corporate@adb.co.tz'],
  ['ct-6', 'o-afya', 'Halima Said', 'Programme Director', '+255689112334', 'halima@afyabora.or.tz'],
  ['ct-7', 'o-mama', 'Grace Lema', 'Country Lead', '+255754778812', 'grace@mamanamtoto.org'],
  ['ct-8', 'o-lakezone', 'Dr Peter Masanja', 'Medical Director', '+255715665001', 'director@lzrh.go.tz'],
  ['ct-9', 'o-kili', 'Dr Rose Temba', 'Dean of Students', '+255762300410', 'dean@kuc.ac.tz'],
  ['ct-10', 'o-moh', 'Mr Baraka Mollel', 'Health Promotion Officer', '+255716900221', 'promotion@afya.go.tz'],
  ['ct-11', 'o-council', 'Ms Zawadi Mkwawa', 'Communications Officer', '+255718002345', 'comms@dcc.go.tz'],
  ['ct-12', 'o-women', 'Ms Upendo Chacha', 'Chairperson', '+255755612398', 'chair@wif.or.tz'],
  ['ct-13', 'o-beverage', 'Irene Kweka', 'Brand Manager', '+255658220031', 'brand@beverageco.co.tz'],
  ['ct-14', 'o-cement', 'Ramadhani Ally', 'Corporate Communications', '+255786331245', 'corporate@cementco.co.tz'],
] as const;

registerSeed('crm_organisations', () => R(ORGS.map(([id, name, type, sector, client_id, city]) => ({ id, name, type, sector, client_id, city, phone: '', email: '', website: '', notes: '', created_at: ago(120) }))));
registerSeed('crm_contacts', () => R(CONTACTS.map(([id, organisation_id, full_name, title, phone, email]) => ({ id, organisation_id, full_name, title, phone, email, is_primary: true }))));

// ---------- leads ----------
type L = [string, string, string, string, string, number, number, string, number | null, string, string];
const LEADS: L[] = [
  ['l-1', 'Brand film + 2027 content retainer', 'o-coastal', 'ct-4', 'Negotiation', 38000000, 70, 'Send revised instalments (40/25/20/15)', -2, 'Referral', 'Brand Storytelling'],
  ['l-2', 'Maternal health campaign films', 'o-afya', 'ct-6', 'Proposal Sent', 24500000, 50, 'Follow-up call on proposal', 1, 'Showcase', 'Films & Documentaries'],
  ['l-3', 'Farmer success stories series', 'o-agribank', 'ct-5', 'Meeting', 18000000, 35, 'Discovery meeting at Kivukoni', 3, 'Event', 'Corporate Content'],
  ['l-4', 'Hospital opening documentary', 'o-lakezone', 'ct-8', 'Contacted', 15500000, 20, 'Send company profile and references', -4, 'Website', 'Films & Documentaries'],
  ['l-5', 'Graduation live stream 2026', 'o-kili', 'ct-9', 'Won', 9800000, 100, 'Kick-off and recce', 6, 'Tender', 'Live Streaming'],
  ['l-6', 'National hand-washing campaign', 'o-moh', 'ct-10', 'Proposal Sent', 42000000, 40, 'Clarify tender submission format', 0, 'Tender', 'Films & Documentaries'],
  ['l-7', 'City clean-up campaign photos', 'o-council', 'ct-11', 'New', 6500000, 10, 'First call', 2, 'Website', 'Photography'],
  ['l-8', 'Mother & baby clinic stories', 'o-mama', 'ct-7', 'Meeting', 12000000, 30, 'Prepare showcase before meeting', 5, 'Showcase', 'Photo Stories'],
  ['l-9', 'Annual gala coverage', 'o-women', 'ct-12', 'Lost', 7200000, 0, '', null, 'Referral', 'Event Coverage'],
  ['l-10', 'Product launch film + event', 'o-beverage', 'ct-13', 'Negotiation', 18500000, 75, 'Contract signature', 1, 'Repeat client', 'Corporate Content'],
  ['l-11', 'Plant safety training podcast', 'o-cement', 'ct-14', 'Contacted', 5400000, 20, 'Send podcast showreel', -1, 'Repeat client', 'Podcast Production'],
  ['l-12', 'Research week coverage', 'o-uni', 'ct-3', 'New', 8800000, 10, 'Qualify budget', 4, 'Website', 'Event Coverage'],
  ['l-13', 'Health Summit 2027 live stream', 'o-summit', null as unknown as string, 'Won', 24000000, 100, 'Send 2027 contract', 14, 'Repeat client', 'Live Streaming'],
  ['l-14', 'Financial literacy podcast', 'o-women', 'ct-12', 'Lost', 4800000, 0, '', null, 'Website', 'Podcast Production'],
];
registerSeed('leads', () =>
  R(LEADS.map(([id, title, organisation_id, contact_id, stage, value, probability, next_action, next, source, service], i) => ({
    id, title, organisation_id, contact_id, stage, value, probability, next_action, next_action_date: next === null ? null : d(next), owner_id: 'u-growth', source, service,
    lost_reason: id === 'l-9' ? 'Price' : id === 'l-14' ? 'No budget' : '', booking_id: null, notes: '', created_at: ago(60 - i * 3), stage_changed_at: ago(i % 5 === 0 ? 3 : 12 + i),
  }))),
);
registerSeed('lead_activity', () =>
  R([
    { id: 'la-1', lead_id: 'l-1', kind: 'stage', from_stage: 'Proposal Sent', to_stage: 'Negotiation', body: '', actor_id: 'u-growth', created_at: ago(3) },
    { id: 'la-2', lead_id: 'l-5', kind: 'stage', from_stage: 'Negotiation', to_stage: 'Won', body: 'Tender award letter received', actor_id: 'u-growth', created_at: ago(4) },
    { id: 'la-3', lead_id: 'l-10', kind: 'stage', from_stage: 'Proposal Sent', to_stage: 'Negotiation', body: '', actor_id: 'u-growth', created_at: ago(2) },
    { id: 'la-4', lead_id: 'l-7', kind: 'created', from_stage: null, to_stage: 'New', body: 'From website booking', actor_id: 'u-growth', created_at: ago(1) },
    { id: 'la-5', lead_id: 'l-9', kind: 'stage', from_stage: 'Negotiation', to_stage: 'Lost', body: 'Went with a cheaper photographer', actor_id: 'u-growth', created_at: ago(5) },
    { id: 'la-6', lead_id: 'l-13', kind: 'stage', from_stage: 'Negotiation', to_stage: 'Won', body: 'Verbal yes from organising committee', actor_id: 'u-boss', created_at: ago(6) },
    { id: 'la-7', lead_id: 'l-12', kind: 'created', from_stage: null, to_stage: 'New', body: '', actor_id: 'u-growth', created_at: ago(2) },
  ]),
);

// ---------- proposals, contracts, tenders, events ----------
const WHO_WE_ARE = 'Basil Media is a Dar es Salaam media house telling health, education and finance stories in film, photo, podcast and live stream. Since 2016 we have worked with hospitals, banks, universities and NGOs across Tanzania.';
const HOW_WE_WORK = 'One account manager, one creative direction and one crew. Brief → pre-production → shoot → edit → two rounds of revisions → final delivery. You approve everything in your client portal, and every shoot day is backed up twice before the crew leaves the venue.';
const WHY_BASIL = 'We understand regulated sectors (patient consent, banking compliance), we deliver in English and Kiswahili, and our crew has filmed in every region of Tanzania. Ten years of references from the National Referral Hospital, Bank Foundation and the Tanzania Health Summit.';
registerSeed('proposals', () =>
  R([
    {
      id: 'pr-1', number: 'BM-P-2026-031', lead_id: 'l-10', organisation_id: 'o-beverage', title: 'Product launch film + event coverage', client_name: 'Beverage Co.', status: 'sent',
      who_we_are: WHO_WE_ARE, who_you_are: 'Beverage Co. is launching a new range in Dar es Salaam, Arusha and Mwanza and needs launch content that works on screens, social media and in the press the same week.',
      what_we_propose: 'A hero launch film that introduces the product with confidence, plus full photo and video coverage of the launch event — turned around fast enough to feed your social channels the same week.',
      client_gains: '• One hero film and 3 cutdowns for TV and digital\n• 6 vertical social clips\n• 150+ edited event photos, next-day selects for press\n• A single point of contact from brief to delivery',
      how_we_work: HOW_WE_WORK, why_basil: WHY_BASIL,
      lines: [{ name: 'Pre-production, script and casting', amount: 2400000 }, { name: 'Hero launch film (2 shoot days, 4K)', amount: 7200000 }, { name: 'Cutdowns and social clips', amount: 2577966 }, { name: 'Launch event photo + video coverage', amount: 3500000 }],
      discount_pct: 0, vat_rate: 18, created_by: 'u-growth', created_at: ago(9), sent_at: ago(8),
    },
    {
      id: 'pr-2', number: 'BM-P-2026-032', lead_id: 'l-2', organisation_id: 'o-afya', title: 'Maternal health campaign — 4 films', client_name: 'Afya Bora NGO', status: 'awaiting_approval',
      who_we_are: WHO_WE_ARE, who_you_are: 'Afya Bora works with community health workers in Dar es Salaam and the Coast Region to reduce maternal deaths.',
      what_we_propose: 'Four short documentary films following mothers, midwives and community health workers, in Kiswahili with English subtitles, plus a photo essay for donors.',
      client_gains: '• Four 3–5 minute films for donors and community screenings\n• 60 edited photos with captions and consent forms\n• Subtitled versions for international partners',
      how_we_work: HOW_WE_WORK, why_basil: WHY_BASIL,
      lines: [{ name: 'Research and consent visits', amount: 1800000 }, { name: 'Filming (6 days, Coast Region)', amount: 10800000 }, { name: 'Editing, subtitles, colour', amount: 6400000 }, { name: 'Photo essay', amount: 1900000 }],
      discount_pct: 12, vat_rate: 18, created_by: 'u-growth', created_at: ago(3), sent_at: null,
    },
    {
      id: 'pr-3', number: 'BM-P-2026-033', lead_id: 'l-1', organisation_id: 'o-coastal', title: 'Brand film + 2027 content retainer', client_name: 'Coastal Commercial Bank', status: 'draft',
      who_we_are: WHO_WE_ARE, who_you_are: 'Coastal Commercial Bank serves 400,000 customers across 28 branches and is refreshing its brand for 2027.', what_we_propose: 'A brand film in January and a Growth tier content retainer for 2027.',
      client_gains: '• Brand film and 5 cutdowns\n• Monthly content calendar with 4 shoot days and 16 posts', how_we_work: HOW_WE_WORK, why_basil: WHY_BASIL,
      lines: [{ name: 'Brand film', amount: 14000000 }, { name: 'Content retainer (12 months × TSH 2,000,000)', amount: 24000000 }], discount_pct: 0, vat_rate: 18, created_by: 'u-growth', created_at: ago(1), sent_at: null,
    },
  ]),
);
const inst = (start: string, paid: number): { label: string; pct: number; due_date: string; paid: boolean }[] =>
  [['On signing', 40, 0], ['After the shoot', 25, 21], ['On first cut', 20, 35], ['On final delivery', 15, 50]].map(([label, pct, off], i) => ({ label: label as string, pct: pct as number, due_date: isoPlus(off as number, new Date(start)), paid: i < paid }));
registerSeed('contracts', () =>
  R([
    { id: 'k-1', number: 'BM-C-2026-011', title: 'Hospital care stories — content retainer', kind: 'Retainer', organisation_id: 'o-hospital', client_id: 'c-hospital', lead_id: null, value: 54000000, start_date: d(-307), end_date: d(58), status: 'active', instalments: [], renewal_notice_days: 90, signed_by_name: 'Dr Amina Juma', signed_at: ago(310), signed_user_agent: 'Mozilla/5.0', created_at: ago(312) },
    { id: 'k-2', number: 'BM-C-2026-019', title: 'Bank Foundation — content retainer', kind: 'Retainer', organisation_id: 'o-bank', client_id: 'c-bank', lead_id: null, value: 39000000, start_date: d(-182), end_date: d(183), status: 'active', instalments: [], renewal_notice_days: 90, signed_by_name: 'Faraja Mrema', signed_at: ago(185), signed_user_agent: 'Mozilla/5.0', created_at: ago(186) },
    { id: 'k-3', number: 'BM-C-2026-027', title: 'Plant safety film', kind: 'Contract', organisation_id: 'o-cement', client_id: 'c-cement', lead_id: null, value: 12800000, start_date: d(-10), end_date: d(35), status: 'active', instalments: inst(d(-10), 1), renewal_notice_days: 30, signed_by_name: 'Ramadhani Ally', signed_at: ago(10), signed_user_agent: 'Mozilla/5.0', created_at: ago(12) },
    { id: 'k-4', number: 'BM-MOU-2025-004', title: 'Media partnership MoU', kind: 'MoU', organisation_id: 'o-uni', client_id: 'c-uni', lead_id: null, value: 0, start_date: d(-340), end_date: d(25), status: 'active', instalments: [], renewal_notice_days: 60, signed_by_name: 'Prof. Joseph Mbwambo', signed_at: ago(340), signed_user_agent: '', created_at: ago(341) },
    { id: 'k-5', number: 'BM-C-2026-031', title: 'Product launch film + event coverage', kind: 'Contract', organisation_id: 'o-beverage', client_id: 'c-beverage', lead_id: 'l-10', value: 18500000, start_date: d(4), end_date: d(45), status: 'awaiting_signature', instalments: inst(d(4), 0), renewal_notice_days: 30, signed_by_name: '', signed_at: null, signed_user_agent: '', created_at: ago(2) },
  ]),
);
registerSeed('tenders', () =>
  R([
    { id: 't-1', title: 'Hand-washing behaviour change films', issuer: 'Ministry of Health', reference: 'MOH/HP/2026/14', closes_on: d(5), value_estimate: 42000000, status: 'Preparing', owner_id: 'u-growth', documents_needed: 'Tax clearance, BRELA certificate, 3 references, bid security', notes: 'Linked to lead l-6' },
    { id: 't-2', title: 'Graduation live streaming services', issuer: 'Kilimanjaro University College', reference: 'KUC/PROC/26/031', closes_on: d(-12), value_estimate: 9800000, status: 'Won', owner_id: 'u-growth', documents_needed: '', notes: 'Award letter received' },
    { id: 't-3', title: 'Annual report photography', issuer: 'Agricultural Development Bank', reference: 'ADB/T/2026/77', closes_on: d(12), value_estimate: 6200000, status: 'Identified', owner_id: 'u-growth', documents_needed: 'Portfolio, CVs of crew', notes: '' },
    { id: 't-4', title: 'Malaria campaign media production', issuer: 'Afya Bora NGO (donor-funded)', reference: 'AB/RFP/09', closes_on: d(-30), value_estimate: 15000000, status: 'Lost', owner_id: 'u-boss', documents_needed: '', notes: 'Lost on price — 18% above winner' },
    { id: 't-5', title: 'City communication framework', issuer: 'Dar es Salaam City Council', reference: 'DCC/COM/2026/02', closes_on: d(2), value_estimate: 28000000, status: 'Submitted', owner_id: 'u-growth', documents_needed: '', notes: 'Opening session at Karimjee Hall' },
  ]),
);
registerSeed('growth_events', () =>
  R([
    { id: 'e-1', title: 'Tanzania Health Summit 2026', kind: 'Conference', starts_on: d(-3), ends_on: d(4), location: 'JNICC, Dar es Salaam', role: 'Covering + exhibiting', owner_id: 'u-boss', cost: 1200000, leads_expected: 10, notes: 'Stand B12 — bring showreel screen' },
    { id: 'e-2', title: 'Bankers Club networking evening', kind: 'Networking', starts_on: d(9), ends_on: d(9), location: 'Masaki, Dar es Salaam', role: 'Attending', owner_id: 'u-growth', cost: 150000, leads_expected: 4, notes: '' },
    { id: 'e-3', title: 'East Africa NGO Forum', kind: 'Conference', starts_on: d(23), ends_on: d(25), location: 'Arusha International Conference Centre', role: 'Attending', owner_id: 'u-growth', cost: 2100000, leads_expected: 6, notes: 'Book travel by mid-month' },
    { id: 'e-4', title: 'Tanzania Creative Awards', kind: 'Awards', starts_on: d(41), ends_on: d(41), location: 'Mlimani City, Dar es Salaam', role: 'Nominated', owner_id: 'u-boss', cost: 400000, leads_expected: 2, notes: 'Hospital care stories nominated' },
    { id: 'e-5', title: 'Universities PR officers workshop', kind: 'Workshop', starts_on: d(16), ends_on: d(16), location: 'Upanga, Dar es Salaam', role: 'Presenting', owner_id: 'u-growth', cost: 0, leads_expected: 5, notes: '' },
  ]),
);

// ---------- share studio ----------
const REFS = [
  ['ref-1', 'p-hospital', 'Hospital care stories', 'National Referral Hospital', 'Health', 'Film', 2026, 'A monthly series of patient and nurse stories, filmed with full consent.', 'Facebook reach up 3× in six months', true],
  ['ref-2', 'p-summit', 'Tanzania Health Summit — live', 'Tanzania Health Summit', 'Health', 'Live stream', 2025, 'Four-camera live stream of a three-day summit with graphics in English and Kiswahili.', '28,000 live viewers across 3 days', true],
  ['ref-3', 'p-grad', 'Graduation film', 'University of Health Sciences', 'Education', 'Film', 2025, 'Ceremony highlights and graduate portraits delivered in a private gallery.', '2,400 photos downloaded by families', true],
  ['ref-4', 'p-bank', 'Scholarship campaign film', 'Bank Foundation', 'Finance', 'Film', 2026, 'Following three scholarship students from Dodoma to Dar es Salaam.', 'Used at the foundation’s annual donor dinner', false],
  ['ref-5', 'p-podcast', 'Health Talk podcast', 'National Referral Hospital', 'Health', 'Podcast', 2026, 'Video podcast with specialists answering listeners’ questions in Kiswahili.', 'Top 10 health podcast in Tanzania', true],
  ['ref-6', null, 'Women in maternity care — photo essay', 'Afya Bora NGO', 'Health', 'Photo story', 2024, 'Forty portraits of midwives across the Coast Region.', 'Exhibited at the NGO Forum', true],
  ['ref-7', null, 'Farmer stories', 'Agricultural cooperative', 'Agribusiness', 'Film', 2024, 'Three farmers, three seasons — how credit changed their harvest.', '', true],
  ['ref-8', 'p-cement', 'Plant safety film', 'Cement Co.', 'Industry', 'Film', 2026, 'Safety induction film for 1,200 plant workers.', '', false],
  ['ref-9', null, 'Bank branch launch — event coverage', 'Commercial bank (confidential)', 'Finance', 'Event', 2025, 'Same-day photo delivery for press and social media.', 'Photos in 6 newspapers next morning', true],
  ['ref-10', null, 'Graduation live stream', 'Private university', 'Education', 'Live stream', 2025, 'Multi-camera stream for families abroad.', '9,000 views', true],
] as const;
registerSeed('reference_items', () =>
  R(REFS.map(([id, project_id, title, client_name, sector, kind, year, summary, results, cleared]) => ({ id, project_id, title, client_name, sector, kind, year, thumbnail_url: '', video_url: '', summary, results, cleared, cleared_by: cleared ? 'u-boss' : null, cleared_at: cleared ? ago(40) : null }))),
);
const NEEMA = { name: 'Neema Lyimo', role: 'Account Manager', phone: '+255712000010', email: 'neema@basilmedia.co.tz', whatsapp: '+255712000010' };
const CTAS = [
  { label: 'Chat on WhatsApp', kind: 'whatsapp', url: 'https://wa.me/255712000010' },
  { label: 'Book a 20-minute call', kind: 'book', url: '/contact' },
];
registerSeed('showcases', () =>
  R([
    { id: 'sh-1', slug: 'afya-bora-maternal-health', title: 'Stories that move donors', mode: 'showcase', recipient_name: 'Halima Said', organisation_id: 'o-afya', lead_id: 'l-2', welcome: 'Halima, asante for your time on Tuesday. Here are four projects close to your maternal health brief — tell us what feels right.', item_ids: ['ref-6', 'ref-1', 'ref-5', 'ref-2'], ctas: CTAS, contact: NEEMA, published: true, expires_on: d(30), created_by: 'u-growth', created_at: ago(8) },
    { id: 'sh-2', slug: 'coastal-bank-brand', title: 'Brand film references', mode: 'showcase', recipient_name: 'Neema Kileo', organisation_id: 'o-coastal', lead_id: 'l-1', welcome: 'Neema, here is the work we talked about — banks, foundations and launches we have filmed in the last two years.', item_ids: ['ref-9', 'ref-7', 'ref-2'], ctas: CTAS, contact: NEEMA, published: true, expires_on: d(21), created_by: 'u-growth', created_at: ago(14) },
    { id: 'sh-3', slug: 'basil-media-links', title: 'Basil Media — quick links', mode: 'linktree', recipient_name: '', organisation_id: null, lead_id: null, welcome: 'Films, photo stories, podcasts and live streams for health, education and finance.', item_ids: ['ref-1', 'ref-2', 'ref-3', 'ref-5', 'ref-10'], ctas: [...CTAS, { label: 'Email us', kind: 'email', url: 'mailto:hello@basilmedia.co.tz' }], contact: NEEMA, published: true, expires_on: null, created_by: 'u-growth', created_at: ago(40) },
  ]),
);
registerSeed('share_events', () => {
  const rows: Record<string, unknown>[] = [];
  let n = 0;
  const add = (sid: string, kind: string, item: string | null, daysAgo: number, v = 'v1') => rows.push({ id: `se-${++n}`, showcase_id: sid, kind, item_id: item, visitor_id: v, user_agent: 'Mozilla/5.0 (iPhone)', created_at: ago(daysAgo, (n * 3) % 9) });
  for (const x of [0, 1, 1, 2, 4, 6]) add('sh-1', 'view', null, x);
  add('sh-1', 'like', 'ref-6', 1); add('sh-1', 'need', 'ref-6', 1); add('sh-1', 'like', 'ref-1', 2); add('sh-1', 'cta', null, 1);
  for (const x of [3, 9, 12]) add('sh-2', 'view', null, x, 'v2');
  add('sh-2', 'like', 'ref-9', 9, 'v2');
  for (let i = 0; i < 14; i++) add('sh-3', 'view', null, i * 2, `v${i}`);
  add('sh-3', 'like', 'ref-2', 5, 'v5'); add('sh-3', 'cta', null, 10, 'v3');
  return R(rows);
});
registerSeed('deal_rooms', () =>
  R([
    {
      id: 'dr-1', token: 'beverage-launch-7k2q', lead_id: 'l-10', title: 'Product launch film + event coverage', client_name: 'Beverage Co.', value: 18500000, showcase_id: null, proposal_id: 'pr-1', quotation_url: '',
      contract_id: 'k-5', contract_terms: '1. Scope. The Producer will deliver the items listed in proposal BM-P-2026-031.\n2. Fees. TSH 18,500,000 including VAT, payable 40% on signing, 25% after the shoot, 20% on first cut, 15% on final delivery.\n3. Revisions. Two rounds of revisions per deliverable are included.\n4. Rights. On full payment the Client receives usage rights to the final deliverables.\n5. Data. Personal data is handled under the Tanzania Personal Data Protection Act, 2022.',
      deposit_pct: 40, deposit_paid_at: null, kickoff_at: null, step: 3, signed_name: '', signed_at: null, signed_user_agent: '', prepared_by: 'u-growth', expires_on: d(30), created_at: ago(8),
    },
    {
      id: 'dr-2', token: 'coastal-brand-q81m', lead_id: 'l-1', title: 'Brand film + 2027 content retainer', client_name: 'Coastal Commercial Bank', value: 38000000, showcase_id: 'sh-2', proposal_id: 'pr-3', quotation_url: '',
      contract_id: null, contract_terms: '1. Scope. Brand film and Growth tier content retainer for 2027.\n2. Fees. Brand film TSH 14,000,000; retainer TSH 2,000,000 per month.\n3. Term. 01/01/2027 – 31/12/2027.',
      deposit_pct: 40, deposit_paid_at: null, kickoff_at: null, step: 1, signed_name: '', signed_at: null, signed_user_agent: '', prepared_by: 'u-growth', expires_on: d(21), created_at: ago(14),
    },
  ]),
);

// ---------- retainers ----------
const HOSPITAL_UNITS: Units = { shoot_days: 4, podcast_episodes: 2, posts: 12, reels: 4, edited_photos: 160 };
const BANK_UNITS: Units = { shoot_days: 2, posts: 8, reels: 2, edited_photos: 80 };
registerSeed('retainers', () =>
  R([
    { id: 'r-hospital', number: 'BM-RET-011', client_id: 'c-hospital', tier: 'Premium', monthly_fee: 4500000, start_date: d(-307), end_date: d(58), status: 'active', allowances: HOSPITAL_UNITS, rollover: 'next_month', rollover_cap_pct: 25, account_manager_id: 'u-growth', notes: 'Consent forms for every patient story. Comms office approves posts within 48 h.' },
    { id: 'r-bank', number: 'BM-RET-019', client_id: 'c-bank', tier: 'Growth', monthly_fee: 3250000, start_date: d(-182), end_date: d(183), status: 'active', allowances: BANK_UNITS, rollover: 'none', rollover_cap_pct: 0, account_manager_id: 'u-growth', notes: 'Scholarship stories and quarterly impact film.' },
  ]),
);
registerSeed('client_users', () => R([{ id: 'cu-1', user_id: 'u-client', client_id: 'c-hospital', role: 'owner' }]));

const thisMonth = monthKey();
const months = (start: string, end: string) => {
  const out: string[] = [];
  for (let m = monthKey(start); m <= monthKey(end); m = addMonths(m, 1)) out.push(m);
  return out;
};
registerSeed('allowance_ledger', () => {
  const rows: LedgerRow[] = [];
  let n = 0;
  const add = (rid: string, cid: string, m: string, unit: UnitKey, qty: number, note = 'Monthly usage') => qty > 0 && rows.push({ id: `al-${++n}`, retainer_id: rid, client_id: cid, month: m, unit, qty, kind: 'usage', source_id: null, note, created_at: `${m}-25T12:00:00Z` });
  for (const m of months(d(-307), d(-1))) {
    if (m >= thisMonth) continue;
    for (const [u, a] of Object.entries(HOSPITAL_UNITS) as [UnitKey, number][]) add('r-hospital', 'c-hospital', m, u, m === addMonths(thisMonth, -1) ? a : Math.max(0, a - (m.charCodeAt(6) % 2)));
  }
  for (const m of months(d(-182), d(-1))) {
    if (m >= thisMonth) continue;
    for (const [u, a] of Object.entries(BANK_UNITS) as [UnitKey, number][]) add('r-bank', 'c-bank', m, u, Math.max(0, a - 1));
  }
  // This month: hospital close to 90%, bank around 40%.
  const H: Units = { shoot_days: 3, podcast_episodes: 1, posts: 11, reels: 3, edited_photos: 150 };
  const B: Units = { shoot_days: 1, posts: 3, reels: 1, edited_photos: 30 };
  for (const [u, q] of Object.entries(H) as [UnitKey, number][]) add('r-hospital', 'c-hospital', thisMonth, u, q, 'This month so far');
  for (const [u, q] of Object.entries(B) as [UnitKey, number][]) add('r-bank', 'c-bank', thisMonth, u, q, 'This month so far');
  return R(rows);
});

const CREW_A = [{ user_id: 'u-jonathan', role: 'Lead camera' }, { user_id: 'u-benedicto', role: 'Photographer' }, { user_id: 'u-driver', role: 'Driver' }];
const CREW_B = [{ user_id: 'u-enock', role: 'Director' }, { user_id: 'u-jonathan', role: 'Camera' }];
const CHECK = (place: string) => [
  { label: `Reserve parking for the crew van at ${place}`, done: false },
  { label: 'Consent forms signed by everyone on camera', done: false },
  { label: 'A quiet room for interviews', done: false },
  { label: 'Name of the person meeting the crew', done: true },
];
const HOSPITAL_TOPICS = ['Nurses of the night shift', 'Cardiac unit patient story', 'Maternity ward welcome', 'Blood donation drive', 'Paediatric oncology day', 'Hospital pharmacy behind the scenes', 'Kidney transplant anniversary', 'Emergency department drill', 'World Health Day walk', 'Physiotherapy success story', 'New MRI unit', 'Volunteer of the month'];
const BANK_TOPICS = ['Scholarship student in Dodoma', 'Quarterly impact film', 'Teachers’ award', 'Women in business forum', 'Scholarship graduation', 'Library donation'];

function calendar(rid: string, cid: string, start: string, end: string, topics: string[], place: string, podcast: boolean): CalItem[] {
  const items: CalItem[] = [];
  let n = 0;
  const today = isoPlus(0);
  const mk = (date: string, kind: CalItem['kind'], title: string, extra: Partial<CalItem> = {}): CalItem => {
    const past = date < today;
    const base: CalItem = {
      id: `${rid}-ci-${++n}`, retainer_id: rid, client_id: cid, date, time: kind === 'post' ? '18:00' : '09:00', kind, title, location: kind === 'shoot' || kind === 'podcast' ? (kind === 'podcast' ? 'Basil Media studio, Mikocheni' : place) : '',
      map_url: kind === 'shoot' ? `https://maps.google.com/?q=${encodeURIComponent(place)}` : '', status: past ? 'Completed' : 'Scheduled', crew: kind === 'shoot' ? CREW_A : kind === 'podcast' ? CREW_B : [],
      call_time: kind === 'shoot' ? '07:30' : kind === 'podcast' ? '09:30' : '', checklist: kind === 'shoot' ? CHECK(place) : [], units: kind === 'shoot' ? { shoot_days: 1, edited_photos: 40 } : kind === 'podcast' ? { podcast_episodes: 1 } : {},
      signoff: past && (kind === 'shoot' || kind === 'podcast') ? { outcome: 'completed', rating: n % 7 === 0 ? 4 : 5, comment: '', at: `${date}T17:00:00Z`, by: cid === 'c-hospital' ? 'u-client' : 'client' } : null,
      gallery_slug: '', link: '', ...extra,
    };
    return base;
  };
  months(start, end).forEach((m, i) => {
    const t = topics[i % topics.length];
    items.push(mk(`${m}-06`, 'shoot', t));
    items.push(mk(`${m}-20`, 'shoot', topics[(i + 3) % topics.length]));
    if (podcast) items.push(mk(`${m}-13`, 'podcast', `Health Talk episode ${i + 1}`));
    items.push(mk(`${m}-10`, 'delivery', `Edited photos — ${t}`, { gallery_slug: cid === 'c-hospital' ? 'hospital-care-stories' : '' }));
    items.push(mk(`${m}-26`, 'delivery', `Monthly film — ${t}`, { link: 'https://youtube.com/@basilmedia' }));
    items.push(mk(`${m}-28`, 'review', 'Monthly review with Account Manager'));
    for (const day of ['03', '09', '16', '23']) items.push(mk(`${m}-${day}`, 'post', `Post · ${topics[(i + Number(day)) % topics.length]}`));
  });
  return items;
}
registerSeed('retainer_calendar', () => {
  const H = calendar('r-hospital', 'c-hospital', d(-307), d(58), HOSPITAL_TOPICS, 'National Referral Hospital, Upanga', true);
  const B = calendar('r-bank', 'c-bank', d(-182), d(183), BANK_TOPICS, 'Bank Foundation HQ, Posta', false);
  // A bank shoot that went wrong (keeps their health amber).
  const bad = B.find((x) => x.kind === 'shoot' && x.date < isoPlus(-20));
  if (bad) bad.signoff = { outcome: 'issue', rating: 2, comment: 'Crew arrived 50 minutes late and the speaker had to wait.', at: `${bad.date}T17:00:00Z`, by: 'client' };
  const place = 'National Referral Hospital, Upanga';
  H.push(
    { id: 'r-hospital-today', retainer_id: 'r-hospital', client_id: 'c-hospital', date: isoPlus(0), time: '08:00', kind: 'shoot', title: 'Hand hygiene week — ward rounds', location: place, map_url: `https://maps.google.com/?q=${encodeURIComponent(place)}`, status: 'Wrapped', crew: CREW_A, call_time: '07:30', checklist: CHECK(place).map((c) => ({ ...c, done: true })), units: { shoot_days: 1, edited_photos: 40 }, signoff: null, gallery_slug: '', link: '' },
    { id: 'r-hospital-next', retainer_id: 'r-hospital', client_id: 'c-hospital', date: isoPlus(1), time: '09:00', kind: 'shoot', title: 'Maternity ward stories', location: 'Maternity block, National Referral Hospital', map_url: `https://maps.google.com/?q=${encodeURIComponent(place)}`, status: 'Crew confirmed', crew: CREW_A, call_time: '08:15', checklist: CHECK('the maternity block'), units: { shoot_days: 1, edited_photos: 40 }, signoff: null, gallery_slug: '', link: '' },
  );
  return R([...H, ...B]);
});
registerSeed('client_requests', () =>
  R([
    { id: 'cr-1', number: 'REQ-0141', client_id: 'c-hospital', retainer_id: 'r-hospital', type: 'shoot', title: 'World Diabetes Day screening camp', preferred_dates: [d(13), d(14)], location: 'Hospital car park tents', deliverables: 'Photos for press + 1 reel', urgency: 'Soon', status: 'New', units: { shoot_days: 1, edited_photos: 40 }, over_allowance: false, quote_amount: 0, quote_status: 'none', requested_by: 'u-client', note: '', created_at: ago(1) },
    { id: 'cr-2', number: 'REQ-0138', client_id: 'c-hospital', retainer_id: 'r-hospital', type: 'reel', title: 'Reel for new MRI unit', preferred_dates: [d(4)], location: 'Radiology', deliverables: '1 reel, 45 s', urgency: 'Normal', status: 'Reviewing', units: { reels: 1 }, over_allowance: false, quote_amount: 0, quote_status: 'none', requested_by: 'u-client', note: '', created_at: ago(5) },
    { id: 'cr-3', number: 'REQ-0136', client_id: 'c-hospital', retainer_id: 'r-hospital', type: 'shoot', title: 'Board of directors portraits', preferred_dates: [d(6), d(8), d(9)], location: 'Boardroom, Admin block', deliverables: '12 portraits', urgency: 'Normal', status: 'Quote needed', units: { shoot_days: 1, edited_photos: 40 }, over_allowance: true, quote_amount: 1800000, quote_status: 'sent', requested_by: 'u-client', note: 'Over this month’s shoot days — extra shoot day quoted.', created_at: ago(7) },
    { id: 'cr-4', number: 'REQ-0131', client_id: 'c-hospital', retainer_id: 'r-hospital', type: 'podcast', title: 'Podcast: breast cancer awareness', preferred_dates: [d(-12)], location: 'Studio', deliverables: '1 episode + 3 clips', urgency: 'Normal', status: 'Scheduled', units: { podcast_episodes: 1 }, over_allowance: false, quote_amount: 0, quote_status: 'none', requested_by: 'u-client', note: 'Recorded on the 13th', created_at: ago(20) },
    { id: 'cr-5', number: 'REQ-0129', client_id: 'c-hospital', retainer_id: 'r-hospital', type: 'posts', title: 'Posts for staff awards night', preferred_dates: [d(-25)], location: '', deliverables: '4 posts', urgency: 'Urgent', status: 'Declined', units: { posts: 4 }, over_allowance: false, quote_amount: 0, quote_status: 'none', requested_by: 'u-client', note: 'Event cancelled by the hospital.', created_at: ago(28) },
    { id: 'cr-6', number: 'REQ-0140', client_id: 'c-bank', retainer_id: 'r-bank', type: 'shoot', title: 'Scholarship award ceremony', preferred_dates: [d(10)], location: 'Bank Foundation HQ, Posta', deliverables: 'Photos + highlight film', urgency: 'Soon', status: 'Reviewing', units: { shoot_days: 1, edited_photos: 40 }, over_allowance: false, quote_amount: 0, quote_status: 'none', requested_by: 'client', note: '', created_at: ago(4) },
    { id: 'cr-7', number: 'REQ-0142', client_id: 'c-bank', retainer_id: 'r-bank', type: 'photos', title: 'Headshots for annual report', preferred_dates: [d(15)], location: 'Posta', deliverables: '30 headshots', urgency: 'Normal', status: 'New', units: { edited_photos: 30 }, over_allowance: false, quote_amount: 0, quote_status: 'none', requested_by: 'client', note: '', created_at: ago(0) },
  ]),
);
registerSeed('client_concerns', () =>
  R([
    { id: 'cc-1', client_id: 'c-bank', subject: 'Crew arrived late at the impact film shoot', body: 'Our speaker waited 50 minutes. Please make sure this does not happen again.', severity: 'High', status: 'In progress', raised_by: 'client', response: 'We are sorry. Neema has called Faraja; the next shoot has a 30-minute buffer and a confirmed driver.', created_at: ago(9) },
    { id: 'cc-2', client_id: 'c-hospital', subject: 'Captions on last month’s posts', body: 'Two posts had the wrong ward name.', severity: 'Low', status: 'Resolved', raised_by: 'u-client', response: 'Corrected within the hour and a second caption check added.', created_at: ago(35) },
  ]),
);

// ---------- boss ----------
const Y = new Date().getFullYear();
registerSeed('scoreboard_targets', () =>
  R([
    { id: 'sb-1', year: Y, metric: 'revenue', label: 'Revenue', unit: 'tsh', target: 528000000, actual: 412000000, sort_order: 1 },
    { id: 'sb-2', year: Y, metric: 'retainers', label: 'Retainer clients', unit: 'count', target: 5, actual: 2, sort_order: 2 },
    { id: 'sb-3', year: Y, metric: 'new_clients', label: 'New clients won', unit: 'count', target: 12, actual: 9, sort_order: 3 },
    { id: 'sb-4', year: Y, metric: 'margin', label: 'Gross margin', unit: 'pct', target: 45, actual: 41, sort_order: 4 },
    { id: 'sb-5', year: Y, metric: 'on_time', label: 'Projects delivered on time', unit: 'pct', target: 90, actual: 84, sort_order: 5 },
    { id: 'sb-6', year: Y, metric: 'nps', label: 'Client rating (★ × 20)', unit: 'pct', target: 92, actual: 90, sort_order: 6 },
  ]),
);
registerSeed('decisions', () =>
  R([
    { id: 'dc-1', decided_on: d(-2), title: 'Hold rates for 2027 retainers', context: 'Two retainers renew in Q1; competitors are discounting.', decision: 'Keep 2026 monthly fees, add one extra reel per month for clients who renew before 15 December.', decided_by: 'u-boss', owner_id: 'u-growth', review_on: d(45), status: 'Active', created_at: ago(2) },
    { id: 'dc-2', decided_on: d(-9), title: 'Second camera kit', context: 'Hospital and bank shoots overlap twice a month.', decision: 'Buy a second FX3 kit in January from retainer income; GM/CFO to confirm cash first.', decided_by: 'u-boss', owner_id: 'u-gm', review_on: d(60), status: 'Active', created_at: ago(9) },
    { id: 'dc-3', decided_on: d(-20), title: 'Tenders above TSH 30M', context: 'Big tenders take two weeks of Neema’s time.', decision: 'Only bid on tenders above TSH 30M if we have a sector reference and the boss signs off the go/no-go.', decided_by: 'u-boss', owner_id: 'u-growth', review_on: d(10), status: 'Active', created_at: ago(20) },
    { id: 'dc-4', decided_on: d(-44), title: 'Late-crew rule', context: 'Bank Foundation complaint.', decision: 'Crew leaves 45 minutes earlier for any shoot in Posta or Kariakoo before 10:00.', decided_by: 'u-gm', owner_id: 'u-enock', review_on: null, status: 'Reviewed', created_at: ago(44) },
  ]),
);
