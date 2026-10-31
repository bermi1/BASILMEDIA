# Content sources

Real Basil Media content used in `src/lib/seed.ts`, `supabase/migrations/0003_seed_public_content.sql`,
`supabase/migrations/0009_real_content.sql` and `public/media/`. Collected on 31 October 2026.

## Identity: why these sources are Basil Media (Tanzania)

The only online presence we could confirm is the YouTube channel **Basil Media Tz**.

| Evidence | Detail |
| --- | --- |
| Name | Channel title "Basil Media Tz" (the "Tz" is the usual abbreviation for Tanzania). Handle `@basilmediatz`, channel ID `UCgiTsE5v7T6yw8MQ9Tgk5bg`, joined 5 Sep 2021. |
| Logo | Channel avatar is the blue "B / L" monogram with **BASIL MEDIA — Health Education Innovation**, the same blue-and-white mark this site uses. |
| Studio | Podcast thumbnails show a "BTV" badge carrying the same monogram, in a Basil Media studio. |
| Language and places | Videos are in Kiswahili and cover Tanzanian institutions and events: MUHAS (Muhimbili University), Aga Khan Hospital Dar es Salaam, Tanzania Health Summit, UDSM, Medical Association of Tanzania, Paediatric Association of Tanzania (Mwanza), TAMSA. |
| Line of work | Live streams of medical conferences, health podcasts (The Medics, The Pharmacist, Sip & Talk, Unistar Talk) and short documentaries. This matches the health-sector focus of the site (summits, hospitals, universities). |

**Not used (other or unconfirmed accounts):**

- `youtube.com/@basilmedia` ("basilmedia", 65 subscribers) links to `facebook.com/basil.thomas` and has nothing tying it to Tanzania, so it is not ours.
- `tiktok.com/@basilmedia` belongs to an unrelated creator ("Mathew").
- Web searches for "Basil Media" with Tanzania or Dar es Salaam found no website, press coverage or directory listing. Companies with similar names, such as BaselMedia (Switzerland), Basilica Media Centre (Romania) and Basil & Alred (a Dar es Salaam audit firm), are unrelated.

## Sources

### 1. YouTube channel: https://www.youtube.com/@basilmediatz (about, videos, streams, shorts tabs)

- **About text**, used verbatim as `about_story` in site settings: the channel description, which begins "Basil Media is a youth-driven digital media platform dedicated to health education…".
- **YouTube link**: `socials.youtube`.
- **Logo**: the channel avatar, saved as `public/media/basil-media-tz-channel-logo.webp`. It is saved for reference only; the site keeps `/logo.svg`.
- **Video titles and URLs** for projects and highlights are listed below. Thumbnails come from `https://i.ytimg.com/vi/<id>/maxresdefault.jpg` and were converted to WebP at 1280 px wide, quality 80.

