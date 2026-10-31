// Demo clients and projects shared by every module (finance, store, growth reference these ids).
// Owned by the projects module; other modules only reference the ids.
import { registerSeed } from './store';

const d = (days: number) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);

export const SHARED_CLIENTS = [
  { id: 'c-hospital', name: 'National Referral Hospital', sector: 'Health', contact_name: 'Dr Amina Juma', phone: '+255712000011', email: 'communications@nrh.go.tz', address: 'Upanga, Dar es Salaam', tin: '100-245-881' },
  { id: 'c-bank', name: 'Bank Foundation', sector: 'Finance', contact_name: 'Faraja Mrema', phone: '+255754210300', email: 'foundation@bank.co.tz', address: 'Posta, Dar es Salaam', tin: '101-332-774' },
  { id: 'c-uni', name: 'University of Health Sciences', sector: 'Education', contact_name: 'Prof. Joseph Mbwambo', phone: '+255765440120', email: 'pro@uhs.ac.tz', address: 'Upanga West, Dar es Salaam', tin: '102-118-905' },
  { id: 'c-summit', name: 'Tanzania Health Summit', sector: 'Health', contact_name: 'Lilian Massawe', phone: '+255713998877', email: 'info@healthsummit.or.tz', address: 'JNICC, Dar es Salaam', tin: '103-447-210' },
  { id: 'c-cement', name: 'Cement Co.', sector: 'Industry', contact_name: 'Ramadhani Ally', phone: '+255786331245', email: 'corporate@cementco.co.tz', address: 'Wazo Hill, Dar es Salaam', tin: '104-562-118' },
  { id: 'c-beverage', name: 'Beverage Co.', sector: 'Consumer', contact_name: 'Irene Kweka', phone: '+255658220031', email: 'brand@beverageco.co.tz', address: 'Mikocheni, Dar es Salaam', tin: '105-903-441' },
];

export const PROJECT_STAGES = ['Brief', 'Pre-production', 'Shoot', 'Ingest & Backup', 'Edit', 'Internal Review', 'Client Review', 'Revisions', 'Final Delivery', 'Invoice', 'Archive'];

export const SHARED_PROJECTS = [
  { id: 'p-summit', name: 'Tanzania Health Summit 2026 — live', client_id: 'c-summit', service: 'Live Streaming', stage: 'Shoot', lead_id: 'u-enock', start_date: d(-3), end_date: d(4), budget: 15000000, contract_value: 22000000, priority: 'High', location: 'JNICC, Dar es Salaam', health: 'amber' },
  { id: 'p-grad', name: 'Graduation film 2026', client_id: 'c-uni', service: 'Event Coverage', stage: 'Edit', lead_id: 'u-benedicto', start_date: d(-14), end_date: d(10), budget: 7000000, contract_value: 11500000, priority: 'Normal', location: 'Upanga, Dar es Salaam', health: 'green' },
  { id: 'p-bank', name: 'Scholarship campaign film', client_id: 'c-bank', service: 'Corporate Video', stage: 'Client Review', lead_id: 'u-enock', start_date: d(-40), end_date: d(-2), budget: 5000000, contract_value: 17936000, priority: 'High', location: 'Dar es Salaam & Dodoma', health: 'red' },
  { id: 'p-cement', name: 'Plant safety film', client_id: 'c-cement', service: 'Documentary', stage: 'Pre-production', lead_id: 'u-benedicto', start_date: d(2), end_date: d(35), budget: 8500000, contract_value: 12800000, priority: 'Normal', location: 'Wazo Hill, Dar es Salaam', health: 'green' },
  { id: 'p-hospital', name: 'Hospital care stories (retainer)', client_id: 'c-hospital', service: 'Monthly Retainer', stage: 'Edit', lead_id: 'u-jonathan', start_date: d(-120), end_date: d(245), budget: 3200000, contract_value: 4500000, priority: 'Normal', location: 'Upanga, Dar es Salaam', health: 'green' },
  { id: 'p-podcast', name: 'Health Talk podcast — season 2', client_id: 'c-hospital', service: 'Podcast Series', stage: 'Brief', lead_id: 'u-jonathan', start_date: d(7), end_date: d(90), budget: 2400000, contract_value: 6000000, priority: 'Low', location: 'Basil Media studio, Mikocheni', health: 'green' },
];

registerSeed('clients', () => SHARED_CLIENTS);
registerSeed('projects', () => SHARED_PROJECTS);
