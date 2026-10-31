// Demo seed for the media store, reception and transport. Imported by index.tsx and phone.tsx so it
// registers whichever loads first. Amounts in TSH; places in Dar es Salaam.
import { registerSeed, type Row } from '@/os/lib/store';
import { dayKey, addDays } from './data';

const H = (h: number) => new Date(Date.now() + h * 36e5).toISOString();
const D = (n: number) => addDays(dayKey(), n);
const at = (dayOffset: number, hour: number, min = 0) => new Date(`${D(dayOffset)}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00+03:00`).toISOString();

type G = [id: string, tag: string, name: string, category: string, make: string, model: string, serial: string, bought: string, price: number, rate: number, location: string, accessories: string, condition?: string, status?: string];
const GEAR: G[] = [
  ['g-fx6-a', 'BM-CAM-001', 'Sony FX6 · body A', 'Camera', 'Sony', 'ILME-FX6V', 'SN 5021847', '2023-02-14', 16500000, 350000, 'Cage A · shelf 1', 'Top handle, LCD arm, 4× BP-U70, 2× 160GB CFexpress A, charger'],
  ['g-fx6-b', 'BM-CAM-002', 'Sony FX6 · body B', 'Camera', 'Sony', 'ILME-FX6V', 'SN 5021903', '2023-08-02', 16900000, 350000, 'Cage A · shelf 1', 'Top handle, LCD arm, 3× BP-U70, 2× 160GB CFexpress A'],
  ['g-fx3', 'BM-CAM-003', 'Sony FX3', 'Camera', 'Sony', 'ILME-FX3', 'SN 3398211', '2024-01-20', 11200000, 250000, 'Cage A · shelf 2', 'XLR handle, 3× NP-FZ100, cage, 2× 128GB SD V90'],
  ['g-a7s3', 'BM-CAM-004', 'Sony A7S III', 'Camera', 'Sony', 'ILCE-7SM3', 'SN 4410276', '2022-05-11', 9400000, 200000, 'Cage A · shelf 2', '3× NP-FZ100, SmallRig cage'],
  ['g-r5', 'BM-CAM-005', 'Canon EOS R5', 'Camera', 'Canon', 'EOS R5', 'SN 0832 1145', '2022-11-03', 10800000, 220000, 'Cage B · shelf 1', 'Battery grip, 3× LP-E6NH, 2× CFexpress B'],
  ['g-r6', 'BM-CAM-006', 'Canon EOS R6 Mark II', 'Camera', 'Canon', 'EOS R6 II', 'SN 0941 2287', '2024-03-09', 7600000, 180000, 'Cage B · shelf 1', '2× LP-E6NH, 2× SD V90'],
  ['g-2470', 'BM-LEN-001', 'Sony FE 24-70mm f/2.8 GM II', 'Lens', 'Sony', 'SEL2470GM2', 'SN 1820554', '2023-02-14', 6100000, 120000, 'Cage A · lens drawer', 'Hood, caps, 82mm VND'],
  ['g-70200', 'BM-LEN-002', 'Sony FE 70-200mm f/2.8 GM OSS II', 'Lens', 'Sony', 'SEL70200GM2', 'SN 1907713', '2023-08-02', 7400000, 140000, 'Cage A · lens drawer', 'Hood, tripod foot, caps'],
  ['g-1635', 'BM-LEN-003', 'Sony FE 16-35mm f/2.8 GM', 'Lens', 'Sony', 'SEL1635GM', 'SN 1733092', '2022-05-11', 5200000, 100000, 'Cage A · lens drawer', 'Hood, caps'],
  ['g-85', 'BM-LEN-004', 'Sony FE 85mm f/1.4 GM', 'Lens', 'Sony', 'SEL85F14GM', 'SN 1650248', '2022-05-11', 4300000, 90000, 'Cage A · lens drawer', 'Hood, caps', 'Excellent', 'reserved'],
  ['g-rf2470', 'BM-LEN-005', 'Canon RF 24-70mm f/2.8L IS USM', 'Lens', 'Canon', 'RF24-70', 'SN 2210038', '2022-11-03', 5600000, 110000, 'Cage B · lens drawer', 'Hood, caps, UV filter'],
  ['g-rf50', 'BM-LEN-006', 'Canon RF 50mm f/1.2L USM', 'Lens', 'Canon', 'RF50 1.2', 'SN 2398410', '2023-04-18', 4900000, 90000, 'Repair shelf', 'Hood, caps', 'Damaged', 'in_repair'],
  ['g-600d', 'BM-LGT-001', 'Aputure LS 600d Pro', 'Light', 'Aputure', 'LS 600d Pro', 'SN 6D0047731', '2023-06-30', 5900000, 120000, 'Lighting bay · rack 1', 'Light Dome II, reflector, V-mount plate, road case'],
  ['g-300x', 'BM-LGT-002', 'Aputure LS 300X', 'Light', 'Aputure', 'LS 300X', 'SN 3X0022184', '2022-09-12', 2900000, 70000, 'Lighting bay · rack 1', 'Fresnel 2X, Light Dome Mini II'],
  ['g-amaran', 'BM-LGT-003', 'Amaran 200x S (pair)', 'Light', 'Amaran', '200x S', 'SN AM2X-77310/11', '2024-02-02', 1900000, 50000, 'Lighting bay · rack 2', '2× softbox, 2× stands'],
  ['g-mc', 'BM-LGT-004', 'Aputure MC Pro 8-light kit', 'Light', 'Aputure', 'MC Pro', 'SN MCP8-10294', '2024-07-15', 3400000, 80000, 'Lighting bay · rack 2', 'Charging case, diffusion'],
  ['g-nova', 'BM-LGT-005', 'Aputure Nova P300c', 'Light', 'Aputure', 'Nova P300c', 'SN NP3C-00481', '2022-03-22', 6200000, 120000, 'Repair shelf', 'Yoke, control box', 'Damaged', 'out_of_service'],
  ['g-rs4', 'BM-GIM-001', 'DJI RS 4 Pro', 'Gimbal', 'DJI', 'RS 4 Pro', 'SN 3N1PH7A0021', '2024-05-06', 2900000, 70000, 'Cage C · shelf 1', 'Focus motor, BG70 grip, case'],
  ['g-rs3m', 'BM-GIM-002', 'DJI RS 3 Mini', 'Gimbal', 'DJI', 'RS 3 Mini', 'SN 4M2QK1B0098', '2023-03-01', 1100000, 35000, 'Cage C · shelf 1', 'Tripod, case'],
  ['g-mavic', 'BM-DRN-001', 'DJI Mavic 3 Pro', 'Drone', 'DJI', 'Mavic 3 Pro Cine', 'SN 1581F5FHD23', '2023-09-19', 12500000, 300000, 'Drone locker', 'RC Pro, 3× batteries, ND set, TCAA permit copy'],
  ['g-mini4', 'BM-DRN-002', 'DJI Mini 4 Pro', 'Drone', 'DJI', 'Mini 4 Pro', 'SN 1581F6RTA44', '2024-08-10', 2600000, 90000, 'Drone locker', 'RC 2, 3× batteries, charging hub'],
  ['g-mkh416', 'BM-AUD-001', 'Sennheiser MKH 416', 'Audio', 'Sennheiser', 'MKH 416', 'SN 4073382', '2021-10-05', 2300000, 45000, 'Audio cabinet', 'Rycote blimp, dead cat, boom pole'],
  ['g-ewd', 'BM-AUD-002', 'Sennheiser EW-D lavalier set (×2)', 'Audio', 'Sennheiser', 'EW-D ME2', 'SN EWD-55120/21', '2023-01-17', 3800000, 70000, 'Audio cabinet', '2× ME2 lavs, receiver, cables'],
  ['g-wgo', 'BM-AUD-003', 'Rode Wireless GO II', 'Audio', 'Rode', 'Wireless GO II', 'SN WGO2-882734', '2023-05-25', 950000, 25000, 'Audio cabinet', '2× Lavalier II, charging pouch'],
  ['g-podmic', 'BM-AUD-004', 'Rode PodMic set (×4)', 'Audio', 'Rode', 'PodMic', 'SN PM-4410–4413', '2024-01-08', 1400000, 40000, 'Podcast studio', '4× PSA1+ arms, XLR cables'],
  ['g-rcp', 'BM-AUD-005', 'Rodecaster Pro II', 'Audio', 'Rode', 'RCP II', 'SN RCP2-019884', '2024-01-08', 2200000, 60000, 'Podcast studio', 'Power supply, USB-C'],
  ['g-f6', 'BM-AUD-006', 'Zoom F6 field recorder', 'Audio', 'Zoom', 'F6', 'SN F6-117702', '2022-07-14', 1900000, 40000, 'Repair shelf', 'Battery sled, case', 'Fair', 'in_repair'],
  ['g-ssd-a', 'BM-DRV-001', 'Samsung T7 Shield 2TB · A', 'Drive', 'Samsung', 'MU-PE2T0', 'SN S6XNNS0T401', '2024-02-20', 480000, 15000, 'Data shelf', 'USB-C cable'],
  ['g-ssd-b', 'BM-DRV-002', 'Samsung T7 Shield 2TB · B', 'Drive', 'Samsung', 'MU-PE2T0', 'SN S6XNNS0T477', '2024-02-20', 480000, 15000, 'Data shelf', 'USB-C cable'],
  ['g-g40', 'BM-DRV-003', 'SanDisk Pro-G40 4TB SSD', 'Drive', 'SanDisk', 'Pro-G40', 'SN 22441M80021', '2024-06-11', 1350000, 30000, 'Data shelf', 'Thunderbolt cable'],
  ['g-mbp', 'BM-LAP-001', 'MacBook Pro 16" M3 Max (DIT)', 'Laptop', 'Apple', 'MacBook Pro 16 M3 Max', 'SN C02FK3M9Q6L', '2024-03-02', 9800000, 150000, 'Edit suite', 'Charger, card reader, hard case'],
  ['g-flowtech', 'BM-TRI-001', 'Sachtler Flowtech 75 tripod', 'Tripod', 'Sachtler', 'Flowtech 75 + FSB 8', 'SN FT75-30021', '2022-04-09', 3600000, 60000, 'Grip room', 'Mid spreader, bag'],
  ['g-504x', 'BM-TRI-002', 'Manfrotto 504X tripod', 'Tripod', 'Manfrotto', '504X + 645 legs', 'SN MN504-8812', '2023-07-21', 1700000, 35000, 'Grip room', 'Bag'],
  ['g-ninja', 'BM-MON-001', 'Atomos Ninja V+', 'Monitor', 'Atomos', 'Ninja V+', 'SN ATOMNJVP-3301', '2023-02-14', 1500000, 40000, 'Cage C · shelf 2', 'Sunhood, 2× NP-F970, 1TB SSD'],
  ['g-indie7', 'BM-MON-002', 'SmallHD Indie 7', 'Monitor', 'SmallHD', 'Indie 7', 'SN SHD7-55102', '2024-04-30', 1700000, 45000, 'Cage C · shelf 2', 'Sunhood, arm', 'Good', 'reserved'],
  ['g-atem', 'BM-STR-001', 'Blackmagic ATEM Mini Extreme ISO', 'Streaming', 'Blackmagic', 'ATEM Mini Extreme ISO', 'SN ATEMX-201183', '2023-10-03', 2600000, 90000, 'Streaming case', 'Power, 4× HDMI 10m, LAN cable'],
  ['g-vmount', 'BM-PWR-001', 'V-mount batteries (×4) + charger', 'Power', 'Core SWX', 'Hypercore NEO 98', 'SN CSWX-98-0412', '2023-02-14', 2400000, 50000, 'Charging station', 'Dual charger'],
  ['g-mars', 'BM-STR-002', 'Hollyland Mars 4K wireless video', 'Streaming', 'Hollyland', 'Mars 4K', 'SN HLM4K-11920', '2024-09-01', 1600000, 45000, 'Cage C · shelf 2', 'TX, RX, antennas, case'],
];

