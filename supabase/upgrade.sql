-- Basil Media OS · UPGRADE for a database that already ran supabase/setup.sql before.
-- Safe to run more than once. Contains: 0011_portal_access.sql, 0012_calendar.sql, 0013_proforma.sql, 0014_rls_fixes.sql, 0015_proposal_log.sql, 0016_video_orientation.sql, 0017_health_feed.sql, 0018_sample_data.sql, 0019_service_photos.sql, 0020_brand_and_team_photos.sql, 0021_partners_ceo_news_meta.sql, 0022_instagram_reels.sql, 0023_hero_video.sql, 0024_health_events.sql, 0025_contact_number.sql, 0026_partner_logos.sql, 0028_youtube_only_and_real_news.sql, 0029_partner_names.sql, 0030_news_refresh_schedule.sql, 0031_verified_news_sources.sql, 0032_more_partner_logos.sql

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

-- ===================== 0018_sample_data.sql =====================
-- Basil Media OS · 0018 curated sample data, so every portal opens with realistic work to look at and edit.
-- • Every sample row has an id starting with b5a5e000- — remove them all at once with supabase/remove-sample-data.sql.
-- • Safe to run more than once (on conflict do nothing).
-- • Work is given to the people who already hold each role (Project Lead, Storekeeper, Driver …); if a role has
--   nobody yet, the GM/CFO or Boss is used, and rows that need a person are skipped when there are no accounts.
-- • Dates are relative to the day you run it, so the calendar, overdue invoices and "this week" look current.

