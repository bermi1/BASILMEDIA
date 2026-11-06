-- Basil Media OS · complete database setup (generated from 43 migrations).
-- Paste into Supabase → SQL Editor on an EMPTY project and press Run.

-- ===================== 0001_foundation.sql =====================
-- Basil Media OS · 0001 foundation
-- Roles live in their own table (never on the profile), checked by a SECURITY DEFINER function.
-- The very first account becomes Super Admin; afterwards only the Super Admin grants roles.

create extension if not exists pgcrypto;

create type public.app_role as enum (
  'super_admin', 'boss', 'gm_cfo', 'finance', 'project_lead', 'staff', 'storekeeper',
  'growth', 'account_manager', 'receptionist', 'driver', 'client'
);

-- Divisions: every business record carries a division_id from day one (Basil Media first).
create table public.divisions (
  id text primary key,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.divisions (id, name) values ('basil-media', 'Basil Media');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  language text not null default 'en' check (language in ('en', 'sw')),
  avatar_url text not null default '',
  division_id text not null default 'basil-media' references public.divisions (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create or replace function public.has_role(_user uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user and (role = _role or role = 'super_admin'));
$$;

create or replace function public.has_any_role(_user uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user and (role = any(_roles) or role = 'super_admin'));
$$;

-- Website CMS editors: Super Admin, GM/CFO and Growth.
create or replace function public.is_cms_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_any_role(auth.uid(), array['gm_cfo', 'growth']::public.app_role[]);
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  -- Lock prevents two simultaneous first sign-ups both becoming Super Admin.
  lock table public.user_roles in share row exclusive mode;
  if not exists (select 1 from public.user_roles) then
    insert into public.user_roles (user_id, role) values (new.id, 'super_admin');
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.divisions enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

create policy "divisions readable by signed-in users" on public.divisions for select to authenticated using (true);
create policy "super admin manages divisions" on public.divisions for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin')) with check (public.has_role(auth.uid(), 'super_admin'));

create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid() or public.has_any_role(auth.uid(), array['boss', 'gm_cfo']::public.app_role[]));
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "super admin edits profiles" on public.profiles for update to authenticated using (public.has_role(auth.uid(), 'super_admin'));

create policy "see own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'));
create policy "super admin grants roles" on public.user_roles for insert to authenticated with check (public.has_role(auth.uid(), 'super_admin'));
create policy "super admin revokes roles" on public.user_roles for delete to authenticated using (public.has_role(auth.uid(), 'super_admin'));

-- Immutable audit trail: who, what, when, old value, new value. No update/delete policy exists.
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid default auth.uid(),
  table_name text not null,
  record_id text,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_value jsonb,
  new_value jsonb
);
alter table public.audit_log enable row level security;
create policy "leaders read audit log" on public.audit_log for select to authenticated
  using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo']::public.app_role[]));

create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (table_name, record_id, action, old_value, new_value)
  values (
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id', ''),
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_user_roles after insert or update or delete on public.user_roles for each row execute function public.audit_row();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger touch_profiles before update on public.profiles for each row execute function public.touch_updated_at();

-- ===================== 0002_public_site.sql =====================
-- Basil Media OS · 0002 public website content, edited from the Website CMS (/os/website).

create table public.site_settings (
  id text primary key default 'site' check (id = 'site'),
  tagline text not null default '',
  tagline_highlight text not null default '',
  hero_kicker text not null default '',
  hero_subtitle text not null default '',
  hero_image_url text not null default '',
  hero_video_url text not null default '',
  logo_url text not null default '/logo.svg',
  logo_reverse_url text not null default '/logo-reverse.svg',
  about_story text not null default '',
  about_image_url text not null default '',
  mission text not null default '',
  vision text not null default '',
  company_profile_url text not null default '',
  contact_email text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  address text not null default '',
  map_embed_url text not null default '',
  footer_about text not null default '',
  socials jsonb not null default '{}'::jsonb,
  stats jsonb not null default '[]'::jsonb,
  live_ticker text not null default '',
  services_mega_image_url text not null default '',
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  title text not null,
  slug text not null unique,
  short text not null default '',
  description text not null default '',
  deliverables text[] not null default '{}',
  icon text not null default 'video',
  image_url text not null default '',
  video_url text not null default '',
  sort_order int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.projects_public (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  title text not null,
  client text not null default '',
  category text not null default 'Corporate' check (category in ('Films & Documentaries', 'Photo Stories', 'Podcasts', 'Corporate')),
  image_url text not null default '',
  description text not null default '',
  video_url text not null default '',
  external_url text not null default '',
  featured boolean not null default false,
  sort_order int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  name text not null,
  logo_url text not null default '',
  website text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  title text not null,
  video_url text not null default '',
  thumbnail_url text not null default '',
  sort_order int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.team (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  name text not null,
  role text not null default '',
  photo_url text not null default '',
  bio text not null default '',
  instagram_url text not null default '',
  linkedin_url text not null default '',
  sort_order int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  company text not null,
  quote text not null,
  rating int not null default 5 check (rating between 1 and 5),
  person_name text not null default '', -- internal only; never selected by public pages
  sort_order int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

-- Booking form, contact form and gallery selections. Feeds the CRM lead pipeline in Phase 7.
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  name text not null check (char_length(name) between 2 and 120),
  contact text not null check (char_length(contact) between 5 and 160),
  service text not null default '' check (char_length(service) <= 200),
  preferred_date date,
  message text not null default '' check (char_length(message) <= 50000), -- full inquiries welcome
  source text not null default 'booking' check (source in ('booking', 'contact', 'gallery-selection', 'find-me')),
  status text not null default 'new' check (status in ('new', 'contacted', 'won', 'lost', 'archived')),
  created_at timestamptz not null default now()
);

create table public.news_stories (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  title text not null,
  dek text not null default '',
  body text not null default '',
  sector text not null default 'Health',
  tag text not null default 'Policy',
  image_url text not null default '',
  read_minutes int not null default 3,
  featured boolean not null default false,
  published boolean not null default false,
  published_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  title text not null,
  org text not null default '',
  location text not null default '',
  kind text not null default 'Job' check (kind in ('Job', 'Fellowship', 'Scholarship', 'Call for abstracts')),
  closes_on date not null default current_date,
  link text not null default '',
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  title text not null,
  venue text not null default '',
  starts_on date not null,
  cpd text not null default '',
  sector text not null default 'Health',
  link text not null default '',
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.subscribers (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  full_name text not null default '' check (char_length(full_name) <= 120),
  title text not null default '',
  profession text not null default '',
  specialties text[] not null default '{}',
  institution text not null default '',
  region text not null default '',
  phone text not null default '' check (phone = '' or phone ~ '^\+255[67][0-9]{8}$'),
  email text not null default '' check (char_length(email) <= 160),
  language text not null default 'en' check (language in ('en', 'sw')),
  channel text not null default 'sms' check (channel in ('sms', 'email', 'whatsapp')),
  sector text not null default 'Health',
  source text not null default 'website',
  consent boolean not null check (consent),
  consent_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'active', 'paused', 'unsubscribed')),
  created_at timestamptz not null default now(),
  check (phone <> '' or email <> '')
);

create table public.galleries (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,80}$'),
  title text not null,
  client_name text not null default '',
  event_date date not null default current_date,
  location text not null default '',
  cover_url text not null default '',
  collections text[] not null default '{Highlights}',
  access_mode text not null default 'link' check (access_mode in ('public', 'link', 'pin')),
  pin text not null default '', -- write-only: moved, hashed, into gallery_secrets by trigger
  expires_on date,
  allow_downloads boolean not null default true,
  selection_limit int not null default 0,
  face_search_enabled boolean not null default false,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.media_items (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries (id) on delete cascade,
  kind text not null default 'photo' check (kind in ('photo', 'video')),
  url text not null default '',
  thumb_url text not null default '',
  collection text not null default '',
  caption text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.media_items (gallery_id, sort_order);

-- Gallery PINs live in a private table no client can read. Editors type a PIN into galleries.pin;
-- the trigger hashes it into gallery_secrets and blanks the column (leave blank to keep the old PIN).
create table public.gallery_secrets (
  gallery_id uuid primary key references public.galleries (id) on delete cascade,
  pin_hash text not null
);
alter table public.gallery_secrets enable row level security; -- no policies: only security definer code reads it

create or replace function public.stash_gallery_pin()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.pin <> '' then
    insert into public.gallery_secrets (gallery_id, pin_hash) values (new.id, crypt(new.pin, gen_salt('bf')))
    on conflict (gallery_id) do update set pin_hash = excluded.pin_hash;
    update public.galleries set pin = '' where id = new.id;
  end if;
  return null;
end;
$$;
create trigger stash_pin after insert or update of pin on public.galleries for each row when (new.pin <> '') execute function public.stash_gallery_pin();

-- Visitors read gallery media only through this function, which checks access mode, expiry and PIN.
create or replace function public.gallery_media(p_slug text, p_pin text default null)
returns setof public.media_items language plpgsql stable security definer set search_path = public, extensions as $$
declare g public.galleries; h text;
begin
  select * into g from public.galleries where slug = p_slug and published;
  if not found or (g.expires_on is not null and g.expires_on < current_date) then
    return;
  end if;
  if g.access_mode = 'pin' then
    select pin_hash into h from public.gallery_secrets where gallery_id = g.id;
    if p_pin is null or h is null or crypt(p_pin, h) <> h then
      raise exception 'Wrong PIN' using errcode = '28000';
    end if;
  end if;
  return query select * from public.media_items where gallery_id = g.id order by sort_order;
end;
$$;
grant execute on function public.gallery_media(text, text) to anon, authenticated;

-- ---------- Row Level Security ----------
do $$
declare t text;
begin
  foreach t in array array['services', 'projects_public', 'highlights', 'team', 'testimonials', 'news_stories', 'opportunities', 'events', 'galleries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "public reads published" on public.%I for select using (published or public.is_cms_editor())', t);
    execute format('create policy "cms edits" on public.%I for all to authenticated using (public.is_cms_editor()) with check (public.is_cms_editor())', t);
    execute format('create trigger audit_%s after insert or update or delete on public.%I for each row execute function public.audit_row()', t, t);
  end loop;
end $$;

alter table public.site_settings enable row level security;
create policy "public reads settings" on public.site_settings for select using (true);
create policy "cms edits settings" on public.site_settings for all to authenticated using (public.is_cms_editor()) with check (public.is_cms_editor());
create trigger audit_site_settings after insert or update or delete on public.site_settings for each row execute function public.audit_row();
create trigger touch_site_settings before update on public.site_settings for each row execute function public.touch_updated_at();

alter table public.partners enable row level security;
create policy "public reads partners" on public.partners for select using (true);
create policy "cms edits partners" on public.partners for all to authenticated using (public.is_cms_editor()) with check (public.is_cms_editor());
create trigger audit_partners after insert or update or delete on public.partners for each row execute function public.audit_row();

-- Testimonials: the internal person name is never readable by anonymous visitors.
revoke select on public.testimonials from anon;
grant select (id, division_id, company, quote, rating, sort_order, published, created_at) on public.testimonials to anon;

alter table public.media_items enable row level security;
create policy "cms reads media" on public.media_items for select to authenticated using (public.is_cms_editor());
create policy "cms edits media" on public.media_items for all to authenticated using (public.is_cms_editor()) with check (public.is_cms_editor());

-- Bookings and subscribers: anyone may submit, only staff may read.
alter table public.bookings enable row level security;
create policy "anyone submits a booking" on public.bookings for insert to anon, authenticated with check (status = 'new');
create policy "growth reads bookings" on public.bookings for select to authenticated using (public.is_cms_editor() or public.has_role(auth.uid(), 'receptionist'));
create policy "growth updates bookings" on public.bookings for update to authenticated using (public.is_cms_editor()) with check (public.is_cms_editor());
create policy "growth deletes bookings" on public.bookings for delete to authenticated using (public.is_cms_editor());
create trigger audit_bookings after update or delete on public.bookings for each row execute function public.audit_row();

alter table public.subscribers enable row level security;
create policy "anyone subscribes" on public.subscribers for insert to anon, authenticated with check (status = 'pending' and consent);
create policy "growth reads subscribers" on public.subscribers for select to authenticated using (public.is_cms_editor());
create policy "growth updates subscribers" on public.subscribers for update to authenticated using (public.is_cms_editor()) with check (public.is_cms_editor());
create policy "growth deletes subscribers" on public.subscribers for delete to authenticated using (public.is_cms_editor());
create trigger audit_subscribers after update or delete on public.subscribers for each row execute function public.audit_row();

-- ---------- Storage (Supabase driver). With the S3/R2 driver, files go to that bucket instead. ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 524288000)
on conflict (id) do nothing;

create policy "public reads media bucket" on storage.objects for select using (bucket_id = 'media');
create policy "cms uploads to media bucket" on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_cms_editor());
create policy "cms updates media bucket" on storage.objects for update to authenticated using (bucket_id = 'media' and public.is_cms_editor());
create policy "cms deletes from media bucket" on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_cms_editor());

