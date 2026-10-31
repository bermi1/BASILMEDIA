import { Clapperboard, Contact, FileText, Leaf, Lightbulb, ListChecks, Megaphone, Package, Sun, Wallet, Receipt } from 'lucide-react';
import type { PhoneRoleApp } from '@/os/modules/types';
import { MyMoneyRequests } from '@/os/modules/finance/phone';
import { MyGear } from '@/os/modules/store/phone';
import { AnnouncementsPanel, Directory, LeavePanel, MyShoots, MyTasks, StaffMyDay, SuggestionBox, WeeklyReportForm } from '@/os/modules/projects/phone';
import { MyPayslips } from '@/os/modules/finance/phone';

export const app: PhoneRoleApp = {
  title: 'Staff',
  accent: '#7C3AED',
  tabs: [
    { key: 'day', label: 'My Day', icon: Sun, element: <StaffMyDay /> },
    { key: 'tasks', label: 'Tasks', icon: ListChecks, element: <MyTasks /> },
    { key: 'requests', label: 'Requests', icon: Wallet, element: <MyMoneyRequests /> },
    { key: 'shoots', label: 'Shoots', icon: Clapperboard, element: <MyShoots /> },
  ],
  more: [
    { key: 'report', label: 'Weekly report', icon: FileText, sub: 'Due Saturday 18:00', element: <WeeklyReportForm /> },
    { key: 'ideas', label: 'Suggestion box', icon: Lightbulb, sub: 'Anonymous if you like', element: <SuggestionBox /> },
    { key: 'leave', label: 'Leave', icon: Leaf, sub: 'Balance and requests', element: <LeavePanel /> },
    { key: 'payslips', label: 'Payslips', icon: Receipt, element: <MyPayslips /> },
    { key: 'news', label: 'Announcements', icon: Megaphone, element: <AnnouncementsPanel /> },
    { key: 'directory', label: 'Directory', icon: Contact, sub: 'Phones and birthdays', element: <Directory /> },
    { key: 'gear', label: 'My gear', icon: Package, element: <MyGear /> },
  ],
};