create or replace function pg_temp.sid(n int) returns uuid language sql immutable as $$
  select ('b5a5e000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create or replace function pg_temp.who(_role public.app_role) returns uuid language sql stable as $$
  select coalesce(
    (select user_id from public.user_roles where role = _role order by created_at limit 1),
    (select user_id from public.user_roles where role = 'gm_cfo' order by created_at limit 1),
    (select user_id from public.user_roles where role = 'boss' order by created_at limit 1),
    (select user_id from public.user_roles where role = 'super_admin' order by created_at limit 1));
$$;
create or replace function pg_temp.items(variadic x text[]) returns jsonb language sql immutable as $$
  -- items('Title|detail|qty|unit price', …) → [{title, detail, qty, unit_price}]
  select coalesce(jsonb_agg(jsonb_build_object('title', split_part(v, '|', 1), 'detail', split_part(v, '|', 2),
    'qty', split_part(v, '|', 3)::numeric, 'unit_price', split_part(v, '|', 4)::numeric)), '[]') from unnest(x) v;
$$;

-- =========================================================== WEBSITE
-- All services (same as the starter set) — added again only if missing.
insert into public.services (title, slug, short, description, deliverables, icon, image_url, video_url, sort_order, published) values
  ('Video Production', 'video-production', 'Films, documentaries and campaign spots.', 'Documentaries, corporate films and campaign spots, from script and casting to colour grade and subtitles in English and Kiswahili.', array['Script & storyboard', 'Shoot crew', 'Edit & colour', 'Subtitles EN / SW']::text[], 'video', '', '', 1, true),
  ('Photography', 'photography', 'Events, portraits and private client galleries.', 'Events, portraits and product photography delivered in private galleries with selfie Find Me, favourites and HD downloads.', array['Event coverage', 'Private gallery', 'Find Me by selfie', 'QR poster']::text[], 'camera', '', '', 2, true),
  ('Podcast Production', 'podcast-production', 'Studio and remote series, video and audio.', 'Video and audio podcasts, recorded in studio or on location, edited and published to every platform.', array['Studio recording', 'Multi-camera', 'Clips for social', 'Publishing']::text[], 'mic', '', '', 3, true),
  ('Live Streaming', 'live-streaming', 'Conferences and launches, streamed live.', 'Multi-camera live streams for conferences, launches and graduations, with graphics, remote guests and recordings.', array['Multi-camera', 'Lower thirds', 'YouTube / Facebook / Zoom', 'Same-day recording']::text[], 'radio', '', '', 4, true),
  ('Event Coverage', 'event-coverage', 'Photo, video and same-day highlights.', 'Photo and video teams for conferences, launches and ceremonies, with same-day highlight reels for social media.', array['Photo + video team', 'Same-day reel', 'Speaker interviews', 'Gallery in 48 h']::text[], 'calendar', '', '', 5, true),
  ('Corporate Content', 'corporate-content', 'Monthly content for brands and institutions.', 'A monthly retainer of reels, posts, photos and short films for hospitals, banks, NGOs and companies.', array['Monthly content plan', 'Reels & posts', 'Edited photos', 'Monthly report']::text[], 'briefcase', '', '', 6, true),
  ('Health Communication', 'health-communication', 'Health campaigns people understand.', 'Health education films, explainers and campaigns made with clinicians, in English and Kiswahili.', array['Clinical review', 'Explainers', 'Patient stories', 'Campaign assets']::text[], 'heart', '', '', 7, true)
on conflict (slug) do nothing;

insert into public.partners (id, name, logo_url, website, sort_order) values
  (pg_temp.sid(1), 'Muhimbili National Hospital', '', 'https://www.mnh.or.tz', 1),
  (pg_temp.sid(2), 'Medical Association of Tanzania', '', 'https://mat-tz.org', 2),
  (pg_temp.sid(3), 'Muhimbili University (MUHAS)', '', 'https://www.muhas.ac.tz', 3),
  (pg_temp.sid(4), 'Aga Khan Hospital, Dar es Salaam', '', 'https://hospitals.aku.edu/dar-es-salaam', 4),
  (pg_temp.sid(5), 'Benjamin Mkapa Foundation', '', 'https://mkapafoundation.or.tz', 5),
  (pg_temp.sid(6), 'Pharmaceutical Society of Tanzania', '', '', 6)
on conflict (id) do nothing;

insert into public.testimonials (id, company, quote, rating, person_name, sort_order, published) values
  (pg_temp.sid(11), 'Medical Association of Tanzania', 'They streamed our national congress for three days without a single drop, and had highlights on social media the same evening.', 5, 'Head of Communications', 1, true),
  (pg_temp.sid(12), 'Referral hospital, Dar es Salaam', 'Our patient-story series finally made people talk about early screening. The team worked gently with patients and doctors alike.', 5, 'Public Relations Officer', 2, true),
  (pg_temp.sid(13), 'Health NGO, Dodoma', 'Clear plan, honest budget and delivery on the date promised. The Kiswahili subtitles were spot on.', 5, 'Programme Manager', 3, true),
  (pg_temp.sid(14), 'University of Health Sciences', 'Our graduation film is still the most watched video on our channel.', 4, 'Dean of Students', 4, true)
on conflict (id) do nothing;

insert into public.highlights (id, title, video_url, thumbnail_url, sort_order, published, orientation) values
  (pg_temp.sid(21), 'Behind the scenes · Health Summit live stream', '', '', 1, true, 'portrait'),
  (pg_temp.sid(22), 'Sixty seconds with a cardiologist', '', '', 2, true, 'portrait'),
  (pg_temp.sid(23), 'Graduation day highlights', '', '', 3, true, 'landscape')
on conflict (id) do nothing;

-- =========================================================== CLIENTS & CRM
insert into public.clients (id, name, sector, contact_name, phone, email, address, tin) values
  (pg_temp.sid(101), 'Upanga Referral Hospital', 'Health', 'Dr Neema Mushi', '+255 713 220 401', 'communications@upangahospital.co.tz', 'Upanga, Dar es Salaam', '112-334-551'),
  (pg_temp.sid(102), 'Tanzania Health Summit', 'Health', 'Lilian Massawe', '+255 754 118 920', 'info@healthsummit.or.tz', 'JNICC, Dar es Salaam', '113-221-908'),
  (pg_temp.sid(103), 'University of Health Sciences', 'Education', 'Prof. Joseph Mbwambo', '+255 765 440 120', 'pro@uhs.ac.tz', 'Upanga West, Dar es Salaam', '102-118-905'),
  (pg_temp.sid(104), 'Pwani Microfinance Bank', 'Finance', 'Hassan Mwinyi', '+255 688 120 554', 'marketing@pwanimf.co.tz', 'Posta, Dar es Salaam', '104-552-118'),
  (pg_temp.sid(105), 'Kilimanjaro Water Co.', 'Consumer', 'Irene Kweka', '+255 658 220 031', 'brand@kiliwater.co.tz', 'Mikocheni, Dar es Salaam', '105-903-441')
on conflict (id) do nothing;

-- A client login (role "client") with no company yet is linked to the hospital, so the client portal shows a retainer.
insert into public.client_users (user_id, client_id, role)
select r.user_id, pg_temp.sid(101), 'owner' from public.user_roles r
where r.role = 'client' and not exists (select 1 from public.client_users c where c.user_id = r.user_id)
order by r.created_at limit 1;

insert into public.crm_organisations (id, name, type, sector, client_id, city, phone, email, website, notes) values
  (pg_temp.sid(111), 'Upanga Referral Hospital', 'Hospital', 'Health', pg_temp.sid(101), 'Dar es Salaam', '+255 713 220 401', 'communications@upangahospital.co.tz', '', 'Retainer client since this year.'),
  (pg_temp.sid(112), 'Tanzania Health Summit', 'Association', 'Health', pg_temp.sid(102), 'Dar es Salaam', '+255 754 118 920', 'info@healthsummit.or.tz', '', 'Annual summit, live stream every year.'),
  (pg_temp.sid(113), 'Pwani Microfinance Bank', 'Bank', 'Finance', pg_temp.sid(104), 'Dar es Salaam', '+255 688 120 554', 'marketing@pwanimf.co.tz', '', '12 branches, wants monthly content.'),
  (pg_temp.sid(114), 'Mbeya Zonal Hospital', 'Hospital', 'Health', null, 'Mbeya', '+255 25 250 3456', 'info@mbeyazonal.go.tz', '', 'Met at the summit — interested in a patient-safety film.'),
  (pg_temp.sid(115), 'Afya Bora NGO', 'NGO', 'Health', null, 'Dodoma', '+255 715 990 001', 'programs@afyabora.org', '', 'Malaria campaign tender expected.'),
  (pg_temp.sid(116), 'Kilimanjaro Water Co.', 'Corporate', 'Consumer', pg_temp.sid(105), 'Dar es Salaam', '+255 658 220 031', 'brand@kiliwater.co.tz', '', '')
on conflict (id) do nothing;

insert into public.crm_contacts (id, organisation_id, full_name, title, phone, email, is_primary) values
  (pg_temp.sid(121), pg_temp.sid(111), 'Dr Neema Mushi', 'Head of Communications', '+255 713 220 401', 'neema.mushi@upangahospital.co.tz', true),
  (pg_temp.sid(122), pg_temp.sid(112), 'Lilian Massawe', 'Summit Coordinator', '+255 754 118 920', 'lilian@healthsummit.or.tz', true),
  (pg_temp.sid(123), pg_temp.sid(113), 'Hassan Mwinyi', 'Marketing Manager', '+255 688 120 554', 'hassan.mwinyi@pwanimf.co.tz', true),
  (pg_temp.sid(124), pg_temp.sid(114), 'Dr Peter Laizer', 'Quality Improvement Lead', '+255 767 330 210', 'qi@mbeyazonal.go.tz', true),
  (pg_temp.sid(125), pg_temp.sid(115), 'Rose Ndege', 'Programme Manager', '+255 715 990 001', 'rose@afyabora.org', true)
on conflict (id) do nothing;

insert into public.leads (id, title, organisation_id, contact_id, stage, value, probability, next_action, next_action_date, owner_id, source, service, lost_reason, notes) values
  (pg_temp.sid(131), 'Patient-safety film series', pg_temp.sid(114), pg_temp.sid(124), 'Meeting', 18000000, 40, 'Site visit and script outline', current_date + 4, pg_temp.who('account_manager'), 'Event', 'Video Production', '', ''),
  (pg_temp.sid(132), 'Branch content retainer', pg_temp.sid(113), pg_temp.sid(123), 'Proposal Sent', 3600000 * 12, 60, 'Follow up on proposal', current_date + 2, pg_temp.who('account_manager'), 'Website', 'Corporate Content', '', 'Asked for the Growth tier.'),
  (pg_temp.sid(133), 'Malaria campaign 2027', pg_temp.sid(115), pg_temp.sid(125), 'Contacted', 25000000, 25, 'Send company profile', current_date + 1, pg_temp.who('account_manager'), 'Referral', 'Health Communication', '', ''),
  (pg_temp.sid(134), 'Summit 2027 live stream', pg_temp.sid(112), pg_temp.sid(122), 'Negotiation', 24000000, 80, 'Agree the payment schedule', current_date + 3, pg_temp.who('account_manager'), 'Repeat client', 'Live Streaming', '', ''),
  (pg_temp.sid(135), 'Water brand launch film', pg_temp.sid(116), null, 'Won', 9500000, 100, '', null, pg_temp.who('account_manager'), 'Website', 'Video Production', '', ''),
  (pg_temp.sid(136), 'Annual report photos', pg_temp.sid(113), pg_temp.sid(123), 'Lost', 2400000, 0, '', null, pg_temp.who('account_manager'), 'Website', 'Photography', 'Chose an in-house photographer', '')
on conflict (id) do nothing;

-- Proposals log (written outside the app; here only who, what, how much and where it stands)
insert into public.proposals (id, number, title, client_name, organisation_id, lead_id, status, stage, amount, note, sent_at, stage_at) values
  (pg_temp.sid(141), 'BM-PRP-SAMPLE-1', 'Branch content retainer — Growth tier', 'Pwani Microfinance Bank', pg_temp.sid(113), pg_temp.sid(132), 'sent', 'Working on it', 43200000, 'Marketing manager reviewing with finance.', now() - interval '6 days', now() - interval '2 days'),
  (pg_temp.sid(142), 'BM-PRP-SAMPLE-2', 'Summit 2027 live stream and highlights', 'Tanzania Health Summit', pg_temp.sid(112), pg_temp.sid(134), 'sent', 'Interested', 24000000, 'Wants a 40/60 payment split.', now() - interval '12 days', now() - interval '1 day'),
  (pg_temp.sid(143), 'BM-PRP-SAMPLE-3', 'Patient-safety film series (3 films)', 'Mbeya Zonal Hospital', pg_temp.sid(114), pg_temp.sid(131), 'sent', 'Sent', 18000000, '', now() - interval '1 day', now() - interval '1 day'),
  (pg_temp.sid(144), 'BM-PRP-SAMPLE-4', 'Water brand launch film', 'Kilimanjaro Water Co.', pg_temp.sid(116), pg_temp.sid(135), 'accepted', 'Won', 9500000, 'Signed — production starts next week.', now() - interval '25 days', now() - interval '9 days')
on conflict (id) do nothing;

insert into public.contracts (id, number, title, kind, organisation_id, client_id, lead_id, value, start_date, end_date, status, instalments, renewal_notice_days) values
  (pg_temp.sid(151), 'BM-CON-SAMPLE-1', 'Monthly content retainer', 'Retainer', pg_temp.sid(111), pg_temp.sid(101), null, 3600000 * 12, date_trunc('year', current_date)::date, (date_trunc('year', current_date) + interval '1 year - 1 day')::date, 'active',
    jsonb_build_array(jsonb_build_object('label', 'Monthly fee', 'pct', 100, 'due_date', null, 'paid', false)), 60),
  (pg_temp.sid(152), 'BM-CON-SAMPLE-2', 'Water brand launch film', 'Contract', pg_temp.sid(116), pg_temp.sid(105), pg_temp.sid(135), 9500000, current_date - 9, current_date + 40, 'active',
    jsonb_build_array(jsonb_build_object('label', 'Deposit', 'pct', 50, 'due_date', current_date - 5, 'paid', true), jsonb_build_object('label', 'On delivery', 'pct', 50, 'due_date', current_date + 40, 'paid', false)), 30)
on conflict (id) do nothing;

insert into public.tenders (id, title, issuer, reference, closes_on, value_estimate, status, owner_id, documents_needed, notes) values
  (pg_temp.sid(161), 'Health education videos for primary schools', 'Ministry of Health', 'MoH/HPE/2026/14', current_date + 18, 60000000, 'Preparing', pg_temp.who('account_manager'), 'Company profile, TIN, BRELA, 3 references, technical proposal', ''),
  (pg_temp.sid(162), 'Documentation of the TB programme', 'National TB Programme', 'NTLP/COM/2026/07', current_date + 6, 22000000, 'Identified', pg_temp.who('account_manager'), 'Expression of interest', 'Short deadline.'),
  (pg_temp.sid(163), 'Conference coverage framework', 'University of Health Sciences', 'UHS/PR/2026/03', current_date - 20, 15000000, 'Submitted', pg_temp.who('account_manager'), '', 'Result expected this month.')
on conflict (id) do nothing;

insert into public.growth_events (id, title, kind, starts_on, ends_on, location, role, owner_id, cost, leads_expected, notes) values
  (pg_temp.sid(171), 'East African Health Expo', 'Exhibition', current_date + 21, current_date + 23, 'Diamond Jubilee Hall, Dar es Salaam', 'Exhibitor', pg_temp.who('account_manager'), 1800000, 15, 'Bring the showreel screen and QR flyers.'),
  (pg_temp.sid(172), 'MAT Annual Scientific Conference', 'Conference', current_date + 45, current_date + 47, 'Mwanza', 'Media partner', pg_temp.who('account_manager'), 0, 8, '')
on conflict (id) do nothing;

-- =========================================================== PROJECTS
insert into public.projects (id, code, name, client_id, service, template, stage, lead_id, start_date, end_date, budget, contract_value, spent, priority, location, health, description) values
  (pg_temp.sid(201), 'BM-PRJ-S01', 'Tanzania Health Summit — live stream', pg_temp.sid(102), 'Live Streaming', 'Live stream', 'Shoot', pg_temp.who('project_lead'), current_date - 2, current_date + 3, 15000000, 22000000, 9400000, 'High', 'JNICC, Dar es Salaam', 'amber', 'Three-day multi-camera stream with daily recap reels and a closing highlights film.'),
  (pg_temp.sid(202), 'BM-PRJ-S02', 'Graduation film', pg_temp.sid(103), 'Event Coverage', 'Event coverage', 'Edit', pg_temp.who('project_lead'), current_date - 14, current_date + 10, 7000000, 11500000, 3100000, 'Normal', 'Upanga, Dar es Salaam', 'green', 'A 6-minute film, a 60-second social cut and a photo gallery.'),
  (pg_temp.sid(203), 'BM-PRJ-S03', 'Patient stories — early screening', pg_temp.sid(101), 'Health Communication', 'Documentary', 'Pre-production', pg_temp.who('project_lead'), current_date + 2, current_date + 40, 12000000, 18000000, 800000, 'Normal', 'Upanga Referral Hospital', 'green', 'Three short documentaries on breast, cervical and prostate cancer screening, in Kiswahili with English subtitles.'),
  (pg_temp.sid(204), 'BM-PRJ-S04', 'Water brand launch film', pg_temp.sid(105), 'Video Production', 'Corporate film', 'Brief', pg_temp.who('project_lead'), current_date + 5, current_date + 40, 6000000, 9500000, 0, 'Normal', 'Moshi, Kilimanjaro', 'green', '90-second launch film shot at the spring, plus 3 cut-downs for social.'),
  (pg_temp.sid(205), 'BM-PRJ-S05', 'Health Talk podcast — season 2', pg_temp.sid(101), 'Podcast Production', 'Podcast', 'Client Review', pg_temp.who('project_lead'), current_date - 30, current_date + 2, 4000000, 6000000, 3600000, 'High', 'Basil Media studio', 'red', 'Eight video episodes with doctors; episodes 5–8 waiting for client approval.')
on conflict (id) do nothing;

insert into public.project_budget_lines (id, project_id, line, allocated) values
  (pg_temp.sid(211), pg_temp.sid(201), 'Crew', 6000000), (pg_temp.sid(212), pg_temp.sid(201), 'Equipment hire', 4500000), (pg_temp.sid(213), pg_temp.sid(201), 'Transport', 1500000),
  (pg_temp.sid(214), pg_temp.sid(201), 'Per diem & meals', 1800000), (pg_temp.sid(215), pg_temp.sid(201), 'Contingency', 1200000),
  (pg_temp.sid(216), pg_temp.sid(202), 'Crew', 3000000), (pg_temp.sid(217), pg_temp.sid(202), 'Post-production', 2500000), (pg_temp.sid(218), pg_temp.sid(202), 'Transport', 500000),
  (pg_temp.sid(219), pg_temp.sid(203), 'Crew', 5000000), (pg_temp.sid(220), pg_temp.sid(203), 'Location & permits', 1000000), (pg_temp.sid(221), pg_temp.sid(203), 'Post-production', 4000000)
on conflict (id) do nothing;

insert into public.project_crew (id, project_id, user_id, role, days)
select x.id, x.p, x.u, x.r, x.d from (values
  (pg_temp.sid(231), pg_temp.sid(201), pg_temp.who('staff'), 'Camera operator', 3),
  (pg_temp.sid(232), pg_temp.sid(202), pg_temp.who('staff'), 'Editor', 6),
  (pg_temp.sid(233), pg_temp.sid(203), pg_temp.who('staff'), 'Director of photography', 5)
) as x(id, p, u, r, d) where x.u is not null
on conflict do nothing;

insert into public.tasks (id, project_id, title, description, assignee_id, due_date, priority, status, checklist, minutes_logged) values
  (pg_temp.sid(241), pg_temp.sid(201), 'Day 2 recap reel', 'Cut a 60-second reel of day 2 for Instagram and LinkedIn.', pg_temp.who('staff'), current_date, 'High', 'In progress', '[{"text":"Select clips","done":true},{"text":"Captions EN/SW","done":false},{"text":"Send for approval","done":false}]', 90),
  (pg_temp.sid(242), pg_temp.sid(201), 'Back up day 1 cards', '', pg_temp.who('staff'), current_date - 1, 'Urgent', 'To do', '[]', 0),
  (pg_temp.sid(243), pg_temp.sid(202), 'Colour grade graduation film', '', pg_temp.who('staff'), current_date + 3, 'Normal', 'In progress', '[{"text":"Rough cut approved","done":true},{"text":"Grade","done":false}]', 240),
  (pg_temp.sid(244), pg_temp.sid(203), 'Interview questions for oncologist', '', pg_temp.who('project_lead'), current_date + 1, 'Normal', 'To do', '[]', 0),
  (pg_temp.sid(245), pg_temp.sid(203), 'Consent forms for patients', 'Kiswahili and English versions, signed before filming.', pg_temp.who('project_lead'), current_date + 2, 'High', 'To do', '[]', 0),
  (pg_temp.sid(246), pg_temp.sid(205), 'Export episodes 5–8 for client review', '', pg_temp.who('staff'), current_date - 3, 'High', 'Done', '[]', 180)
on conflict (id) do nothing;

insert into public.shoots (id, project_id, title, shoot_date, call_time, wrap_time, location, contact_name, contact_phone, shot_list, equipment, nearest_hospital, notes, status) values
  (pg_temp.sid(251), pg_temp.sid(201), 'Summit day 3 · closing and awards', current_date + 1, '06:30', '20:00', 'JNICC, Shaaban Robert Street', 'Lilian Massawe', '+255 754 118 920', '[{"text":"Keynote wide + close","done":false},{"text":"Awards on stage","done":false},{"text":"Vox pops x6","done":false}]', '3 cameras, switcher, 2 wireless mics, streaming kit', 'Ocean Road Hospital', 'Parking at gate B.', 'Planned'),
  (pg_temp.sid(252), pg_temp.sid(203), 'Screening clinic interviews', current_date + 6, '07:00', '15:00', 'Upanga Referral Hospital, Oncology', 'Dr Neema Mushi', '+255 713 220 401', '[{"text":"Doctor interview","done":false},{"text":"Patient walk-and-talk","done":false},{"text":"Clinic b-roll","done":false}]', 'FX6, 2 lights, lav mics', 'On site', 'Quiet on set near the wards.', 'Planned'),
  (pg_temp.sid(253), pg_temp.sid(202), 'Graduation ceremony', current_date - 12, '06:00', '18:00', 'University main hall', 'Prof. Joseph Mbwambo', '+255 765 440 120', '[]', '2 cameras, drone', 'Muhimbili', '', 'Wrapped')
on conflict (id) do nothing;

insert into public.shoot_crew (id, shoot_id, user_id, role, call_time)
select x.id, x.s, x.u, x.r, x.c from (values
  (pg_temp.sid(261), pg_temp.sid(251), pg_temp.who('staff'), 'Camera A', '06:30'),
  (pg_temp.sid(262), pg_temp.sid(252), pg_temp.who('staff'), 'Director of photography', '07:00')
) as x(id, s, u, r, c) where x.u is not null
on conflict do nothing;

insert into public.deliverables (id, project_id, title, spec, owner_id, due_date, post_status, revision_round) values
  (pg_temp.sid(271), pg_temp.sid(202), 'Graduation film (6 min)', '1080p, EN subtitles', pg_temp.who('staff'), current_date + 8, 'Colour', 1),
  (pg_temp.sid(272), pg_temp.sid(202), 'Social cut (60 s, vertical)', '1080x1920', pg_temp.who('staff'), current_date + 10, 'Fine cut', 0),
  (pg_temp.sid(273), pg_temp.sid(205), 'Episodes 5–8', '4K, audio −16 LUFS', pg_temp.who('staff'), current_date + 2, 'Ready for review', 1)
on conflict (id) do nothing;

insert into public.announcements (id, title, body, author_id, pinned)
select x.id, x.t, x.b, pg_temp.who('gm_cfo'), x.p from (values
  (pg_temp.sid(281), 'Staff meeting on Monday at 08:30', 'Short planning meeting in the boardroom: summit wrap-up, screening documentary and the expo stand.', true),
  (pg_temp.sid(282), 'Back up every card the same day', 'Two verified copies before any card is formatted — no exceptions.', false)
) as x(id, t, b, p) where pg_temp.who('gm_cfo') is not null
on conflict (id) do nothing;

-- =========================================================== RETAINER (client portal)
insert into public.retainers (id, number, client_id, tier, monthly_fee, start_date, end_date, status, allowances, rollover, rollover_cap_pct, account_manager_id, notes) values
  (pg_temp.sid(301), 'BM-RET-SAMPLE-1', pg_temp.sid(101), 'Growth', 3600000, date_trunc('year', current_date)::date, (date_trunc('year', current_date) + interval '1 year - 1 day')::date, 'active',
   '{"shoot_days":4,"podcast_episodes":2,"posts":12,"reels":4,"edited_photos":160}', 'next_month', 25, pg_temp.who('account_manager'), 'Content for the hospital''s social media and patient education screens.')
on conflict (id) do nothing;

insert into public.retainer_calendar (id, retainer_id, client_id, project_id, date, time, kind, title, location, map_url, status, crew, call_time, checklist, units) values
  (pg_temp.sid(311), pg_temp.sid(301), pg_temp.sid(101), null, current_date - 8, '09:00', 'shoot', 'Nurses'' week portraits', 'Upanga Referral Hospital', 'https://maps.google.com/?q=Upanga%20Dar%20es%20Salaam', 'Completed', '[]', '08:30', '[]', '{"shoot_days":1,"edited_photos":40}'),
  (pg_temp.sid(312), pg_temp.sid(301), pg_temp.sid(101), null, current_date + 3, '10:00', 'podcast', 'Health Talk · Diabetes in young adults', 'Basil Media studio, Upanga', 'https://maps.google.com/?q=Mataka%20Street%20Upanga', 'Crew confirmed', case when pg_temp.who('staff') is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('user_id', pg_temp.who('staff'), 'role', 'Podcast producer')) end, '09:30', '[{"label":"Guest briefed","done":true},{"label":"Studio booked","done":true}]', '{"podcast_episodes":1}'),
  (pg_temp.sid(313), pg_temp.sid(301), pg_temp.sid(101), null, current_date + 9, '08:00', 'shoot', 'Maternity ward tour video', 'Upanga Referral Hospital, Maternity', 'https://maps.google.com/?q=Upanga%20Dar%20es%20Salaam', 'Scheduled', case when pg_temp.who('staff') is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('user_id', pg_temp.who('staff'), 'role', 'Camera')) end, '07:30', '[]', '{"shoot_days":1,"reels":1}'),
  (pg_temp.sid(314), pg_temp.sid(301), pg_temp.sid(101), null, current_date + 12, '12:00', 'delivery', 'Monthly posts and reels pack', '', '', 'Scheduled', '[]', '', '[]', '{"posts":12,"reels":2}')
