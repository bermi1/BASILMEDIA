-- Basil Media OS · 0015 proposals as a simple log.
-- Proposals are written outside the app (Word/PDF). The app only records that one was sent, to whom,
-- for how much, the file, and where it stands: Sent → Working on it → Interested → Won / Lost.
alter table public.proposals
  add column if not exists stage text not null default 'Sent',
  add column if not exists amount numeric(14, 2) not null default 0,
  add column if not exists file_url text not null default '',
  add column if not exists note text not null default '',
  add column if not exists stage_at timestamptz not null default now();
do $$ begin
  alter table public.proposals add constraint proposals_stage_check check (stage in ('Sent', 'Working on it', 'Interested', 'Won', 'Lost'));
exception when duplicate_object then null; end $$;
alter table public.proposals alter column number set default ('BM-PRP-' || to_char(now(), 'YYYY') || '-' || upper(substr(md5(random()::text), 1, 5)));
alter table public.proposals alter column status set default 'sent';
alter table public.proposals alter column sent_at set default now();
