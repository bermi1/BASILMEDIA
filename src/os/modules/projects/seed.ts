// Demo seed for projects, production and people (used only in demo mode).
import '@/os/lib/shared-seed';
import { registerSeed, type Row } from '@/os/lib/store';
import { addDays, today, weekStart } from './lib';

const d = (n: number) => addDays(today(), n);
const ago = (hours: number) => new Date(Date.now() - hours * 3600e3).toISOString();
const at = (day: string, hm: string) => new Date(`${day}T${hm}:00+03:00`).toISOString();
const cl = (...items: [string, boolean][]) => items.map(([text, done]) => ({ text, done }));
const rows = <T,>(x: T[]) => x as unknown as Row[];

// ---------- crew on projects ----------
registerSeed('project_crew', () => rows([
  { id: 'pc1', project_id: 'p-summit', user_id: 'u-enock', role: 'Project lead', days: 4 },
  { id: 'pc2', project_id: 'p-summit', user_id: 'u-jonathan', role: 'Camera A', days: 4 },
  { id: 'pc3', project_id: 'p-summit', user_id: 'u-benedicto', role: 'Stream operator', days: 4 },
  { id: 'pc4', project_id: 'p-summit', user_id: 'u-driver', role: 'Driver', days: 4 },
  { id: 'pc5', project_id: 'p-grad', user_id: 'u-benedicto', role: 'Project lead', days: 3 },
  { id: 'pc6', project_id: 'p-grad', user_id: 'u-jonathan', role: 'Editor', days: 6 },
  { id: 'pc7', project_id: 'p-bank', user_id: 'u-enock', role: 'Project lead', days: 8 },
  { id: 'pc8', project_id: 'p-bank', user_id: 'u-jonathan', role: 'Camera A', days: 5 },
  { id: 'pc9', project_id: 'p-cement', user_id: 'u-benedicto', role: 'Project lead', days: 6 },
  { id: 'pc10', project_id: 'p-cement', user_id: 'u-enock', role: 'Director', days: 3 },
  { id: 'pc11', project_id: 'p-cement', user_id: 'u-jonathan', role: 'Camera B', days: 3 },
  { id: 'pc12', project_id: 'p-hospital', user_id: 'u-jonathan', role: 'Project lead', days: 8 },
  { id: 'pc13', project_id: 'p-hospital', user_id: 'u-benedicto', role: 'Editor', days: 4 },
  { id: 'pc14', project_id: 'p-podcast', user_id: 'u-jonathan', role: 'Project lead', days: 6 },
  { id: 'pc15', project_id: 'p-podcast', user_id: 'u-growth', role: 'Producer', days: 3 },
]));

