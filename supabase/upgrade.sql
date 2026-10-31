-- Basil Media OS · UPGRADE for a database that already ran supabase/setup.sql before.
-- Safe to run more than once. Contains: 0011_portal_access.sql, 0012_calendar.sql, 0013_proforma.sql, 0014_rls_fixes.sql, 0015_proposal_log.sql, 0016_video_orientation.sql, 0017_health_feed.sql

-- ===================== 0011_portal_access.sql =====================
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

create table if not exists public.portal_grants (
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
do $$ begin if not exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'portal_grants' and indexdef like '%(user_id)%') then create index on public.portal_grants (user_id); end if; end $$;
do $$ begin if not exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'portal_grants' and indexdef like '%(project_id)%') then create index on public.portal_grants (project_id); end if; end $$;

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
drop policy if exists "see own or manage grants" on public.portal_grants;
create policy "see own or manage grants" on public.portal_grants for select to authenticated
  using (user_id = auth.uid() or public.can_grant_portals());
drop policy if exists "leaders add grants" on public.portal_grants;
create policy "leaders add grants" on public.portal_grants for insert to authenticated
  with check (public.can_grant_portals() and granted_by = auth.uid());
drop policy if exists "leaders change grants" on public.portal_grants;
create policy "leaders change grants" on public.portal_grants for update to authenticated
  using (public.can_grant_portals()) with check (public.can_grant_portals());
drop policy if exists "leaders remove grants" on public.portal_grants;
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

-- ===================== 0012_calendar.sql =====================
-- Basil Media OS · 0012 shared calendar.
-- 1. calendar_events: custom events any staff member can add (meetings, client reviews, office holidays…).
-- 2. calendar_feed(): one security-definer read of the shared company layers (projects, shoots, retainer
--    visits, trips, rooms, growth events, leave) trimmed to calendar fields only, so every staff role sees
--    the shared calendar without being granted budgets, reasons or other row detail. Clients get only their
--    own client's projects, shoots and retainer schedule. Finance due dates stay under 0006's RLS.

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  title text not null check (length(btrim(title)) > 0),
  description text not null default '',
  location text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  color text not null default '' check (color = '' or color ~ '^#[0-9A-Fa-f]{6}$'),
  project_id uuid references public.projects (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  attendees uuid[] not null default '{}',
  visibility text not null default 'staff' check (visibility in ('everyone', 'staff', 'private')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at)
);
do $$ begin if not exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'calendar_events' and indexdef like '%(starts_at)%') then create index on public.calendar_events (starts_at); end if; end $$;
do $$ begin if not exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'calendar_events' and indexdef like '%(ends_at)%') then create index on public.calendar_events (ends_at); end if; end $$;
do $$ begin if not exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'calendar_events' and indexdef like '%(client_id)%') then create index on public.calendar_events (client_id); end if; end $$;
do $$ begin if not exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'calendar_events' and indexdef like '%(project_id)%') then create index on public.calendar_events (project_id); end if; end $$;
do $$ begin if not exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'calendar_events' and indexdef like '%(created_by)%') then create index on public.calendar_events (created_by); end if; end $$;
create index on public.calendar_events using gin (attendees);
drop trigger if exists touch_calendar_events on public.calendar_events;
create trigger touch_calendar_events before update on public.calendar_events for each row execute function public.touch_updated_at();
drop trigger if exists audit_calendar_events on public.calendar_events;
create trigger audit_calendar_events after insert or update or delete on public.calendar_events for each row execute function public.audit_row();

alter table public.calendar_events enable row level security;

-- Staff see company-wide ('everyone') and staff events; anyone sees events they created or were invited to;
-- clients see 'everyone' events tagged with their own client.
drop policy if exists "read calendar events" on public.calendar_events;
create policy "read calendar events" on public.calendar_events for select to authenticated using (
  (public.is_staff() and visibility in ('everyone', 'staff'))
  or created_by = auth.uid()
  or auth.uid() = any (attendees)
  or (visibility = 'everyone' and client_id in (select public.my_client_ids()))
);
drop policy if exists "staff add calendar events" on public.calendar_events;
create policy "staff add calendar events" on public.calendar_events for insert to authenticated
  with check (public.is_staff() and created_by = auth.uid());
