import { useSearchParams } from 'react-router-dom';
import { BookOpen, CheckCircle2, FolderKanban, Gavel, Home, Kanban, ShieldAlert, Target } from 'lucide-react';
import { ApprovalsInbox } from '@/os/modules/finance/phone';
import { ProjectsGlance } from '@/os/modules/projects/phone';
import { DecisionLog, MondayBriefing, ProposalApprovals, Scoreboard, TodayGlance } from '@/os/modules/growth/boss';
import { Pipeline } from '@/os/modules/growth/crm';
import { RetainersAtRisk } from '@/os/modules/growth/retainers';
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
    { key: 'scoreboard', label: 'Scoreboard', icon: Target, element: <Scoreboard />, sub: 'Yearly targets and progress' },
    { key: 'decisions', label: 'Decision log', icon: Gavel, element: <DecisionLog />, sub: 'What we decided and why' },
    { key: 'pipeline', label: 'Pipeline', icon: Kanban, element: <PhoneStack><Pipeline compact /></PhoneStack>, sub: 'Leads by stage' },
    { key: 'risk', label: 'Retainers at risk', icon: ShieldAlert, element: <PhoneStack><RetainersAtRisk /></PhoneStack>, sub: 'Health and renewals' },
  ],
};