// ---------- tasks (mixed: overdue, today, upcoming, done) ----------
const task = (id: string, project_id: string, title: string, assignee_id: string, due: number, priority: string, status: string, extra: Record<string, unknown> = {}) => ({
  id, project_id, title, description: '', assignee_id, due_date: d(due), priority, status, checklist: [], minutes_logged: 0, created_by: 'u-enock',
  created_at: ago(24 * 6), completed_at: status === 'Done' ? ago(24 * Math.max(1, -due)) : null, ...extra,
});
registerSeed('tasks', () => rows([
  task('t1', 'p-summit', 'Back up Day 1 card A002 to NAS', 'u-jonathan', -1, 'Urgent', 'To do', { description: 'Card A002 has only one copy. Copy to NAS and the orange backup drive, then verify checksums.', checklist: cl(['Copy to NAS', false], ['Copy to backup drive', false], ['Verify checksums', false]) }),
  task('t2', 'p-summit', 'Day 2 recap reel (90 s)', 'u-benedicto', 0, 'High', 'In progress', { minutes_logged: 140, checklist: cl(['Select keynote soundbites', true], ['Cut to music', true], ['Lower thirds', false]) }),
  task('t3', 'p-summit', 'Test stream bitrate in Simba hall', 'u-benedicto', 0, 'High', 'To do'),
  task('t4', 'p-summit', 'Charge batteries and format safe cards', 'u-jonathan', 0, 'Normal', 'To do', { checklist: cl(['6 × NP-F970', false], ['Only format cards with 2 verified copies', false]) }),
  task('t5', 'p-summit', 'Closing highlights film', 'u-jonathan', 4, 'High', 'To do'),
  task('t6', 'p-summit', 'Stream keys for YouTube and Facebook', 'u-benedicto', -4, 'High', 'Done', { minutes_logged: 45 }),
  task('t7', 'p-grad', 'Fine cut of graduation film', 'u-jonathan', 2, 'High', 'In progress', { minutes_logged: 420, description: 'Client wants the Vice Chancellor speech under 40 seconds.' }),
  task('t8', 'p-grad', 'Colour grade', 'u-benedicto', 5, 'Normal', 'To do'),
  task('t9', 'p-grad', 'Select 120 photos for gallery', 'u-jonathan', -2, 'Normal', 'To do'),
  task('t10', 'p-grad', 'Licence music track', 'u-benedicto', -8, 'Normal', 'Done', { minutes_logged: 30 }),
  task('t11', 'p-bank', 'Apply client revisions round 2', 'u-jonathan', -3, 'Urgent', 'In progress', { minutes_logged: 210, checklist: cl(['Swap opening shot', true], ['Fix name spelling: Mwanaidi', true], ['Shorten ending', false], ['New logo end board', false]) }),
  task('t12', 'p-bank', 'Swahili subtitles', 'u-benedicto', -5, 'High', 'To do'),
  task('t13', 'p-bank', 'Chase client sign-off', 'u-enock', -1, 'High', 'To do'),
  task('t14', 'p-bank', 'Dodoma interviews transcribed', 'u-jonathan', -15, 'Normal', 'Done', { minutes_logged: 300 }),
  task('t15', 'p-cement', 'Safety induction script draft', 'u-enock', 3, 'High', 'In progress', { minutes_logged: 90 }),
  task('t16', 'p-cement', 'Recce Wazo Hill plant with HSE officer', 'u-benedicto', 3, 'Normal', 'To do'),
  task('t17', 'p-cement', 'PPE for crew (helmets, boots, vests)', 'u-store', 6, 'Normal', 'To do'),
  task('t18', 'p-cement', 'Signed location release', 'u-benedicto', 1, 'Normal', 'To do'),
  task('t19', 'p-hospital', 'Care story: maternity ward nurse', 'u-jonathan', 6, 'Normal', 'To do'),
  task('t20', 'p-hospital', 'October stories delivered', 'u-jonathan', -6, 'Normal', 'Done', { minutes_logged: 600 }),
  task('t21', 'p-hospital', 'Consent forms for patients filmed', 'u-rehema', -1, 'High', 'To do'),
  task('t22', 'p-podcast', 'Guest list: 12 specialists', 'u-growth', 5, 'Normal', 'To do'),
  task('t23', 'p-podcast', 'Studio acoustic panels', 'u-jonathan', 7, 'Low', 'To do'),
  task('t24', 'p-summit', 'Hotel and transport for crew', 'u-driver', -4, 'Normal', 'Done'),
]));
registerSeed('task_comments', () => rows([
  { id: 'tc1', task_id: 't11', author_id: 'u-enock', body: 'Client called — the ending must finish on the scholarship hand-over.', created_at: ago(20) },
  { id: 'tc2', task_id: 't11', author_id: 'u-jonathan', body: 'Working on it. New end board needs the updated logo from the bank.', created_at: ago(18) },
  { id: 'tc3', task_id: 't1', author_id: 'u-gm', body: 'This is urgent: Day 1 card A002 is still on a single drive.', created_at: ago(5) },
  { id: 'tc4', task_id: 't7', author_id: 'u-benedicto', body: 'Rough cut approved internally. Keep the drone shot of the hall.', created_at: ago(30) },
]));

