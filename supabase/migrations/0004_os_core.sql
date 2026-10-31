-- Basil Media OS · 0004 core services shared by every module:
-- notifications, key/value settings, staff directory, role administration.

-- Settings (approval limits, statutory rates, numbering, quiet hours…). Nothing hardcoded in the app.
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
alter table public.app_settings enable row level security;
create policy "staff read settings" on public.app_settings for select to authenticated using (exists (select 1 from public.user_roles where user_id = auth.uid()));
create policy "super admin writes settings" on public.app_settings for all to authenticated using (public.has_role(auth.uid(), 'super_admin')) with check (public.has_role(auth.uid(), 'super_admin'));
create trigger audit_app_settings after insert or update or delete on public.app_settings for each row execute function public.audit_row();

insert into public.app_settings (key, value) values
  ('approval_limits', '{"gm_cfo_alone_below": 50000, "boss_required_from": 50000, "gm_cfo_daily_cap": 1000000}'),
  ('currency', '"TSH"'),
  ('vat_rate', '18'),
  ('statutory_rates', '{"nssf_employee": 10, "nssf_employer": 10, "wcf": 0.5, "sdl": 3.5, "paye_bands": [[270000, 0], [520000, 8], [760000, 20], [1000000, 25], [null, 30]]}'),
  ('quiet_hours', '{"from": "21:00", "to": "06:00"}'),
  ('numbering', '{"invoice": "BM-INV-{YYYY}-{0000}", "quotation": "BM-QUO-{YYYY}-{0000}", "request": "BM-REQ-{0000}", "receipt": "BM-RCT-{YYYY}-{0000}"}'),
  ('retirement_days', '3'),
  ('block_on_unretired', 'true')
on conflict (key) do nothing;

-- In-app notifications (push/SMS/WhatsApp channels attach to this later).
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null default '',
  link text not null default '',
  kind text not null default 'info' check (kind in ('info', 'approval', 'money', 'task', 'alert')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "mark own read" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.notify(_user uuid, _title text, _body text default '', _link text default '', _kind text default 'info')
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, title, body, link, kind) values (_user, _title, _body, _link, _kind);
$$;

-- Notify everyone holding a role.
create or replace function public.notify_role(_role public.app_role, _title text, _body text default '', _link text default '', _kind text default 'info')
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, title, body, link, kind)
  select distinct user_id, _title, _body, _link, _kind from public.user_roles where role = _role or role = 'super_admin';
$$;
revoke execute on function public.notify(uuid, text, text, text, text) from anon;
revoke execute on function public.notify_role(public.app_role, text, text, text, text) from anon;

-- Staff directory: every staff member can see names/phones of colleagues (needed to assign work).
create policy "staff directory" on public.profiles for select to authenticated
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role <> 'client'));
create policy "leaders read roles" on public.user_roles for select to authenticated
  using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo']::public.app_role[]));

create or replace view public.staff_directory with (security_invoker = true) as
  select p.id, p.full_name, p.phone, p.avatar_url, p.division_id,
         coalesce(array_agg(r.role) filter (where r.role is not null), '{}') as roles
  from public.profiles p left join public.user_roles r on r.user_id = p.id
  group by p.id;

-- Super Admin grants or revokes a role by email.
create or replace function public.admin_set_role(_email text, _role public.app_role, _grant boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.has_role(auth.uid(), 'super_admin') then raise exception 'Only the Super Admin can change roles'; end if;
  select id into uid from auth.users where lower(email) = lower(_email);
  if uid is null then raise exception 'No account with email %', _email; end if;
  if _grant then
    insert into public.user_roles (user_id, role, granted_by) values (uid, _role, auth.uid()) on conflict do nothing;
    perform public.notify(uid, 'New access granted', 'You can now use the ' || _role || ' portal.', '/app', 'info');
  else
    if _role = 'super_admin' and (select count(*) from public.user_roles where role = 'super_admin') <= 1 then
      raise exception 'There must always be at least one Super Admin';
    end if;
    delete from public.user_roles where user_id = uid and role = _role;
  end if;
end;
$$;

create or replace function public.admin_list_users()
returns table (id uuid, email text, full_name text, phone text, roles public.app_role[], created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select u.id, u.email::text, coalesce(p.full_name, ''), coalesce(p.phone, ''),
         coalesce(array_agg(r.role) filter (where r.role is not null), '{}'), u.created_at
  from auth.users u left join public.profiles p on p.id = u.id left join public.user_roles r on r.user_id = u.id
  where public.has_role(auth.uid(), 'super_admin')
  group by u.id, p.full_name, p.phone order by u.created_at;
$$;
