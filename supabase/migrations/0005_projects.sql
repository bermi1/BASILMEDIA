-- Basil Media OS · 0005 projects, production & people.
-- Runs first of the module migrations: creates clients and projects (referenced by finance 0006 and store 0007),
-- plus tasks, shoots & call sheets, post-production, footage safety and the staff portal.

-- ============ helpers ============
create or replace function public.is_leader(_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_any_role(_user, array['boss', 'gm_cfo']::public.app_role[]);
$$;

-- Roles that see every project (staff only see projects they lead or crew on).
create or replace function public.sees_all_projects(_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_any_role(_user, array['boss', 'gm_cfo', 'finance', 'project_lead', 'storekeeper', 'growth', 'account_manager']::public.app_role[]);
$$;

create or replace function public.is_staff(_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user and role <> 'client');
$$;

-- ============ clients & projects ============
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  name text not null,
  sector text not null default '',
  contact_name text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  tin text not null default '',
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  code text unique,
  name text not null,
  client_id uuid references public.clients (id),
  service text not null default '',
  template text,
  stage text not null default 'Brief' check (stage in ('Brief', 'Pre-production', 'Shoot', 'Ingest & Backup', 'Edit', 'Internal Review', 'Client Review', 'Revisions', 'Final Delivery', 'Invoice', 'Archive')),
  lead_id uuid references auth.users (id),
  start_date date,
  end_date date,
  budget numeric(14, 2) not null default 0,
  contract_value numeric(14, 2) not null default 0,
  spent numeric(14, 2) not null default 0, -- kept current by finance
  priority text not null default 'Normal' check (priority in ('Low', 'Normal', 'High', 'Urgent')),
  location text not null default '',
  health text not null default 'green' check (health in ('green', 'amber', 'red')),
  description text not null default '',
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.projects (stage);
create trigger touch_projects before update on public.projects for each row execute function public.touch_updated_at();

create table public.project_crew (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'Crew',
  days int not null default 0,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create or replace function public.is_project_member(_project uuid, _user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects where id = _project and lead_id = _user)
      or exists (select 1 from public.project_crew where project_id = _project and user_id = _user);
$$;
create or replace function public.can_see_project(_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.sees_all_projects(auth.uid()) or public.is_project_member(_project, auth.uid());
$$;
create or replace function public.can_manage_project(_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'project_lead']::public.app_role[])
      or exists (select 1 from public.projects where id = _project and lead_id = auth.uid());
$$;

-- ============ tasks ============
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  description text not null default '',
  assignee_id uuid references auth.users (id),
  due_date date,
  priority text not null default 'Normal' check (priority in ('Low', 'Normal', 'High', 'Urgent')),
  status text not null default 'To do' check (status in ('To do', 'In progress', 'Done')),
  checklist jsonb not null default '[]',
  minutes_logged int not null default 0,
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index on public.tasks (assignee_id, status);
create index on public.tasks (project_id);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id),
  body text not null,
  created_at timestamptz not null default now()
);

-- ============ shoots & call sheets ============
create table public.shoots (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  shoot_date date not null,
  call_time text not null default '07:00',
  wrap_time text not null default '17:00',
  location text not null default '',
  contact_name text not null default '',
  contact_phone text not null default '',
  shot_list jsonb not null default '[]',
  equipment text not null default '',
  emergency_contacts text not null default 'Police · Fire · Ambulance 112',
  nearest_hospital text not null default '',
  notes text not null default '',
  status text not null default 'Planned' check (status in ('Planned', 'Wrapped')),
  wrapped_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.shoots (shoot_date);

create table public.shoot_crew (
  id uuid primary key default gen_random_uuid(),
  shoot_id uuid not null references public.shoots (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'Crew',
  call_time text not null default '07:00',
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (shoot_id, user_id)
);

-- ============ post-production ============
create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  spec text not null default '',
  owner_id uuid references auth.users (id),
  due_date date,
  post_status text not null default 'Not started' check (post_status in ('Not started', 'Rough cut', 'Fine cut', 'Colour', 'Sound', 'Graphics', 'Export', 'Ready for review')),
  revision_round int not null default 0,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============ footage safety ============
create table public.media_cards (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  shoot_id uuid not null references public.shoots (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  label text not null,
  kind text not null default 'Memory card' check (kind in ('Memory card', 'Drive')),
  size_gb int not null default 0,
  shot_by uuid default auth.uid() references auth.users (id),
  formatted boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.footage_copies (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.media_cards (id) on delete cascade,
  location text not null,
  verified boolean not null default false,
  verified_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

-- Cards with fewer than 2 verified copies more than 24 h after wrap (Boss "footage at risk").
create or replace view public.footage_at_risk with (security_invoker = true) as
  select m.*, s.title as shoot_title, s.wrapped_at,
         (select count(*) from public.footage_copies c where c.card_id = m.id and c.verified) as verified_copies
  from public.media_cards m join public.shoots s on s.id = m.shoot_id
  where s.wrapped_at is not null and s.wrapped_at < now() - interval '24 hours'
    and (select count(*) from public.footage_copies c where c.card_id = m.id and c.verified) < 2;

-- A card may only be marked formatted once it has 2 verified copies.
create or replace function public.guard_card_format()
returns trigger language plpgsql as $$
begin
  if new.formatted and not old.formatted and (select count(*) from public.footage_copies where card_id = new.id and verified) < 2 then
    raise exception 'Card % needs two verified copies before it can be formatted', new.label;
  end if;
  return new;
end;
$$;
create trigger guard_card_format before update on public.media_cards for each row execute function public.guard_card_format();

-- ============ people ============
create table public.staff_details (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  job_title text not null default '',
  department text not null default '',
  birthday date,
  joined date,
  emergency_contact text not null default '',
  created_at timestamptz not null default now()
);

create table public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  author_id uuid not null default auth.uid() references auth.users (id),
  week_start date not null,
  activities text not null default '',
  hours numeric(5, 1) not null default 0,
  achievements text not null default '',
  challenges text not null default '',
  next_week text not null default '',
  support_needed text not null default '',
  created_at timestamptz not null default now(),
  unique (author_id, week_start)
);

-- Anonymous suggestions store NO author: author_id is forced to null by trigger.
create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  author_id uuid references auth.users (id),
  anonymous boolean not null default true,
  category text not null default 'Idea' check (category in ('Idea', 'Complaint', 'Concern', 'Safety', 'Praise')),
  body text not null,
  status text not null default 'Under review' check (status in ('Under review', 'Accepted', 'Done')),
  reply text not null default '',
  replied_by uuid references auth.users (id),
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  check (not anonymous or author_id is null)
);
create or replace function public.suggestion_author()
returns trigger language plpgsql as $$
begin
  if new.anonymous then new.author_id := null; else new.author_id := auth.uid(); end if;
  new.status := 'Under review'; new.reply := ''; new.replied_by := null; new.replied_at := null;
  return new;
end;
$$;
create trigger suggestion_author before insert on public.suggestions for each row execute function public.suggestion_author();

create table public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  year int not null,
  annual_days int not null default 28,
  unique (user_id, year)
);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  user_id uuid not null default auth.uid() references auth.users (id),
  leave_type text not null check (leave_type in ('Annual', 'Sick', 'Compassionate', 'Maternity / Paternity', 'Unpaid')),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  days numeric(4, 1) not null,
  reason text not null default '',
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected')),
  decided_by uuid references auth.users (id),
  decided_at timestamptz,
  decision_note text not null default '',
  created_at timestamptz not null default now()
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  user_id uuid not null default auth.uid() references auth.users (id),
  day date not null default current_date,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  lat double precision,
  lng double precision,
  place text not null default '',
  created_at timestamptz not null default now()
);
create index on public.attendance (day);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  title text not null,
  body text not null,
  author_id uuid not null default auth.uid() references auth.users (id),
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.announcement_acks (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  unique (announcement_id, user_id)
);

-- ============ RLS ============
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.project_crew enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.shoots enable row level security;
alter table public.shoot_crew enable row level security;
alter table public.deliverables enable row level security;
alter table public.media_cards enable row level security;
alter table public.footage_copies enable row level security;
alter table public.staff_details enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.suggestions enable row level security;
alter table public.leave_balances enable row level security;
alter table public.leave_requests enable row level security;
alter table public.attendance enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_acks enable row level security;

-- clients: staff read; leaders, project leads and account managers write
create policy "staff read clients" on public.clients for select to authenticated using (public.is_staff());
create policy "managers write clients" on public.clients for all to authenticated
  using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'project_lead', 'growth', 'account_manager', 'finance']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'project_lead', 'growth', 'account_manager', 'finance']::public.app_role[]));