// ---------- shoots for the next 2 weeks (plus recent wrapped days) ----------
const EMERG = 'Police · Fire · Ambulance 112 · Saul (GM/CFO) +255712000002';
const shoot = (id: string, project_id: string, title: string, day: number, call: string, wrap: string, location: string, extra: Record<string, unknown> = {}) => ({
  id, project_id, title, shoot_date: d(day), call_time: call, wrap_time: wrap, location, contact_name: '', contact_phone: '', shot_list: [], equipment: '',
  emergency_contacts: EMERG, nearest_hospital: 'Aga Khan Hospital, Ocean Road · +255 22 211 5151', notes: '', status: day < 0 ? 'Wrapped' : 'Planned',
  wrapped_at: day < 0 ? at(d(day), wrap) : null, ...extra,
});
const SUMMIT = { contact_name: 'Lilian Massawe', contact_phone: '+255713998877', equipment: 'Sony FX6 kit A · Sony FX3 kit B · 2 × wireless lav · ATEM Mini Pro · 6 × 256 GB cards · 2 × 4 TB backup drives · 2 × LED panels', nearest_hospital: 'Aga Khan Hospital, Ocean Road (1.2 km) · +255 22 211 5151' };
registerSeed('shoots', () => rows([
  shoot('s-summit-1', 'p-summit', 'Summit Day 1 · Opening', -2, '05:30', '19:00', 'JNICC, Shaaban Robert St, Dar es Salaam', { ...SUMMIT, shot_list: cl(['Wide of main hall before doors', true], ['Minister arrival', true], ['Keynote — 2 cameras', true], ['Delegate vox pops × 5', true]), wrapped_at: ago(42) }),
  shoot('s-summit-2', 'p-summit', 'Summit Day 2 · Panels', -1, '06:00', '18:30', 'JNICC, Shaaban Robert St, Dar es Salaam', { ...SUMMIT, shot_list: cl(['Panel 1 multi-cam', true], ['Exhibition b-roll', true], ['Sponsor interviews × 3', true]), wrapped_at: ago(16) }),
  shoot('s-summit-3', 'p-summit', 'Summit Day 3 · Closing & awards', 0, '06:30', '20:00', 'JNICC, Shaaban Robert St, Dar es Salaam', { ...SUMMIT, shot_list: cl(['Main hall wide at doors open', true], ['Closing keynote — 2 cameras', false], ['Awards — every winner on stage', false], ['Organiser interview', false], ['Delegate vox pops × 6', false], ['Drone exterior (permit on file)', false]), notes: 'Live stream starts 08:30. Crew van parks in bay 4.' }),
  shoot('s-summit-4', 'p-summit', 'Summit wrap interviews', 1, '09:00', '13:00', 'Serena Hotel, Ohio St, Dar es Salaam', { ...SUMMIT, shot_list: cl(['Organiser chair interview', false], ['Sponsor thank-you messages', false]) }),
  shoot('s-grad-1', 'p-grad', 'Graduation ceremony', -12, '05:00', '16:00', 'University of Health Sciences, Upanga West', { contact_name: 'Prof. Joseph Mbwambo', contact_phone: '+255765440120', shot_list: cl(['Procession', true], ['VC speech', true], ['Graduate portraits', true]) }),
  shoot('s-grad-2', 'p-grad', 'Pick-up interviews with graduates', 5, '09:00', '13:00', 'University of Health Sciences, Upanga West', { contact_name: 'Prof. Joseph Mbwambo', contact_phone: '+255765440120', equipment: 'Sony FX3 kit B · 2 × lav · LED panel', shot_list: cl(['Top graduate interview', false], ['Parents reaction', false], ['Campus b-roll', false]) }),
  shoot('s-bank-1', 'p-bank', 'Dodoma scholar interviews', -22, '07:00', '17:00', 'University of Dodoma, Dodoma', { contact_name: 'Faraja Mrema', contact_phone: '+255754210300', nearest_hospital: 'Benjamin Mkapa Hospital, Dodoma · +255 26 232 1550', shot_list: cl(['Scholar 1 interview', true], ['Scholar 2 at lab', true]) }),
  shoot('s-cement-recce', 'p-cement', 'Plant recce with HSE', 3, '08:00', '12:00', 'Cement Co. plant, Wazo Hill, Dar es Salaam', { contact_name: 'Ramadhani Ally', contact_phone: '+255786331245', equipment: 'Phone + gimbal for scouting · tape measure', shot_list: cl(['Kiln area angles', false], ['Assembly point', false], ['Power for lights', false]), notes: 'PPE mandatory: helmet, boots, vest. Induction at gate 07:45.' }),
  shoot('s-cement-1', 'p-cement', 'Safety film · Day 1', 9, '06:00', '17:00', 'Cement Co. plant, Wazo Hill, Dar es Salaam', { contact_name: 'Ramadhani Ally', contact_phone: '+255786331245', equipment: 'Sony FX6 kit A · drone (permit) · 3 × LED · lav × 2', shot_list: cl(['Gate induction re-enactment', false], ['PPE checklist close-ups', false], ['Forklift safe zone', false], ['Emergency assembly drill', false]), notes: 'PPE mandatory.' }),
  shoot('s-cement-2', 'p-cement', 'Safety film · Day 2', 10, '06:00', '15:00', 'Cement Co. plant, Wazo Hill, Dar es Salaam', { contact_name: 'Ramadhani Ally', contact_phone: '+255786331245', equipment: 'Sony FX6 kit A · 3 × LED', shot_list: cl(['Worker testimonials × 4', false], ['Swahili voice-over pickups', false]) }),
  shoot('s-hospital-1', 'p-hospital', 'Care story · maternity ward', 5, '08:00', '14:00', 'National Referral Hospital, Upanga', { contact_name: 'Dr Amina Juma', contact_phone: '+255712000011', nearest_hospital: 'On site — National Referral Hospital emergency dept.', equipment: 'Sony FX3 kit B · lav × 2 · small LED', shot_list: cl(['Nurse interview', false], ['Ward b-roll (consented patients only)', false]), notes: 'Consent forms must be signed before filming any patient.' }),
  shoot('s-hospital-2', 'p-hospital', 'Care story · children’s wing', 12, '08:00', '13:00', 'National Referral Hospital, Upanga', { contact_name: 'Dr Amina Juma', contact_phone: '+255712000011', nearest_hospital: 'On site — National Referral Hospital emergency dept.', shot_list: cl(['Paediatrician interview', false], ['Play area b-roll', false]) }),
  shoot('s-podcast-1', 'p-podcast', 'Podcast recording · episodes 1–3', 8, '09:00', '17:00', 'Basil Media studio, Mikocheni, Dar es Salaam', { contact_name: 'Neema Lyimo', contact_phone: '+255712000010', nearest_hospital: 'Regency Medical Centre, Mikocheni · +255 22 215 0500', equipment: '3 × cameras · Rode podcast kit · 4 × SM7B', shot_list: cl(['Episode 1 — Heart health', false], ['Episode 2 — Diabetes', false], ['Episode 3 — Mental health', false]) }),
]));
const sc = (id: string, shoot_id: string, user_id: string, role: string, call_time: string, confirmed: boolean) => ({ id, shoot_id, user_id, role, call_time, confirmed_at: confirmed ? ago(30) : null });
registerSeed('shoot_crew', () => rows([
  sc('sc1', 's-summit-1', 'u-enock', 'Director', '05:30', true), sc('sc2', 's-summit-1', 'u-jonathan', 'Camera A', '05:30', true), sc('sc3', 's-summit-1', 'u-benedicto', 'Stream operator', '05:00', true), sc('sc4', 's-summit-1', 'u-driver', 'Driver', '05:00', true),
  sc('sc5', 's-summit-2', 'u-enock', 'Director', '06:00', true), sc('sc6', 's-summit-2', 'u-jonathan', 'Camera A', '06:00', true), sc('sc7', 's-summit-2', 'u-benedicto', 'Stream operator', '05:30', true),
  sc('sc8', 's-summit-3', 'u-enock', 'Director', '06:30', true), sc('sc9', 's-summit-3', 'u-jonathan', 'Camera A · Lead', '06:30', false), sc('sc10', 's-summit-3', 'u-benedicto', 'Stream operator', '06:00', true), sc('sc11', 's-summit-3', 'u-driver', 'Driver', '05:45', true),
  sc('sc12', 's-summit-4', 'u-jonathan', 'Camera A', '09:00', false), sc('sc13', 's-summit-4', 'u-enock', 'Interviewer', '09:00', true),
  sc('sc14', 's-grad-1', 'u-benedicto', 'Director', '05:00', true), sc('sc15', 's-grad-1', 'u-jonathan', 'Camera A', '05:00', true),
  sc('sc16', 's-grad-2', 'u-jonathan', 'Camera A', '09:00', false), sc('sc17', 's-grad-2', 'u-benedicto', 'Interviewer', '09:00', true),
  sc('sc18', 's-bank-1', 'u-enock', 'Director', '07:00', true), sc('sc19', 's-bank-1', 'u-jonathan', 'Camera A', '07:00', true),
  sc('sc20', 's-cement-recce', 'u-benedicto', 'Director', '08:00', true), sc('sc21', 's-cement-recce', 'u-jonathan', 'Camera B', '08:00', false), sc('sc22', 's-cement-recce', 'u-driver', 'Driver', '07:15', false),
  sc('sc23', 's-cement-1', 'u-enock', 'Director', '06:00', false), sc('sc24', 's-cement-1', 'u-jonathan', 'Camera A', '06:00', false), sc('sc25', 's-cement-1', 'u-benedicto', 'Drone', '06:00', false),
  sc('sc26', 's-cement-2', 'u-enock', 'Director', '06:00', false), sc('sc27', 's-cement-2', 'u-benedicto', 'Camera A', '06:00', false),
  sc('sc28', 's-hospital-1', 'u-jonathan', 'Camera A · Lead', '08:00', true), // same day as s-grad-2 → double booking
  sc('sc29', 's-hospital-2', 'u-jonathan', 'Camera A · Lead', '08:00', false),
  sc('sc30', 's-podcast-1', 'u-jonathan', 'Camera A', '09:00', false), sc('sc31', 's-podcast-1', 'u-growth', 'Producer', '09:00', true),
]));

