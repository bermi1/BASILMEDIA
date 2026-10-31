import { Navigate, Route, Routes } from 'react-router-dom';
import { OsLayout, RequireCms } from './OsLayout';
import OsHome from './OsHome';
import { ToastProvider } from './cms/toast';
import { ActingProvider } from './lib/session';
import { MODULES } from './modules';
import UsersAdmin from './UsersAdmin';
import AccessAdmin from './AccessAdmin';
import { BookingsCms, CmsOverview, GalleriesCms, SettingsCms, SubscribersCms } from './cms/pages';
import { EventsCms, HighlightsCms, NewsCms, OpportunitiesCms, PartnersCms, ProjectsCms, ServicesCms, TeamCms, TestimonialsCms } from './cms/resources';

const cms = (el: JSX.Element) => <RequireCms>{el}</RequireCms>;

export default function OsRoutes() {
  return (
    <ActingProvider>
    <ToastProvider>
      <Routes>
        <Route element={<OsLayout />}>
          <Route index element={<OsHome />} />
          <Route path="website" element={cms(<CmsOverview />)} />
          <Route path="website/settings" element={cms(<SettingsCms />)} />
          <Route path="website/projects" element={cms(<ProjectsCms />)} />
          <Route path="website/services" element={cms(<ServicesCms />)} />
          <Route path="website/highlights" element={cms(<HighlightsCms />)} />
          <Route path="website/partners" element={cms(<PartnersCms />)} />
          <Route path="website/team" element={cms(<TeamCms />)} />
          <Route path="website/testimonials" element={cms(<TestimonialsCms />)} />
          <Route path="website/galleries" element={cms(<GalleriesCms />)} />
          <Route path="website/news" element={cms(<NewsCms />)} />
          <Route path="website/opportunities" element={cms(<OpportunitiesCms />)} />
          <Route path="website/events" element={cms(<EventsCms />)} />
          <Route path="website/bookings" element={cms(<BookingsCms />)} />
          <Route path="website/subscribers" element={cms(<SubscribersCms />)} />
          <Route path="admin/users" element={<UsersAdmin />} />
          <Route path="admin/access" element={<AccessAdmin />} />
          {MODULES.flatMap((m) => m.routes.map((r) => <Route key={`${m.key}:${r.path}`} path={r.path} element={r.element} />))}
          <Route path="*" element={<Navigate to="/os" replace />} />
        </Route>
      </Routes>
    </ToastProvider>
    </ActingProvider>
  );
}
