-- Basil Media OS · ONE-FILE UPDATE for a live database that already ran setup.sql (migrations 0001–0010).
-- Supabase → SQL Editor → paste everything → Run. All-or-nothing: if anything fails, nothing changes.
begin;

-- ===================== 0011_team_socials.sql =====================
-- Basil Media OS · 0011 Instagram and LinkedIn links on team profiles (About page).
alter table public.team add column if not exists instagram_url text not null default '';
alter table public.team add column if not exists linkedin_url text not null default '';

-- ===================== 0012_audience.sql =====================
-- Basil Media OS · 0012 Audience engine: bulk SMS / email / WhatsApp campaigns to Basil Health Brief subscribers.
-- Tables: segments, campaigns, campaign_messages, message_templates, sms_inbox, automations.
-- Sending runs in the `send-campaign` edge function (provider API keys live in Supabase function secrets,
-- never in app_settings). Status: Draft → Awaiting approval / Scheduled → Sending → Sent.

-- ---------- helpers ----------
create or replace function public.is_audience_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_any_role(auth.uid(), array['growth', 'gm_cfo', 'boss']::public.app_role[]);
$$;

-- Audience staff (incl. Boss) may read and update subscribers (0002 only lets CMS editors).
create policy "audience staff read subscribers" on public.subscribers for select to authenticated using (public.is_audience_staff());
create policy "audience staff update subscribers" on public.subscribers for update to authenticated using (public.is_audience_staff()) with check (public.is_audience_staff());

-- Provider settings (provider, sender ID, cost per SMS, approval threshold) — not secrets.
insert into public.app_settings (key, value) values
  ('sms_settings', '{"provider": "beem", "sender_id": "BASILMEDIA", "cost_per_sms": 28, "cost_per_whatsapp": 60, "email_provider": "resend", "email_from": "Basil Health Brief <brief@basilmedia.co.tz>", "whatsapp_phone_id": "", "approval_threshold": 500, "require_approval": true, "batch_size": 50, "batch_delay_ms": 1000, "test_number": ""}')
on conflict (key) do nothing;
create policy "audience staff write sms settings" on public.app_settings for all to authenticated
  using (key = 'sms_settings' and public.is_audience_staff()) with check (key = 'sms_settings' and public.is_audience_staff());

-- ---------- tables ----------
create table public.segments (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  -- {"specialty": [], "region": [], "language": [], "channel": [], "status": [], "sector": []}; empty = any
  filters jsonb not null default '{}',
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  name text not null check (char_length(name) between 1 and 160),
  channel text not null default 'sms' check (channel in ('sms', 'email', 'whatsapp')),
  audience_type text not null default 'segment' check (audience_type in ('segment', 'manual', 'pasted')),
  segment_id uuid references public.segments (id) on delete set null,
  subscriber_ids uuid[] not null default '{}',
  pasted_list text[] not null default '{}',
  subject text not null default '',
  body_en text not null default '',
  body_sw text not null default '',
  status text not null default 'Draft' check (status in ('Draft', 'Awaiting approval', 'Approved', 'Rejected', 'Scheduled', 'Sending', 'Sent', 'Cancelled')),
  scheduled_at timestamptz,
  audience_count int not null default 0,
  est_cost numeric(14, 2) not null default 0,
  sent int not null default 0,
  delivered int not null default 0,
  failed int not null default 0,
  opted_out int not null default 0,
  clicks int not null default 0,
  cost numeric(14, 2) not null default 0,
  requires_approval boolean not null default false,
  approved_by uuid references auth.users (id),
  approved_at timestamptz,
  decision_note text not null default '',
  created_by uuid references auth.users (id) default auth.uid(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index campaigns_status_idx on public.campaigns (status, scheduled_at);

create table public.campaign_messages (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  subscriber_id uuid references public.subscribers (id) on delete set null,
  to_address text not null,
  name text not null default '',
  language text not null default 'en' check (language in ('en', 'sw')),
  body text not null default '',
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'failed', 'opted_out')),
  provider text not null default '',
  provider_ref text not null default '',
  error text not null default '',
  parts int not null default 1,
  cost numeric(12, 2) not null default 0,
  clicked_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);
create index campaign_messages_campaign_idx on public.campaign_messages (campaign_id, status);
create index campaign_messages_ref_idx on public.campaign_messages (provider_ref);

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  key text unique,
  name text not null,
  category text not null default 'General',
  channel text not null default 'sms' check (channel in ('sms', 'email', 'whatsapp')),
  subject text not null default '',
  body_en text not null default '',
  body_sw text not null default '',
  created_at timestamptz not null default now()
);

create table public.sms_inbox (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  from_phone text not null,
  body text not null default '',
  subscriber_id uuid references public.subscribers (id) on delete set null,
  campaign_id uuid references public.campaigns (id) on delete set null,
  received_at timestamptz not null default now(),
  handled boolean not null default false,
  auto_action text not null default '',
  created_at timestamptz not null default now()
);