// ---------- deliverables & post-production ----------
const del = (id: string, project_id: string, title: string, spec: string, owner_id: string, due: number, post_status: string, revision_round = 0, delivered = false) => ({ id, project_id, title, spec, owner_id, due_date: d(due), post_status, revision_round, delivered_at: delivered ? ago(48) : null });
registerSeed('deliverables', () => rows([
  del('dl1', 'p-summit', 'Live stream recording', 'Full sessions · 1080p', 'u-benedicto', 5, 'Export'),
  del('dl2', 'p-summit', 'Day 1 recap reel', '90 s · 16:9 + 9:16', 'u-benedicto', -1, 'Ready for review', 1),
  del('dl3', 'p-summit', 'Day 2 recap reel', '90 s · 16:9 + 9:16', 'u-benedicto', 0, 'Fine cut'),
  del('dl4', 'p-summit', 'Closing highlights film', '3 min · 1080p', 'u-jonathan', 4, 'Not started'),
  del('dl5', 'p-grad', 'Graduation film', '6 min · 4K master', 'u-jonathan', 8, 'Fine cut', 0),
  del('dl6', 'p-grad', 'Social cut', '60 s · 9:16', 'u-jonathan', 9, 'Rough cut'),
  del('dl7', 'p-grad', 'Photo gallery', '120 photos', 'u-jonathan', 7, 'Colour'),
  del('dl8', 'p-bank', 'Scholarship campaign film', '4 min · 1080p · EN', 'u-jonathan', -2, 'Ready for review', 2),
  del('dl9', 'p-bank', 'Swahili subtitled version', 'SRT SW', 'u-benedicto', -2, 'Graphics', 1),
  del('dl10', 'p-hospital', 'October care stories × 4', '90 s each', 'u-jonathan', -6, 'Ready for review', 1, true),
  del('dl11', 'p-hospital', 'November story 1 · maternity', '90 s', 'u-jonathan', 10, 'Not started'),
  del('dl12', 'p-cement', 'Safety induction film', '8 min · EN + SW', 'u-enock', 30, 'Not started'),
]));

