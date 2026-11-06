import { Car, Navigation, Route } from 'lucide-react';
import type { PhoneRoleApp } from '@/os/modules/types';
import { CurrentTrip, TripsList, VehiclePanel } from '@/os/modules/store/transport';

export const app: PhoneRoleApp = {
  title: 'Driver',
  accent: '#475569',
  tabs: [
    { key: 'trips', label: 'Trips', icon: Route, element: <TripsList /> },
    { key: 'current', label: 'Current trip', icon: Navigation, element: <CurrentTrip /> },
    { key: 'vehicle', label: 'Vehicle', icon: Car, element: <VehiclePanel /> },
  ],
};