on conflict (id) do nothing;

insert into public.allowance_ledger (id, retainer_id, client_id, month, unit, qty, kind, note) values
  (pg_temp.sid(321), pg_temp.sid(301), pg_temp.sid(101), to_char(current_date, 'YYYY-MM'), 'shoot_days', 1, 'usage', 'Nurses'' week portraits'),
  (pg_temp.sid(322), pg_temp.sid(301), pg_temp.sid(101), to_char(current_date, 'YYYY-MM'), 'edited_photos', 40, 'usage', 'Nurses'' week portraits'),
  (pg_temp.sid(323), pg_temp.sid(301), pg_temp.sid(101), to_char(current_date, 'YYYY-MM'), 'posts', 5, 'usage', 'Posts published so far this month')
on conflict (id) do nothing;

insert into public.client_requests (id, number, client_id, retainer_id, type, title, preferred_dates, location, deliverables, urgency, status, units, over_allowance, quote_amount, quote_status, note) values
  (pg_temp.sid(331), 'BM-REQ-SAMPLE-1', pg_temp.sid(101), pg_temp.sid(301), 'shoot', 'World Diabetes Day awareness walk', jsonb_build_array(current_date + 14), 'Coco Beach', 'Photos and one reel', 'Soon', 'Reviewing', '{"shoot_days":1,"reels":1}', false, 0, 'none', ''),
  (pg_temp.sid(332), 'BM-REQ-SAMPLE-2', pg_temp.sid(101), pg_temp.sid(301), 'video', 'Hospital anniversary film (3 min)', jsonb_build_array(current_date + 30, current_date + 33), 'Upanga Referral Hospital', '3-minute film', 'Normal', 'Quote needed', '{"shoot_days":2}', true, 2800000, 'sent', 'Over the monthly allowance — quote sent.')
