// Leadership & growth module: Boss cockpit, CRM/pipeline, Share Studio and the retainer client programme.
import { BarChart3, BookOpen, Building2, CalendarDays, Crown, FileSignature, FileText, Gavel, Handshake, Inbox, Kanban, LifeBuoy, ListChecks, Repeat, Sparkles, Target } from 'lucide-react';
import { isDemo } from '@/lib/supabase';
import { demoTable } from '@/os/lib/store';
import { PageTitle } from '@/os/OsLayout';
import type { AppRole } from '@/lib/types';
import type { OsModule } from '../types';
import './seed';
import { BossCockpit, DecisionLog, MondayBriefing, Scoreboard } from './boss';
import { Organisations, PipelinePage } from './crm';
import { ContractsPage, EventsPage, ProposalDoc, ProposalsPage, TendersPage } from './docs';
import { DealRoomAdmin, DealsPage, ReferenceLibrary, ShowcaseBuilder, ShowcasesPage } from './share';
import { ConcernsBoard, RequestBoardPage, RetainerDetail, RetainersPage } from './retainers';
import { GrowthInbox } from './phone';

const BOSS: AppRole[] = ['boss', 'gm_cfo'];
const GROWTH: AppRole[] = ['growth', 'account_manager', 'gm_cfo', 'boss'];
const count = (table: string, f: (r: Record<string, unknown>) => boolean) => () => (isDemo ? demoTable(table).filter(f).length : 0);
const InboxPage = () => (<div><PageTitle tag="GROWTH · INBOX" title="Inbox" sub="Website bookings to convert into leads, and retainer client requests." /><GrowthInbox /></div>);

export const growthModule: OsModule = {
  key: 'growth',
  section: 'LEADERSHIP & GROWTH',
  nav: [
    { to: '/os/boss', label: 'Boss cockpit', icon: Crown, roles: BOSS },
    { to: '/os/boss/briefing', label: 'Monday briefing', icon: BookOpen, roles: BOSS },
    { to: '/os/boss/scoreboard', label: 'Scoreboard', icon: Target, roles: BOSS },
    { to: '/os/boss/decisions', label: 'Decision log', icon: Gavel, roles: BOSS },
    { to: '/os/growth', label: 'Pipeline', icon: Kanban, roles: GROWTH },
    { to: '/os/growth/inbox', label: 'Inbox', icon: Inbox, roles: GROWTH, badge: count('client_requests', (r) => r.status === 'New') },
    { to: '/os/growth/organisations', label: 'Organisations', icon: Building2, roles: GROWTH },
    { to: '/os/growth/proposals', label: 'Proposals', icon: FileText, roles: GROWTH },
    { to: '/os/growth/contracts', label: 'Contracts & MoU', icon: FileSignature, roles: GROWTH },
    { to: '/os/growth/tenders', label: 'Tenders', icon: ListChecks, roles: GROWTH },
    { to: '/os/growth/events', label: 'Events', icon: CalendarDays, roles: GROWTH },
    { to: '/os/retainers', label: 'Retainers', icon: Repeat, roles: GROWTH },
    { to: '/os/retainers/requests', label: 'Client requests', icon: BarChart3, roles: GROWTH },
    { to: '/os/retainers/concerns', label: 'Client concerns', icon: LifeBuoy, roles: GROWTH, badge: count('client_concerns', (r) => r.status !== 'Resolved') },
    { to: '/os/share', label: 'Reference library', icon: Sparkles, roles: GROWTH },
    { to: '/os/share/showcases', label: 'Showcases', icon: Sparkles, roles: GROWTH },
    { to: '/os/share/deals', label: 'Deal rooms', icon: Handshake, roles: GROWTH },
  ],
  routes: [
    { path: 'boss', element: <BossCockpit /> },
    { path: 'boss/briefing', element: <MondayBriefing /> },
    { path: 'boss/scoreboard', element: <Scoreboard /> },
    { path: 'boss/decisions', element: <DecisionLog /> },
    { path: 'growth', element: <PipelinePage /> },
    { path: 'growth/inbox', element: <InboxPage /> },
    { path: 'growth/organisations', element: <Organisations /> },
    { path: 'growth/proposals', element: <ProposalsPage /> },
    { path: 'growth/proposals/:id', element: <ProposalDoc /> },
    { path: 'growth/contracts', element: <ContractsPage /> },
    { path: 'growth/tenders', element: <TendersPage /> },
    { path: 'growth/events', element: <EventsPage /> },
    { path: 'retainers', element: <RetainersPage /> },
    { path: 'retainers/requests', element: <RequestBoardPage /> },
    { path: 'retainers/concerns', element: <ConcernsBoard /> },
    { path: 'retainers/:id', element: <RetainerDetail /> },
    { path: 'share', element: <ReferenceLibrary /> },
    { path: 'share/showcases', element: <ShowcasesPage /> },
    { path: 'share/showcases/:id', element: <ShowcaseBuilder /> },
    { path: 'share/deals', element: <DealsPage /> },
    { path: 'share/deals/:id', element: <DealRoomAdmin /> },
  ],
};
