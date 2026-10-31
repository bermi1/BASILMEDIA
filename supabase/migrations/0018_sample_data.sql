-- Basil Media OS · 0018 curated sample data, so every portal opens with realistic work to look at and edit.
-- • Every sample row has an id starting with b5a5e000- — remove them all at once with supabase/remove-sample-data.sql.
-- • Safe to run more than once (on conflict do nothing).
-- • Work is given to the people who already hold each role (Project Lead, Storekeeper, Driver …); if a role has
--   nobody yet, the GM/CFO or Boss is used, and rows that need a person are skipped when there are no accounts.
-- • Dates are relative to the day you run it, so the calendar, overdue invoices and "this week" look current.

create or replace function pg_temp.sid(n int) returns uuid language sql immutable as $$
  select ('b5a5e000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create or replace function pg_temp.who(_role public.app_role) returns uuid language sql stable as $$
  select coalesce(
    (select user_id from public.user_roles where role = _role order by created_at limit 1),
    (select user_id from public.user_roles where role = 'gm_cfo' order by created_at limit 1),
    (select user_id from public.user_roles where role = 'boss' order by created_at limit 1),
    (select user_id from public.user_roles where role = 'super_admin' order by created_at limit 1));
$$;
create or replace function pg_temp.items(variadic x text[]) returns jsonb language sql immutable as $$
  -- items('Title|detail|qty|unit price', …) → [{title, detail, qty, unit_price}]
  select coalesce(jsonb_agg(jsonb_build_object('title', split_part(v, '|', 1), 'detail', split_part(v, '|', 2),
    'qty', split_part(v, '|', 3)::numeric, 'unit_price', split_part(v, '|', 4)::numeric)), '[]') from unnest(x) v;
$$;

-- =========================================================== WEBSITE
-- All services (same as the starter set) — added again only if missing.
insert into public.services (title, slug, short, description, deliverables, icon, image_url, video_url, sort_order, published) values
  ('Video Production', 'video-production', 'Films, documentaries and campaign spots.', 'Documentaries, corporate films and campaign spots, from script and casting to colour grade and subtitles in English and Kiswahili.', array['Script & storyboard', 'Shoot crew', 'Edit & colour', 'Subtitles EN / SW']::text[], 'video', '', '', 1, true),
  ('Photography', 'photography', 'Events, portraits and private client galleries.', 'Events, portraits and product photography delivered in private galleries with selfie Find Me, favourites and HD downloads.', array['Event coverage', 'Private gallery', 'Find Me by selfie', 'QR poster']::text[], 'camera', '', '', 2, true),
  ('Podcast Production', 'podcast-production', 'Studio and remote series, video and audio.', 'Video and audio podcasts, recorded in studio or on location, edited and published to every platform.', array['Studio recording', 'Multi-camera', 'Clips for social', 'Publishing']::text[], 'mic', '', '', 3, true),
  ('Live Streaming', 'live-streaming', 'Conferences and launches, streamed live.', 'Multi-camera live streams for conferences, launches and graduations, with graphics, remote guests and recordings.', array['Multi-camera', 'Lower thirds', 'YouTube / Facebook / Zoom', 'Same-day recording']::text[], 'radio', '', '', 4, true),
  ('Event Coverage', 'event-coverage', 'Photo, video and same-day highlights.', 'Photo and video teams for conferences, launches and ceremonies, with same-day highlight reels for social media.', array['Photo + video team', 'Same-day reel', 'Speaker interviews', 'Gallery in 48 h']::text[], 'calendar', '', '', 5, true),
  ('Corporate Content', 'corporate-content', 'Monthly content for brands and institutions.', 'A monthly retainer of reels, posts, photos and short films for hospitals, banks, NGOs and companies.', array['Monthly content plan', 'Reels & posts', 'Edited photos', 'Monthly report']::text[], 'briefcase', '', '', 6, true),
  ('Health Communication', 'health-communication', 'Health campaigns people understand.', 'Health education films, explainers and campaigns made with clinicians, in English and Kiswahili.', array['Clinical review', 'Explainers', 'Patient stories', 'Campaign assets']::text[], 'heart', '', '', 7, true)
on conflict (slug) do nothing;

insert into public.partners (id, name, logo_url, website, sort_order) values
  (pg_temp.sid(1), 'Muhimbili National Hospital', '', 'https://www.mnh.or.tz', 1),
  (pg_temp.sid(2), 'Medical Association of Tanzania', '', 'https://mat-tz.org', 2),
  (pg_temp.sid(3), 'Muhimbili University (MUHAS)', '', 'https://www.muhas.ac.tz', 3),
  (pg_temp.sid(4), 'Aga Khan Hospital, Dar es Salaam', '', 'https://hospitals.aku.edu/dar-es-salaam', 4),
  (pg_temp.sid(5), 'Benjamin Mkapa Foundation', '', 'https://mkapafoundation.or.tz', 5),
  (pg_temp.sid(6), 'Pharmaceutical Society of Tanzania', '', '', 6)
on conflict (id) do nothing;

insert into public.testimonials (id, company, quote, rating, person_name, sort_order, published) values
  (pg_temp.sid(11), 'Medical Association of Tanzania', 'They streamed our national congress for three days without a single drop, and had highlights on social media the same evening.', 5, 'Head of Communications', 1, true),
  (pg_temp.sid(12), 'Referral hospital, Dar es Salaam', 'Our patient-story series finally made people talk about early screening. The team worked gently with patients and doctors alike.', 5, 'Public Relations Officer', 2, true),
  (pg_temp.sid(13), 'Health NGO, Dodoma', 'Clear plan, honest budget and delivery on the date promised. The Kiswahili subtitles were spot on.', 5, 'Programme Manager', 3, true),
  (pg_temp.sid(14), 'University of Health Sciences', 'Our graduation film is still the most watched video on our channel.', 4, 'Dean of Students', 4, true)
on conflict (id) do nothing;

insert into public.highlights (id, title, video_url, thumbnail_url, sort_order, published, orientation) values
  (pg_temp.sid(21), 'Behind the scenes · Health Summit live stream', '', '', 1, true, 'portrait'),
  (pg_temp.sid(22), 'Sixty seconds with a cardiologist', '', '', 2, true, 'portrait'),
  (pg_temp.sid(23), 'Graduation day highlights', '', '', 3, true, 'landscape')
on conflict (id) do nothing;

-- =========================================================== CLIENTS & CRM
insert into public.clients (id, name, sector, contact_name, phone, email, address, tin) values
  (pg_temp.sid(101), 'Upanga Referral Hospital', 'Health', 'Dr Neema Mushi', '+255 713 220 401', 'communications@upangahospital.co.tz', 'Upanga, Dar es Salaam', '112-334-551'),
  (pg_temp.sid(102), 'Tanzania Health Summit', 'Health', 'Lilian Massawe', '+255 754 118 920', 'info@healthsummit.or.tz', 'JNICC, Dar es Salaam', '113-221-908'),
  (pg_temp.sid(103), 'University of Health Sciences', 'Education', 'Prof. Joseph Mbwambo', '+255 765 440 120', 'pro@uhs.ac.tz', 'Upanga West, Dar es Salaam', '102-118-905'),
  (pg_temp.sid(104), 'Pwani Microfinance Bank', 'Finance', 'Hassan Mwinyi', '+255 688 120 554', 'marketing@pwanimf.co.tz', 'Posta, Dar es Salaam', '104-552-118'),
  (pg_temp.sid(105), 'Kilimanjaro Water Co.', 'Consumer', 'Irene Kweka', '+255 658 220 031', 'brand@kiliwater.co.tz', 'Mikocheni, Dar es Salaam', '105-903-441')
on conflict (id) do nothing;

-- A client login (role "client") with no company yet is linked to the hospital, so the client portal shows a retainer.
insert into public.client_users (user_id, client_id, role)
select r.user_id, pg_temp.sid(101), 'owner' from public.user_roles r
where r.role = 'client' and not exists (select 1 from public.client_users c where c.user_id = r.user_id)
order by r.created_at limit 1;

insert into public.crm_organisations (id, name, type, sector, client_id, city, phone, email, website, notes) values
  (pg_temp.sid(111), 'Upanga Referral Hospital', 'Hospital', 'Health', pg_temp.sid(101), 'Dar es Salaam', '+255 713 220 401', 'communications@upangahospital.co.tz', '', 'Retainer client since this year.'),
  (pg_temp.sid(112), 'Tanzania Health Summit', 'Association', 'Health', pg_temp.sid(102), 'Dar es Salaam', '+255 754 118 920', 'info@healthsummit.or.tz', '', 'Annual summit, live stream every year.'),
  (pg_temp.sid(113), 'Pwani Microfinance Bank', 'Bank', 'Finance', pg_temp.sid(104), 'Dar es Salaam', '+255 688 120 554', 'marketing@pwanimf.co.tz', '', '12 branches, wants monthly content.'),
  (pg_temp.sid(114), 'Mbeya Zonal Hospital', 'Hospital', 'Health', null, 'Mbeya', '+255 25 250 3456', 'info@mbeyazonal.go.tz', '', 'Met at the summit — interested in a patient-safety film.'),
  (pg_temp.sid(115), 'Afya Bora NGO', 'NGO', 'Health', null, 'Dodoma', '+255 715 990 001', 'programs@afyabora.org', '', 'Malaria campaign tender expected.'),
  (pg_temp.sid(116), 'Kilimanjaro Water Co.', 'Corporate', 'Consumer', pg_temp.sid(105), 'Dar es Salaam', '+255 658 220 031', 'brand@kiliwater.co.tz', '', '')
on conflict (id) do nothing;

insert into public.crm_contacts (id, organisation_id, full_name, title, phone, email, is_primary) values
  (pg_temp.sid(121), pg_temp.sid(111), 'Dr Neema Mushi', 'Head of Communications', '+255 713 220 401', 'neema.mushi@upangahospital.co.tz', true),
  (pg_temp.sid(122), pg_temp.sid(112), 'Lilian Massawe', 'Summit Coordinator', '+255 754 118 920', 'lilian@healthsummit.or.tz', true),
  (pg_temp.sid(123), pg_temp.sid(113), 'Hassan Mwinyi', 'Marketing Manager', '+255 688 120 554', 'hassan.mwinyi@pwanimf.co.tz', true),
  (pg_temp.sid(124), pg_temp.sid(114), 'Dr Peter Laizer', 'Quality Improvement Lead', '+255 767 330 210', 'qi@mbeyazonal.go.tz', true),
  (pg_temp.sid(125), pg_temp.sid(115), 'Rose Ndege', 'Programme Manager', '+255 715 990 001', 'rose@afyabora.org', true)
on conflict (id) do nothing;

insert into public.leads (id, title, organisation_id, contact_id, stage, value, probability, next_action, next_action_date, owner_id, source, service, lost_reason, notes) values
  (pg_temp.sid(131), 'Patient-safety film series', pg_temp.sid(114), pg_temp.sid(124), 'Meeting', 18000000, 40, 'Site visit and script outline', current_date + 4, pg_temp.who('account_manager'), 'Event', 'Video Production', '', ''),
  (pg_temp.sid(132), 'Branch content retainer', pg_temp.sid(113), pg_temp.sid(123), 'Proposal Sent', 3600000 * 12, 60, 'Follow up on proposal', current_date + 2, pg_temp.who('account_manager'), 'Website', 'Corporate Content', '', 'Asked for the Growth tier.'),
  (pg_temp.sid(133), 'Malaria campaign 2027', pg_temp.sid(115), pg_temp.sid(125), 'Contacted', 25000000, 25, 'Send company profile', current_date + 1, pg_temp.who('account_manager'), 'Referral', 'Health Communication', '', ''),
  (pg_temp.sid(134), 'Summit 2027 live stream', pg_temp.sid(112), pg_temp.sid(122), 'Negotiation', 24000000, 80, 'Agree the payment schedule', current_date + 3, pg_temp.who('account_manager'), 'Repeat client', 'Live Streaming', '', ''),
  (pg_temp.sid(135), 'Water brand launch film', pg_temp.sid(116), null, 'Won', 9500000, 100, '', null, pg_temp.who('account_manager'), 'Website', 'Video Production', '', ''),
  (pg_temp.sid(136), 'Annual report photos', pg_temp.sid(113), pg_temp.sid(123), 'Lost', 2400000, 0, '', null, pg_temp.who('account_manager'), 'Website', 'Photography', 'Chose an in-house photographer', '')
on conflict (id) do nothing;

-- Proposals log (written outside the app; here only who, what, how much and where it stands)
insert into public.proposals (id, number, title, client_name, organisation_id, lead_id, status, stage, amount, note, sent_at, stage_at) values
  (pg_temp.sid(141), 'BM-PRP-SAMPLE-1', 'Branch content retainer — Growth tier', 'Pwani Microfinance Bank', pg_temp.sid(113), pg_temp.sid(132), 'sent', 'Working on it', 43200000, 'Marketing manager reviewing with finance.', now() - interval '6 days', now() - interval '2 days'),
  (pg_temp.sid(142), 'BM-PRP-SAMPLE-2', 'Summit 2027 live stream and highlights', 'Tanzania Health Summit', pg_temp.sid(112), pg_temp.sid(134), 'sent', 'Interested', 24000000, 'Wants a 40/60 payment split.', now() - interval '12 days', now() - interval '1 day'),
  (pg_temp.sid(143), 'BM-PRP-SAMPLE-3', 'Patient-safety film series (3 films)', 'Mbeya Zonal Hospital', pg_temp.sid(114), pg_temp.sid(131), 'sent', 'Sent', 18000000, '', now() - interval '1 day', now() - interval '1 day'),
  (pg_temp.sid(144), 'BM-PRP-SAMPLE-4', 'Water brand launch film', 'Kilimanjaro Water Co.', pg_temp.sid(116), pg_temp.sid(135), 'accepted', 'Won', 9500000, 'Signed — production starts next week.', now() - interval '25 days', now() - interval '9 days')
on conflict (id) do nothing;

insert into public.contracts (id, number, title, kind, organisation_id, client_id, lead_id, value, start_date, end_date, status, instalments, renewal_notice_days) values
  (pg_temp.sid(151), 'BM-CON-SAMPLE-1', 'Monthly content retainer', 'Retainer', pg_temp.sid(111), pg_temp.sid(101), null, 3600000 * 12, date_trunc('year', current_date)::date, (date_trunc('year', current_date) + interval '1 year - 1 day')::date, 'active',
    jsonb_build_array(jsonb_build_object('label', 'Monthly fee', 'pct', 100, 'due_date', null, 'paid', false)), 60),
  (pg_temp.sid(152), 'BM-CON-SAMPLE-2', 'Water brand launch film', 'Contract', pg_temp.sid(116), pg_temp.sid(105), pg_temp.sid(135), 9500000, current_date - 9, current_date + 40, 'active',
    jsonb_build_array(jsonb_build_object('label', 'Deposit', 'pct', 50, 'due_date', current_date - 5, 'paid', true), jsonb_build_object('label', 'On delivery', 'pct', 50, 'due_date', current_date + 40, 'paid', false)), 30)
on conflict (id) do nothing;

insert into public.tenders (id, title, issuer, reference, closes_on, value_estimate, status, owner_id, documents_needed, notes) values
  (pg_temp.sid(161), 'Health education videos for primary schools', 'Ministry of Health', 'MoH/HPE/2026/14', current_date + 18, 60000000, 'Preparing', pg_temp.who('account_manager'), 'Company profile, TIN, BRELA, 3 references, technical proposal', ''),
  (pg_temp.sid(162), 'Documentation of the TB programme', 'National TB Programme', 'NTLP/COM/2026/07', current_date + 6, 22000000, 'Identified', pg_temp.who('account_manager'), 'Expression of interest', 'Short deadline.'),
  (pg_temp.sid(163), 'Conference coverage framework', 'University of Health Sciences', 'UHS/PR/2026/03', current_date - 20, 15000000, 'Submitted', pg_temp.who('account_manager'), '', 'Result expected this month.')
on conflict (id) do nothing;

insert into public.growth_events (id, title, kind, starts_on, ends_on, location, role, owner_id, cost, leads_expected, notes) values
  (pg_temp.sid(171), 'East African Health Expo', 'Exhibition', current_date + 21, current_date + 23, 'Diamond Jubilee Hall, Dar es Salaam', 'Exhibitor', pg_temp.who('account_manager'), 1800000, 15, 'Bring the showreel screen and QR flyers.'),
  (pg_temp.sid(172), 'MAT Annual Scientific Conference', 'Conference', current_date + 45, current_date + 47, 'Mwanza', 'Media partner', pg_temp.who('account_manager'), 0, 8, '')
on conflict (id) do nothing;

-- =========================================================== PROJECTS
insert into public.projects (id, code, name, client_id, service, template, stage, lead_id, start_date, end_date, budget, contract_value, spent, priority, location, health, description) values
  (pg_temp.sid(201), 'BM-PRJ-S01', 'Tanzania Health Summit — live stream', pg_temp.sid(102), 'Live Streaming', 'Live stream', 'Shoot', pg_temp.who('project_lead'), current_date - 2, current_date + 3, 15000000, 22000000, 9400000, 'High', 'JNICC, Dar es Salaam', 'amber', 'Three-day multi-camera stream with daily recap reels and a closing highlights film.'),
  (pg_temp.sid(202), 'BM-PRJ-S02', 'Graduation film', pg_temp.sid(103), 'Event Coverage', 'Event coverage', 'Edit', pg_temp.who('project_lead'), current_date - 14, current_date + 10, 7000000, 11500000, 3100000, 'Normal', 'Upanga, Dar es Salaam', 'green', 'A 6-minute film, a 60-second social cut and a photo gallery.'),
  (pg_temp.sid(203), 'BM-PRJ-S03', 'Patient stories — early screening', pg_temp.sid(101), 'Health Communication', 'Documentary', 'Pre-production', pg_temp.who('project_lead'), current_date + 2, current_date + 40, 12000000, 18000000, 800000, 'Normal', 'Upanga Referral Hospital', 'green', 'Three short documentaries on breast, cervical and prostate cancer screening, in Kiswahili with English subtitles.'),
  (pg_temp.sid(204), 'BM-PRJ-S04', 'Water brand launch film', pg_temp.sid(105), 'Video Production', 'Corporate film', 'Brief', pg_temp.who('project_lead'), current_date + 5, current_date + 40, 6000000, 9500000, 0, 'Normal', 'Moshi, Kilimanjaro', 'green', '90-second launch film shot at the spring, plus 3 cut-downs for social.'),
  (pg_temp.sid(205), 'BM-PRJ-S05', 'Health Talk podcast — season 2', pg_temp.sid(101), 'Podcast Production', 'Podcast', 'Client Review', pg_temp.who('project_lead'), current_date - 30, current_date + 2, 4000000, 6000000, 3600000, 'High', 'Basil Media studio', 'red', 'Eight video episodes with doctors; episodes 5–8 waiting for client approval.')
on conflict (id) do nothing;

insert into public.project_budget_lines (id, project_id, line, allocated) values
  (pg_temp.sid(211), pg_temp.sid(201), 'Crew', 6000000), (pg_temp.sid(212), pg_temp.sid(201), 'Equipment hire', 4500000), (pg_temp.sid(213), pg_temp.sid(201), 'Transport', 1500000),
  (pg_temp.sid(214), pg_temp.sid(201), 'Per diem & meals', 1800000), (pg_temp.sid(215), pg_temp.sid(201), 'Contingency', 1200000),
  (pg_temp.sid(216), pg_temp.sid(202), 'Crew', 3000000), (pg_temp.sid(217), pg_temp.sid(202), 'Post-production', 2500000), (pg_temp.sid(218), pg_temp.sid(202), 'Transport', 500000),
  (pg_temp.sid(219), pg_temp.sid(203), 'Crew', 5000000), (pg_temp.sid(220), pg_temp.sid(203), 'Location & permits', 1000000), (pg_temp.sid(221), pg_temp.sid(203), 'Post-production', 4000000)
on conflict (id) do nothing;

insert into public.project_crew (id, project_id, user_id, role, days)
select x.id, x.p, x.u, x.r, x.d from (values
  (pg_temp.sid(231), pg_temp.sid(201), pg_temp.who('staff'), 'Camera operator', 3),
  (pg_temp.sid(232), pg_temp.sid(202), pg_temp.who('staff'), 'Editor', 6),
  (pg_temp.sid(233), pg_temp.sid(203), pg_temp.who('staff'), 'Director of photography', 5)
) as x(id, p, u, r, d) where x.u is not null
on conflict do nothing;

insert into public.tasks (id, project_id, title, description, assignee_id, due_date, priority, status, checklist, minutes_logged) values
  (pg_temp.sid(241), pg_temp.sid(201), 'Day 2 recap reel', 'Cut a 60-second reel of day 2 for Instagram and LinkedIn.', pg_temp.who('staff'), current_date, 'High', 'In progress', '[{"text":"Select clips","done":true},{"text":"Captions EN/SW","done":false},{"text":"Send for approval","done":false}]', 90),
  (pg_temp.sid(242), pg_temp.sid(201), 'Back up day 1 cards', '', pg_temp.who('staff'), current_date - 1, 'Urgent', 'To do', '[]', 0),
  (pg_temp.sid(243), pg_temp.sid(202), 'Colour grade graduation film', '', pg_temp.who('staff'), current_date + 3, 'Normal', 'In progress', '[{"text":"Rough cut approved","done":true},{"text":"Grade","done":false}]', 240),
  (pg_temp.sid(244), pg_temp.sid(203), 'Interview questions for oncologist', '', pg_temp.who('project_lead'), current_date + 1, 'Normal', 'To do', '[]', 0),
  (pg_temp.sid(245), pg_temp.sid(203), 'Consent forms for patients', 'Kiswahili and English versions, signed before filming.', pg_temp.who('project_lead'), current_date + 2, 'High', 'To do', '[]', 0),
  (pg_temp.sid(246), pg_temp.sid(205), 'Export episodes 5–8 for client review', '', pg_temp.who('staff'), current_date - 3, 'High', 'Done', '[]', 180)
on conflict (id) do nothing;

insert into public.shoots (id, project_id, title, shoot_date, call_time, wrap_time, location, contact_name, contact_phone, shot_list, equipment, nearest_hospital, notes, status) values
  (pg_temp.sid(251), pg_temp.sid(201), 'Summit day 3 · closing and awards', current_date + 1, '06:30', '20:00', 'JNICC, Shaaban Robert Street', 'Lilian Massawe', '+255 754 118 920', '[{"text":"Keynote wide + close","done":false},{"text":"Awards on stage","done":false},{"text":"Vox pops x6","done":false}]', '3 cameras, switcher, 2 wireless mics, streaming kit', 'Ocean Road Hospital', 'Parking at gate B.', 'Planned'),
  (pg_temp.sid(252), pg_temp.sid(203), 'Screening clinic interviews', current_date + 6, '07:00', '15:00', 'Upanga Referral Hospital, Oncology', 'Dr Neema Mushi', '+255 713 220 401', '[{"text":"Doctor interview","done":false},{"text":"Patient walk-and-talk","done":false},{"text":"Clinic b-roll","done":false}]', 'FX6, 2 lights, lav mics', 'On site', 'Quiet on set near the wards.', 'Planned'),
  (pg_temp.sid(253), pg_temp.sid(202), 'Graduation ceremony', current_date - 12, '06:00', '18:00', 'University main hall', 'Prof. Joseph Mbwambo', '+255 765 440 120', '[]', '2 cameras, drone', 'Muhimbili', '', 'Wrapped')
on conflict (id) do nothing;

insert into public.shoot_crew (id, shoot_id, user_id, role, call_time)
select x.id, x.s, x.u, x.r, x.c from (values
  (pg_temp.sid(261), pg_temp.sid(251), pg_temp.who('staff'), 'Camera A', '06:30'),
  (pg_temp.sid(262), pg_temp.sid(252), pg_temp.who('staff'), 'Director of photography', '07:00')
) as x(id, s, u, r, c) where x.u is not null
on conflict do nothing;

insert into public.deliverables (id, project_id, title, spec, owner_id, due_date, post_status, revision_round) values
  (pg_temp.sid(271), pg_temp.sid(202), 'Graduation film (6 min)', '1080p, EN subtitles', pg_temp.who('staff'), current_date + 8, 'Colour', 1),
  (pg_temp.sid(272), pg_temp.sid(202), 'Social cut (60 s, vertical)', '1080x1920', pg_temp.who('staff'), current_date + 10, 'Fine cut', 0),
  (pg_temp.sid(273), pg_temp.sid(205), 'Episodes 5–8', '4K, audio −16 LUFS', pg_temp.who('staff'), current_date + 2, 'Ready for review', 1)
on conflict (id) do nothing;

insert into public.announcements (id, title, body, author_id, pinned)
select x.id, x.t, x.b, pg_temp.who('gm_cfo'), x.p from (values
  (pg_temp.sid(281), 'Staff meeting on Monday at 08:30', 'Short planning meeting in the boardroom: summit wrap-up, screening documentary and the expo stand.', true),
  (pg_temp.sid(282), 'Back up every card the same day', 'Two verified copies before any card is formatted — no exceptions.', false)
) as x(id, t, b, p) where pg_temp.who('gm_cfo') is not null
on conflict (id) do nothing;

-- =========================================================== RETAINER (client portal)
insert into public.retainers (id, number, client_id, tier, monthly_fee, start_date, end_date, status, allowances, rollover, rollover_cap_pct, account_manager_id, notes) values
  (pg_temp.sid(301), 'BM-RET-SAMPLE-1', pg_temp.sid(101), 'Growth', 3600000, date_trunc('year', current_date)::date, (date_trunc('year', current_date) + interval '1 year - 1 day')::date, 'active',
   '{"shoot_days":4,"podcast_episodes":2,"posts":12,"reels":4,"edited_photos":160}', 'next_month', 25, pg_temp.who('account_manager'), 'Content for the hospital''s social media and patient education screens.')
on conflict (id) do nothing;

insert into public.retainer_calendar (id, retainer_id, client_id, project_id, date, time, kind, title, location, map_url, status, crew, call_time, checklist, units) values
  (pg_temp.sid(311), pg_temp.sid(301), pg_temp.sid(101), null, current_date - 8, '09:00', 'shoot', 'Nurses'' week portraits', 'Upanga Referral Hospital', 'https://maps.google.com/?q=Upanga%20Dar%20es%20Salaam', 'Completed', '[]', '08:30', '[]', '{"shoot_days":1,"edited_photos":40}'),
  (pg_temp.sid(312), pg_temp.sid(301), pg_temp.sid(101), null, current_date + 3, '10:00', 'podcast', 'Health Talk · Diabetes in young adults', 'Basil Media studio, Upanga', 'https://maps.google.com/?q=Mataka%20Street%20Upanga', 'Crew confirmed', case when pg_temp.who('staff') is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('user_id', pg_temp.who('staff'), 'role', 'Podcast producer')) end, '09:30', '[{"label":"Guest briefed","done":true},{"label":"Studio booked","done":true}]', '{"podcast_episodes":1}'),
  (pg_temp.sid(313), pg_temp.sid(301), pg_temp.sid(101), null, current_date + 9, '08:00', 'shoot', 'Maternity ward tour video', 'Upanga Referral Hospital, Maternity', 'https://maps.google.com/?q=Upanga%20Dar%20es%20Salaam', 'Scheduled', case when pg_temp.who('staff') is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('user_id', pg_temp.who('staff'), 'role', 'Camera')) end, '07:30', '[]', '{"shoot_days":1,"reels":1}'),
  (pg_temp.sid(314), pg_temp.sid(301), pg_temp.sid(101), null, current_date + 12, '12:00', 'delivery', 'Monthly posts and reels pack', '', '', 'Scheduled', '[]', '', '[]', '{"posts":12,"reels":2}')
