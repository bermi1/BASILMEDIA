-- Basil Media OS · 0045 partners: CRDB Bank beside the CRDB Bank Foundation, the Aga Khan Hospital (Dar es Salaam)
-- logo without the Arabic line, and one SATA card instead of four duplicates.
insert into public.partners (division_id, name, logo_url, website, sort_order)
select 'basil-media', 'CRDB Bank', '/img/partners/crdb-bank.svg', 'https://crdbbank.co.tz', 0
where not exists (select 1 from public.partners where lower(name) = 'crdb bank');
-- CRDB Bank Foundation stays, right after the bank (added back if it was ever deleted)
insert into public.partners (division_id, name, logo_url, website, sort_order)
select 'basil-media', 'CRDB Bank Foundation', '/img/partners/crdb-bank-foundation.webp', 'https://crdbbank.co.tz/en/crdb-bank-foundation', 1
where not exists (select 1 from public.partners where lower(name) = 'crdb bank foundation');
update public.partners set sort_order = 1 where lower(name) = 'crdb bank foundation';
update public.partners set name = 'The Aga Khan Hospital, Dar es Salaam', logo_url = '/img/partners/aga-khan-hospital-dar.svg'
 where name ilike 'aga khan hospital%' or logo_url like '%aga-khan-hospital.svg';
delete from public.partners p using public.partners q
 where p.name ilike 'SATA%' and q.name = p.name and q.created_at < p.created_at;
