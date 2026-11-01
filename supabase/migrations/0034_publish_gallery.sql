-- Basil Media OS · 0034 any staff member can publish a finished Pixieset gallery as photography work.
-- It goes to the top of Our Work, is marked New for 7 days, and the team is notified.
create or replace function public.publish_gallery(_title text, _client text, _url text, _cover text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare gid uuid; who text;
begin
  if not public.is_staff() then raise exception 'Only Basil Media staff can publish galleries'; end if;
  if coalesce(trim(_title), '') = '' then raise exception 'Add the gallery title'; end if;
  if _url !~* '^https://[a-z0-9-]+\.pixieset\.com/[a-z0-9_-]+/?' then raise exception 'Paste the Pixieset gallery link (https://….pixieset.com/…)'; end if;
  if exists (select 1 from public.projects_public where external_url = _url) then raise exception 'This gallery is already on the website'; end if;
  insert into public.projects_public (title, client, category, image_url, description, external_url, featured, sort_order, published)
  values (trim(_title), coalesce(trim(_client), ''), 'Photo Stories', coalesce(_cover, ''), 'Photo collection by Basil Media.', _url, true,
          -extract(epoch from now())::int, true)
  returning id into gid;
  select coalesce(nullif(full_name, ''), 'A team member') into who from public.profiles where id = auth.uid();
  perform public.notify(r.user_id, 'New gallery published', coalesce(who, 'A team member') || ' · ' || trim(_title), _url, 'info')
    from (select distinct user_id from public.user_roles where role <> 'client' and user_id <> auth.uid()) r;
  return gid;
end;
$$;
revoke execute on function public.publish_gallery(text, text, text, text) from anon;