drop policy if exists "organiser or leaders edit calendar events" on public.calendar_events;
create policy "organiser or leaders edit calendar events" on public.calendar_events for update to authenticated
  using (created_by = auth.uid() or public.has_any_role(auth.uid(), array['boss', 'gm_cfo']::public.app_role[]))
  with check (created_by = auth.uid() or public.has_any_role(auth.uid(), array['boss', 'gm_cfo']::public.app_role[]));
drop policy if exists "organiser or leaders delete calendar events" on public.calendar_events;
create policy "organiser or leaders delete calendar events" on public.calendar_events for delete to authenticated
  using (created_by = auth.uid() or public.has_any_role(auth.uid(), array['boss', 'gm_cfo']::public.app_role[]));

-- ---------- shared feed ----------
create or replace function public.calendar_feed(_from date default current_date - 400, _to date default current_date + 400)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  staff boolean := public.is_staff();
  cids uuid[] := array(select public.my_client_ids());
begin
  if auth.uid() is null or (not staff and coalesce(array_length(cids, 1), 0) = 0) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'clients', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name)), '[]'::jsonb)
      from public.clients c where staff or c.id = any (cids)),
    'projects', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'code', p.code, 'name', p.name, 'client_id', p.client_id, 'service', p.service, 'stage', p.stage,
        'lead_id', p.lead_id, 'start_date', p.start_date, 'end_date', p.end_date, 'location', p.location)), '[]'::jsonb)
      from public.projects p
      where (staff or p.client_id = any (cids))
        and coalesce(p.end_date, p.start_date) >= _from and coalesce(p.start_date, p.end_date) <= _to),
    'shoots', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'project_id', s.project_id, 'title', s.title, 'shoot_date', s.shoot_date, 'call_time', s.call_time,
        'wrap_time', s.wrap_time, 'location', s.location, 'status', s.status,
        'contact_name', case when staff then s.contact_name else '' end, 'contact_phone', case when staff then s.contact_phone else '' end)), '[]'::jsonb)
      from public.shoots s join public.projects p on p.id = s.project_id
      where (staff or p.client_id = any (cids)) and s.shoot_date between _from and _to),
    'shoot_crew', (select coalesce(jsonb_agg(jsonb_build_object('shoot_id', sc.shoot_id, 'user_id', sc.user_id, 'role', sc.role)), '[]'::jsonb)
      from public.shoot_crew sc join public.shoots s on s.id = sc.shoot_id
      where staff and s.shoot_date between _from and _to),
    'retainer_calendar', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'retainer_id', r.retainer_id, 'client_id', r.client_id, 'project_id', r.project_id, 'date', r.date, 'time', r.time,
        'kind', r.kind, 'title', r.title, 'location', r.location, 'map_url', r.map_url, 'status', r.status, 'crew', r.crew,
        'call_time', r.call_time, 'link', r.link)), '[]'::jsonb)
      from public.retainer_calendar r
      where (staff or r.client_id = any (cids)) and r.date between _from and _to),
    'trips', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'driver_id', t.driver_id, 'project_id', t.project_id, 'purpose', t.purpose, 'origin', t.origin,
        'destination', t.destination, 'depart_at', t.depart_at, 'return_at', t.return_at, 'stage', t.stage, 'passengers', t.passengers)), '[]'::jsonb)
      from public.trips t
      where staff and t.depart_at::date between _from and _to),
    'room_bookings', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', b.id, 'room', b.room, 'date', b.date, 'start_hour', b.start_hour, 'end_hour', b.end_hour, 'title', b.title,
        'booked_by', b.booked_by, 'status', b.status)), '[]'::jsonb)
      from public.room_bookings b
      where staff and b.status = 'booked' and b.date between _from and _to),
    'growth_events', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', g.id, 'title', g.title, 'kind', g.kind, 'starts_on', g.starts_on, 'ends_on', g.ends_on, 'location', g.location,
        'role', g.role, 'owner_id', g.owner_id)), '[]'::jsonb)
      from public.growth_events g
      where staff and g.ends_on >= _from and g.starts_on <= _to),
    -- Who is away: dates and status only (no reason or decision note).
    'leave_requests', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'user_id', l.user_id, 'leave_type', l.leave_type, 'start_date', l.start_date, 'end_date', l.end_date,
        'days', l.days, 'status', l.status)), '[]'::jsonb)
      from public.leave_requests l
      where staff and l.status in ('Approved', 'Pending') and l.end_date >= _from and l.start_date <= _to)
  );
