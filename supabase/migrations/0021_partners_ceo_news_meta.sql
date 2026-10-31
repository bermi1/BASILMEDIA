-- Basil Media OS · 0021 real partners (two-row "Trusted by"), "A word from our CEO", news pictures.

-- CEO message on the landing page (editable in Website CMS → Site settings).
alter table public.site_settings
  add column if not exists ceo_name text not null default 'Emmanuel Basil',
  add column if not exists ceo_title text not null default 'Founder & CEO, Basil Media',
  add column if not exists ceo_message text not null default '',
  add column if not exists ceo_photo_url text not null default '';

-- Partners, most important first. The sample partners from 0018 are replaced. Upload each official
-- logo in Website CMS → Partners; until then the name is shown as a badge.
delete from public.partners where id::text like 'b5a5e000-%';
insert into public.partners (name, logo_url, website, sort_order)
select v.name, v.logo, v.site, v.ord from (values
  ('Muhimbili National Hospital', '', 'https://www.mnh.or.tz', 1),
  ('MUHAS', '', 'https://www.muhas.ac.tz', 2),
  ('Aga Khan Hospital, Dar es Salaam', '', 'https://hospitals.aku.edu/dar-es-salaam', 3),
  ('CRDB Bank Foundation', '/img/partners/crdb-bank-foundation.png', 'https://crdbbankfoundation.co.tz', 4),
  ('Amref Health Africa', '', 'https://amref.org', 5),
  ('Muhimbili Orthopaedic Institute (MOI)', '', 'https://www.moi.ac.tz', 6),
  ('Kairuki University', '', 'https://hkmu.ac.tz', 7),
  ('Tanzania Health Summit', '', '', 8),
  ('CardioTan · JKCI', '', 'https://www.jkci.or.tz', 9),
  ('SATA', '', 'https://www.sata.or.tz', 10),
  ('SNOSSA', '', '', 11),
  ('NEDC', '', '', 12),
  ('CareHealth Tanzania', '', '', 13),
  ('Ampola Regency', '', '', 14)
) as v(name, logo, site, ord)
where not exists (select 1 from public.partners p where lower(p.name) = lower(v.name));

-- Live health news: the article's own picture and description are fetched and stored.
alter table public.health_feed_items add column if not exists image_url text not null default '';
