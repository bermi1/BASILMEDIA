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
