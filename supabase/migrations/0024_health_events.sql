-- Basil Media OS · 0024 upcoming health events shown on the Subscribe page (admins add more in Website CMS → Events).
insert into public.events (title, venue, starts_on, cpd, sector, link, published)
select '16th African Academy of Sciences Biennial Scientific Conference', 'JNICC, Dar es Salaam', date '2026-12-15', '', 'Health',
       'https://www.udsm.ac.tz/sites/default/files/2026-07/16AAS%20Conference.pdf', true
where not exists (select 1 from public.events where title like '16th African Academy of Sciences%');

-- The starter placeholder events (0003) were not real announcements: hide them (still editable in the CMS).
update public.events set published = false
where link = '' and (title, starts_on) in (
  ('Tanzania Health Summit', date '2026-11-14'), ('Cardiology update for clinicians', date '2026-11-22'),
  ('East African Paediatrics Congress', date '2026-12-10'), ('Pharmacy practice workshop', date '2026-12-25'),
  ('Nursing leadership forum', date '2027-01-09'));
