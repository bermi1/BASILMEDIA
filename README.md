# Basil Media OS

The Basil Media public website, its Website CMS, and the foundation of the Basil Media OS (`/os`).
Built from the *Basil Media OS* design (blue & white brand, Plus Jakarta Sans + DM Sans).

**Stack:** React + Vite + TypeScript + Tailwind + Framer Motion · Supabase (Postgres, Auth, RLS, Storage) · optional Cloudflare R2 / any S3 store.
No vendor lock-in: plain SQL migrations, S3 API, static front end.

## What is built (this phase)

| Area | Routes |
|---|---|
| Public website | `/` home (3D particle hero, partner marquee, gap-free featured mosaic, in-page reels, stats, testimonials, horizontal booking form), `/services`, `/our-work` (filters + video modal), `/about`, `/contact` (form + map), `/health-news` + `/health-news/:id`, `/subscribe`, `/g/:slug` client gallery (collections, grid/strip, favourites & album selection, lightbox, PIN access, share), `/find-me`, `/privacy`, `/privacy/face-search` |
| Sign-in | `/login` — email + password, first account becomes Super Admin, portal chooser by role |
| Website CMS | `/os/website` — site settings (tagline, hero picture, logos, about, mission/vision, company-profile PDF, contacts, socials, stats), projects, services, highlights (reels), partners, team, testimonials, galleries (bulk photo/video upload into collections, cover, QR code), health news, opportunities, events, bookings (status pipeline, CSV export), subscribers (CSV export) |

Every list item has **Edit (Save / Cancel)**, **Delete**, publish/hide and reorder. Pictures and videos are **uploaded**, or a
YouTube / Vimeo / Instagram link is pasted; videos play inside the page (Instagram's profile bar, caption and comments are cropped away).

Later phases from the master prompt (finance & approvals, passkeys & e-signature, projects, staff portal, store, retainers,
Share Studio, face search, audience engine…) plug into the same `/os` shell, roles and audit log.

## Run locally

```bash
npm install
npm run dev
```

With no `.env`, the app runs in **demo mode**: content and accounts live in your browser (localStorage) so you can try the site
and the CMS immediately. Go to `/login`, choose *Create the first account* — it becomes Super Admin — then open the Website CMS.

## Connect Supabase (free tier or self-hosted)

1. Create a Supabase project (or run self-hosted Supabase with Docker on a VPS — same code).
2. Run the migrations in order (`supabase/migrations/0001…0003`) — either with the Supabase CLI:
   ```bash
   supabase link --project-ref <your-ref>
   supabase db push
   ```
   or by pasting each file into **SQL Editor** in the dashboard, or with `psql "$DATABASE_URL" -f <file>`.
3. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` (`https://<ref>.supabase.co`) and `VITE_SUPABASE_ANON_KEY`
   (Dashboard → Project Settings → API → *anon public* key). **Never put the database password or service-role key in `.env` for the front end.**
4. Sign up at `/login` — the first account becomes Super Admin (database trigger). In Supabase → Authentication you may turn email confirmation on or off.
5. Give other people roles by inserting into `user_roles` (a roles screen arrives with Phase 1):
   ```sql
   insert into user_roles (user_id, role) select id, 'growth' from auth.users where email = 'someone@basilmedia.co.tz';
   ```
   Website CMS roles: `super_admin`, `gm_cfo`, `growth`.

## Storage

- `VITE_STORAGE_DRIVER=supabase` (default): uploads go to the public `media` bucket created by migration 0002.
- `VITE_STORAGE_DRIVER=s3`: uploads go straight from the browser to **Cloudflare R2** (no egress fees) or any S3-compatible store
  via a presigned URL from `supabase/functions/storage-presign`. Deploy it and set its secrets:
  ```bash
  supabase functions deploy storage-presign
  supabase secrets set S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com S3_BUCKET=basil-media S3_ACCESS_KEY_ID=… S3_SECRET_ACCESS_KEY=… S3_REGION=auto
  ```
  Set `VITE_STORAGE_PUBLIC_URL` to the bucket's public domain and allow `PUT` from your site in the bucket's CORS rules.

## Deploy for free

```bash
npm run build
```
Deploy `dist/` to Cloudflare Pages (build command `npm run build`, output `dist`) or Vercel. `public/_redirects` sends every route to
`index.html` for client-side routing. Add the two `VITE_` variables in the host's environment settings.

## Move to your own server later

Run self-hosted Supabase (Docker) on a VPS, apply the same migrations, restore data with `pg_dump`/`pg_restore`, copy the bucket with
`rclone`, and change the two `VITE_SUPABASE_*` variables. Nothing else changes.

## Back up

```bash
pg_dump "$DATABASE_URL" -Fc -f basil-$(date +%F).dump
rclone sync r2:basil-media ./backup/media
```

## Security model

- Roles in `user_roles` (never on profiles), checked by the security-definer `has_role()` / `is_cms_editor()` functions.
- Row Level Security on every table. Visitors can only *insert* bookings and subscriptions (never read them back).
- Gallery PINs are bcrypt-hashed into a private `gallery_secrets` table; media is served through the `gallery_media()` function,
  which checks access mode, expiry and PIN.
- Testimonial person names are not readable by anonymous visitors.
- Every content edit, role change, booking and subscriber change writes an immutable row to `audit_log`.
- Subscriber consent is stored (Tanzania Personal Data Protection Act, 2022). **Have a lawyer confirm the final privacy and consent wording.**

## Editing starter content

Starter content lives in `src/lib/seed.ts`. After changing it, regenerate the SQL seed with `npm run seed:sql`.