on conflict (id) do nothing;

-- =========================================================== STORE, RECEPTION, TRANSPORT
insert into public.gear_items (id, tag, name, category, make, model, serial, purchase_date, purchase_price, supplier, condition, location, accessories, day_rate, useful_life_years, salvage_value, status, notes) values
  (pg_temp.sid(401), 'BM-CAM-001', 'Sony FX6 cinema camera', 'Camera', 'Sony', 'ILME-FX6', 'FX6-55102', current_date - 400, 14500000, 'Camera World Dar', 'Excellent', 'Store shelf A1', 'Handle, 2 batteries, charger', 250000, 5, 2000000, 'available', ''),
  (pg_temp.sid(402), 'BM-CAM-002', 'Sony A7S III', 'Camera', 'Sony', 'ILCE-7SM3', 'A7S3-88210', current_date - 700, 8200000, 'Camera World Dar', 'Good', 'Store shelf A1', 'Cage, 3 batteries', 150000, 5, 1000000, 'available', ''),
  (pg_temp.sid(403), 'BM-LEN-001', 'Sony 24–70mm f/2.8 GM II', 'Lens', 'Sony', 'SEL2470GM2', 'L2470-1182', current_date - 400, 4600000, 'Camera World Dar', 'Excellent', 'Store shelf A2', 'Hood, caps', 60000, 6, 500000, 'available', ''),
  (pg_temp.sid(404), 'BM-AUD-001', 'Rode Wireless PRO kit', 'Audio', 'Rode', 'Wireless PRO', 'RWP-22018', current_date - 300, 1450000, 'Sound House', 'Good', 'Store shelf B1', '2 transmitters, receiver, lavs', 40000, 4, 150000, 'available', ''),
  (pg_temp.sid(405), 'BM-LGT-001', 'Aputure 300d II light', 'Lighting', 'Aputure', 'LS 300d II', 'AP300-7731', current_date - 900, 2600000, 'Light Store', 'Fair', 'Store shelf C1', 'Softbox, stand', 50000, 5, 200000, 'available', 'Fan noisy — watch it.'),
  (pg_temp.sid(406), 'BM-DRN-001', 'DJI Mavic 3 Pro drone', 'Drone', 'DJI', 'Mavic 3 Pro', 'M3P-44120', current_date - 200, 6900000, 'DJI Store', 'Excellent', 'Store cabinet D', '3 batteries, ND filters', 200000, 4, 800000, 'available', 'TCAA permit needed for every flight.'),
  (pg_temp.sid(407), 'BM-STR-001', 'Blackmagic ATEM Mini Extreme', 'Streaming', 'Blackmagic', 'ATEM Mini Extreme ISO', 'ATEM-9921', current_date - 500, 3400000, 'Pro AV', 'Good', 'Store shelf E1', 'Power, HDMI cables', 120000, 5, 300000, 'in_repair', 'HDMI 3 input intermittent — at the repairer.')
