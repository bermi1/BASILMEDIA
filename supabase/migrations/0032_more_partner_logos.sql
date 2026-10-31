-- Basil Media OS · 0032 SNOSSA and Ampola Regency Hospital logos (from their own websites).
update public.partners set logo_url = '/img/partners/snossa.png' where name in ('SNOSSA Conference 2026', 'SNOSSA') and coalesce(logo_url, '') = '';
update public.partners set logo_url = '/img/partners/ampola-regency-hospital.png' where name in ('Ampola Regency Hospital', 'Ampola Regency') and coalesce(logo_url, '') = '';