on conflict (id) do nothing;

insert into public.allowance_ledger (id, retainer_id, client_id, month, unit, qty, kind, note) values
  (pg_temp.sid(321), pg_temp.sid(301), pg_temp.sid(101), to_char(current_date, 'YYYY-MM'), 'shoot_days', 1, 'usage', 'Nurses'' week portraits'),
  (pg_temp.sid(322), pg_temp.sid(301), pg_temp.sid(101), to_char(current_date, 'YYYY-MM'), 'edited_photos', 40, 'usage', 'Nurses'' week portraits'),
  (pg_temp.sid(323), pg_temp.sid(301), pg_temp.sid(101), to_char(current_date, 'YYYY-MM'), 'posts', 5, 'usage', 'Posts published so far this month')
on conflict (id) do nothing;

insert into public.client_requests (id, number, client_id, retainer_id, type, title, preferred_dates, location, deliverables, urgency, status, units, over_allowance, quote_amount, quote_status, note) values
  (pg_temp.sid(331), 'BM-REQ-SAMPLE-1', pg_temp.sid(101), pg_temp.sid(301), 'shoot', 'World Diabetes Day awareness walk', jsonb_build_array(current_date + 14), 'Coco Beach', 'Photos and one reel', 'Soon', 'Reviewing', '{"shoot_days":1,"reels":1}', false, 0, 'none', ''),
  (pg_temp.sid(332), 'BM-REQ-SAMPLE-2', pg_temp.sid(101), pg_temp.sid(301), 'video', 'Hospital anniversary film (3 min)', jsonb_build_array(current_date + 30, current_date + 33), 'Upanga Referral Hospital', '3-minute film', 'Normal', 'Quote needed', '{"shoot_days":2}', true, 2800000, 'sent', 'Over the monthly allowance — quote sent.')
