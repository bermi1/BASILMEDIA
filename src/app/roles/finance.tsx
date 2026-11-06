import { ArrowLeftRight, Banknote, FileText, Users } from 'lucide-react';
import type { PhoneRoleApp } from '@/os/modules/types';
import { CashGlance, PayQueue } from '@/os/modules/finance/phone';
import { MoneyInOut } from '@/os/modules/finance/docs';
import { MoneyDocs } from '@/os/modules/finance/moneydocs';
import { PayrollPanel } from '@/os/modules/finance/pages';

export const app: PhoneRoleApp = {
  title: 'Finance',
  accent: '#059669',
  tabs: [
    { key: 'queue', label: 'Queue', icon: Banknote, element: <PayQueue /> },
    // Invoices, proformas and quotations in one screen (segmented control).
    { key: 'invoices', label: 'Invoices', icon: FileText, element: <MoneyDocs /> },
    { key: 'money', label: 'In / out', icon: ArrowLeftRight, element: <div className="flex flex-col gap-4"><CashGlance /><MoneyInOut /></div> },
    { key: 'payroll', label: 'Payroll', icon: Users, element: <PayrollPanel /> },
  ],
};
