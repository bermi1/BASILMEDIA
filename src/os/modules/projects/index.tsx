import { Briefcase, Clapperboard, Clock, Contact, FileText, Film, HardDrive, Leaf, Lightbulb, ListChecks, Megaphone, Users } from 'lucide-react';
import { isDemo } from '@/lib/supabase';
import { demoTable } from '@/os/lib/store';
import type { AppRole } from '@/lib/types';
import type { OsModule } from '../types';
import { footageAtRisk, type FootageCopy, type MediaCard, type Shoot } from './lib';
import { FootagePage, PostPage, ProjectPage, ProjectsBoard, ShootsPage, TasksPage } from './pages';
import { AnnouncementsPage, AttendancePage, DirectoryPage, LeavePage, PeopleHome, SuggestionsPage, WeeklyReportsPage } from './people';

const WORK: AppRole[] = ['boss', 'gm_cfo', 'project_lead', 'staff'];
/** Day-to-day production work (the GM/Boss see it inside each project instead). */
const CREW: AppRole[] = ['project_lead', 'staff'];
const ALL_STAFF: AppRole[] = ['boss', 'gm_cfo', 'finance', 'project_lead', 'staff', 'storekeeper', 'growth', 'account_manager', 'receptionist', 'driver'];

const atRisk = () => (isDemo ? footageAtRisk(demoTable('media_cards') as unknown as MediaCard[], demoTable('shoots') as unknown as Shoot[], demoTable('footage_copies') as unknown as FootageCopy[]).length : 0);
const pendingLeave = () => (isDemo ? demoTable('leave_requests').filter((l) => l.status === 'Pending').length : 0);

export const projectsModule: OsModule = {
  key: 'projects',
  section: 'WORK',
  nav: [
    { to: '/os/projects', label: 'Projects', icon: Briefcase, roles: WORK },
    { to: '/os/projects/tasks', label: 'Tasks', icon: ListChecks, roles: CREW },
    { to: '/os/projects/shoots', label: 'Shoots & crew', icon: Clapperboard, roles: WORK },
    { to: '/os/projects/post', label: 'Post-production', icon: Film, roles: CREW },
    { to: '/os/projects/footage', label: 'Footage safety', icon: HardDrive, roles: CREW, badge: atRisk },
    { to: '/os/people', label: 'Staff portal', icon: Users, roles: ALL_STAFF },
    { to: '/os/people/reports', label: 'Weekly reports', icon: FileText, roles: ALL_STAFF },
    { to: '/os/people/suggestions', label: 'Suggestion box', icon: Lightbulb, roles: ALL_STAFF },
    { to: '/os/people/leave', label: 'Leave', icon: Leaf, roles: ALL_STAFF, badge: () => pendingLeave() },
    { to: '/os/people/attendance', label: 'Attendance', icon: Clock, roles: ALL_STAFF },
    { to: '/os/people/announcements', label: 'Announcements', icon: Megaphone, roles: ALL_STAFF },
    { to: '/os/people/directory', label: 'Directory', icon: Contact, roles: ALL_STAFF },
  ],
  routes: [
    { path: 'projects', element: <ProjectsBoard /> },
    { path: 'projects/tasks', element: <TasksPage /> },
    { path: 'projects/shoots', element: <ShootsPage /> },
    { path: 'projects/post', element: <PostPage /> },
    { path: 'projects/footage', element: <FootagePage /> },
    { path: 'projects/:id', element: <ProjectPage /> },
    { path: 'people', element: <PeopleHome /> },
    { path: 'people/reports', element: <WeeklyReportsPage /> },
    { path: 'people/suggestions', element: <SuggestionsPage /> },
    { path: 'people/leave', element: <LeavePage /> },
    { path: 'people/attendance', element: <AttendancePage /> },
    { path: 'people/announcements', element: <AnnouncementsPage /> },
    { path: 'people/directory', element: <DirectoryPage /> },
  ],
};