on conflict (id) do nothing;

insert into public.gear_kits (id, code, name, description, gear_ids, extras) values
  (pg_temp.sid(411), 'KIT-INT', 'Interview kit', 'One-camera interview with light and wireless audio.', array[pg_temp.sid(401), pg_temp.sid(403), pg_temp.sid(404), pg_temp.sid(405)], array['Tripod', 'Gaffer tape', '2 × 128 GB cards']),
  (pg_temp.sid(412), 'KIT-LIVE', 'Live stream kit', 'Switcher plus two cameras for live streams.', array[pg_temp.sid(401), pg_temp.sid(402), pg_temp.sid(407)], array['3 × HDMI 15 m', 'Laptop', '4G router'])
on conflict (id) do nothing;

insert into public.consumables (id, name, category, unit, quantity, min_level, unit_cost, location) values
  (pg_temp.sid(421), 'AA batteries', 'Power', 'pack of 4', 6, 10, 9000, 'Store drawer 1'),
  (pg_temp.sid(422), 'Gaffer tape (black)', 'Grip', 'roll', 8, 4, 18000, 'Store drawer 2'),
  (pg_temp.sid(423), 'SD cards 128 GB', 'Media', 'card', 12, 6, 65000, 'Store cabinet D'),
  (pg_temp.sid(424), 'Lens cleaning tissue', 'Cleaning', 'pack', 3, 5, 6000, 'Store drawer 1')
on conflict (id) do nothing;

insert into public.vehicles (id, registration, make_model, seats, status, insurance_expiry, inspection_expiry, odometer, notes) values
  (pg_temp.sid(431), 'T 512 DKL', 'Toyota HiAce (crew van)', 12, 'available', current_date + 120, current_date + 40, 84210, ''),
  (pg_temp.sid(432), 'T 288 EBX', 'Toyota Land Cruiser Prado', 7, 'available', current_date + 25, current_date + 200, 132400, 'Insurance renews this month.')
on conflict (id) do nothing;

insert into public.trips (id, vehicle_id, driver_id, project_id, purpose, origin, destination, depart_at, return_at, passengers, cargo, stage)
select x.id, x.v, x.d, x.p, x.purpose, 'Basil Media, Upanga', x.dest, x.dep, x.ret, x.pax, x.cargo, x.stage from (values
  (pg_temp.sid(441), pg_temp.sid(431), pg_temp.who('driver'), pg_temp.sid(201), 'Summit day 3 crew and kit', 'JNICC, Dar es Salaam', (current_date + 1) + time '05:45', (current_date + 1) + time '21:00', 'Camera crew (4)', 'Live stream kit', 'Scheduled'),
  (pg_temp.sid(442), pg_temp.sid(432), pg_temp.who('driver'), pg_temp.sid(204), 'Recce at the spring', 'Moshi, Kilimanjaro', (current_date + 5) + time '06:00', (current_date + 6) + time '18:00', 'Director, producer', 'Drone kit', 'Scheduled')
) as x(id, v, d, p, purpose, dest, dep, ret, pax, cargo, stage) where x.d is not null
on conflict (id) do nothing;

insert into public.visitors (id, name, company, phone, purpose, host_id, expected_at, status, pass_code) values
  (pg_temp.sid(451), 'Dr Peter Laizer', 'Mbeya Zonal Hospital', '+255 767 330 210', 'Film series meeting', pg_temp.who('account_manager'), (current_date + 1) + time '10:00', 'expected', 'BMV-S1A2'),
  (pg_temp.sid(452), 'Rose Ndege', 'Afya Bora NGO', '+255 715 990 001', 'Campaign briefing', pg_temp.who('gm_cfo'), (current_date + 2) + time '14:00', 'expected', 'BMV-S3B4')
on conflict (id) do nothing;

insert into public.room_bookings (id, room, date, start_hour, end_hour, title, booked_by, status)
select x.id, x.room, x.d, x.s, x.e, x.t, x.u, 'booked' from (values
  (pg_temp.sid(461), 'Podcast studio', current_date + 3, 9, 13, 'Health Talk recording', pg_temp.who('project_lead')),
  (pg_temp.sid(462), 'Boardroom', current_date + 1, 10, 11, 'Mbeya Zonal Hospital meeting', pg_temp.who('account_manager')),
  (pg_temp.sid(463), 'Edit suite', current_date, 8, 17, 'Graduation film grade', pg_temp.who('staff'))
) as x(id, room, d, s, e, t, u) where x.u is not null
on conflict (id) do nothing;

-- =========================================================== MONEY
insert into public.finance_accounts (id, name, kind, opening_balance, opening_date) values
  (pg_temp.sid(501), 'CRDB Bank · current account', 'bank', 18500000, date_trunc('month', current_date)::date),
  (pg_temp.sid(502), 'M-Pesa business till', 'mobile', 1250000, date_trunc('month', current_date)::date),
  (pg_temp.sid(503), 'Office petty cash', 'cash', 800000, date_trunc('month', current_date)::date)
on conflict (id) do nothing;

