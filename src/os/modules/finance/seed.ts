// Demo data for Finance & Approvals (browser store only). Amounts in TSH, Dar es Salaam context.
// Seeds are built lazily (when a table is first read) and relative to today, so the demo always looks current.
import { registerSeed, type Row } from '@/os/lib/store';
import { computePayslip, DEFAULT_SETTINGS, runTotals, docTotals, type LineItem } from './lib';

const DAY = 864e5;
const iso = (offsetDays: number, hour = 9, min = 0) => {
  const d = new Date(Date.now() + offsetDays * DAY);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
};
const hoursAgo = (h: number) => new Date(Date.now() - h * 36e5).toISOString();
const day = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);
const YR = new Date().getFullYear();

// ---------------------------------------------------------------- reference lists
const CATEGORIES = ['Crew', 'Transport', 'Equipment hire', 'Per diem & meals', 'Location & permits', 'Post-production', 'Music & licences', 'Printing', 'Contingency', 'Salaries', 'Rent & utilities', 'Software & subscriptions', 'Equipment repairs', 'Marketing', 'Bank & mobile money charges', 'Office & petty cash'];
registerSeed('expense_categories', () => CATEGORIES.map((name, i) => ({ id: `cat-${i + 1}`, name, active: true, sort_order: i + 1 })));

registerSeed('price_items', () => [
  ['Camera crew day (2 cameras)', 'Director/DOP + camera operator, 2 × cinema cameras, lenses, lights', 'day', 1200000],
  ['Drone aerials', 'Licensed pilot, 4K drone, permits in Dar es Salaam', 'day', 600000],
  ['Live streaming (multi-camera)', '3 cameras, vision mixing, encoder, YouTube/Zoom delivery', 'day', 3500000],
  ['Editing', 'Offline + online edit, two revision rounds', 'day', 450000],
  ['Colour grade', 'DaVinci Resolve grade, per day', 'day', 500000],
  ['Motion graphics', 'Titles, lower thirds, animated data', 'minute', 350000],
  ['Podcast episode', 'Studio recording, 2 mics, edit and mastering', 'episode', 450000],
  ['Photography', 'Photographer + edited gallery (80 images)', 'day', 700000],
  ['Scriptwriting', 'Research, interviews and script in English & Kiswahili', 'script', 800000],
  ['Voice-over', 'Professional voice talent, English or Kiswahili', 'script', 250000],
  ['Subtitles', 'English/Kiswahili subtitles, burnt-in or SRT', 'minute', 30000],
  ['Transport within Dar es Salaam', 'Crew van with driver, fuel included', 'day', 150000],
  ['Out-of-town per diem', 'Per crew member, meals and lodging', 'person-day', 120000],
].map(([name, detail, unit, unit_price], i) => ({ id: `pi-${i + 1}`, name, detail, unit, unit_price, active: true })) as Row[]);

registerSeed('finance_accounts', () => [
  { id: 'acc-cash', name: 'Petty cash box', kind: 'cash', opening_balance: 1800000, opening_date: day(-100) },
  { id: 'acc-bank', name: 'CRDB Bank · current account', kind: 'bank', opening_balance: 46000000, opening_date: day(-100) },
  { id: 'acc-mpesa', name: 'M-Pesa Lipa till', kind: 'mobile', opening_balance: 4500000, opening_date: day(-100) },
]);

// ---------------------------------------------------------------- budget lines (share of each project budget)
const PROJECT_BUDGETS: Record<string, number> = { 'p-summit': 15000000, 'p-grad': 7000000, 'p-bank': 5000000, 'p-cement': 8500000, 'p-hospital': 3200000, 'p-podcast': 2400000 };
const SPLIT: Record<string, number[]> = {
  // Crew, Transport, Equipment hire, Per diem, Location, Post, Music, Printing, Contingency
  'p-summit': [32, 12, 25, 10, 6, 6, 2, 2, 5],
  'p-grad': [30, 8, 18, 8, 4, 22, 4, 1, 5],
  'p-bank': [30, 14, 16, 12, 10, 8, 4, 1, 5],
  'p-cement': [30, 10, 18, 8, 8, 16, 4, 1, 5],
  'p-hospital': [30, 14, 8, 10, 4, 22, 4, 3, 5],
  'p-podcast': [25, 8, 10, 6, 4, 30, 12, 0, 5],
};
const LINES = ['Crew', 'Transport', 'Equipment hire', 'Per diem & meals', 'Location & permits', 'Post-production', 'Music & licences', 'Printing', 'Contingency'];
const lineId = (p: string, line: string) => `bl-${p.slice(2)}-${LINES.indexOf(line)}`;
registerSeed('project_budget_lines', () =>
  Object.entries(SPLIT).flatMap(([p, pcts]) => pcts.map((pct, i) => ({ id: lineId(p, LINES[i]), project_id: p, line: LINES[i], allocated: Math.round((PROJECT_BUDGETS[p] * pct) / 100 / 1000) * 1000, notes: '' }))),
);

