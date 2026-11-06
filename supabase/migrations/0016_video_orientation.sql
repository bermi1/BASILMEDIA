-- Basil Media OS · 0016 video orientation for the homepage "work at a glance" section.
-- 'auto' guesses from the link (Instagram reels / YouTube Shorts = portrait, others = landscape).
alter table public.projects add column if not exists orientation text not null default 'auto' check (orientation in ('auto', 'portrait', 'landscape'));
alter table public.highlights add column if not exists orientation text not null default 'auto' check (orientation in ('auto', 'portrait', 'landscape'));