on conflict (id) do nothing;

-- =========================================================== STORE, RECEPTION, TRANSPORT
insert into public.gear_items (id, tag, name, category, make, model, serial, purchase_date, purchase_price, supplier, condition, location, accessories, day_rate, useful_life_years, salvage_value, status, notes) values
  (pg_temp.sid(401), 'BM-CAM-001', 'Sony FX6 cinema camera', 'Camera', 'Sony', 'ILME-FX6', 'FX6-55102', current_date - 400, 14500000, 'Camera World Dar', 'Excellent', 'Store shelf A1', 'Handle, 2 batteries, charger', 250000, 5, 2000000, 'available', ''),
  (pg_temp.sid(402), 'BM-CAM-002', 'Sony A7S III', 'Camera', 'Sony', 'ILCE-7SM3', 'A7S3-88210', current_date - 700, 8200000, 'Camera World Dar', 'Good', 'Store shelf A1', 'Cage, 3 batteries', 150000, 5, 1000000, 'available', ''),
  (pg_temp.sid(403), 'BM-LEN-001', 'Sony 24–70mm f/2.8 GM II', 'Lens', 'Sony', 'SEL2470GM2', 'L2470-1182', current_date - 400, 4600000, 'Camera World Dar', 'Excellent', 'Store shelf A2', 'Hood, caps', 60000, 6, 500000, 'available', ''),
  (pg_temp.sid(404), 'BM-AUD-001', 'Rode Wireless PRO kit', 'Audio', 'Rode', 'Wireless PRO', 'RWP-22018', current_date - 300, 1450000, 'Sound House', 'Good', 'Store shelf B1', '2 transmitters, receiver, lavs', 40000, 4, 150000, 'available', ''),
  (pg_temp.sid(405), 'BM-LGT-001', 'Aputure 300d II light', 'Lighting', 'Aputure', 'LS 300d II', 'AP300-7731', current_date - 900, 2600000, 'Light Store', 'Fair', 'Store shelf C1', 'Softbox, stand', 50000, 5, 200000, 'available', 'Fan noisy — watch it.'),
  (pg_temp.sid(406), 'BM-DRN-001', 'DJI Mavic 3 Pro drone', 'Drone', 'DJI', 'Mavic 3 Pro', 'M3P-44120', current_date - 200, 6900000, 'DJI Store', 'Excellent', 'Store cabinet D', '3 batteries, ND filters', 200000, 4, 800000, 'available', 'TCAA permit needed for every flight.'),
  (pg_temp.sid(407), 'BM-STR-001', 'Blackmagic ATEM Mini Extreme', 'Streaming', 'Blackmagic', 'ATEM Mini Extreme ISO', 'ATEM-9921', current_date - 500, 3400000, 'Pro AV', 'Good', 'Store shelf E1', 'Power, HDMI cables', 120000, 5, 300000, 'in_repair', 'HDMI 3 input intermittent — at the repairer.')
