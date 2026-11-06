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
