-- Basil Media OS · 0022 current work from Instagram (@basilmedia_tz) on the homepage "work at a glance".
-- Covers are our own photos until a cover is uploaded in Website CMS → Highlights (Instagram does not
-- allow its thumbnails to be downloaded). The empty sample reels from 0018 are removed.
delete from public.highlights where id::text like 'b5a5e000-%';
insert into public.highlights (title, video_url, thumbnail_url, sort_order, published, orientation)
select v.title, v.url, v.cover, v.ord, true, 'portrait' from (values
  ('CEO Forum · highlights', 'https://www.instagram.com/reel/Ddb4tAJozCz/', '/img/team/basil-media-team.jpg', 1),
  ('CRDB Bank Marathon · video coverage', 'https://www.instagram.com/reel/DcJyeE6xOhp/', '/img/services/event-coverage-team.jpg', 2),
  ('In the edit suite · the team at work', 'https://www.instagram.com/reel/DeHpkoWo32X/', '/img/services/editing-studio.jpg', 3),
  ('Basil Media · latest reel', 'https://www.instagram.com/reel/DavwqtPRGqU/', '/img/team/crew-on-set.jpg', 4),
  ('Basil Media · on location', 'https://www.instagram.com/reel/De3V9GHIK1m/', '/img/services/video-crew-conference.jpg', 5),
  ('Basil Media · behind the camera', 'https://www.instagram.com/reel/DeujlQ2xqsY/', '/img/services/photographer-event.jpg', 6),
  ('Basil Media · health story', 'https://www.instagram.com/reel/DePq1PqRqCE/', '/img/services/event-coverage-team.jpg', 7)
) as v(title, url, cover, ord)
where not exists (select 1 from public.highlights h where h.video_url = v.url);
