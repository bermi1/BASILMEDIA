// Growth / Account Manager phone app definition (shared by both roles; coral accent), plus the in-app
// stack that opens growth details (proposal, retainer, showcase, deal room…) without leaving the phone app.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { matchPath } from 'react-router-dom';
import { Building2, CalendarDays, ChevronLeft, FileSignature, FileText, Gavel, Inbox, Kanban, LifeBuoy, Repeat, Share2, ShieldCheck, Users } from 'lucide-react';
import type { PhoneRoleApp } from '../types';
import './seed';
import { BookingsInbox, Organisations, Pipeline } from './crm';
import { ContractsList, EventsList, ProposalDoc, ProposalsList, SubscribersGlance, TendersList } from './docs';
import { ConcernsBoard, RequestBoard, RetainerDetail, RetainersAtRisk, RetainersList, useRetainerData } from './retainers';
import { DealRoomAdmin, DealsList, ReferenceLibrary, ShareQuick, ShowcaseBuilder, ShowcasesList } from './share';
import { DecisionLog, MondayBriefing, Scoreboard } from './boss';
import { GoLink, PageHead, Section, StackCtx } from './kit';

const Titled = ({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) => (
  <div><PageHead tag="" title={title} sub={sub} />{children}</div>
);

/** OS paths the phone stack can open in place. Anything else opens the desktop OS. */
function resolve(to: string): ReactNode | null {
  const [path, query = ''] = to.split('?');
  const q = new URLSearchParams(query);
  const lead = q.get('lead') ?? undefined;
  const m = (pattern: string) => matchPath(pattern, path)?.params;
  let p;
  if ((p = m('/os/growth/proposals/:id'))) return <ProposalDoc id={p.id} />;
  if (m('/os/growth/proposals')) return <Titled title="Proposals" sub={lead ? 'Pick the lead and tap New proposal.' : undefined}><ProposalsList compact lead={lead} /></Titled>;
  if (m('/os/growth/contracts')) return <Titled title="Contracts & MoU"><ContractsList /></Titled>;
  if (m('/os/growth/tenders')) return <Titled title="Tenders"><TendersList /></Titled>;
  if (m('/os/growth/events')) return <Titled title="Events"><EventsList /></Titled>;
  if (m('/os/growth/inbox')) return <Titled title="Inbox"><GrowthInbox /></Titled>;
  if (m('/os/growth/organisations')) return <Organisations />;
  if (m('/os/growth')) return <Titled title="Pipeline"><Pipeline compact /></Titled>;
  if (m('/os/retainers/requests')) return <Titled title="Client requests"><RequestBoard compact /></Titled>;
  if (m('/os/retainers/concerns')) return <ConcernsBoard />;
  if ((p = m('/os/retainers/:id'))) return <RetainerDetail id={p.id} />;
  if (m('/os/retainers')) return <Titled title="Retainers"><RetainersList compact /></Titled>;
  if ((p = m('/os/share/showcases/:id'))) return <ShowcaseBuilder id={p.id} />;
  if (m('/os/share/showcases')) return <Titled title="Showcases"><ShowcasesList compact lead={lead} /></Titled>;
  if ((p = m('/os/share/deals/:id'))) return <DealRoomAdmin id={p.id} />;
  if (m('/os/share/deals')) return <Titled title="Deal rooms" sub={lead ? 'The lead is picked — tap Open deal room.' : undefined}><DealsList compact lead={lead} /></Titled>;
  if (m('/os/share')) return <ReferenceLibrary />;
  if (m('/os/boss/briefing')) return <MondayBriefing />;
  if (m('/os/boss/scoreboard')) return <Scoreboard />;
  if (m('/os/boss/decisions')) return <DecisionLog />;
  if (m('/os/boss/risk')) return <Titled title="Retainers at risk"><RetainersAtRisk /></Titled>;
  return null;
}

/**
 * In-app navigation stack for a phone tab: GoLink / useGo push a path here; the screen opens with a back
 * button (the phone's own back gesture works too), and the tab underneath keeps its state.
 */
export function PhoneStack({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<string[]>([]);
  const [, setParams] = useSearchParams();
  const depth = useRef(0);
  depth.current = stack.length;
  useEffect(() => {
    const onPop = () => {
      if (depth.current > 0) setStack((s) => s.slice(0, -1));
    };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);
  const push = useCallback((to: string) => {
    if (to.startsWith('/app')) {
      const tab = new URLSearchParams(to.split('?')[1] ?? '').get('tab');
      if (tab) setParams((p) => (p.set('tab', tab), p), { replace: true });
      return;
    }
    if (!resolve(to)) return void location.assign(to);
    try {
      history.pushState({ ...(history.state ?? {}), bmStack: depth.current + 1 }, '');
    } catch {
      /* ignore */
    }
    setStack((s) => [...s, to]);
    scrollTo({ top: 0 });
  }, [setParams]);
  const back = () => {
    if (history.state?.bmStack) history.back();
    else setStack((s) => s.slice(0, -1));
    scrollTo({ top: 0 });
  };
  const top = stack[stack.length - 1];
  return (
    <StackCtx.Provider value={push}>
      <div hidden={!!top}>{children}</div>
      {top && (
        <div key={`${stack.length}-${top}`}>
          <button type="button" onClick={back} className="-ml-2 mb-2 flex min-h-[44px] items-center gap-0.5 rounded-full border-0 bg-transparent pl-1 pr-3 text-sm font-bold text-basil"><ChevronLeft size={20} />Back</button>
          {resolve(top)}
        </div>
      )}
    </StackCtx.Provider>
  );
}
const stacked = (el: ReactNode) => <PhoneStack>{el}</PhoneStack>;

/** Open client concerns, answered from the inbox. */
function ConcernsGlance() {
  const { concerns } = useRetainerData();
  const open = concerns.filter((c) => c.status !== 'Resolved');
  if (!open.length) return <div className="rounded-2xl border border-basil-line bg-white p-4 text-sm text-basil-muted">No open concerns.</div>;
  return (
    <GoLink to="/os/retainers/concerns" className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-basil-ink no-underline">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-red-700"><LifeBuoy size={20} /></span>
      <span className="min-w-0 flex-1"><b className="block">{open.length} open concern{open.length > 1 ? 's' : ''}</b><span className="block truncate text-sm text-basil-muted">{open[0].subject}</span></span>
      <span className="text-sm font-bold text-red-700">Answer</span>
    </GoLink>
  );
}

/** Growth inbox: client concerns, client requests waiting for review, and new website bookings. */
export function GrowthInbox() {
  return (
    <div className="flex flex-col gap-5">
      <Section title="Client concerns"><ConcernsGlance /></Section>
      <Section title="Client requests"><RequestBoard compact /></Section>
      <Section title="Website bookings"><BookingsInbox /></Section>
    </div>
  );
}

export const growthPhone = (title: string): PhoneRoleApp => ({
  title,
  accent: '#E8573F',
  tabs: [
    { key: 'pipeline', label: 'Pipeline', icon: Kanban, element: stacked(<Pipeline compact />) },
    { key: 'inbox', label: 'Inbox', icon: Inbox, element: stacked(<GrowthInbox />) },
    { key: 'retainers', label: 'Retainers', icon: Repeat, element: stacked(<RetainersList compact />) },
    { key: 'share', label: 'Share', icon: Share2, element: stacked(<ShareQuick />) },
  ],
  more: [
    { key: 'proposals', label: 'Proposals', icon: FileText, element: stacked(<ProposalsList compact />), sub: 'Basil Media structure, printable' },
    { key: 'contracts', label: 'Contracts', icon: FileSignature, element: stacked(<ContractsList />), sub: 'Instalments and renewals' },
    { key: 'concerns', label: 'Client concerns', icon: LifeBuoy, element: stacked(<ConcernsBoard />), sub: 'Answer and resolve client tickets' },
    { key: 'organisations', label: 'Organisations', icon: Building2, element: stacked(<Organisations />), sub: 'Hospitals, banks, NGOs and contacts' },
    { key: 'library', label: 'Reference library', icon: ShieldCheck, element: stacked(<ReferenceLibrary />), sub: 'Cleared work for showcases' },
    { key: 'tenders', label: 'Tenders', icon: Gavel, element: stacked(<TendersList />), sub: 'Closing dates and outcomes' },
    { key: 'events', label: 'Events', icon: CalendarDays, element: stacked(<EventsList />), sub: 'Where we meet buyers' },
    { key: 'subscribers', label: 'Subscribers', icon: Users, element: <SubscribersGlance />, sub: 'Website health-news subscribers' },
  ],
});
