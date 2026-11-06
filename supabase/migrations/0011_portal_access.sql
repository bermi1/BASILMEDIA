-- Basil Media OS · 0011 portal access
-- 1. The GM/CFO is also the Account Manager, Finance Officer and Receptionist (and runs logistics):
--    holding gm_cfo implies those roles everywhere (RLS, SQL functions, notifications).
-- 2. Portal grants: the Boss, GM/CFO or Super Admin can give a person an extra portal — for the whole
--    company or for ONE project only (e.g. a crew member who runs a project, or drives for it).
--    Project-scoped grants make the person a member of that project, nothing more.
-- 3. my_portals(): every portal the signed-in person may switch between.
-- Segregation of duties is unchanged: it is checked on user ids (requester ≠ reviewer ≠ approver ≠ payer).

-- ---------- implied roles ----------
create or replace function public.implied_roles(_role public.app_role)
returns public.app_role[] language sql immutable as $$
  select case _role
    when 'gm_cfo' then array['gm_cfo', 'finance', 'account_manager', 'receptionist']::public.app_role[]
    else array[_role]
  end;
$$;

create table public.portal_grants (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null check (role not in ('super_admin', 'boss', 'gm_cfo', 'client')),
  project_id uuid references public.projects (id) on delete cascade,
  note text not null default '',
  expires_at date,
  granted_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  unique nulls not distinct (user_id, role, project_id)
);
create index on public.portal_grants (user_id);
create index on public.portal_grants (project_id);

create or replace function public.grant_active(g public.portal_grants)
returns boolean language sql stable as $$ select g.expires_at is null or g.expires_at >= current_date; $$;

-- has_role / has_any_role now understand implied roles and company-wide grants.
-- super_admin is never implied and can never be granted.
create or replace function public.has_role(_user uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user and (role = 'super_admin' or _role = any(public.implied_roles(role))))
      or exists (select 1 from public.portal_grants g where g.user_id = _user and g.role = _role and g.project_id is null
                   and (g.expires_at is null or g.expires_at >= current_date));
$$;

create or replace function public.has_any_role(_user uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user and (role = 'super_admin' or public.implied_roles(role) && _roles))
      or exists (select 1 from public.portal_grants g where g.user_id = _user and g.role = any(_roles) and g.project_id is null
                   and (g.expires_at is null or g.expires_at >= current_date));
$$;

-- Everyone who effectively holds a role (for notifications).
create or replace function public.role_holders(_role public.app_role)
returns setof uuid language sql stable security definer set search_path = public as $$
  select user_id from public.user_roles where role = 'super_admin' or _role = any(public.implied_roles(role))
  union
  select user_id from public.portal_grants where role = _role and project_id is null and (expires_at is null or expires_at >= current_date);
$$;

create or replace function public.notify_role(_role public.app_role, _title text, _body text default '', _link text default '', _kind text default 'info')
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, title, body, link, kind)
  select distinct h, _title, _body, _link, _kind from public.role_holders(_role) h;
$$;
revoke execute on function public.notify_role(public.app_role, text, text, text, text) from anon;
revoke execute on function public.role_holders(public.app_role) from anon;

-- Project-scoped grants make the person a member of that project (they see it, its tasks, shoots and trips).
create or replace function public.is_project_member(_project uuid, _user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects where id = _project and lead_id = _user)
      or exists (select 1 from public.project_crew where project_id = _project and user_id = _user)
      or exists (select 1 from public.portal_grants g where g.project_id = _project and g.user_id = _user
                   and (g.expires_at is null or g.expires_at >= current_date));
$$;

-- A project_lead grant on one project lets that person manage that project only.
create or replace function public.can_manage_project(_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'project_lead']::public.app_role[])
      or exists (select 1 from public.projects where id = _project and lead_id = auth.uid())
      or exists (select 1 from public.portal_grants g where g.project_id = _project and g.user_id = auth.uid() and g.role = 'project_lead'
                   and (g.expires_at is null or g.expires_at >= current_date));
$$;

-- ---------- who may grant ----------
create or replace function public.can_grant_portals()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_any_role(auth.uid(), array['boss', 'gm_cfo']::public.app_role[]);
$$;

alter table public.portal_grants enable row level security;
create policy "see own or manage grants" on public.portal_grants for select to authenticated
  using (user_id = auth.uid() or public.can_grant_portals());
create policy "leaders add grants" on public.portal_grants for insert to authenticated
  with check (public.can_grant_portals() and granted_by = auth.uid());
