-- Basil Media OS · 0033 photography work: Basil Media's Pixieset galleries (cards open the full gallery).
insert into public.projects_public (title, client, category, image_url, description, external_url, featured, sort_order, published)
select v.title, v.client, 'Photo Stories', v.cover, 'Photo collection by Basil Media.', v.url, v.feat, v.ord, true from (values
  ('13th Tanzania Health Summit 2026', 'Tanzania Health Summit', '', 'https://basilmedia.pixieset.com/13thtanzaniahealthsummit2026/', true, -60),
  ('CRDB Bank Marathon 2026', 'CRDB Bank Foundation', 'https://images.pixieset.com/169195021/4729466e9fb22ff08a189993bc5da085-cover.JPG', 'https://basilmedia.pixieset.com/crdbbankmarathon2026-1/', true, -59),
  ('MUHAS — MD 2026', 'MUHAS', '', 'https://basilmedia.pixieset.com/muhasmd2026/', false, -58),
  ('Vijana Uchumi Challenge — Grand Finale', 'Vijana Uchumi Challenge', '', 'https://basilmedia.pixieset.com/vijanauchumichallange/', false, -57),
  ('Smartelite Career Fair 2026', 'Smartelite', '', 'https://basilmedia.pixieset.com/smartelitecareerfair2026/', false, -56),
  ('Ampola doctors', 'Ampola Regency Hospital', '', 'https://basilcreativemedia.pixieset.com/ampoladoctors/', false, -55)
) as v(title, client, cover, url, feat, ord)
where not exists (select 1 from public.projects_public p where p.external_url = v.url);
