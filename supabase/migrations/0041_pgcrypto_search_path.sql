-- Basil Media OS · 0015 make gallery PIN functions find pgcrypto (Supabase keeps it in the "extensions" schema).
alter function public.stash_gallery_pin() set search_path = public, extensions;
alter function public.gallery_media(text, text) set search_path = public, extensions;
