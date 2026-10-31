import { Boxes, CalendarRange, ClipboardList, HandCoins, PackageCheck, ShieldAlert, Undo2, Warehouse, Wrench } from 'lucide-react';
import type { PhoneRoleApp } from '@/os/modules/types';
import { InventoryPhone, StorePhoneHome } from '@/os/modules/store/phone';
import { CheckoutFlow, KitsPanel, ReturnsPanel } from '@/os/modules/store/checkout';
import { IncidentsPanel, MaintenancePanel, ReservationsPanel, StockTakePanel } from '@/os/modules/store/ops';
import { RentalsPanel } from '@/os/modules/store/rentals';

export const app: PhoneRoleApp = {
  title: 'Store',
  accent: '#D97706',
  tabs: [
    { key: 'store', label: 'Store', icon: Warehouse, element: <StorePhoneHome /> },
    { key: 'checkout', label: 'Check out', icon: PackageCheck, element: <CheckoutFlow /> },
    { key: 'returns', label: 'Returns', icon: Undo2, element: <ReturnsPanel /> },
    { key: 'inventory', label: 'Inventory', icon: Boxes, element: <InventoryPhone /> },
  ],
  more: [
    { key: 'maintenance', label: 'Maintenance', icon: Wrench, element: <MaintenancePanel />, sub: 'Service & repair log' },
    { key: 'incidents', label: 'Incidents', icon: ShieldAlert, element: <IncidentsPanel />, sub: 'Damage & loss reports' },
    { key: 'rentals', label: 'Rentals', icon: HandCoins, element: <RentalsPanel />, sub: 'Outside renters, deposits, returns' },
    { key: 'stocktake', label: 'Stock-take', icon: ClipboardList, element: <StockTakePanel />, sub: 'Tick everything on the shelf' },
    { key: 'reservations', label: 'Reservations', icon: CalendarRange, element: <ReservationsPanel />, sub: 'Calendar & clashes' },
    { key: 'kits', label: 'Kits', icon: Boxes, element: <KitsPanel />, sub: 'Packing lists in motion' },
  ],
};
