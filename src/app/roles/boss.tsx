import { useSearchParams } from 'react-router-dom';
import { BookOpen, CheckCircle2, FolderKanban, Home, Kanban } from 'lucide-react';
import { ApprovalsInbox } from '@/os/modules/finance/phone';
import { ProjectsGlance } from '@/os/modules/projects/phone';
import { MondayBriefing, ProposalApprovals, TodayGlance } from '@/os/modules/growth/boss';
import { Pipeline } from '@/os/modules/growth/crm';
import { PhoneStack } from '@/os/modules/growth/phone';
import type { PhoneRoleApp } from '@/os/modules/types';

function BossHome() {
  const [, setParams] = useSearchParams();
  const tab = (t: string) => () => setParams((p) => (p.set('tab', t), p), { replace: true });
  return <PhoneStack><TodayGlance onApprovals={tab('approvals')} onProjects={tab('projects')} /></PhoneStack>;
}

/** Money and payroll (finance) plus proposal discounts (growth), all decided from one tab. */
const BossApprovals = () => <PhoneStack><ApprovalsInbox /><ProposalApprovals /></PhoneStack>;

export const app: PhoneRoleApp = {
  title: 'Boss',
  accent: '#B8860B',
  tabs: [
    { key: 'home', label: 'Home', icon: Home, element: <BossHome /> },
    { key: 'approvals', label: 'Approvals', icon: CheckCircle2, element: <BossApprovals /> },
    { key: 'projects', label: 'Projects', icon: FolderKanban, element: <ProjectsGlance /> },
    { key: 'briefing', label: 'Briefing', icon: BookOpen, element: <MondayBriefing /> },
  ],
  more: [
    { key: 'pipeline', label: 'Pipeline', icon: Kanban, element: <PhoneStack><Pipeline compact /></PhoneStack>, sub: 'Leads by stage' },
  ],
};