create policy "leaders change grants" on public.portal_grants for update to authenticated
  using (public.can_grant_portals()) with check (public.can_grant_portals());
create policy "leaders remove grants" on public.portal_grants for delete to authenticated
  using (public.can_grant_portals());

create or replace function public.grant_portal(_user uuid, _role public.app_role, _project uuid default null, _expires date default null, _note text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare gid uuid; pname text;
begin
  if not public.can_grant_portals() then raise exception 'Only the Boss or GM/CFO can give portal access'; end if;
  if _role in ('super_admin', 'boss', 'gm_cfo', 'client') then raise exception 'That portal cannot be granted here — use Users & roles'; end if;
  if _user = auth.uid() then raise exception 'You cannot grant access to yourself'; end if;
  insert into public.portal_grants (user_id, role, project_id, expires_at, note, granted_by)
  values (_user, _role, _project, _expires, coalesce(_note, ''), auth.uid())
  on conflict (user_id, role, project_id) do update set expires_at = excluded.expires_at, note = excluded.note, granted_by = excluded.granted_by
  returning id into gid;
  select name into pname from public.projects where id = _project;
  perform public.notify(_user, 'New portal access',
    'You can now open the ' || replace(_role::text, '_', ' ') || ' portal' || coalesce(' for ' || pname, '') || '. Switch portals from the top of the app.', '/app', 'info');
  return gid;
end;
$$;

create or replace function public.revoke_portal(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_grant_portals() then raise exception 'Only the Boss or GM/CFO can remove portal access'; end if;
  delete from public.portal_grants where id = _id;
end;
$$;
revoke execute on function public.grant_portal(uuid, public.app_role, uuid, date, text) from anon;
revoke execute on function public.revoke_portal(uuid) from anon;

-- Every portal the signed-in person can switch between, with the project it is limited to (null = whole company).
-- Derived portals: a project lead_id gets Project Lead for that project; the driver of an open trip gets Driver.
create or replace function public.my_portals()
returns table (role public.app_role, project_id uuid, source text)
language sql stable security definer set search_path = public as $$
  select distinct x.role, null::uuid, 'role' from public.user_roles r, unnest(public.implied_roles(r.role)) as x(role) where r.user_id = auth.uid()
  union
  select g.role, g.project_id, 'grant' from public.portal_grants g
    where g.user_id = auth.uid() and (g.expires_at is null or g.expires_at >= current_date)
  union
  select 'project_lead'::public.app_role, p.id, 'lead' from public.projects p
    where p.lead_id = auth.uid() and p.stage <> 'Archive' and not public.has_role(auth.uid(), 'project_lead')
  union
  select 'driver'::public.app_role, t.project_id, 'trip' from public.trips t
    where t.driver_id = auth.uid() and t.stage <> 'Returned' and not public.has_role(auth.uid(), 'driver');
$$;
revoke execute on function public.my_portals() from anon;

-- Let the GM/CFO and Boss read the user list (to give portal access); Super Admin still changes base roles.
create or replace function public.admin_list_users()
returns table (id uuid, email text, full_name text, phone text, roles public.app_role[], created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select u.id, u.email::text, coalesce(p.full_name, ''), coalesce(p.phone, ''),
         coalesce(array_agg(r.role) filter (where r.role is not null), '{}'), u.created_at
  from auth.users u left join public.profiles p on p.id = u.id left join public.user_roles r on r.user_id = u.id
  where public.has_role(auth.uid(), 'super_admin') or public.can_grant_portals()
  group by u.id, p.full_name, p.phone order by u.created_at;
$$;

-- Effective company-wide roles of a person (implied roles + unexpired company-wide grants).
create or replace function public.effective_roles(_user uuid)
returns public.app_role[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct x), '{}') from (
    select unnest(public.implied_roles(r.role)) x from public.user_roles r where r.user_id = _user
    union select g.role from public.portal_grants g where g.user_id = _user and g.project_id is null and (g.expires_at is null or g.expires_at >= current_date)
  ) s;
$$;
revoke execute on function public.effective_roles(uuid) from anon;

-- Staff directory roles are effective roles (so pickers like "choose a driver" find the GM's implied roles and grants).
create or replace view public.staff_directory with (security_invoker = true) as
  select p.id, p.full_name, p.phone, p.avatar_url, p.division_id, public.effective_roles(p.id) as roles
  from public.profiles p;