-- projects: leaders see all; staff see projects they lead or crew on
create policy "see projects" on public.projects for select to authenticated using (public.can_see_project(id));
create policy "leads create projects" on public.projects for insert to authenticated
  with check (public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'project_lead']::public.app_role[]));
create policy "manage projects" on public.projects for update to authenticated using (public.can_manage_project(id)) with check (public.can_manage_project(id));
create policy "leaders delete projects" on public.projects for delete to authenticated using (public.is_leader());

create policy "see crew" on public.project_crew for select to authenticated using (public.can_see_project(project_id));
create policy "manage crew" on public.project_crew for all to authenticated using (public.can_manage_project(project_id)) with check (public.can_manage_project(project_id));

create policy "see tasks" on public.tasks for select to authenticated using (public.can_see_project(project_id) or assignee_id = auth.uid());
create policy "members add tasks" on public.tasks for insert to authenticated with check (public.can_see_project(project_id));
create policy "update tasks" on public.tasks for update to authenticated using (public.can_manage_project(project_id) or assignee_id = auth.uid() or created_by = auth.uid()) with check (public.can_see_project(project_id) or assignee_id = auth.uid());
create policy "managers delete tasks" on public.tasks for delete to authenticated using (public.can_manage_project(project_id));

create policy "see comments" on public.task_comments for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and (public.can_see_project(t.project_id) or t.assignee_id = auth.uid())));
create policy "add comments" on public.task_comments for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.tasks t where t.id = task_id and (public.can_see_project(t.project_id) or t.assignee_id = auth.uid())));

