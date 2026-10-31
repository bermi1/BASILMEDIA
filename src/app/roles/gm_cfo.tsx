import { Briefcase, ClipboardCheck, Home, Stamp, Users, Wallet } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { PhoneRoleApp } from '@/os/modules/types';
import { ApprovalsInbox, GmCockpit, ReconcileList } from '@/os/modules/finance/phone';
import { MoneyDocs } from '@/os/modules/finance/moneydocs';
import { PayrollPanel } from '@/os/modules/finance/pages';
import { ProjectsGlance } from '@/os/modules/projects/phone';

function Cockpit() {
  const [, set] = useSearchParams();
  return <GmCockpit onGo={(t) => set((p) => (p.set('tab', t), p), { replace: true })} />;
}

// The GM/CFO owns every money document (owner's rule): quotations, proformas and invoices,
// including converting between them and recording client payments, all from the Money tab.
export const app: PhoneRoleApp = {
  title: 'GM/CFO',
  accent: '#0F6EC2',
  tabs: [
    { key: 'home', label: 'Home', icon: Home, element: <Cockpit /> },
    { key: 'review', label: 'Review', icon: Stamp, element: <ApprovalsInbox /> },
    { key: 'money', label: 'Money', icon: Wallet, element: <MoneyDocs /> },
    { key: 'projects', label: 'Projects', icon: Briefcase, element: <ProjectsGlance /> },
  ],
  more: [
    { key: 'payroll', label: 'Payroll run', icon: Users, element: <PayrollPanel />, sub: 'Review before the Boss approves' },
    { key: 'reconcile', label: 'Reconcile', icon: ClipboardCheck, element: <ReconcileList />, sub: 'Retired receipts to check' },
  ],
};
