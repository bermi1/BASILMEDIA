-- Face search ("Find my photos — powered by Bermi AI").
-- Faces are detected and embedded in the browser (staff when indexing, the visitor's own phone when
-- searching). The database only ever holds numeric embeddings of gallery photos; selfie images are
-- never uploaded and search embeddings are not stored. Embeddings use the 1024-dim faceres descriptor.

create extension if not exists vector with schema extensions;

-- ---------- tables ----------
create table public.face_embeddings (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  media_id uuid not null references public.media_items (id) on delete cascade,
  gallery_id uuid not null references public.galleries (id) on delete cascade,
  box jsonb not null default '{}', -- {x,y,w,h} as 0–1 of the photo, ar = width/height
  embedding extensions.vector(1024) not null,
  quality real not null default 0,
  created_at timestamptz not null default now()
);
create index on public.face_embeddings (gallery_id);
create index on public.face_embeddings (media_id);
create index face_embeddings_hnsw on public.face_embeddings using hnsw (embedding extensions.vector_cosine_ops);

-- One row per photo that has been scanned (even with no faces), so re-indexing skips it.
create table public.face_indexed_media (
  media_id uuid primary key references public.media_items (id) on delete cascade,
  gallery_id uuid not null references public.galleries (id) on delete cascade,
  face_count int not null default 0,
  indexed_at timestamptz not null default now()
);
create index on public.face_indexed_media (gallery_id);

-- Internal "People" grouping for staff. Never exposed publicly.
create table public.face_clusters (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries (id) on delete cascade,
  member_ids uuid[] not null default '{}', -- face_embeddings ids
  size int not null default 0,
  cover jsonb not null default '{}', -- {media_id, box}
  created_at timestamptz not null default now()
);
create index on public.face_clusters (gallery_id);