create policy "see shoots" on public.shoots for select to authenticated
  using (public.can_see_project(project_id) or exists (select 1 from public.shoot_crew c where c.shoot_id = shoots.id and c.user_id = auth.uid()));
create policy "manage shoots" on public.shoots for all to authenticated using (public.can_manage_project(project_id)) with check (public.can_manage_project(project_id));
-- crew can tick the shot list / mark wrapped on shoots they are on
create policy "crew update shoots" on public.shoots for update to authenticated
  using (exists (select 1 from public.shoot_crew c where c.shoot_id = shoots.id and c.user_id = auth.uid()));

create policy "see shoot crew" on public.shoot_crew for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.shoots s where s.id = shoot_id and public.can_see_project(s.project_id)));
create policy "manage shoot crew" on public.shoot_crew for all to authenticated
  using (exists (select 1 from public.shoots s where s.id = shoot_id and public.can_manage_project(s.project_id)))
  with check (exists (select 1 from public.shoots s where s.id = shoot_id and public.can_manage_project(s.project_id)));

create policy "see deliverables" on public.deliverables for select to authenticated using (public.can_see_project(project_id));
create policy "manage deliverables" on public.deliverables for all to authenticated using (public.can_manage_project(project_id)) with check (public.can_manage_project(project_id));
create policy "owner updates deliverable" on public.deliverables for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "see cards" on public.media_cards for select to authenticated using (public.can_see_project(project_id));
create policy "members log cards" on public.media_cards for insert to authenticated with check (public.can_see_project(project_id));
create policy "members update cards" on public.media_cards for update to authenticated using (public.can_see_project(project_id));
create policy "see copies" on public.footage_copies for select to authenticated
  using (exists (select 1 from public.media_cards m where m.id = card_id and public.can_see_project(m.project_id)));
create policy "members log copies" on public.footage_copies for insert to authenticated
  with check (exists (select 1 from public.media_cards m where m.id = card_id and public.can_see_project(m.project_id)));
create policy "members verify copies" on public.footage_copies for update to authenticated
  using (exists (select 1 from public.media_cards m where m.id = card_id and public.can_see_project(m.project_id)))
  with check (verified_by = auth.uid() or not verified);

create policy "staff read details" on public.staff_details for select to authenticated using (public.is_staff());
create policy "own details" on public.staff_details for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "leaders manage details" on public.staff_details for all to authenticated using (public.is_leader()) with check (public.is_leader());

-- weekly reports: author + leaders
create policy "read reports" on public.weekly_reports for select to authenticated using (author_id = auth.uid() or public.is_leader());
create policy "write own report" on public.weekly_reports for insert to authenticated with check (author_id = auth.uid());
create policy "edit own report" on public.weekly_reports for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());

-- suggestions: only the Boss and GM/CFO read the box; authors of named suggestions see their own
create policy "leaders read suggestions" on public.suggestions for select to authenticated using (public.is_leader() or (author_id is not null and author_id = auth.uid()));
create policy "staff suggest" on public.suggestions for insert to authenticated with check (public.is_staff());

