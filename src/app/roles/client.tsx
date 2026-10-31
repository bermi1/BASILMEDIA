import { useSearchParams } from 'react-router-dom';
import { CalendarDays, Home, LifeBuoy, Receipt, Send } from 'lucide-react';
import { ClientBilling, ClientCalendar, ClientHome, ClientRequests, RaiseConcern } from '@/os/modules/growth/client';
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
    { key: 'calendar', label: 'Schedule', icon: CalendarDays, element: <ClientCalendar /> },
    { key: 'requests', label: 'Requests', icon: Send, element: <ClientRequests /> },
    { key: 'billing', label: 'Billing', icon: Receipt, element: <ClientBilling /> },
  ],
  more: [
    { key: 'concern', label: 'Raise a concern', icon: LifeBuoy, element: <RaiseConcern />, sub: 'Tell us if something is not right' },
  ],
};