create table public.face_cluster_labels (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null unique references public.face_clusters (id) on delete cascade,
  label text not null default '',
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.face_search_consents (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries (id) on delete cascade,
  policy_version text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now()
);
create index on public.face_search_consents (gallery_id, created_at);

-- No images and no embeddings: only who-ish (a hashed fingerprint), where, when and how many hits.
create table public.face_search_log (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries (id) on delete cascade,
  fingerprint text not null,
  result_count int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.face_search_log (gallery_id, fingerprint, created_at);

create table public.face_removal_requests (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  gallery_id uuid references public.galleries (id) on delete set null,
  gallery_slug text not null default '',
  name text not null check (length(name) between 1 and 200),
  contact text not null check (length(contact) between 3 and 200),
  reason text not null default '' check (length(reason) <= 2000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'done', 'rejected')),
  created_at timestamptz not null default now()
);

-- ---------- RLS ----------
alter table public.face_embeddings enable row level security;
alter table public.face_indexed_media enable row level security;
alter table public.face_clusters enable row level security;
alter table public.face_cluster_labels enable row level security;
alter table public.face_search_consents enable row level security;
alter table public.face_search_log enable row level security;
alter table public.face_removal_requests enable row level security;

-- Editors may only add embeddings to galleries that have face search switched on.
create policy "cms reads faces" on public.face_embeddings for select to authenticated using (public.is_cms_editor());
create policy "cms deletes faces" on public.face_embeddings for delete to authenticated using (public.is_cms_editor());
create policy "cms indexes faces" on public.face_embeddings for insert to authenticated with check (
  public.is_cms_editor() and exists (select 1 from public.galleries g where g.id = gallery_id and g.face_search_enabled)
);
create policy "cms manages indexed" on public.face_indexed_media for all to authenticated using (public.is_cms_editor()) with check (
  public.is_cms_editor() and exists (select 1 from public.galleries g where g.id = gallery_id and g.face_search_enabled)
);
create policy "cms manages clusters" on public.face_clusters for all to authenticated using (public.is_cms_editor()) with check (public.is_cms_editor());
create policy "cms manages labels" on public.face_cluster_labels for all to authenticated using (public.is_cms_editor()) with check (public.is_cms_editor());

create policy "visitor records consent" on public.face_search_consents for insert to anon, authenticated with check (
  exists (select 1 from public.galleries g where g.id = gallery_id and g.published and g.face_search_enabled)
);
create policy "cms reads consents" on public.face_search_consents for select to authenticated using (public.is_cms_editor());
create policy "cms reads search log" on public.face_search_log for select to authenticated using (public.is_cms_editor());

create policy "anyone requests removal" on public.face_removal_requests for insert to anon, authenticated with check (status = 'new');
create policy "cms manages removals" on public.face_removal_requests for all to authenticated using (public.is_cms_editor()) with check (public.is_cms_editor());

create trigger audit_face_cluster_labels after insert or update or delete on public.face_cluster_labels for each row execute function public.audit_row();
create trigger audit_face_removal_requests after insert or update or delete on public.face_removal_requests for each row execute function public.audit_row();

-- ---------- search ----------
-- Searches ONE gallery. Rate-limited to 20 searches per gallery per hour per hashed client fingerprint.
create or replace function public.face_search(
  p_slug text,
  p_embedding extensions.vector(1024),
  p_threshold float default 0.5,
  p_fingerprint text default '',
  p_pin text default null
)
returns table (id uuid, gallery_id uuid, kind text, url text, thumb_url text, collection text, caption text, sort_order int, similarity float)
language plpgsql volatile security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare
  g public.galleries;
  h text;
  n int;
  thr float := least(0.95, greatest(coalesce(p_threshold, 0.5), 0.35)); -- never a floor low enough to dump the gallery
begin
  select * into g from public.galleries x where x.slug = p_slug and x.published;
  if not found or not g.face_search_enabled or (g.expires_on is not null and g.expires_on < current_date) then
    raise exception 'Face search is not available for this gallery' using errcode = '42501';
  end if;
  if g.access_mode = 'pin' then
    select s.pin_hash into h from public.gallery_secrets s where s.gallery_id = g.id;
    if p_pin is null or h is null or crypt(p_pin, h) <> h then
      raise exception 'Wrong PIN' using errcode = '28000';
    end if;
  end if;
  if p_fingerprint is null or length(p_fingerprint) < 16 or length(p_fingerprint) > 128 then
    raise exception 'Missing client fingerprint' using errcode = '22023';
  end if;
  select count(*) into n from public.face_search_log l
    where l.gallery_id = g.id and l.fingerprint = p_fingerprint and l.created_at > now() - interval '1 hour';
  if n >= 20 then
    raise exception 'Too many searches. Please try again in an hour.' using errcode = '54000';
  end if;

  return query
    with hits as (
      select f.media_id, max(1 - (f.embedding <=> p_embedding)) as sim
      from public.face_embeddings f
      where f.gallery_id = g.id
      group by f.media_id
    )
    select m.id, m.gallery_id, m.kind, m.url, m.thumb_url, m.collection, m.caption, m.sort_order, hits.sim::float
    from hits join public.media_items m on m.id = hits.media_id
    where hits.sim >= thr
    order by hits.sim desc
    limit 200;
  get diagnostics n = row_count;
  insert into public.face_search_log (gallery_id, fingerprint, result_count) values (g.id, p_fingerprint, n);
end;
$$;
revoke all on function public.face_search(text, extensions.vector, float, text, text) from public;
grant execute on function public.face_search(text, extensions.vector, float, text, text) to anon, authenticated;

-- Switching face search off deletes the gallery's face data straight away.
create or replace function public.drop_faces_when_disabled()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.face_search_enabled and not new.face_search_enabled then
    delete from public.face_embeddings where gallery_id = new.id;
    delete from public.face_indexed_media where gallery_id = new.id;
    delete from public.face_clusters where gallery_id = new.id;
  end if;
  return new;
end;
$$;
create trigger galleries_drop_faces after update of face_search_enabled on public.galleries
  for each row execute function public.drop_faces_when_disabled();

-- ---------- retention ----------
-- Deletes face data for galleries that expired more than 30 days ago, and old search logs.
create or replace function public.purge_expired_face_data()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.face_embeddings f using public.galleries g
    where g.id = f.gallery_id and g.expires_on is not null and g.expires_on < current_date - 30;
  get diagnostics n = row_count;
  delete from public.face_indexed_media f using public.galleries g
    where g.id = f.gallery_id and g.expires_on is not null and g.expires_on < current_date - 30;
  delete from public.face_clusters f using public.galleries g
    where g.id = f.gallery_id and g.expires_on is not null and g.expires_on < current_date - 30;
  delete from public.face_search_log where created_at < now() - interval '90 days';
  return n;
end;
$$;
revoke all on function public.purge_expired_face_data() from public, anon, authenticated;

-- Run nightly when pg_cron is available (Supabase: enable it under Database → Extensions).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purge-expired-face-data', '17 2 * * *', 'select public.purge_expired_face_data()');
  end if;
end $$;