create policy "read balances" on public.leave_balances for select to authenticated using (user_id = auth.uid() or public.is_leader());
create policy "leaders set balances" on public.leave_balances for all to authenticated using (public.is_leader()) with check (public.is_leader());

create policy "read leave" on public.leave_requests for select to authenticated
  using (user_id = auth.uid() or public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'project_lead']::public.app_role[]));
create policy "request own leave" on public.leave_requests for insert to authenticated with check (user_id = auth.uid() and status = 'Pending' and decided_by is null);
create policy "withdraw own pending leave" on public.leave_requests for delete to authenticated using (user_id = auth.uid() and status = 'Pending');

create policy "read attendance" on public.attendance for select to authenticated
  using (user_id = auth.uid() or public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'project_lead']::public.app_role[]));
create policy "clock in" on public.attendance for insert to authenticated with check (user_id = auth.uid());
create policy "clock out" on public.attendance for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "staff read announcements" on public.announcements for select to authenticated using (public.is_staff());
create policy "leaders post announcements" on public.announcements for all to authenticated using (public.is_leader()) with check (public.is_leader());
create policy "read acks" on public.announcement_acks for select to authenticated using (user_id = auth.uid() or public.is_leader());
create policy "ack" on public.announcement_acks for insert to authenticated with check (user_id = auth.uid());

-- ============ audit ============
create trigger audit_clients after insert or update or delete on public.clients for each row execute function public.audit_row();
create trigger audit_projects after insert or update or delete on public.projects for each row execute function public.audit_row();
create trigger audit_project_crew after insert or update or delete on public.project_crew for each row execute function public.audit_row();
create trigger audit_tasks after insert or update or delete on public.tasks for each row execute function public.audit_row();
create trigger audit_shoots after insert or update or delete on public.shoots for each row execute function public.audit_row();
create trigger audit_shoot_crew after insert or update or delete on public.shoot_crew for each row execute function public.audit_row();
create trigger audit_deliverables after insert or update or delete on public.deliverables for each row execute function public.audit_row();
create trigger audit_media_cards after insert or update or delete on public.media_cards for each row execute function public.audit_row();
create trigger audit_footage_copies after insert or update or delete on public.footage_copies for each row execute function public.audit_row();
create trigger audit_staff_details after insert or update or delete on public.staff_details for each row execute function public.audit_row();
create trigger audit_leave_requests after insert or update or delete on public.leave_requests for each row execute function public.audit_row();
create trigger audit_leave_balances after insert or update or delete on public.leave_balances for each row execute function public.audit_row();
create trigger audit_attendance after insert or update or delete on public.attendance for each row execute function public.audit_row();
create trigger audit_announcements after insert or update or delete on public.announcements for each row execute function public.audit_row();
-- suggestions are audited without author data on purpose: audit_row stores the row, which has no author when anonymous.
create trigger audit_suggestions after insert or update or delete on public.suggestions for each row execute function public.audit_row();

-- ============ notifications ============
create or replace function public.task_assigned_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare pname text; who text;
begin
  if new.assignee_id is not null and new.assignee_id is distinct from coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    select name into pname from public.projects where id = new.project_id;
    select coalesce(nullif(full_name, ''), 'A colleague') into who from public.profiles where id = auth.uid();
    perform public.notify(new.assignee_id, 'New task: ' || new.title,
      'Basil Media: ' || coalesce(who, 'A colleague') || ' assigned you "' || new.title || '" (' || coalesce(pname, '') || '). Due '
        || coalesce(to_char(new.due_date, 'DD/MM/YYYY'), '—') || ', priority ' || new.priority || '. Open the app: basilmedia.co.tz/app?tab=tasks',
      '/app?tab=tasks', 'task');
  end if;
  return new;
end;
$$;
create trigger task_assigned_notify after insert or update of assignee_id on public.tasks for each row execute function public.task_assigned_notify();

create or replace function public.shoot_crew_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select sh.title, sh.shoot_date, sh.location, p.name as pname into s from public.shoots sh join public.projects p on p.id = sh.project_id where sh.id = new.shoot_id;
  perform public.notify(new.user_id, 'New shoot: ' || s.pname,
    s.title || ' · ' || to_char(s.shoot_date, 'DD/MM/YYYY') || ' · call ' || new.call_time || ' · ' || s.location || '. Read and confirm the call sheet.', '/app?tab=shoots', 'task');
  return new;