-- ===================== 0003_seed_public_content.sql =====================
-- Basil Media OS · 0003 starter content (generated by scripts/gen-seed-sql.mjs — edit seed.ts, not this file).
-- Everything here is editable in the Website CMS.

insert into public.site_settings (id, tagline, tagline_highlight, hero_kicker, hero_subtitle, hero_image_url, hero_video_url, logo_url, logo_reverse_url, about_story, about_image_url, ceo_name, ceo_title, ceo_message, ceo_photo_url, mission, vision, company_profile_url, contact_email, phone, whatsapp, address, map_embed_url, footer_about, socials, stats, live_ticker, services_mega_image_url) values
  ('site', 'We Don''t Just Capture Moments —', 'We Create Them.', 'VIDEO · PHOTOGRAPHY · PODCAST · LIVE STREAMING — DAR ES SALAAM', 'Films, photos, podcasts and live streams from Dar es Salaam.', '', '', '/logo.svg', '/logo-reverse.svg', 'Basil Media is a youth-driven digital media platform dedicated to health education, innovation, and impactful storytelling. We exist to inform, inspire, and empower young people with reliable health information, creative ideas, and forward-thinking solutions that shape a healthier future.

Through engaging content, expert conversations, and real-life stories, Basil Media bridges the gap between medical knowledge, innovation, and the everyday lives of young people. Our focus spans health awareness, mental well-being, medical education, technology, entrepreneurship, and youth-led innovation.

We collaborate with healthcare professionals, institutions, innovators, and young change-makers to deliver content that is educational, relatable, and transformative.

At Basil Media, we believe the youth are not just the leaders of tomorrow—but the innovators of today. Learn. Innovate. Inspire.', '/media/basil-media-studio-btv.webp', 'Emmanuel Basil', 'Founder & CEO, Basil Media', '', '', 'To tell the stories of Tanzanian institutions and people with honesty, craft and care, and to deliver every frame on time.', 'To be East Africa’s most trusted media house: the studio institutions call when the moment matters.', '', 'hello@basilmedia.co.tz', '+255 625 199 652', '+255625199652', '2 Mataka Street, Upanga, Dar es Salaam, Tanzania', '', 'Video, photography, podcasts and live streaming from Dar es Salaam — delivered through our own studio platform.', '{"instagram":"https://instagram.com/","youtube":"https://www.youtube.com/@basilmediatz","facebook":"https://facebook.com/","linkedin":"https://linkedin.com/","tiktok":"https://tiktok.com/","x":"https://x.com/"}'::jsonb, '[{"value":250,"suffix":"+","label":"projects delivered"},{"value":60,"suffix":"+","label":"clients"},{"value":6,"label":"years"},{"value":4,"label":"awards"}]'::jsonb, 'Gallery delivered · Tanzania Health Summit · 2,431 photos', '');

insert into public.services (title, slug, short, description, deliverables, icon, image_url, video_url, sort_order, published) values
  ('Video Production', 'video-production', 'Films, documentaries and campaign spots.', 'Documentaries, corporate films and campaign spots, from script and casting to colour grade and subtitles in English and Kiswahili.', array['Script & storyboard', 'Shoot crew', 'Edit & colour', 'Subtitles EN / SW']::text[], 'video', '', '', 1, true),
  ('Photography', 'photography', 'Events, portraits and private client galleries.', 'Events, portraits and product photography delivered in private galleries with selfie Find Me, favourites and HD downloads.', array['Event coverage', 'Private gallery', 'Find Me by selfie', 'QR poster']::text[], 'camera', '', '', 2, true),
  ('Podcast Production', 'podcast-production', 'Studio and remote series, video and audio.', 'Video and audio podcasts, recorded in studio or on location, edited and published to every platform.', array['Studio recording', 'Multi-camera', 'Clips for social', 'Publishing']::text[], 'mic', '', '', 3, true),
  ('Live Streaming', 'live-streaming', 'Multi-camera summits, launches, graduations.', 'Multi-camera live streams for summits, launches and graduations, with graphics and a highlights film after.', array['Multi-camera switch', 'Lower thirds', 'Stream to any platform', 'Highlights film']::text[], 'radio', '', '', 4, true),
  ('Brand Storytelling', 'brand-storytelling', 'The story behind your organisation, told well.', 'The people and purpose behind your organisation, told in film, photo and words.', array['Story workshop', 'Interviews', 'Hero film', 'Photo essay']::text[], 'sparkles', '', '', 5, true),
  ('Corporate Content', 'corporate-content', 'Monthly content for social, web and internal use.', 'A monthly retainer: a year calendar of shoots and posts, approvals in your portal, and a report every month.', array['Year calendar', 'Monthly allowance', 'Post approvals', 'Monthly report']::text[], 'briefcase', '', '', 6, true);

insert into public.projects_public (title, category, client, image_url, video_url, external_url, description, featured, sort_order, published) values
  ('#LIVE: The 2026 PAT Scientific Conference — Mwanza', 'Corporate', 'Paediatric Association of Tanzania (PAT)', '/media/pat-scientific-conference-2026-live.webp', '', '', 'Live stream of the 2026 PAT Scientific Conference, 15 July 2026, Malaika Beach Resort, Mwanza. Theme: “Resilient Health Systems for Every Child: Innovation, Equity and Quality of Care”.', true, 1, true),
  ('#LIVE: National Medical Congress 2026 — UDSM', 'Corporate', 'Medical Association of Tanzania (MAT)', '/media/national-medical-congress-2026-live.webp', '', '', 'Live stream of the National Medical Congress 2026 presented by the Medical Association of Tanzania, 17 June 2026, UDSM, Dar es Salaam. Theme: “Tanzania Vision 2050: The Healthcare We Want”.', true, 2, true),
  ('Kutoka kilo 145 ➝ 75: safari ya Said Shukuru', 'Films & Documentaries', 'Aga Khan Hospital, Dar es Salaam', '/media/said-shukuru-145-to-75-kilo-journey.webp', '', '', 'Said Shukuru’s journey from 145 kg to 75 kg — a real-life health story connected to Aga Khan Hospital, Dar es Salaam.', true, 3, true),
  ('Sikiliza historia ya Tanzania Health Summit — Dr Omary Chillo', 'Podcasts', 'Tanzania Health Summit', '/media/tanzania-health-summit-dr-omary-chillo.webp', '', '', 'Dr Omary Chillo on the history of the Tanzania Health Summit, its achievements and its challenges.', true, 4, true),
  ('Inasisimua: Mama Sabrina na mwanae mwenye sickle cell', 'Films & Documentaries', 'Basil Media', '/media/mama-sabrina-sickle-cell.webp', '', '', 'The story of Mama Sabrina and how she fights for her child living with sickle cell disease.', true, 5, true),
  ('Fahamu kuhusu tiba asili — Chuo Kikuu cha Muhimbili', 'Films & Documentaries', 'Muhimbili University of Health and Allied Sciences (MUHAS)', '/media/muhas-tiba-asili.webp', '', '', 'Traditional medicine explained, from Muhimbili University of Health and Allied Sciences.', true, 6, true),
  ('The Pharmacist — Ep 03: Afya Fiesta 2025 with TAMSA', 'Podcasts', 'TAMSA', '/media/the-pharmacist-ep03-afya-fiesta-tamsa.webp', '', '', 'Episode 3 of The Pharmacist, recorded in the Basil Media (BTV) studio: Afya Fiesta 2025 with TAMSA.', false, 7, true),
  ('Prof Karim Manji — niko MUHAS kwa mwaka wa 37', 'Films & Documentaries', 'Muhimbili University of Health and Allied Sciences (MUHAS)', '/media/prof-karim-manji-muhas.webp', '', '', 'Prof Karim Manji on 37 years at MUHAS.', false, 8, true),
  ('Uzinduzi wa kongamano la kwanza la wanataaluma wa famasi Tanzania', 'Corporate', 'Basil Media', '/media/pharmacy-professionals-congress-launch.webp', '', '', 'The launch of the first congress of pharmacy professionals in Tanzania.', false, 9, true),
  ('The Medics — Ep 05: Vifo vyenye utata', 'Podcasts', 'Basil Media', '/media/the-medics-ep05.webp', '', '', 'Episode 5 of The Medics, a Basil Media health talk show.', false, 10, true),
  ('Sip & Talk — Ep 04: Namna ya kuondokana na msongo wa mawazo', 'Podcasts', 'Basil Media', '/media/sip-and-talk-ep04.webp', '', '', 'Episode 4 of Sip & Talk: how to overcome stress.', false, 11, true),
  ('Unistar Talk — Ep 02', 'Podcasts', 'Basil Media', '/media/unistar-talk-ep02.webp', '', '', 'Episode 2 of Unistar Talk, recorded in the Basil Media (BTV) studio.', false, 12, true),
  ('Fahamu kuhusu uwekezaji wa hisa', 'Films & Documentaries', 'Basil Media', '/media/uwekezaji-wa-hisa.webp', '', '', 'An explainer on investing in shares — one of the most-watched videos on the Basil Media Tz channel.', false, 13, true),
  ('Mambo usiyoyafahamu kuhusu safari ya kwenda mwezini', 'Films & Documentaries', 'Basil Media', '/media/safari-ya-kwenda-mwezini.webp', '', '', 'What you did not know about the journey to the moon — a science explainer.', false, 14, true),
  ('Graduation day', 'Photo Stories', 'University of Health Sciences', '', '', '', 'Project summary written in the admin: the brief, what we made, and the result for the client.', false, 15, true),
  ('Delegates of the summit', 'Photo Stories', 'Tanzania Health Summit', '', '', '', 'Project summary written in the admin: the brief, what we made, and the result for the client.', false, 16, true);

insert into public.team (name, role, photo_url, bio, sort_order, published) values
  ('Emmanuel', 'Chief Executive Officer', '', '', 1, true),
  ('Saul', 'General Manager & CFO', '', '', 2, true),
  ('Benedicto', 'Head of Production', '', '', 3, true),
  ('Jonathan', 'Director of Photography', '', '', 4, true),
  ('Enock', 'Project Lead · Events', '', '', 5, true),
  ('Rehema', 'Front Desk & Client Care', '', '', 6, true);

insert into public.news_stories (title, dek, tag, featured, body, sector, image_url, read_minutes, published, published_at) values
  ('New national guidelines on antibiotic stewardship for referral hospitals', 'What changes on the ward from next quarter, and the reporting each facility now owes the regulator.', 'Policy', true, 'What changes on the ward from next quarter, and the reporting each facility now owes the regulator.

Full story text is written and approved by a Basil Media editor in the CMS. Nothing is published without human review.', 'Health', '', 3, true, '2026-11-06'),
  ('Registration renewals: council deadline moves to 31 December', 'Practitioners renewing licences this year should upload CPD points before the new cut-off.', 'Regulation', false, 'Practitioners renewing licences this year should upload CPD points before the new cut-off.

Full story text is written and approved by a Basil Media editor in the CMS. Nothing is published without human review.', 'Health', '', 4, true, '2026-11-04'),
  ('Local study: shorter TB regimens hold up in Tanzanian clinics', 'A multi-site trial reports outcomes in line with WHO findings across four regions.', 'Research', false, 'A multi-site trial reports outcomes in line with WHO findings across four regions.

Full story text is written and approved by a Basil Media editor in the CMS. Nothing is published without human review.', 'Health', '', 5, true, '2026-11-02'),
  ('Paediatric oncology unit opens second ward', 'Bed capacity doubles, with a family hostel built alongside.', 'Facilities', false, 'Bed capacity doubles, with a family hostel built alongside.

Full story text is written and approved by a Basil Media editor in the CMS. Nothing is published without human review.', 'Health', '', 3, true, '2026-10-31'),
  ('Nurses’ conference calls for abstracts on community care', 'Submissions close next month; selected papers present in Dodoma.', 'Events', false, 'Submissions close next month; selected papers present in Dodoma.

Full story text is written and approved by a Basil Media editor in the CMS. Nothing is published without human review.', 'Health', '', 4, true, '2026-10-29'),
  ('Drug alert: recall of one batch of an oral antibiotic', 'The regulator lists the affected batch number and the return process for pharmacies.', 'Alert', false, 'The regulator lists the affected batch number and the return process for pharmacies.

Full story text is written and approved by a Basil Media editor in the CMS. Nothing is published without human review.', 'Health', '', 5, true, '2026-10-27');

insert into public.opportunities (title, org, location, kind, closes_on, link, published) values
  ('Consultant Paediatrician', 'Regional Referral Hospital', 'Mwanza', 'Job', '2026-11-27', '', true),
  ('Clinical research fellowship (12 months)', 'Health Research Institute', 'Dar es Salaam', 'Fellowship', '2026-12-06', '', true),
  ('Masters scholarship in public health', 'Bank Foundation', 'Tanzania', 'Scholarship', '2026-12-21', '', true),
  ('Call for abstracts: community nursing', 'Nurses’ Association', 'Dodoma', 'Call for abstracts', '2026-12-04', '', true);

insert into public.events (title, venue, starts_on, cpd, sector, link, published) values
  ('Tanzania Health Summit', 'JNICC, Dar es Salaam', '2026-11-20', '12 CPD points', 'Health', '', true),
  ('Cardiology update for clinicians', 'Online', '2026-11-28', '4 CPD points', 'Health', '', true),
  ('East African Paediatrics Congress', 'Arusha', '2026-12-16', '16 CPD points', 'Health', '', true),
  ('Pharmacy practice workshop', 'Dodoma', '2026-12-31', '6 CPD points', 'Health', '', true),
  ('Nursing leadership forum', 'Mwanza', '2027-01-15', '8 CPD points', 'Health', '', true);

with g as (
insert into public.galleries (slug, title, client_name, event_date, location, cover_url, collections, access_mode, pin, expires_on, allow_downloads, selection_limit, face_search_enabled, published) values
  ('graduation-2026', 'Graduation 2026', 'University of Health Sciences', '2026-10-25', 'Upanga, Dar es Salaam', '', array['Ceremony', 'Portraits', 'Booth', 'Candid']::text[], 'public', '', '2027-02-04', true, 30, false, true)
  returning id
)
insert into public.media_items (gallery_id, kind, url, thumb_url, collection, caption, sort_order)
select g.id, v.* from g, (values
  ('photo', '', '', 'Ceremony', 'Ceremony · 001', 1),
  ('photo', '', '', 'Portraits', 'Portraits · 002', 2),
  ('photo', '', '', 'Booth', 'Booth · 003', 3),
  ('photo', '', '', 'Candid', 'Candid · 004', 4),
  ('photo', '', '', 'Ceremony', 'Ceremony · 005', 5),
  ('photo', '', '', 'Portraits', 'Portraits · 006', 6),
  ('photo', '', '', 'Booth', 'Booth · 007', 7),
  ('photo', '', '', 'Candid', 'Candid · 008', 8),
  ('photo', '', '', 'Ceremony', 'Ceremony · 009', 9),
  ('photo', '', '', 'Portraits', 'Portraits · 010', 10),
  ('photo', '', '', 'Booth', 'Booth · 011', 11),
  ('photo', '', '', 'Candid', 'Candid · 012', 12),
  ('photo', '', '', 'Ceremony', 'Ceremony · 013', 13),
  ('photo', '', '', 'Portraits', 'Portraits · 014', 14),
  ('photo', '', '', 'Booth', 'Booth · 015', 15),
  ('photo', '', '', 'Candid', 'Candid · 016', 16)
) as v(kind, url, thumb_url, collection, caption, sort_order);

-- ===================== 0004_os_core.sql =====================
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

-- ===================== 0005_projects.sql =====================
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

-- ===================== 0006_finance.sql =====================
-- Basil Media OS · 0006 Finance & Approvals
-- Money requests with a segregated approval chain (requester → GM/CFO → Boss → Finance → retire → reconcile),
-- project budget lines, income/expenses, quotations, invoices with payments and receipts, and payroll lite.
-- Every workflow transition is a SECURITY DEFINER function that checks role AND segregation of duties.
-- Settings (approval_limits, vat_rate, statutory_rates, numbering, retirement_days, block_on_unretired)
-- come from public.app_settings (0004). Clients and projects come from 0005 (only altered here).

-- ---------------------------------------------------------------- helpers
alter table public.projects add column if not exists budget numeric(14, 2) not null default 0;
alter table public.projects add column if not exists contract_value numeric(14, 2) not null default 0;

create or replace function public.fin_setting(_key text)
returns jsonb language sql stable security definer set search_path = public as $$
  select value from public.app_settings where key = _key;
$$;

-- public.is_staff(_user default auth.uid()) is defined once in 0005_projects.sql.

-- Document numbering from app_settings.numbering, e.g. "BM-INV-{YYYY}-{0000}". Yearly counters reset each year.
create table public.doc_counters (
  kind text not null,
  year int not null,
  last int not null default 0,
  primary key (kind, year)
);
alter table public.doc_counters enable row level security; -- no policies: only definer functions touch it

create or replace function public.next_doc_number(_kind text)
returns text language plpgsql security definer set search_path = public as $$
declare
  fmt text := coalesce(public.fin_setting('numbering') ->> _kind, 'BM-' || upper(_kind) || '-{0000}');
  yr int := extract(year from (now() at time zone 'Africa/Dar_es_Salaam'))::int;
  bucket int := case when position('{YYYY}' in fmt) > 0 then yr else 0 end;
  n int;
begin
  insert into public.doc_counters (kind, year, last) values (_kind, bucket, 1)
  on conflict (kind, year) do update set last = public.doc_counters.last + 1
  returning last into n;
  return replace(replace(fmt, '{YYYY}', yr::text), '{0000}', lpad(n::text, 4, '0'));
end;
$$;
revoke execute on function public.next_doc_number(text) from public, anon;
grant execute on function public.next_doc_number(text) to authenticated;

-- Progressive PAYE from bands [[upper, rate%], …, [null, rate%]].
create or replace function public.paye_for(_taxable numeric, _bands jsonb)
returns numeric language plpgsql immutable as $$
declare lo numeric := 0; tax numeric := 0; b jsonb; hi numeric; rate numeric;
begin
  for b in select value from jsonb_array_elements(coalesce(_bands, '[]')) loop
    hi := case when jsonb_typeof(b -> 0) = 'null' then null else (b ->> 0)::numeric end;
    rate := (b ->> 1)::numeric;
    if hi is null or _taxable <= hi then
      tax := tax + greatest(_taxable - lo, 0) * rate / 100;
      exit;
    end if;
    tax := tax + (hi - lo) * rate / 100;
    lo := hi;
  end loop;
  return round(tax);
end;
$$;

-- Line-items total: sum(qty × unit_price) − discount, plus VAT when on.
create or replace function public.doc_total(_items jsonb, _discount numeric, _vat_on boolean, _vat_rate numeric)
returns numeric language sql immutable as $$
  select round(
    greatest(coalesce((select sum((i ->> 'qty')::numeric * (i ->> 'unit_price')::numeric) from jsonb_array_elements(coalesce(_items, '[]')) i), 0) - coalesce(_discount, 0), 0)
    * (1 + case when _vat_on then coalesce(_vat_rate, 0) / 100 else 0 end)
  );
$$;

-- ---------------------------------------------------------------- reference lists
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  name text not null,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (division_id, name)
);
insert into public.expense_categories (name, sort_order) values
  ('Crew', 1), ('Transport', 2), ('Equipment hire', 3), ('Per diem & meals', 4), ('Location & permits', 5),
  ('Post-production', 6), ('Music & licences', 7), ('Printing', 8), ('Contingency', 9), ('Salaries', 10),
  ('Rent & utilities', 11), ('Software & subscriptions', 12), ('Equipment repairs', 13), ('Marketing', 14),
  ('Bank & mobile money charges', 15), ('Office & petty cash', 16);

create table public.price_items (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  name text not null,
  detail text not null default '',
  unit text not null default 'item',
  unit_price numeric(14, 2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  name text not null,
  kind text not null check (kind in ('cash', 'bank', 'mobile')),
  opening_balance numeric(14, 2) not null default 0,
  opening_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- budgets
create table public.project_budget_lines (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  project_id uuid not null references public.projects (id) on delete cascade,
  line text not null check (line in ('Crew', 'Transport', 'Equipment hire', 'Per diem & meals', 'Location & permits', 'Post-production', 'Music & licences', 'Printing', 'Contingency')),
  allocated numeric(14, 2) not null default 0 check (allocated >= 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (project_id, line)
);

-- ---------------------------------------------------------------- money requests
create table public.money_requests (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  number text not null unique,
  requester_id uuid not null references auth.users (id),
  project_id uuid references public.projects (id),
  budget_line_id uuid references public.project_budget_lines (id),
  amount numeric(14, 2) not null default 0,
  approved_amount numeric(14, 2),
  purpose text not null default '',
  category text not null default '',
  needed_by date,
  payee text not null default '',
  payee_phone text not null default '',
  method text not null default 'M-Pesa' check (method in ('M-Pesa', 'Tigo Pesa', 'Airtel Money', 'HaloPesa', 'Bank transfer', 'Cash')),
  urgency text not null default 'normal' check (urgency in ('normal', 'urgent', 'critical')),
  attachment_url text not null default '',
  status text not null default 'draft' check (status in ('draft', 'submitted', 'gm_review', 'boss_approval', 'approved', 'paid', 'retired', 'reconciled', 'returned', 'rejected')),
  question text,
  recommendation text not null default '',
  over_budget boolean not null default false,
  duplicate_of uuid references public.money_requests (id),
  submitted_at timestamptz,
  stage_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id),
  approved_at timestamptz,
  approved_by uuid references auth.users (id),
  approved_alone boolean not null default false,
  paid_at timestamptz,
  paid_by uuid references auth.users (id),
  paid_method text,
  paid_reference text,
  paid_proof_url text,
  paid_account_id uuid references public.finance_accounts (id),
  retired_at timestamptz,
  change_returned numeric(14, 2) not null default 0,
  reconciled_at timestamptz,
  reconciled_by uuid references auth.users (id),
  returned_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.money_requests (status);
create index on public.money_requests (requester_id, created_at desc);

create table public.approval_steps (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  request_id uuid not null references public.money_requests (id) on delete cascade,
  step text not null check (step in ('submit', 'review', 'approve', 'answer', 'pay', 'retire', 'reconcile')),
  actor_id uuid not null references auth.users (id),
  decision text not null,
  comment text not null default '',
  amount numeric(14, 2),
  device text not null default '',
  verified_by text check (verified_by in ('pin', 'passkey')),
  at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on public.approval_steps (request_id, at);

create table public.retirements (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  request_id uuid not null references public.money_requests (id) on delete cascade,
  receipts jsonb not null default '[]', -- [{url, amount, note}]
  total_spent numeric(14, 2) not null default 0,
  change_returned numeric(14, 2) not null default 0,
  note text not null default '',
  retired_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- income & expenses
create table public.income (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  date date not null default current_date,
  amount numeric(14, 2) not null check (amount > 0),
  account_id uuid references public.finance_accounts (id),
  client_id uuid references public.clients (id),
  project_id uuid references public.projects (id),
  invoice_id uuid,
  payment_id uuid,
  category text not null default 'Client payment',
  description text not null default '',
  reference text not null default '',
  recorded_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  date date not null default current_date,
  amount numeric(14, 2) not null check (amount >= 0),
  category text not null,
  account_id uuid references public.finance_accounts (id),
  project_id uuid references public.projects (id),
  budget_line_id uuid references public.project_budget_lines (id),
  request_id uuid references public.money_requests (id),
  payroll_run_id uuid,
  payee text not null default '',
  description text not null default '',
  receipt_url text not null default '',
  petty_cash boolean not null default false,
  recorded_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

-- Committed / spent / remaining per budget line.
create or replace view public.project_budget_line_totals with (security_invoker = true) as
  select l.id, l.project_id, l.line, l.allocated,
    coalesce((select sum(coalesce(r.approved_amount, r.amount)) from public.money_requests r where r.budget_line_id = l.id and r.status = 'approved'), 0) as committed,
    coalesce((select sum(r.amount) from public.money_requests r where r.budget_line_id = l.id and r.status in ('submitted', 'gm_review', 'boss_approval')), 0) as pending,
    coalesce((select sum(coalesce(r.approved_amount, r.amount) - r.change_returned) from public.money_requests r where r.budget_line_id = l.id and r.status in ('paid', 'retired', 'reconciled')), 0)
      + coalesce((select sum(e.amount) from public.expenses e where e.budget_line_id = l.id and e.request_id is null), 0) as spent,
    l.allocated
      - coalesce((select sum(coalesce(r.approved_amount, r.amount)) from public.money_requests r where r.budget_line_id = l.id and r.status = 'approved'), 0)
      - coalesce((select sum(coalesce(r.approved_amount, r.amount) - r.change_returned) from public.money_requests r where r.budget_line_id = l.id and r.status in ('paid', 'retired', 'reconciled')), 0)
      - coalesce((select sum(e.amount) from public.expenses e where e.budget_line_id = l.id and e.request_id is null), 0) as remaining
  from public.project_budget_lines l;

-- ---------------------------------------------------------------- quotations & invoices
create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  number text unique,
  client_id uuid references public.clients (id),
  project_id uuid references public.projects (id),
  prospect text not null default '',
  title text not null default '',
  items jsonb not null default '[]', -- [{title, detail, qty, unit_price}]
  discount numeric(14, 2) not null default 0,
  vat_on boolean not null default true,
  vat_rate numeric(5, 2) not null default 18,
  issue_date date not null default current_date,
  valid_until date not null default (current_date + 30),
  status text not null default 'draft' check (status in ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired')),
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  invoice_id uuid,
  notes text not null default '',
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  number text unique,
  client_id uuid references public.clients (id),
  project_id uuid references public.projects (id),
  quotation_id uuid references public.quotations (id),
  title text not null default '',
  po_ref text not null default '',
  items jsonb not null default '[]',
  discount numeric(14, 2) not null default 0,
  vat_on boolean not null default true,
  vat_rate numeric(5, 2) not null default 18,
  deposit numeric(14, 2) not null default 0,
  schedule jsonb not null default '[]', -- [{label, pct, due}]
  issue_date date not null default current_date,
  due_date date not null default (current_date + 14),
  status text not null default 'draft' check (status in ('draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  sent_at timestamptz,
  viewed_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  notes text not null default '',
  terms text not null default '',
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
alter table public.quotations add constraint quotations_invoice_fk foreign key (invoice_id) references public.invoices (id);

create table public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  paid_on date not null default current_date,
  method text not null default 'Bank transfer',
  reference text not null default '',
  account_id uuid references public.finance_accounts (id),
  receipt_no text unique,
  is_deposit boolean not null default false,
  recorded_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
alter table public.income add constraint income_invoice_fk foreign key (invoice_id) references public.invoices (id) on delete set null;
alter table public.income add constraint income_payment_fk foreign key (payment_id) references public.invoice_payments (id) on delete cascade;

create or replace function public.number_document()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.number is null or new.number = '' then
    new.number := public.next_doc_number(case tg_table_name when 'invoices' then 'invoice' else 'quotation' end);
  end if;
  return new;
end;
$$;
create trigger number_invoices before insert on public.invoices for each row execute function public.number_document();
create trigger number_quotations before insert on public.quotations for each row execute function public.number_document();

-- A payment gets a receipt number, posts to income and moves the invoice status.
create or replace function public.before_invoice_payment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.receipt_no is null or new.receipt_no = '' then new.receipt_no := public.next_doc_number('receipt'); end if;
  return new;
end;
$$;
create or replace function public.after_invoice_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare inv public.invoices; total numeric; paid numeric;
begin
  select * into inv from public.invoices where id = coalesce(new.invoice_id, old.invoice_id);
  if tg_op = 'INSERT' then
    insert into public.income (date, amount, account_id, client_id, project_id, invoice_id, payment_id, description, reference, recorded_by)
    values (new.paid_on, new.amount, new.account_id, inv.client_id, inv.project_id, inv.id, new.id, 'Payment · ' || inv.number, new.reference, new.recorded_by);
  end if;
  total := public.doc_total(inv.items, inv.discount, inv.vat_on, inv.vat_rate);
  select coalesce(sum(amount), 0) into paid from public.invoice_payments where invoice_id = inv.id;
  update public.invoices set
    status = case when inv.status = 'cancelled' then 'cancelled'
                  when paid >= total and total > 0 then 'paid'
                  when paid > 0 then 'partially_paid'
                  when inv.due_date < current_date and inv.status <> 'draft' then 'overdue'
                  else case when inv.status in ('paid', 'partially_paid') then 'sent' else inv.status end end,
    paid_at = case when paid >= total and total > 0 then now() else null end
  where id = inv.id;
  return coalesce(new, old);
end;
$$;
create trigger before_invoice_payment before insert on public.invoice_payments for each row execute function public.before_invoice_payment();
create trigger after_invoice_payment after insert or delete on public.invoice_payments for each row execute function public.after_invoice_payment();

-- Run daily (pg_cron) to flag overdue invoices and expire quotations.
create or replace function public.mark_overdue_finance()
returns void language sql security definer set search_path = public as $$
  update public.invoices set status = 'overdue' where status in ('sent', 'viewed', 'partially_paid') and due_date < current_date
    and coalesce((select sum(amount) from public.invoice_payments p where p.invoice_id = invoices.id), 0) < public.doc_total(items, discount, vat_on, vat_rate);
  update public.quotations set status = 'expired' where status in ('draft', 'sent', 'viewed') and valid_until < current_date;
$$;
revoke execute on function public.mark_overdue_finance() from public, anon, authenticated;

-- ---------------------------------------------------------------- payroll lite
create table public.salary_profiles (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  user_id uuid not null unique references auth.users (id),
  full_name text not null default '',
  title text not null default '',
  basic numeric(14, 2) not null default 0,
  allowances numeric(14, 2) not null default 0,
  deductions numeric(14, 2) not null default 0, -- loans, advances, other
  pay_method text not null default 'Bank transfer',
  pay_account text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  period text not null, -- YYYY-MM
  pay_day date not null,
  status text not null default 'prepared' check (status in ('prepared', 'reviewed', 'approved', 'paid', 'returned')),
  headcount int not null default 0,
  gross numeric(14, 2) not null default 0,
  paye numeric(14, 2) not null default 0,
  nssf_employee numeric(14, 2) not null default 0,
  nssf_employer numeric(14, 2) not null default 0,
  wcf numeric(14, 2) not null default 0,
  sdl numeric(14, 2) not null default 0,
  other_deductions numeric(14, 2) not null default 0,
  net numeric(14, 2) not null default 0,
  rates jsonb not null default '{}',
  comment text not null default '',
  prepared_by uuid references auth.users (id), prepared_at timestamptz,
  reviewed_by uuid references auth.users (id), reviewed_at timestamptz,
  approved_by uuid references auth.users (id), approved_at timestamptz, verified_by text,
  paid_by uuid references auth.users (id), paid_at timestamptz, paid_reference text,
  created_at timestamptz not null default now(),
  unique (division_id, period)
);

create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  run_id uuid not null references public.payroll_runs (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  full_name text not null default '',
  title text not null default '',
  basic numeric(14, 2) not null default 0,
  allowances numeric(14, 2) not null default 0,
  gross numeric(14, 2) not null default 0,
  nssf numeric(14, 2) not null default 0,
  taxable numeric(14, 2) not null default 0,
  paye numeric(14, 2) not null default 0,
  other_deductions numeric(14, 2) not null default 0,
  net numeric(14, 2) not null default 0,
  nssf_employer numeric(14, 2) not null default 0,
  wcf numeric(14, 2) not null default 0,
  sdl numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);
alter table public.expenses add constraint expenses_payroll_fk foreign key (payroll_run_id) references public.payroll_runs (id) on delete set null;

-- ---------------------------------------------------------------- RLS
alter table public.expense_categories enable row level security;
alter table public.price_items enable row level security;
alter table public.finance_accounts enable row level security;
alter table public.project_budget_lines enable row level security;
alter table public.money_requests enable row level security;
alter table public.approval_steps enable row level security;
alter table public.retirements enable row level security;
alter table public.income enable row level security;
alter table public.expenses enable row level security;
alter table public.quotations enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.salary_profiles enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payslips enable row level security;

create policy "staff read categories" on public.expense_categories for select to authenticated using (public.is_staff(auth.uid()));
create policy "finance edits categories" on public.expense_categories for all to authenticated
  using (public.has_any_role(auth.uid(), array['finance', 'gm_cfo']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['finance', 'gm_cfo']::public.app_role[]));

create policy "staff read price list" on public.price_items for select to authenticated using (public.is_staff(auth.uid()));
create policy "finance edits price list" on public.price_items for all to authenticated
  using (public.has_any_role(auth.uid(), array['finance', 'gm_cfo', 'account_manager']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['finance', 'gm_cfo', 'account_manager']::public.app_role[]));

create policy "money roles read accounts" on public.finance_accounts for select to authenticated using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance']::public.app_role[]));
create policy "gm edits accounts" on public.finance_accounts for all to authenticated
  using (public.has_role(auth.uid(), 'gm_cfo')) with check (public.has_role(auth.uid(), 'gm_cfo'));

create policy "staff read budget lines" on public.project_budget_lines for select to authenticated using (public.is_staff(auth.uid()));
create policy "leaders set budgets" on public.project_budget_lines for all to authenticated
  using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['boss', 'gm_cfo']::public.app_role[]));

create policy "see own or money roles" on public.money_requests for select to authenticated
  using (requester_id = auth.uid() or public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance']::public.app_role[]));
create policy "requester starts a draft" on public.money_requests for insert to authenticated
  with check (requester_id = auth.uid() and status = 'draft' and public.is_staff(auth.uid()));
create policy "requester edits own draft" on public.money_requests for update to authenticated
  using (requester_id = auth.uid() and status in ('draft', 'returned')) with check (requester_id = auth.uid() and status in ('draft', 'returned'));
create policy "requester deletes own draft" on public.money_requests for delete to authenticated using (requester_id = auth.uid() and status = 'draft');
-- Every transition after the draft goes through submit_money_request and the other definer functions.

create policy "steps follow request" on public.approval_steps for select to authenticated
  using (exists (select 1 from public.money_requests r where r.id = request_id and (r.requester_id = auth.uid() or public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance']::public.app_role[]))));
create policy "retirements follow request" on public.retirements for select to authenticated
  using (exists (select 1 from public.money_requests r where r.id = request_id and (r.requester_id = auth.uid() or public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance']::public.app_role[]))));

create policy "money roles read income" on public.income for select to authenticated using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance']::public.app_role[]));
create policy "finance records income" on public.income for all to authenticated
  using (public.has_any_role(auth.uid(), array['finance', 'gm_cfo']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['finance', 'gm_cfo']::public.app_role[]));
create policy "money roles read expenses" on public.expenses for select to authenticated using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance']::public.app_role[]));
create policy "finance records expenses" on public.expenses for all to authenticated
  using (public.has_any_role(auth.uid(), array['finance', 'gm_cfo']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['finance', 'gm_cfo']::public.app_role[]));

create policy "sales roles read quotations" on public.quotations for select to authenticated using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance', 'account_manager', 'growth']::public.app_role[]));
create policy "sales roles write quotations" on public.quotations for all to authenticated
  using (public.has_any_role(auth.uid(), array['gm_cfo', 'finance', 'account_manager']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['gm_cfo', 'finance', 'account_manager']::public.app_role[]));
create policy "money roles read invoices" on public.invoices for select to authenticated using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance', 'account_manager']::public.app_role[]));
create policy "finance writes invoices" on public.invoices for all to authenticated
  using (public.has_any_role(auth.uid(), array['gm_cfo', 'finance']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['gm_cfo', 'finance']::public.app_role[]));
create policy "money roles read payments" on public.invoice_payments for select to authenticated using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance', 'account_manager']::public.app_role[]));
create policy "finance records payments" on public.invoice_payments for insert to authenticated with check (public.has_role(auth.uid(), 'finance'));
create policy "finance removes payments" on public.invoice_payments for delete to authenticated using (public.has_role(auth.uid(), 'finance'));

create policy "own salary or money roles" on public.salary_profiles for select to authenticated
  using (user_id = auth.uid() or public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance']::public.app_role[]));
create policy "finance edits salary profiles" on public.salary_profiles for all to authenticated
  using (public.has_any_role(auth.uid(), array['finance', 'gm_cfo']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['finance', 'gm_cfo']::public.app_role[]));
create policy "money roles read payroll" on public.payroll_runs for select to authenticated using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance']::public.app_role[]));
create policy "own payslips once paid" on public.payslips for select to authenticated
  using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance']::public.app_role[])
         or (user_id = auth.uid() and exists (select 1 from public.payroll_runs pr where pr.id = run_id and pr.status = 'paid')));

-- ---------------------------------------------------------------- audit
create trigger audit_expense_categories after insert or update or delete on public.expense_categories for each row execute function public.audit_row();
create trigger audit_price_items after insert or update or delete on public.price_items for each row execute function public.audit_row();
create trigger audit_finance_accounts after insert or update or delete on public.finance_accounts for each row execute function public.audit_row();
create trigger audit_project_budget_lines after insert or update or delete on public.project_budget_lines for each row execute function public.audit_row();
create trigger audit_money_requests after insert or update or delete on public.money_requests for each row execute function public.audit_row();
create trigger audit_approval_steps after insert or update or delete on public.approval_steps for each row execute function public.audit_row();
create trigger audit_retirements after insert or update or delete on public.retirements for each row execute function public.audit_row();
create trigger audit_income after insert or update or delete on public.income for each row execute function public.audit_row();
create trigger audit_expenses after insert or update or delete on public.expenses for each row execute function public.audit_row();
create trigger audit_quotations after insert or update or delete on public.quotations for each row execute function public.audit_row();
create trigger audit_invoices after insert or update or delete on public.invoices for each row execute function public.audit_row();
create trigger audit_invoice_payments after insert or update or delete on public.invoice_payments for each row execute function public.audit_row();
create trigger audit_salary_profiles after insert or update or delete on public.salary_profiles for each row execute function public.audit_row();
create trigger audit_payroll_runs after insert or update or delete on public.payroll_runs for each row execute function public.audit_row();
create trigger audit_payslips after insert or update or delete on public.payslips for each row execute function public.audit_row();

-- ---------------------------------------------------------------- approval engine
create or replace function public.mr_line_category(_line uuid)
returns text language sql stable security definer set search_path = public as $$
  select line from public.project_budget_lines where id = _line;
$$;

-- Requester submits (or re-submits a returned request). GM/CFO requesters go straight to the Boss.
create or replace function public.submit_money_request(_data jsonb, _id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r public.money_requests;
  days int := coalesce((public.fin_setting('retirement_days') #>> '{}')::int, 3);
  blocking boolean := coalesce((public.fin_setting('block_on_unretired') #>> '{}')::boolean, true);
  is_gm boolean := public.has_role(me, 'gm_cfo') and not public.has_role(me, 'super_admin');
  was_returned boolean := false;
  rem numeric; dup uuid; nxt text;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if not public.is_staff(me) then raise exception 'Only staff can request money'; end if;
  if blocking and exists (select 1 from public.money_requests where requester_id = me and status = 'paid' and paid_at < now() - make_interval(days => days)) then
    raise exception 'Retire the receipts for your earlier advance before requesting more money';
  end if;
  if _id is null then
    insert into public.money_requests (number, requester_id) values (public.next_doc_number('request'), me) returning * into r;
  else
    select * into r from public.money_requests where id = _id for update;
    if not found then raise exception 'Request not found'; end if;
    if r.requester_id <> me then raise exception 'Only the requester can submit this request'; end if;
    if r.status not in ('draft', 'returned') then raise exception 'This request is already %', r.status; end if;
    was_returned := r.status = 'returned';
    if r.number like 'DRAFT-%' then
      update public.money_requests set number = public.next_doc_number('request') where id = r.id returning * into r;
    end if;
  end if;

  update public.money_requests set
    project_id = nullif(_data ->> 'project_id', '')::uuid,
    budget_line_id = nullif(_data ->> 'budget_line_id', '')::uuid,
    amount = coalesce((_data ->> 'amount')::numeric, 0),
    purpose = coalesce(_data ->> 'purpose', ''),
    category = coalesce(nullif(_data ->> 'category', ''), public.mr_line_category(nullif(_data ->> 'budget_line_id', '')::uuid), ''),
    needed_by = nullif(_data ->> 'needed_by', '')::date,
    payee = coalesce(_data ->> 'payee', ''),
    payee_phone = coalesce(_data ->> 'payee_phone', ''),
    method = coalesce(nullif(_data ->> 'method', ''), 'M-Pesa'),
    urgency = coalesce(nullif(_data ->> 'urgency', ''), 'normal'),
    attachment_url = coalesce(_data ->> 'attachment_url', '')
  where id = r.id returning * into r;

  if r.amount <= 0 then raise exception 'Enter an amount above zero'; end if;
  if length(trim(r.purpose)) < 3 then raise exception 'Say what the money is for'; end if;
  if r.budget_line_id is not null and not exists (select 1 from public.project_budget_lines where id = r.budget_line_id and project_id = r.project_id) then
    raise exception 'That budget line belongs to another project';
  end if;

  select remaining into rem from public.project_budget_line_totals where id = r.budget_line_id;
  select id into dup from public.money_requests
    where requester_id = me and id <> r.id and amount = r.amount and project_id is not distinct from r.project_id
      and status not in ('draft', 'rejected') and created_at > now() - interval '7 days'
    order by created_at desc limit 1;

  nxt := case when is_gm then 'boss_approval' else 'gm_review' end;
  update public.money_requests set status = nxt, submitted_at = now(), stage_at = now(), question = null,
    over_budget = coalesce(r.amount > rem, false), duplicate_of = dup, returned_at = null
  where id = r.id;
  insert into public.approval_steps (request_id, step, actor_id, decision, comment, amount)
  values (r.id, 'submit', me, case when was_returned then 'resubmitted' else 'submitted' end, coalesce(_data ->> 'comment', ''), r.amount);

  if is_gm then
    perform public.notify_role('boss', 'Approval needed · TSH ' || to_char(r.amount, 'FM999,999,999,990'), r.purpose || ' · requested by GM/CFO', '/app?tab=approvals', 'approval');
  else
    perform public.notify_role('gm_cfo', 'New money request ' || r.number, r.purpose || ' · TSH ' || to_char(r.amount, 'FM999,999,999,990'), '/app?tab=review', 'money');
  end if;
  return r.id;
end;
$$;

-- GM/CFO: recommend (or approve alone under the limit) / return / reject.
create or replace function public.review_money_request(_id uuid, _decision text, _comment text default '')
returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r public.money_requests;
  lim jsonb := coalesce(public.fin_setting('approval_limits'), '{}');
  alone_below numeric := coalesce((lim ->> 'gm_cfo_alone_below')::numeric, 0);
  cap numeric := coalesce((lim ->> 'gm_cfo_daily_cap')::numeric, 0);
  used numeric;
begin
  if not public.has_role(me, 'gm_cfo') then raise exception 'Only the GM/CFO reviews money requests'; end if;
  select * into r from public.money_requests where id = _id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'gm_review' then raise exception 'This request is not waiting for review (it is %)', r.status; end if;
  if r.requester_id = me then raise exception 'You cannot review your own request'; end if;
  if _decision in ('return', 'reject') and length(trim(coalesce(_comment, ''))) = 0 then raise exception 'Give a reason'; end if;

  if _decision = 'recommend' then
    select coalesce(sum(approved_amount), 0) into used from public.money_requests
      where approved_alone and approved_by = me and approved_at::date = current_date;
    if r.amount < alone_below and (cap = 0 or used + r.amount <= cap) then
      update public.money_requests set status = 'approved', approved_amount = r.amount, approved_by = me, approved_at = now(), approved_alone = true,
        reviewed_by = me, reviewed_at = now(), recommendation = coalesce(_comment, ''), stage_at = now() where id = _id;
      insert into public.approval_steps (request_id, step, actor_id, decision, comment, amount) values (_id, 'review', me, 'approved_within_limit', coalesce(_comment, ''), r.amount);
      perform public.notify(r.requester_id, 'Request approved · ' || r.number, 'Approved by GM/CFO within limit. Finance will pay next.', '/app?tab=requests', 'money');
      perform public.notify_role('finance', 'Ready to pay · TSH ' || to_char(r.amount, 'FM999,999,999,990'), r.number || ' · ' || r.purpose, '/app?tab=queue', 'money');
      return 'approved';
    end if;
    update public.money_requests set status = 'boss_approval', reviewed_by = me, reviewed_at = now(), recommendation = coalesce(_comment, ''), stage_at = now() where id = _id;
    insert into public.approval_steps (request_id, step, actor_id, decision, comment, amount) values (_id, 'review', me, 'recommended', coalesce(_comment, ''), r.amount);
    perform public.notify_role('boss', 'Approval needed · TSH ' || to_char(r.amount, 'FM999,999,999,990'), r.purpose || ' · recommended by GM/CFO', '/app?tab=approvals', 'approval');
    return 'boss_approval';
  elsif _decision = 'return' then
    update public.money_requests set status = 'returned', reviewed_by = me, reviewed_at = now(), returned_at = now(), stage_at = now() where id = _id;
    insert into public.approval_steps (request_id, step, actor_id, decision, comment, amount) values (_id, 'review', me, 'returned', _comment, r.amount);
    perform public.notify(r.requester_id, 'Request returned · ' || r.number, _comment, '/app?tab=requests', 'money');
    return 'returned';
  elsif _decision = 'reject' then
    update public.money_requests set status = 'rejected', reviewed_by = me, reviewed_at = now(), rejected_at = now(), stage_at = now() where id = _id;
    insert into public.approval_steps (request_id, step, actor_id, decision, comment, amount) values (_id, 'review', me, 'rejected', _comment, r.amount);
    perform public.notify(r.requester_id, 'Request rejected · ' || r.number, _comment, '/app?tab=requests', 'money');
    return 'rejected';
  end if;
  raise exception 'Unknown decision %', _decision;
end;
$$;

-- Boss: approve / approve with a changed amount / reject / ask a question. Step-up (PIN or passkey) recorded.
create or replace function public.approve_money_request(_id uuid, _decision text, _amount numeric default null, _comment text default '', _verified_by text default null, _device text default '')
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.money_requests; amt numeric;
begin
  if not public.has_role(me, 'boss') then raise exception 'Only the Boss approves money requests'; end if;
  if public.has_role(me, 'finance') and not public.has_role(me, 'super_admin') then raise exception 'Finance cannot approve payments'; end if;
  select * into r from public.money_requests where id = _id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'boss_approval' then raise exception 'This request is not waiting for the Boss (it is %)', r.status; end if;
  if r.requester_id = me then raise exception 'You cannot approve your own request'; end if;
  if r.reviewed_by = me then raise exception 'The reviewer and the approver must be different people'; end if;

  if _decision in ('approve', 'approve_changed') then
    if coalesce(_verified_by, '') not in ('pin', 'passkey') then raise exception 'Confirm with your fingerprint or PIN'; end if;
    amt := case when _decision = 'approve_changed' then _amount else r.amount end;
    if amt is null or amt <= 0 then raise exception 'Enter the approved amount'; end if;
    update public.money_requests set status = 'approved', approved_amount = amt, approved_by = me, approved_at = now(), question = null, stage_at = now() where id = _id;
    insert into public.approval_steps (request_id, step, actor_id, decision, comment, amount, device, verified_by)
    values (_id, 'approve', me, case when amt <> r.amount then 'approved_changed' else 'approved' end, coalesce(_comment, ''), amt, coalesce(_device, ''), _verified_by);
    perform public.notify(r.requester_id, 'Approved · TSH ' || to_char(amt, 'FM999,999,999,990'), r.number || ' · Finance will pay next', '/app?tab=requests', 'money');
    perform public.notify_role('finance', 'Ready to pay · TSH ' || to_char(amt, 'FM999,999,999,990'), r.number || ' · ' || r.purpose, '/app?tab=queue', 'money');
    return 'approved';
  elsif _decision = 'reject' then
    if length(trim(coalesce(_comment, ''))) = 0 then raise exception 'Give a reason'; end if;
    update public.money_requests set status = 'rejected', rejected_at = now(), approved_by = me, stage_at = now() where id = _id;
    insert into public.approval_steps (request_id, step, actor_id, decision, comment, amount, device, verified_by) values (_id, 'approve', me, 'rejected', _comment, r.amount, coalesce(_device, ''), _verified_by);
    perform public.notify(r.requester_id, 'Request rejected · ' || r.number, _comment, '/app?tab=requests', 'money');
    if r.reviewed_by is not null then perform public.notify(r.reviewed_by, 'Boss rejected ' || r.number, _comment, '', 'money'); end if;
    return 'rejected';
  elsif _decision = 'question' then
    if length(trim(coalesce(_comment, ''))) = 0 then raise exception 'Type your question'; end if;
    update public.money_requests set question = _comment where id = _id;
    insert into public.approval_steps (request_id, step, actor_id, decision, comment, amount) values (_id, 'approve', me, 'question', _comment, r.amount);
    perform public.notify(r.requester_id, 'The Boss has a question · ' || r.number, _comment, '/app?tab=requests', 'approval');
    return 'question';
  end if;
  raise exception 'Unknown decision %', _decision;
end;
$$;

-- Requester answers the Boss's question.
create or replace function public.answer_money_request(_id uuid, _answer text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.money_requests;
begin
  select * into r from public.money_requests where id = _id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.requester_id <> me then raise exception 'Only the requester can answer'; end if;
  if r.status <> 'boss_approval' or r.question is null then raise exception 'There is no open question'; end if;
  update public.money_requests set question = null where id = _id;
  insert into public.approval_steps (request_id, step, actor_id, decision, comment, amount) values (_id, 'answer', me, 'answered', _answer, r.amount);
  perform public.notify_role('boss', 'Answer on ' || r.number, _answer, '/app?tab=approvals', 'approval');
end;
$$;

-- Finance pays an approved request (never their own, never one they approved). Posts an expense.
create or replace function public.pay_money_request(_id uuid, _method text, _reference text, _proof_url text default '', _account_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.money_requests; amt numeric;
begin
  if not public.has_role(me, 'finance') then raise exception 'Only Finance pays money requests'; end if;
  select * into r from public.money_requests where id = _id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'approved' then raise exception 'Only approved requests can be paid (this one is %)', r.status; end if;
  if r.requester_id = me then raise exception 'You cannot pay your own request'; end if;
  if r.approved_by = me then raise exception 'The approver cannot also pay'; end if;
  if _method <> 'Cash' and length(trim(coalesce(_reference, ''))) = 0 then raise exception 'Enter the transaction reference'; end if;
  amt := coalesce(r.approved_amount, r.amount);
  update public.money_requests set status = 'paid', paid_at = now(), paid_by = me, paid_method = _method, paid_reference = _reference,
    paid_proof_url = coalesce(_proof_url, ''), paid_account_id = _account_id, stage_at = now() where id = _id;
  insert into public.approval_steps (request_id, step, actor_id, decision, comment, amount) values (_id, 'pay', me, 'paid', _method || ' · ' || coalesce(_reference, ''), amt);
  insert into public.expenses (date, amount, category, account_id, project_id, budget_line_id, request_id, payee, description, receipt_url, petty_cash, recorded_by)
  values (current_date, amt, coalesce(nullif(r.category, ''), 'Contingency'), _account_id, r.project_id, r.budget_line_id, r.id, r.payee, r.number || ' · ' || r.purpose, coalesce(_proof_url, ''), _method = 'Cash', me);
  perform public.notify(r.requester_id, 'Paid · TSH ' || to_char(amt, 'FM999,999,999,990'),
    _method || ' ref ' || coalesce(_reference, '') || '. Retire receipts within ' || coalesce(public.fin_setting('retirement_days') #>> '{}', '3') || ' days.', '/app?tab=requests', 'money');
end;
$$;

-- Requester retires receipts (and returns change).
create or replace function public.retire_money_request(_id uuid, _receipts jsonb, _change numeric default 0, _note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.money_requests; spent numeric; amt numeric;
begin
  select * into r from public.money_requests where id = _id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.requester_id <> me then raise exception 'Only the requester retires receipts'; end if;
  if r.status <> 'paid' then raise exception 'Only paid requests can be retired'; end if;
  if jsonb_array_length(coalesce(_receipts, '[]')) = 0 then raise exception 'Attach at least one receipt'; end if;
  amt := coalesce(r.approved_amount, r.amount);
  select coalesce(sum((x ->> 'amount')::numeric), 0) into spent from jsonb_array_elements(_receipts) x;
  if coalesce(_change, 0) < 0 or coalesce(_change, 0) > amt then raise exception 'Change returned must be between 0 and the amount paid'; end if;
  insert into public.retirements (request_id, receipts, total_spent, change_returned, note, retired_by) values (_id, _receipts, spent, coalesce(_change, 0), coalesce(_note, ''), me);
  update public.money_requests set status = 'retired', retired_at = now(), change_returned = coalesce(_change, 0), stage_at = now() where id = _id;
  update public.expenses set amount = greatest(amt - coalesce(_change, 0), 0) where request_id = _id;
  insert into public.approval_steps (request_id, step, actor_id, decision, comment, amount) values (_id, 'retire', me, 'retired', coalesce(_note, ''), spent);
  perform public.notify_role('gm_cfo', 'Receipts to reconcile · ' || r.number, 'TSH ' || to_char(spent, 'FM999,999,999,990') || ' in receipts', '/app?tab=more', 'money');
end;
$$;

-- GM/CFO reconciles retired receipts, or queries them back to the requester.
create or replace function public.reconcile_money_request(_id uuid, _decision text default 'ok', _comment text default '')
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.money_requests;
begin
  if not public.has_role(me, 'gm_cfo') then raise exception 'Only the GM/CFO reconciles'; end if;
  select * into r from public.money_requests where id = _id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'retired' then raise exception 'Only retired requests can be reconciled'; end if;
  if r.requester_id = me then raise exception 'You cannot reconcile your own request'; end if;
  if _decision = 'query' then
    if length(trim(coalesce(_comment, ''))) = 0 then raise exception 'Say what is wrong with the receipts'; end if;
    update public.money_requests set status = 'paid', retired_at = null, stage_at = now() where id = _id;
    delete from public.retirements where request_id = _id;
    insert into public.approval_steps (request_id, step, actor_id, decision, comment) values (_id, 'reconcile', me, 'queried', _comment);
    perform public.notify(r.requester_id, 'Receipts queried · ' || r.number, _comment, '/app?tab=requests', 'money');
  else
    update public.money_requests set status = 'reconciled', reconciled_at = now(), reconciled_by = me, stage_at = now() where id = _id;
    insert into public.approval_steps (request_id, step, actor_id, decision, comment) values (_id, 'reconcile', me, 'reconciled', coalesce(_comment, ''));
  end if;
end;
$$;

-- ---------------------------------------------------------------- payroll workflow
-- Finance prepares (or re-prepares a returned run) from active salary profiles and statutory_rates.
create or replace function public.prepare_payroll_run(_period text, _pay_day date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  _rates jsonb := coalesce(public.fin_setting('statutory_rates'), '{}');
  run public.payroll_runs; p public.salary_profiles;
  v_gross numeric; v_nssf numeric; v_taxable numeric; v_paye numeric; v_net numeric;
begin
  if not public.has_role(me, 'finance') then raise exception 'Only Finance prepares payroll'; end if;
  select * into run from public.payroll_runs where period = _period and division_id = 'basil-media' for update;
  if found and run.status not in ('prepared', 'returned') then raise exception 'Payroll for % is already %', _period, run.status; end if;
  if not found then
    insert into public.payroll_runs (period, pay_day) values (_period, _pay_day) returning * into run;
  end if;
  delete from public.payslips where run_id = run.id;
  for p in select * from public.salary_profiles where active loop
    v_gross := p.basic + p.allowances;
    v_nssf := round(v_gross * coalesce((_rates ->> 'nssf_employee')::numeric, 0) / 100);
    v_taxable := v_gross - v_nssf;
    v_paye := public.paye_for(v_taxable, _rates -> 'paye_bands');
    v_net := v_gross - v_nssf - v_paye - p.deductions;
    insert into public.payslips (run_id, user_id, full_name, title, basic, allowances, gross, nssf, taxable, paye, other_deductions, net, nssf_employer, wcf, sdl)
    values (run.id, p.user_id, p.full_name, p.title, p.basic, p.allowances, v_gross, v_nssf, v_taxable, v_paye, p.deductions, v_net,
      round(v_gross * coalesce((_rates ->> 'nssf_employer')::numeric, 0) / 100), round(v_gross * coalesce((_rates ->> 'wcf')::numeric, 0) / 100), round(v_gross * coalesce((_rates ->> 'sdl')::numeric, 0) / 100));
  end loop;
  update public.payroll_runs pr set status = 'prepared', pay_day = _pay_day, rates = _rates, prepared_by = me, prepared_at = now(),
    reviewed_by = null, reviewed_at = null, approved_by = null, approved_at = null,
    headcount = s.n, gross = s.gross, paye = s.paye, nssf_employee = s.nssf, nssf_employer = s.nssf_er, wcf = s.wcf, sdl = s.sdl, other_deductions = s.other, net = s.net
  from (select count(*) n, coalesce(sum(ps.gross), 0) gross, coalesce(sum(ps.paye), 0) paye, coalesce(sum(ps.nssf), 0) nssf, coalesce(sum(ps.nssf_employer), 0) nssf_er,
          coalesce(sum(ps.wcf), 0) wcf, coalesce(sum(ps.sdl), 0) sdl, coalesce(sum(ps.other_deductions), 0) other, coalesce(sum(ps.net), 0) net
        from public.payslips ps where ps.run_id = run.id) s
  where pr.id = run.id;
  perform public.notify_role('gm_cfo', 'Payroll ' || _period || ' ready for review', '', '/app?tab=more', 'money');
  return run.id;
end;
$$;

create or replace function public.review_payroll_run(_id uuid, _decision text, _comment text default '')
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); run public.payroll_runs;
begin
  if not public.has_role(me, 'gm_cfo') then raise exception 'Only the GM/CFO reviews payroll'; end if;
  select * into run from public.payroll_runs where id = _id for update;
  if run.status <> 'prepared' then raise exception 'Payroll is not waiting for review'; end if;
  if run.prepared_by = me then raise exception 'The preparer cannot also review'; end if;
  if _decision = 'return' then
    update public.payroll_runs set status = 'returned', comment = _comment where id = _id;
    perform public.notify_role('finance', 'Payroll ' || run.period || ' returned', _comment, '', 'money');
  else
    update public.payroll_runs set status = 'reviewed', reviewed_by = me, reviewed_at = now(), comment = coalesce(_comment, '') where id = _id;
    perform public.notify_role('boss', 'Payroll ' || run.period || ' needs approval', 'TSH ' || to_char(run.net, 'FM999,999,999,990') || ' net', '/app?tab=approvals', 'approval');
  end if;
end;
$$;

create or replace function public.approve_payroll_run(_id uuid, _decision text, _comment text default '', _verified_by text default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); run public.payroll_runs;
begin
  if not public.has_role(me, 'boss') then raise exception 'Only the Boss approves payroll'; end if;
  select * into run from public.payroll_runs where id = _id for update;
  if run.status <> 'reviewed' then raise exception 'Payroll is not waiting for approval'; end if;
  if me in (run.prepared_by, run.reviewed_by) then raise exception 'Preparer, reviewer and approver must be different people'; end if;
  if _decision = 'return' then
    update public.payroll_runs set status = 'returned', comment = _comment where id = _id;
    perform public.notify_role('finance', 'Payroll ' || run.period || ' returned by the Boss', _comment, '', 'money');
  else
    if coalesce(_verified_by, '') not in ('pin', 'passkey') then raise exception 'Confirm with your fingerprint or PIN'; end if;
    update public.payroll_runs set status = 'approved', approved_by = me, approved_at = now(), verified_by = _verified_by where id = _id;
    perform public.notify_role('finance', 'Payroll ' || run.period || ' approved · pay now', '', '/app?tab=more', 'money');
  end if;
end;
$$;

create or replace function public.pay_payroll_run(_id uuid, _reference text, _account_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); run public.payroll_runs; s public.payslips;
begin
  if not public.has_role(me, 'finance') then raise exception 'Only Finance pays payroll'; end if;
  select * into run from public.payroll_runs where id = _id for update;
  if run.status <> 'approved' then raise exception 'Payroll must be approved by the Boss first'; end if;
  if run.approved_by = me then raise exception 'The approver cannot also pay'; end if;
  update public.payroll_runs set status = 'paid', paid_by = me, paid_at = now(), paid_reference = _reference where id = _id;
  insert into public.expenses (date, amount, category, account_id, payroll_run_id, payee, description, recorded_by)
  values (current_date, run.gross + run.nssf_employer + run.wcf + run.sdl, 'Salaries', _account_id, run.id, 'Staff payroll', 'Payroll ' || run.period || ' (gross + employer NSSF, WCF, SDL)', me);
  for s in select * from public.payslips where run_id = _id loop
    perform public.notify(s.user_id, 'Your payslip for ' || run.period || ' is ready', 'Net pay TSH ' || to_char(s.net, 'FM999,999,999,990'), '/app?tab=more', 'money');
  end loop;
end;
$$;

-- Only signed-in users may call the workflow functions (each checks roles itself).
revoke execute on function public.submit_money_request(jsonb, uuid) from public, anon;
revoke execute on function public.review_money_request(uuid, text, text) from public, anon;
revoke execute on function public.approve_money_request(uuid, text, numeric, text, text, text) from public, anon;
revoke execute on function public.answer_money_request(uuid, text) from public, anon;
revoke execute on function public.pay_money_request(uuid, text, text, text, uuid) from public, anon;
revoke execute on function public.retire_money_request(uuid, jsonb, numeric, text) from public, anon;
revoke execute on function public.reconcile_money_request(uuid, text, text) from public, anon;
revoke execute on function public.prepare_payroll_run(text, date) from public, anon;
revoke execute on function public.review_payroll_run(uuid, text, text) from public, anon;
revoke execute on function public.approve_payroll_run(uuid, text, text, text) from public, anon;
revoke execute on function public.pay_payroll_run(uuid, text, uuid) from public, anon;
grant execute on function public.submit_money_request(jsonb, uuid), public.review_money_request(uuid, text, text),
  public.approve_money_request(uuid, text, numeric, text, text, text), public.answer_money_request(uuid, text),
  public.pay_money_request(uuid, text, text, text, uuid), public.retire_money_request(uuid, jsonb, numeric, text),
  public.reconcile_money_request(uuid, text, text), public.prepare_payroll_run(text, date), public.review_payroll_run(uuid, text, text),
  public.approve_payroll_run(uuid, text, text, text), public.pay_payroll_run(uuid, text, uuid) to authenticated;

-- ===================== 0007_store_ops.sql =====================
-- Basil Media OS · 0007 media store & office operations
-- Gear register, check-out/in, kits, reservations, maintenance, incidents, consumables, stock-take,
-- outside rentals, reception (visitors, parcels, meeting rooms) and transport (vehicles, trips, fuel).
-- Runs after 0005 (projects, clients).

-- ---------- helpers ----------
create or replace function public.is_store_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_any_role(auth.uid(), array['storekeeper', 'gm_cfo', 'boss']::public.app_role[]);
$$;
-- public.is_staff(_user default auth.uid()) is defined once in 0005_projects.sql.
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

-- ===================== 0008_growth.sql =====================
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

-- ===================== 0010_site_hero_images.sql =====================
-- Basil Media OS · 0010 rotating hero photos (team, office, studio — uploaded in the CMS) and office hours.
alter table public.site_settings add column if not exists hero_images text[] not null default '{}';
alter table public.site_settings add column if not exists office_hours text not null default '';

update public.site_settings
set office_hours = 'Mon–Fri 08:30–17:30 · Sat 09:00–13:00'
where id = 'site' and office_hours = '';

-- Short "who we are" block on the home page, and the real office address.
alter table public.site_settings add column if not exists home_about_title text not null default '';
alter table public.site_settings add column if not exists home_about_text text not null default '';
update public.site_settings set
  home_about_title = case when home_about_title = '' then 'Pioneering health, innovation and youth empowerment — one story at a time.' else home_about_title end,
  home_about_text = case when home_about_text = '' then 'Basil Media is a Dar es Salaam studio telling the stories that move Tanzania forward: the clinicians, innovators and young people shaping what comes next.' else home_about_text end,
  address = '2 Mataka Street, Upanga, Dar es Salaam, Tanzania'
where id = 'site';

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

create table public.portal_grants (
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
create index on public.portal_grants (user_id);
create index on public.portal_grants (project_id);

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
create policy "see own or manage grants" on public.portal_grants for select to authenticated
  using (user_id = auth.uid() or public.can_grant_portals());
create policy "leaders add grants" on public.portal_grants for insert to authenticated
  with check (public.can_grant_portals() and granted_by = auth.uid());
create policy "leaders change grants" on public.portal_grants for update to authenticated
  using (public.can_grant_portals()) with check (public.can_grant_portals());
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
create table public.proformas (
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
create index proformas_quotation_idx on public.proformas (quotation_id);
create index proformas_client_idx on public.proformas (client_id);

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
create trigger number_proformas before insert on public.proformas for each row execute function public.number_proforma();

-- ---------------------------------------------------------------- RLS (mirrors quotations)
alter table public.proformas enable row level security;
create policy "sales roles read proformas" on public.proformas for select to authenticated
  using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance', 'account_manager', 'growth']::public.app_role[]));
create policy "sales roles write proformas" on public.proformas for all to authenticated
  using (public.has_any_role(auth.uid(), array['gm_cfo', 'finance', 'account_manager']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['gm_cfo', 'finance', 'account_manager']::public.app_role[]));

-- The GM/CFO owns all money documents, so they may also record a client payment against an invoice
-- (0006 allowed Finance only). The receipt number, income posting and status still come from the 0006 triggers.
create policy "gm records payments" on public.invoice_payments for insert to authenticated
  with check (public.has_role(auth.uid(), 'gm_cfo'));

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
create policy "see shoots" on public.shoots for select to authenticated
  using (public.can_see_project(project_id) or public.is_on_shoot(id));
drop policy if exists "crew update shoots" on public.shoots;
create policy "crew update shoots" on public.shoots for update to authenticated
  using (public.is_on_shoot(id));

drop policy if exists "see shoot crew" on public.shoot_crew;
create policy "see shoot crew" on public.shoot_crew for select to authenticated
  using (user_id = auth.uid() or public.can_see_project(public.shoot_project(shoot_id)));
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
create policy "public reads sources" on public.news_sources for select using (enabled or public.is_cms_editor());
drop policy if exists "editors manage sources" on public.news_sources;
create policy "editors manage sources" on public.news_sources for all to authenticated using (public.is_cms_editor()) with check (public.is_cms_editor());
drop policy if exists "public reads feed" on public.health_feed_items;
create policy "public reads feed" on public.health_feed_items for select using (not hidden or public.is_cms_editor());
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
-- also matches the longer names given in 0029 (e.g. 'SATA · Society…'), so re-running never adds copies
where not exists (select 1 from public.partners p where lower(p.name) = lower(v.name) or lower(p.name) like lower(v.name) || ' %');

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

-- ===================== 0033_pixieset_galleries.sql =====================
-- Basil Media OS · 0033 photography work: Basil Media's Pixieset galleries (cards open the full gallery).
insert into public.projects_public (title, client, category, image_url, description, external_url, featured, sort_order, published)
select v.title, v.client, 'Photo Stories', v.cover, 'Photo collection by Basil Media.', v.url, v.feat, v.ord, true from (values
  ('13th Tanzania Health Summit 2026', 'Tanzania Health Summit', '', 'https://basilmedia.pixieset.com/13thtanzaniahealthsummit2026/', true, -60),
  ('CRDB Bank Marathon 2026', 'CRDB Bank Foundation', 'https://images.pixieset.com/169195021/4729466e9fb22ff08a189993bc5da085-cover.JPG', 'https://basilmedia.pixieset.com/crdbbankmarathon2026-1/', true, -59),
  ('MUHAS — MD 2026', 'MUHAS', '', 'https://basilmedia.pixieset.com/muhasmd2026/', false, -58),
  ('Vijana Uchumi Challenge — Grand Finale', 'Vijana Uchumi Challenge', '', 'https://basilmedia.pixieset.com/vijanauchumichallange/', false, -57),
  ('Smartelite Career Fair 2026', 'Smartelite', '', 'https://basilmedia.pixieset.com/smartelitecareerfair2026/', false, -56),
  ('Ampola doctors', 'Ampola Regency Hospital', '', 'https://basilcreativemedia.pixieset.com/ampoladoctors/', false, -55)
) as v(title, client, cover, url, feat, ord)
where not exists (select 1 from public.projects_public p where p.external_url = v.url);

-- ===================== 0034_publish_gallery.sql =====================
-- Basil Media OS · 0034 any staff member can publish a finished Pixieset gallery as photography work.
-- It goes to the top of Our Work, is marked New for 7 days, and the team is notified.
create or replace function public.publish_gallery(_title text, _client text, _url text, _cover text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare gid uuid; who text;
begin
  if not public.is_staff() then raise exception 'Only Basil Media staff can publish galleries'; end if;
  if coalesce(trim(_title), '') = '' then raise exception 'Add the gallery title'; end if;
  if _url !~* '^https://[a-z0-9-]+\.pixieset\.com/[a-z0-9_-]+/?' then raise exception 'Paste the Pixieset gallery link (https://….pixieset.com/…)'; end if;
  if exists (select 1 from public.projects_public where external_url = _url) then raise exception 'This gallery is already on the website'; end if;
  insert into public.projects_public (title, client, category, image_url, description, external_url, featured, sort_order, published)
  values (trim(_title), coalesce(trim(_client), ''), 'Photo Stories', coalesce(_cover, ''), 'Photo collection by Basil Media.', _url, true,
          -extract(epoch from now())::int, true)
  returning id into gid;
  select coalesce(nullif(full_name, ''), 'A team member') into who from public.profiles where id = auth.uid();
  perform public.notify(r.user_id, 'New gallery published', coalesce(who, 'A team member') || ' · ' || trim(_title), _url, 'info')
    from (select distinct user_id from public.user_roles where role <> 'client' and user_id <> auth.uid()) r;
  return gid;
end;
$$;
revoke execute on function public.publish_gallery(text, text, text, text) from anon;

-- ===================== 0035_last_partner_logos.sql =====================
-- Basil Media OS · 0035 CareHealth, NEDC and SATA logos (supplied by Basil Media).
update public.partners set logo_url = '/img/partners/carehealth.png' where name ilike 'CareHealth%' and coalesce(logo_url, '') = '';
update public.partners set logo_url = '/img/partners/nedc.png' where name ilike 'NEDC%' and coalesce(logo_url, '') = '';
update public.partners set logo_url = '/img/partners/sata.png' where name ilike 'SATA%' and coalesce(logo_url, '') = '';

-- ===================== 0036_partner_duplicates.sql =====================
-- Remove duplicate partners (same name): keep the oldest row of each name.
delete from public.partners p
using public.partners q
where lower(p.name) = lower(q.name)
  and (p.created_at, p.id::text) > (q.created_at, q.id::text);

-- ===================== 0037_team_socials.sql =====================
-- Basil Media OS · 0011 Instagram and LinkedIn links on team profiles (About page).
alter table public.team add column if not exists instagram_url text not null default '';
alter table public.team add column if not exists linkedin_url text not null default '';

-- ===================== 0038_face_search.sql =====================
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

-- ===================== 0039_audience.sql =====================
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

-- ===================== 0040_security_esign.sql =====================
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

-- ===================== 0041_pgcrypto_search_path.sql =====================
-- Basil Media OS · 0015 make gallery PIN functions find pgcrypto (Supabase keeps it in the "extensions" schema).
alter function public.stash_gallery_pin() set search_path = public, extensions;
alter function public.gallery_media(text, text) set search_path = public, extensions;

-- ===================== 0042_news_desks.sql =====================
-- Basil Media OS · 0016 news desks (Health, Youth & Opportunities, Innovation, Capital & Business, Banking for Youth)
-- and more opportunity types for young people.
alter table public.opportunities drop constraint if exists opportunities_kind_check;
alter table public.opportunities add constraint opportunities_kind_check
  check (kind in ('Job', 'Internship', 'Fellowship', 'Scholarship', 'Grant', 'Funding', 'Competition', 'Training', 'Call for abstracts'));

-- ===================== 0043_news_desks_feed.sql =====================
-- Basil Media OS · 0043 the live news feed for every desk, using the same principle as health news:
-- verified newsrooms only, real photos only, a link to the original, and automatic expiry.
-- Desks: health · youth (opportunities) · innovation · business (capital & business) · banking (banking for youth).
alter table public.news_sources add column if not exists desk text not null default 'health';
alter table public.news_sources add column if not exists keywords text not null default '';
alter table public.health_feed_items add column if not exists desk text not null default 'health';
create index if not exists health_feed_items_desk on public.health_feed_items (desk, published_at desc);

do $$ begin
  alter table public.news_sources add constraint news_sources_desk_check check (desk in ('health', 'youth', 'innovation', 'business', 'banking'));
exception when duplicate_object then null; end $$;

insert into public.news_sources (name, url, format, zone, health_only, desk, keywords) values
  ('Opportunities for Africans', 'https://www.opportunitiesforafricans.com/feed/', 'rss', 'africa', false, 'youth', ''),
  ('Opportunity Desk', 'https://opportunitydesk.org/feed/', 'rss', 'world', false, 'youth', 'africa|african|tanzania|youth|young|student|graduate|fellowship|scholarship|grant|internship'),
  ('TechCabal', 'https://techcabal.com/feed/', 'rss', 'africa', false, 'innovation', ''),
  ('TechMoran', 'https://techmoran.com/feed/', 'rss', 'africa', false, 'innovation', ''),
  ('WeeTracker', 'https://weetracker.com/feed/', 'rss', 'africa', false, 'innovation', ''),
  ('Daily News · Business', 'https://dailynews.co.tz/feed/', 'rss', 'tanzania', false, 'business', 'business|economy|economic|invest|trade|export|import|market|bank|tax|revenue|budget|shilling|\mtzs\M|company|companies|industr|agricultur|mining|tourism|\msme|entrepreneur|startup'),
  ('HabariLeo · Biashara', 'https://habarileo.co.tz/category/biashara/feed/', 'rss', 'tanzania', false, 'business', ''),
  ('TanzaniaInvest', 'https://www.tanzaniainvest.com/feed', 'rss', 'tanzania', false, 'business', ''),
  ('TanzaniaInvest · Finance', 'https://www.tanzaniainvest.com/finance/feed', 'rss', 'tanzania', false, 'banking', 'bank|banking|loan|credit|mobile money|m-pesa|tigo pesa|airtel money|stock exchange|\mdse\M|bond|sacco|microfinance|sme|youth|account|interest rate|fintech|bot\M|bank of tanzania'),
  ('TechCabal · Fintech', 'https://techcabal.com/category/fintech/feed/', 'rss', 'africa', false, 'banking', 'bank|banking|loan|credit|mobile money|m-pesa|savings|account|youth|young')
on conflict (url) do update set desk = excluded.desk, keywords = excluded.keywords, enabled = true;

-- Expiry per desk: health after 72 hours; business, innovation and banking after 7 days; opportunities after 14 days.
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'basil-news-expire';
  perform cron.schedule('basil-news-expire', '17 * * * *', $job$
    delete from public.health_feed_items where
      (desk = 'health' and published_at < now() - interval '72 hours')
      or (desk in ('business', 'innovation', 'banking') and published_at < now() - interval '7 days')
      or (desk = 'youth' and published_at < now() - interval '14 days')
  $job$);
exception when others then
  raise notice 'Expiry schedule not updated (%).', sqlerrm;
end $$;

-- "New photos" pop-up for freshly published galleries: off until switched on in CMS → Site settings.
alter table public.site_settings add column if not exists gallery_popup boolean not null default false;

-- ===================== 0044_webp_images.sql =====================
-- Basil Media OS · 0044 every site image as WebP (about half the size). Rewrites stored paths from .jpg/.png
-- to the .webp files that sit beside them. The originals remain only for social-media link previews.
update public.site_settings set
  hero_images = array(select regexp_replace(x, '\.(jpe?g|png)$', '.webp', 'i') from unnest(hero_images) as x),
  about_image_url = regexp_replace(about_image_url, '^(/(img|media)/.*)\.(jpe?g|png)$', '\1.webp', 'i'),
  hero_image_url = regexp_replace(hero_image_url, '^(/(img|media)/.*)\.(jpe?g|png)$', '\1.webp', 'i');
update public.partners set logo_url = regexp_replace(logo_url, '^(/img/.*)\.(jpe?g|png)$', '\1.webp', 'i') where logo_url ~* '^/img/.*\.(jpe?g|png)$';
update public.services set image_url = regexp_replace(image_url, '^(/img/.*)\.(jpe?g|png)$', '\1.webp', 'i') where image_url ~* '^/img/.*\.(jpe?g|png)$';
update public.team set photo_url = regexp_replace(photo_url, '^(/img/.*)\.(jpe?g|png)$', '\1.webp', 'i') where photo_url ~* '^/img/.*\.(jpe?g|png)$';
update public.projects_public set image_url = regexp_replace(image_url, '(/media/work/work-\d+-poster)\.jpg$', '\1.webp') where image_url ~ '/media/work/work-\d+-poster\.jpg$';

-- ===================== 0045_partners_crdb_bank_aga_khan.sql =====================
-- Basil Media OS · 0045 partners: CRDB Bank beside the CRDB Bank Foundation, the Aga Khan Hospital (Dar es Salaam)
-- logo without the Arabic line, and one SATA card instead of four duplicates.
insert into public.partners (division_id, name, logo_url, website, sort_order)
select 'basil-media', 'CRDB Bank', '/img/partners/crdb-bank.svg', 'https://crdbbank.co.tz', 0
where not exists (select 1 from public.partners where lower(name) = 'crdb bank');
update public.partners set name = 'The Aga Khan Hospital, Dar es Salaam', logo_url = '/img/partners/aga-khan-hospital-dar.svg'
 where name ilike 'aga khan hospital%' or logo_url like '%aga-khan-hospital.svg';
delete from public.partners p using public.partners q
 where p.name ilike 'SATA%' and q.name = p.name and q.created_at < p.created_at;

