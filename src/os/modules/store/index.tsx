// Media store & office operations module: gear, check-out/in, kits, reservations, maintenance,
// consumables, stock-take, rentals, ROI; reception; transport. Sidebar section "OPERATIONS".
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Boxes, CalendarRange, Camera, ClipboardList, ConciergeBell, Droplets, HandCoins, PackageCheck, Plus, QrCode, TrendingUp, Truck, Warehouse, Wrench } from 'lucide-react';
import { demoTable } from '@/os/lib/store';
import { isDemo } from '@/lib/supabase';
import { PageTitle } from '@/os/OsLayout';
import { Card, Stat, Tabs, tshShort } from '@/os/ui';
import type { OsModule } from '../types';
import { isOverdue, isDueToday, bookValue, type Checkout, type Consumable, type Gear } from './data';
import { Guard, RECEPTION_ROLES, STORE_ROLES, TRANSPORT_ROLES, useCheckouts, useGear } from './shared';
import { AssetDetail, GearRegister, LabelsPage, RoiPage } from './gear';
import { CheckoutFlow, KitsPanel, ReturnsPanel, WhoHasIt } from './checkout';
import { ConsumablesPanel, IncidentsPanel, MaintenancePanel, ReservationsPanel, StockTakePanel } from './ops';
import { RentalAgreement, RentalsPanel } from './rentals';
import { DeskBoard, ParcelsPanel, RoomsBoard, SignInForm, VisitorLog, WalkInEnquiry } from './reception';
import { CurrentTrip, TripHistory, TripsList, VehiclePanel } from './transport';
import { useTable } from '@/os/lib/store';

function StoreHome() {
  const { rows: gear } = useGear();
  const { rows: checkouts } = useCheckouts();
  const { rows: cons } = useTable<Consumable>('consumables');
  const open = checkouts.filter((c) => c.status === 'out');
  const n = (s: Gear['status']) => gear.filter((g) => g.status === s).length;
  return (
    <Guard roles={STORE_ROLES}>
      <PageTitle tag="OPERATIONS · MEDIA STORE" title="Media store" sub="Every lens, light and drive — who has it, where it goes next, and what it earns.">
        <div className="flex flex-wrap gap-2">
          <Link to="/os/store/returns" className="btn-outline">Check in</Link>
          <Link to="/os/store/checkout" className="btn-primary"><PackageCheck size={16} />Check out</Link>
        </div>
      </PageTitle>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="In store" value={n('available')} tone="green" />
        <Stat label="Out now" value={n('out')} />
        <Stat label="Overdue" value={open.filter(isOverdue).length} tone="red" />
        <Stat label="Due today" value={open.filter(isDueToday).length} tone="amber" />
        <Stat label="In repair / out of service" value={n('in_repair') + n('out_of_service')} tone="amber" />
        <Stat label="Low stock" value={cons.filter((c) => c.quantity <= c.min_level).length} tone="red" sub={`book value ${tshShort(gear.reduce((s, g) => s + bookValue(g), 0))}`} />
      </div>
      <Card title="Who has it now" action={<Link to="/os/store/returns" className="text-sm font-bold">Returns</Link>}><WhoHasIt /></Card>
    </Guard>
  );
}

const page = (tag: string, title: string, sub: string, el: JSX.Element, roles = STORE_ROLES, action?: JSX.Element) => (
  <Guard roles={roles}>
    <PageTitle tag={tag} title={title} sub={sub}>{action}</PageTitle>
    <div className="max-w-5xl">{el}</div>
  </Guard>
);

function CheckoutPage() {
  const [p] = useSearchParams();
  return page('MEDIA STORE', 'Check out', 'Single items or a whole kit, with condition photo and borrower acknowledgement.', <div className="max-w-xl"><CheckoutFlow initialGear={p.get('gear') ?? undefined} /></div>);
}
function MaintenancePage() {
  const [tab, setTab] = useState<'maintenance' | 'incidents'>('maintenance');
  return page('MEDIA STORE', 'Maintenance & incidents', 'Service and repair log with costs; damage and loss reports with a follow-up decision.', <><div className="mb-4"><Tabs value={tab} onChange={setTab} items={[{ value: 'maintenance', label: 'Maintenance' }, { value: 'incidents', label: 'Damage & loss' }]} /></div>{tab === 'maintenance' ? <MaintenancePanel /> : <IncidentsPanel />}</>);
}
function ReceptionPage() {
  const [tab, setTab] = useState<'desk' | 'signin' | 'rooms' | 'parcels' | 'enquiry' | 'log'>('desk');
  return page('OPERATIONS · FRONT DESK', 'Reception', 'Visitors, parcels, meeting rooms and walk-in enquiries.', (
    <>
      <div className="mb-4"><Tabs value={tab} onChange={setTab} items={[{ value: 'desk', label: 'Desk' }, { value: 'signin', label: 'Sign in' }, { value: 'rooms', label: 'Rooms' }, { value: 'parcels', label: 'Parcels' }, { value: 'enquiry', label: 'Walk-in enquiry' }, { value: 'log', label: 'Visitor log' }]} /></div>
      {tab === 'desk' ? <DeskBoard /> : tab === 'signin' ? <div className="max-w-lg"><SignInForm /></div> : tab === 'rooms' ? <RoomsBoard /> : tab === 'parcels' ? <ParcelsPanel /> : tab === 'enquiry' ? <div className="max-w-lg"><WalkInEnquiry /></div> : <VisitorLog />}
    </>
  ), RECEPTION_ROLES);
}
function TransportPage() {
  const [tab, setTab] = useState<'trips' | 'current' | 'vehicles' | 'history'>('trips');
  return page('OPERATIONS · LOGISTICS', 'Transport', 'Vehicles, crew and gear trips, fuel cost per project.', (
    <>
      <div className="mb-4"><Tabs value={tab} onChange={setTab} items={[{ value: 'trips', label: 'Trips' }, { value: 'current', label: 'Current trip' }, { value: 'vehicles', label: 'Vehicles & fuel' }, { value: 'history', label: 'History' }]} /></div>
      {tab === 'trips' ? <TripsList /> : tab === 'current' ? <div className="max-w-lg"><CurrentTrip /></div> : tab === 'vehicles' ? <VehiclePanel /> : <TripHistory />}
    </>
  ), TRANSPORT_ROLES);
}

