// Concatenates every migration into supabase/setup.sql so a fresh project can be set up by pasting
// one file into Supabase → SQL Editor. Usage: npm run db:setup
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = 'supabase/migrations';
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
let out = `-- Basil Media OS · complete database setup (generated from ${files.length} migrations).\n-- Paste into Supabase → SQL Editor on an EMPTY project and press Run.\n\n`;
for (const f of files) out += `-- ===================== ${f} =====================\n${readFileSync(`${dir}/${f}`, 'utf8').trim()}\n\n`;
writeFileSync('supabase/setup.sql', out);
console.log(`wrote supabase/setup.sql from: ${files.join(', ')}`);
