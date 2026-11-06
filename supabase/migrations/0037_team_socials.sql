-- Basil Media OS · 0011 Instagram and LinkedIn links on team profiles (About page).
alter table public.team add column if not exists instagram_url text not null default '';
alter table public.team add column if not exists linkedin_url text not null default '';
