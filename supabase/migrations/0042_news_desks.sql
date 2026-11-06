-- Basil Media OS · 0016 news desks (Health, Youth & Opportunities, Innovation, Capital & Business, Banking for Youth)
-- and more opportunity types for young people.
alter table public.opportunities drop constraint if exists opportunities_kind_check;
alter table public.opportunities add constraint opportunities_kind_check
  check (kind in ('Job', 'Internship', 'Fellowship', 'Scholarship', 'Grant', 'Funding', 'Competition', 'Training', 'Call for abstracts'));