// Open check-outs: [id, gear, holder, project, outHoursAgo, dueInHours, ack]
type C = [string, string, string, string, number, number, boolean];
const OPEN: C[] = [
  ['co-1', 'g-fx6-a', 'u-jonathan', 'p-summit', 50, -16, true],
  ['co-2', 'g-2470', 'u-jonathan', 'p-summit', 50, -16, true],
  ['co-3', 'g-rs4', 'u-jonathan', 'p-summit', 50, -16, true],
  ['co-4', 'g-ssd-a', 'u-jonathan', 'p-summit', 50, -16, true],
  ['co-5', 'g-fx6-b', 'u-enock', 'p-summit', 74, -30, true],
  ['co-6', 'g-70200', 'u-enock', 'p-summit', 74, -30, true],
  ['co-7', 'g-ewd', 'u-enock', 'p-summit', 74, -30, false],
  ['co-8', 'g-atem', 'u-enock', 'p-summit', 30, 90, true],
  ['co-9', 'g-a7s3', 'u-benedicto', 'p-grad', 20, 52, true],
  ['co-10', 'g-300x', 'u-benedicto', 'p-grad', 20, 52, true],
  ['co-11', 'g-mavic', 'u-benedicto', 'p-grad', 8, 5, true],
  ['co-12', 'g-flowtech', 'u-benedicto', 'p-grad', 20, 52, true],
  ['co-13', 'g-wgo', 'u-jonathan', 'p-hospital', 6, 3, false],
];
// Returned history for ROI: [gear, holder, project, daysAgoOut, daysOut]
const PAST: [string, string, string, number, number][] = [
  ['g-fx6-a', 'u-enock', 'p-bank', 60, 6], ['g-fx6-a', 'u-benedicto', 'p-grad', 30, 4], ['g-fx6-a', 'u-jonathan', 'p-hospital', 110, 8],
  ['g-fx6-b', 'u-enock', 'p-bank', 58, 6], ['g-fx6-b', 'u-jonathan', 'p-hospital', 140, 10],
  ['g-fx3', 'u-jonathan', 'p-hospital', 20, 3], ['g-fx3', 'u-benedicto', 'p-podcast', 45, 2], ['g-fx3', 'u-jonathan', 'p-hospital', 80, 5],
  ['g-a7s3', 'u-jonathan', 'p-hospital', 70, 4], ['g-r5', 'u-benedicto', 'p-grad', 14, 2], ['g-r5', 'u-jonathan', 'p-hospital', 95, 3],
  ['g-mavic', 'u-benedicto', 'p-bank', 50, 3], ['g-mavic', 'u-enock', 'p-cement', 12, 1],
  ['g-600d', 'u-enock', 'p-bank', 60, 6], ['g-600d', 'u-jonathan', 'p-hospital', 25, 2],
  ['g-rs4', 'u-benedicto', 'p-grad', 30, 4], ['g-mkh416', 'u-jonathan', 'p-hospital', 25, 2], ['g-mkh416', 'u-enock', 'p-bank', 60, 6],
  ['g-2470', 'u-enock', 'p-bank', 60, 6], ['g-rf2470', 'u-benedicto', 'p-grad', 14, 2], ['g-mbp', 'u-enock', 'p-bank', 58, 6], ['g-atem', 'u-enock', 'p-bank', 100, 2],
];

