-- Basil Media OS · 0020 official logo and team photos (only where nothing has been set yet).
update public.site_settings set
  about_image_url = case when coalesce(about_image_url, '') = '' then '/img/team/basil-media-team.jpg' else about_image_url end,
  hero_images = case when coalesce(array_length(hero_images, 1), 0) = 0 then array[
    '/img/team/basil-media-team.jpg', '/img/team/crew-on-set.jpg', '/img/services/video-crew-conference.jpg',
    '/img/services/event-coverage-team.jpg', '/img/services/photographer-event.jpg'] else hero_images end,
  logo_url = case when coalesce(logo_url, '') in ('', '/logo.svg') then '/logo.svg' else logo_url end,
  logo_reverse_url = case when coalesce(logo_reverse_url, '') in ('', '/logo-reverse.svg') then '/logo-reverse.svg' else logo_reverse_url end
where id = 'site';
