import { Home } from 'lucide-react';
import { Empty } from '@/os/ui';
import type { PhoneRoleApp } from '@/os/modules/types';

// Placeholder — replaced when this role's phone app is built.
export const app: PhoneRoleApp = {
  title: 'client',
  accent: '#0F6EC2',
  tabs: [{ key: 'home', label: 'Home', icon: Home, element: <Empty title="Coming soon" /> }],
};