end;
$$;
revoke execute on function public.calendar_feed(date, date) from public, anon;
grant execute on function public.calendar_feed(date, date) to authenticated;

-- ===================== 0013_proforma.sql =====================
-- Basil Media OS · 0013 Proforma invoices
-- A proforma sits between the quotation and the tax invoice: quotation → proforma → invoice.
-- It is not a tax document (no VAT liability, no receivable); it lets the client raise a PO or
-- pay a deposit before the real invoice exists. Same shape as public.quotations (jsonb line items).
-- Owner rule: money documents (quotations, proformas, invoices) all sit with the GM/CFO,
-- who can also create, convert and record payments. Finance keeps its existing rights.
-- Runs after 0006 (quotations, invoices, next_doc_number, doc_total) and 0005 (clients, projects).

-- ---------------------------------------------------------------- numbering
-- Adds the proforma series to the numbering setting (kept if an admin already set one).
update public.app_settings
   set value = jsonb_build_object('proforma', 'BM-PF-{YYYY}-{0000}') || value
 where key = 'numbering' and not (value ? 'proforma');

-- ---------------------------------------------------------------- table
create table if not exists public.proformas (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  number text unique,
  client_id uuid references public.clients (id),
  project_id uuid references public.projects (id),
  quotation_id uuid references public.quotations (id),
  prospect text not null default '',
  title text not null default '',
  items jsonb not null default '[]', -- [{title, detail, qty, unit_price}]
  discount numeric(14, 2) not null default 0,
  vat_on boolean not null default true,
  vat_rate numeric(5, 2) not null default 18,
  issue_date date not null default current_date,
  valid_until date not null default (current_date + 30),
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'expired', 'cancelled')),
  sent_at timestamptz,
  accepted_at timestamptz,
  cancelled_at timestamptz,
  invoice_id uuid references public.invoices (id),
  notes text not null default '',
  terms text not null default '',
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
create index if not exists proformas_quotation_idx on public.proformas (quotation_id);
create index if not exists proformas_client_idx on public.proformas (client_id);

alter table public.invoices add column if not exists proforma_id uuid references public.proformas (id);
create index if not exists invoices_proforma_idx on public.invoices (proforma_id);

create or replace function public.number_proforma()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.number is null or new.number = '' then
    new.number := public.next_doc_number('proforma');
  end if;
  return new;
end;
$$;
drop trigger if exists number_proformas on public.proformas;
create trigger number_proformas before insert on public.proformas for each row execute function public.number_proforma();

-- ---------------------------------------------------------------- RLS (mirrors quotations)
alter table public.proformas enable row level security;
drop policy if exists "sales roles read proformas" on public.proformas;
create policy "sales roles read proformas" on public.proformas for select to authenticated
  using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance', 'account_manager', 'growth']::public.app_role[]));
drop policy if exists "sales roles write proformas" on public.proformas;
create policy "sales roles write proformas" on public.proformas for all to authenticated
  using (public.has_any_role(auth.uid(), array['gm_cfo', 'finance', 'account_manager']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['gm_cfo', 'finance', 'account_manager']::public.app_role[]));

-- The GM/CFO owns all money documents, so they may also record a client payment against an invoice
-- (0006 allowed Finance only). The receipt number, income posting and status still come from the 0006 triggers.
drop policy if exists "gm records payments" on public.invoice_payments;
create policy "gm records payments" on public.invoice_payments for insert to authenticated
  with check (public.has_role(auth.uid(), 'gm_cfo'));

