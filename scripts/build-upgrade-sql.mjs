// Builds supabase/upgrade.sql: every migration from 0011 on, made safe to run on a database that
// already has the earlier setup (and safe to run twice). Paste it into Supabase → SQL Editor.
// Usage: npm run db:upgrade
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const FROM = '0011';
const dir = 'supabase/migrations';
const files = readdirSync(dir).filter((f) => f.endsWith('.sql') && f >= FROM).sort();
const safe = (sql) =>
  sql
    .replace(/create table (public\.\w+)/g, 'create table if not exists $1')
    .replace(/create (unique )?index (?!if not exists)(?!on )(\w+) on/g, 'create $1index if not exists $2 on')
    .replace(/create policy ("[^"]+") on (public\.\w+)/g, 'drop policy if exists $1 on $2;\ncreate policy $1 on $2')
    .replace(/create trigger (\w+)(\s+(?:before|after)[\s\S]*?\son\s+)(public\.\w+)/g, 'drop trigger if exists $1 on $3;\ncreate trigger $1$2$3')
    // unnamed indexes would be duplicated on a re-run: only create them when the table is new
    .replace(/^create index on (public\.\w+) \(([^)]*)\);$/gm, (_m, t, cols) =>
      `do $$ begin if not exists (select 1 from pg_indexes where schemaname = 'public' and tablename = '${t.split('.')[1]}' and indexdef like '%(${cols.replace(/'/g, "''")})%') then create index on ${t} (${cols}); end if; end $$;`);
let out = `-- Basil Media OS · UPGRADE for a database that already ran supabase/setup.sql before.\n-- Safe to run more than once. Contains: ${files.join(', ')}\n\n`;
for (const f of files) out += `-- ===================== ${f} =====================\n${safe(readFileSync(`${dir}/${f}`, 'utf8').trim())}\n\n`;
writeFileSync('supabase/upgrade.sql', out);
console.log(`wrote supabase/upgrade.sql from: ${files.join(', ')}`);