registerSeed('gear_items', () =>
  GEAR.map(([id, tag, name, category, make, model, serial, bought, price, rate, location, accessories, condition = 'Good', status]) => {
    const open = OPEN.find((o) => o[1] === id);
    return {
      id, tag, name, category, make, model, serial, purchase_date: bought, purchase_price: price, supplier: category === 'Drone' ? 'DJI Store Dar es Salaam' : ['Sony', 'Canon'].includes(make) ? 'Camera Centre Kariakoo' : make === 'Apple' ? 'iStore Mlimani City' : 'B&H Photo (imported via DHL)',
      condition, location, accessories, insurance_expiry: price > 5000000 ? D(id.length * 9) : null, warranty_expiry: bought > '2024-01-01' ? addDays(bought, 730) : null,
      photo_url: '', day_rate: rate, useful_life_years: ['Laptop', 'Drive'].includes(category) ? 3 : category === 'Tripod' ? 7 : 5, salvage_value: Math.round(price * 0.1),
      holder_id: open ? open[2] : null, status: open || ['g-r5', 'g-rf2470'].includes(id) ? 'out' : status ?? 'available', notes: '', created_at: '2024-01-01T08:00:00Z',
    } as Row;
  }),
);

registerSeed('gear_checkouts', () => [
  ...OPEN.map(([id, gear_id, holder_id, project_id, ago, due, ack]) => ({
    id, gear_id, kit_checkout_id: null, holder_id, project_id, checked_out_by: 'u-store', out_at: H(-ago), due_at: H(due),
    out_condition: 'Good', out_note: '', out_photo_url: '', acknowledged_at: ack ? H(-ago + 0.1) : null, returned_at: null, in_condition: null, in_note: '', in_photo_url: '',
    checked_in_by: null, status: 'out', return_requested_at: null, extension_requested_to: id === 'co-5' ? H(30) : null, extension_reason: id === 'co-5' ? 'Summit day 3 extended — client added a closing session.' : '', created_at: H(-ago),
  })),
  ...PAST.map(([gear_id, holder_id, project_id, ago, days], i) => ({
    id: `co-past-${i}`, gear_id, kit_checkout_id: null, holder_id, project_id, checked_out_by: 'u-store', out_at: at(-ago, 8), due_at: at(-ago + days, 18),
    out_condition: 'Good', out_note: '', out_photo_url: '', acknowledged_at: at(-ago, 8, 5), returned_at: at(-ago + days, 17), in_condition: 'Good', in_note: '', in_photo_url: '',
    checked_in_by: 'u-store', status: 'returned', return_requested_at: null, extension_requested_to: null, extension_reason: '', created_at: at(-ago, 8),
  })),
]);

