-- Basil Media OS · 0045 partners: CRDB Bank beside the CRDB Bank Foundation, the Aga Khan Hospital (Dar es Salaam)
-- logo without the Arabic line, and one SATA card instead of four duplicates.
insert into public.partners (division_id, name, logo_url, website, sort_order)
select 'basil-media', 'CRDB Bank', '/img/partners/crdb-bank.svg', 'https://crdbbank.co.tz', 0
where not exists (select 1 from public.partners where lower(name) = 'crdb bank');
update public.partners set name = 'The Aga Khan Hospital, Dar es Salaam', logo_url = '/img/partners/aga-khan-hospital-dar.svg'
 where name ilike 'aga khan hospital%' or logo_url like '%aga-khan-hospital.svg';
delete from public.partners p using public.partners q
 where p.name ilike 'SATA%' and q.name = p.name and q.created_at < p.created_at;