// ---------------------------------------------------------------- money requests + steps
type R = {
  n: number; who: string; p: string; line: string; amount: number; purpose: string; payee: string; phone: string; method: string; urgency?: string;
  status: string; submittedH: number; reviewH?: number; approveH?: number; payH?: number; retireH?: number; reconcileH?: number;
  rec?: string; approvedAmount?: number; alone?: boolean; changeReturned?: number; verified?: 'pin' | 'passkey'; comment?: string; att?: string; question?: string;
};
const REQS: R[] = [
  { n: 192, who: 'u-benedicto', p: 'p-cement', line: 'Transport', amount: 280000, purpose: 'Van hire for Wazo Hill recce + safety officer pickup', payee: 'Mussa Transport', phone: '+255715330442', method: 'Tigo Pesa', status: 'boss_approval', submittedH: 5, reviewH: 0.7, rec: 'Two recce days, quote checked against last month. Recommend.', att: 'https://example.com/quotes/mussa-van.pdf' },
  { n: 187, who: 'u-enock', p: 'p-summit', line: 'Transport', amount: 180000, purpose: 'Fuel + driver to JNICC, 3 shoot days', payee: 'Enock Mallya', phone: '+255712000004', method: 'M-Pesa', urgency: 'urgent', status: 'boss_approval', submittedH: 4, reviewH: 2, rec: 'Fuel at TSH 3,140/l, 3 round trips Mikocheni–JNICC. Fine.' },
  { n: 186, who: 'u-gm', p: 'p-bank', line: 'Location & permits', amount: 420000, purpose: 'Dodoma location permit + municipal council fee', payee: 'Dodoma City Council', phone: '', method: 'Bank transfer', status: 'boss_approval', submittedH: 9, att: 'https://example.com/permits/dodoma-invoice.pdf' },
  { n: 185, who: 'u-enock', p: 'p-bank', line: 'Crew', amount: 1200000, purpose: 'Freelance camera operator + sound recordist, 3 days Dodoma', payee: 'Baraka Films', phone: '+255754882210', method: 'M-Pesa', urgency: 'urgent', status: 'boss_approval', submittedH: 31, reviewH: 27, rec: 'Rates match our freelancer card. Project is close to its crew line — consider approving TSH 1,000,000.' },
  { n: 189, who: 'u-benedicto', p: 'p-grad', line: 'Equipment hire', amount: 650000, purpose: 'Gimbal + 2 extra lenses hire, 2 graduation days', payee: 'Kariakoo Camera Rentals', phone: '+255688410022', method: 'Airtel Money', urgency: 'urgent', status: 'gm_review', submittedH: 3, att: 'https://example.com/quotes/kariakoo-rental.pdf' },
  { n: 188, who: 'u-jonathan', p: 'p-hospital', line: 'Per diem & meals', amount: 95000, purpose: 'Crew lunches, ward stories shoot day', payee: 'Jonathan Kimaro', phone: '+255712000005', method: 'M-Pesa', status: 'gm_review', submittedH: 30 },
  { n: 193, who: 'u-enock', p: 'p-summit', line: 'Printing', amount: 42000, purpose: 'Crew passes + call sheets printing for JNICC', payee: 'Mikocheni Print Hub', phone: '+255714220098', method: 'HaloPesa', status: 'gm_review', submittedH: 1 },
  { n: 184, who: 'u-jonathan', p: 'p-hospital', line: 'Printing', amount: 35000, purpose: 'Patient release forms printing (200 copies)', payee: 'Upanga Stationers', phone: '+255713448810', method: 'M-Pesa', status: 'approved', submittedH: 20, reviewH: 18, alone: true, rec: 'Under limit — approved.' },
  { n: 183, who: 'u-benedicto', p: 'p-cement', line: 'Location & permits', amount: 300000, purpose: 'Plant access permit + safety induction fee', payee: 'Cement Co. HSE office', phone: '', method: 'Bank transfer', status: 'approved', submittedH: 44, reviewH: 40, approveH: 3, rec: 'Required by the client for site access.', verified: 'passkey' },
  { n: 182, who: 'u-enock', p: 'p-summit', line: 'Equipment hire', amount: 850000, purpose: 'LED wall panels + 2 wireless kits for the plenary hall', payee: 'Pro AV Tanzania', phone: '+255765220110', method: 'Bank transfer', status: 'paid', submittedH: 70, reviewH: 66, approveH: 60, payH: 22, rec: 'Needed for the live stream. Quote is competitive.', verified: 'passkey' },
  { n: 181, who: 'u-benedicto', p: 'p-grad', line: 'Transport', amount: 120000, purpose: 'Taxi + bajaji for graduation rehearsal shoots', payee: 'Benedicto Ngowi', phone: '+255712000006', method: 'M-Pesa', status: 'paid', submittedH: 190, reviewH: 186, approveH: 180, payH: 150, rec: 'OK.', verified: 'pin' },
  { n: 180, who: 'u-enock', p: 'p-bank', line: 'Per diem & meals', amount: 240000, purpose: 'Dodoma per diem, 2 crew × 2 nights', payee: 'Enock Mallya', phone: '+255712000004', method: 'M-Pesa', status: 'retired', submittedH: 260, reviewH: 255, approveH: 250, payH: 240, retireH: 30, changeReturned: 15000, rec: 'Per diem policy rate.', verified: 'passkey' },
  { n: 179, who: 'u-jonathan', p: 'p-podcast', line: 'Music & licences', amount: 150000, purpose: 'Podcast intro music licence (season 2)', payee: 'Bongo Beats Library', phone: '+255677120044', method: 'Bank transfer', status: 'reconciled', submittedH: 500, reviewH: 495, approveH: 490, payH: 470, retireH: 440, reconcileH: 400, rec: 'One-off licence, covers the full season.', verified: 'pin' },
  { n: 178, who: 'u-benedicto', p: 'p-grad', line: 'Post-production', amount: 500000, purpose: 'External colourist for graduation film', payee: 'Grade House', phone: '+255754001122', method: 'Bank transfer', status: 'rejected', submittedH: 120, reviewH: 116, approveH: 110, rec: 'Within budget but we have in-house capacity.', comment: 'Use our in-house colourist — Jonathan has time next week.' },
  { n: 190, who: 'u-jonathan', p: 'p-summit', line: 'Per diem & meals', amount: 75000, purpose: 'Crew meals JNICC day 1', payee: 'Jonathan Kimaro', phone: '+255712000005', method: 'M-Pesa', status: 'returned', submittedH: 26, reviewH: 22, comment: 'Please split per crew member and attach the canteen quote.' },
  { n: 177, who: 'u-enock', p: 'p-summit', line: 'Crew', amount: 2000000, purpose: 'Freelance live-stream crew deposit (vision mixer + 2 operators)', payee: 'StreamTZ Ltd', phone: '', method: 'Bank transfer', status: 'reconciled', submittedH: 600, reviewH: 596, approveH: 590, payH: 580, retireH: 560, reconcileH: 500, rec: 'Contracted crew, signed agreement attached.', verified: 'passkey', att: 'https://example.com/contracts/streamtz.pdf' },
  { n: 176, who: 'u-jonathan', p: 'p-hospital', line: 'Transport', amount: 45000, purpose: 'Bajaji to Muhimbili wards, interview day', payee: 'Jonathan Kimaro', phone: '+255712000005', method: 'M-Pesa', status: 'reconciled', submittedH: 400, reviewH: 398, alone: true, payH: 396, retireH: 380, reconcileH: 300 },
  { n: 191, who: 'u-enock', p: 'p-cement', line: 'Crew', amount: 400000, purpose: 'Safety-film presenter half day', payee: 'Neema Talent', phone: '+255786001200', method: 'M-Pesa', status: 'draft', submittedH: 0 },
  { n: 194, who: 'u-jonathan', p: 'p-grad', line: 'Per diem & meals', amount: 60000, purpose: 'Edit suite late-night meals, 3 nights', payee: 'Jonathan Kimaro', phone: '+255712000005', method: 'M-Pesa', status: 'boss_approval', submittedH: 6, reviewH: 5, rec: 'Deadline week for the graduation film. Recommend.', question: 'Why three nights — is the edit behind schedule?' },
];

