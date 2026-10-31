import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider } from '@/lib/auth';
import { I18nProvider } from '@/lib/i18n';
import { PublicLayout } from '@/components/PublicLayout';
import Home from '@/pages/Home';
import { NotFound } from '@/pages/NotFound';

// Everything except the home page is split out so the first load stays small on mobile data.
const Services = lazy(() => import('@/pages/Services'));
const OurWork = lazy(() => import('@/pages/OurWork'));
const About = lazy(() => import('@/pages/About'));
const Contact = lazy(() => import('@/pages/Contact'));
const HealthNews = lazy(() => import('@/pages/HealthNews'));
const NewsStory = lazy(() => import('@/pages/NewsStory'));
const Subscribe = lazy(() => import('@/pages/Subscribe'));
const Gallery = lazy(() => import('@/pages/Gallery'));
const FindMe = lazy(() => import('@/pages/FindMe'));
const Login = lazy(() => import('@/pages/Login'));
const Privacy = lazy(() => import('@/pages/Privacy').then((m) => ({ default: m.Privacy })));
const FacePrivacy = lazy(() => import('@/pages/Privacy').then((m) => ({ default: m.FacePrivacy })));
const OsRoutes = lazy(() => import('@/os/OsRoutes'));
const PhoneApp = lazy(() => import('@/app/AppShell'));
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
                <Route path="privacy" element={<Privacy />} />
                <Route path="privacy/face-search" element={<FacePrivacy />} />
                <Route path="*" element={<NotFound />} />
              </Route>
              <Route path="login" element={<Login />} />
              <Route path="g/:slug" element={<Gallery />} />
              <Route path="s/:slug" element={<Showcase />} />
              <Route path="d/:token" element={<DealRoom />} />
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
