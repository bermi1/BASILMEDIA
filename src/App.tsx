import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider } from '@/lib/auth';
import { I18nProvider } from '@/lib/i18n';
import { PublicLayout } from '@/components/PublicLayout';
import Home from '@/pages/Home';
import { NotFound } from '@/pages/NotFound';

// Public pages load with the site, so moving between them is instant (no loading spinner).
// The staff back office, phone app and signing pages are split out: visitors never download them.
import Services from '@/pages/Services';
import OurWork from '@/pages/OurWork';
import About from '@/pages/About';
import Contact from '@/pages/Contact';
import HealthNews from '@/pages/HealthNews';
import NewsStory from '@/pages/NewsStory';
import Subscribe from '@/pages/Subscribe';
import FindMe from '@/pages/FindMe';
import RemoveMe from '@/pages/RemoveMe';
import Login from '@/pages/Login';
import { FacePrivacy, Privacy } from '@/pages/Privacy';
const Gallery = lazy(() => import('@/pages/Gallery'));
const OsRoutes = lazy(() => import('@/os/OsRoutes'));
const PhoneApp = lazy(() => import('@/app/AppShell'));
const Sign = lazy(() => import('@/pages/Sign'));
const Verify = lazy(() => import('@/pages/Verify'));
const Showcase = lazy(() => import('@/os/modules/growth/public').then((m) => ({ default: m.ShowcasePage })));
const DealRoom = lazy(() => import('@/os/modules/growth/public').then((m) => ({ default: m.DealRoomPage })));

const Spinner = () => <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-basil" size={32} /></div>;

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<Spinner />}>
            <Routes>
              <Route element={<PublicLayout />}>
                <Route index element={<Home />} />
                <Route path="services" element={<Services />} />
                <Route path="our-work" element={<OurWork />} />
                <Route path="about" element={<About />} />
                <Route path="contact" element={<Contact />} />
                <Route path="health-news" element={<HealthNews />} />
                <Route path="health-news/:id" element={<NewsStory />} />
                <Route path="subscribe" element={<Subscribe />} />
                <Route path="find-me" element={<FindMe />} />
                <Route path="remove-me" element={<RemoveMe />} />
                <Route path="privacy" element={<Privacy />} />
                <Route path="privacy/face-search" element={<FacePrivacy />} />
                <Route path="*" element={<NotFound />} />
              </Route>
              <Route path="login" element={<Login />} />
              <Route path="g/:slug" element={<Gallery />} />
              <Route path="s/:slug" element={<Showcase />} />
              <Route path="d/:token" element={<DealRoom />} />
              <Route path="sign/:token" element={<Sign />} />
              <Route path="verify/:id" element={<Verify />} />
              <Route path="admin/*" element={<OsRoutes />} />
              <Route path="os/*" element={<OsRoutes />} />
              <Route path="app" element={<PhoneApp />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  );
}
