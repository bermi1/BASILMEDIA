import { CalendarClock, ConciergeBell, History, Mail, MessageSquarePlus, UserPlus } from 'lucide-react';
import type { PhoneRoleApp } from '@/os/modules/types';
import { DeskBoard, ParcelsPanel, RoomsBoard, SignInForm, VisitorLog, WalkInEnquiry } from '@/os/modules/store/reception';
import '@/os/modules/store/seed';

export const app: PhoneRoleApp = {
  title: 'Reception',
  accent: '#0D9488',
  tabs: [
    { key: 'desk', label: 'Desk', icon: ConciergeBell, element: <DeskBoard /> },
    { key: 'signin', label: 'Sign in', icon: UserPlus, element: <SignInForm /> },
    { key: 'rooms', label: 'Rooms', icon: CalendarClock, element: <RoomsBoard /> },
    { key: 'parcels', label: 'Parcels', icon: Mail, element: <ParcelsPanel /> },
  ],
  more: [
    { key: 'enquiry', label: 'Walk-in enquiry', icon: MessageSquarePlus, element: <WalkInEnquiry />, sub: 'Send to the bookings inbox' },
    { key: 'log', label: 'Visitor log', icon: History, element: <VisitorLog />, sub: 'Everyone who has visited' },
  ],
};
