-- Basil Media OS · 0014 RLS fixes found by testing every portal against a real database.
-- 1. shoots ↔ shoot_crew policies referenced each other ("infinite recursion detected in policy").
--    Security-definer helpers read the other table without re-entering its policies.

create or replace function public.is_on_shoot(_shoot uuid, _user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shoot_crew where shoot_id = _shoot and user_id = _user);
$$;
create or replace function public.shoot_project(_shoot uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select project_id from public.shoots where id = _shoot;
$$;
revoke execute on function public.is_on_shoot(uuid, uuid) from anon;
revoke execute on function public.shoot_project(uuid) from anon;

drop policy if exists "see shoots" on public.shoots;
create policy "see shoots" on public.shoots for select to authenticated
  using (public.can_see_project(project_id) or public.is_on_shoot(id));
drop policy if exists "crew update shoots" on public.shoots;
create policy "crew update shoots" on public.shoots for update to authenticated
  using (public.is_on_shoot(id));

drop policy if exists "see shoot crew" on public.shoot_crew;
create policy "see shoot crew" on public.shoot_crew for select to authenticated
  using (user_id = auth.uid() or public.can_see_project(public.shoot_project(shoot_id)));
drop policy if exists "manage shoot crew" on public.shoot_crew;
create policy "manage shoot crew" on public.shoot_crew for all to authenticated
  using (public.can_manage_project(public.shoot_project(shoot_id)))
  with check (public.can_manage_project(public.shoot_project(shoot_id)));