insert into public.quotations (id, client_id, project_id, prospect, title, items, discount, vat_on, vat_rate, issue_date, valid_until, status, notes, created_by) values
  (pg_temp.sid(511), pg_temp.sid(104), null, '', 'Branch content retainer — first quarter',
   pg_temp.items('Monthly content plan|Calendar, scripts and approvals|3|600000', 'Reels|Vertical 30–60 s, captions EN/SW|12|250000', 'Edited photos|Branch and staff photography|120|8000'), 0, true, 18, current_date - 6, current_date + 24, 'sent', '', pg_temp.who('gm_cfo')),
  (pg_temp.sid(512), null, null, 'Mbeya Zonal Hospital', 'Patient-safety film series',
   pg_temp.items('Pre-production|Research, scripts, consent|1|2500000', 'Filming|3 shoot days, crew of 4|3|3200000', 'Post-production|Edit, colour, sound, subtitles|3|1800000'), 5, true, 18, current_date - 1, current_date + 29, 'draft', '', pg_temp.who('gm_cfo'))
on conflict (id) do nothing;

insert into public.proformas (id, client_id, prospect, title, items, discount, vat_on, vat_rate, issue_date, valid_until, status, terms, created_by) values
  (pg_temp.sid(521), pg_temp.sid(102), '', 'Summit 2027 — live stream deposit',
   pg_temp.items('Live stream, 3 days|Multi-camera, graphics, recording|3|6000000', 'Highlights film|3-minute closing film|1|4000000'), 0, true, 18, current_date - 3, current_date + 27, 'sent', 'Payment by bank transfer or mobile money. Quote the proforma number as reference.', pg_temp.who('gm_cfo'))
on conflict (id) do nothing;

insert into public.invoices (id, client_id, project_id, title, po_ref, items, discount, vat_on, vat_rate, deposit, schedule, issue_date, due_date, status, notes, terms, created_by) values
  (pg_temp.sid(531), pg_temp.sid(102), pg_temp.sid(201), 'Health Summit live stream', 'THS/PO/2026/041',
   pg_temp.items('Live stream, 3 days|Multi-camera, graphics, recording|3|5500000', 'Daily recap reels|3 reels|3|800000', 'Highlights film|3-minute closing film|1|3100000'), 0, true, 18, 0,
   jsonb_build_array(jsonb_build_object('label', 'Deposit', 'pct', 50, 'due', current_date - 20), jsonb_build_object('label', 'On delivery', 'pct', 50, 'due', current_date + 10)), current_date - 25, current_date + 10, 'sent', '', '', pg_temp.who('gm_cfo')),
  (pg_temp.sid(532), pg_temp.sid(103), pg_temp.sid(202), 'Graduation film and gallery', 'UHS/PR/112',
   pg_temp.items('Event coverage|Photo + video team, full day|1|6500000', 'Graduation film|6 min + social cut|1|3500000'), 0, true, 18, 0, '[]', current_date - 40, current_date - 10, 'sent', '', '', pg_temp.who('gm_cfo')),
  (pg_temp.sid(533), pg_temp.sid(101), null, 'Retainer · last month', '',
   pg_temp.items('Monthly content retainer|Growth tier|1|3600000'), 0, true, 18, 0, '[]', current_date - 35, current_date - 5, 'sent', '', '', pg_temp.who('gm_cfo'))
on conflict (id) do nothing;

insert into public.invoice_payments (id, invoice_id, amount, paid_on, method, reference, account_id, is_deposit) values
  (pg_temp.sid(541), pg_temp.sid(531), round(public.doc_total(pg_temp.items('Live stream, 3 days|x|3|5500000', 'Daily recap reels|x|3|800000', 'Highlights film|x|1|3100000'), 0, true, 18) / 2), current_date - 18, 'Bank transfer', 'CRDB-TT-884120', pg_temp.sid(501), true),
  (pg_temp.sid(542), pg_temp.sid(533), 4248000, current_date - 4, 'Mobile money', 'MPESA-QJ71K2', pg_temp.sid(502), false)
on conflict (id) do nothing;

insert into public.expenses (id, date, amount, category, account_id, project_id, payee, description, petty_cash, recorded_by) values
  (pg_temp.sid(551), current_date - 2, 1200000, 'Equipment hire', pg_temp.sid(501), pg_temp.sid(201), 'Pro AV Rentals', 'Extra camera and LED wall for the summit', false, pg_temp.who('finance')),
  (pg_temp.sid(552), current_date - 2, 360000, 'Per diem & meals', pg_temp.sid(503), pg_temp.sid(201), 'Crew (6)', 'Summit day 1–2 lunches', true, pg_temp.who('finance')),
  (pg_temp.sid(553), current_date - 10, 2500000, 'Rent & utilities', pg_temp.sid(501), null, 'Mataka Street landlord', 'Office and studio rent', false, pg_temp.who('finance')),
  (pg_temp.sid(554), current_date - 7, 189000, 'Software & subscriptions', pg_temp.sid(501), null, 'Adobe', 'Creative Cloud team', false, pg_temp.who('finance')),
  (pg_temp.sid(555), current_date - 12, 450000, 'Transport', pg_temp.sid(502), pg_temp.sid(202), 'Fuel', 'Graduation shoot transport', false, pg_temp.who('finance'))
on conflict (id) do nothing;

-- Money requests at each step: waiting for the GM, waiting for the Boss, approved and waiting for Finance.
insert into public.money_requests (id, number, requester_id, project_id, budget_line_id, amount, purpose, category, needed_by, payee, payee_phone, method, urgency, status, recommendation, submitted_at, stage_at, reviewed_at, reviewed_by, approved_at, approved_by, approved_amount)
select x.id, x.num, x.req, x.proj, x.line, x.amt, x.purpose, x.cat, current_date + x.need, x.payee, x.phone, x.method, x.urg, x.status, x.rec,
       now() - interval '1 day', now() - x.age, case when x.status <> 'gm_review' then now() - interval '6 hours' end, case when x.status <> 'gm_review' then pg_temp.who('gm_cfo') end,
       case when x.status = 'approved' then now() - interval '2 hours' end, case when x.status = 'approved' then pg_temp.who('boss') end, case when x.status = 'approved' then x.amt end
from (values
  (pg_temp.sid(561), 'BM-REQ-S-0001', pg_temp.who('staff'), pg_temp.sid(201), pg_temp.sid(214), 240000::numeric, 'Crew lunches, summit day 3', 'Per diem & meals', 1, 'Mama Asha Catering', '+255 712 556 004', 'M-Pesa', 'urgent', 'gm_review', '', interval '3 hours'),
  (pg_temp.sid(562), 'BM-REQ-S-0002', pg_temp.who('project_lead'), pg_temp.sid(201), pg_temp.sid(212), 1800000::numeric, 'Hire LED wall for the awards night', 'Equipment hire', 1, 'Pro AV Rentals', '+255 754 300 880', 'Bank transfer', 'urgent', 'boss_approval', 'Needed for the awards; within the equipment line.', interval '5 hours'),
  (pg_temp.sid(563), 'BM-REQ-S-0003', pg_temp.who('project_lead'), pg_temp.sid(203), pg_temp.sid(220), 350000::numeric, 'Hospital filming permit', 'Location & permits', 4, 'Upanga Referral Hospital', '', 'Bank transfer', 'normal', 'approved', 'Required before filming.', interval '2 hours')
) as x(id, num, req, proj, line, amt, purpose, cat, need, payee, phone, method, urg, status, rec, age)
where x.req is not null
on conflict (id) do nothing;

-- =========================================================== BOSS, CALENDAR
insert into public.scoreboard_targets (id, year, metric, label, unit, target, actual, sort_order) values
  (pg_temp.sid(601), extract(year from current_date)::int, 'revenue', 'Revenue', 'tsh', 480000000, 312000000, 1),
  (pg_temp.sid(602), extract(year from current_date)::int, 'retainers', 'Active retainer clients', 'count', 8, 3, 2),
  (pg_temp.sid(603), extract(year from current_date)::int, 'projects', 'Projects delivered', 'count', 60, 41, 3),
  (pg_temp.sid(604), extract(year from current_date)::int, 'nps', 'Client rating (out of 100)', 'pct', 92, 90, 4)
