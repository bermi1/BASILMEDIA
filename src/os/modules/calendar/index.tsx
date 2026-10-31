// Shared calendar module: one company calendar for every role (sidebar section "CALENDAR").
import { CalendarDays } from 'lucide-react';
import { ALL_ROLES } from '@/os/lib/session';
import type { OsModule } from '../types';
import { CalendarApp } from './CalendarApp';
import './seed';

export { CalendarApp, CalendarPhone } from './CalendarApp';
export type { CalendarAppProps, CalView } from './CalendarApp';

export const calendarModule: OsModule = {
  key: 'calendar',
  section: 'CALENDAR',
  nav: [{ to: '/os/calendar', label: 'Calendar', icon: CalendarDays, roles: ALL_ROLES }],
  routes: [{ path: 'calendar', element: <CalendarApp /> }],
};
