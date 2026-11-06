// Security page for everyone at /os/security (sidebar section "ACCOUNT").
import { lazy, Suspense } from 'react';
import { ShieldCheck } from 'lucide-react';
import { ALL_ROLES } from '@/os/lib/session';
import type { OsModule } from '@/os/modules/types';

const SecurityPage = lazy(() => import('./SecurityPage'));

export const securityModule: OsModule = {
  key: 'security',
  section: 'ACCOUNT',
  nav: [{ to: '/os/security', label: 'Security', icon: ShieldCheck, roles: ALL_ROLES }],
  routes: [{ path: 'security', element: <Suspense fallback={null}><SecurityPage /></Suspense> }],
};