// ---------- footage safety: cards, drives and verified copies ----------
const card = (id: string, shoot_id: string, project_id: string, label: string, kind: string, size_gb: number, shot_by: string, hours: number) => ({ id, shoot_id, project_id, label, kind, size_gb, shot_by, formatted: false, created_at: ago(hours) });
registerSeed('media_cards', () => rows([
  card('mc1', 's-summit-1', 'p-summit', 'Card A001', 'Memory card', 256, 'u-jonathan', 44),
  card('mc2', 's-summit-1', 'p-summit', 'Card A002', 'Memory card', 256, 'u-jonathan', 42), // footage at risk
  card('mc3', 's-summit-1', 'p-summit', 'Stream recorder SSD 1', 'Drive', 1000, 'u-benedicto', 42),
  card('mc4', 's-summit-2', 'p-summit', 'Card B001', 'Memory card', 256, 'u-jonathan', 16),
  card('mc5', 's-summit-2', 'p-summit', 'Stream recorder SSD 2', 'Drive', 1000, 'u-benedicto', 16),
  card('mc6', 's-grad-1', 'p-grad', 'Card G001', 'Memory card', 128, 'u-jonathan', 290),
  card('mc7', 's-grad-1', 'p-grad', 'Card G002', 'Memory card', 128, 'u-jonathan', 290),
  card('mc8', 's-bank-1', 'p-bank', 'Card D001', 'Memory card', 256, 'u-jonathan', 520),
]));
const cp = (id: string, card_id: string, location: string, verified: boolean, by: string, hours: number) => ({ id, card_id, location, verified, verified_by: verified ? by : null, created_at: ago(hours) });
registerSeed('footage_copies', () => rows([
  cp('fc1', 'mc1', 'NAS · Projects/2026/Summit', true, 'u-jonathan', 40), cp('fc2', 'mc1', 'Backup drive ORANGE-04', true, 'u-jonathan', 39), cp('fc3', 'mc1', 'Cloud (offsite)', false, 'u-jonathan', 30),
  cp('fc4', 'mc2', 'Backup drive ORANGE-04', true, 'u-jonathan', 40),
  cp('fc5', 'mc3', 'NAS · Projects/2026/Summit', true, 'u-benedicto', 40), cp('fc6', 'mc3', 'Backup drive BLUE-02', true, 'u-benedicto', 39),
  cp('fc7', 'mc4', 'Backup drive ORANGE-04', true, 'u-jonathan', 15),
  cp('fc8', 'mc5', 'NAS · Projects/2026/Summit', true, 'u-benedicto', 15), cp('fc9', 'mc5', 'Backup drive BLUE-02', false, 'u-benedicto', 14),
  cp('fc10', 'mc6', 'NAS · Projects/2026/Graduation', true, 'u-jonathan', 285), cp('fc11', 'mc6', 'Backup drive GREEN-01', true, 'u-jonathan', 284),
  cp('fc12', 'mc7', 'NAS · Projects/2026/Graduation', true, 'u-jonathan', 285), cp('fc13', 'mc7', 'Backup drive GREEN-01', true, 'u-jonathan', 284),
  cp('fc14', 'mc8', 'NAS · Projects/2026/Bank', true, 'u-jonathan', 515), cp('fc15', 'mc8', 'Backup drive BLUE-01', true, 'u-jonathan', 514), cp('fc16', 'mc8', 'Cloud (offsite)', true, 'u-jonathan', 500),
]));

