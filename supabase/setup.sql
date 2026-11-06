-- Basil Media OS · complete database setup (generated from 11 migrations).
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
returns trigger language plpgsql security definer set search_path = public as $$
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
returns setof public.media_items language plpgsql stable security definer set search_path = public as $$
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

insert into public.site_settings (id, tagline, tagline_highlight, hero_kicker, hero_subtitle, hero_image_url, hero_video_url, logo_url, logo_reverse_url, about_story, about_image_url, mission, vision, company_profile_url, contact_email, phone, whatsapp, address, map_embed_url, footer_about, socials, stats, live_ticker, services_mega_image_url) values
  ('site', 'We Don''t Just Capture Moments —', 'We Create Them.', 'VIDEO · PHOTOGRAPHY · PODCAST · LIVE STREAMING — DAR ES SALAAM', 'Films, photos, podcasts and live streams from Dar es Salaam.', '', '', '/logo.svg', '/logo-reverse.svg', 'Basil Media is a youth-driven digital media platform dedicated to health education, innovation, and impactful storytelling. We exist to inform, inspire, and empower young people with reliable health information, creative ideas, and forward-thinking solutions that shape a healthier future.

Through engaging content, expert conversations, and real-life stories, Basil Media bridges the gap between medical knowledge, innovation, and the everyday lives of young people. Our focus spans health awareness, mental well-being, medical education, technology, entrepreneurship, and youth-led innovation.

We collaborate with healthcare professionals, institutions, innovators, and young change-makers to deliver content that is educational, relatable, and transformative.

At Basil Media, we believe the youth are not just the leaders of tomorrow—but the innovators of today. Learn. Innovate. Inspire.', '/media/basil-media-studio-btv.webp', 'To tell the stories of Tanzanian institutions and people with honesty, craft and care, and to deliver every frame on time.', 'To be East Africa’s most trusted media house: the studio institutions call when the moment matters.', '', 'hello@basilmedia.co.tz', '+255 700 000 000', '+255700000000', '2 Mataka Street, Upanga, Dar es Salaam, Tanzania', '', 'Video, photography, podcasts and live streaming from Dar es Salaam — delivered through our own studio platform.', '{"instagram":"https://instagram.com/","youtube":"https://www.youtube.com/@basilmediatz","facebook":"https://facebook.com/","linkedin":"https://linkedin.com/","tiktok":"https://tiktok.com/","x":"https://x.com/"}'::jsonb, '[{"value":250,"suffix":"+","label":"projects delivered"},{"value":60,"suffix":"+","label":"clients"},{"value":6,"label":"years"},{"value":4,"label":"awards"}]'::jsonb, 'Gallery delivered · Tanzania Health Summit · 2,431 photos', '');

insert into public.services (title, slug, short, description, deliverables, icon, image_url, video_url, sort_order, published) values
  ('Video Production', 'video-production', 'Films, documentaries and campaign spots.', 'Documentaries, corporate films and campaign spots, from script and casting to colour grade and subtitles in English and Kiswahili.', array['Script & storyboard', 'Shoot crew', 'Edit & colour', 'Subtitles EN / SW']::text[], 'video', '', '', 1, true),
  ('Photography', 'photography', 'Events, portraits and private client galleries.', 'Events, portraits and product photography delivered in private galleries with selfie Find Me, favourites and HD downloads.', array['Event coverage', 'Private gallery', 'Find Me by selfie', 'QR poster']::text[], 'camera', '', '', 2, true),
  ('Podcast Production', 'podcast-production', 'Studio and remote series, video and audio.', 'Video and audio podcasts, recorded in studio or on location, edited and published to every platform.', array['Studio recording', 'Multi-camera', 'Clips for social', 'Publishing']::text[], 'mic', '', '', 3, true),
  ('Live Streaming', 'live-streaming', 'Multi-camera summits, launches, graduations.', 'Multi-camera live streams for summits, launches and graduations, with graphics and a highlights film after.', array['Multi-camera switch', 'Lower thirds', 'Stream to any platform', 'Highlights film']::text[], 'radio', '', '', 4, true),
  ('Brand Storytelling', 'brand-storytelling', 'The story behind your organisation, told well.', 'The people and purpose behind your organisation, told in film, photo and words.', array['Story workshop', 'Interviews', 'Hero film', 'Photo essay']::text[], 'sparkles', '', '', 5, true),
  ('Corporate Content', 'corporate-content', 'Monthly content for social, web and internal use.', 'A monthly retainer: a year calendar of shoots and posts, approvals in your portal, and a report every month.', array['Year calendar', 'Monthly allowance', 'Post approvals', 'Monthly report']::text[], 'briefcase', '', '', 6, true);

insert into public.projects_public (title, category, client, image_url, video_url, external_url, description, featured, sort_order, published) values
  ('SNOSSA 2026 — opening ceremony highlights', 'Corporate', '', 'https://vodhxhbjncvhogdgkmfy.supabase.co/storage/v1/object/public/media/work/work-1-poster.jpg', 'https://vodhxhbjncvhogdgkmfy.supabase.co/storage/v1/object/public/media/work/work-1.mp4', '', '', true, 1, true),
  ('Inspirenyua × CRDB Bank — Smatisha Biashara activation', 'Corporate', '', 'https://vodhxhbjncvhogdgkmfy.supabase.co/storage/v1/object/public/media/work/work-2-poster.jpg', 'https://vodhxhbjncvhogdgkmfy.supabase.co/storage/v1/object/public/media/work/work-2.mp4', '', '', true, 2, true),
  ('On location — arriving at the venue', 'Corporate', '', 'https://vodhxhbjncvhogdgkmfy.supabase.co/storage/v1/object/public/media/work/work-3-poster.jpg', 'https://vodhxhbjncvhogdgkmfy.supabase.co/storage/v1/object/public/media/work/work-3.mp4', '', '', true, 3, true),
  ('Presenter intro — Inspirenyua', 'Corporate', '', 'https://vodhxhbjncvhogdgkmfy.supabase.co/storage/v1/object/public/media/work/work-4-poster.jpg', 'https://vodhxhbjncvhogdgkmfy.supabase.co/storage/v1/object/public/media/work/work-4.mp4', '', '', false, 4, true),
  ('Health Summit — voices on health sovereignty', 'Corporate', '', 'https://vodhxhbjncvhogdgkmfy.supabase.co/storage/v1/object/public/media/work/work-5-poster.jpg', 'https://vodhxhbjncvhogdgkmfy.supabase.co/storage/v1/object/public/media/work/work-5.mp4', '', '', true, 5, true),
  ('89th annual meeting — conference coverage', 'Corporate', '', 'https://vodhxhbjncvhogdgkmfy.supabase.co/storage/v1/object/public/media/work/work-6-poster.jpg', 'https://vodhxhbjncvhogdgkmfy.supabase.co/storage/v1/object/public/media/work/work-6.mp4', '', '', false, 6, true);

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

-- ===================== 0011_team_socials.sql =====================
-- Basil Media OS · 0011 Instagram and LinkedIn links on team profiles (About page).
alter table public.team add column if not exists instagram_url text not null default '';
alter table public.team add column if not exists linkedin_url text not null default '';

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

