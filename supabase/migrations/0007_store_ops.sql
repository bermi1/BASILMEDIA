-- Basil Media OS · 0007 media store & office operations
-- Gear register, check-out/in, kits, reservations, maintenance, incidents, consumables, stock-take,
-- outside rentals, reception (visitors, parcels, meeting rooms) and transport (vehicles, trips, fuel).
-- Runs after 0005 (projects, clients).

-- ---------- helpers ----------
create or replace function public.is_store_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_any_role(auth.uid(), array['storekeeper', 'gm_cfo', 'boss']::public.app_role[]);
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role <> 'client');
$$;
create or replace function public.is_reception() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_any_role(auth.uid(), array['receptionist', 'gm_cfo', 'boss']::public.app_role[]);
$$;

-- ---------- gear ----------
create table public.gear_items (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  tag text not null unique,
  name text not null,
  category text not null default 'Other',
  make text not null default '',
  model text not null default '',
  serial text not null default '',
  purchase_date date,
  purchase_price numeric(14, 2) not null default 0 check (purchase_price >= 0),
  supplier text not null default '',
  condition text not null default 'Good' check (condition in ('Excellent', 'Good', 'Fair', 'Poor', 'Damaged')),
  location text not null default '',
  accessories text not null default '',
  insurance_expiry date,
  warranty_expiry date,
  photo_url text not null default '',
  day_rate numeric(14, 2) not null default 0 check (day_rate >= 0),
  useful_life_years int not null default 5 check (useful_life_years > 0),
  salvage_value numeric(14, 2) not null default 0,
  holder_id uuid references auth.users (id),
  status text not null default 'available' check (status in ('available', 'out', 'reserved', 'in_repair', 'out_of_service')),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.gear_kits (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  code text not null unique,
  name text not null,
  description text not null default '',
  gear_ids uuid[] not null default '{}',
  extras text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.kit_checkouts (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  kit_id uuid not null references public.gear_kits (id),
  holder_id uuid not null references auth.users (id),
  project_id uuid references public.projects (id),
  due_at timestamptz not null,
  out_at timestamptz,
  returned_at timestamptz,
  checklist jsonb not null default '[]',
  status text not null default 'packing' check (status in ('packing', 'out', 'returned')),
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.gear_checkouts (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  gear_id uuid not null references public.gear_items (id),
  kit_checkout_id uuid references public.kit_checkouts (id),
  holder_id uuid not null references auth.users (id),
  project_id uuid references public.projects (id),
  checked_out_by uuid references auth.users (id),
  out_at timestamptz not null default now(),
  due_at timestamptz not null,
  out_condition text not null default 'Good',
  out_note text not null default '',
  out_photo_url text not null default '',
  acknowledged_at timestamptz,
  returned_at timestamptz,
  in_condition text,
  in_note text not null default '',
  in_photo_url text not null default '',
  checked_in_by uuid references auth.users (id),
  status text not null default 'out' check (status in ('out', 'returned')),
  return_requested_at timestamptz,
  extension_requested_to timestamptz,
  extension_reason text not null default '',
  created_at timestamptz not null default now()
);
create unique index gear_one_open_checkout on public.gear_checkouts (gear_id) where status = 'out';
create index on public.gear_checkouts (holder_id, status);

create table public.gear_reservations (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  gear_id uuid not null references public.gear_items (id),
  project_id uuid references public.projects (id),
  holder_id uuid not null references auth.users (id),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  note text not null default '',
  status text not null default 'reserved' check (status in ('reserved', 'cancelled', 'collected')),
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.gear_maintenance (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  gear_id uuid not null references public.gear_items (id),
  date date not null default current_date,
  kind text not null default 'Service',
  description text not null default '',
  vendor text not null default '',
  cost numeric(14, 2) not null default 0 check (cost >= 0),
  status text not null default 'open' check (status in ('open', 'done')),
  done_at date,
  logged_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.gear_incidents (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  gear_id uuid not null references public.gear_items (id),
  checkout_id uuid references public.gear_checkouts (id),
  kind text not null check (kind in ('damage', 'loss')),
  description text not null,
  photo_url text not null default '',
  holder_id uuid references auth.users (id),
  reported_by uuid not null default auth.uid() references auth.users (id),
  estimated_cost numeric(14, 2) not null default 0,
  decision text not null default 'pending' check (decision in ('pending', 'repair', 'insurance_claim', 'staff_liable', 'client_liable', 'write_off')),
  decision_note text not null default '',
  decided_by uuid references auth.users (id),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  check (decided_by is null or decided_by <> reported_by)
);

create table public.consumables (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  name text not null,
  category text not null default 'Other',
  unit text not null default 'pc',
  quantity int not null default 0 check (quantity >= 0),
  min_level int not null default 0,
  unit_cost numeric(14, 2) not null default 0,
  location text not null default '',
  created_at timestamptz not null default now()
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  consumable_id uuid not null references public.consumables (id),
  kind text not null check (kind in ('issue', 'receive', 'adjust')),
  quantity int not null,
  person_id uuid references auth.users (id),
  project_id uuid references public.projects (id),
  note text not null default '',
  by_id uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.stock_takes (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  started_by uuid default auth.uid() references auth.users (id),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  found_ids uuid[] not null default '{}',
  missing_ids uuid[] not null default '{}',
  status text not null default 'open' check (status in ('open', 'completed')),
  note text not null default '',
  created_at timestamptz not null default now()
);

create table public.gear_rentals (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  agreement_no text not null unique,
  renter_name text not null,
  renter_company text not null default '',
  renter_phone text not null,
  renter_id_number text not null default '',
  gear_ids uuid[] not null,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  pricing text not null default 'day' check (pricing in ('day', 'week')),
  rate numeric(14, 2) not null default 0,
  deposit numeric(14, 2) not null default 0,
  late_fee_per_day numeric(14, 2) not null default 0,
  status text not null default 'booked' check (status in ('booked', 'out', 'returned', 'closed')),
  returned_at timestamptz,
  inspection_note text not null default '',
  damage_charge numeric(14, 2) not null default 0,
  deposit_refunded numeric(14, 2) not null default 0,
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

-- ---------- reception ----------
create table public.visitors (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  name text not null,
  company text not null default '',
  phone text not null default '',
  purpose text not null default '',
  host_id uuid references auth.users (id),
  expected_at timestamptz,
  signed_in_at timestamptz,
  signed_out_at timestamptz,
  status text not null default 'expected' check (status in ('expected', 'in', 'out')),
  badge_no text not null default '',
  pass_code text not null default '',
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.parcels (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  received_at timestamptz not null default now(),
  courier text not null default '',
  sender text not null default '',
  recipient_id uuid references auth.users (id),
  description text not null,
  tracking_no text not null default '',
  status text not null default 'waiting' check (status in ('waiting', 'collected')),
  collected_at timestamptz,
  collected_by_name text not null default '',
  logged_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.room_bookings (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  room text not null check (room in ('Boardroom', 'Podcast studio', 'Edit suite')),
  date date not null,
  start_hour int not null check (start_hour between 8 and 17),
  end_hour int not null check (end_hour between 9 and 18),
  title text not null default 'Meeting',
  booked_by uuid not null default auth.uid() references auth.users (id),
  status text not null default 'booked' check (status in ('booked', 'cancelled')),
  created_at timestamptz not null default now(),
  check (end_hour > start_hour)
);

-- ---------- transport ----------
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  registration text not null unique,
  make_model text not null default '',
  seats int not null default 4,
  status text not null default 'available' check (status in ('available', 'on_trip', 'in_service', 'out_of_service')),
  insurance_expiry date,
  inspection_expiry date,
  odometer int not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  vehicle_id uuid not null references public.vehicles (id),
  driver_id uuid not null references auth.users (id),
  project_id uuid references public.projects (id),
  purpose text not null default '',
  origin text not null default 'Basil Media, Mikocheni',
  destination text not null,
  depart_at timestamptz not null,
  return_at timestamptz,
  passengers text not null default '',
  cargo text not null default '',
  stage text not null default 'Scheduled' check (stage in ('Scheduled', 'Dispatched', 'Arrived', 'Delivered', 'Returned')),
  stage_log jsonb not null default '[]',
  issue_note text not null default '',
  created_at timestamptz not null default now()
);

create table public.fuel_logs (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  vehicle_id uuid not null references public.vehicles (id),
  trip_id uuid references public.trips (id),
  project_id uuid references public.projects (id),
  driver_id uuid not null default auth.uid() references auth.users (id),
  date date not null default current_date,
  litres numeric(8, 2) not null check (litres > 0),
  cost numeric(14, 2) not null check (cost > 0),
  odometer int not null default 0,
  station text not null default '',
  receipt_url text not null default '',
  created_at timestamptz not null default now()
);

create table public.vehicle_issues (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  vehicle_id uuid not null references public.vehicles (id),
  reported_by uuid not null default auth.uid() references auth.users (id),
  description text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

-- ---------- row level security ----------
alter table public.gear_items enable row level security;
alter table public.gear_kits enable row level security;
alter table public.kit_checkouts enable row level security;
alter table public.gear_checkouts enable row level security;
alter table public.gear_reservations enable row level security;
alter table public.gear_maintenance enable row level security;
alter table public.gear_incidents enable row level security;
alter table public.consumables enable row level security;
alter table public.stock_movements enable row level security;
alter table public.stock_takes enable row level security;
alter table public.gear_rentals enable row level security;
alter table public.visitors enable row level security;
alter table public.parcels enable row level security;
alter table public.room_bookings enable row level security;
alter table public.vehicles enable row level security;
alter table public.trips enable row level security;
alter table public.fuel_logs enable row level security;
alter table public.vehicle_issues enable row level security;

-- Gear: any staff reads; storekeeper and leaders manage.
create policy "staff read gear" on public.gear_items for select to authenticated using (public.is_staff());
create policy "store manages gear" on public.gear_items for all to authenticated using (public.is_store_manager()) with check (public.is_store_manager());
create policy "staff read kits" on public.gear_kits for select to authenticated using (public.is_staff());
create policy "store manages kits" on public.gear_kits for all to authenticated using (public.is_store_manager()) with check (public.is_store_manager());

-- Check-outs: holders read their own; store reads/manages all (writes go through functions below).
create policy "own or store reads checkouts" on public.gear_checkouts for select to authenticated using (holder_id = auth.uid() or public.is_store_manager());
create policy "store manages checkouts" on public.gear_checkouts for all to authenticated using (public.is_store_manager()) with check (public.is_store_manager());
create policy "own or store reads kit checkouts" on public.kit_checkouts for select to authenticated using (holder_id = auth.uid() or public.is_store_manager());
create policy "store manages kit checkouts" on public.kit_checkouts for all to authenticated using (public.is_store_manager()) with check (public.is_store_manager());

create policy "staff read reservations" on public.gear_reservations for select to authenticated using (public.is_staff());
create policy "staff reserve for self" on public.gear_reservations for insert to authenticated with check (public.is_store_manager() or (public.is_staff() and holder_id = auth.uid()));
create policy "store or owner updates reservation" on public.gear_reservations for update to authenticated using (public.is_store_manager() or holder_id = auth.uid());

create policy "store reads maintenance" on public.gear_maintenance for select to authenticated using (public.is_store_manager());
create policy "store manages maintenance" on public.gear_maintenance for all to authenticated using (public.is_store_manager()) with check (public.is_store_manager());

create policy "store or involved reads incidents" on public.gear_incidents for select to authenticated using (public.is_store_manager() or holder_id = auth.uid() or reported_by = auth.uid());
create policy "staff report incidents" on public.gear_incidents for insert to authenticated with check (public.is_staff() and reported_by = auth.uid() and decision = 'pending');
create policy "leaders decide incidents" on public.gear_incidents for update to authenticated
  using (public.has_any_role(auth.uid(), array['gm_cfo', 'boss']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['gm_cfo', 'boss']::public.app_role[]) and (decided_by is null or decided_by <> reported_by));

create policy "staff read consumables" on public.consumables for select to authenticated using (public.is_staff());
create policy "store manages consumables" on public.consumables for all to authenticated using (public.is_store_manager()) with check (public.is_store_manager());
create policy "store reads movements" on public.stock_movements for select to authenticated using (public.is_store_manager() or person_id = auth.uid());
create policy "store manages stock takes" on public.stock_takes for all to authenticated using (public.is_store_manager()) with check (public.is_store_manager());
create policy "store manages rentals" on public.gear_rentals for all to authenticated using (public.is_store_manager()) with check (public.is_store_manager());

-- Reception: receptionist manages; hosts see their own visitors and parcels.
create policy "reception or host reads visitors" on public.visitors for select to authenticated using (public.is_reception() or host_id = auth.uid());
create policy "reception manages visitors" on public.visitors for all to authenticated using (public.is_reception()) with check (public.is_reception());
create policy "staff pre-register own guests" on public.visitors for insert to authenticated with check (public.is_staff() and host_id = auth.uid() and status = 'expected');
create policy "reception or recipient reads parcels" on public.parcels for select to authenticated using (public.is_reception() or recipient_id = auth.uid());
create policy "reception manages parcels" on public.parcels for all to authenticated using (public.is_reception()) with check (public.is_reception());
create policy "staff read rooms" on public.room_bookings for select to authenticated using (public.is_staff());
create policy "staff book rooms" on public.room_bookings for insert to authenticated with check (public.is_staff() and booked_by = auth.uid());
create policy "cancel own booking" on public.room_bookings for update to authenticated using (booked_by = auth.uid() or public.is_reception()) with check (booked_by = auth.uid() or public.is_reception());

-- Transport: drivers see their own trips; GM/CFO and Boss manage.
create policy "staff read vehicles" on public.vehicles for select to authenticated using (public.is_staff());
create policy "leaders manage vehicles" on public.vehicles for all to authenticated using (public.has_any_role(auth.uid(), array['gm_cfo', 'boss']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['gm_cfo', 'boss']::public.app_role[]));
create policy "driver or leaders read trips" on public.trips for select to authenticated using (driver_id = auth.uid() or public.has_any_role(auth.uid(), array['gm_cfo', 'boss', 'project_lead']::public.app_role[]));
create policy "leaders manage trips" on public.trips for all to authenticated using (public.has_any_role(auth.uid(), array['gm_cfo', 'boss']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['gm_cfo', 'boss']::public.app_role[]));
create policy "driver or leaders read fuel" on public.fuel_logs for select to authenticated using (driver_id = auth.uid() or public.has_any_role(auth.uid(), array['gm_cfo', 'boss', 'finance']::public.app_role[]));
create policy "driver logs fuel" on public.fuel_logs for insert to authenticated with check (driver_id = auth.uid() and public.has_any_role(auth.uid(), array['driver', 'gm_cfo']::public.app_role[]));
create policy "read vehicle issues" on public.vehicle_issues for select to authenticated using (reported_by = auth.uid() or public.has_any_role(auth.uid(), array['gm_cfo', 'boss', 'driver']::public.app_role[]));
create policy "staff report vehicle issues" on public.vehicle_issues for insert to authenticated with check (public.is_staff() and reported_by = auth.uid());
create policy "leaders resolve vehicle issues" on public.vehicle_issues for update to authenticated using (public.has_any_role(auth.uid(), array['gm_cfo', 'boss']::public.app_role[]));

-- ---------- audit ----------
create trigger audit_gear_items after insert or update or delete on public.gear_items for each row execute function public.audit_row();
create trigger audit_gear_checkouts after insert or update or delete on public.gear_checkouts for each row execute function public.audit_row();
create trigger audit_kit_checkouts after insert or update or delete on public.kit_checkouts for each row execute function public.audit_row();
create trigger audit_stock_movements after insert or update or delete on public.stock_movements for each row execute function public.audit_row();
create trigger audit_consumables after insert or update or delete on public.consumables for each row execute function public.audit_row();
create trigger audit_gear_incidents after insert or update or delete on public.gear_incidents for each row execute function public.audit_row();
create trigger audit_gear_maintenance after insert or update or delete on public.gear_maintenance for each row execute function public.audit_row();
create trigger audit_gear_rentals after insert or update or delete on public.gear_rentals for each row execute function public.audit_row();
create trigger audit_stock_takes after insert or update or delete on public.stock_takes for each row execute function public.audit_row();
create trigger audit_fuel_logs after insert or update or delete on public.fuel_logs for each row execute function public.audit_row();
create trigger audit_trips after insert or update or delete on public.trips for each row execute function public.audit_row();

-- ---------- conflict prevention ----------
create or replace function public.room_no_overlap() returns trigger language plpgsql as $$
begin
  if new.status = 'booked' and exists (
    select 1 from public.room_bookings b
    where b.id <> new.id and b.status = 'booked' and b.room = new.room and b.date = new.date
      and new.start_hour < b.end_hour and b.start_hour < new.end_hour
  ) then raise exception '% is already booked at that time', new.room; end if;
  return new;
end;
$$;
create trigger room_no_overlap before insert or update on public.room_bookings for each row execute function public.room_no_overlap();

create or replace function public.reservation_no_overlap() returns trigger language plpgsql as $$
begin
  if new.status = 'reserved' and exists (
    select 1 from public.gear_reservations r
    where r.id <> new.id and r.status = 'reserved' and r.gear_id = new.gear_id
      and new.start_date <= r.end_date and r.start_date <= new.end_date
  ) then raise exception 'This item is already reserved for overlapping dates'; end if;
  return new;
end;
$$;
create trigger reservation_no_overlap before insert or update on public.gear_reservations for each row execute function public.reservation_no_overlap();

-- Low-stock alert whenever a consumable falls to or below its minimum.
create or replace function public.consumable_low_alert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.quantity <= new.min_level and old.quantity > old.min_level then
    perform public.notify_role('storekeeper', 'Low stock · ' || new.name, new.quantity || ' left · minimum ' || new.min_level, '/os/store/consumables', 'alert');
    perform public.notify_role('gm_cfo', 'Low stock · ' || new.name, new.quantity || ' left · minimum ' || new.min_level, '/os/store/consumables', 'alert');
  end if;
  return new;
end;
$$;
create trigger consumable_low_alert after update of quantity on public.consumables for each row execute function public.consumable_low_alert();

-- ---------- workflow functions (atomic) ----------
create or replace function public.gear_checkout(_gear_ids uuid[], _holder uuid, _project uuid, _due timestamptz, _condition text, _note text, _photo text, _kit_checkout uuid default null)
returns uuid[] language plpgsql security definer set search_path = public as $$
declare g record; ids uuid[] := '{}'; new_id uuid; co_id uuid;
begin
  if not public.is_store_manager() then raise exception 'Only the storekeeper or leaders can check gear out'; end if;
  if _holder = auth.uid() and not public.has_any_role(auth.uid(), array['gm_cfo', 'boss']::public.app_role[]) then
    raise exception 'The storekeeper cannot check gear out to themselves';
  end if;
  if _due <= now() then raise exception 'Expected return must be in the future'; end if;
  if coalesce(array_length(_gear_ids, 1), 0) = 0 then raise exception 'Pick at least one item'; end if;
  for g in select * from public.gear_items where id = any(_gear_ids) for update loop
    if g.status not in ('available', 'reserved') then raise exception '% is not available (%)', g.name, g.status; end if;
  end loop;
  foreach new_id in array _gear_ids loop
    insert into public.gear_checkouts (gear_id, kit_checkout_id, holder_id, project_id, checked_out_by, due_at, out_condition, out_note, out_photo_url)
    values (new_id, _kit_checkout, _holder, _project, auth.uid(), _due, coalesce(_condition, 'Good'), coalesce(_note, ''), coalesce(_photo, ''))
    returning id into co_id;
    ids := ids || co_id;
    update public.gear_items set status = 'out', holder_id = _holder, condition = coalesce(_condition, condition) where id = new_id;
    update public.gear_reservations set status = 'collected' where gear_id = new_id and holder_id = _holder and status = 'reserved' and start_date <= current_date;
  end loop;
  perform public.notify(_holder, 'Gear checked out to you (' || array_length(_gear_ids, 1) || ')', 'Please acknowledge on your phone · due ' || to_char(_due at time zone 'Africa/Dar_es_Salaam', 'DD/MM/YYYY HH24:MI'), '/app?tab=gear', 'task');
  return ids;
end;
$$;

create or replace function public.gear_acknowledge(_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.gear_checkouts set acknowledged_at = now()
  where id = any(_ids) and status = 'out' and acknowledged_at is null and (holder_id = auth.uid() or public.is_store_manager());
end;
$$;

create or replace function public.gear_checkin(_checkout uuid, _condition text, _note text, _photo text) returns void
language plpgsql security definer set search_path = public as $$
declare c public.gear_checkouts; damaged boolean := _condition in ('Damaged', 'Poor'); gname text;
begin
  if not public.is_store_manager() then raise exception 'Only the storekeeper or leaders can check gear in'; end if;
  select * into c from public.gear_checkouts where id = _checkout for update;
  if c.id is null or c.status <> 'out' then raise exception 'This check-out is already closed'; end if;
  update public.gear_checkouts set status = 'returned', returned_at = now(), in_condition = _condition, in_note = coalesce(_note, ''), in_photo_url = coalesce(_photo, ''), checked_in_by = auth.uid() where id = _checkout;
  update public.gear_items set status = case when damaged then 'in_repair' else 'available' end, holder_id = null, condition = _condition where id = c.gear_id returning name into gname;
  if damaged then
    insert into public.gear_incidents (gear_id, checkout_id, kind, description, photo_url, holder_id, reported_by)
    values (c.gear_id, _checkout, 'damage', coalesce(nullif(_note, ''), 'Returned damaged'), coalesce(_photo, ''), c.holder_id, auth.uid());
    perform public.notify_role('gm_cfo', 'Damage reported · ' || gname, 'Returned ' || lower(_condition) || ' — decision needed', '/os/store/maintenance', 'alert');
    perform public.notify(c.holder_id, 'Damage noted on return · ' || gname, coalesce(_note, ''), '', 'alert');
  end if;
end;
$$;

create or replace function public.gear_request_extension(_checkout uuid, _kind text, _to timestamptz, _reason text) returns void
language plpgsql security definer set search_path = public as $$
declare c public.gear_checkouts; gname text;
begin
  select * into c from public.gear_checkouts where id = _checkout;
  if c.id is null or c.holder_id <> auth.uid() then raise exception 'Only the holder can ask'; end if;
  select name into gname from public.gear_items where id = c.gear_id;
  if _kind = 'return' then
    update public.gear_checkouts set return_requested_at = now() where id = _checkout;
    perform public.notify_role('storekeeper', 'Return on the way · ' || gname, coalesce(_reason, ''), '/app?tab=returns', 'task');
  else
    if _to is null or _to <= c.due_at then raise exception 'Pick a time later than the current due time'; end if;
    update public.gear_checkouts set extension_requested_to = _to, extension_reason = coalesce(_reason, '') where id = _checkout;
    perform public.notify_role('storekeeper', 'More time requested · ' || gname, coalesce(_reason, ''), '/app?tab=returns', 'approval');
  end if;
end;
$$;

create or replace function public.gear_decide_extension(_checkout uuid, _approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare c public.gear_checkouts;
begin
  if not public.is_store_manager() then raise exception 'Only the storekeeper or leaders decide'; end if;
  select * into c from public.gear_checkouts where id = _checkout for update;
  if c.extension_requested_to is null then raise exception 'No request pending'; end if;
  if c.holder_id = auth.uid() then raise exception 'You cannot approve your own extension'; end if;
  update public.gear_checkouts set due_at = case when _approve then c.extension_requested_to else due_at end, extension_requested_to = null where id = _checkout;
  perform public.notify(c.holder_id, case when _approve then 'Extension approved' else 'Extension declined' end, '', '/app', case when _approve then 'info' else 'alert' end);
end;
$$;

create or replace function public.stock_move(_consumable uuid, _kind text, _qty int, _person uuid, _project uuid, _note text) returns void
language plpgsql security definer set search_path = public as $$
declare c public.consumables; nxt int;
begin
  if not public.is_store_manager() then raise exception 'Only the storekeeper or leaders move stock'; end if;
  select * into c from public.consumables where id = _consumable for update;
  if c.id is null then raise exception 'Not found'; end if;
  if _kind <> 'adjust' and coalesce(_qty, 0) <= 0 then raise exception 'Quantity must be more than zero'; end if;
  nxt := case _kind when 'issue' then c.quantity - _qty when 'receive' then c.quantity + _qty else _qty end;
  if nxt < 0 then raise exception 'Only % % in stock', c.quantity, c.unit; end if;
  update public.consumables set quantity = nxt where id = _consumable;
  insert into public.stock_movements (consumable_id, kind, quantity, person_id, project_id, note, by_id)
  values (_consumable, _kind, case when _kind = 'adjust' then nxt - c.quantity else _qty end, _person, _project, coalesce(_note, ''), auth.uid());
end;
$$;

create or replace function public.visitor_sign_in(_visitor uuid, _name text, _company text, _phone text, _purpose text, _host uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare vid uuid := _visitor; badge text;
begin
  if not public.is_reception() then raise exception 'Only reception signs visitors in'; end if;
  select 'V-' || lpad((count(*) + 31)::text, 3, '0') into badge from public.visitors where signed_in_at::date = current_date;
  if vid is null then
    insert into public.visitors (name, company, phone, purpose, host_id, signed_in_at, status, badge_no)
    values (_name, coalesce(_company, ''), coalesce(_phone, ''), coalesce(_purpose, ''), _host, now(), 'in', badge) returning id into vid;
  else
    update public.visitors set name = _name, company = coalesce(_company, company), phone = coalesce(_phone, phone), purpose = coalesce(_purpose, purpose), host_id = coalesce(_host, host_id), signed_in_at = now(), status = 'in', badge_no = badge where id = vid;
  end if;
  if _host is not null then
    perform public.notify(_host, _name || ' is at reception', coalesce(nullif(_company, '') || ' · ', '') || coalesce(_purpose, '') || ' · badge ' || badge, '', 'task');
  end if;
  return vid;
end;
$$;

create or replace function public.trip_advance(_trip uuid, _stage text, _note text default '') returns void
language plpgsql security definer set search_path = public as $$
declare t public.trips; stages text[] := array['Scheduled', 'Dispatched', 'Arrived', 'Delivered', 'Returned'];
begin
  select * into t from public.trips where id = _trip for update;
  if t.id is null then raise exception 'Trip not found'; end if;
  if t.driver_id <> auth.uid() and not public.has_any_role(auth.uid(), array['gm_cfo', 'boss']::public.app_role[]) then raise exception 'Only the assigned driver updates this trip'; end if;
  if array_position(stages, _stage) is distinct from array_position(stages, t.stage) + 1 then raise exception 'Trip is %; next step is %', t.stage, stages[array_position(stages, t.stage) + 1]; end if;
  update public.trips set stage = _stage, stage_log = stage_log || jsonb_build_object('stage', _stage, 'at', now(), 'by', auth.uid()),
    issue_note = case when coalesce(_note, '') <> '' then _note else issue_note end, return_at = case when _stage = 'Returned' then now() else return_at end
  where id = _trip;
  update public.vehicles set status = case when _stage = 'Returned' then 'available' else 'on_trip' end where id = t.vehicle_id;
  perform public.notify_role('gm_cfo', 'Trip ' || lower(_stage) || ' · ' || t.destination, t.purpose, '/os/transport', 'info');
end;
$$;

revoke execute on function public.gear_checkout(uuid[], uuid, uuid, timestamptz, text, text, text, uuid) from anon;
revoke execute on function public.gear_acknowledge(uuid[]) from anon;
revoke execute on function public.gear_checkin(uuid, text, text, text) from anon;
revoke execute on function public.gear_request_extension(uuid, text, timestamptz, text) from anon;
revoke execute on function public.gear_decide_extension(uuid, boolean) from anon;
revoke execute on function public.stock_move(uuid, text, int, uuid, uuid, text) from anon;
revoke execute on function public.visitor_sign_in(uuid, text, text, text, text, uuid) from anon;
revoke execute on function public.trip_advance(uuid, text, text) from anon;

-- Starter kits and consumables (gear itself is entered by the storekeeper; demo mode ships 38 items).
insert into public.consumables (name, category, unit, quantity, min_level, unit_cost, location) values
  ('AA batteries (pack of 4)', 'Batteries', 'pack', 0, 10, 9000, 'Charging station'),
  ('SD cards V90 128GB', 'Memory cards', 'pc', 0, 6, 90000, 'Data shelf'),
  ('XLR cables 3m', 'Cables', 'pc', 0, 8, 25000, 'Audio cabinet'),
  ('Gaffer tape 50mm', 'Tape', 'roll', 0, 5, 38000, 'Grip room');
