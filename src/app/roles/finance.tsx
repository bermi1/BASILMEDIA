import { ArrowLeftRight, BarChart3, Banknote, FileText, Users, Wallet } from 'lucide-react';
import type { PhoneRoleApp } from '@/os/modules/types';
import { CashGlance, PayQueue, RequestsRegister } from '@/os/modules/finance/phone';
import { MoneyInOut } from '@/os/modules/finance/docs';
import { MoneyDocs } from '@/os/modules/finance/moneydocs';
import { FinanceOverview, PayrollPanel } from '@/os/modules/finance/pages';

export const app: PhoneRoleApp = {
  title: 'Finance',
  accent: '#059669',
  tabs: [
    { key: 'queue', label: 'Queue', icon: Banknote, element: <PayQueue /> },
    // Invoices, proformas and quotations in one screen (segmented control).
    { key: 'invoices', label: 'Invoices', icon: FileText, element: <MoneyDocs /> },
    { key: 'money', label: 'In / out', icon: ArrowLeftRight, element: <div className="flex flex-col gap-4"><CashGlance /><MoneyInOut /></div> },
    { key: 'requests', label: 'Requests', icon: Wallet, element: <RequestsRegister /> },
  ],
  more: [
    { key: 'payroll', label: 'Payroll', icon: Users, element: <PayrollPanel />, sub: 'Prepare, then pay once the Boss approves' },
    { key: 'reports', label: 'Reports', icon: BarChart3, element: <FinanceOverview />, sub: 'Income vs expenses, receivables, margins' },
  ],
};
