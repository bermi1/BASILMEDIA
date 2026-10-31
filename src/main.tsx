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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {supabaseConfigured ? <App /> : <SetupNeeded />}
  </StrictMode>,
);
