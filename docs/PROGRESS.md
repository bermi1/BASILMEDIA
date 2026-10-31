# Basil Media OS — progress against the master prompt

✅ done and tested in the browser (demo data) · 🟡 partly done · ⬜ not started yet.
"Tested" means every screen was opened in a real browser at phone (390 px) and desktop (1440 px) width with no
errors and no sideways scrolling, and the full database script was run on an empty Postgres with smoke tests.

## Part A / R — Public website
| Item | Status |
|---|---|
| Home: hero with rotating team/office photos or hero video (CMS), short headline, Trusted-by logos, "who we are", work at a glance (Instagram reels), services grid, testimonials, full-inquiry booking form | ✅ |
| Services (grid + detail sheet with video), Our Work (grouped by category, filter tabs, Instagram/Pixieset aware player), About (team photo cards with blue overlay), Contact (one phone screen: WhatsApp/Call/Email/Directions, form sheet, map) | ✅ |
| Health News + story pages, Subscribe (double opt-in fields, consent), Opportunities, CPD calendar (.ics) | ✅ |
| Client galleries `/g/:slug` (collections, favourites/album limit, lightbox, PIN, share, QR), Find my photos (all galleries; consent + camera; "Powered by Bermi AI") | ✅ / 🟡 face matching itself (Phase 5) |
| Phone-native: bottom tab bar, floating glass header, page transitions, footer only on the landing page on phones; EN/SW switch for menus | ✅ / 🟡 page content is English only |
| Real office (2 Mataka Street, Upanga) · "Designed & powered by Bermi Techs" · SPA rewrites so refresh never 404s | ✅ |
| Website CMS `/os/website`: every text, picture, video link, logo, partner, team photo, gallery photo, news item editable; uploads to storage | ✅ |
| 3D/WebGL hero, Ask Basil concierge, smart matcher, voice navigation | ⬜ |

## Part 1 / U — Accounts, roles, security
| Item | Status |
|---|---|
| One login, role-based portals, first account = Super Admin, Users & roles admin, roles in `user_roles` with `has_role()` | ✅ |
| Row-level security on all 93 tables; segregation of duties in SQL (requester ≠ approver ≠ payer); immutable audit log | ✅ |
| Boss approval step-up (PIN / device passkey) | 🟡 checked on the device, recorded in the database |
| Passkey sign-in, 2FA, e-signature studio with certificates | ⬜ (deal-room typed-name signing only) |

## Parts B, C, W — Finance & approvals
| Item | Status |
|---|---|
| Money requests with budget lines, GM/CFO review → Boss approval (swipe cards, batch) → Finance pay → retire receipts → reconcile | ✅ |
| Quotations, invoices with instalments, payments, receipts, printable A4 letterhead; income & expenses; finance overview, aged receivables, project profitability | ✅ |
| Payroll run with editable statutory rates (PAYE/NSSF/WCF/SDL) and payslips for staff | ✅ |
| WhatsApp/SMS push, cash-flow forecast, month-end lock, bank reconciliation import, payment gateway | ⬜ |

## Parts D, E, I, V — Projects, production, people
| Item | Status |
|---|---|
| Projects from templates, Kanban with stage gates, project page, tasks, shoots & call sheets (WhatsApp/print), crew calendar with clashes, post-production tracker, footage safety (2 verified copies) | ✅ |
| Staff portal: weekly reports, anonymous suggestion box, leave, clock in/out, announcements, directory | ✅ |

## Parts G, T — Store & office operations
| Item | Status |
|---|---|
| Gear register with QR labels, check-out/in with kits, who-has-it board, reservations, maintenance & incidents, consumables, stock-take, rentals, ROI & depreciation | ✅ |
| Reception (visitors, pre-registration, parcels, rooms), transport (trips, fuel, vehicle issues) | ✅ |

## Parts F, H, S, X — Boss, growth, Share Studio, retainers
| Item | Status |
|---|---|
| Boss cockpit, Monday briefing (auto "three things"), scoreboard, decision log | ✅ |
| CRM pipeline, website bookings inbox, proposals, contracts with instalments, tenders, events, subscribers | ✅ |
| Reference library, showcases (`/s/:slug`), lead signals, deal rooms (`/d/:token`) with signing | ✅ |
| Retainer programme: allowance ledger, year calendar, who-is-coming, shoot sign-off, client requests, concerns, client phone app | ✅ |

## Phone apps (`/app`, installable) — one per role, 5-tab bottom bar
Boss · GM/CFO · Finance · Project Lead · Staff · Storekeeper · Reception · Driver · Growth/Account Manager · Client — ✅ all open and every tab tested.

## Not started (later phases)
Bulk SMS/email/WhatsApp campaigns (Part L), sector network (M), AI layer (N), face search (Q), R2 image pipeline &
ZIP downloads (P), cost guard. The database, roles and module registry are ready for them.

## Go-live checklist
1. Supabase → SQL Editor → paste `supabase/setup.sql` → Run (creates every table, rule and the starter content).
2. Create the role accounts: `SUPABASE_URL=… SUPABASE_SECRET_KEY=… SUPABASE_PUBLISHABLE_KEY=… npm run accounts` → passwords in `accounts.local.txt`.
3. Deploy (Vercel or Cloudflare Pages): build `npm run build`, output `dist`, env `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (publishable key).
4. In the CMS: upload hero photos, partner logos, team photos, testimonials, and paste Instagram reel links into projects and highlights.
