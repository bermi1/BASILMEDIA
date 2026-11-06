-- Basil Media OS · run this once in Supabase → SQL Editor (your live database already has everything up to 0042).
-- Adds: news desks for the live feed (youth, innovation, business, banking) and the pop-up switch.
begin;
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
  ('Disrupt Africa', 'https://disruptafrica.com/feed/', 'rss', 'africa', false, 'innovation', ''),
  ('WeeTracker', 'https://weetracker.com/feed/', 'rss', 'africa', false, 'innovation', ''),
  ('Daily News · Business', 'https://dailynews.co.tz/category/business/feed/', 'rss', 'tanzania', false, 'business', ''),
  ('HabariLeo · Biashara', 'https://habarileo.co.tz/category/biashara/feed/', 'rss', 'tanzania', false, 'business', ''),
  ('TanzaniaInvest', 'https://www.tanzaniainvest.com/feed', 'rss', 'tanzania', false, 'business', ''),
  ('TanzaniaInvest · Finance', 'https://www.tanzaniainvest.com/finance/feed', 'rss', 'tanzania', false, 'banking', 'bank|banking|loan|credit|mobile money|m-pesa|tigo pesa|airtel money|stock exchange|\mdse\M|bond|sacco|microfinance|sme|youth|account|interest rate|fintech|bot\M|bank of tanzania')
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

commit;
