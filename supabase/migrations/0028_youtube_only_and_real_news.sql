-- Basil Media OS · 0028 no Instagram, no invented news.
-- Instagram reels are deleted (work videos are YouTube only).
delete from public.highlights where video_url like '%instagram.com%';
update public.projects_public set video_url = '' where video_url like '%instagram.com%';
-- The six starter stories were sample text, not real news: hide them (editable in Website CMS → Health news).
update public.news_stories set published = false where title in (
  'New national guidelines on antibiotic stewardship for referral hospitals',
  'Registration renewals: council deadline moves to 31 December',
  'Local study: shorter TB regimens hold up in Tanzanian clinics',
  'Paediatric oncology unit opens second ward',
  'Nurses’ conference calls for abstracts on community care',
  'Drug alert: recall of one batch of an oral antibiotic');
