-- Basil Media OS · 0023 homepage hero video and the team photo as the About picture.
-- Hero: 47 s of Basil Media's own footage (public/media/hero/basil-hero-reel*.mp4 — wide for desktop,
-- tall for phones). Only replaces empty/starter values — a video or picture chosen in the CMS is kept.
update public.site_settings set
  hero_video_url = case when coalesce(hero_video_url, '') in ('', '/media/hero/basil-hero.mp4') then '/media/hero/basil-hero-reel.mp4' else hero_video_url end,
  about_image_url = case when coalesce(about_image_url, '') in ('', '/media/basil-media-studio-btv.webp') then '/img/team/basil-media-team.jpg' else about_image_url end
where id = 'site';
