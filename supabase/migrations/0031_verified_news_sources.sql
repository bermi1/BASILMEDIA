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
