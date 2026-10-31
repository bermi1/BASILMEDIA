-- Basil Media OS · 0009 real content from Basil Media's own channels.
-- For databases where 0003 (starter content) already ran. Safe to re-run.
-- Source: Basil Media Tz YouTube channel (https://www.youtube.com/@basilmediatz) — see docs/CONTENT_SOURCES.md.

update public.site_settings set
  about_story = 'Basil Media is a youth-driven digital media platform dedicated to health education, innovation, and impactful storytelling. We exist to inform, inspire, and empower young people with reliable health information, creative ideas, and forward-thinking solutions that shape a healthier future.

Through engaging content, expert conversations, and real-life stories, Basil Media bridges the gap between medical knowledge, innovation, and the everyday lives of young people. Our focus spans health awareness, mental well-being, medical education, technology, entrepreneurship, and youth-led innovation.

We collaborate with healthcare professionals, institutions, innovators, and young change-makers to deliver content that is educational, relatable, and transformative.

At Basil Media, we believe the youth are not just the leaders of tomorrow—but the innovators of today. Learn. Innovate. Inspire.',
  about_image_url = '/media/basil-media-studio-btv.webp',
  socials = coalesce(socials, '{}'::jsonb) || jsonb_build_object('youtube', 'https://www.youtube.com/@basilmediatz'),
  updated_at = now()
where id = 'site';

insert into public.projects_public (title, client, category, image_url, description, video_url, external_url, featured, sort_order, published)
select '#LIVE: The 2026 PAT Scientific Conference — Mwanza', 'Paediatric Association of Tanzania (PAT)', 'Corporate', '/media/pat-scientific-conference-2026-live.webp', 'Live stream of the 2026 PAT Scientific Conference, 15 July 2026, Malaika Beach Resort, Mwanza. Theme: “Resilient Health Systems for Every Child: Innovation, Equity and Quality of Care”.', 'https://www.youtube.com/watch?v=em1S7s6k7BI', '', true, 1, true
where not exists (select 1 from public.projects_public where title = '#LIVE: The 2026 PAT Scientific Conference — Mwanza');

insert into public.projects_public (title, client, category, image_url, description, video_url, external_url, featured, sort_order, published)
select '#LIVE: National Medical Congress 2026 — UDSM', 'Medical Association of Tanzania (MAT)', 'Corporate', '/media/national-medical-congress-2026-live.webp', 'Live stream of the National Medical Congress 2026 presented by the Medical Association of Tanzania, 17 June 2026, UDSM, Dar es Salaam. Theme: “Tanzania Vision 2050: The Healthcare We Want”.', 'https://www.youtube.com/watch?v=3T0PnVtU2Bo', '', true, 2, true
where not exists (select 1 from public.projects_public where title = '#LIVE: National Medical Congress 2026 — UDSM');

insert into public.projects_public (title, client, category, image_url, description, video_url, external_url, featured, sort_order, published)
select 'Kutoka kilo 145 ➝ 75: safari ya Said Shukuru', 'Aga Khan Hospital, Dar es Salaam', 'Films & Documentaries', '/media/said-shukuru-145-to-75-kilo-journey.webp', 'Said Shukuru’s journey from 145 kg to 75 kg — a real-life health story connected to Aga Khan Hospital, Dar es Salaam.', 'https://www.youtube.com/watch?v=tAXCUSfM5u4', '', true, 3, true
where not exists (select 1 from public.projects_public where title = 'Kutoka kilo 145 ➝ 75: safari ya Said Shukuru');

insert into public.projects_public (title, client, category, image_url, description, video_url, external_url, featured, sort_order, published)
select 'Sikiliza historia ya Tanzania Health Summit — Dr Omary Chillo', 'Tanzania Health Summit', 'Podcasts', '/media/tanzania-health-summit-dr-omary-chillo.webp', 'Dr Omary Chillo on the history of the Tanzania Health Summit, its achievements and its challenges.', 'https://www.youtube.com/watch?v=T_vtw0pTr-g', '', true, 4, true
where not exists (select 1 from public.projects_public where title = 'Sikiliza historia ya Tanzania Health Summit — Dr Omary Chillo');

insert into public.projects_public (title, client, category, image_url, description, video_url, external_url, featured, sort_order, published)
select 'Inasisimua: Mama Sabrina na mwanae mwenye sickle cell', 'Basil Media', 'Films & Documentaries', '/media/mama-sabrina-sickle-cell.webp', 'The story of Mama Sabrina and how she fights for her child living with sickle cell disease.', 'https://www.youtube.com/watch?v=EWZAkKlRjXs', '', true, 5, true
where not exists (select 1 from public.projects_public where title = 'Inasisimua: Mama Sabrina na mwanae mwenye sickle cell');

insert into public.projects_public (title, client, category, image_url, description, video_url, external_url, featured, sort_order, published)
select 'Fahamu kuhusu tiba asili — Chuo Kikuu cha Muhimbili', 'Muhimbili University of Health and Allied Sciences (MUHAS)', 'Films & Documentaries', '/media/muhas-tiba-asili.webp', 'Traditional medicine explained, from Muhimbili University of Health and Allied Sciences.', 'https://www.youtube.com/watch?v=6PaY6FeT9nQ', '', true, 6, true
where not exists (select 1 from public.projects_public where title = 'Fahamu kuhusu tiba asili — Chuo Kikuu cha Muhimbili');

insert into public.projects_public (title, client, category, image_url, description, video_url, external_url, featured, sort_order, published)
select 'The Pharmacist — Ep 03: Afya Fiesta 2025 with TAMSA', 'TAMSA', 'Podcasts', '/media/the-pharmacist-ep03-afya-fiesta-tamsa.webp', 'Episode 3 of The Pharmacist, recorded in the Basil Media (BTV) studio: Afya Fiesta 2025 with TAMSA.', 'https://www.youtube.com/watch?v=TCKvCDgxR_o', '', false, 7, true
where not exists (select 1 from public.projects_public where title = 'The Pharmacist — Ep 03: Afya Fiesta 2025 with TAMSA');

insert into public.projects_public (title, client, category, image_url, description, video_url, external_url, featured, sort_order, published)
select 'Prof Karim Manji — niko MUHAS kwa mwaka wa 37', 'Muhimbili University of Health and Allied Sciences (MUHAS)', 'Films & Documentaries', '/media/prof-karim-manji-muhas.webp', 'Prof Karim Manji on 37 years at MUHAS.', 'https://www.youtube.com/watch?v=cKksPy5U6-8', '', false, 8, true
where not exists (select 1 from public.projects_public where title = 'Prof Karim Manji — niko MUHAS kwa mwaka wa 37');

insert into public.projects_public (title, client, category, image_url, description, video_url, external_url, featured, sort_order, published)
select 'Uzinduzi wa kongamano la kwanza la wanataaluma wa famasi Tanzania', 'Basil Media', 'Corporate', '/media/pharmacy-professionals-congress-launch.webp', 'The launch of the first congress of pharmacy professionals in Tanzania.', 'https://www.youtube.com/watch?v=0d5FagVEtdQ', '', false, 9, true
where not exists (select 1 from public.projects_public where title = 'Uzinduzi wa kongamano la kwanza la wanataaluma wa famasi Tanzania');

insert into public.projects_public (title, client, category, image_url, description, video_url, external_url, featured, sort_order, published)
select 'The Medics — Ep 05: Vifo vyenye utata', 'Basil Media', 'Podcasts', '/media/the-medics-ep05.webp', 'Episode 5 of The Medics, a Basil Media health talk show.', 'https://www.youtube.com/watch?v=ctyRynHmDuo', '', false, 10, true
where not exists (select 1 from public.projects_public where title = 'The Medics — Ep 05: Vifo vyenye utata');

insert into public.projects_public (title, client, category, image_url, description, video_url, external_url, featured, sort_order, published)
select 'Sip & Talk — Ep 04: Namna ya kuondokana na msongo wa mawazo', 'Basil Media', 'Podcasts', '/media/sip-and-talk-ep04.webp', 'Episode 4 of Sip & Talk: how to overcome stress.', 'https://www.youtube.com/watch?v=2Y-j-_JU-6s', '', false, 11, true
where not exists (select 1 from public.projects_public where title = 'Sip & Talk — Ep 04: Namna ya kuondokana na msongo wa mawazo');

insert into public.projects_public (title, client, category, image_url, description, video_url, external_url, featured, sort_order, published)
select 'Unistar Talk — Ep 02', 'Basil Media', 'Podcasts', '/media/unistar-talk-ep02.webp', 'Episode 2 of Unistar Talk, recorded in the Basil Media (BTV) studio.', 'https://www.youtube.com/watch?v=_1EyWRBbb30', '', false, 12, true
where not exists (select 1 from public.projects_public where title = 'Unistar Talk — Ep 02');

insert into public.projects_public (title, client, category, image_url, description, video_url, external_url, featured, sort_order, published)
select 'Fahamu kuhusu uwekezaji wa hisa', 'Basil Media', 'Films & Documentaries', '/media/uwekezaji-wa-hisa.webp', 'An explainer on investing in shares — one of the most-watched videos on the Basil Media Tz channel.', 'https://www.youtube.com/watch?v=dU3h7hwNt8Q', '', false, 13, true
where not exists (select 1 from public.projects_public where title = 'Fahamu kuhusu uwekezaji wa hisa');

insert into public.projects_public (title, client, category, image_url, description, video_url, external_url, featured, sort_order, published)
select 'Mambo usiyoyafahamu kuhusu safari ya kwenda mwezini', 'Basil Media', 'Films & Documentaries', '/media/safari-ya-kwenda-mwezini.webp', 'What you did not know about the journey to the moon — a science explainer.', 'https://www.youtube.com/watch?v=CqO0Z2ee144', '', false, 14, true
where not exists (select 1 from public.projects_public where title = 'Mambo usiyoyafahamu kuhusu safari ya kwenda mwezini');

insert into public.highlights (title, video_url, thumbnail_url, sort_order, published)
select 'Basil Media studio · short', 'https://www.youtube.com/shorts/Z_Am6jJOZrc', '/media/basil-media-studio-btv.webp', 1, true
where not exists (select 1 from public.highlights where title = 'Basil Media studio · short');

insert into public.highlights (title, video_url, thumbnail_url, sort_order, published)
select 'Mainjinia wanaofanya kazi hospitalini', 'https://www.youtube.com/watch?v=UA6Ip24aIRo', '/media/hospital-engineers.webp', 2, true
where not exists (select 1 from public.highlights where title = 'Mainjinia wanaofanya kazi hospitalini');

insert into public.highlights (title, video_url, thumbnail_url, sort_order, published)
select 'Mtambo wa kisasa wa matibabu ya moyo', 'https://www.youtube.com/watch?v=vmlEFNrpl0g', '/media/modern-heart-treatment-machine.webp', 3, true
where not exists (select 1 from public.highlights where title = 'Mtambo wa kisasa wa matibabu ya moyo');

insert into public.highlights (title, video_url, thumbnail_url, sort_order, published)
select 'The Tranquility', 'https://www.youtube.com/watch?v=WkFwnOZ89e0', '/media/the-tranquility.webp', 4, true
where not exists (select 1 from public.highlights where title = 'The Tranquility');

-- Starter placeholders replaced by the real work above: unpublish them (kept, not deleted, so nothing edited in the CMS is lost).
update public.projects_public set published = false, featured = false
where title in ('Hospital care stories', 'Health Summit 2026 — live', 'Health talk — episode 4', 'Scholarship launch film', 'Plant safety film', 'Product launch reel', 'Voices of nurses')
  and video_url = '';
update public.highlights set published = false
where title in ('Summit opening — highlight reel', 'Behind the scenes · graduation', 'Podcast clip · health talk', 'Campaign teaser')
  and video_url = '';
