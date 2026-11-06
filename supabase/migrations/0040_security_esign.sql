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
