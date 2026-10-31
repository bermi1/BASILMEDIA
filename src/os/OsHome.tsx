import { Link } from 'react-router-dom';
import { Globe2, Inbox, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useRows } from '@/hooks/useData';
import { PageTitle } from './OsLayout';

const ROADMAP = [
  ['Phase 1', 'Finance, approvals, quotations and invoices'],
  ['Phase 1B', 'Passkeys, step-up checks and e-signature'],
  ['Phase 1C', 'Project money requests with WhatsApp/SMS push'],
  ['Phase 2', 'Projects, staff portal, payroll and petty cash'],
  ['Phase 3', 'Boss cockpit, Monday Briefing and reports'],
  ['Phase 4', 'Gallery & delivery studio with bulk upload'],
];

export default function OsHome() {
  const { user, canEditWebsite } = useAuth();
  const { rows: bookings } = useRows('bookings');
  const { rows: subs } = useRows('subscribers');
  const fresh = bookings.filter((b) => b.status === 'new').length;
  return (
    <>
      <PageTitle tag="HOME" title={`Habari, ${(user?.name || user?.email || '').split(/[ @]/)[0]}`} sub="Run the office. Reach the audience. Tell the story." />
      {canEditWebsite && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Link to="/os/website" className="card flex items-center gap-4 p-5 text-basil-ink no-underline hover:shadow-card"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-basil text-white"><Globe2 /></span><span><b className="block">Website CMS</b><span className="text-sm text-basil-muted">Pages, photos, videos, news</span></span></Link>
          <Link to="/os/website/bookings" className="card flex items-center gap-4 p-5 text-basil-ink no-underline hover:shadow-card"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-basil-ice text-basil"><Inbox /></span><span><b className="block">{fresh} new bookings</b><span className="text-sm text-basil-muted">{bookings.length} in total</span></span></Link>
          <Link to="/os/website/subscribers" className="card flex items-center gap-4 p-5 text-basil-ink no-underline hover:shadow-card"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-basil-ice text-basil"><Users /></span><span><b className="block">{subs.length} subscribers</b><span className="text-sm text-basil-muted">Basil Health Brief</span></span></Link>
        </div>
      )}
      <div className="card p-6">
        <h2 className="m-0 mb-1 text-lg font-extrabold">What’s being built next</h2>
        <p className="m-0 mb-4 text-sm text-basil-muted">Basil Media OS is delivered in phases. The public website and its CMS are live now.</p>
        <ol className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
          {ROADMAP.map(([p, l]) => <li key={p} className="flex gap-3 rounded-xl bg-basil-mist p-3 text-sm"><b className="w-16 shrink-0 text-basil">{p}</b>{l}</li>)}
        </ol>
      </div>
    </>
  );
}
