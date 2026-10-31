import { useSearchParams } from 'react-router-dom';
import { BookOpen, CheckCircle2, FolderKanban, Gavel, Home, Kanban, ShieldAlert, Target } from 'lucide-react';
import { ApprovalsInbox } from '@/os/modules/finance/phone';
import { ProjectsGlance } from '@/os/modules/projects/phone';
import { DecisionLog, MondayBriefing, Scoreboard, TodayGlance } from '@/os/modules/growth/boss';
import { Pipeline } from '@/os/modules/growth/crm';
import { RetainersAtRisk } from '@/os/modules/growth/retainers';
import type { PhoneRoleApp } from '@/os/modules/types';

function BossHome() {
  const [, setParams] = useSearchParams();
  return <TodayGlance onApprovals={() => setParams((p) => (p.set('tab', 'approvals'), p), { replace: true })} />;
}

export const app: PhoneRoleApp = {
  title: 'Boss',
  accent: '#B8860B',
  tabs: [
    { key: 'home', label: 'Home', icon: Home, element: <BossHome /> },
    { key: 'approvals', label: 'Approvals', icon: CheckCircle2, element: <ApprovalsInbox /> },
    { key: 'projects', label: 'Projects', icon: FolderKanban, element: <ProjectsGlance /> },
    { key: 'briefing', label: 'Briefing', icon: BookOpen, element: <MondayBriefing /> },
  ],
  more: [
    { key: 'scoreboard', label: 'Scoreboard', icon: Target, element: <Scoreboard />, sub: 'Yearly targets and progress' },
    { key: 'decisions', label: 'Decision log', icon: Gavel, element: <DecisionLog />, sub: 'What we decided and why' },
    { key: 'pipeline', label: 'Pipeline', icon: Kanban, element: <Pipeline compact />, sub: 'Leads by stage' },
    { key: 'risk', label: 'Retainers at risk', icon: ShieldAlert, element: <RetainersAtRisk />, sub: 'Health and renewals' },
  ],
};