create table public.automations (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  key text unique,
  name text not null,
  description text not null default '',
  trigger text not null check (trigger in ('subscribe', 'event_before')),
  offset_days int not null default 0,
  channel text not null default 'sms' check (channel in ('sms', 'email', 'whatsapp')),
  template_id uuid references public.message_templates (id) on delete set null,
  enabled boolean not null default false,
  sent_count int not null default 0,
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- RLS ----------
alter table public.segments enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_messages enable row level security;
alter table public.message_templates enable row level security;
alter table public.sms_inbox enable row level security;
alter table public.automations enable row level security;
create policy "audience staff segments" on public.segments for all to authenticated using (public.is_audience_staff()) with check (public.is_audience_staff());
create policy "audience staff campaigns" on public.campaigns for all to authenticated using (public.is_audience_staff()) with check (public.is_audience_staff());
create policy "audience staff read messages" on public.campaign_messages for select to authenticated using (public.is_audience_staff());
create policy "audience staff templates" on public.message_templates for all to authenticated using (public.is_audience_staff()) with check (public.is_audience_staff());
create policy "audience staff inbox" on public.sms_inbox for all to authenticated using (public.is_audience_staff()) with check (public.is_audience_staff());
create policy "audience staff automations" on public.automations for all to authenticated using (public.is_audience_staff()) with check (public.is_audience_staff());
-- campaign_messages are written only by the send-campaign edge function (service role).

create trigger audit_segments after insert or update or delete on public.segments for each row execute function public.audit_row();
create trigger audit_campaigns after insert or update or delete on public.campaigns for each row execute function public.audit_row();
create trigger audit_message_templates after insert or update or delete on public.message_templates for each row execute function public.audit_row();
create trigger audit_automations after insert or update or delete on public.automations for each row execute function public.audit_row();
create trigger audit_sms_inbox after insert or update or delete on public.sms_inbox for each row execute function public.audit_row();

-- ---------- status guard: approval and sending transitions only through the functions below ----------
create or replace function public.audience_campaign_guard()
returns trigger language plpgsql set search_path = public as $$
declare trusted boolean := coalesce(current_setting('audience.via_fn', true), '') = 'on' or coalesce(auth.role(), '') = 'service_role';
begin
  if tg_op = 'INSERT' then
    if not trusted then
      new.status := 'Draft'; new.approved_by := null; new.approved_at := null; new.sent := 0; new.delivered := 0;
      new.failed := 0; new.opted_out := 0; new.clicks := 0; new.cost := 0; new.sent_at := null;
    end if;
    return new;
  end if;
  if trusted then return new; end if;
  if new.approved_by is distinct from old.approved_by or new.approved_at is distinct from old.approved_at
     or new.sent is distinct from old.sent or new.delivered is distinct from old.delivered or new.failed is distinct from old.failed
     or new.cost is distinct from old.cost then
    raise exception 'Approval and delivery results are set by the system only';
  end if;
  if new.status is distinct from old.status and new.status not in ('Draft', 'Cancelled') then
    raise exception 'Use the campaign workflow to change status to %', new.status;
  end if;
  if old.approved_at is not null and (new.body_en, new.body_sw, new.subject, new.audience_type, new.segment_id, new.subscriber_ids, new.pasted_list, new.channel)
     is distinct from (old.body_en, old.body_sw, old.subject, old.audience_type, old.segment_id, old.subscriber_ids, old.pasted_list, old.channel) then
    raise exception 'An approved campaign cannot be edited; duplicate it instead';
  end if;
  if old.status in ('Sending', 'Sent') and (new.body_en, new.body_sw, new.audience_type, new.segment_id, new.channel) is distinct from (old.body_en, old.body_sw, old.audience_type, old.segment_id, old.channel) then
    raise exception 'A sent campaign cannot be edited';
  end if;
  return new;
end $$;
create trigger campaigns_guard before insert or update on public.campaigns for each row execute function public.audience_campaign_guard();

-- Submit a draft: needs GM/CFO approval when the audience exceeds the threshold, otherwise Scheduled or Approved (ready to send).
create or replace function public.audience_submit_campaign(_id uuid, _scheduled_at timestamptz default null)
returns text language plpgsql security definer set search_path = public as $$
declare c public.campaigns; s jsonb; need boolean; nxt text;
begin
  if not public.is_audience_staff() then raise exception 'Not allowed'; end if;
  select * into c from public.campaigns where id = _id for update;
  if not found then raise exception 'Campaign not found'; end if;
  if c.status not in ('Draft', 'Rejected', 'Approved', 'Scheduled') then raise exception 'Campaign is %', c.status; end if;
  select value into s from public.app_settings where key = 'sms_settings';
  need := coalesce((s ->> 'require_approval')::boolean, true) and c.audience_count > coalesce((s ->> 'approval_threshold')::int, 500);
  if need and c.approved_at is null then
    nxt := 'Awaiting approval';
    perform public.notify_role('gm_cfo', 'Campaign awaiting approval', c.name || ' · ' || c.audience_count || ' recipients', '/os/audience/campaigns/' || c.id, 'approval');
  elsif _scheduled_at is not null and _scheduled_at > now() then nxt := 'Scheduled';
  else nxt := 'Approved';
  end if;
  perform set_config('audience.via_fn', 'on', true);
  update public.campaigns set status = nxt, scheduled_at = _scheduled_at, requires_approval = need where id = _id;
  return nxt;
end $$;

-- GM/CFO (or Boss) approves or rejects; the person who created the campaign cannot approve it.
create or replace function public.audience_decide_campaign(_id uuid, _approve boolean, _note text default '')
returns text language plpgsql security definer set search_path = public as $$
declare c public.campaigns; nxt text;
begin
  if not public.has_any_role(auth.uid(), array['gm_cfo', 'boss']::public.app_role[]) then raise exception 'Only GM/CFO or Boss can approve campaigns'; end if;
  select * into c from public.campaigns where id = _id for update;
  if c.status <> 'Awaiting approval' then raise exception 'Campaign is not awaiting approval'; end if;
  if c.created_by = auth.uid() then raise exception 'You cannot approve a campaign you created'; end if;
  nxt := case when not _approve then 'Rejected' when c.scheduled_at is not null and c.scheduled_at > now() then 'Scheduled' else 'Approved' end;
  perform set_config('audience.via_fn', 'on', true);
  update public.campaigns set status = nxt, decision_note = coalesce(_note, ''),
    approved_by = case when _approve then auth.uid() end, approved_at = case when _approve then now() end
  where id = _id;
  if c.created_by is not null then
    perform public.notify(c.created_by, 'Campaign ' || lower(nxt), c.name || coalesce(' · ' || nullif(_note, ''), ''), '/os/audience/campaigns/' || c.id, 'approval');
  end if;
  return nxt;
end $$;

-- ---------- opt-out ----------
create or replace function public.opt_out_subscriber(_phone text)
returns int language plpgsql security definer set search_path = public as $$
declare p text := regexp_replace(coalesce(_phone, ''), '[^0-9]', '', 'g'); n int;
begin
  if auth.uid() is not null and not public.is_audience_staff() then raise exception 'Not allowed'; end if;
  if p ~ '^0[67][0-9]{8}$' then p := '255' || substr(p, 2); end if;
  if p !~ '^255[67][0-9]{8}$' then return 0; end if;
  update public.subscribers set status = 'unsubscribed' where phone = '+' || p and status <> 'unsubscribed';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.opt_out_subscriber(text) from public, anon;
grant execute on function public.opt_out_subscriber(text) to authenticated, service_role;

-- Every inbound reply: link to the subscriber; STOP / ACHA / SITISHA unsubscribes automatically.
create or replace function public.sms_inbox_on_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare p text := regexp_replace(new.from_phone, '[^0-9]', '', 'g');
begin
  if p ~ '^0[67][0-9]{8}$' then p := '255' || substr(p, 2); end if;
  new.from_phone := case when p ~ '^255[67][0-9]{8}$' then '+' || p else new.from_phone end;
  select id into new.subscriber_id from public.subscribers where phone = new.from_phone limit 1;
  if new.body ~* '^\s*(stop|unsubscribe|acha|sitisha|jiondoe)\b' then
    update public.subscribers set status = 'unsubscribed' where phone = new.from_phone and status <> 'unsubscribed';
    new.auto_action := 'Unsubscribed'; new.handled := true;
    if new.campaign_id is null then
      select m.campaign_id into new.campaign_id from public.campaign_messages m where m.to_address = new.from_phone order by m.created_at desc limit 1;
    end if;
    if new.campaign_id is not null then
      perform set_config('audience.via_fn', 'on', true);
      update public.campaigns set opted_out = opted_out + 1 where id = new.campaign_id;
    end if;
  end if;
  return new;
end $$;
create trigger sms_inbox_insert before insert on public.sms_inbox for each row execute function public.sms_inbox_on_insert();

-- ---------- defaults ----------
insert into public.message_templates (key, name, category, channel, subject, body_en, body_sw) values
  ('welcome', 'Welcome to the Basil Health Brief', 'Welcome', 'sms', '',
   'Karibu {title} {first_name}! You are now subscribed to the Basil Health Brief. One brief a week plus urgent drug alerts. Reply STOP to opt out.',
   'Karibu {title} {first_name}! Umejiunga na Basil Health Brief. Taarifa moja kwa wiki na tahadhari za dawa. Jibu STOP kujiondoa.'),
  ('event_reminder', 'Event reminder', 'Event', 'sms', '',
   'Reminder {title} {first_name}: the event you registered for starts soon. Venue and programme: basilmedia.co.tz/events. Reply STOP to opt out.',
   'Kumbusho {title} {first_name}: tukio ulilojisajili linaanza hivi karibuni. Ukumbi na ratiba: basilmedia.co.tz/events. Jibu STOP kujiondoa.'),
  ('flash_alert', 'Flash alert (drug / outbreak)', 'Alert', 'sms', '',
   'URGENT {title} {first_name}: new safety alert for your specialty. Read the full notice at basilmedia.co.tz/health-news. Reply STOP to opt out.',
   'DHARURA {title} {first_name}: tahadhari mpya ya usalama kwa fani yako. Soma zaidi: basilmedia.co.tz/health-news. Jibu STOP kujiondoa.'),
  ('invoice_reminder', 'Invoice reminder', 'Finance', 'email', 'Invoice reminder from Basil Media',
   'Dear {title} {first_name}, this is a friendly reminder that an invoice for {institution} is now due. Please contact accounts@basilmedia.co.tz with any questions.',
   'Ndugu {title} {first_name}, tunakukumbusha kuwa ankara ya {institution} imefikia muda wa kulipwa. Wasiliana na accounts@basilmedia.co.tz kwa maswali.'),
  ('weekly_brief', 'Weekly brief', 'Newsletter', 'email', 'Your Basil Health Brief this week',
   'Hello {title} {first_name}, here are this week''s top stories for clinicians in Tanzania: basilmedia.co.tz/health-news',
   'Habari {title} {first_name}, hizi ni habari kuu za wiki hii kwa wataalamu wa afya Tanzania: basilmedia.co.tz/health-news')
on conflict (key) do nothing;

insert into public.automations (key, name, description, trigger, offset_days, channel, template_id, enabled)
select x.key, x.name, x.description, x.trigger, x.offset_days, 'sms', t.id, x.enabled
from (values
  ('welcome_sms', 'Welcome SMS after subscribe', 'Sent when a subscriber is confirmed active.', 'subscribe', 0, 'welcome', true),
  ('event_7d', 'Event reminder · 7 days before', 'Sent to registered attendees one week before the event.', 'event_before', 7, 'event_reminder', true),
  ('event_1d', 'Event reminder · 1 day before', 'Sent to registered attendees the day before the event.', 'event_before', 1, 'event_reminder', false)
) as x(key, name, description, trigger, offset_days, tpl, enabled)
left join public.message_templates t on t.key = x.tpl
on conflict (key) do nothing;

-- ===================== 0013_security_esign.sql =====================
-- Basil Media OS · 0013 security (two-factor backup codes, passkeys, approval PINs, step-up and login events)
-- and the E-Signature Studio (documents, signers, events, public signing RPCs).
-- Owner note: confirm with a lawyer which documents may be e-signed under Tanzania's Electronic Transactions Act, 2015.

create extension if not exists pgcrypto with schema extensions;

insert into public.app_settings (key, value) values
  ('require_2fa_roles', '["boss", "gm_cfo", "finance", "super_admin"]'),
  ('esign_expiry_days', '30')
on conflict (key) do nothing;

-- =====================================================================================
-- Security
-- =====================================================================================

-- WebAuthn passkeys: only the credential id, public key (base64url COSE) and signature counter are kept.
create table public.passkey_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  device_name text not null default 'This device',
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.passkey_credentials enable row level security;
create policy "own passkeys read" on public.passkey_credentials for select to authenticated using (user_id = auth.uid());
create policy "own passkeys rename" on public.passkey_credentials for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own passkeys remove" on public.passkey_credentials for delete to authenticated using (user_id = auth.uid());
-- Inserts happen only in the passkey edge function (service role) after server-side verification.
create trigger audit_passkey_credentials after insert or update or delete on public.passkey_credentials for each row execute function public.audit_row();

-- Two-factor backup codes: bcrypt hashes, single use. Generated and shown once by regenerate_backup_codes().
create table public.backup_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.backup_codes enable row level security;
create policy "own backup codes status" on public.backup_codes for select to authenticated using (user_id = auth.uid());
create trigger audit_backup_codes after insert or update or delete on public.backup_codes for each row execute function public.audit_row();

-- 4-digit approval PIN (fallback step-up when the user has no passkey).
create table public.approval_pins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  pin_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.approval_pins enable row level security;
-- Users may see that a PIN exists (not the hash column in practice: the app selects id only). Writes via RPC only.
create policy "own pin exists" on public.approval_pins for select to authenticated using (user_id = auth.uid());
create trigger audit_approval_pins after insert or update or delete on public.approval_pins for each row execute function public.audit_row();

create table public.step_up_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text not null default '',
  method text not null check (method in ('passkey', 'pin')),
  user_agent text not null default '',
  at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.step_up_events enable row level security;
create policy "own or leaders read step-ups" on public.step_up_events for select to authenticated
  using (user_id = auth.uid() or public.has_any_role(auth.uid(), array['boss', 'gm_cfo']::public.app_role[]));
-- Inserted only by verify_approval_pin() and the passkey function.

create table public.login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  method text not null default 'password' check (method in ('password', 'passkey', 'magic_link')),
  user_agent text not null default '',
  created_at timestamptz not null default now()
);
alter table public.login_events enable row level security;
create policy "own or leaders read logins" on public.login_events for select to authenticated
  using (user_id = auth.uid() or public.has_any_role(auth.uid(), array['boss', 'gm_cfo']::public.app_role[]));
