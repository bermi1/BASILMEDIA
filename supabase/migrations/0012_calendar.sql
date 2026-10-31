-- Basil Media OS · 0012 shared calendar.
-- 1. calendar_events: custom events any staff member can add (meetings, client reviews, office holidays…).
-- 2. calendar_feed(): one security-definer read of the shared company layers (projects, shoots, retainer
--    visits, trips, rooms, growth events, leave) trimmed to calendar fields only, so every staff role sees
--    the shared calendar without being granted budgets, reasons or other row detail. Clients get only their
--    own client's projects, shoots and retainer schedule. Finance due dates stay under 0006's RLS.

create table public.calendar_events (
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
create index on public.calendar_events (starts_at);
create index on public.calendar_events (ends_at);
create index on public.calendar_events (client_id);
create index on public.calendar_events (project_id);
create index on public.calendar_events (created_by);
create index on public.calendar_events using gin (attendees);
create trigger touch_calendar_events before update on public.calendar_events for each row execute function public.touch_updated_at();
create trigger audit_calendar_events after insert or update or delete on public.calendar_events for each row execute function public.audit_row();

alter table public.calendar_events enable row level security;

-- Staff see company-wide ('everyone') and staff events; anyone sees events they created or were invited to;
-- clients see 'everyone' events tagged with their own client.
create policy "read calendar events" on public.calendar_events for select to authenticated using (
  (public.is_staff() and visibility in ('everyone', 'staff'))
  or created_by = auth.uid()
  or auth.uid() = any (attendees)
  or (visibility = 'everyone' and client_id in (select public.my_client_ids()))
);
create policy "staff add calendar events" on public.calendar_events for insert to authenticated
  with check (public.is_staff() and created_by = auth.uid());
create policy "organiser or leaders edit calendar events" on public.calendar_events for update to authenticated
  using (created_by = auth.uid() or public.has_any_role(auth.uid(), array['boss', 'gm_cfo']::public.app_role[]))
  with check (created_by = auth.uid() or public.has_any_role(auth.uid(), array['boss', 'gm_cfo']::public.app_role[]));
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
