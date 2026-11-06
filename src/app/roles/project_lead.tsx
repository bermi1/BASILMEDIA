import { Images } from 'lucide-react';
import { PublishGallery } from '@/os/PublishGallery';
import { Briefcase, Clapperboard, HardDrive, ListChecks, Wallet } from 'lucide-react';
import type { PhoneRoleApp } from '@/os/modules/types';
import { MyMoneyRequests } from '@/os/modules/finance/phone';
import { CrewAndShoots, FootageBackup, LeadProjects, LeadTasks } from '@/os/modules/projects/phone';

export const app: PhoneRoleApp = {
  title: 'Project Lead',
  accent: '#0284C7',
  tabs: [
    { key: 'projects', label: 'My projects', icon: Briefcase, element: <LeadProjects /> },
    { key: 'crew', label: 'Shoots', icon: Clapperboard, element: <CrewAndShoots /> },
    { key: 'requests', label: 'Requests', icon: Wallet, element: <MyMoneyRequests /> },
    { key: 'tasks', label: 'Tasks', icon: ListChecks, element: <LeadTasks /> },
  ],
  more: [
    { key: 'gallery', label: 'Publish gallery', icon: Images, sub: 'Pixieset link → website', element: <PublishGallery /> },
    { key: 'footage', label: 'Footage backup', icon: HardDrive, sub: '2 verified copies before formatting', element: <FootageBackup /> },
  ],
};
