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
