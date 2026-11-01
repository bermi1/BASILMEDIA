-- Basil Media OS · 0035 CareHealth, NEDC and SATA logos (supplied by Basil Media).
update public.partners set logo_url = '/img/partners/carehealth.png' where name ilike 'CareHealth%' and coalesce(logo_url, '') = '';
update public.partners set logo_url = '/img/partners/nedc.png' where name ilike 'NEDC%' and coalesce(logo_url, '') = '';
update public.partners set logo_url = '/img/partners/sata.png' where name ilike 'SATA%' and coalesce(logo_url, '') = '';