on conflict (id) do nothing;

insert into public.gear_kits (id, code, name, description, gear_ids, extras) values
  (pg_temp.sid(411), 'KIT-INT', 'Interview kit', 'One-camera interview with light and wireless audio.', array[pg_temp.sid(401), pg_temp.sid(403), pg_temp.sid(404), pg_temp.sid(405)], array['Tripod', 'Gaffer tape', '2 × 128 GB cards']),
  (pg_temp.sid(412), 'KIT-LIVE', 'Live stream kit', 'Switcher plus two cameras for live streams.', array[pg_temp.sid(401), pg_temp.sid(402), pg_temp.sid(407)], array['3 × HDMI 15 m', 'Laptop', '4G router'])
on conflict (id) do nothing;

insert into public.consumables (id, name, category, unit, quantity, min_level, unit_cost, location) values
  (pg_temp.sid(421), 'AA batteries', 'Power', 'pack of 4', 6, 10, 9000, 'Store drawer 1'),
  (pg_temp.sid(422), 'Gaffer tape (black)', 'Grip', 'roll', 8, 4, 18000, 'Store drawer 2'),
  (pg_temp.sid(423), 'SD cards 128 GB', 'Media', 'card', 12, 6, 65000, 'Store cabinet D'),
  (pg_temp.sid(424), 'Lens cleaning tissue', 'Cleaning', 'pack', 3, 5, 6000, 'Store drawer 1')
