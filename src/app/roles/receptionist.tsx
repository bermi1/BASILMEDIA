import { CalendarClock, ConciergeBell, Mail, UserPlus } from 'lucide-react';
import type { PhoneRoleApp } from '@/os/modules/types';
import { DeskBoard, ParcelsPanel, RoomsBoard, SignInForm } from '@/os/modules/store/reception';

export const app: PhoneRoleApp = {
  title: 'Reception',
  accent: '#0D9488',
  tabs: [
    { key: 'desk', label: 'Desk', icon: ConciergeBell, element: <DeskBoard /> },
    { key: 'signin', label: 'Sign in', icon: UserPlus, element: <SignInForm /> },
    { key: 'rooms', label: 'Rooms', icon: CalendarClock, element: <RoomsBoard /> },
    { key: 'parcels', label: 'Parcels', icon: Mail, element: <ParcelsPanel /> },
  ],
};
