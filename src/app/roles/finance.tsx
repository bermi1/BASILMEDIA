import { ArrowLeftRight, BarChart3, Banknote, FileSpreadsheet, FileText, Users, Wallet } from 'lucide-react';
import type { PhoneRoleApp } from '@/os/modules/types';
import { CashGlance, PayQueue, RequestsRegister } from '@/os/modules/finance/phone';
import { InvoicesList, MoneyInOut, QuotationsList } from '@/os/modules/finance/docs';
import { FinanceOverview, PayrollPanel } from '@/os/modules/finance/pages';

export const app: PhoneRoleApp = {
  title: 'Finance',
  accent: '#059669',
  tabs: [
    { key: 'queue', label: 'Queue', icon: Banknote, element: <PayQueue /> },
    { key: 'invoices', label: 'Invoices', icon: FileText, element: <InvoicesList compact /> },
    { key: 'money', label: 'In / out', icon: ArrowLeftRight, element: <div className="flex flex-col gap-4"><CashGlance /><MoneyInOut /></div> },
    { key: 'requests', label: 'Requests', icon: Wallet, element: <RequestsRegister /> },
  ],
  more: [
    { key: 'payroll', label: 'Payroll', icon: Users, element: <PayrollPanel />, sub: 'Prepare, then pay once the Boss approves' },
    { key: 'quotations', label: 'Quotations', icon: FileSpreadsheet, element: <QuotationsList />, sub: 'Price list, VAT, convert to invoice' },
    { key: 'reports', label: 'Reports', icon: BarChart3, element: <FinanceOverview />, sub: 'Income vs expenses, receivables, margins' },
  ],
};