on conflict (id) do nothing;

insert into public.vehicles (id, registration, make_model, seats, status, insurance_expiry, inspection_expiry, odometer, notes) values
  (pg_temp.sid(431), 'T 512 DKL', 'Toyota HiAce (crew van)', 12, 'available', current_date + 120, current_date + 40, 84210, ''),
  (pg_temp.sid(432), 'T 288 EBX', 'Toyota Land Cruiser Prado', 7, 'available', current_date + 25, current_date + 200, 132400, 'Insurance renews this month.')
on conflict (id) do nothing;

insert into public.trips (id, vehicle_id, driver_id, project_id, purpose, origin, destination, depart_at, return_at, passengers, cargo, stage)
select x.id, x.v, x.d, x.p, x.purpose, 'Basil Media, Upanga', x.dest, x.dep, x.ret, x.pax, x.cargo, x.stage from (values
  (pg_temp.sid(441), pg_temp.sid(431), pg_temp.who('driver'), pg_temp.sid(201), 'Summit day 3 crew and kit', 'JNICC, Dar es Salaam', (current_date + 1) + time '05:45', (current_date + 1) + time '21:00', 'Camera crew (4)', 'Live stream kit', 'Scheduled'),
  (pg_temp.sid(442), pg_temp.sid(432), pg_temp.who('driver'), pg_temp.sid(204), 'Recce at the spring', 'Moshi, Kilimanjaro', (current_date + 5) + time '06:00', (current_date + 6) + time '18:00', 'Director, producer', 'Drone kit', 'Scheduled')
) as x(id, v, d, p, purpose, dest, dep, ret, pax, cargo, stage) where x.d is not null
on conflict (id) do nothing;

