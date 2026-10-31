// Fetch the live health news by hand (or from any server's cron):
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/news-ingest.mjs
import { ingest } from '../api/_news-core.mjs';

const report = await ingest({ url: process.env.SUPABASE_URL, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY });
for (const r of report) console.log(`${r.error ? '✗' : '✓'} ${r.source.padEnd(28)} ${String(r.kept).padStart(3)} items ${r.error}`);
