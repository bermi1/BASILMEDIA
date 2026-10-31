import { Car, History, Navigation, Route } from 'lucide-react';
import type { PhoneRoleApp } from '@/os/modules/types';
import { CurrentTrip, TripHistory, TripsList, VehiclePanel } from '@/os/modules/store/transport';
import '@/os/modules/store/seed';

export const app: PhoneRoleApp = {
  title: 'Driver',
  accent: '#475569',
  tabs: [
    { key: 'trips', label: 'Trips', icon: Route, element: <TripsList /> },
    { key: 'current', label: 'Current trip', icon: Navigation, element: <CurrentTrip /> },
    { key: 'vehicle', label: 'Vehicle', icon: Car, element: <VehiclePanel /> },
    { key: 'history', label: 'History', icon: History, element: <TripHistory /> },
  ],
};
