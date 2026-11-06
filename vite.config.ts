import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { pickSupabaseEnv } from './supabase-env.mjs';

// Supabase URL + public key: see supabase-env.mjs (matching pair, cleaned, never a secret key).
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env } as Record<string, string | undefined>;
  const { url, key, source, problems } = pickSupabaseEnv(env);
  for (const p of problems) console.warn(`[supabase] ${p}`);
  console.log(url ? `[supabase] using ${source}_URL (${url}) and its key (${key.slice(0, 14)}…)` : '[supabase] no Supabase URL/key found — the site will show the setup screen');
  return {
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(url),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(key),
  },
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          motion: ['framer-motion'],
        },
      },
    },
  },
  };
});