// ---------- people ----------
registerSeed('staff_details', () => rows([
  { id: 'sd1', user_id: 'u-boss', job_title: 'Founder & Managing Director', department: 'Leadership', birthday: '1984-03-14', joined: '2016-01-04', emergency_contact: 'Mrs Basil · +255713400100' },
  { id: 'sd2', user_id: 'u-gm', job_title: 'General Manager & CFO', department: 'Leadership', birthday: '1987-11-09', joined: '2019-06-01', emergency_contact: 'Anna Mwakyusa · +255713400200' },
  { id: 'sd3', user_id: 'u-fin', job_title: 'Finance Officer', department: 'Finance', birthday: '1992-07-22', joined: '2021-02-15', emergency_contact: 'Peter Mushi · +255713400300' },
  { id: 'sd4', user_id: 'u-enock', job_title: 'Senior Producer & Project Lead', department: 'Production', birthday: '1990-11-02', joined: '2018-09-10', emergency_contact: 'Esther Mallya · +255713400400' },
  { id: 'sd5', user_id: 'u-jonathan', job_title: 'Videographer', department: 'Production', birthday: '1996-11-21', joined: '2022-01-10', emergency_contact: 'Ruth Kimaro · +255713400500' },
  { id: 'sd6', user_id: 'u-benedicto', job_title: 'Editor & Stream Operator', department: 'Post-production', birthday: '1994-05-30', joined: '2020-08-03', emergency_contact: 'Maria Ngowi · +255713400600' },
  { id: 'sd7', user_id: 'u-store', job_title: 'Storekeeper', department: 'Operations', birthday: '1989-12-12', joined: '2019-03-18', emergency_contact: 'Mwanaisha Said · +255713400700' },
  { id: 'sd8', user_id: 'u-rehema', job_title: 'Receptionist', department: 'Operations', birthday: '1998-01-25', joined: '2023-04-03', emergency_contact: 'Juma Rashid · +255713400800' },
  { id: 'sd9', user_id: 'u-driver', job_title: 'Driver', department: 'Operations', birthday: '1985-11-06', joined: '2017-10-02', emergency_contact: 'Halima Omary · +255713400900' },
  { id: 'sd10', user_id: 'u-growth', job_title: 'Growth & Account Manager', department: 'Growth', birthday: '1993-09-17', joined: '2021-11-01', emergency_contact: 'Lucas Lyimo · +255713401000' },
]));

