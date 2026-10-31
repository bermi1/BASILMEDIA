/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_STORAGE_DRIVER?: 'supabase' | 's3';
  readonly VITE_STORAGE_BUCKET?: string;
  readonly VITE_STORAGE_PUBLIC_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
