import { Banknote, FileBadge2, FileSpreadsheet, FileText, HandCoins, LayoutDashboard, PiggyBank, Settings2, Stamp, Users, Wallet, ArrowLeftRight, ClipboardCheck } from 'lucide-react';
import { countRows } from '@/os/lib/store';
import type { OsModule } from '../types';
import { InvoicesList, MoneyInOut, PrintDoc, QuotationsList } from './docs';
import { ProformasList } from './proformas';
import { ApprovalsPage, BudgetsPage, FinanceOverview, FinanceSettingsPage, MyRequestsPage, PayPage, PayrollPage, ReconcilePage, RegisterPage } from './pages';
import { PageTitle } from '@/os/OsLayout';

const count = (statuses: string[]) => () => countRows('money_requests', { in: { status: statuses } });
const wrap = (title: string, el: JSX.Element) => <div className="mx-auto max-w-3xl"><PageTitle tag="MONEY" title={title} />{el}</div>;

export const financeModule: OsModule = {
  key: 'finance',
  section: 'MONEY',
  nav: [
    { to: '/os/approvals', label: 'Approvals', icon: Stamp, roles: ['boss', 'gm_cfo'], badge: count(['gm_review', 'boss_approval']) },
    { to: '/os/approvals/mine', label: 'My money requests', icon: HandCoins, roles: ['gm_cfo', 'finance', 'project_lead', 'staff'] },
    { to: '/os/finance', label: 'Finance overview', icon: LayoutDashboard, roles: ['boss', 'gm_cfo', 'finance'] },
    { to: '/os/finance/pay', label: 'Pay queue', icon: Banknote, roles: ['finance'], badge: count(['approved']) },
    { to: '/os/finance/requests', label: 'All requests', icon: Wallet, roles: ['boss', 'gm_cfo', 'finance'] },
    { to: '/os/finance/reconcile', label: 'Reconcile', icon: ClipboardCheck, roles: ['gm_cfo'], badge: count(['retired']) },
    { to: '/os/finance/invoices', label: 'Invoices', icon: FileText, roles: ['boss', 'finance'] },
    { to: '/os/finance/quotations', label: 'Quotations', icon: FileSpreadsheet, roles: ['finance', 'account_manager'] },
    { to: '/os/finance/proformas', label: 'Proformas', icon: FileBadge2, roles: ['finance', 'account_manager'] },
    { to: '/os/finance/money', label: 'Income & expenses', icon: ArrowLeftRight, roles: ['finance'] },
    { to: '/os/finance/budgets', label: 'Budgets', icon: PiggyBank, roles: ['boss', 'gm_cfo', 'finance'] },
    { to: '/os/finance/payroll', label: 'Payroll', icon: Users, roles: ['boss', 'gm_cfo', 'finance'] },
    { to: '/os/finance/settings', label: 'Finance settings', icon: Settings2, roles: ['finance'] },
  ],
  routes: [
    { path: 'approvals', element: <ApprovalsPage /> },
    { path: 'approvals/mine', element: <MyRequestsPage /> },
    { path: 'finance', element: <FinanceOverview /> },
    { path: 'finance/pay', element: <PayPage /> },
    { path: 'finance/requests', element: <RegisterPage /> },
    { path: 'finance/reconcile', element: <ReconcilePage /> },
    { path: 'finance/invoices', element: wrap('Invoices', <InvoicesList />) },
    { path: 'finance/quotations', element: wrap('Quotations', <QuotationsList />) },
    { path: 'finance/proformas', element: wrap('Proforma invoices', <ProformasList />) },
    { path: 'finance/money', element: wrap('Income & expenses', <MoneyInOut />) },
    { path: 'finance/budgets', element: <BudgetsPage /> },
    { path: 'finance/payroll', element: <PayrollPage /> },
    { path: 'finance/settings', element: <FinanceSettingsPage /> },
    { path: 'finance/print/:kind/:id', element: <PrintDoc /> },
  ],
};
