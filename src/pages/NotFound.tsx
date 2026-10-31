import { Link } from 'react-router-dom';
import { useSeo } from '@/hooks/useSeo';

export function NotFound() {
  useSeo('Page not found');
  return (
    <section className="container-bm flex min-h-[60vh] flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="font-display text-[120px] font-extrabold leading-none text-basil-ice">404</div>
      <h1 className="m-0 text-3xl font-extrabold">This frame didn’t make the cut.</h1>
      <p className="m-0 text-basil-muted">The page you were looking for has moved or never existed.</p>
      <Link to="/" className="btn-primary">Back to home</Link>
    </section>
  );
}