registerSeed('gear_kits', () => [
  { id: 'kit-interview', code: 'BM-KIT-INT', name: 'Interview Kit', description: 'Two-person sit-down interview: one camera, key + fill light, boom and lav.', gear_ids: ['g-fx3', 'g-1635', 'g-600d', 'g-amaran', 'g-mkh416', 'g-wgo', 'g-504x', 'g-ssd-b'], extras: ['2× NP-FZ100 spare batteries', '2× 128GB SD V90', 'C-stand ×2 + sandbags', 'Lens wipes', 'Gaffer tape'] },
  { id: 'kit-event', code: 'BM-KIT-EVP', name: 'Event Photo Kit', description: 'Conference and graduation stills: two bodies, standard + portrait glass, speedlights.', gear_ids: ['g-r5', 'g-r6', 'g-rf2470', 'g-rf50', 'g-g40'], extras: ['2× Godox V1 speedlight', '6× LP-E6NH batteries', '4× SD V90 cards', 'Rain cover'] },
  { id: 'kit-doc', code: 'BM-KIT-DOC', name: 'Documentary Kit', description: 'Run-and-gun field kit for hospital and community stories, incl. drone.', gear_ids: ['g-fx3', 'g-1635', 'g-rs3m', 'g-mini4', 'g-mkh416', 'g-wgo', 'g-ninja', 'g-vmount', 'g-mbp'], extras: ['First-aid pouch', 'Release forms (×20)', 'Power strip', 'Rain covers ×2'] },
]);

registerSeed('kit_checkouts', () => [
  {
    id: 'kc-1', kit_id: 'kit-interview', holder_id: 'u-jonathan', project_id: 'p-hospital', due_at: at(-9, 18), out_at: at(-10, 8), returned_at: at(-9, 17, 30), status: 'returned', created_by: 'u-store', created_at: at(-10, 8),
    checklist: ['Sony FX3', 'Sony FE 16-35mm f/2.8 GM', 'Aputure LS 600d Pro', 'Sennheiser MKH 416', '2× NP-FZ100 spare batteries'].map((label, i) => ({ key: `l${i}`, label, gear_id: null, out: true, in: true })),
  },
]);

registerSeed('gear_reservations', () => [
  { id: 'rs-1', gear_id: 'g-85', project_id: 'p-cement', holder_id: 'u-benedicto', start_date: D(2), end_date: D(4), note: 'Plant manager interviews', status: 'reserved' },
  { id: 'rs-2', gear_id: 'g-indie7', project_id: 'p-podcast', holder_id: 'u-jonathan', start_date: D(7), end_date: D(8), note: 'Video podcast pilot', status: 'reserved' },
  { id: 'rs-3', gear_id: 'g-fx6-b', project_id: 'p-grad', holder_id: 'u-benedicto', start_date: D(3), end_date: D(4), note: 'Graduation ceremony A-cam', status: 'reserved' },
  { id: 'rs-4', gear_id: 'g-fx6-b', project_id: 'p-cement', holder_id: 'u-enock', start_date: D(4), end_date: D(5), note: 'Safety film recce', status: 'reserved' },
  { id: 'rs-5', gear_id: 'g-mavic', project_id: 'p-cement', holder_id: 'u-benedicto', start_date: D(3), end_date: D(3), note: 'Aerials of Wazo Hill plant (TCAA permit filed)', status: 'reserved' },
  { id: 'rs-6', gear_id: 'g-600d', project_id: 'p-podcast', holder_id: 'u-jonathan', start_date: D(7), end_date: D(9), note: '', status: 'reserved' },
]);

