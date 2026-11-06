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
