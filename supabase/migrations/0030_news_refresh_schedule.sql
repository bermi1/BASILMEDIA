-- Basil Media OS · 0030 keep the health news fresh every 2 hours, even with no visitors.
-- Supabase's scheduler (pg_cron) calls the site's /api/news-ingest. That endpoint runs at most once per
-- 2 hours for unauthenticated calls, so no secret is stored here. Stories older than 72 hours are deleted
-- on every run. If the extensions are not available (e.g. plain Postgres), this step is skipped.
do $$
begin
  create extension if not exists pg_net;
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'basil-news-refresh';
  perform cron.schedule('basil-news-refresh', '7 */2 * * *',
    $job$ select net.http_get('https://basilmedia.vercel.app/api/news-ingest', headers := '{"User-Agent":"BasilMedia-Scheduler"}'::jsonb) $job$);
  -- and a database-side clean-up, in case the site is unreachable
  perform cron.unschedule(jobid) from cron.job where jobname = 'basil-news-expire';
  perform cron.schedule('basil-news-expire', '17 * * * *',
    $job$ delete from public.health_feed_items where published_at < now() - interval '72 hours' $job$);
exception when others then
  raise notice 'News schedule not created (%). The site still refreshes news when visitors open it.', sqlerrm;
end $$;
