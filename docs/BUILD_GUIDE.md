# Basil Media OS — build guide for modules

Read this before adding a module. The master spec is the "Basil Media OS" prompt (Parts B–X); the visual
reference is the Basil Media design (blue `#0F6EC2`, deep blue `#0A2F5C`, ice `#EAF3FC`, white;
Plus Jakarta Sans headings, DM Sans body). British English, TSH, DD/MM/YYYY, Africa/Dar_es_Salaam.
Always write "Basil Media". Use "tier"/"retainer", never "package".

## Where things live

| What | Path |
|---|---|
| Desktop module (sidebar group + routes under `/os`) | `src/os/modules/<module>/index.tsx` exporting `<module>Module: OsModule` (see `src/os/modules/types.ts`) |
| Module pages/components | `src/os/modules/<module>/**` — only touch your own folder |
| Phone app for a role (4 tabs + automatic "More") | `src/app/roles/<role>.tsx` exporting `app: PhoneRoleApp` |
| Screens shared with other roles' phone apps | `src/os/modules/<module>/phone.tsx` (keep the exported names stable) |
| Demo seed data | inside your module, registered with `registerSeed(table, () => rows)` from `src/os/lib/store.ts` — import the seed file from your `index.tsx` **and** your `phone.tsx` so it is registered whichever loads first |
| SQL | a new file `supabase/migrations/00NN_<module>.sql` (never edit 0001–0004) |

## Data

Use `src/os/lib/store.ts`: `useTable(table, { eq, in, order, ascending, limit })`, `insertRow`, `updateRow`,
`deleteRow`, and `rpc(name, args, demoImpl)` for workflow steps. With Supabase configured these hit Postgres;
without it a browser demo store is used, so **every screen must work in demo mode** with realistic seeded
Tanzanian data (hospital, bank, university clients; TSH amounts; Dar es Salaam places; a mix of on-track,
at-risk and late items; approvals pending at every step).

Demo people (ids used for assignees/requesters in seeds): `u-boss` Emmanuel Basil (Boss), `u-gm` Saul Mwakyusa
(GM/CFO), `u-fin` Grace Mushi (Finance), `u-enock` Enock Mallya (Project Lead), `u-jonathan` Jonathan Kimaro
(Staff), `u-benedicto` Benedicto Ngowi (Staff/Lead), `u-store` Juma Said (Storekeeper), `u-rehema` Rehema Juma
(Reception), `u-driver` Hamisi Omary (Driver), `u-growth` Neema Lyimo (Growth/Account Manager), `u-client`
Dr Amina Juma (Client). `usePeople()` returns them (or the real staff directory).

Who is acting: `useActing()` from `src/os/lib/session.tsx` → `{ role, userId, can(...roles), canAny(...roles) }`.
Notify people with `notify(userId, title, body, link, kind)` from `src/os/lib/notify.ts` (demo) — in SQL use
`public.notify(...)` / `public.notify_role(...)` inside your workflow functions.

## SQL rules (non-negotiable)

- Tables in `public`, `id uuid primary key default gen_random_uuid()`, `division_id text not null default 'basil-media' references public.divisions(id)` on business records, `created_at timestamptz default now()`.
- `alter table … enable row level security` on **every** table, with policies using `public.has_role(auth.uid(), '<role>')` / `public.has_any_role(auth.uid(), array[...]::public.app_role[])`. Super Admin passes automatically.
- Attach `public.audit_row()` as an after insert/update/delete trigger on every money, approval, stock and people table.
- Workflow transitions are `security definer` SQL functions that check the caller's role **and segregation of duties**
  (requester ≠ approver; approver ≠ payer; Finance cannot approve). Enforce in the database, not just the UI.
- Settings come from `public.app_settings` (e.g. `approval_limits`, `vat_rate`, `statutory_rates`) — never hardcode.
- Column/user ids: reference `auth.users(id)` for people.
- Table names must match what the front end uses in `useTable(...)`.

## UI rules

Use the kit in `src/os/ui.tsx` (`StageTracker`, `Pill`, `Stat`, `Card`, `Empty`, `Progress`, `Sheet`, `Field`,
`inputCls`, `Avatar`, `Tabs`, `tsh`, `tshShort`), `PageTitle` from `src/os/OsLayout.tsx`, `useToast` from
`src/os/cms/toast.tsx`, Tailwind brand classes (`bg-basil`, `text-basil-muted`, `border-basil-line`, `btn-primary`,
`btn-outline`, `card`, `kicker`), and `lucide-react` icons. Status colours: green on track/approved, amber
pending/at risk, red late/overdue/rejected, blue information. Every important record shows a `StageTracker`.
Phone screens are mobile-first (390 px wide), touch targets ≥ 44 px, no horizontal scroll, real `<button>`s and
`<label>`s. Desktop pages must also work at phone width. No new npm dependencies.

## Check before you finish

```bash
npx tsc -b && npx vite build
```