drop trigger if exists audit_proformas on public.proformas;
create trigger audit_proformas after insert or update or delete on public.proformas for each row execute function public.audit_row();

-- ---------------------------------------------------------------- workflow
-- Quotation → proforma: copies client, project, lines, discount and VAT; marks the quotation accepted.
create or replace function public.convert_quotation_to_proforma(_quotation_id uuid, _valid_until date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); q public.quotations; pid uuid;
begin
  if not public.has_any_role(me, array['gm_cfo', 'finance', 'boss']::public.app_role[]) then
    raise exception 'Only the GM/CFO or Finance can raise a proforma';
  end if;
  select * into q from public.quotations where id = _quotation_id for update;
  if not found then raise exception 'Quotation not found'; end if;
  if q.status not in ('sent', 'viewed', 'accepted') then raise exception 'Only a sent or accepted quotation can become a proforma (this one is %)', q.status; end if;
  if q.invoice_id is not null then raise exception 'This quotation is already invoiced'; end if;
  if exists (select 1 from public.proformas where quotation_id = q.id and status <> 'cancelled') then
    raise exception 'This quotation already has a proforma';
  end if;
  if jsonb_array_length(q.items) = 0 then raise exception 'The quotation has no line items'; end if;
  insert into public.proformas (client_id, project_id, quotation_id, prospect, title, items, discount, vat_on, vat_rate, issue_date, valid_until, notes, terms, created_by)
  values (q.client_id, q.project_id, q.id, q.prospect, q.title, q.items, q.discount, q.vat_on, q.vat_rate, current_date,
          coalesce(_valid_until, current_date + 30), q.notes, 'Payment by bank transfer or mobile money. Quote the proforma number as reference.', me)
  returning id into pid;
  update public.quotations set status = 'accepted', accepted_at = coalesce(accepted_at, now()) where id = q.id;
  return pid;
end;
$$;

-- Proforma → tax invoice: creates the real invoice (proforma_id + quotation_id linked, lines copied,
-- 50/50 deposit schedule) and marks the proforma accepted.
create or replace function public.convert_proforma_to_invoice(_id uuid, _due_date date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); p public.proformas; iid uuid; total numeric; due date := coalesce(_due_date, current_date + 14);
begin
  if not public.has_any_role(me, array['gm_cfo', 'finance', 'boss']::public.app_role[]) then
    raise exception 'Only the GM/CFO or Finance can raise an invoice';
  end if;
  select * into p from public.proformas where id = _id for update;
  if not found then raise exception 'Proforma not found'; end if;
  if p.invoice_id is not null then raise exception 'This proforma is already invoiced'; end if;
  if p.status not in ('sent', 'accepted') then raise exception 'Send the proforma before invoicing it (this one is %)', p.status; end if;
  if p.client_id is null then raise exception 'Add % as a client before invoicing', coalesce(nullif(p.prospect, ''), 'the prospect'); end if;
  if jsonb_array_length(p.items) = 0 then raise exception 'The proforma has no line items'; end if;
  total := public.doc_total(p.items, p.discount, p.vat_on, p.vat_rate);
  insert into public.invoices (client_id, project_id, quotation_id, proforma_id, title, items, discount, vat_on, vat_rate, deposit, schedule, issue_date, due_date, status, notes, terms, created_by)
  values (p.client_id, p.project_id, p.quotation_id, p.id, p.title, p.items, p.discount, p.vat_on, p.vat_rate, round(total / 2),
          jsonb_build_array(jsonb_build_object('label', 'Deposit', 'pct', 50, 'due', due), jsonb_build_object('label', 'On delivery', 'pct', 50, 'due', due + 31)),
          current_date, due, 'draft', p.notes, p.terms, me)
  returning id into iid;
  update public.proformas set status = 'accepted', accepted_at = coalesce(accepted_at, now()), invoice_id = iid where id = p.id;
  if p.quotation_id is not null then
    update public.quotations set invoice_id = iid where id = p.quotation_id and invoice_id is null;
  end if;
  return iid;
end;
$$;