create policy "record own login" on public.login_events for insert to authenticated with check (user_id = auth.uid());

-- Generate 8 fresh backup codes (requires a two-factor session), store hashes, return plaintext once.
create or replace function public.regenerate_backup_codes()
returns setof text language plpgsql security definer set search_path = public, extensions as $$
declare c text; i int;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then raise exception 'Verify your authenticator code first'; end if;
  delete from public.backup_codes where user_id = auth.uid();
  for i in 1..8 loop
    c := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 5) || '-' || substr(encode(gen_random_bytes(6), 'hex'), 1, 5));
    insert into public.backup_codes (user_id, code_hash) values (auth.uid(), crypt(c, gen_salt('bf', 8)));
    return next c;
  end loop;
end;
$$;

-- Recovery: a valid unused backup code is consumed and the user's authenticator factors are removed,
-- so they sign in at aal1 and must enrol a new authenticator straight away.
create or replace function public.use_backup_code(_code text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare r public.backup_codes;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into r from public.backup_codes
   where user_id = auth.uid() and used_at is null and code_hash = crypt(upper(trim(_code)), code_hash) limit 1;
  if r.id is null then return false; end if;
  update public.backup_codes set used_at = now() where id = r.id;
  delete from auth.mfa_factors where user_id = auth.uid();
  return true;
end;
$$;

create or replace function public.set_approval_pin(_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if _pin !~ '^[0-9]{4}$' then raise exception 'The PIN must be 4 digits'; end if;
  if _pin in ('0000', '1111', '1234', '4321', '2222', '9999') then raise exception 'Choose a less obvious PIN'; end if;
  insert into public.approval_pins (user_id, pin_hash) values (auth.uid(), crypt(_pin, gen_salt('bf', 8)))
  on conflict (user_id) do update set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null, updated_at = now();
end;
$$;

-- Checks the PIN (5 wrong tries lock it for 15 minutes) and records the step-up.
create or replace function public.verify_approval_pin(_pin text, _reason text, _user_agent text default '')
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare p public.approval_pins;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into p from public.approval_pins where user_id = auth.uid();
  if p.id is null then raise exception 'Set an approval PIN first'; end if;
  if p.locked_until is not null and p.locked_until > now() then raise exception 'Too many wrong PINs. Try again after %', to_char(p.locked_until at time zone 'Africa/Dar_es_Salaam', 'HH24:MI'); end if;
  if p.pin_hash <> crypt(_pin, p.pin_hash) then
    update public.approval_pins set failed_attempts = failed_attempts + 1,
      locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' end where id = p.id;
    return false;
  end if;
  update public.approval_pins set failed_attempts = 0, locked_until = null where id = p.id;
  insert into public.step_up_events (user_id, reason, method, user_agent) values (auth.uid(), left(coalesce(_reason, ''), 300), 'pin', left(coalesce(_user_agent, ''), 300));
  return true;
end;
$$;

revoke execute on function public.regenerate_backup_codes() from anon, public;
revoke execute on function public.use_backup_code(text) from anon, public;
revoke execute on function public.set_approval_pin(text) from anon, public;
revoke execute on function public.verify_approval_pin(text, text, text) from anon, public;
grant execute on function public.regenerate_backup_codes() to authenticated;
grant execute on function public.use_backup_code(text) to authenticated;
grant execute on function public.set_approval_pin(text) to authenticated;
grant execute on function public.verify_approval_pin(text, text, text) to authenticated;

-- =====================================================================================
-- E-Signature Studio
-- =====================================================================================

create table public.esign_documents (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  title text not null,
  source_kind text not null default 'text' check (source_kind in ('pdf', 'text')),
  source_url text not null default '',
  body_text text not null default '',
  message text not null default '',
  signing_order text not null default 'sequential' check (signing_order in ('sequential', 'parallel')),
  status text not null default 'Draft' check (status in ('Draft', 'Sent', 'Viewed', 'Partly signed', 'Completed', 'Declined', 'Expired')),
  doc_hash text not null default '',
  expires_at timestamptz,
  sent_at timestamptz,
  completed_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.esign_signers (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.esign_documents (id) on delete cascade,
  name text not null,
  email text not null default '',
  phone text not null default '',
  sign_order int not null default 1,
  fields text[] not null default array['signature', 'name', 'date'],
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  status text not null default 'Waiting' check (status in ('Waiting', 'Sent', 'Viewed', 'Signed', 'Declined')),
  viewed_at timestamptz,
  signed_at timestamptz,
  signed_name text,
  signature_data text,
  user_agent text,
  decline_reason text,
  created_at timestamptz not null default now()
);
create index on public.esign_signers (document_id);

create table public.esign_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.esign_documents (id) on delete cascade,
  signer_id uuid references public.esign_signers (id) on delete set null,
  kind text not null,
  detail text not null default '',
  user_agent text not null default '',
  created_at timestamptz not null default now()
);
create index on public.esign_events (document_id);

alter table public.esign_documents enable row level security;
alter table public.esign_signers enable row level security;
alter table public.esign_events enable row level security;

create or replace function public.is_esign_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'growth', 'account_manager', 'finance']::public.app_role[]);
$$;

