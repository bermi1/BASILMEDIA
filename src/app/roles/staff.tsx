import { FileText, Leaf, ListChecks, Sun, Wallet, Receipt } from 'lucide-react';
import type { PhoneRoleApp } from '@/os/modules/types';
import { MyMoneyRequests } from '@/os/modules/finance/phone';
import { MyGear } from '@/os/modules/store/phone';
import { LeavePanel, MyTasks, StaffMyDay, WeeklyReportForm } from '@/os/modules/projects/phone';
import { MyPayslips } from '@/os/modules/finance/phone';

export const app: PhoneRoleApp = {
  title: 'Staff',
  accent: '#7C3AED',
  tabs: [
    { key: 'day', label: 'My Day', icon: Sun, element: <div className="flex flex-col gap-5"><StaffMyDay /><MyGear /></div> },
    { key: 'tasks', label: 'Tasks', icon: ListChecks, element: <MyTasks /> },
    { key: 'requests', label: 'Requests', icon: Wallet, element: <MyMoneyRequests /> },
    { key: 'leave', label: 'Leave', icon: Leaf, element: <LeavePanel /> },
  ],
  more: [
    { key: 'report', label: 'Weekly report', icon: FileText, sub: 'Due Saturday 18:00', element: <WeeklyReportForm /> },
    { key: 'payslips', label: 'Payslips', icon: Receipt, element: <MyPayslips /> },
  ],
};