insert into public.visitors (id, name, company, phone, purpose, host_id, expected_at, status, pass_code) values
  (pg_temp.sid(451), 'Dr Peter Laizer', 'Mbeya Zonal Hospital', '+255 767 330 210', 'Film series meeting', pg_temp.who('account_manager'), (current_date + 1) + time '10:00', 'expected', 'BMV-S1A2'),
  (pg_temp.sid(452), 'Rose Ndege', 'Afya Bora NGO', '+255 715 990 001', 'Campaign briefing', pg_temp.who('gm_cfo'), (current_date + 2) + time '14:00', 'expected', 'BMV-S3B4')
on conflict (id) do nothing;

insert into public.room_bookings (id, room, date, start_hour, end_hour, title, booked_by, status)
select x.id, x.room, x.d, x.s, x.e, x.t, x.u, 'booked' from (values
  (pg_temp.sid(461), 'Podcast studio', current_date + 3, 9, 13, 'Health Talk recording', pg_temp.who('project_lead')),
  (pg_temp.sid(462), 'Boardroom', current_date + 1, 10, 11, 'Mbeya Zonal Hospital meeting', pg_temp.who('account_manager')),
  (pg_temp.sid(463), 'Edit suite', current_date, 8, 17, 'Graduation film grade', pg_temp.who('staff'))
) as x(id, room, d, s, e, t, u) where x.u is not null
on conflict (id) do nothing;