create policy "esign staff read docs" on public.esign_documents for select to authenticated using (public.is_esign_staff());
create policy "esign staff create docs" on public.esign_documents for insert to authenticated with check (public.is_esign_staff() and status = 'Draft');
create policy "esign staff edit drafts" on public.esign_documents for update to authenticated using (public.is_esign_staff() and status = 'Draft') with check (status = 'Draft');
create policy "esign staff delete drafts" on public.esign_documents for delete to authenticated using (public.is_esign_staff() and status = 'Draft');

create policy "esign staff read signers" on public.esign_signers for select to authenticated using (public.is_esign_staff());
create policy "esign staff add signers" on public.esign_signers for insert to authenticated
  with check (public.is_esign_staff() and exists (select 1 from public.esign_documents d where d.id = document_id and d.status = 'Draft'));
create policy "esign staff edit draft signers" on public.esign_signers for update to authenticated
  using (public.is_esign_staff() and exists (select 1 from public.esign_documents d where d.id = document_id and d.status = 'Draft'));
create policy "esign staff remove draft signers" on public.esign_signers for delete to authenticated
  using (public.is_esign_staff() and exists (select 1 from public.esign_documents d where d.id = document_id and d.status = 'Draft'));

create policy "esign staff read events" on public.esign_events for select to authenticated using (public.is_esign_staff());