const wk = () => weekStart();
const rep = (id: string, author_id: string, week: string, hours: number, activities: string, achievements: string, challenges: string, next_week: string, support_needed = '') => ({ id, author_id, week_start: week, activities, hours, achievements, challenges, next_week, support_needed, created_at: ago(30) });
registerSeed('weekly_reports', () => {
  const w = wk(), p = addDays(wk(), -7);
  return rows([
    rep('wr1', 'u-enock', w, 52, 'Health Summit: directed Day 1–2 · Bank film: client call on revisions', 'Two summit days streamed with zero downtime', 'Card A002 not backed up twice — risk', 'Summit closing, Cement recce', 'One more backup drive for events'),
    rep('wr2', 'u-benedicto', w, 48, 'Stream operator at summit · Day 1 recap reel', 'Day 1 recap delivered same night', 'JNICC Wi-Fi unstable in Simba hall', 'Grad colour grade, Cement recce', 'Bonded 4G router for streams'),
    rep('wr3', 'u-store', w, 40, 'Kit out for summit · battery audit', '18 batteries tested, 2 retired', 'Camera A returned late on Wednesday', 'PPE purchase for Cement Co.'),
    rep('wr4', 'u-fin', w, 40, 'Month-end close · summit advances', 'Supplier payments up to date', '', 'October payroll'),
    rep('wr5', 'u-enock', p, 45, 'Bank film revisions · summit pre-production', 'Call sheets out for all summit days', '', 'Summit shoot'),
    rep('wr6', 'u-jonathan', p, 47, 'Graduation fine cut · hospital stories', 'October care stories delivered', 'Laptop slow when exporting 4K', 'Summit Camera A', 'Faster edit machine'),
    rep('wr7', 'u-benedicto', p, 44, 'Graduation rough cut · stream tests', 'Stream test passed', '', 'Summit'),
    rep('wr8', 'u-rehema', p, 40, 'Front desk · consent forms filing', 'All October visitor logs filed', '', 'Hospital consent forms'),
    rep('wr9', 'u-store', p, 40, 'Kit maintenance', 'Lens cleaning done', '', 'Summit kit out'),
    rep('wr10', 'u-growth', p, 42, 'Podcast pitch · two proposals', 'Hospital agreed podcast season 2', '', 'Guest list'),
  ]);
});

registerSeed('suggestions', () => rows([
  { id: 'sg1', author_id: null, anonymous: true, category: 'Concern', body: 'Crew are sometimes told about weekend shoots on Friday night. Please give at least 3 days’ notice.', status: 'Accepted', reply: 'Agreed. From November, weekend call sheets go out by Wednesday 17:00.', replied_by: 'u-gm', replied_at: ago(50), created_at: ago(24 * 6) },
  { id: 'sg2', author_id: 'u-benedicto', anonymous: false, category: 'Idea', body: 'Buy a bonded 4G router so live streams do not depend on venue Wi-Fi.', status: 'Under review', reply: '', replied_by: null, replied_at: null, created_at: ago(26) },
  { id: 'sg3', author_id: null, anonymous: true, category: 'Safety', body: 'The ladder in the store has a cracked step.', status: 'Done', reply: 'Replaced on Tuesday. Thank you for flagging it.', replied_by: 'u-boss', replied_at: ago(24 * 3), created_at: ago(24 * 5) },
  { id: 'sg4', author_id: 'u-jonathan', anonymous: false, category: 'Idea', body: 'Shared music library licence so editors stop buying single tracks.', status: 'Under review', reply: '', replied_by: null, replied_at: null, created_at: ago(8) },
  { id: 'sg5', author_id: null, anonymous: true, category: 'Complaint', body: 'Lunch allowance on long shoot days does not cover JNICC prices.', status: 'Under review', reply: '', replied_by: null, replied_at: null, created_at: ago(3) },
  { id: 'sg6', author_id: 'u-rehema', anonymous: false, category: 'Praise', body: 'The new visitor sign-in tablet saves a lot of time. Thank you!', status: 'Done', reply: 'Glad it helps, Rehema.', replied_by: 'u-gm', replied_at: ago(24 * 9), created_at: ago(24 * 10) },
]));