-- =========================================================== MONEY
insert into public.finance_accounts (id, name, kind, opening_balance, opening_date) values
  (pg_temp.sid(501), 'CRDB Bank · current account', 'bank', 18500000, date_trunc('month', current_date)::date),
  (pg_temp.sid(502), 'M-Pesa business till', 'mobile', 1250000, date_trunc('month', current_date)::date),
  (pg_temp.sid(503), 'Office petty cash', 'cash', 800000, date_trunc('month', current_date)::date)
on conflict (id) do nothing;

insert into public.quotations (id, client_id, project_id, prospect, title, items, discount, vat_on, vat_rate, issue_date, valid_until, status, notes, created_by) values
  (pg_temp.sid(511), pg_temp.sid(104), null, '', 'Branch content retainer — first quarter',
   pg_temp.items('Monthly content plan|Calendar, scripts and approvals|3|600000', 'Reels|Vertical 30–60 s, captions EN/SW|12|250000', 'Edited photos|Branch and staff photography|120|8000'), 0, true, 18, current_date - 6, current_date + 24, 'sent', '', pg_temp.who('gm_cfo')),
  (pg_temp.sid(512), null, null, 'Mbeya Zonal Hospital', 'Patient-safety film series',
   pg_temp.items('Pre-production|Research, scripts, consent|1|2500000', 'Filming|3 shoot days, crew of 4|3|3200000', 'Post-production|Edit, colour, sound, subtitles|3|1800000'), 5, true, 18, current_date - 1, current_date + 29, 'draft', '', pg_temp.who('gm_cfo'))
on conflict (id) do nothing;

insert into public.proformas (id, client_id, prospect, title, items, discount, vat_on, vat_rate, issue_date, valid_until, status, terms, created_by) values
  (pg_temp.sid(521), pg_temp.sid(102), '', 'Summit 2027 — live stream deposit',
   pg_temp.items('Live stream, 3 days|Multi-camera, graphics, recording|3|6000000', 'Highlights film|3-minute closing film|1|4000000'), 0, true, 18, current_date - 3, current_date + 27, 'sent', 'Payment by bank transfer or mobile money. Quote the proforma number as reference.', pg_temp.who('gm_cfo'))
on conflict (id) do nothing;

insert into public.invoices (id, client_id, project_id, title, po_ref, items, discount, vat_on, vat_rate, deposit, schedule, issue_date, due_date, status, notes, terms, created_by) values
  (pg_temp.sid(531), pg_temp.sid(102), pg_temp.sid(201), 'Health Summit live stream', 'THS/PO/2026/041',
   pg_temp.items('Live stream, 3 days|Multi-camera, graphics, recording|3|5500000', 'Daily recap reels|3 reels|3|800000', 'Highlights film|3-minute closing film|1|3100000'), 0, true, 18, 0,
   jsonb_build_array(jsonb_build_object('label', 'Deposit', 'pct', 50, 'due', current_date - 20), jsonb_build_object('label', 'On delivery', 'pct', 50, 'due', current_date + 10)), current_date - 25, current_date + 10, 'sent', '', '', pg_temp.who('gm_cfo')),
  (pg_temp.sid(532), pg_temp.sid(103), pg_temp.sid(202), 'Graduation film and gallery', 'UHS/PR/112',
   pg_temp.items('Event coverage|Photo + video team, full day|1|6500000', 'Graduation film|6 min + social cut|1|3500000'), 0, true, 18, 0, '[]', current_date - 40, current_date - 10, 'sent', '', '', pg_temp.who('gm_cfo')),
  (pg_temp.sid(533), pg_temp.sid(101), null, 'Retainer · last month', '',
   pg_temp.items('Monthly content retainer|Growth tier|1|3600000'), 0, true, 18, 0, '[]', current_date - 35, current_date - 5, 'sent', '', '', pg_temp.who('gm_cfo'))
on conflict (id) do nothing;

insert into public.invoice_payments (id, invoice_id, amount, paid_on, method, reference, account_id, is_deposit) values
  (pg_temp.sid(541), pg_temp.sid(531), round(public.doc_total(pg_temp.items('Live stream, 3 days|x|3|5500000', 'Daily recap reels|x|3|800000', 'Highlights film|x|1|3100000'), 0, true, 18) / 2), current_date - 18, 'Bank transfer', 'CRDB-TT-884120', pg_temp.sid(501), true),
  (pg_temp.sid(542), pg_temp.sid(533), 4248000, current_date - 4, 'Mobile money', 'MPESA-QJ71K2', pg_temp.sid(502), false)