create trigger audit_esign_documents after insert or update or delete on public.esign_documents for each row execute function public.audit_row();
create trigger audit_esign_signers after insert or update or delete on public.esign_signers for each row execute function public.audit_row();

create or replace function public.esign_hash(d public.esign_documents)
returns text language sql immutable set search_path = public, extensions as $$
  select encode(digest(convert_to(case when d.source_kind = 'pdf' then d.source_url else d.body_text end, 'UTF8'), 'sha256'), 'hex');
$$;

-- Draft → Sent: fixes the SHA-256 of the source, opens the first signer (sequential) or everyone (parallel).
create or replace function public.send_esign_document(_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare d public.esign_documents; first_order int; days int;
begin
  if not public.is_esign_staff() then raise exception 'Not allowed'; end if;
  select * into d from public.esign_documents where id = _id for update;
  if d.id is null then raise exception 'Document not found'; end if;
  if d.status <> 'Draft' then raise exception 'Only drafts can be sent'; end if;
  if not exists (select 1 from public.esign_signers where document_id = _id) then raise exception 'Add at least one signer'; end if;
  if (d.source_kind = 'pdf' and d.source_url = '') or (d.source_kind = 'text' and d.body_text = '') then raise exception 'The document is empty'; end if;
  select coalesce((value #>> '{}')::int, 30) into days from public.app_settings where key = 'esign_expiry_days';
  select min(sign_order) into first_order from public.esign_signers where document_id = _id;
  update public.esign_signers set status = case when d.signing_order = 'parallel' or sign_order = first_order then 'Sent' else 'Waiting' end where document_id = _id;
  update public.esign_documents set status = 'Sent', sent_at = now(), doc_hash = public.esign_hash(d),
    expires_at = coalesce(expires_at, now() + make_interval(days => coalesce(days, 30))) where id = _id;
  insert into public.esign_events (document_id, kind, detail) values (_id, 'sent', 'Sent for signature by ' || coalesce((select full_name from public.profiles where id = auth.uid()), 'staff'));
  return 'Sent';
end;
$$;

create or replace function public.esign_expire_if_due(_doc uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.esign_documents set status = 'Expired'
   where id = _doc and expires_at < now() and status in ('Sent', 'Viewed', 'Partly signed');
end;
$$;

-- Public: what a signer sees. Records the first view.
create or replace function public.get_sign_request(_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.esign_signers; d public.esign_documents;
begin
  select * into s from public.esign_signers where token = _token;
  if s.id is null then return null; end if;
  perform public.esign_expire_if_due(s.document_id);
  select * into d from public.esign_documents where id = s.document_id;
  if d.status = 'Draft' then return null; end if;
  if s.status = 'Sent' and d.status not in ('Declined', 'Expired') then
    update public.esign_signers set status = 'Viewed', viewed_at = now() where id = s.id returning * into s;
    if d.status = 'Sent' then update public.esign_documents set status = 'Viewed' where id = d.id returning * into d; end if;
    insert into public.esign_events (document_id, signer_id, kind, detail) values (d.id, s.id, 'viewed', s.name || ' opened the document');
  end if;
  return jsonb_build_object(
    'document', jsonb_build_object('id', d.id, 'title', d.title, 'source_kind', d.source_kind, 'source_url', d.source_url, 'body_text', d.body_text,
                                   'message', d.message, 'status', d.status, 'signing_order', d.signing_order, 'expires_at', d.expires_at, 'doc_hash', d.doc_hash),
    'signer', jsonb_build_object('id', s.id, 'name', s.name, 'status', s.status, 'fields', s.fields, 'sign_order', s.sign_order, 'signed_at', s.signed_at),
    'signers', (select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'sign_order', x.sign_order, 'status', x.status, 'signed_at', x.signed_at) order by x.sign_order, x.created_at), '[]')
                from public.esign_signers x where x.document_id = d.id));
end;
$$;

create or replace function public.sign_document(_token text, _name text, _signature_data_url text, _user_agent text)
returns text language plpgsql security definer set search_path = public as $$
declare s public.esign_signers; d public.esign_documents; left_count int; next_order int; new_status text;
begin
  select * into s from public.esign_signers where token = _token for update;
  if s.id is null then raise exception 'This signing link is not valid'; end if;
  perform public.esign_expire_if_due(s.document_id);
  select * into d from public.esign_documents where id = s.document_id for update;
  if d.status not in ('Sent', 'Viewed', 'Partly signed') then raise exception 'This document is %', lower(d.status); end if;
  if s.status not in ('Sent', 'Viewed') then raise exception 'It is not your turn to sign yet, or you have already responded'; end if;
  if length(trim(coalesce(_name, ''))) < 2 then raise exception 'Type your full name'; end if;
  if coalesce(_signature_data_url, '') not like 'data:image/png;base64,%' or length(_signature_data_url) > 400000 then raise exception 'Draw your signature'; end if;
  update public.esign_signers set status = 'Signed', signed_at = now(), signed_name = left(trim(_name), 120), signature_data = _signature_data_url,
    user_agent = left(coalesce(_user_agent, ''), 300), viewed_at = coalesce(viewed_at, now()) where id = s.id;
  insert into public.esign_events (document_id, signer_id, kind, detail, user_agent) values (d.id, s.id, 'signed', trim(_name) || ' signed', left(coalesce(_user_agent, ''), 300));
  select count(*) into left_count from public.esign_signers where document_id = d.id and status <> 'Signed';
  if left_count = 0 then
    new_status := 'Completed';
    update public.esign_documents set status = 'Completed', completed_at = now() where id = d.id;
    insert into public.esign_events (document_id, kind, detail) values (d.id, 'completed', 'All parties signed');
    if d.created_by is not null then perform public.notify(d.created_by, 'Document completed', d.title || ' has been signed by everyone.', '/os/esign/' || d.id, 'task'); end if;
  else
    new_status := 'Partly signed';
    update public.esign_documents set status = 'Partly signed' where id = d.id;
    if d.signing_order = 'sequential' then
      select min(sign_order) into next_order from public.esign_signers where document_id = d.id and status = 'Waiting';
      update public.esign_signers set status = 'Sent' where document_id = d.id and status = 'Waiting' and sign_order = next_order;
    end if;
    if d.created_by is not null then perform public.notify(d.created_by, 'Document signed', trim(_name) || ' signed ' || d.title, '/os/esign/' || d.id, 'info'); end if;
  end if;
  return new_status;
end;
$$;

create or replace function public.decline_document(_token text, _reason text)
returns text language plpgsql security definer set search_path = public as $$
declare s public.esign_signers; d public.esign_documents;
begin
  select * into s from public.esign_signers where token = _token for update;
  if s.id is null then raise exception 'This signing link is not valid'; end if;
  select * into d from public.esign_documents where id = s.document_id for update;
  if d.status not in ('Sent', 'Viewed', 'Partly signed') then raise exception 'This document is %', lower(d.status); end if;
  if s.status not in ('Sent', 'Viewed') then raise exception 'You have already responded'; end if;
  if length(trim(coalesce(_reason, ''))) < 3 then raise exception 'Give a short reason'; end if;
  update public.esign_signers set status = 'Declined', decline_reason = left(trim(_reason), 500) where id = s.id;
  update public.esign_documents set status = 'Declined' where id = d.id;
  insert into public.esign_events (document_id, signer_id, kind, detail) values (d.id, s.id, 'declined', s.name || ' declined: ' || left(trim(_reason), 300));
  if d.created_by is not null then perform public.notify(d.created_by, 'Document declined', s.name || ' declined ' || d.title, '/os/esign/' || d.id, 'alert'); end if;
  return 'Declined';
end;
$$;

-- Public verification: status, recorded hash, source (to recompute the hash) and who signed when. No emails/phones/signatures.
create or replace function public.verify_document(_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.esign_documents;
begin
  select * into d from public.esign_documents where id = _id and status <> 'Draft';
  if d.id is null then return null; end if;
  return jsonb_build_object('id', d.id, 'title', d.title, 'status', d.status, 'doc_hash', d.doc_hash, 'source_kind', d.source_kind,
    'source_url', d.source_url, 'body_text', d.body_text, 'sent_at', d.sent_at, 'completed_at', d.completed_at,
    'signers', (select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'signed_name', x.signed_name, 'status', x.status, 'signed_at', x.signed_at) order by x.sign_order), '[]')
                from public.esign_signers x where x.document_id = d.id));
