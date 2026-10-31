import { Boxes, PackageCheck, Undo2, Warehouse, Wrench } from 'lucide-react';
import type { PhoneRoleApp } from '@/os/modules/types';
import { InventoryPhone, StorePhoneHome } from '@/os/modules/store/phone';
import { CheckoutFlow, ReturnsPanel } from '@/os/modules/store/checkout';
import { IncidentsPanel, MaintenancePanel } from '@/os/modules/store/ops';

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
    { key: 'maintenance', label: 'Repairs & incidents', icon: Wrench, element: <div className="flex flex-col gap-5"><MaintenancePanel /><IncidentsPanel /></div>, sub: 'Service, damage and loss' },
  ],
};