end;
$$;
create trigger shoot_crew_notify after insert on public.shoot_crew for each row execute function public.shoot_crew_notify();

create or replace function public.leave_requested_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_role('gm_cfo', 'Leave request to approve', new.leave_type || ' · ' || new.days || ' day(s) from ' || to_char(new.start_date, 'DD/MM/YYYY'), '/os/people/leave', 'approval');
  return new;
end;
$$;
create trigger leave_requested_notify after insert on public.leave_requests for each row execute function public.leave_requested_notify();

-- ============ workflow functions ============
create or replace function public.create_project_from_template(
  _template text, _name text, _client uuid, _lead uuid, _start date, _end date, _budget numeric, _contract numeric,
  _priority text, _location text, _description text, _tasks jsonb, _deliverables jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; t jsonb; n int;
begin
  if not public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'project_lead']::public.app_role[]) then
    raise exception 'Only the Boss, GM/CFO or a project lead can create projects';
  end if;
  select count(*) + 1 into n from public.projects where extract(year from created_at) = extract(year from now());
  insert into public.projects (code, name, client_id, service, template, lead_id, start_date, end_date, budget, contract_value, priority, location, description)
  values ('BM-PRJ-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 3, '0'), _name, _client,
          case _template when 'event' then 'Event Coverage' when 'documentary' then 'Documentary' when 'corporate' then 'Corporate Video'
            when 'podcast' then 'Podcast Series' when 'live' then 'Live Streaming' when 'photo' then 'Photography' when 'retainer' then 'Monthly Retainer' else _template end,
          _template, _lead, _start, _end, coalesce(_budget, 0), coalesce(_contract, 0), coalesce(_priority, 'Normal'), coalesce(_location, ''), coalesce(_description, ''))
  returning id into pid;
  insert into public.project_crew (project_id, user_id, role) values (pid, _lead, 'Project lead') on conflict do nothing;
  for t in select * from jsonb_array_elements(coalesce(_tasks, '[]')) loop
    insert into public.tasks (project_id, title, assignee_id, due_date) values (pid, t ->> 'title', _lead, (t ->> 'due')::date);
  end loop;
  for t in select * from jsonb_array_elements(coalesce(_deliverables, '[]')) loop
    insert into public.deliverables (project_id, title, spec, owner_id, due_date) values (pid, t ->> 'title', coalesce(t ->> 'spec', ''), _lead, _end);
  end loop;
  if _lead <> auth.uid() then
    perform public.notify(_lead, 'You lead a new project: ' || _name, 'Starts ' || to_char(_start, 'DD/MM/YYYY') || ' · due ' || to_char(_end, 'DD/MM/YYYY'), '/app', 'task');
  end if;
  return pid;
end;
$$;

-- Stage gates (same rules as the app): checked for every stage passed on a forward move.
create or replace function public.project_gate(_p public.projects, _stage text)
returns text language plpgsql stable security definer set search_path = public as $$
declare n int;
begin
  case _stage
    when 'Pre-production' then if _p.lead_id is null then return 'Assign a project lead first.'; end if;
    when 'Shoot' then if not exists (select 1 from public.shoots where project_id = _p.id) then return 'Schedule at least one shoot day with a call sheet first.'; end if;
    when 'Edit' then
      if exists (select 1 from public.media_cards m where m.project_id = _p.id and (select count(*) from public.footage_copies c where c.card_id = m.id and c.verified) < 2) then
        return 'Footage not safe: every card needs 2 verified copies.';
      end if;
    when 'Internal Review' then if not exists (select 1 from public.deliverables where project_id = _p.id and post_status <> 'Not started') then return 'At least one deliverable needs a rough cut.'; end if;
    when 'Client Review' then if not exists (select 1 from public.deliverables where project_id = _p.id and post_status = 'Ready for review') then return 'Client Review needs a draft deliverable marked "Ready for review".'; end if;
    when 'Final Delivery' then
      if not exists (select 1 from public.deliverables where project_id = _p.id) or exists (select 1 from public.deliverables where project_id = _p.id and post_status <> 'Ready for review') then
        return 'Every deliverable must be "Ready for review" (client approved).';
      end if;
    when 'Invoice' then if exists (select 1 from public.deliverables where project_id = _p.id and delivered_at is null) then return 'Mark every deliverable as delivered to the client first.'; end if;
    when 'Archive' then
      select count(*) into n from public.tasks where project_id = _p.id and status <> 'Done';
      if n > 0 then return 'Close the ' || n || ' open task(s) first.'; end if;
    else null;
  end case;
  return null;
