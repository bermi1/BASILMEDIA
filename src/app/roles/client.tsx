import { useSearchParams } from 'react-router-dom';
import { CalendarDays, Home, Images, LifeBuoy, Receipt, Send, Users } from 'lucide-react';
import { ClientBilling, ClientCalendar, ClientHome, ClientRequests, ClientWork, RaiseConcern, TeamContacts } from '@/os/modules/growth/client';
import type { PhoneRoleApp } from '@/os/modules/types';

function HomeTab() {
  const [, setParams] = useSearchParams();
  return <ClientHome onGo={(t) => setParams((p) => (p.set('tab', t), p), { replace: true })} />;
}

export const app: PhoneRoleApp = {
  title: 'Client portal',
  accent: '#0F766E',
  tabs: [
    { key: 'home', label: 'Home', icon: Home, element: <HomeTab /> },
    { key: 'calendar', label: 'Calendar', icon: CalendarDays, element: <ClientCalendar /> },
    { key: 'requests', label: 'Requests', icon: Send, element: <ClientRequests /> },
    { key: 'work', label: 'Work', icon: Images, element: <ClientWork /> },
  ],
  more: [
    { key: 'billing', label: 'Billing', icon: Receipt, element: <ClientBilling />, sub: 'Invoices and your retainer' },
    { key: 'concern', label: 'Raise a concern', icon: LifeBuoy, element: <RaiseConcern />, sub: 'Tell us if something is not right' },
    { key: 'team', label: 'Team contacts', icon: Users, element: <TeamContacts />, sub: 'Your account manager and crew' },
  ],
};