const PAYERS = 'u-fin';
function buildRequests() {
  const reqs: Row[] = [];
  const steps: Row[] = [];
  const rets: Row[] = [];
  const exps: Row[] = [];
  let sid = 0;
  const step = (request_id: string, s: string, actor_id: string, decision: string, at: string, extra: Record<string, unknown> = {}) =>
    steps.push({ id: `st-${++sid}`, request_id, step: s, actor_id, decision, comment: '', amount: null, device: '', verified_by: null, at, created_at: at, ...extra });
  for (const x of REQS) {
    const id = `mr-${x.n}`;
    const created = hoursAgo(x.submittedH + 0.3);
    const order = ['draft', 'returned', 'gm_review', 'boss_approval', 'approved', 'paid', 'retired', 'reconciled'];
    const reached = (s: string) => order.indexOf(x.status) >= order.indexOf(s);
    const sub = x.status !== 'draft' ? hoursAgo(x.submittedH) : null;
    const rv = x.reviewH !== undefined ? hoursAgo(x.reviewH) : null;
    const ap = x.approveH !== undefined ? hoursAgo(x.approveH) : null;
    const pd = x.payH !== undefined ? hoursAgo(x.payH) : null;
    const rt = x.retireH !== undefined ? hoursAgo(x.retireH) : null;
    const rc = x.reconcileH !== undefined ? hoursAgo(x.reconcileH) : null;
    const approvedAmount = x.approvedAmount ?? (reached('approved') ? x.amount : null);
    const isGm = x.who === 'u-gm';
    const stageAt = rc ?? rt ?? pd ?? ap ?? rv ?? sub ?? created;
    reqs.push({
      id, number: `BM-REQ-${String(x.n).padStart(4, '0')}`, requester_id: x.who, project_id: x.p, budget_line_id: lineId(x.p, x.line),
      amount: x.amount, approved_amount: approvedAmount, purpose: x.purpose, category: x.line, needed_by: day(x.status === 'gm_review' || x.status === 'boss_approval' ? 2 : -Math.round(x.submittedH / 24) + 2),
      payee: x.payee, payee_phone: x.phone, method: x.method, urgency: x.urgency ?? 'normal', attachment_url: x.att ?? '', status: x.status,
      question: x.question ?? null, recommendation: x.rec ?? '', over_budget: false, duplicate_of: null,
      submitted_at: sub, stage_at: stageAt, reviewed_at: isGm ? null : rv, reviewed_by: rv && !isGm ? 'u-gm' : null,
      approved_at: x.alone ? rv : ap, approved_by: x.alone ? 'u-gm' : ap && x.status !== 'rejected' ? 'u-boss' : x.status === 'rejected' && ap ? 'u-boss' : null, approved_alone: !!x.alone,
      paid_at: pd, paid_by: pd ? PAYERS : null, paid_method: pd ? x.method : null, paid_reference: pd ? (x.method === 'Bank transfer' ? `CRDB-${x.n}88${x.n % 7}` : `QJ${x.n}K7${x.n % 10}XP`) : null, paid_proof_url: pd ? `https://example.com/proof/${x.n}.jpg` : null, paid_account_id: pd ? (x.method === 'Bank transfer' ? 'acc-bank' : 'acc-mpesa') : null,
      retired_at: rt, change_returned: x.changeReturned ?? 0, reconciled_at: rc, reconciled_by: rc ? 'u-gm' : null,
      returned_at: x.status === 'returned' ? rv : null, rejected_at: x.status === 'rejected' ? ap ?? rv : null, created_at: created,
    });
    if (sub) step(id, 'submit', x.who, 'submitted', sub, { amount: x.amount });
    if (rv && !isGm) {
      const decision = x.alone ? 'approved_within_limit' : x.status === 'returned' ? 'returned' : x.status === 'rejected' && !ap ? 'rejected' : 'recommended';
      step(id, 'review', 'u-gm', decision, rv, { comment: x.status === 'returned' ? x.comment ?? '' : x.rec ?? '', amount: x.amount });
    }
    if (x.question) step(id, 'approve', 'u-boss', 'question', hoursAgo(Math.max((x.reviewH ?? 1) - 1, 0.2)), { comment: x.question, amount: x.amount });
    if (ap) step(id, 'approve', 'u-boss', x.status === 'rejected' ? 'rejected' : 'approved', ap, { comment: x.status === 'rejected' ? x.comment ?? '' : '', amount: approvedAmount ?? x.amount, verified_by: x.verified ?? 'pin', device: 'iPhone · Basil Media app' });
    if (pd) {
      step(id, 'pay', PAYERS, 'paid', pd, { comment: `${x.method} · ${reqs[reqs.length - 1].paid_reference}`, amount: approvedAmount });
      exps.push({ id: `ex-mr-${x.n}`, created_at: pd, date: pd.slice(0, 10), amount: Number(approvedAmount) - (x.changeReturned ?? 0), category: x.line, account_id: reqs[reqs.length - 1].paid_account_id, project_id: x.p, budget_line_id: lineId(x.p, x.line), request_id: id, payroll_run_id: null, payee: x.payee, description: `BM-REQ-${String(x.n).padStart(4, '0')} · ${x.purpose}`, receipt_url: `https://example.com/proof/${x.n}.jpg`, petty_cash: x.method === 'Cash', recorded_by: PAYERS });
    }
    if (rt) {
      const spent = Number(approvedAmount) - (x.changeReturned ?? 0);
      rets.push({ id: `ret-${x.n}`, request_id: id, receipts: [{ url: `https://example.com/receipts/${x.n}-a.jpg`, amount: Math.round(spent * 0.6), note: 'Main receipt' }, { url: `https://example.com/receipts/${x.n}-b.jpg`, amount: spent - Math.round(spent * 0.6), note: 'Balance' }], total_spent: spent, change_returned: x.changeReturned ?? 0, note: x.changeReturned ? `Returned TSH ${x.changeReturned.toLocaleString('en-GB')} change by M-Pesa` : '', retired_by: x.who, created_at: rt });
      step(id, 'retire', x.who, 'retired', rt, { amount: spent });
    }
    if (rc) step(id, 'reconcile', 'u-gm', 'reconciled', rc, { comment: 'Receipts match.' });
  }
  return { reqs, steps, rets, exps };
}
let built: ReturnType<typeof buildRequests> | null = null;
const B = () => (built ??= buildRequests());
registerSeed('money_requests', () => B().reqs);
registerSeed('approval_steps', () => B().steps);
registerSeed('retirements', () => B().rets);

