-- Basil Media OS · 0010 rotating hero photos (team, office, studio — uploaded in the CMS) and office hours.
alter table public.site_settings add column if not exists hero_images text[] not null default '{}';
alter table public.site_settings add column if not exists office_hours text not null default '';

update public.site_settings
set office_hours = 'Mon–Fri 08:30–17:30 · Sat 09:00–13:00'
where id = 'site' and office_hours = '';

-- Short "who we are" block on the home page, and the real office address.
alter table public.site_settings add column if not exists home_about_title text not null default '';
alter table public.site_settings add column if not exists home_about_text text not null default '';
update public.site_settings set
  home_about_title = case when home_about_title = '' then 'Pioneering health, innovation and youth empowerment — one story at a time.' else home_about_title end,
  home_about_text = case when home_about_text = '' then 'Basil Media is a Dar es Salaam studio telling the stories that move Tanzania forward: the clinicians, innovators and young people shaping what comes next.' else home_about_text end,
  address = '2 Mataka Street, Upanga, Dar es Salaam, Tanzania'
where id = 'site';