registerSeed('leave_balances', () => rows(['u-gm', 'u-fin', 'u-enock', 'u-jonathan', 'u-benedicto', 'u-store', 'u-rehema', 'u-driver', 'u-growth'].map((u, i) => ({ id: `lb${i}`, user_id: u, year: new Date().getFullYear(), annual_days: 28 }))));
const lv = (id: string, user_id: string, leave_type: string, s: number, e: number, days: number, status: string, reason: string, decided_by: string | null = null, note = '') => ({ id, user_id, leave_type, start_date: d(s), end_date: d(e), days, reason, status, decided_by, decided_at: decided_by ? ago(20) : null, decision_note: note, created_at: ago(48) });
registerSeed('leave_requests', () => rows([
  lv('lv1', 'u-jonathan', 'Annual', 11, 12, 2, 'Pending', 'Family wedding in Moshi'),
  lv('lv2', 'u-driver', 'Annual', 2, 3, 2, 'Approved', 'Personal errands', 'u-gm', 'Approved — Benedicto drives the recce van.'),
  lv('lv3', 'u-benedicto', 'Annual', 14, 16, 3, 'Pending', 'Rest after summit'),
  lv('lv4', 'u-rehema', 'Sick', -6, -5, 2, 'Approved', 'Flu (doctor’s note attached)', 'u-gm'),
  lv('lv5', 'u-jonathan', 'Annual', -70, -63, 7, 'Approved', 'Annual leave', 'u-gm'),
  lv('lv6', 'u-store', 'Compassionate', -30, -28, 3, 'Approved', 'Bereavement', 'u-boss'),
  lv('lv7', 'u-growth', 'Annual', 20, 21, 2, 'Rejected', 'Long weekend', 'u-gm', 'Podcast recording that week — please pick another date.'),
]));

registerSeed('attendance', () => {
  const t = today(), y = addDays(today(), -1);
  return rows([
    { id: 'at1', user_id: 'u-enock', day: t, clock_in: at(t, '05:58'), clock_out: null, lat: -6.8162, lng: 39.2894, place: 'JNICC, Dar es Salaam' },
    { id: 'at2', user_id: 'u-benedicto', day: t, clock_in: at(t, '05:41'), clock_out: null, lat: -6.8162, lng: 39.2894, place: 'JNICC, Dar es Salaam' },
    { id: 'at3', user_id: 'u-rehema', day: t, clock_in: at(t, '07:52'), clock_out: null, lat: -6.7646, lng: 39.2453, place: 'Office, Mikocheni' },
    { id: 'at4', user_id: 'u-store', day: t, clock_in: at(t, '07:30'), clock_out: null, lat: null, lng: null, place: '' },
    { id: 'at5', user_id: 'u-jonathan', day: y, clock_in: at(y, '05:49'), clock_out: at(y, '19:12'), lat: -6.8162, lng: 39.2894, place: 'JNICC, Dar es Salaam' },
    { id: 'at6', user_id: 'u-enock', day: y, clock_in: at(y, '05:55'), clock_out: at(y, '19:30'), lat: -6.8162, lng: 39.2894, place: 'JNICC, Dar es Salaam' },
    { id: 'at7', user_id: 'u-rehema', day: y, clock_in: at(y, '08:01'), clock_out: at(y, '17:04'), lat: -6.7646, lng: 39.2453, place: 'Office, Mikocheni' },
  ]);
});

registerSeed('announcements', () => rows([
  { id: 'an1', title: 'Footage rule: two verified copies before formatting', body: 'No memory card is formatted until it has two verified copies (NAS + backup drive). Log every copy in the app. Footage at risk alerts now go to the Boss after 24 hours.', author_id: 'u-boss', pinned: true, created_at: ago(24 * 2) },
  { id: 'an2', title: 'Weekly reports due Saturday 18:00', body: 'Please submit your weekly report in the staff app by Saturday 18:00. It takes five minutes and helps us plan crew for the week.', author_id: 'u-gm', pinned: false, created_at: ago(24 * 4) },
  { id: 'an3', title: 'Staff end-of-year party — save the date', body: 'Friday 18 December at the office rooftop, from 18:00. Partners welcome.', author_id: 'u-gm', pinned: false, created_at: ago(24 * 8) },
]));
registerSeed('announcement_acks', () => rows([
  { id: 'aa1', announcement_id: 'an1', user_id: 'u-enock', created_at: ago(40) },
  { id: 'aa2', announcement_id: 'an1', user_id: 'u-benedicto', created_at: ago(38) },
  { id: 'aa3', announcement_id: 'an2', user_id: 'u-enock', created_at: ago(90) },
  { id: 'aa4', announcement_id: 'an2', user_id: 'u-jonathan', created_at: ago(80) },
  { id: 'aa5', announcement_id: 'an2', user_id: 'u-store', created_at: ago(70) },
  { id: 'aa6', announcement_id: 'an3', user_id: 'u-rehema', created_at: ago(150) },
]));