// ---------------------------------------------------------------- invoices, payments, quotations
const vat = () => DEFAULT_SETTINGS.vat_rate; // lazy: lib and seed import each other
const it = (title: string, detail: string, qty: number, unit_price: number): LineItem => ({ title, detail, qty, unit_price });
type InvSeed = { n: number; client: string; project: string | null; title: string; issue: number; due: number; items: LineItem[]; status: string; schedule?: { label: string; pct: number; due: number }[]; pays?: { pct?: number; amount?: number; daysAgo: number; method: string; deposit?: boolean; account: string }[]; discount?: number; po?: string; quote?: string; proforma?: string };
const INVOICES: InvSeed[] = [
  { n: 41, client: 'c-bank', project: 'p-bank', title: 'Scholarship campaign film', issue: -46, due: 14, po: 'PO-BF-2026-118', status: 'sent',
    items: [it('Pre-production & script', 'Research, interviews, bilingual script', 1, 2400000), it('Filming · Dar es Salaam & Dodoma', '4 shoot days, 2-camera crew, drone', 4, 1800000), it('Edit, grade & sound mix', 'Hero film 3 min + 3 cut-downs', 1, 4200000), it('Motion graphics & subtitles', 'English/Kiswahili', 1, 1400000)],
    schedule: [{ label: 'Deposit on signing', pct: 40, due: -46 }, { label: 'After filming', pct: 25, due: 14 }, { label: 'On delivery', pct: 20, due: 30 }, { label: 'After broadcast', pct: 15, due: 60 }],
    pays: [{ pct: 40, daysAgo: 45, method: 'Bank transfer', deposit: true, account: 'acc-bank' }] },
  { n: 31, client: 'c-bank', project: 'p-bank', title: 'Foundation annual report photography', issue: -44, due: -14, status: 'sent',
    items: [it('Photography', 'Scholar portraits, 3 regions', 4, 700000), it('Retouching & layout-ready files', '120 images', 1, 760000)], pays: [] },
  { n: 29, client: 'c-summit', project: null, title: 'Health Summit 2025 highlights — balance', issue: -71, due: -41, status: 'sent',
    items: [it('Highlights film balance', 'Final 30% of 2025 contract', 1, 3500000)], pays: [] },
  { n: 27, client: 'c-summit', project: null, title: 'Summit speaker interviews series', issue: -95, due: -65, status: 'sent',
    items: [it('Speaker interviews', '12 short interviews, edited', 12, 250000)], pays: [{ amount: 1500000, daysAgo: 60, method: 'Bank transfer', account: 'acc-bank' }] },
  { n: 35, client: 'c-summit', project: 'p-summit', title: 'Tanzania Health Summit 2026 — live streaming', issue: -30, due: -16, status: 'sent',
    items: [it('Live streaming (multi-camera)', '3 days, plenary + breakout', 3, 3500000), it('Highlights film', 'Daily highlights + final 3-min film', 1, 4144068)],
    schedule: [{ label: 'Deposit', pct: 50, due: -16 }, { label: 'After event', pct: 50, due: 20 }],
    pays: [{ pct: 50, daysAgo: 18, method: 'Bank transfer', deposit: true, account: 'acc-bank' }] },
  { n: 38, client: 'c-uni', project: 'p-grad', title: 'Graduation film 2026', issue: -20, due: 10, status: 'viewed',
    items: [it('Event coverage', '2 graduation days, 3 cameras', 2, 1800000), it('Edit & highlights', 'Ceremony film + 90-second social cut', 1, 2500000), it('Photography', 'Graduates gallery', 2, 700000), it('Drone aerials', '', 1, 600000)],
    schedule: [{ label: 'Deposit', pct: 50, due: -14 }, { label: 'On delivery', pct: 50, due: 10 }],
    pays: [{ pct: 50, daysAgo: 13, method: 'Bank transfer', deposit: true, account: 'acc-bank' }] },
  { n: 36, client: 'c-hospital', project: 'p-hospital', title: 'Care stories retainer — September', issue: -40, due: -26, status: 'sent',
    items: [it('Monthly retainer', '4 patient stories + social cut-downs', 1, 3813559)], pays: [{ amount: 4500000, daysAgo: 27, method: 'Bank transfer', account: 'acc-bank' }] },
  { n: 32, client: 'c-hospital', project: 'p-hospital', title: 'Care stories retainer — August', issue: -70, due: -56, status: 'sent',
    items: [it('Monthly retainer', '4 patient stories + social cut-downs', 1, 3813559)], pays: [{ amount: 4500000, daysAgo: 58, method: 'Bank transfer', account: 'acc-bank' }] },
  { n: 40, client: 'c-hospital', project: 'p-hospital', title: 'Care stories retainer — October', issue: -9, due: 5, status: 'sent',
    items: [it('Monthly retainer', '4 patient stories + social cut-downs', 1, 3813559)], pays: [] },
  { n: 33, client: 'c-beverage', project: null, title: 'Festive TV commercial', issue: -60, due: -46, status: 'sent',
    items: [it('TV commercial 30s', 'Concept, shoot, post', 1, 6800000), it('Social cut-downs', '15s + 6s', 2, 600000)], pays: [{ pct: 100, daysAgo: 48, method: 'Bank transfer', account: 'acc-bank' }] },
  { n: 42, client: 'c-cement', project: 'p-cement', title: 'Plant safety film — deposit', issue: 0, due: 14, status: 'draft', quote: 'qu-18',
    items: [it('Scriptwriting', 'Safety procedures script, Kiswahili + English', 1, 800000), it('Camera crew day (2 cameras)', 'Wazo Hill plant', 4, 1200000), it('Editing', '', 6, 450000), it('Voice-over', 'Kiswahili', 1, 250000), it('Subtitles', 'English', 12, 30000)],
    schedule: [{ label: 'Deposit', pct: 50, due: 14 }, { label: 'On delivery', pct: 50, due: 45 }] },
  { n: 43, client: 'c-summit', project: 'p-summit', title: 'Summit 2027 save-the-date film', issue: -3, due: 11, status: 'sent', proforma: 'pf-3',
    items: [it('Motion graphics', 'Animated save-the-date, 60 seconds', 1, 350000), it('Editing', 'Speaker montage from 2026 footage', 2, 450000), it('Subtitles', 'English/Kiswahili', 2, 30000)],
    schedule: [{ label: 'Deposit', pct: 50, due: 11 }, { label: 'On delivery', pct: 50, due: 40 }] },
  { n: 39, client: 'c-hospital', project: 'p-podcast', title: 'Health Talk podcast — pilot', issue: -25, due: -11, status: 'cancelled',
    items: [it('Podcast episode', 'Pilot', 1, 450000)] },
];
function buildInvoices() {
  const invoices: Row[] = [];
  const payments: Row[] = [];
  const income: Row[] = [];
  let rc = 0;
  for (const s of INVOICES) {
    const id = `inv-${s.n}`;
    const doc = { items: s.items, discount: s.discount ?? 0, vat_on: true, vat_rate: vat() };
    const total = docTotals(doc).total;
    const paid = (s.pays ?? []).reduce((a, p) => a + (p.amount ?? Math.round((total * (p.pct ?? 0)) / 100)), 0);
    invoices.push({
      id, number: `BM-INV-${YR}-${String(s.n).padStart(4, '0')}`, client_id: s.client, project_id: s.project, quotation_id: s.quote ?? null, proforma_id: s.proforma ?? null, title: s.title, po_ref: s.po ?? '',
      ...doc, deposit: s.schedule?.[0] ? Math.round((total * s.schedule[0].pct) / 100) : 0,
      schedule: (s.schedule ?? []).map((x) => ({ label: x.label, pct: x.pct, due: day(x.due) })),
      issue_date: day(s.issue), due_date: day(s.due),
      status: s.status === 'cancelled' || s.status === 'draft' ? s.status : paid >= total ? 'paid' : paid > 0 ? 'partially_paid' : s.status,
      sent_at: s.status !== 'draft' ? iso(s.issue, 10) : null, viewed_at: s.status === 'viewed' ? iso(s.issue + 2, 15) : null,
      paid_at: paid >= total ? iso(-(s.pays?.[s.pays.length - 1]?.daysAgo ?? 0), 11) : null, cancelled_at: s.status === 'cancelled' ? iso(s.issue + 3) : null,
      notes: '', terms: '', created_at: iso(s.issue, 9),
    });
    for (const p of s.pays ?? []) {
      const amount = p.amount ?? Math.round((total * (p.pct ?? 0)) / 100);
      const pid = `pay-${s.n}-${++rc}`;
      const receipt_no = `BM-RCT-${YR}-${String(rc + 60).padStart(4, '0')}`;
      payments.push({ id: pid, invoice_id: id, amount, paid_on: day(-p.daysAgo), method: p.method, reference: `TT${s.n}${rc}CRDB`, account_id: p.account, receipt_no, is_deposit: !!p.deposit, created_at: iso(-p.daysAgo, 11) });
      income.push({ id: `inc-${pid}`, date: day(-p.daysAgo), amount, account_id: p.account, client_id: s.client, project_id: s.project, invoice_id: id, payment_id: pid, category: 'Client payment', description: `Payment · BM-INV-${YR}-${String(s.n).padStart(4, '0')}`, reference: `TT${s.n}${rc}CRDB`, recorded_by: 'u-fin', created_at: iso(-p.daysAgo, 11) });
    }
  }
  return { invoices, payments, income };
}
let inv: ReturnType<typeof buildInvoices> | null = null;
const I = () => (inv ??= buildInvoices());
registerSeed('invoices', () => I().invoices);
registerSeed('invoice_payments', () => I().payments);