on conflict (id) do nothing;

insert into public.expenses (id, date, amount, category, account_id, project_id, payee, description, petty_cash, recorded_by) values
  (pg_temp.sid(551), current_date - 2, 1200000, 'Equipment hire', pg_temp.sid(501), pg_temp.sid(201), 'Pro AV Rentals', 'Extra camera and LED wall for the summit', false, pg_temp.who('finance')),
  (pg_temp.sid(552), current_date - 2, 360000, 'Per diem & meals', pg_temp.sid(503), pg_temp.sid(201), 'Crew (6)', 'Summit day 1–2 lunches', true, pg_temp.who('finance')),
  (pg_temp.sid(553), current_date - 10, 2500000, 'Rent & utilities', pg_temp.sid(501), null, 'Mataka Street landlord', 'Office and studio rent', false, pg_temp.who('finance')),
  (pg_temp.sid(554), current_date - 7, 189000, 'Software & subscriptions', pg_temp.sid(501), null, 'Adobe', 'Creative Cloud team', false, pg_temp.who('finance')),
  (pg_temp.sid(555), current_date - 12, 450000, 'Transport', pg_temp.sid(502), pg_temp.sid(202), 'Fuel', 'Graduation shoot transport', false, pg_temp.who('finance'))
on conflict (id) do nothing;

-- Money requests at each step: waiting for the GM, waiting for the Boss, approved and waiting for Finance.
insert into public.money_requests (id, number, requester_id, project_id, budget_line_id, amount, purpose, category, needed_by, payee, payee_phone, method, urgency, status, recommendation, submitted_at, stage_at, reviewed_at, reviewed_by, approved_at, approved_by, approved_amount)
select x.id, x.num, x.req, x.proj, x.line, x.amt, x.purpose, x.cat, current_date + x.need, x.payee, x.phone, x.method, x.urg, x.status, x.rec,
       now() - interval '1 day', now() - x.age, case when x.status <> 'gm_review' then now() - interval '6 hours' end, case when x.status <> 'gm_review' then pg_temp.who('gm_cfo') end,
       case when x.status = 'approved' then now() - interval '2 hours' end, case when x.status = 'approved' then pg_temp.who('boss') end, case when x.status = 'approved' then x.amt end
from (values
  (pg_temp.sid(561), 'BM-REQ-S-0001', pg_temp.who('staff'), pg_temp.sid(201), pg_temp.sid(214), 240000::numeric, 'Crew lunches, summit day 3', 'Per diem & meals', 1, 'Mama Asha Catering', '+255 712 556 004', 'M-Pesa', 'urgent', 'gm_review', '', interval '3 hours'),
  (pg_temp.sid(562), 'BM-REQ-S-0002', pg_temp.who('project_lead'), pg_temp.sid(201), pg_temp.sid(212), 1800000::numeric, 'Hire LED wall for the awards night', 'Equipment hire', 1, 'Pro AV Rentals', '+255 754 300 880', 'Bank transfer', 'urgent', 'boss_approval', 'Needed for the awards; within the equipment line.', interval '5 hours'),
  (pg_temp.sid(563), 'BM-REQ-S-0003', pg_temp.who('project_lead'), pg_temp.sid(203), pg_temp.sid(220), 350000::numeric, 'Hospital filming permit', 'Location & permits', 4, 'Upanga Referral Hospital', '', 'Bank transfer', 'normal', 'approved', 'Required before filming.', interval '2 hours')
) as x(id, num, req, proj, line, amt, purpose, cat, need, payee, phone, method, urg, status, rec, age)
where x.req is not null
on conflict (id) do nothing;

-- =========================================================== BOSS, CALENDAR
insert into public.scoreboard_targets (id, year, metric, label, unit, target, actual, sort_order) values
  (pg_temp.sid(601), extract(year from current_date)::int, 'revenue', 'Revenue', 'tsh', 480000000, 312000000, 1),
  (pg_temp.sid(602), extract(year from current_date)::int, 'retainers', 'Active retainer clients', 'count', 8, 3, 2),
  (pg_temp.sid(603), extract(year from current_date)::int, 'projects', 'Projects delivered', 'count', 60, 41, 3),
  (pg_temp.sid(604), extract(year from current_date)::int, 'nps', 'Client rating (out of 100)', 'pct', 92, 90, 4)
on conflict (id) do nothing;

insert into public.decisions (id, decided_on, title, context, decision, decided_by, owner_id, review_on, status) values
  (pg_temp.sid(611), current_date - 20, 'Buy a second FX6', 'Two clashing shoots a week in peak season; hiring costs TSH 250K a day.', 'Buy one FX6 this quarter from retainer income.', pg_temp.who('boss'), pg_temp.who('gm_cfo'), current_date + 70, 'Active'),
  (pg_temp.sid(612), current_date - 45, 'Same-day backup rule', 'A card was nearly formatted before backup.', 'No card is formatted without two verified copies, checked by the project lead.', pg_temp.who('boss'), pg_temp.who('project_lead'), current_date + 45, 'Active')
on conflict (id) do nothing;

insert into public.calendar_events (id, title, description, location, starts_at, ends_at, all_day, color, visibility, created_by) values
  (pg_temp.sid(621), 'Staff meeting', 'Weekly planning.', 'Boardroom', (current_date + ((8 - extract(isodow from current_date)::int) % 7)) + time '08:30', (current_date + ((8 - extract(isodow from current_date)::int) % 7)) + time '09:15', false, '', 'staff', pg_temp.who('gm_cfo')),
  (pg_temp.sid(622), 'Gear check day', 'Clean, charge and test every camera and light.', 'Media store', (current_date + 4) + time '09:00', (current_date + 4) + time '12:00', false, '', 'staff', pg_temp.who('storekeeper')),
  (pg_temp.sid(623), 'East African Health Expo', 'Our stand is B14.', 'Diamond Jubilee Hall', (current_date + 21)::timestamptz, (current_date + 23)::timestamptz, true, '', 'everyone', pg_temp.who('account_manager'))
on conflict (id) do nothing;
