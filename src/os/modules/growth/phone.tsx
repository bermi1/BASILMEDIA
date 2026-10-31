// Growth / Account Manager phone app definition (shared by both roles; coral accent).
import { CalendarDays, FileSignature, FileText, Gavel, Inbox, Kanban, Repeat, Share2, Users } from 'lucide-react';
import type { PhoneRoleApp } from '../types';
import { BookingsInbox, Pipeline } from './crm';
import { ContractsList, EventsList, ProposalsList, SubscribersGlance, TendersList } from './docs';
import { RequestBoard, RetainersList } from './retainers';
import { ShareQuick } from './share';
import { Section } from './kit';

/** Growth inbox: new website bookings + client requests waiting for review. */
export function GrowthInbox() {
  return (
    <div className="flex flex-col gap-5">
      <Section title="Website bookings"><BookingsInbox /></Section>
      <Section title="Client requests"><RequestBoard compact /></Section>
    </div>
  );
}

export const growthPhone = (title: string): PhoneRoleApp => ({
  title,
  accent: '#E8573F',
  tabs: [
    { key: 'pipeline', label: 'Pipeline', icon: Kanban, element: <Pipeline compact /> },
    { key: 'inbox', label: 'Inbox', icon: Inbox, element: <GrowthInbox /> },
    { key: 'retainers', label: 'Retainers', icon: Repeat, element: <RetainersList compact /> },
    { key: 'share', label: 'Share', icon: Share2, element: <ShareQuick /> },
  ],
  more: [
    { key: 'proposals', label: 'Proposals', icon: FileText, element: <ProposalsList compact />, sub: 'Basil Media structure, printable' },
    { key: 'contracts', label: 'Contracts', icon: FileSignature, element: <ContractsList />, sub: 'Instalments and renewals' },
    { key: 'tenders', label: 'Tenders', icon: Gavel, element: <TendersList />, sub: 'Closing dates and outcomes' },
    { key: 'events', label: 'Events', icon: CalendarDays, element: <EventsList />, sub: 'Where we meet buyers' },
    { key: 'subscribers', label: 'Subscribers', icon: Users, element: <SubscribersGlance />, sub: 'Website health-news subscribers' },
  ],
});