end;
$$;

revoke execute on function public.send_esign_document(uuid) from anon, public;
revoke execute on function public.esign_expire_if_due(uuid) from anon, public;
grant execute on function public.send_esign_document(uuid) to authenticated;
grant execute on function public.get_sign_request(text) to anon, authenticated;
grant execute on function public.sign_document(text, text, text, text) to anon, authenticated;
grant execute on function public.decline_document(text, text) to anon, authenticated;
grant execute on function public.verify_document(uuid) to anon, authenticated;

-- ===================== 0014_face_search.sql =====================
-- Face search ("Find my photos — powered by Bermi AI").
-- Faces are detected and embedded in the browser (staff when indexing, the visitor's own phone when
-- searching). The database only ever holds numeric embeddings of gallery photos; selfie images are
-- never uploaded and search embeddings are not stored. Embeddings use the 1024-dim faceres descriptor.

create extension if not exists vector with schema extensions;

-- ---------- tables ----------
create table public.face_embeddings (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  media_id uuid not null references public.media_items (id) on delete cascade,
  gallery_id uuid not null references public.galleries (id) on delete cascade,
  box jsonb not null default '{}', -- {x,y,w,h} as 0–1 of the photo, ar = width/height
  embedding extensions.vector(1024) not null,
  quality real not null default 0,
  created_at timestamptz not null default now()
);
create index on public.face_embeddings (gallery_id);
create index on public.face_embeddings (media_id);
create index face_embeddings_hnsw on public.face_embeddings using hnsw (embedding extensions.vector_cosine_ops);