-- Daily job: 0006's overdue/expiry sweep, now also expiring proformas past their validity.
create or replace function public.mark_overdue_finance()
returns void language sql security definer set search_path = public as $$
  update public.invoices set status = 'overdue' where status in ('sent', 'viewed', 'partially_paid') and due_date < current_date
    and coalesce((select sum(amount) from public.invoice_payments p where p.invoice_id = invoices.id), 0) < public.doc_total(items, discount, vat_on, vat_rate);
  update public.quotations set status = 'expired' where status in ('draft', 'sent', 'viewed') and valid_until < current_date;
  update public.proformas set status = 'expired' where status in ('draft', 'sent') and valid_until < current_date and invoice_id is null;
$$;
revoke execute on function public.mark_overdue_finance() from public, anon, authenticated;

revoke execute on function public.convert_quotation_to_proforma(uuid, date) from public, anon;
revoke execute on function public.convert_proforma_to_invoice(uuid, date) from public, anon;
grant execute on function public.convert_quotation_to_proforma(uuid, date), public.convert_proforma_to_invoice(uuid, date) to authenticated;

-- ===================== 0014_rls_fixes.sql =====================
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
drop policy if exists "see shoots" on public.shoots;
create policy "see shoots" on public.shoots for select to authenticated
  using (public.can_see_project(project_id) or public.is_on_shoot(id));
drop policy if exists "crew update shoots" on public.shoots;
drop policy if exists "crew update shoots" on public.shoots;
create policy "crew update shoots" on public.shoots for update to authenticated
  using (public.is_on_shoot(id));

drop policy if exists "see shoot crew" on public.shoot_crew;
drop policy if exists "see shoot crew" on public.shoot_crew;
create policy "see shoot crew" on public.shoot_crew for select to authenticated
  using (user_id = auth.uid() or public.can_see_project(public.shoot_project(shoot_id)));
drop policy if exists "manage shoot crew" on public.shoot_crew;
drop policy if exists "manage shoot crew" on public.shoot_crew;
create policy "manage shoot crew" on public.shoot_crew for all to authenticated
  using (public.can_manage_project(public.shoot_project(shoot_id)))
  with check (public.can_manage_project(public.shoot_project(shoot_id)));

-- ===================== 0015_proposal_log.sql =====================
-- Basil Media OS · 0015 proposals as a simple log.
-- Proposals are written outside the app (Word/PDF). The app only records that one was sent, to whom,
-- for how much, the file, and where it stands: Sent → Working on it → Interested → Won / Lost.
alter table public.proposals
  add column if not exists stage text not null default 'Sent',
  add column if not exists amount numeric(14, 2) not null default 0,
  add column if not exists file_url text not null default '',
  add column if not exists note text not null default '',
  add column if not exists stage_at timestamptz not null default now();
do $$ begin
  alter table public.proposals add constraint proposals_stage_check check (stage in ('Sent', 'Working on it', 'Interested', 'Won', 'Lost'));
exception when duplicate_object then null; end $$;
alter table public.proposals alter column number set default ('BM-PRP-' || to_char(now(), 'YYYY') || '-' || upper(substr(md5(random()::text), 1, 5)));
alter table public.proposals alter column status set default 'sent';
alter table public.proposals alter column sent_at set default now();

-- ===================== 0016_video_orientation.sql =====================
-- Basil Media OS · 0016 video orientation for the homepage "work at a glance" section.
-- 'auto' guesses from the link (Instagram reels / YouTube Shorts = portrait, others = landscape).
alter table public.projects add column if not exists orientation text not null default 'auto' check (orientation in ('auto', 'portrait', 'landscape'));
alter table public.highlights add column if not exists orientation text not null default 'auto' check (orientation in ('auto', 'portrait', 'landscape'));

-- ===================== 0017_health_feed.sql =====================
-- Basil Media OS · 0017 live health news feed.
-- One fetcher (api/news-ingest.mjs, daily on the host; or `node scripts/news-ingest.mjs`) reads the enabled
-- sources below, keeps health items, sorts them by zone and flags outbreaks / emergencies as critical.
-- Visitors read; website editors manage sources and can hide an item; only the service key writes items.