registerSeed('quotations', () => {
  const q = (n: number, client: string | null, prospect: string, project: string | null, title: string, issue: number, valid: number, status: string, items: LineItem[], extra: Record<string, unknown> = {}) => ({
    id: `qu-${n}`, number: `BM-QUO-${YR}-${String(n).padStart(4, '0')}`, client_id: client, project_id: project, prospect, title, items, discount: 0, vat_on: true, vat_rate: vat(),
    issue_date: day(issue), valid_until: day(valid), status, sent_at: status !== 'draft' ? iso(issue, 11) : null, viewed_at: ['viewed', 'accepted', 'declined'].includes(status) ? iso(issue + 1, 14) : null,
    accepted_at: status === 'accepted' ? iso(issue + 4) : null, declined_at: status === 'declined' ? iso(issue + 6) : null, invoice_id: null, notes: '', created_at: iso(issue, 10), ...extra,
  });
  return [
    q(18, 'c-cement', '', 'p-cement', 'Plant safety film', -20, 10, 'accepted', INVOICES.find((x) => x.n === 42)!.items, { invoice_id: 'inv-42' }),
    q(19, 'c-beverage', '', null, 'Ramadan campaign — 3 TV spots', -6, 24, 'sent', [it('TV commercial 30s', 'Concept, shoot, post', 3, 6200000), it('Social cut-downs', '15s + 6s per spot', 6, 550000)], { discount: 1500000 }),
    q(20, 'c-hospital', '', 'p-podcast', 'Health Talk podcast — season 2 (12 episodes)', -9, 21, 'viewed', [it('Podcast episode', 'Studio, edit, mastering', 12, 450000), it('Motion graphics', 'Audiogram templates', 1, 350000), it('Photography', 'Guest portraits', 1, 700000)]),
    q(16, 'c-uni', '', null, 'Open day promotional film', -40, -10, 'declined', [it('Camera crew day (2 cameras)', '', 2, 1200000), it('Editing', '', 4, 450000)]),
    q(15, null, 'Kilimanjaro Coffee Exporters', null, 'Brand documentary', -55, -25, 'sent', [it('Scriptwriting', '', 1, 800000), it('Camera crew day (2 cameras)', 'Moshi, 3 days', 3, 1200000), it('Out-of-town per diem', '4 crew × 3 days', 12, 120000), it('Editing', '', 5, 450000)]),
    q(21, null, 'Zanzibar Tourism Board', null, 'Destination photo + drone package', 0, 30, 'draft', [it('Photography', '', 3, 700000), it('Drone aerials', '', 2, 600000)]),
  ];
});