| Video | Used as | Image |
| --- | --- | --- |
| https://www.youtube.com/watch?v=em1S7s6k7BI · #LIVE: The 2026 PAT Scientific Conference, 15 July 2026, Mwanza | Project (Corporate) | `/media/pat-scientific-conference-2026-live.webp` |
| https://www.youtube.com/watch?v=3T0PnVtU2Bo · #LIVE: National Medical Congress 2026, UDSM, 17 June 2026 | Project (Corporate) | `/media/national-medical-congress-2026-live.webp` |
| https://www.youtube.com/watch?v=tAXCUSfM5u4 · Kutoka kilo 145 ➝ 75, safari ya Said Shukuru / Aga Khan Hospital DSM | Project (Films) | `/media/said-shukuru-145-to-75-kilo-journey.webp` |
| https://www.youtube.com/watch?v=T_vtw0pTr-g · Historia ya Tanzania Health Summit, Dr Omary Chillo | Project (Podcasts) | `/media/tanzania-health-summit-dr-omary-chillo.webp` |
| https://www.youtube.com/watch?v=EWZAkKlRjXs · Mama Sabrina and her child with sickle cell | Project (Films) | `/media/mama-sabrina-sickle-cell.webp` |
| https://www.youtube.com/watch?v=6PaY6FeT9nQ · Tiba asili, Chuo Kikuu cha Muhimbili | Project (Films) | `/media/muhas-tiba-asili.webp` |
| https://www.youtube.com/watch?v=TCKvCDgxR_o · Afya Fiesta 2025 with TAMSA, The Pharmacist Ep03 | Project (Podcasts) | `/media/the-pharmacist-ep03-afya-fiesta-tamsa.webp` |
| https://www.youtube.com/watch?v=cKksPy5U6-8 · Prof Karim Manji, 37 years at MUHAS | Project (Films) | `/media/prof-karim-manji-muhas.webp` |
| https://www.youtube.com/watch?v=0d5FagVEtdQ · Launch of the first congress of pharmacy professionals in Tanzania | Project (Corporate) | `/media/pharmacy-professionals-congress-launch.webp` |
| https://www.youtube.com/watch?v=ctyRynHmDuo · The Medics Ep 05 | Project (Podcasts) | `/media/the-medics-ep05.webp` |
| https://www.youtube.com/watch?v=2Y-j-_JU-6s · Sip & Talk Ep 04 | Project (Podcasts) | `/media/sip-and-talk-ep04.webp` |
| https://www.youtube.com/watch?v=_1EyWRBbb30 · Unistar Talk Ep02 | Project (Podcasts) | `/media/unistar-talk-ep02.webp` |
| https://www.youtube.com/watch?v=dU3h7hwNt8Q · Fahamu kuhusu uwekezaji wa hisa | Project (Films) | `/media/uwekezaji-wa-hisa.webp` |
| https://www.youtube.com/watch?v=CqO0Z2ee144 · Safari ya kwenda mwezini | Project (Films) | `/media/safari-ya-kwenda-mwezini.webp` |
| https://www.youtube.com/shorts/Z_Am6jJOZrc · Studio short, 6 February 2025 | Highlight, also used as the About image | `/media/basil-media-studio-btv.webp` |
| https://www.youtube.com/watch?v=UA6Ip24aIRo · Mainjinia wanaofanya kazi hospitalini | Highlight | `/media/hospital-engineers.webp` |
| https://www.youtube.com/watch?v=vmlEFNrpl0g · Mtambo wa kisasa wa matibabu ya moyo | Highlight | `/media/modern-heart-treatment-machine.webp` |
| https://www.youtube.com/watch?v=WkFwnOZ89e0 · The Tranquilty (published spelling) | Highlight, shown as "The Tranquility" | `/media/the-tranquility.webp` |

Project descriptions are based only on each video's title and thumbnail text, such as dates, venues and themes. For example, "PAT" is the Paediatric Association of Tanzania and "MAT" is the Medical Association of Tanzania, as printed on the thumbnails. The `client` field names the organisation or event that the video is about. It does **not** confirm a paid client relationship.

## Not found or not reachable, so left unchanged in the seed

- **Website**: none found. `basilmedia.co.tz` and `basilmedia.com` do not resolve from here (proxy 502).
- **Instagram and Facebook** (`basilmediatz`, `basil_media_tz`, `basilmedia_tz`): pages require login, so we could not confirm that they exist or belong to Basil Media. Their URLs stay as placeholders.
- **TikTok, LinkedIn and X**: no confirmed account (`@basilmediatz` on X returns 404, and LinkedIn blocks anonymous access).
- **Contact email, phone and address**: not published on the YouTube channel, so the existing values were kept. *Please confirm them.*
- **Mission and vision**: not published as such, so the existing text was kept.
- **Partners**: no partner list is published, so the existing partner list was kept. Institutions that appear in the videos (MUHAS, Aga Khan Hospital, MAT, PAT, TAMSA, Tanzania Health Summit) could be added once the owner confirms the relationship.
- **Team, testimonials, services, stats**: nothing published, so these were unchanged.
- **Video descriptions**: YouTube rate-limited the watch pages, so only titles, thumbnails and oEmbed metadata were used.