registerSeed('gear_maintenance', () => [
  { id: 'mt-1', gear_id: 'g-rf50', date: D(-6), kind: 'Repair', description: 'Autofocus motor grinding after Graduation rehearsal — sent to Canon service partner, Nairobi.', vendor: 'Canon Service Centre Nairobi', cost: 850000, status: 'open', done_at: null, logged_by: 'u-store' },
  { id: 'mt-2', gear_id: 'g-f6', date: D(-3), kind: 'Repair', description: 'Crackle on input 3 — XLR socket being replaced.', vendor: 'Sauti Electronics, Kariakoo', cost: 180000, status: 'open', done_at: null, logged_by: 'u-store' },
  { id: 'mt-3', gear_id: 'g-fx6-a', date: D(-35), kind: 'Service', description: 'Sensor clean and firmware 4.0 update.', vendor: 'In-house', cost: 120000, status: 'done', done_at: D(-35), logged_by: 'u-store' },
  { id: 'mt-4', gear_id: 'g-mavic', date: D(-21), kind: 'Service', description: 'Replaced propellers ×8, IMU and compass calibration.', vendor: 'DJI Store Dar es Salaam', cost: 95000, status: 'done', done_at: D(-21), logged_by: 'u-store' },
  { id: 'mt-5', gear_id: 'g-600d', date: D(-60), kind: 'Clean', description: 'Fan clean, Bowens mount tightened.', vendor: 'In-house', cost: 0, status: 'done', done_at: D(-60), logged_by: 'u-store' },
  { id: 'mt-6', gear_id: 'g-flowtech', date: D(-90), kind: 'Service', description: 'Leg locks serviced, new rubber feet.', vendor: 'In-house', cost: 45000, status: 'done', done_at: D(-90), logged_by: 'u-store' },
]);

registerSeed('gear_incidents', () => [
  { id: 'in-1', gear_id: 'g-nova', checkout_id: null, kind: 'damage', description: 'Fell from stand in wind at Coco Beach shoot; front panel cracked, two LED zones dead.', photo_url: '', holder_id: 'u-jonathan', reported_by: 'u-store', estimated_cost: 2400000, decision: 'pending', decision_note: '', decided_by: null, status: 'open', created_at: H(-60) },
  { id: 'in-2', gear_id: 'g-rf50', checkout_id: null, kind: 'damage', description: 'AF motor fault noticed on return — no impact marks.', photo_url: '', holder_id: 'u-benedicto', reported_by: 'u-store', estimated_cost: 850000, decision: 'repair', decision_note: 'Wear and tear; company cost.', decided_by: 'u-gm', status: 'closed', created_at: H(-150) },
  { id: 'in-3', gear_id: 'g-ewd', checkout_id: 'co-7', kind: 'loss', description: 'One ME2 lavalier missing after Summit day 2 — venue lost & found contacted.', photo_url: '', holder_id: 'u-enock', reported_by: 'u-enock', estimated_cost: 420000, decision: 'pending', decision_note: '', decided_by: null, status: 'open', created_at: H(-20) },
]);

registerSeed('consumables', () => [
  { id: 'cs-aa', name: 'AA batteries (pack of 4)', category: 'Batteries', unit: 'pack', quantity: 6, min_level: 10, unit_cost: 9000, location: 'Charging station' },
  { id: 'cs-npf', name: 'Sony NP-FZ100 batteries', category: 'Batteries', unit: 'pc', quantity: 8, min_level: 6, unit_cost: 145000, location: 'Charging station' },
  { id: 'cs-sd', name: 'SD cards V90 128GB', category: 'Memory cards', unit: 'pc', quantity: 3, min_level: 6, unit_cost: 90000, location: 'Data shelf' },
  { id: 'cs-cfa', name: 'CFexpress Type A 160GB', category: 'Memory cards', unit: 'pc', quantity: 4, min_level: 4, unit_cost: 520000, location: 'Data shelf' },
  { id: 'cs-xlr', name: 'XLR cables 3m', category: 'Cables', unit: 'pc', quantity: 14, min_level: 8, unit_cost: 25000, location: 'Audio cabinet' },
  { id: 'cs-hdmi', name: 'HDMI cables 10m', category: 'Cables', unit: 'pc', quantity: 6, min_level: 4, unit_cost: 35000, location: 'Streaming case' },
  { id: 'cs-gaff', name: 'Gaffer tape 50mm', category: 'Tape', unit: 'roll', quantity: 2, min_level: 5, unit_cost: 38000, location: 'Grip room' },
  { id: 'cs-wipe', name: 'Lens wipes', category: 'Cleaning', unit: 'box', quantity: 9, min_level: 4, unit_cost: 22000, location: 'Cage A' },
  { id: 'cs-hdd', name: 'Archive HDD 8TB', category: 'Storage', unit: 'pc', quantity: 2, min_level: 3, unit_cost: 610000, location: 'Data shelf' },
  { id: 'cs-sand', name: 'Sandbags', category: 'Grip', unit: 'pc', quantity: 10, min_level: 6, unit_cost: 30000, location: 'Grip room' },
]);