// Proformas: one draft from scratch, one sent awaiting the client, one already converted to invoice 43.
registerSeed('proformas', () => {
  const pf = (n: number, client: string | null, prospect: string, title: string, issue: number, valid: number, status: string, items: LineItem[], extra: Record<string, unknown> = {}) => ({
    id: `pf-${n}`, number: `BM-PF-${YR}-${String(n).padStart(4, '0')}`, client_id: client, project_id: null, quotation_id: null, prospect, title, items, discount: 0, vat_on: true, vat_rate: vat(),
    issue_date: day(issue), valid_until: day(valid), status, sent_at: status !== 'draft' ? iso(issue, 11) : null, accepted_at: status === 'accepted' ? iso(issue + 1, 15) : null, cancelled_at: null,
    invoice_id: null, notes: '', terms: 'Payment by bank transfer or mobile money. Quote the proforma number as reference.', created_at: iso(issue, 10), ...extra,
  });
  return [
    pf(1, 'c-uni', '', 'Convocation livestream — December', -1, 29, 'draft', [it('Live streaming (multi-camera)', 'Main hall, 3 cameras, YouTube delivery', 1, 3500000), it('Photography', 'Graduates gallery', 1, 700000)]),
    pf(2, 'c-bank', '', 'Scholars’ day photo + film package', -5, 25, 'sent', [it('Photography', 'Scholar portraits, 2 days', 2, 700000), it('Camera crew day (2 cameras)', 'Ceremony coverage', 1, 1200000), it('Editing', '3-minute recap film', 2, 450000)], { notes: 'Client needs this to raise a purchase order.' }),
    pf(3, 'c-summit', '', 'Summit 2027 save-the-date film', -8, 22, 'accepted', INVOICES.find((x) => x.n === 43)!.items, { invoice_id: 'inv-43' }),
  ];
});