on conflict (id) do nothing;

insert into public.decisions (id, decided_on, title, context, decision, decided_by, owner_id, review_on, status) values
  (pg_temp.sid(611), current_date - 20, 'Buy a second FX6', 'Two clashing shoots a week in peak season; hiring costs TSH 250K a day.', 'Buy one FX6 this quarter from retainer income.', pg_temp.who('boss'), pg_temp.who('gm_cfo'), current_date + 70, 'Active'),
  (pg_temp.sid(612), current_date - 45, 'Same-day backup rule', 'A card was nearly formatted before backup.', 'No card is formatted without two verified copies, checked by the project lead.', pg_temp.who('boss'), pg_temp.who('project_lead'), current_date + 45, 'Active')
on conflict (id) do nothing;

insert into public.calendar_events (id, title, description, location, starts_at, ends_at, all_day, color, visibility, created_by) values
  (pg_temp.sid(621), 'Staff meeting', 'Weekly planning.', 'Boardroom', (current_date + ((8 - extract(isodow from current_date)::int) % 7)) + time '08:30', (current_date + ((8 - extract(isodow from current_date)::int) % 7)) + time '09:15', false, '', 'staff', pg_temp.who('gm_cfo')),
  (pg_temp.sid(622), 'Gear check day', 'Clean, charge and test every camera and light.', 'Media store', (current_date + 4) + time '09:00', (current_date + 4) + time '12:00', false, '', 'staff', pg_temp.who('storekeeper')),
  (pg_temp.sid(623), 'East African Health Expo', 'Our stand is B14.', 'Diamond Jubilee Hall', (current_date + 21)::timestamptz, (current_date + 23)::timestamptz, true, '', 'everyone', pg_temp.who('account_manager'))
on conflict (id) do nothing;

-- ===================== 0019_service_photos.sql =====================
-- Basil Media OS · 0019 team photos on the services (only where no picture has been set yet).
update public.services s set image_url = v.img
from (values
  ('video-production', '/img/services/video-crew-conference.jpg'),
  ('photography', '/img/services/photographer-event.jpg'),
  ('brand-storytelling', '/img/services/photographer-event.jpg'),
  ('podcast-production', '/img/services/editing-studio.jpg'),
  ('live-streaming', '/img/services/video-crew-conference.jpg'),
  ('event-coverage', '/img/services/event-coverage-team.jpg'),
  ('corporate-content', '/img/services/editing-studio.jpg'),
  ('health-communication', '/img/services/event-coverage-team.jpg')
) as v(slug, img)
where s.slug = v.slug and coalesce(s.image_url, '') = '';

-- ===================== 0020_brand_and_team_photos.sql =====================
-- Basil Media OS · 0020 official logo and team photos (only where nothing has been set yet).
update public.site_settings set
  about_image_url = case when coalesce(about_image_url, '') = '' then '/img/team/basil-media-team.jpg' else about_image_url end,
  hero_images = case when coalesce(array_length(hero_images, 1), 0) = 0 then array[
    '/img/team/basil-media-team.jpg', '/img/team/crew-on-set.jpg', '/img/services/video-crew-conference.jpg',
    '/img/services/event-coverage-team.jpg', '/img/services/photographer-event.jpg'] else hero_images end,
  logo_url = case when coalesce(logo_url, '') in ('', '/logo.svg') then '/logo.svg' else logo_url end,
  logo_reverse_url = case when coalesce(logo_reverse_url, '') in ('', '/logo-reverse.svg') then '/logo-reverse.svg' else logo_reverse_url end
where id = 'site';

-- ===================== 0021_partners_ceo_news_meta.sql =====================
-- Basil Media OS · 0021 real partners (two-row "Trusted by"), "A word from our CEO", news pictures.

-- CEO message on the landing page (editable in Website CMS → Site settings).
alter table public.site_settings
  add column if not exists ceo_name text not null default 'Emmanuel Basil',
  add column if not exists ceo_title text not null default 'Founder & CEO, Basil Media',
  add column if not exists ceo_message text not null default '',
  add column if not exists ceo_photo_url text not null default '';

-- Partners, most important first. The sample partners from 0018 are replaced. Upload each official
-- logo in Website CMS → Partners; until then the name is shown as a badge.
delete from public.partners where id::text like 'b5a5e000-%';
insert into public.partners (name, logo_url, website, sort_order)
select v.name, v.logo, v.site, v.ord from (values
  ('Muhimbili National Hospital', '', 'https://www.mnh.or.tz', 1),
  ('MUHAS', '', 'https://www.muhas.ac.tz', 2),
  ('Aga Khan Hospital, Dar es Salaam', '', 'https://hospitals.aku.edu/dar-es-salaam', 3),
  ('CRDB Bank Foundation', '/img/partners/crdb-bank-foundation.png', 'https://crdbbankfoundation.co.tz', 4),
  ('Amref Health Africa', '', 'https://amref.org', 5),
  ('Muhimbili Orthopaedic Institute (MOI)', '', 'https://www.moi.ac.tz', 6),
  ('Kairuki University', '', 'https://hkmu.ac.tz', 7),
  ('Tanzania Health Summit', '', '', 8),
  ('CardioTan · JKCI', '', 'https://www.jkci.or.tz', 9),
  ('SATA', '', 'https://www.sata.or.tz', 10),
  ('SNOSSA Conference 2026', '', '', 11),
  ('NEDC', '', '', 12),
  ('CareHealth & Hospitality Services', '', '', 13),
  ('Ampola Regency Hospital', '', '', 14)
) as v(name, logo, site, ord)
where not exists (select 1 from public.partners p where lower(p.name) = lower(v.name));

-- Live health news: the article's own picture and description are fetched and stored.
alter table public.health_feed_items add column if not exists image_url text not null default '';

-- ===================== 0022_instagram_reels.sql =====================
-- Basil Media OS · 0022 current work from Instagram (@basilmedia_tz) on the homepage "work at a glance".
-- Reels play with Instagram's own player and cover (no thumbnail of ours). The empty sample reels from 0018
-- are removed.
delete from public.highlights where id::text like 'b5a5e000-%';
insert into public.highlights (title, video_url, thumbnail_url, sort_order, published, orientation)
select v.title, v.url, v.cover, v.ord, true, 'portrait' from (values
  ('CEO Forum · highlights', 'https://www.instagram.com/reel/Ddb4tAJozCz/', '', 1),
  ('CRDB Bank Marathon · video coverage', 'https://www.instagram.com/reel/DcJyeE6xOhp/', '', 2),
  ('In the edit suite · the team at work', 'https://www.instagram.com/reel/DeHpkoWo32X/', '', 3),
  ('Basil Media · latest reel', 'https://www.instagram.com/reel/DavwqtPRGqU/', '', 4),
  ('Basil Media · on location', 'https://www.instagram.com/reel/De3V9GHIK1m/', '', 5),
  ('Basil Media · behind the camera', 'https://www.instagram.com/reel/DeujlQ2xqsY/', '', 6),
  ('Basil Media · health story', 'https://www.instagram.com/reel/DePq1PqRqCE/', '', 7)
) as v(title, url, cover, ord)
where not exists (select 1 from public.highlights h where h.video_url = v.url);

-- Clear the team-photo covers an earlier version of this file set on Instagram reels.
update public.highlights set thumbnail_url = '' where video_url like 'https://www.instagram.com/%' and thumbnail_url like '/img/%';

-- ===================== 0023_hero_video.sql =====================
-- Basil Media OS · 0023 homepage hero video and the team photo as the About picture.
-- Hero: 47 s of Basil Media's own footage (public/media/hero/basil-hero-reel*.mp4 — wide for desktop,
-- tall for phones). Only replaces empty/starter values — a video or picture chosen in the CMS is kept.
update public.site_settings set
  hero_video_url = case when coalesce(hero_video_url, '') in ('', '/media/hero/basil-hero.mp4') then '/media/hero/basil-hero-reel.mp4' else hero_video_url end,
  about_image_url = case when coalesce(about_image_url, '') in ('', '/media/basil-media-studio-btv.webp') then '/img/team/basil-media-team.jpg' else about_image_url end