registerSeed('stock_movements', () => [
  { id: 'sm-1', consumable_id: 'cs-sd', kind: 'issue', quantity: 3, person_id: 'u-jonathan', project_id: 'p-summit', note: 'Summit multicam', by_id: 'u-store', created_at: H(-50) },
  { id: 'sm-2', consumable_id: 'cs-gaff', kind: 'issue', quantity: 2, person_id: 'u-enock', project_id: 'p-summit', note: 'Cable runs JNICC', by_id: 'u-store', created_at: H(-74) },
  { id: 'sm-3', consumable_id: 'cs-aa', kind: 'issue', quantity: 4, person_id: 'u-benedicto', project_id: 'p-grad', note: 'Lav transmitters', by_id: 'u-store', created_at: H(-20) },
  { id: 'sm-4', consumable_id: 'cs-xlr', kind: 'receive', quantity: 6, person_id: null, project_id: null, note: 'Restock · Sauti Electronics', by_id: 'u-store', created_at: H(-200) },
]);

registerSeed('stock_takes', () => [
  { id: 'st-1', started_by: 'u-store', started_at: at(-31, 9), completed_at: at(-31, 11, 40), found_ids: GEAR.filter((g) => g[0] !== 'g-wgo').map((g) => g[0]), missing_ids: ['g-wgo'], status: 'completed', note: 'Wireless GO found next day in edit suite.' },
]);

registerSeed('gear_rentals', () => [
  { id: 'rn-1', agreement_no: 'BM-RNT-2026-014', renter_name: 'Baraka Mollel', renter_company: 'Kilimanjaro Films', renter_phone: '+255754118820', renter_id_number: 'NIDA 19880412-14105-00001-27', gear_ids: ['g-r5', 'g-rf2470'], start_date: D(-5), end_date: D(-1), pricing: 'day', rate: 300000, deposit: 2000000, late_fee_per_day: 150000, status: 'out', returned_at: null, inspection_note: '', damage_charge: 0, deposit_refunded: 0, created_by: 'u-store', created_at: H(-130) },
  { id: 'rn-2', agreement_no: 'BM-RNT-2026-015', renter_name: 'Salma Abdallah', renter_company: 'Zanzibar Weddings Co.', renter_phone: '+255777402211', renter_id_number: 'Passport TZ AB4419201', gear_ids: ['g-mini4', 'g-rs3m'], start_date: D(6), end_date: D(19), pricing: 'week', rate: 650000, deposit: 1500000, late_fee_per_day: 80000, status: 'booked', returned_at: null, inspection_note: '', damage_charge: 0, deposit_refunded: 0, created_by: 'u-store', created_at: H(-30) },
  { id: 'rn-3', agreement_no: 'BM-RNT-2026-012', renter_name: 'Peter Lyimo', renter_company: 'Mlimani Media', renter_phone: '+255713665011', renter_id_number: 'NIDA 19910807-11201-00004-12', gear_ids: ['g-600d', 'g-300x', 'g-amaran'], start_date: D(-26), end_date: D(-24), pricing: 'day', rate: 220000, deposit: 1000000, late_fee_per_day: 100000, status: 'closed', returned_at: at(-24, 16), inspection_note: 'All good. Diffusion slightly marked — cleaned.', damage_charge: 0, deposit_refunded: 1000000, created_by: 'u-store', created_at: at(-28, 10) },
  { id: 'rn-4', agreement_no: 'BM-RNT-2026-010', renter_name: 'Grace Mwita', renter_company: 'TBC Arusha bureau', renter_phone: '+255688991204', renter_id_number: 'Staff ID TBC-2231', gear_ids: ['g-fx6-a', 'g-2470'], start_date: D(-45), end_date: D(-39), pricing: 'week', rate: 2100000, deposit: 4000000, late_fee_per_day: 300000, status: 'closed', returned_at: at(-38, 12), inspection_note: 'Returned a day late. Clean.', damage_charge: 0, deposit_refunded: 3700000, created_by: 'u-store', created_at: at(-46, 9) },
]);