// ---------------------------------------------------------------- income & expenses (operating)
registerSeed('income', () => [
  ...I().income,
  { id: 'inc-o1', date: day(-75), amount: 850000, account_id: 'acc-mpesa', client_id: null, project_id: null, invoice_id: null, payment_id: null, category: 'Equipment rental', description: 'FX6 kit rental to Kijiji Films (2 days)', reference: 'QH71KX2', recorded_by: 'u-fin', created_at: iso(-75) },
  { id: 'inc-o2', date: day(-38), amount: 1200000, account_id: 'acc-bank', client_id: null, project_id: null, invoice_id: null, payment_id: null, category: 'Training', description: 'Smartphone filmmaking workshop fees (12 participants)', reference: 'CRDB-WS-09', recorded_by: 'u-fin', created_at: iso(-38) },
  { id: 'inc-o3', date: day(-12), amount: 2400000, account_id: 'acc-mpesa', client_id: null, project_id: null, invoice_id: null, payment_id: null, category: 'Event photo booth', description: 'Photo booth — corporate year-end party, Masaki', reference: 'QJ88PL1', recorded_by: 'u-fin', created_at: iso(-12) },
  { id: 'inc-o4', date: day(-3), amount: 650000, account_id: 'acc-cash', client_id: null, project_id: null, invoice_id: null, payment_id: null, category: 'Equipment rental', description: 'Lighting kit rental (cash)', reference: 'Cash receipt 0412', recorded_by: 'u-fin', created_at: iso(-3) },
]);

registerSeed('expenses', () => {
  const e = (n: number, d: number, amount: number, category: string, account: string, description: string, payee: string, extra: Record<string, unknown> = {}) => ({
    id: `ex-${n}`, created_at: iso(d, 12), date: day(d), amount, category, account_id: account, project_id: null, budget_line_id: null, request_id: null, payroll_run_id: null, payee, description, receipt_url: `https://example.com/receipts/ex-${n}.jpg`, petty_cash: account === 'acc-cash', recorded_by: 'u-fin', ...extra,
  });
  const months = [-88, -58, -28];
  const recurring = months.flatMap((d, i) => [
    e(100 + i, d, 2500000, 'Rent & utilities', 'acc-bank', 'Studio rent · Mikocheni', 'Mikocheni Properties Ltd'),
    e(110 + i, d + 2, 380000, 'Rent & utilities', 'acc-mpesa', 'LUKU electricity tokens', 'TANESCO'),
    e(120 + i, d + 3, 290000, 'Software & subscriptions', 'acc-bank', 'Adobe Creative Cloud (team) + Frame.io', 'Adobe'),
    e(130 + i, d + 4, 185000, 'Rent & utilities', 'acc-mpesa', 'Fibre internet 100 Mbps', 'Zuku Fibre'),
    e(140 + i, d + 6, 48000, 'Bank & mobile money charges', 'acc-bank', 'Monthly bank charges', 'CRDB Bank'),
  ]);
  return [
    ...recurring,
    e(1, -80, 1450000, 'Equipment repairs', 'acc-bank', 'Sony FX6 sensor clean + EVF repair', 'Sony Service Centre, Nairobi', { project_id: null }),
    e(2, -66, 420000, 'Marketing', 'acc-mpesa', 'Instagram + LinkedIn boosted posts (showreel)', 'Meta Ads'),
    e(3, -52, 64000, 'Office & petty cash', 'acc-cash', 'Office water + tea supplies', 'Shoppers Plaza'),
    e(4, -47, 230000, 'Post-production', 'acc-bank', 'Music licence — bank film', 'Artlist', { project_id: 'p-bank', budget_line_id: lineId('p-bank', 'Music & licences') }),
    e(5, -35, 1600000, 'Crew', 'acc-bank', 'Freelance drone pilot — Dodoma (contract)', 'SkyEye TZ', { project_id: 'p-bank', budget_line_id: lineId('p-bank', 'Crew') }),
    e(6, -34, 980000, 'Transport', 'acc-mpesa', 'Dar–Dodoma crew van + fuel', 'Mussa Transport', { project_id: 'p-bank', budget_line_id: lineId('p-bank', 'Transport') }),
    e(7, -22, 75000, 'Office & petty cash', 'acc-cash', 'Printer toner', 'Kariakoo Stationers'),
    e(8, -18, 2200000, 'Equipment hire', 'acc-bank', 'Encoder + bonded 4G kit for live stream', 'Pro AV Tanzania', { project_id: 'p-summit', budget_line_id: lineId('p-summit', 'Equipment hire') }),
    e(9, -15, 1250000, 'Crew', 'acc-bank', 'Grad film second shooter (2 days)', 'Asha Mwinyi', { project_id: 'p-grad', budget_line_id: lineId('p-grad', 'Crew') }),
    e(10, -9, 52000, 'Office & petty cash', 'acc-cash', 'Batteries AA ×40 for wireless mics', 'Game Mlimani City'),
    e(11, -6, 620000, 'Marketing', 'acc-mpesa', 'Showreel premiere screening snacks + venue', 'Slipway Events'),
    e(12, -4, 35000, 'Transport', 'acc-cash', 'Bajaji to client meeting, Posta', 'Petty cash'),
    e(13, -2, 1100000, 'Post-production', 'acc-bank', 'Colour grading suite rental (1 week)', 'Grade House', { project_id: 'p-grad', budget_line_id: lineId('p-grad', 'Post-production') }),
    e(14, -1, 2900000, 'Crew', 'acc-bank', 'Summit stream: vision mixer + 2 camera ops balance', 'StreamTZ Ltd', { project_id: 'p-summit', budget_line_id: lineId('p-summit', 'Crew') }),
    ...B().exps,
    ...P().expenses,
  ];
});

