-- Basil Media OS · 0010 rotating hero photos (team, office, studio — uploaded in the CMS) and office hours.
alter table public.site_settings add column if not exists hero_images text[] not null default '{}';
alter table public.site_settings add column if not exists office_hours text not null default '';

update public.site_settings
set office_hours = 'Mon–Fri 08:30–17:30 · Sat 09:00–13:00'
where id = 'site' and office_hours = '';
