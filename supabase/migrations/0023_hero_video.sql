-- Basil Media OS · 0023 homepage hero video and the team photo as the About picture.
-- The hero loop (public/media/hero) is built from Basil Media photos by scripts/make-hero-video.py.
-- Only replaces the starter values — a video or picture chosen in Website CMS → Site settings is kept.
update public.site_settings set
  hero_video_url = case when coalesce(hero_video_url, '') = '' then '/media/hero/basil-hero.mp4' else hero_video_url end,
  about_image_url = case when coalesce(about_image_url, '') in ('', '/media/basil-media-studio-btv.webp') then '/img/team/basil-media-team.jpg' else about_image_url end
where id = 'site';
