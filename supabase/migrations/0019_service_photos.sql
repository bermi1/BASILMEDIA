-- Basil Media OS · 0019 team photos on the services (only where no picture has been set yet).
update public.services s set image_url = v.img
from (values
  ('video-production', '/img/services/video-crew-conference.jpg'),
  ('photography', '/img/services/photographer-event.jpg'),
  ('brand-storytelling', '/img/services/photographer-event.jpg'),
  ('podcast-production', '/img/services/editing-studio.jpg'),
  ('live-streaming', '/img/services/video-crew-conference.jpg'),
  ('event-coverage', '/img/services/event-coverage-team.jpg'),
  ('corporate-content', '/img/services/editing-studio.jpg'),
  ('health-communication', '/img/services/event-coverage-team.jpg')
) as v(slug, img)
where s.slug = v.slug and coalesce(s.image_url, '') = '';