where id = 'site';

-- ===================== 0024_health_events.sql =====================
-- Basil Media OS · 0024 upcoming health events shown on the Subscribe page (admins add more in Website CMS → Events).
insert into public.events (title, venue, starts_on, cpd, sector, link, published)
select '16th African Academy of Sciences Biennial Scientific Conference', 'JNICC, Dar es Salaam', date '2026-12-15', '', 'Health',
       'https://www.udsm.ac.tz/sites/default/files/2026-07/16AAS%20Conference.pdf', true
where not exists (select 1 from public.events where title like '16th African Academy of Sciences%');

-- The starter placeholder events (0003) were not real announcements: hide them (still editable in the CMS).
update public.events set published = false
where link = '' and (title, starts_on) in (
  ('Tanzania Health Summit', date '2026-11-14'), ('Cardiology update for clinicians', date '2026-11-22'),
  ('East African Paediatrics Congress', date '2026-12-10'), ('Pharmacy practice workshop', date '2026-12-25'),
  ('Nursing leadership forum', date '2027-01-09'));

-- ===================== 0025_contact_number.sql =====================
-- Basil Media OS · 0025 the real contact number for calls and WhatsApp.
update public.site_settings set phone = '+255 625 199 652', whatsapp = '+255625199652' where id = 'site';

-- ===================== 0026_partner_logos.sql =====================
-- Basil Media OS · 0026 official partner logos (from each organisation's own website), only where none is set.
update public.partners p set logo_url = v.logo
from (values
  ('Muhimbili National Hospital', '/img/partners/muhimbili-national-hospital.png'),
  ('MUHAS', '/img/partners/muhas.png'),
  ('Aga Khan Hospital, Dar es Salaam', '/img/partners/aga-khan-hospital.svg'),
  ('CRDB Bank Foundation', '/img/partners/crdb-bank-foundation.png'),
  ('Amref Health Africa', '/img/partners/amref-health-africa.png'),
  ('Muhimbili Orthopaedic Institute (MOI)', '/img/partners/moi.png'),
  ('Kairuki University', '/img/partners/kairuki-university.png'),
  ('Tanzania Health Summit', '/img/partners/tanzania-health-summit.png'),
  ('CardioTan · JKCI', '/img/partners/jkci.png')
) as v(name, logo)
where p.name = v.name and coalesce(p.logo_url, '') = '';

-- ===================== 0028_youtube_only_and_real_news.sql =====================
-- Basil Media OS · 0028 no Instagram, no invented news.
-- Instagram reels are deleted (work videos are YouTube only).
delete from public.highlights where video_url like '%instagram.com%';
update public.projects_public set video_url = '' where video_url like '%instagram.com%';
-- The six starter stories were sample text, not real news: hide them (editable in Website CMS → Health news).
update public.news_stories set published = false where title in (
  'New national guidelines on antibiotic stewardship for referral hospitals',
  'Registration renewals: council deadline moves to 31 December',
  'Local study: shorter TB regimens hold up in Tanzanian clinics',
  'Paediatric oncology unit opens second ward',
  'Nurses’ conference calls for abstracts on community care',
  'Drug alert: recall of one batch of an oral antibiotic');

-- ===================== 0029_partner_names.sql =====================
-- Basil Media OS · 0029 partner names as on their logos (SNOSSA = its 2026 conference).
update public.partners set name = 'SNOSSA Conference 2026' where name = 'SNOSSA';
update public.partners set name = 'Ampola Regency Hospital' where name = 'Ampola Regency';
update public.partners set name = 'CareHealth & Hospitality Services' where name = 'CareHealth Tanzania';
update public.partners set name = 'SATA · Society of Anaesthesiologists of Tanzania' where name = 'SATA';
update public.partners set name = 'NEDC · National Enterprise and Development Chamber' where name = 'NEDC';

-- ===================== 0030_news_refresh_schedule.sql =====================
-- Basil Media OS · 0030 keep the health news fresh every 2 hours, even with no visitors.
-- Supabase's scheduler (pg_cron) calls the site's /api/news-ingest. That endpoint runs at most once per
-- 2 hours for unauthenticated calls, so no secret is stored here. Stories older than 72 hours are deleted
-- on every run. If the extensions are not available (e.g. plain Postgres), this step is skipped.
do $$
begin
  create extension if not exists pg_net;
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'basil-news-refresh';
  perform cron.schedule('basil-news-refresh', '7 */2 * * *',
    $job$ select net.http_get('https://basilmedia.vercel.app/api/news-ingest', headers := '{"User-Agent":"BasilMedia-Scheduler"}'::jsonb) $job$);
  -- and a database-side clean-up, in case the site is unreachable
  perform cron.unschedule(jobid) from cron.job where jobname = 'basil-news-expire';
  perform cron.schedule('basil-news-expire', '17 * * * *',
    $job$ delete from public.health_feed_items where published_at < now() - interval '72 hours' $job$);
exception when others then
  raise notice 'News schedule not created (%). The site still refreshes news when visitors open it.', sqlerrm;
end $$;

-- ===================== 0031_verified_news_sources.sql =====================
-- Basil Media OS · 0031 verified news only, always with a real photo.
-- Aggregators (AllAfrica) and photo-less feeds (ReliefWeb) are switched off; Tanzanian newsrooms added.
update public.news_sources set enabled = false
where name in ('AllAfrica · Tanzania', 'AllAfrica · Health', 'ReliefWeb · Tanzania', 'ReliefWeb · Epidemics', 'Daily News Tanzania');
insert into public.news_sources (name, url, format, zone, health_only) values
  ('The Citizen', 'https://www.thecitizen.co.tz/rss.xml', 'rss', 'tanzania', true),
  ('Daily News · Health', 'https://dailynews.co.tz/category/health/feed/', 'rss', 'tanzania', false),
  ('HabariLeo', 'https://habarileo.co.tz/feed/', 'rss', 'tanzania', true),
  ('TanzaniaInvest · Health', 'https://www.tanzaniainvest.com/health/feed', 'rss', 'tanzania', false),
  ('The Conversation Africa · Health', 'https://theconversation.com/africa/topics/health-20/articles.atom', 'rss', 'africa', false),
  ('The Guardian · Global health', 'https://www.theguardian.com/global-development/global-health/rss', 'rss', 'world', false),
  ('STAT News', 'https://www.statnews.com/feed/', 'rss', 'world', false),
  ('NPR · Health', 'https://feeds.npr.org/1128/rss.xml', 'rss', 'world', false)
on conflict (url) do update set enabled = true;
-- remove stories from switched-off sources and any story without a photo
delete from public.health_feed_items i using public.news_sources s where i.source_id = s.id and not s.enabled;
delete from public.health_feed_items where coalesce(image_url, '') = '';
-- The starter opportunities were sample text, not real openings: hide them (editable in the CMS).
update public.opportunities set published = false where title in
  ('Consultant Paediatrician', 'Clinical research fellowship (12 months)', 'Masters scholarship in public health', 'Call for abstracts: community nursing');

-- ===================== 0032_more_partner_logos.sql =====================
-- Basil Media OS · 0032 SNOSSA and Ampola Regency Hospital logos (from their own websites).
update public.partners set logo_url = '/img/partners/snossa.png' where name in ('SNOSSA Conference 2026', 'SNOSSA') and coalesce(logo_url, '') = '';
update public.partners set logo_url = '/img/partners/ampola-regency-hospital.png' where name in ('Ampola Regency Hospital', 'Ampola Regency') and coalesce(logo_url, '') = '';