const overdueBadge = () => {
  if (!isDemo) return 0;
  try {
    return (demoTable('gear_checkouts') as unknown as Checkout[]).filter(isOverdue).length;
  } catch {
    return 0;
  }
};

export const storeModule: OsModule = {
  key: 'store',
  section: 'OPERATIONS',
  nav: [
    { to: '/os/store', label: 'Media store', icon: Warehouse, roles: STORE_ROLES, badge: overdueBadge },
    { to: '/os/store/gear', label: 'Gear register', icon: Camera, roles: ['storekeeper'] },
    { to: '/os/store/checkout', label: 'Check out', icon: PackageCheck, roles: ['storekeeper'] },
    { to: '/os/store/returns', label: 'Returns', icon: ClipboardList, roles: ['storekeeper'] },
    { to: '/os/store/kits', label: 'Kits', icon: Boxes, roles: ['storekeeper'] },
    { to: '/os/store/reservations', label: 'Reservations', icon: CalendarRange, roles: ['storekeeper'] },
    { to: '/os/store/maintenance', label: 'Maintenance', icon: Wrench, roles: ['storekeeper'] },
    { to: '/os/store/consumables', label: 'Consumables', icon: Droplets, roles: ['storekeeper'] },
    { to: '/os/store/stocktake', label: 'Stock-take', icon: QrCode, roles: ['storekeeper'] },
    { to: '/os/store/rentals', label: 'Outside rentals', icon: HandCoins, roles: ['storekeeper'] },
    { to: '/os/store/roi', label: 'Gear ROI', icon: TrendingUp, roles: STORE_ROLES },
    { to: '/os/reception', label: 'Reception', icon: ConciergeBell, roles: ['receptionist'] },
    { to: '/os/transport', label: 'Transport', icon: Truck, roles: ['driver', 'gm_cfo'] },
  ],
  routes: [
    { path: 'store', element: <StoreHome /> },
    { path: 'store/gear', element: <GearRegister /> },
    { path: 'store/asset/:id', element: <AssetDetail /> },
    { path: 'store/asset/:id/label', element: <LabelsPage /> },
    { path: 'store/labels', element: <LabelsPage /> },
    { path: 'store/checkout', element: <CheckoutPage /> },
    { path: 'store/returns', element: page('MEDIA STORE', 'Returns', 'Check items back in, approve extra time, chase overdue gear.', <ReturnsPanel />) },
    { path: 'store/kits', element: page('MEDIA STORE', 'Kits', 'Kit templates and packing checklists ticked out and in.', <KitsPanel />, STORE_ROLES, <Link to="/os/store/checkout" className="btn-primary"><Plus size={16} />Check out a kit</Link>) },
    { path: 'store/reservations', element: page('MEDIA STORE', 'Reservations', 'Two-week calendar with clash detection.', <ReservationsPanel />) },
    { path: 'store/maintenance', element: <MaintenancePage /> },
    { path: 'store/consumables', element: page('MEDIA STORE', 'Consumables', 'Batteries, cards, cables and tape — minimum levels, issue and receive.', <ConsumablesPanel />) },
    { path: 'store/stocktake', element: page('MEDIA STORE', 'Stock-take', 'Tick every item you find; the rest is listed as missing.', <div className="max-w-2xl"><StockTakePanel /></div>) },
    { path: 'store/rentals', element: page('MEDIA STORE', 'Outside rentals', 'Renters, deposits, day/week pricing, late fees and return inspection.', <RentalsPanel />) },
    { path: 'store/rentals/:id/agreement', element: <RentalAgreement /> },
    { path: 'store/roi', element: <RoiPage /> },
    { path: 'reception', element: <ReceptionPage /> },
    { path: 'transport', element: <TransportPage /> },
  ],
};
