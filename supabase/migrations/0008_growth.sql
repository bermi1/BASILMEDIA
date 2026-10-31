-- Basil Media OS · 0008 growth, clients/retainers and boss cockpit.
-- Runs after 0005 (clients, projects). References public.clients / public.projects by FK only.
-- Every table: RLS + audit trigger. Anonymous visitors may only insert share_events and read a
-- published showcase / deal room through security-definer functions.

-- ---------- helpers ----------
create or replace function public.is_growth_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_any_role(auth.uid(), array['growth', 'account_manager', 'gm_cfo', 'boss']::public.app_role[]);
$$;

create table public.client_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'approver', 'requester', 'viewer')),
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);

-- The client ids the signed-in user belongs to (empty for staff).
create or replace function public.my_client_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select client_id from public.client_users where user_id = auth.uid();
$$;
create or replace function public.my_client_role(_client uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.client_users where user_id = auth.uid() and client_id = _client limit 1;
$$;

alter table public.client_users enable row level security;
create policy "own client membership" on public.client_users for select to authenticated using (user_id = auth.uid() or public.is_growth_staff());
create policy "growth manages client users" on public.client_users for all to authenticated using (public.is_growth_staff()) with check (public.is_growth_staff());

-- Client portal users may read their own client record (additive policy on 0005's table).
create policy "client reads own client" on public.clients for select to authenticated using (id in (select public.my_client_ids()));

-- ---------- CRM ----------
create table public.crm_organisations (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  name text not null,
  type text not null default 'Corporate',
  sector text not null default '',
  client_id uuid references public.clients (id) on delete set null,
  city text not null default '', phone text not null default '', email text not null default '', website text not null default '', notes text not null default '',
  created_at timestamptz not null default now()
);
create table public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  organisation_id uuid not null references public.crm_organisations (id) on delete cascade,
  full_name text not null, title text not null default '', phone text not null default '', email text not null default '',
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  title text not null,
  organisation_id uuid not null references public.crm_organisations (id),
  contact_id uuid references public.crm_contacts (id) on delete set null,
  stage text not null default 'New' check (stage in ('New', 'Contacted', 'Meeting', 'Proposal Sent', 'Negotiation', 'Won', 'Lost')),
  value numeric(14, 2) not null default 0 check (value >= 0),
  probability int not null default 10 check (probability between 0 and 100),
  next_action text not null default '', next_action_date date,
  owner_id uuid references auth.users (id),
  source text not null default '', service text not null default '',
  lost_reason text not null default '',
  booking_id uuid references public.bookings (id) on delete set null,
  notes text not null default '',
  stage_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (stage <> 'Lost' or lost_reason <> '')
);
create index on public.leads (stage);
create table public.lead_activity (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  kind text not null check (kind in ('created', 'stage', 'note')),
  from_stage text, to_stage text, body text not null default '',
  actor_id uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  number text not null unique,
  lead_id uuid references public.leads (id) on delete set null,
  organisation_id uuid references public.crm_organisations (id) on delete set null,
  title text not null, client_name text not null default '',
  status text not null default 'draft' check (status in ('draft', 'awaiting_approval', 'approved', 'sent', 'accepted', 'declined')),
  who_we_are text not null default '', who_you_are text not null default '', what_we_propose text not null default '',
  client_gains text not null default '', how_we_work text not null default '', why_basil text not null default '',
  lines jsonb not null default '[]', discount_pct numeric(5, 2) not null default 0 check (discount_pct between 0 and 100),
  vat_rate numeric(5, 2) not null default 18,
  created_by uuid default auth.uid() references auth.users (id),
  approved_by uuid references auth.users (id), approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  number text not null unique,
  title text not null,
  kind text not null default 'Contract' check (kind in ('Contract', 'MoU', 'Retainer')),
  organisation_id uuid references public.crm_organisations (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  value numeric(14, 2) not null default 0,
  start_date date not null, end_date date not null,
  status text not null default 'draft' check (status in ('draft', 'awaiting_signature', 'active', 'expired', 'terminated')),
  instalments jsonb not null default '[]',
  renewal_notice_days int not null default 90,
  signed_by_name text not null default '', signed_at timestamptz, signed_user_agent text not null default '',
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create table public.tenders (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  title text not null, issuer text not null default '', reference text not null default '',
  closes_on date not null, value_estimate numeric(14, 2) not null default 0,
  status text not null default 'Identified' check (status in ('Identified', 'Preparing', 'Submitted', 'Won', 'Lost', 'Not pursued')),
  owner_id uuid references auth.users (id), documents_needed text not null default '', notes text not null default '',
  created_at timestamptz not null default now()
);
create table public.growth_events (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  title text not null, kind text not null default 'Conference',
  starts_on date not null, ends_on date not null, location text not null default '', role text not null default '',
  owner_id uuid references auth.users (id), cost numeric(14, 2) not null default 0, leads_expected int not null default 0, notes text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- Share Studio ----------
create table public.reference_items (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  project_id uuid references public.projects (id) on delete set null,
  title text not null, client_name text not null default '', sector text not null default '', kind text not null default 'Film',
  year int not null default extract(year from now()), thumbnail_url text not null default '', video_url text not null default '',
  summary text not null default '', results text not null default '',
  cleared boolean not null default false, cleared_by uuid references auth.users (id), cleared_at timestamptz,
  created_at timestamptz not null default now()
);
-- Only Boss or GM/CFO may clear work for sharing (direct updates included).
create or replace function public.guard_reference_clearance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' and new.cleared) or (tg_op = 'UPDATE' and new.cleared is distinct from old.cleared) then
    if not public.has_any_role(auth.uid(), array['boss', 'gm_cfo']::public.app_role[]) then
      raise exception 'Only the Boss or GM/CFO can clear work for sharing';
    end if;
    new.cleared_by := case when new.cleared then auth.uid() end;
    new.cleared_at := case when new.cleared then now() end;
  end if;
  return new;
end;
$$;
create trigger guard_reference_clearance before insert or update on public.reference_items for each row execute function public.guard_reference_clearance();

create table public.showcases (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  title text not null,
  mode text not null default 'showcase' check (mode in ('showcase', 'linktree')),
  recipient_name text not null default '',
  organisation_id uuid references public.crm_organisations (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  welcome text not null default '',
  item_ids jsonb not null default '[]' check (jsonb_array_length(item_ids) <= 12),
  ctas jsonb not null default '[]', contact jsonb not null default '{}',
  published boolean not null default false, expires_on date,
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
create table public.share_events (
  id uuid primary key default gen_random_uuid(),
  showcase_id uuid not null references public.showcases (id) on delete cascade,
  kind text not null check (kind in ('view', 'like', 'need', 'cta')),
  item_id uuid references public.reference_items (id) on delete set null,
  visitor_id text not null default '', user_agent text not null default '' check (length(user_agent) <= 400),
  created_at timestamptz not null default now()
);
create index on public.share_events (showcase_id, created_at desc);

create table public.deal_rooms (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  token text not null unique default encode(gen_random_bytes(12), 'hex'),
  lead_id uuid not null references public.leads (id) on delete cascade,
  title text not null, client_name text not null default '', value numeric(14, 2) not null default 0,
  showcase_id uuid references public.showcases (id) on delete set null,
  proposal_id uuid references public.proposals (id) on delete set null,
  quotation_url text not null default '',
  contract_id uuid references public.contracts (id) on delete set null,
  contract_terms text not null default '',
  deposit_pct numeric(5, 2) not null default 40, deposit_paid_at timestamptz, kickoff_at timestamptz,
  step int not null default 0 check (step between 0 and 6),
  signed_name text not null default '', signed_at timestamptz, signed_user_agent text not null default '',
  prepared_by uuid default auth.uid() references auth.users (id),
  expires_on date not null default (current_date + 30),
  created_at timestamptz not null default now()
);

-- ---------- Retainers ----------
create table public.retainers (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  number text not null unique,
  client_id uuid not null references public.clients (id),
  tier text not null default 'Growth' check (tier in ('Essential', 'Growth', 'Premium')),
  monthly_fee numeric(14, 2) not null check (monthly_fee >= 0),
  start_date date not null, end_date date not null,
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  allowances jsonb not null default '{}', -- {"shoot_days":4,"podcast_episodes":2,"posts":12,"reels":4,"edited_photos":160}
  rollover text not null default 'none' check (rollover in ('none', 'next_month')),
  rollover_cap_pct int not null default 0 check (rollover_cap_pct between 0 and 100),
  account_manager_id uuid references auth.users (id),
  notes text not null default '',
  created_at timestamptz not null default now(),
  check (end_date > start_date)
);
create table public.allowance_ledger (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  retainer_id uuid not null references public.retainers (id) on delete cascade,
  client_id uuid not null references public.clients (id),
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  unit text not null check (unit in ('shoot_days', 'podcast_episodes', 'posts', 'reels', 'edited_photos')),
  qty numeric(10, 2) not null,
  kind text not null default 'usage' check (kind in ('usage', 'adjustment')),
  source_id uuid, note text not null default '',
  created_at timestamptz not null default now()
);
create index on public.allowance_ledger (retainer_id, month);
create table public.retainer_calendar (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  retainer_id uuid not null references public.retainers (id) on delete cascade,
  client_id uuid not null references public.clients (id),
  project_id uuid references public.projects (id) on delete set null,
  date date not null, time text not null default '09:00',
  kind text not null check (kind in ('shoot', 'podcast', 'delivery', 'review', 'post')),
  title text not null, location text not null default '', map_url text not null default '',
  status text not null default 'Scheduled' check (status in ('Scheduled', 'Crew confirmed', 'On the way', 'Arrived', 'In progress', 'Wrapped', 'Completed')),
  crew jsonb not null default '[]', call_time text not null default '', checklist jsonb not null default '[]',
  units jsonb not null default '{}', signoff jsonb,
  gallery_slug text not null default '', link text not null default '',
  created_at timestamptz not null default now()
);
create index on public.retainer_calendar (client_id, date);
create table public.client_requests (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  number text not null,
  client_id uuid not null references public.clients (id),
  retainer_id uuid not null references public.retainers (id),
  type text not null, title text not null,
  preferred_dates jsonb not null default '[]' check (jsonb_array_length(preferred_dates) between 1 and 3),
  location text not null default '', deliverables text not null default '',
  urgency text not null default 'Normal' check (urgency in ('Normal', 'Soon', 'Urgent')),
  status text not null default 'New' check (status in ('New', 'Reviewing', 'Quote needed', 'Scheduled', 'Declined')),
  units jsonb not null default '{}', over_allowance boolean not null default false,
  quote_amount numeric(14, 2) not null default 0, quote_status text not null default 'none' check (quote_status in ('none', 'sent', 'accepted', 'declined')),
  requested_by uuid default auth.uid() references auth.users (id),
  note text not null default '', scheduled_item_id uuid references public.retainer_calendar (id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.client_concerns (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  client_id uuid not null references public.clients (id),
  subject text not null, body text not null default '',
  severity text not null default 'Medium' check (severity in ('Low', 'Medium', 'High')),
  status text not null default 'Open' check (status in ('Open', 'In progress', 'Resolved')),
  raised_by uuid default auth.uid() references auth.users (id),
  response text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- Boss ----------
create table public.scoreboard_targets (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  year int not null, metric text not null, label text not null,
  unit text not null default 'count' check (unit in ('tsh', 'count', 'pct')),
  target numeric(16, 2) not null check (target > 0), actual numeric(16, 2) not null default 0, sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (division_id, year, metric)
);
create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  decided_on date not null default current_date, title text not null, context text not null default '', decision text not null,
  decided_by uuid default auth.uid() references auth.users (id), owner_id uuid references auth.users (id),
  review_on date, status text not null default 'Active' check (status in ('Active', 'Reviewed', 'Reversed')),
  created_at timestamptz not null default now()
);

-- ---------- RLS ----------
do $$
declare t text;
begin
  foreach t in array array['client_users', 'crm_organisations', 'crm_contacts', 'leads', 'lead_activity', 'proposals', 'contracts', 'tenders', 'growth_events',
    'reference_items', 'showcases', 'share_events', 'deal_rooms', 'retainers', 'allowance_ledger', 'retainer_calendar', 'client_requests', 'client_concerns',
    'scoreboard_targets', 'decisions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create trigger audit_%s after insert or update or delete on public.%I for each row execute function public.audit_row()', t, t);
  end loop;
  -- Growth staff work the whole CRM / share studio.
  foreach t in array array['crm_organisations', 'crm_contacts', 'leads', 'lead_activity', 'proposals', 'contracts', 'tenders', 'growth_events', 'reference_items', 'showcases', 'deal_rooms'] loop
    execute format('create policy "growth staff all" on public.%I for all to authenticated using (public.is_growth_staff()) with check (public.is_growth_staff())', t);
  end loop;
  -- Retainer tables: growth staff all; clients read only their own client's rows.
  foreach t in array array['retainers', 'allowance_ledger', 'retainer_calendar', 'client_requests', 'client_concerns'] loop
    execute format('create policy "growth staff all" on public.%I for all to authenticated using (public.is_growth_staff()) with check (public.is_growth_staff())', t);
    execute format('create policy "client reads own" on public.%I for select to authenticated using (client_id in (select public.my_client_ids()))', t);
  end loop;
end $$;

-- Crew and project leads read the shoots they are on (call sheets).
create policy "crew reads own shoots" on public.retainer_calendar for select to authenticated
  using (crew @> jsonb_build_array(jsonb_build_object('user_id', auth.uid()::text)) or public.has_role(auth.uid(), 'project_lead'));
-- Clients raise requests and concerns for their own client only (viewers cannot request).
create policy "client creates request" on public.client_requests for insert to authenticated
  with check (client_id in (select public.my_client_ids()) and public.my_client_role(client_id) in ('owner', 'approver', 'requester')
              and requested_by = auth.uid() and status in ('New', 'Quote needed')
              and retainer_id in (select id from public.retainers where client_id = client_requests.client_id));
create policy "client answers quote" on public.client_requests for update to authenticated
  using (client_id in (select public.my_client_ids()) and public.my_client_role(client_id) in ('owner', 'approver') and status = 'Quote needed')
  with check (client_id in (select public.my_client_ids()) and status in ('Reviewing', 'Declined'));
create policy "client raises concern" on public.client_concerns for insert to authenticated
  with check (client_id in (select public.my_client_ids()) and raised_by = auth.uid() and status = 'Open');

-- Share events: anyone may insert a signal for a live showcase; nobody but growth staff reads them.
create policy "anyone logs a share event" on public.share_events for insert to anon, authenticated
  with check (exists (select 1 from public.showcases s where s.id = showcase_id and s.published and (s.expires_on is null or s.expires_on >= current_date)));
create policy "growth reads share events" on public.share_events for select to authenticated using (public.is_growth_staff());

-- Boss tables.
create policy "leaders read targets" on public.scoreboard_targets for select to authenticated using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'growth']::public.app_role[]));
create policy "boss edits targets" on public.scoreboard_targets for all to authenticated using (public.has_role(auth.uid(), 'boss')) with check (public.has_role(auth.uid(), 'boss'));
create policy "leaders read decisions" on public.decisions for select to authenticated using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo']::public.app_role[]));
create policy "leaders log decisions" on public.decisions for all to authenticated using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['boss', 'gm_cfo']::public.app_role[]));

-- ---------- workflow functions ----------
create or replace function public.move_lead(_lead uuid, _stage text, _lost_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare l public.leads;
begin
  if not public.is_growth_staff() then raise exception 'Not allowed'; end if;
  select * into l from public.leads where id = _lead for update;
  if not found then raise exception 'Lead not found'; end if;
  if _stage = 'Lost' and coalesce(_lost_reason, '') = '' then raise exception 'Choose a lost reason'; end if;
  update public.leads set stage = _stage, lost_reason = case when _stage = 'Lost' then _lost_reason else '' end,
    probability = case _stage when 'Won' then 100 when 'Lost' then 0 else probability end, stage_changed_at = now()
  where id = _lead;
  insert into public.lead_activity (lead_id, kind, from_stage, to_stage, body) values (_lead, 'stage', l.stage, _stage, coalesce(_lost_reason, ''));
  if _stage = 'Won' then perform public.notify_role('boss', 'Deal won', l.title || ' · TSH ' || to_char(l.value, 'FM999,999,999,990'), '/os/growth', 'info'); end if;
end;
$$;

-- Boss approves a proposal discount; the author can never approve their own proposal.
create or replace function public.approve_proposal(_id uuid, _approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare p public.proposals;
begin
  if not public.has_role(auth.uid(), 'boss') then raise exception 'Only the Boss approves proposal discounts'; end if;
  select * into p from public.proposals where id = _id for update;
  if p.status <> 'awaiting_approval' then raise exception 'Proposal is not waiting for approval'; end if;
  if p.created_by = auth.uid() then raise exception 'You cannot approve your own proposal'; end if;
  update public.proposals set status = case when _approve then 'approved' else 'draft' end, approved_by = case when _approve then auth.uid() end, approved_at = case when _approve then now() end where id = _id;
  perform public.notify(p.created_by, case when _approve then 'Proposal approved' else 'Proposal sent back' end, p.title, '/os/growth/proposals/' || _id, 'approval');
end;
$$;
-- A discount above the limit can only leave draft via the boss.
create or replace function public.guard_proposal_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('approved') and old.status <> 'approved' and not public.has_role(auth.uid(), 'boss') then
    raise exception 'Only the Boss approves proposals';
  end if;
  if new.status = 'sent' and old.status = 'draft' and new.discount_pct > 10 then
    raise exception 'Discounts above 10%% need the Boss''s approval first';
  end if;
  if old.status in ('approved', 'sent', 'accepted') and (new.lines is distinct from old.lines or new.discount_pct is distinct from old.discount_pct) then
    raise exception 'Approved figures are locked';
  end if;
  return new;
end;
$$;
create trigger guard_proposal_status before update on public.proposals for each row execute function public.guard_proposal_status();

create or replace function public.set_reference_cleared(_id uuid, _cleared boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_any_role(auth.uid(), array['boss', 'gm_cfo']::public.app_role[]) then raise exception 'Only the Boss or GM/CFO can clear work for sharing'; end if;
  update public.reference_items set cleared = _cleared where id = _id;
end;
$$;

-- Public showcase (anon): only published, unexpired, and only cleared items.
create or replace function public.get_showcase(_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'showcase', jsonb_build_object('id', s.id, 'slug', s.slug, 'title', s.title, 'mode', s.mode, 'recipient_name', s.recipient_name, 'welcome', s.welcome,
                                   'item_ids', s.item_ids, 'ctas', s.ctas, 'contact', s.contact, 'published', s.published, 'expires_on', s.expires_on,
                                   'organisation_id', null, 'lead_id', null, 'created_by', null, 'created_at', s.created_at),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'title', r.title, 'client_name', r.client_name, 'sector', r.sector, 'kind', r.kind, 'year', r.year,
                                   'thumbnail_url', r.thumbnail_url, 'video_url', r.video_url, 'summary', r.summary, 'results', r.results, 'cleared', true) order by x.ord)
                       from jsonb_array_elements_text(s.item_ids) with ordinality x(item, ord) join public.reference_items r on r.id::text = x.item and r.cleared), '[]'))
  from public.showcases s
  where s.slug = _slug and s.published and (s.expires_on is null or s.expires_on >= current_date);
$$;

-- Public deal room by unguessable token.
create or replace function public.get_deal_room(_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'deal', to_jsonb(d) - 'prepared_by' - 'lead_id',
    'proposal', (select jsonb_build_object('id', p.id, 'number', p.number, 'title', p.title, 'what_we_propose', p.what_we_propose, 'client_gains', p.client_gains) from public.proposals p where p.id = d.proposal_id and p.status in ('approved', 'sent', 'accepted')),
    'contract', (select jsonb_build_object('id', c.id, 'number', c.number, 'title', c.title) from public.contracts c where c.id = d.contract_id),
    'showcase_slug', (select s.slug from public.showcases s where s.id = d.showcase_id and s.published))
  from public.deal_rooms d where d.token = _token and d.expires_on >= current_date;
$$;

-- Typed-name e-signature: name + server timestamp + user agent. Signing only once, only after the quotation step.
create or replace function public.sign_deal_room(_token text, _name text, _user_agent text)
returns void language plpgsql security definer set search_path = public as $$
declare d public.deal_rooms;
begin
  select * into d from public.deal_rooms where token = _token and expires_on >= current_date for update;
  if not found then raise exception 'Deal room not found or expired'; end if;
  if d.signed_at is not null then raise exception 'Already signed'; end if;
  if d.step < 3 then raise exception 'Signing is not open yet'; end if;
  if length(trim(coalesce(_name, ''))) < 3 then raise exception 'Type your full name to sign'; end if;
  update public.deal_rooms set signed_name = trim(_name), signed_at = now(), signed_user_agent = left(coalesce(_user_agent, ''), 400), step = greatest(step, 4) where id = d.id;
  if d.contract_id is not null then
    update public.contracts set signed_by_name = trim(_name), signed_at = now(), signed_user_agent = left(coalesce(_user_agent, ''), 400), status = 'active' where id = d.contract_id;
  end if;
  if d.prepared_by is not null then perform public.notify(d.prepared_by, 'Contract signed', d.client_name || ' · ' || d.title, '/os/share/deals/' || d.id, 'info'); end if;
  perform public.notify_role('boss', 'Contract signed', d.client_name || ' · ' || d.title, '/os/share/deals/' || d.id, 'info');
end;
$$;

-- Live shoot status (Account Manager, project lead or crew on that shoot).
create or replace function public.set_shoot_status(_item uuid, _status text)
returns void language plpgsql security definer set search_path = public as $$
declare i public.retainer_calendar;
begin
  select * into i from public.retainer_calendar where id = _item for update;
  if not found then raise exception 'Not found'; end if;
  if not (public.is_growth_staff() or public.has_role(auth.uid(), 'project_lead') or i.crew @> jsonb_build_array(jsonb_build_object('user_id', auth.uid()::text))) then
    raise exception 'Not allowed';
  end if;
  if _status = 'Completed' then raise exception 'Shoots are completed by the client sign-off'; end if;
  update public.retainer_calendar set status = _status where id = _item;
  if _status in ('On the way', 'Arrived', 'Wrapped') then
    perform public.notify(cu.user_id, 'Crew ' || lower(_status), i.title || ' · ' || i.time, '/app?tab=home', 'info') from public.client_users cu where cu.client_id = i.client_id;
  end if;
end;
$$;

-- Client sign-off: confirm (or report an issue) with 1–5 stars; consumes allowance once.
create or replace function public.client_signoff_shoot(_item uuid, _completed boolean, _rating int, _comment text default '')
returns void language plpgsql security definer set search_path = public as $$
declare i public.retainer_calendar; u record;
begin
  select * into i from public.retainer_calendar where id = _item for update;
  if not found then raise exception 'Not found'; end if;
  if not (i.client_id in (select public.my_client_ids()) and public.my_client_role(i.client_id) in ('owner', 'approver')) then raise exception 'Only the client''s owner or approver can sign off'; end if;
  if i.signoff is not null then raise exception 'Already signed off'; end if;
  if i.status not in ('Wrapped', 'In progress') then raise exception 'The shoot has not wrapped yet'; end if;
  if _rating not between 1 and 5 then raise exception 'Choose 1–5 stars'; end if;
  update public.retainer_calendar set status = 'Completed',
    signoff = jsonb_build_object('outcome', case when _completed then 'completed' else 'issue' end, 'rating', _rating, 'comment', coalesce(_comment, ''), 'at', now(), 'by', auth.uid())
  where id = _item;
  for u in select key, value from jsonb_each_text(i.units) loop
    insert into public.allowance_ledger (retainer_id, client_id, month, unit, qty, kind, source_id, note)
    values (i.retainer_id, i.client_id, to_char(i.date, 'YYYY-MM'), u.key, u.value::numeric, 'usage', i.id, 'Signed off: ' || i.title);
  end loop;
  perform public.notify(r.account_manager_id, case when _completed then 'Shoot signed off' else 'Client reported an issue' end, i.title || ' · ' || _rating || '★', '/os/retainers', case when _completed then 'info' else 'alert' end)
    from public.retainers r where r.id = i.retainer_id and r.account_manager_id is not null;
end;
$$;

-- Allowance balance for a month: allowance + capped rollover of last month's unused − usage.
create or replace function public.allowance_balance(_retainer uuid, _month text)
returns table (unit text, allowance numeric, carried numeric, used numeric, remaining numeric)
language sql stable security definer set search_path = public as $$
  with r as (select * from public.retainers where id = _retainer and (public.is_growth_staff() or client_id in (select public.my_client_ids()))),
  prev as (select to_char(to_date(_month || '-01', 'YYYY-MM-DD') - interval '1 month', 'YYYY-MM') m),
  u as (select k.key unit, k.value::numeric allowance from r, jsonb_each_text(r.allowances) k),
  b as (
    select u.unit, u.allowance,
      case when r.rollover = 'next_month' and (select m from prev) >= to_char(r.start_date, 'YYYY-MM') then
        least(greatest(0, u.allowance - coalesce((select sum(qty) from public.allowance_ledger l where l.retainer_id = r.id and l.unit = u.unit and l.month = (select m from prev)), 0)), floor(u.allowance * r.rollover_cap_pct / 100.0))
      else 0 end as carried,
      coalesce((select sum(qty) from public.allowance_ledger l where l.retainer_id = r.id and l.unit = u.unit and l.month = _month), 0) as used
    from u, r)
  select unit, allowance, carried, used, allowance + carried - used from b;
$$;

-- Account Manager moves a client request; clients hear about it.
create or replace function public.set_request_status(_id uuid, _status text, _quote numeric default null, _note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare q public.client_requests;
begin
  if not public.has_any_role(auth.uid(), array['account_manager', 'growth', 'gm_cfo', 'boss']::public.app_role[]) then raise exception 'Not allowed'; end if;
  select * into q from public.client_requests where id = _id for update;
  if not found then raise exception 'Not found'; end if;
  update public.client_requests set status = _status, note = coalesce(_note, note),
    quote_amount = coalesce(_quote, quote_amount), quote_status = case when _quote is not null then 'sent' else quote_status end
  where id = _id;
  perform public.notify(cu.user_id, 'Request ' || lower(_status), q.title, '/app?tab=requests', 'info') from public.client_users cu where cu.client_id = q.client_id;
end;
$$;

-- Notify the account manager when a client raises a request or concern.
create or replace function public.notify_client_ticket()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'client_requests' then
    perform public.notify(r.account_manager_id, 'New client request', new.title, '/os/retainers/requests', 'task') from public.retainers r where r.id = new.retainer_id and r.account_manager_id is not null;
  else
    perform public.notify_role('account_manager', 'Client raised a concern', new.subject, '/os/retainers/concerns', 'alert');
    perform public.notify_role('boss', 'Client raised a concern', new.subject, '/os/retainers/concerns', 'alert');
  end if;
  return new;
end;
$$;
create trigger notify_client_request after insert on public.client_requests for each row execute function public.notify_client_ticket();
create trigger notify_client_concern after insert on public.client_concerns for each row execute function public.notify_client_ticket();

revoke execute on function public.move_lead(uuid, text, text) from anon;
revoke execute on function public.approve_proposal(uuid, boolean) from anon;
revoke execute on function public.set_reference_cleared(uuid, boolean) from anon;
revoke execute on function public.set_shoot_status(uuid, text) from anon;
revoke execute on function public.client_signoff_shoot(uuid, boolean, int, text) from anon;
revoke execute on function public.set_request_status(uuid, text, numeric, text) from anon;
revoke execute on function public.allowance_balance(uuid, text) from anon;
grant execute on function public.get_showcase(text) to anon, authenticated;
grant execute on function public.get_deal_room(text) to anon, authenticated;
grant execute on function public.sign_deal_room(text, text, text) to anon, authenticated;
