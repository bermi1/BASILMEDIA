import { Home } from 'lucide-react';
import { Empty } from '@/os/ui';
import type { PhoneRoleApp } from '@/os/modules/types';

// Placeholder — replaced when this role's phone app is built.
export const app: PhoneRoleApp = {
  title: 'project_lead',
  accent: '#0F6EC2',
  tabs: [{ key: 'home', label: 'Home', icon: Home, element: <Empty title="Coming soon" /> }],
};
