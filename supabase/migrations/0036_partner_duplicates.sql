-- Remove duplicate partners (same name): keep the oldest row of each name.
delete from public.partners p
using public.partners q
where lower(p.name) = lower(q.name)
  and (p.created_at, p.id::text) > (q.created_at, q.id::text);
