import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { supabaseConfigured } from './lib/supabase';
import SetupNeeded from './pages/SetupNeeded';
import './index.css';

// Hosts without SPA rewrites serve public/404.html, which bounces here with the original path.
const pending = sessionStorage.getItem('basil-redirect');
if (pending) {
  sessionStorage.removeItem('basil-redirect');
  history.replaceState(null, '', pending);
}

// Pictures fade in once they have arrived instead of drawing in line by line (see img in index.css).
document.addEventListener('load', (e) => { const t = e.target as HTMLElement; if (t.tagName === 'IMG') t.dataset.loaded = '1'; }, true);
document.addEventListener('error', (e) => { const t = e.target as HTMLElement; if (t.tagName === 'IMG') t.dataset.loaded = '1'; }, true);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {supabaseConfigured ? <App /> : <SetupNeeded />}
  </StrictMode>,
);
