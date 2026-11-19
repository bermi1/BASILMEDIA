-- Basil Media OS · 0048 new hero reel ("Basil Media Presents", Nov 2026), letterbox bars trimmed.
update public.site_settings set hero_video_url = '/media/hero/basil-reel-2026.mp4'
 where coalesce(hero_video_url, '') in ('', '/media/hero/basil-hero-reel.mp4', '/media/hero/basil-hero-reel-portrait.mp4');
