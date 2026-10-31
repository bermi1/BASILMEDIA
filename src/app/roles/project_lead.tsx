import { Briefcase, Clapperboard, Film, HardDrive, ListChecks, ScrollText, Wallet } from 'lucide-react';
import type { PhoneRoleApp } from '@/os/modules/types';
import { MyMoneyRequests } from '@/os/modules/finance/phone';
import { CallSheets, CrewAndShoots, FootageBackup, LeadProjects, LeadTasks, PostProduction } from '@/os/modules/projects/phone';

export const app: PhoneRoleApp = {
  title: 'Project Lead',
  accent: '#0284C7',
  tabs: [
    { key: 'projects', label: 'My projects', icon: Briefcase, element: <LeadProjects /> },
    { key: 'crew', label: 'Crew & shoots', icon: Clapperboard, element: <CrewAndShoots /> },
    { key: 'requests', label: 'Requests', icon: Wallet, element: <MyMoneyRequests /> },
    { key: 'tasks', label: 'Tasks', icon: ListChecks, element: <LeadTasks /> },
  ],
  more: [
    { key: 'callsheets', label: 'Call sheets', icon: ScrollText, sub: 'Share on WhatsApp or print', element: <CallSheets /> },
    { key: 'footage', label: 'Footage backup', icon: HardDrive, sub: '2 verified copies before formatting', element: <FootageBackup /> },
    { key: 'post', label: 'Post-production', icon: Film, sub: 'Edit stages and revisions', element: <PostProduction /> },
  ],
};