-- One row per photo that has been scanned (even with no faces), so re-indexing skips it.
create table public.face_indexed_media (
  media_id uuid primary key references public.media_items (id) on delete cascade,
  gallery_id uuid not null references public.galleries (id) on delete cascade,
  face_count int not null default 0,
  indexed_at timestamptz not null default now()
);
create index on public.face_indexed_media (gallery_id);

-- Internal "People" grouping for staff. Never exposed publicly.
create table public.face_clusters (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries (id) on delete cascade,
  member_ids uuid[] not null default '{}', -- face_embeddings ids
  size int not null default 0,
  cover jsonb not null default '{}', -- {media_id, box}
  created_at timestamptz not null default now()
);
create index on public.face_clusters (gallery_id);

create table public.face_cluster_labels (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null unique references public.face_clusters (id) on delete cascade,
  label text not null default '',
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.face_search_consents (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries (id) on delete cascade,
  policy_version text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now()
);
create index on public.face_search_consents (gallery_id, created_at);

-- No images and no embeddings: only who-ish (a hashed fingerprint), where, when and how many hits.
create table public.face_search_log (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries (id) on delete cascade,
  fingerprint text not null,
  result_count int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.face_search_log (gallery_id, fingerprint, created_at);

create table public.face_removal_requests (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  gallery_id uuid references public.galleries (id) on delete set null,
  gallery_slug text not null default '',
  name text not null check (length(name) between 1 and 200),
  contact text not null check (length(contact) between 3 and 200),
  reason text not null default '' check (length(reason) <= 2000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'done', 'rejected')),
  created_at timestamptz not null default now()
);

-- ---------- RLS ----------
alter table public.face_embeddings enable row level security;
alter table public.face_indexed_media enable row level security;
alter table public.face_clusters enable row level security;
alter table public.face_cluster_labels enable row level security;
alter table public.face_search_consents enable row level security;
alter table public.face_search_log enable row level security;
alter table public.face_removal_requests enable row level security;

-- Editors may only add embeddings to galleries that have face search switched on.
create policy "cms reads faces" on public.face_embeddings for select to authenticated using (public.is_cms_editor());
create policy "cms deletes faces" on public.face_embeddings for delete to authenticated using (public.is_cms_editor());
create policy "cms indexes faces" on public.face_embeddings for insert to authenticated with check (
  public.is_cms_editor() and exists (select 1 from public.galleries g where g.id = gallery_id and g.face_search_enabled)
);
create policy "cms manages indexed" on public.face_indexed_media for all to authenticated using (public.is_cms_editor()) with check (
  public.is_cms_editor() and exists (select 1 from public.galleries g where g.id = gallery_id and g.face_search_enabled)
);
create policy "cms manages clusters" on public.face_clusters for all to authenticated using (public.is_cms_editor()) with check (public.is_cms_editor());
create policy "cms manages labels" on public.face_cluster_labels for all to authenticated using (public.is_cms_editor()) with check (public.is_cms_editor());

create policy "visitor records consent" on public.face_search_consents for insert to anon, authenticated with check (
  exists (select 1 from public.galleries g where g.id = gallery_id and g.published and g.face_search_enabled)
);
create policy "cms reads consents" on public.face_search_consents for select to authenticated using (public.is_cms_editor());
create policy "cms reads search log" on public.face_search_log for select to authenticated using (public.is_cms_editor());

create policy "anyone requests removal" on public.face_removal_requests for insert to anon, authenticated with check (status = 'new');
create policy "cms manages removals" on public.face_removal_requests for all to authenticated using (public.is_cms_editor()) with check (public.is_cms_editor());

create trigger audit_face_cluster_labels after insert or update or delete on public.face_cluster_labels for each row execute function public.audit_row();
create trigger audit_face_removal_requests after insert or update or delete on public.face_removal_requests for each row execute function public.audit_row();

-- ---------- search ----------
-- Searches ONE gallery. Rate-limited to 20 searches per gallery per hour per hashed client fingerprint.
create or replace function public.face_search(
  p_slug text,
  p_embedding extensions.vector(1024),
  p_threshold float default 0.5,
  p_fingerprint text default '',
  p_pin text default null
)
returns table (id uuid, gallery_id uuid, kind text, url text, thumb_url text, collection text, caption text, sort_order int, similarity float)
language plpgsql volatile security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare
  g public.galleries;
  h text;
  n int;
  thr float := least(0.95, greatest(coalesce(p_threshold, 0.5), 0.35)); -- never a floor low enough to dump the gallery
begin
  select * into g from public.galleries x where x.slug = p_slug and x.published;
  if not found or not g.face_search_enabled or (g.expires_on is not null and g.expires_on < current_date) then
    raise exception 'Face search is not available for this gallery' using errcode = '42501';
  end if;
  if g.access_mode = 'pin' then
    select s.pin_hash into h from public.gallery_secrets s where s.gallery_id = g.id;
    if p_pin is null or h is null or crypt(p_pin, h) <> h then
      raise exception 'Wrong PIN' using errcode = '28000';
    end if;
  end if;
  if p_fingerprint is null or length(p_fingerprint) < 16 or length(p_fingerprint) > 128 then
    raise exception 'Missing client fingerprint' using errcode = '22023';
  end if;
  select count(*) into n from public.face_search_log l
    where l.gallery_id = g.id and l.fingerprint = p_fingerprint and l.created_at > now() - interval '1 hour';
  if n >= 20 then
    raise exception 'Too many searches. Please try again in an hour.' using errcode = '54000';
  end if;

  return query
    with hits as (
      select f.media_id, max(1 - (f.embedding <=> p_embedding)) as sim
      from public.face_embeddings f
      where f.gallery_id = g.id
      group by f.media_id
    )
    select m.id, m.gallery_id, m.kind, m.url, m.thumb_url, m.collection, m.caption, m.sort_order, hits.sim::float
    from hits join public.media_items m on m.id = hits.media_id
    where hits.sim >= thr
    order by hits.sim desc
    limit 200;
  get diagnostics n = row_count;
  insert into public.face_search_log (gallery_id, fingerprint, result_count) values (g.id, p_fingerprint, n);
end;
$$;
revoke all on function public.face_search(text, extensions.vector, float, text, text) from public;
grant execute on function public.face_search(text, extensions.vector, float, text, text) to anon, authenticated;

-- Switching face search off deletes the gallery's face data straight away.
create or replace function public.drop_faces_when_disabled()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.face_search_enabled and not new.face_search_enabled then
    delete from public.face_embeddings where gallery_id = new.id;
    delete from public.face_indexed_media where gallery_id = new.id;
    delete from public.face_clusters where gallery_id = new.id;
  end if;
  return new;
end;
$$;
create trigger galleries_drop_faces after update of face_search_enabled on public.galleries
  for each row execute function public.drop_faces_when_disabled();

-- ---------- retention ----------
-- Deletes face data for galleries that expired more than 30 days ago, and old search logs.
create or replace function public.purge_expired_face_data()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.face_embeddings f using public.galleries g
    where g.id = f.gallery_id and g.expires_on is not null and g.expires_on < current_date - 30;
  get diagnostics n = row_count;
  delete from public.face_indexed_media f using public.galleries g
    where g.id = f.gallery_id and g.expires_on is not null and g.expires_on < current_date - 30;
  delete from public.face_clusters f using public.galleries g
    where g.id = f.gallery_id and g.expires_on is not null and g.expires_on < current_date - 30;
  delete from public.face_search_log where created_at < now() - interval '90 days';
  return n;
end;
$$;
revoke all on function public.purge_expired_face_data() from public, anon, authenticated;

-- Run nightly when pg_cron is available (Supabase: enable it under Database → Extensions).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purge-expired-face-data', '17 2 * * *', 'select public.purge_expired_face_data()');
  end if;
end $$;

-- ===================== 0015_pgcrypto_search_path.sql =====================
-- Basil Media OS · 0015 make gallery PIN functions find pgcrypto (Supabase keeps it in the "extensions" schema).
alter function public.stash_gallery_pin() set search_path = public, extensions;
alter function public.gallery_media(text, text) set search_path = public, extensions;

-- ===================== 0016_news_desks.sql =====================
-- Basil Media OS · 0016 news desks (Health, Youth & Opportunities, Innovation, Capital & Business, Banking for Youth)
-- and more opportunity types for young people.
alter table public.opportunities drop constraint if exists opportunities_kind_check;
alter table public.opportunities add constraint opportunities_kind_check
  check (kind in ('Job', 'Internship', 'Fellowship', 'Scholarship', 'Grant', 'Funding', 'Competition', 'Training', 'Call for abstracts'));

commit;