// ---------- reception ----------
registerSeed('visitors', () => [
  { id: 'vs-1', name: 'Lilian Massawe', company: 'Tanzania Health Summit', phone: '+255713998877', purpose: 'Day 3 run-of-show review', host_id: 'u-enock', expected_at: at(0, 9), signed_in_at: at(0, 9, 7), signed_out_at: null, status: 'in', badge_no: 'V-031', pass_code: 'BMV-7Q2K', created_by: 'u-rehema', created_at: at(-1, 15) },
  { id: 'vs-2', name: 'Prof. Joseph Mbwambo', company: 'University of Health Sciences', phone: '+255765440120', purpose: 'Graduation film rough-cut screening', host_id: 'u-benedicto', expected_at: at(0, 10, 30), signed_in_at: at(0, 10, 41), signed_out_at: null, status: 'in', badge_no: 'V-032', pass_code: 'BMV-3M8D', created_by: 'u-rehema', created_at: at(-2, 11) },
  { id: 'vs-3', name: 'Musa Rajabu', company: 'DHL Express', phone: '+255754300100', purpose: 'Delivery — signed for parcel', host_id: 'u-rehema', expected_at: null, signed_in_at: at(0, 8, 40), signed_out_at: at(0, 8, 52), status: 'out', badge_no: 'V-030', pass_code: '', created_by: 'u-rehema', created_at: at(0, 8, 40) },
  { id: 'vs-4', name: 'Faraja Mrema', company: 'Bank Foundation', phone: '+255754210300', purpose: 'Scholarship film — client review meeting', host_id: 'u-growth', expected_at: at(0, 14), signed_in_at: null, signed_out_at: null, status: 'expected', badge_no: '', pass_code: 'BMV-9X4T', created_by: 'u-growth', created_at: at(-1, 9) },
  { id: 'vs-5', name: 'Ramadhani Ally', company: 'Cement Co.', phone: '+255786331245', purpose: 'Safety film pre-production', host_id: 'u-benedicto', expected_at: at(0, 15, 30), signed_in_at: null, signed_out_at: null, status: 'expected', badge_no: '', pass_code: 'BMV-5H1R', created_by: 'u-rehema', created_at: at(-1, 16) },
  { id: 'vs-6', name: 'Neema Kileo', company: 'Freelance colourist', phone: '+255715228844', purpose: 'Interview — colourist role', host_id: 'u-gm', expected_at: at(1, 11), signed_in_at: null, signed_out_at: null, status: 'expected', badge_no: '', pass_code: 'BMV-2C6P', created_by: 'u-gm', created_at: at(0, 8) },
  { id: 'vs-7', name: 'Irene Kweka', company: 'Beverage Co.', phone: '+255658220031', purpose: 'Brand film enquiry', host_id: 'u-growth', expected_at: null, signed_in_at: at(-1, 11), signed_out_at: at(-1, 12, 15), status: 'out', badge_no: 'V-028', pass_code: '', created_by: 'u-rehema', created_at: at(-1, 11) },
  { id: 'vs-8', name: 'Hassan Said', company: 'TANESCO', phone: '+255222451130', purpose: 'Meter inspection', host_id: 'u-gm', expected_at: null, signed_in_at: at(-2, 10), signed_out_at: at(-2, 10, 25), status: 'out', badge_no: 'V-027', pass_code: '', created_by: 'u-rehema', created_at: at(-2, 10) },
]);

registerSeed('parcels', () => [
  { id: 'pc-1', received_at: at(0, 8, 45), courier: 'DHL Express', sender: 'B&H Photo, New York', recipient_id: 'u-store', description: '2× Aputure Light Dome replacement speed rings', tracking_no: 'DHL 4471 2290 18', status: 'waiting', collected_at: null, collected_by_name: '', logged_by: 'u-rehema' },
  { id: 'pc-2', received_at: at(0, 10, 5), courier: 'Hand delivery', sender: 'National Referral Hospital', recipient_id: 'u-jonathan', description: 'Signed consent forms (envelope)', tracking_no: '', status: 'waiting', collected_at: null, collected_by_name: '', logged_by: 'u-rehema' },
  { id: 'pc-3', received_at: at(-1, 15, 20), courier: 'EMS Posta', sender: 'TRA Dar es Salaam', recipient_id: 'u-fin', description: 'Tax correspondence', tracking_no: 'EE 6721 004 TZ', status: 'waiting', collected_at: null, collected_by_name: '', logged_by: 'u-rehema' },
  { id: 'pc-4', received_at: at(-1, 9, 30), courier: 'Fargo Courier', sender: 'Camera Centre Kariakoo', recipient_id: 'u-store', description: 'SD cards V90 ×6 (restock)', tracking_no: 'FG-88213', status: 'collected', collected_at: at(-1, 10), collected_by_name: 'Juma Said', logged_by: 'u-rehema' },
  { id: 'pc-5', received_at: at(-2, 12), courier: 'Hand delivery', sender: 'University of Health Sciences', recipient_id: 'u-benedicto', description: 'Graduation programme & name list', tracking_no: '', status: 'collected', collected_at: at(-2, 13, 10), collected_by_name: 'Benedicto Ngowi', logged_by: 'u-rehema' },
]);

registerSeed('room_bookings', () => [
  { id: 'rb-1', room: 'Boardroom', date: D(0), start_hour: 10, end_hour: 12, title: 'UHS rough-cut screening', booked_by: 'u-benedicto', status: 'booked' },
  { id: 'rb-2', room: 'Boardroom', date: D(0), start_hour: 14, end_hour: 15, title: 'Bank Foundation review', booked_by: 'u-growth', status: 'booked' },
  { id: 'rb-3', room: 'Podcast studio', date: D(0), start_hour: 9, end_hour: 11, title: 'Health Talk S2 — pilot record', booked_by: 'u-jonathan', status: 'booked' },
  { id: 'rb-4', room: 'Edit suite', date: D(0), start_hour: 8, end_hour: 13, title: 'Graduation edit', booked_by: 'u-benedicto', status: 'booked' },
  { id: 'rb-5', room: 'Edit suite', date: D(0), start_hour: 14, end_hour: 18, title: 'Hospital stories — ep. 11 grade', booked_by: 'u-jonathan', status: 'booked' },
  { id: 'rb-6', room: 'Boardroom', date: D(1), start_hour: 11, end_hour: 12, title: 'Colourist interview', booked_by: 'u-gm', status: 'booked' },
  { id: 'rb-7', room: 'Boardroom', date: D(0), start_hour: 16, end_hour: 17, title: 'Cement Co. pre-production', booked_by: 'u-benedicto', status: 'booked' },
]);

