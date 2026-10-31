// Returns a short-lived presigned PUT URL for any S3-compatible bucket (Cloudflare R2, Backblaze B2, MinIO).
// Secrets are set with `supabase secrets set` and never reach the browser:
//   S3_ENDPOINT (e.g. https://<account>.r2.cloudflarestorage.com), S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION (R2: auto)
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: ok, error } = await supabase.rpc('is_cms_editor');
    if (error || !ok) return json({ error: 'Not allowed' }, 403);

    const { path, contentType } = await req.json();
    if (typeof path !== 'string' || !/^[a-z0-9][a-z0-9/_.-]{2,200}$/.test(path) || path.includes('..')) return json({ error: 'Bad path' }, 400);

    const s3 = new AwsClient({
      accessKeyId: Deno.env.get('S3_ACCESS_KEY_ID')!,
      secretAccessKey: Deno.env.get('S3_SECRET_ACCESS_KEY')!,
      region: Deno.env.get('S3_REGION') ?? 'auto',
      service: 's3',
    });
    const url = new URL(`${Deno.env.get('S3_ENDPOINT')}/${Deno.env.get('S3_BUCKET')}/${path}`);
    url.searchParams.set('X-Amz-Expires', '900');
    const signed = await s3.sign(new Request(url, { method: 'PUT', headers: { 'Content-Type': contentType ?? 'application/octet-stream' } }), { aws: { signQuery: true } });
    return json({ url: signed.url });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