end;
$$;

create or replace function public.move_project_stage(_project uuid, _stage text)
returns void language plpgsql security definer set search_path = public as $$
declare p public.projects; stages text[] := array['Brief', 'Pre-production', 'Shoot', 'Ingest & Backup', 'Edit', 'Internal Review', 'Client Review', 'Revisions', 'Final Delivery', 'Invoice', 'Archive'];
  i int; why text; from_ix int; to_ix int;
begin
  select * into p from public.projects where id = _project for update;
  if p.id is null then raise exception 'Project not found'; end if;
  if not public.can_manage_project(_project) then raise exception 'Only the project lead, GM/CFO or Boss can move this project'; end if;
  from_ix := array_position(stages, p.stage); to_ix := array_position(stages, _stage);
  if to_ix is null then raise exception 'Unknown stage %', _stage; end if;
  if to_ix > from_ix then
    for i in from_ix + 1 .. to_ix loop
      why := public.project_gate(p, stages[i]);
      if why is not null then raise exception '%: %', stages[i], why; end if;
    end loop;
  end if;
  update public.projects set stage = _stage where id = _project;
  if _stage = 'Invoice' then perform public.notify_role('finance', 'Ready to invoice: ' || p.name, 'All deliverables delivered. Raise the final invoice.', '/os/finance', 'money'); end if;
end;
$$;

create or replace function public.confirm_call_sheet(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.shoot_crew set confirmed_at = now() where id = _id and user_id = auth.uid();
  if not found then raise exception 'You can only confirm your own call sheet'; end if;
end;
$$;

-- Leave: GM/CFO (or Boss) decides; nobody approves their own leave.
create or replace function public.decide_leave(_id uuid, _approve boolean, _note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare l public.leave_requests;
begin
  select * into l from public.leave_requests where id = _id for update;
  if l.id is null then raise exception 'Leave request not found'; end if;
  if not public.is_leader() then raise exception 'Only the GM/CFO or Boss approves leave'; end if;
  if l.user_id = auth.uid() then raise exception 'You cannot approve your own leave'; end if;
  if l.status <> 'Pending' then raise exception 'This request was already decided'; end if;
  update public.leave_requests set status = case when _approve then 'Approved' else 'Rejected' end, decided_by = auth.uid(), decided_at = now(), decision_note = coalesce(_note, '') where id = _id;
  perform public.notify(l.user_id, case when _approve then 'Leave approved' else 'Leave not approved' end,
    l.leave_type || ' · ' || to_char(l.start_date, 'DD/MM/YYYY') || ' – ' || to_char(l.end_date, 'DD/MM/YYYY') || coalesce(' · ' || nullif(_note, ''), ''), '/app', 'approval');
end;
$$;

create or replace function public.reply_suggestion(_id uuid, _status text, _reply text)
returns void language plpgsql security definer set search_path = public as $$
declare s public.suggestions;
begin
  if not public.is_leader() then raise exception 'Only the Boss or GM/CFO can reply to suggestions'; end if;
  update public.suggestions set status = _status, reply = coalesce(_reply, ''), replied_by = auth.uid(), replied_at = now() where id = _id returning * into s;
  if s.id is null then raise exception 'Suggestion not found'; end if;
  if s.author_id is not null then perform public.notify(s.author_id, 'Your suggestion: ' || _status, coalesce(_reply, ''), '/app', 'info'); end if;
end;
$$;

-- Answers to anonymous suggestions are shared with all staff (no author data exists to leak).
create or replace function public.anonymous_answers()
returns setof public.suggestions language sql stable security definer set search_path = public as $$
  select * from public.suggestions where anonymous and reply <> '' and public.is_staff() order by replied_at desc;
$$;

revoke execute on function public.create_project_from_template(text, text, uuid, uuid, date, date, numeric, numeric, text, text, text, jsonb, jsonb) from anon;
revoke execute on function public.move_project_stage(uuid, text) from anon;
revoke execute on function public.confirm_call_sheet(uuid) from anon;
revoke execute on function public.decide_leave(uuid, boolean, text) from anon;
revoke execute on function public.reply_suggestion(uuid, text, text) from anon;
