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