// ---------------------------------------------------------------- payroll
const PROFILES: [string, string, string, number, number, number, string, string][] = [
  ['u-boss', 'Emmanuel Basil', 'Chief Executive (Boss)', 2800000, 400000, 0, 'Bank transfer', 'CRDB ··· 4410'],
  ['u-gm', 'Saul Mwakyusa', 'General Manager & CFO', 2400000, 300000, 0, 'Bank transfer', 'NMB ··· 2281'],
  ['u-fin', 'Grace Mushi', 'Finance Officer', 1300000, 150000, 0, 'Bank transfer', 'CRDB ··· 9034'],
  ['u-enock', 'Enock Mallya', 'Project Lead · Producer', 1500000, 250000, 120000, 'Bank transfer', 'NBC ··· 7712'],
  ['u-jonathan', 'Jonathan Kimaro', 'Editor & Camera Operator', 900000, 150000, 0, 'M-Pesa', '+255712000005'],
  ['u-benedicto', 'Benedicto Ngowi', 'Director of Photography', 1100000, 200000, 0, 'Bank transfer', 'CRDB ··· 1180'],
  ['u-store', 'Juma Said', 'Storekeeper', 650000, 100000, 0, 'M-Pesa', '+255712000007'],
  ['u-rehema', 'Rehema Juma', 'Receptionist', 550000, 80000, 0, 'M-Pesa', '+255712000008'],
  ['u-driver', 'Hamisi Omary', 'Driver', 500000, 120000, 50000, 'Tigo Pesa', '+255712000009'],
  ['u-growth', 'Neema Lyimo', 'Growth & Account Manager', 1200000, 200000, 0, 'Bank transfer', 'Stanbic ··· 6620'],
];
const profileRows = () => PROFILES.map(([user_id, full_name, title, basic, allowances, deductions, pay_method, pay_account]) => ({ id: `sp-${user_id.slice(2)}`, user_id, full_name, title, basic, allowances, deductions, pay_method, pay_account, active: true }));
registerSeed('salary_profiles', profileRows);

function buildPayroll() {
  const now = new Date();
  const base = now.getDate() >= 25 ? 1 : 0; // after pay day the current month is already paid
  const periods = [-2 + base, -1 + base, base].map((off) => { const d = new Date(now.getFullYear(), now.getMonth() + off, 25, 12); return { period: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, pay: d.toISOString().slice(0, 10), at: d.getTime() }; });
  const runs: Row[] = [];
  const slips: Row[] = [];
  const expenses: Row[] = [];
  const profs = profileRows();
  periods.forEach((p, i) => {
    const id = `run-${p.period}`;
    const calc = profs.map((x) => computePayslip(x as never, DEFAULT_SETTINGS.statutory_rates));
    const tot = runTotals(calc);
    const paid = i < 2;
    const t = (daysBeforePay: number) => new Date(p.at - daysBeforePay * DAY).toISOString();
    runs.push({
      id, period: p.period, pay_day: p.pay, status: paid ? 'paid' : 'reviewed', ...tot, comment: paid ? '' : 'Checked against September. Enock’s advance deduction continues (TSH 120,000).',
      prepared_by: 'u-fin', prepared_at: paid ? t(6) : hoursAgo(50), reviewed_by: 'u-gm', reviewed_at: paid ? t(4) : hoursAgo(20),
      approved_by: paid ? 'u-boss' : null, approved_at: paid ? t(2) : null, verified_by: paid ? 'passkey' : null,
      paid_by: paid ? 'u-fin' : null, paid_at: paid ? t(0) : null, paid_reference: paid ? `CRDB-BULK-${p.period.replace('-', '')}` : null, created_at: paid ? t(6) : hoursAgo(50),
    });
    calc.forEach((c, j) => slips.push({ id: `ps-${p.period}-${j}`, run_id: id, created_at: t(6), ...c }));
    if (paid) expenses.push({ id: `ex-pay-${p.period}`, created_at: t(0), date: p.pay, amount: tot.gross + tot.nssf_employer + tot.wcf + tot.sdl, category: 'Salaries', account_id: 'acc-bank', project_id: null, budget_line_id: null, request_id: null, payroll_run_id: id, payee: 'Staff payroll', description: `Payroll ${p.period} (gross + employer NSSF, WCF, SDL)`, receipt_url: '', petty_cash: false, recorded_by: 'u-fin' });
  });
  return { runs, slips, expenses };
}
let pr: ReturnType<typeof buildPayroll> | null = null;
const P = () => (pr ??= buildPayroll());
registerSeed('payroll_runs', () => P().runs);
registerSeed('payslips', () => P().slips);