// ---------- transport ----------
registerSeed('vehicles', () => [
  { id: 'vh-1', registration: 'T 123 DFA', make_model: 'Toyota Land Cruiser Prado', seats: 7, status: 'on_trip', insurance_expiry: D(140), inspection_expiry: D(60), odometer: 84215, notes: 'Roof rack for light cases.' },
  { id: 'vh-2', registration: 'T 456 DGB', make_model: 'Toyota HiAce (crew van)', seats: 12, status: 'available', insurance_expiry: D(12), inspection_expiry: D(-3), odometer: 131870, notes: 'Inspection overdue — booked at Mikocheni garage.' },
]);

const log = (stages: string[], base: number) => stages.map((stage, i) => ({ stage, at: H(base + i * 1.5), by: 'u-driver' }));
registerSeed('trips', () => [
  { id: 'tr-1', vehicle_id: 'vh-1', driver_id: 'u-driver', project_id: 'p-summit', purpose: 'Crew + streaming kit to Summit day 3', origin: 'Basil Media, Mikocheni', destination: 'JNICC, Posta', depart_at: H(-1.5), return_at: H(9), passengers: 'Enock, Jonathan', cargo: 'ATEM case, 2× FX6 kits, lighting case', stage: 'Dispatched', stage_log: log(['Scheduled', 'Dispatched'], -20).map((l, i) => (i === 1 ? { ...l, at: H(-1.5) } : l)), issue_note: '', created_at: H(-20) },
  { id: 'tr-2', vehicle_id: 'vh-2', driver_id: 'u-driver', project_id: 'p-grad', purpose: 'Graduation crew & gear', origin: 'Basil Media, Mikocheni', destination: 'UHS main hall, Upanga', depart_at: at(1, 6, 30), return_at: at(1, 19), passengers: 'Benedicto + 3 crew', cargo: 'Event Photo Kit, Mavic, tripods', stage: 'Scheduled', stage_log: [{ stage: 'Scheduled', at: H(-5), by: 'u-gm' }], issue_note: '', created_at: H(-5) },
  { id: 'tr-3', vehicle_id: 'vh-1', driver_id: 'u-driver', project_id: 'p-summit', purpose: 'Summit day 2 — crew pick-up', origin: 'JNICC, Posta', destination: 'Basil Media, Mikocheni', depart_at: at(-1, 18), return_at: at(-1, 19, 30), passengers: 'Enock, Jonathan, Lilian (client)', cargo: 'Drives for ingest', stage: 'Returned', stage_log: log(['Scheduled', 'Dispatched', 'Arrived', 'Delivered', 'Returned'], -30), issue_note: '', created_at: H(-36) },
  { id: 'tr-4', vehicle_id: 'vh-2', driver_id: 'u-driver', project_id: 'p-grad', purpose: 'Recce — UHS hall and gardens', origin: 'Basil Media, Mikocheni', destination: 'UHS, Upanga', depart_at: at(-6, 9), return_at: at(-6, 13), passengers: 'Benedicto', cargo: '', stage: 'Returned', stage_log: log(['Scheduled', 'Dispatched', 'Arrived', 'Delivered', 'Returned'], -144), issue_note: '', created_at: H(-150) },
  { id: 'tr-5', vehicle_id: 'vh-1', driver_id: 'u-driver', project_id: 'p-cement', purpose: 'Plant recce, Wazo Hill', origin: 'Basil Media, Mikocheni', destination: 'Cement Co., Wazo Hill', depart_at: at(2, 8), return_at: at(2, 14), passengers: 'Benedicto, Enock', cargo: 'Mavic 3 Pro', stage: 'Scheduled', stage_log: [{ stage: 'Scheduled', at: H(-2), by: 'u-gm' }], issue_note: '', created_at: H(-2) },
]);

registerSeed('fuel_logs', () => [
  { id: 'fl-1', vehicle_id: 'vh-1', trip_id: 'tr-1', project_id: 'p-summit', driver_id: 'u-driver', date: D(0), litres: 45, cost: 145800, odometer: 84190, station: 'Puma, Mikocheni', receipt_url: '' },
  { id: 'fl-2', vehicle_id: 'vh-1', trip_id: 'tr-3', project_id: 'p-summit', driver_id: 'u-driver', date: D(-2), litres: 38, cost: 123100, odometer: 84020, station: 'Oryx, Ali Hassan Mwinyi Rd', receipt_url: '' },
  { id: 'fl-3', vehicle_id: 'vh-2', trip_id: 'tr-4', project_id: 'p-grad', driver_id: 'u-driver', date: D(-6), litres: 30, cost: 97200, odometer: 131700, station: 'Total, Morocco', receipt_url: '' },
  { id: 'fl-4', vehicle_id: 'vh-2', trip_id: null, project_id: null, driver_id: 'u-driver', date: D(-12), litres: 55, cost: 178200, odometer: 131540, station: 'Puma, Mikocheni', receipt_url: '' },
]);

registerSeed('vehicle_issues', () => [
  { id: 'vi-1', vehicle_id: 'vh-2', reported_by: 'u-driver', description: 'Rear left tyre wearing unevenly — needs alignment.', severity: 'medium', status: 'open', created_at: H(-48) },
]);
