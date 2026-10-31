// Shown only when the site was built without VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
import { Database, KeyRound, Rocket } from 'lucide-react';

const STEPS = [
  { Icon: Database, title: 'Create the database', text: 'In Supabase → SQL Editor, paste supabase/setup.sql and press Run.' },
  { Icon: KeyRound, title: 'Add two settings', text: 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (the publishable key) in your host or in .env.local.' },
  { Icon: Rocket, title: 'Build and open', text: 'Run npm run build (or npm run dev) and reload. The first account to sign up becomes the Super Admin.' },
];

export default function SetupNeeded() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-basil-mist px-4 py-10 text-basil-ink">
      <div className="w-full max-w-lg rounded-[28px] border border-basil-line bg-white p-6 shadow-[0_20px_50px_rgba(10,47,92,0.12)] sm:p-9">
        <img src="/brand/basil-media-logo.svg" alt="Basil Media" className="h-20 w-auto" />
        <h1 className="m-0 mt-4 text-2xl font-extrabold">Connect the database</h1>
        <p className="m-0 mt-1.5 text-basil-muted">Basil Media OS runs on Supabase. This copy of the site has not been connected yet.</p>
        <ol className="m-0 mt-6 flex list-none flex-col gap-4 p-0">
          {STEPS.map(({ Icon, title, text }, i) => (
            <li key={title} className="flex gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-basil-ice text-basil"><Icon size={20} /></span>
              <span><b className="block">{i + 1}. {title}</b><span className="text-sm text-basil-muted">{text}</span></span>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