create table if not exists public.news_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null unique,
  format text not null default 'rss' check (format in ('rss', 'who_don')),
  zone text not null default 'world' check (zone in ('tanzania', 'east_africa', 'africa', 'world')),
  health_only boolean not null default false, -- general news site: keep only health stories
  enabled boolean not null default true,
  last_fetched_at timestamptz,
  last_error text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.health_feed_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.news_sources (id) on delete cascade,
  source_name text not null default '',
  title text not null,
  summary text not null default '',
  url text not null unique,
  zone text not null default 'world' check (zone in ('tanzania', 'east_africa', 'africa', 'world')),
  published_at timestamptz not null default now(),
  critical boolean not null default false,
  critical_reason text not null default '',
  hidden boolean not null default false,
  fetched_at timestamptz not null default now()
);
create index if not exists health_feed_items_pub on public.health_feed_items (published_at desc);
create index if not exists health_feed_items_zone on public.health_feed_items (zone, published_at desc);

alter table public.news_sources enable row level security;
alter table public.health_feed_items enable row level security;
drop policy if exists "public reads sources" on public.news_sources;
drop policy if exists "public reads sources" on public.news_sources;
create policy "public reads sources" on public.news_sources for select using (enabled or public.is_cms_editor());
drop policy if exists "editors manage sources" on public.news_sources;
drop policy if exists "editors manage sources" on public.news_sources;
create policy "editors manage sources" on public.news_sources for all to authenticated using (public.is_cms_editor()) with check (public.is_cms_editor());
drop policy if exists "public reads feed" on public.health_feed_items;
drop policy if exists "public reads feed" on public.health_feed_items;
create policy "public reads feed" on public.health_feed_items for select using (not hidden or public.is_cms_editor());
drop policy if exists "editors moderate feed" on public.health_feed_items;
drop policy if exists "editors moderate feed" on public.health_feed_items;
create policy "editors moderate feed" on public.health_feed_items for update to authenticated using (public.is_cms_editor()) with check (public.is_cms_editor());
grant select on public.news_sources, public.health_feed_items to anon, authenticated;

-- Sources that were checked to serve a working feed. Tanzania's Ministry of Health has no feed;
-- Tanzania news comes from ReliefWeb, AllAfrica and Daily News (health stories only).
insert into public.news_sources (name, url, format, zone, health_only) values
  ('ReliefWeb · Tanzania', 'https://reliefweb.int/updates/rss.xml?search=primary_country.iso3:tza', 'rss', 'tanzania', true),
  ('AllAfrica · Tanzania', 'https://allafrica.com/tools/headlines/rdf/tanzania/headlines.rdf', 'rss', 'tanzania', true),
  ('Daily News Tanzania', 'https://dailynews.co.tz/feed/', 'rss', 'tanzania', true),
  ('WHO Africa', 'https://www.afro.who.int/rss.xml', 'rss', 'africa', false),
  ('Africa CDC', 'https://africacdc.org/news-item/feed/', 'rss', 'africa', false),
  ('AllAfrica · Health', 'https://allafrica.com/tools/headlines/rdf/health/headlines.rdf', 'rss', 'africa', false),
  ('ReliefWeb · Epidemics', 'https://reliefweb.int/disasters/rss.xml?search=type.exact:Epidemic', 'rss', 'world', false),
  ('WHO Disease Outbreak News', 'https://www.who.int/api/news/diseaseoutbreaknews?sf_culture=en&$orderby=PublicationDateAndTime%20desc&$top=20', 'who_don', 'world', false),
  ('WHO News', 'https://www.who.int/rss-feeds/news-english.xml', 'rss', 'world', false),
  ('Health Policy Watch', 'https://healthpolicy-watch.news/feed/', 'rss', 'world', false),
  ('MSF', 'https://www.msf.org/rss/all', 'rss', 'world', false),
  ('The Lancet', 'https://www.thelancet.com/rssfeed/langlo_current.xml', 'rss', 'world', false)
on conflict (url) do nothing;

