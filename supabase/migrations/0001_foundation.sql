-- Basil Media OS · 0001 foundation
-- Roles live in their own table (never on the profile), checked by a SECURITY DEFINER function.
-- The very first account becomes Super Admin; afterwards only the Super Admin grants roles.

create extension if not exists pgcrypto;

create type public.app_role as enum (
  'super_admin', 'boss', 'gm_cfo', 'finance', 'project_lead', 'staff', 'storekeeper',
  'growth', 'account_manager', 'receptionist', 'driver', 'client'
);

-- Divisions: every business record carries a division_id from day one (Basil Media first).
create table public.divisions (
  id text primary key,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.divisions (id, name) values ('basil-media', 'Basil Media');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  language text not null default 'en' check (language in ('en', 'sw')),
  avatar_url text not null default '',
  division_id text not null default 'basil-media' references public.divisions (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create or replace function public.has_role(_user uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user and (role = _role or role = 'super_admin'));
$$;

create or replace function public.has_any_role(_user uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user and (role = any(_roles) or role = 'super_admin'));
$$;

-- Website CMS editors: Super Admin, GM/CFO and Growth.
create or replace function public.is_cms_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_any_role(auth.uid(), array['gm_cfo', 'growth']::public.app_role[]);
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  -- Lock prevents two simultaneous first sign-ups both becoming Super Admin.
  lock table public.user_roles in share row exclusive mode;
  if not exists (select 1 from public.user_roles) then
    insert into public.user_roles (user_id, role) values (new.id, 'super_admin');
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.divisions enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

create policy "divisions readable by signed-in users" on public.divisions for select to authenticated using (true);
create policy "super admin manages divisions" on public.divisions for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin')) with check (public.has_role(auth.uid(), 'super_admin'));

create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid() or public.has_any_role(auth.uid(), array['boss', 'gm_cfo']::public.app_role[]));
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "super admin edits profiles" on public.profiles for update to authenticated using (public.has_role(auth.uid(), 'super_admin'));

create policy "see own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'));
create policy "super admin grants roles" on public.user_roles for insert to authenticated with check (public.has_role(auth.uid(), 'super_admin'));
create policy "super admin revokes roles" on public.user_roles for delete to authenticated using (public.has_role(auth.uid(), 'super_admin'));

-- Immutable audit trail: who, what, when, old value, new value. No update/delete policy exists.
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid default auth.uid(),
  table_name text not null,
  record_id text,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_value jsonb,
  new_value jsonb
);
alter table public.audit_log enable row level security;
create policy "leaders read audit log" on public.audit_log for select to authenticated
  using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo']::public.app_role[]));

create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (table_name, record_id, action, old_value, new_value)
  values (
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id', ''),
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_user_roles after insert or update or delete on public.user_roles for each row execute function public.audit_row();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger touch_profiles before update on public.profiles for each row execute function public.touch_updated_at();
