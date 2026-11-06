// Audience engine: segments, bulk SMS / email / WhatsApp campaigns, templates, automations, replies, providers.
import { Filter, Inbox, LibraryBig, Send, Settings2, SquarePen } from 'lucide-react';
import { countRows } from '@/os/lib/store';
import type { AppRole } from '@/lib/types';
import type { OsModule } from '../types';
import './seed';
import { CampaignBuilder, CampaignDetail, CampaignsPage } from './campaigns';
import { InboxPage, LibraryPage, ProviderSettingsPage, SegmentsPage } from './pages';

const ROLES: AppRole[] = ['growth', 'gm_cfo', 'boss'];

export const audienceModule: OsModule = {
  key: 'audience',
  section: 'AUDIENCE',
  nav: [
    { to: '/os/audience', label: 'Campaigns', icon: Send, roles: ROLES, badge: () => countRows('campaigns', { eq: { status: 'Awaiting approval' } }).catch(() => 0) },
    { to: '/os/audience/new', label: 'New campaign', icon: SquarePen, roles: ROLES },
    { to: '/os/audience/segments', label: 'Segments', icon: Filter, roles: ROLES },
    { to: '/os/audience/library', label: 'Templates & automations', icon: LibraryBig, roles: ROLES },
    { to: '/os/audience/inbox', label: 'Replies', icon: Inbox, roles: ROLES, badge: () => countRows('sms_inbox', { eq: { handled: false } }).catch(() => 0) },
    { to: '/os/audience/settings', label: 'Provider settings', icon: Settings2, roles: ROLES },
  ],
  routes: [
    { path: 'audience', element: <CampaignsPage /> },
    { path: 'audience/new', element: <CampaignBuilder /> },
    { path: 'audience/campaigns/:id', element: <CampaignDetail /> },
    { path: 'audience/campaigns/:id/edit', element: <CampaignBuilder /> },
    { path: 'audience/segments', element: <SegmentsPage /> },
    { path: 'audience/library', element: <LibraryPage /> },
    { path: 'audience/inbox', element: <InboxPage /> },
    { path: 'audience/settings', element: <ProviderSettingsPage /> },
  ],
};
