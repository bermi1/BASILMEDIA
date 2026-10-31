// Default site settings, and the starter public content mirrored by
// supabase/migrations/0003_seed_public_content.sql. Everything here is editable in the CMS.
import type {
  EventItem, Gallery, Highlight, MediaItem, NewsStory, Opportunity, Partner, Project,
  Service, SiteSettings, Tables, TeamMember, Testimonial,
} from './types';

export const DEFAULT_SETTINGS: SiteSettings = {
  id: 'site',
  tagline: "We Don't Just Capture Moments —",
  tagline_highlight: 'We Create Them.',
  hero_kicker: 'VIDEO · PHOTOGRAPHY · PODCAST · LIVE STREAMING — DAR ES SALAAM',
  hero_subtitle: 'Films, photos, podcasts and live streams from Dar es Salaam.',
  hero_image_url: '',
  hero_video_url: '',
  // Team, office and studio photos uploaded in the CMS (Site settings → Hero photos).
  hero_images: [],
  office_hours: 'Mon–Fri 08:30–17:30 · Sat 09:00–13:00',
  home_about_title: 'Pioneering health, innovation and youth empowerment — one story at a time.',
  home_about_text: 'Basil Media is a Dar es Salaam studio telling the stories that move Tanzania forward: the clinicians, innovators and young people shaping what comes next.',
  logo_url: '/logo.svg',
  logo_reverse_url: '/logo-reverse.svg',
  // Published text: the "About" description of the Basil Media Tz YouTube channel
  // (https://www.youtube.com/@basilmediatz/about). See docs/CONTENT_SOURCES.md.
  about_story:
    'Basil Media is a youth-driven digital media platform dedicated to health education, innovation, and impactful storytelling. We exist to inform, inspire, and empower young people with reliable health information, creative ideas, and forward-thinking solutions that shape a healthier future.\n\nThrough engaging content, expert conversations, and real-life stories, Basil Media bridges the gap between medical knowledge, innovation, and the everyday lives of young people. Our focus spans health awareness, mental well-being, medical education, technology, entrepreneurship, and youth-led innovation.\n\nWe collaborate with healthcare professionals, institutions, innovators, and young change-makers to deliver content that is educational, relatable, and transformative.\n\nAt Basil Media, we believe the youth are not just the leaders of tomorrow—but the innovators of today. Learn. Innovate. Inspire.',
  about_image_url: '/media/basil-media-studio-btv.webp',
  mission:
    'To tell the stories of Tanzanian institutions and people with honesty, craft and care, and to deliver every frame on time.',
  vision: 'To be East Africa’s most trusted media house: the studio institutions call when the moment matters.',
  company_profile_url: '',
  contact_email: 'hello@basilmedia.co.tz',
  phone: '+255 700 000 000',
  whatsapp: '+255700000000',
  address: '2 Mataka Street, Upanga, Dar es Salaam, Tanzania',
  map_embed_url: '',
  footer_about:
    'Video, photography, podcasts and live streaming from Dar es Salaam — delivered through our own studio platform.',
  socials: {
    instagram: 'https://instagram.com/',
    youtube: 'https://www.youtube.com/@basilmediatz',
    facebook: 'https://facebook.com/',
    linkedin: 'https://linkedin.com/',
    tiktok: 'https://tiktok.com/',
    x: 'https://x.com/',
  },
  stats: [
    { value: 250, suffix: '+', label: 'projects delivered' },
    { value: 60, suffix: '+', label: 'clients' },
    { value: 6, label: 'years' },
    { value: 4, label: 'awards' },
  ],
  live_ticker: 'Gallery delivered · Tanzania Health Summit · 2,431 photos',
  services_mega_image_url: '',
};

let n = 0;
const id = (p: string) => `${p}-${++n}`;

const SV: [string, string, string, string[]][] = [
  ['Video Production', 'Films, documentaries and campaign spots.', 'Documentaries, corporate films and campaign spots, from script and casting to colour grade and subtitles in English and Kiswahili.', ['Script & storyboard', 'Shoot crew', 'Edit & colour', 'Subtitles EN / SW']],
  ['Photography', 'Events, portraits and private client galleries.', 'Events, portraits and product photography delivered in private galleries with selfie Find Me, favourites and HD downloads.', ['Event coverage', 'Private gallery', 'Find Me by selfie', 'QR poster']],
  ['Podcast Production', 'Studio and remote series, video and audio.', 'Video and audio podcasts, recorded in studio or on location, edited and published to every platform.', ['Studio recording', 'Multi-camera', 'Clips for social', 'Publishing']],
  ['Live Streaming', 'Multi-camera summits, launches, graduations.', 'Multi-camera live streams for summits, launches and graduations, with graphics and a highlights film after.', ['Multi-camera switch', 'Lower thirds', 'Stream to any platform', 'Highlights film']],
  ['Brand Storytelling', 'The story behind your organisation, told well.', 'The people and purpose behind your organisation, told in film, photo and words.', ['Story workshop', 'Interviews', 'Hero film', 'Photo essay']],
  ['Corporate Content', 'Monthly content for social, web and internal use.', 'A monthly retainer: a year calendar of shoots and posts, approvals in your portal, and a report every month.', ['Year calendar', 'Monthly allowance', 'Post approvals', 'Monthly report']],
];
const ICONS = ['video', 'camera', 'mic', 'radio', 'sparkles', 'briefcase'];

export const SEED_SERVICES: Service[] = SV.map(([title, short, description, deliverables], i) => ({
  id: id('svc'), title, slug: title.toLowerCase().replace(/[^a-z]+/g, '-'), short, description, deliverables,
  icon: ICONS[i], image_url: '', video_url: '', sort_order: i + 1, published: true,
}));

// Real Basil Media productions (titles and cover stills). Videos are published on Instagram:
// paste each reel link into the project in the CMS and it plays inside the page.
// Titles are the published video titles; "client" is the organisation or event named in the video
// title or thumbnail (the subject of the production), not a confirmed commercial contract.
// Sources and evidence: docs/CONTENT_SOURCES.md.
const PJ: [string, Project['category'], string, string, string, string][] = [
  ['#LIVE: The 2026 PAT Scientific Conference — Mwanza', 'Corporate', 'Paediatric Association of Tanzania (PAT)', 'em1S7s6k7BI', 'pat-scientific-conference-2026-live',
    'Live stream of the 2026 PAT Scientific Conference, 15 July 2026, Malaika Beach Resort, Mwanza. Theme: “Resilient Health Systems for Every Child: Innovation, Equity and Quality of Care”.'],
  ['#LIVE: National Medical Congress 2026 — UDSM', 'Corporate', 'Medical Association of Tanzania (MAT)', '3T0PnVtU2Bo', 'national-medical-congress-2026-live',
    'Live stream of the National Medical Congress 2026 presented by the Medical Association of Tanzania, 17 June 2026, UDSM, Dar es Salaam. Theme: “Tanzania Vision 2050: The Healthcare We Want”.'],
  ['Kutoka kilo 145 ➝ 75: safari ya Said Shukuru', 'Films & Documentaries', 'Aga Khan Hospital, Dar es Salaam', 'tAXCUSfM5u4', 'said-shukuru-145-to-75-kilo-journey',
    'Said Shukuru’s journey from 145 kg to 75 kg — a real-life health story connected to Aga Khan Hospital, Dar es Salaam.'],
  ['Sikiliza historia ya Tanzania Health Summit — Dr Omary Chillo', 'Podcasts', 'Tanzania Health Summit', 'T_vtw0pTr-g', 'tanzania-health-summit-dr-omary-chillo',
    'Dr Omary Chillo on the history of the Tanzania Health Summit, its achievements and its challenges.'],
  ['Inasisimua: Mama Sabrina na mwanae mwenye sickle cell', 'Films & Documentaries', 'Basil Media', 'EWZAkKlRjXs', 'mama-sabrina-sickle-cell',
    'The story of Mama Sabrina and how she fights for her child living with sickle cell disease.'],
  ['Fahamu kuhusu tiba asili — Chuo Kikuu cha Muhimbili', 'Films & Documentaries', 'Muhimbili University of Health and Allied Sciences (MUHAS)', '6PaY6FeT9nQ', 'muhas-tiba-asili',
    'Traditional medicine explained, from Muhimbili University of Health and Allied Sciences.'],
  ['The Pharmacist — Ep 03: Afya Fiesta 2025 with TAMSA', 'Podcasts', 'TAMSA', 'TCKvCDgxR_o', 'the-pharmacist-ep03-afya-fiesta-tamsa',
    'Episode 3 of The Pharmacist, recorded in the Basil Media (BTV) studio: Afya Fiesta 2025 with TAMSA.'],
  ['Prof Karim Manji — niko MUHAS kwa mwaka wa 37', 'Films & Documentaries', 'Muhimbili University of Health and Allied Sciences (MUHAS)', 'cKksPy5U6-8', 'prof-karim-manji-muhas',
    'Prof Karim Manji on 37 years at MUHAS.'],
  ['Uzinduzi wa kongamano la kwanza la wanataaluma wa famasi Tanzania', 'Corporate', 'Basil Media', '0d5FagVEtdQ', 'pharmacy-professionals-congress-launch',
    'The launch of the first congress of pharmacy professionals in Tanzania.'],
  ['The Medics — Ep 05: Vifo vyenye utata', 'Podcasts', 'Basil Media', 'ctyRynHmDuo', 'the-medics-ep05',
    'Episode 5 of The Medics, a Basil Media health talk show.'],
  ['Sip & Talk — Ep 04: Namna ya kuondokana na msongo wa mawazo', 'Podcasts', 'Basil Media', '2Y-j-_JU-6s', 'sip-and-talk-ep04',
    'Episode 4 of Sip & Talk: how to overcome stress.'],
  ['Unistar Talk — Ep 02', 'Podcasts', 'Basil Media', '_1EyWRBbb30', 'unistar-talk-ep02',
    'Episode 2 of Unistar Talk, recorded in the Basil Media (BTV) studio.'],
  ['Fahamu kuhusu uwekezaji wa hisa', 'Films & Documentaries', 'Basil Media', 'dU3h7hwNt8Q', 'uwekezaji-wa-hisa',
    'An explainer on investing in shares — one of the most-watched videos on the Basil Media Tz channel.'],
  ['Mambo usiyoyafahamu kuhusu safari ya kwenda mwezini', 'Films & Documentaries', 'Basil Media', 'CqO0Z2ee144', 'safari-ya-kwenda-mwezini',
    'What you did not know about the journey to the moon — a science explainer.'],
];
export const SEED_PROJECTS: Project[] = [
  ...PJ.map(([title, category, client, , img, description], i): Project => ({
    id: id('prj'), title, category, client, image_url: `/media/${img}.webp`, video_url: '', external_url: '',
    description, featured: i < 6, sort_order: i + 1, published: true,
  })),
  // Placeholders kept until real photo stories are published (no public photo work found yet).
  ...([['Graduation day', 'University of Health Sciences'], ['Delegates of the summit', 'Tanzania Health Summit']] as const).map(
    ([title, client], i): Project => ({
      id: id('prj'), title, category: 'Photo Stories', client, image_url: '', video_url: '', external_url: '',
      description: 'Project summary written in the admin: the brief, what we made, and the result for the client.',
      featured: false, sort_order: PJ.length + i + 1, published: true,
    }),
  ),
];

// Real partner logos are added by the admin (CMS → Partners); none are invented here.
export const SEED_PARTNERS: Partner[] = [];

// Instagram reels for the home page "work at a glance" — added in the CMS (Highlights).
export const SEED_HIGHLIGHTS: Highlight[] = [];

export const SEED_TEAM: TeamMember[] = [
  ['Emmanuel', 'Chief Executive Officer'], ['Saul', 'General Manager & CFO'], ['Benedicto', 'Head of Production'],
  ['Jonathan', 'Director of Photography'], ['Enock', 'Project Lead · Events'], ['Rehema', 'Front Desk & Client Care'],
].map(([name, role], i) => ({ id: id('tm'), name, role, photo_url: '', bio: '', sort_order: i + 1, published: true }));

// Real client quotes are added by the admin (CMS → Testimonials).
export const SEED_TESTIMONIALS: Testimonial[] = [];

const today = new Date();
const plus = (d: number) => new Date(today.getTime() + d * 864e5).toISOString().slice(0, 10);

export const SEED_NEWS: NewsStory[] = [
  ['New national guidelines on antibiotic stewardship for referral hospitals', 'What changes on the ward from next quarter, and the reporting each facility now owes the regulator.', 'Policy', true],
  ['Registration renewals: council deadline moves to 31 December', 'Practitioners renewing licences this year should upload CPD points before the new cut-off.', 'Regulation', false],
  ['Local study: shorter TB regimens hold up in Tanzanian clinics', 'A multi-site trial reports outcomes in line with WHO findings across four regions.', 'Research', false],
  ['Paediatric oncology unit opens second ward', 'Bed capacity doubles, with a family hostel built alongside.', 'Facilities', false],
  ['Nurses’ conference calls for abstracts on community care', 'Submissions close next month; selected papers present in Dodoma.', 'Events', false],
  ['Drug alert: recall of one batch of an oral antibiotic', 'The regulator lists the affected batch number and the return process for pharmacies.', 'Alert', false],
].map(([title, dek, tag, featured], i) => ({
  id: id('news'), title: title as string, dek: dek as string, tag: tag as string, featured: featured as boolean,
  body: `${dek}\n\nFull story text is written and approved by a Basil Media editor in the CMS. Nothing is published without human review.`,
  sector: 'Health', image_url: '', read_minutes: 3 + (i % 3), published: true, published_at: plus(-i * 2),
}));

export const SEED_OPPORTUNITIES: Opportunity[] = [
  ['Consultant Paediatrician', 'Regional Referral Hospital', 'Mwanza', 'Job', 21],
  ['Clinical research fellowship (12 months)', 'Health Research Institute', 'Dar es Salaam', 'Fellowship', 30],
  ['Masters scholarship in public health', 'Bank Foundation', 'Tanzania', 'Scholarship', 45],
  ['Call for abstracts: community nursing', 'Nurses’ Association', 'Dodoma', 'Call for abstracts', 28],
].map(([title, org, location, kind, d]) => ({
  id: id('opp'), title: title as string, org: org as string, location: location as string,
  kind: kind as Opportunity['kind'], closes_on: plus(d as number), link: '', published: true,
}));

export const SEED_EVENTS: EventItem[] = [
  ['Tanzania Health Summit', 'JNICC, Dar es Salaam', 14, '12 CPD points'],
  ['Cardiology update for clinicians', 'Online', 22, '4 CPD points'],
  ['East African Paediatrics Congress', 'Arusha', 40, '16 CPD points'],
  ['Pharmacy practice workshop', 'Dodoma', 55, '6 CPD points'],
  ['Nursing leadership forum', 'Mwanza', 70, '8 CPD points'],
].map(([title, venue, d, cpd]) => ({
  id: id('evt'), title: title as string, venue: venue as string, starts_on: plus(d as number),
  cpd: cpd as string, sector: 'Health', link: '', published: true,
}));

export const SEED_GALLERIES: Gallery[] = [
  {
    id: 'gal-demo', slug: 'graduation-2026', title: 'Graduation 2026', client_name: 'University of Health Sciences',
    event_date: '2026-10-25', location: 'Upanga, Dar es Salaam', cover_url: '',
    collections: ['Ceremony', 'Portraits', 'Booth', 'Candid'], access_mode: 'public', pin: '',
    expires_on: plus(90), allow_downloads: true, selection_limit: 30, face_search_enabled: false, published: true,
  },
];

const COLL = ['Ceremony', 'Portraits', 'Booth', 'Candid'];
export const SEED_MEDIA: MediaItem[] = Array.from({ length: 16 }, (_, i) => ({
  id: id('med'), gallery_id: 'gal-demo', kind: 'photo' as const, url: '', thumb_url: '',
  collection: COLL[i % 4], caption: `${COLL[i % 4]} · ${String(i + 1).padStart(3, '0')}`, sort_order: i + 1,
}));

export const SEED: { [K in keyof Tables]: Tables[K][] } = {
  services: SEED_SERVICES,
  projects_public: SEED_PROJECTS,
  partners: SEED_PARTNERS,
  highlights: SEED_HIGHLIGHTS,
  team: SEED_TEAM,
  testimonials: SEED_TESTIMONIALS,
  bookings: [],
  news_stories: SEED_NEWS,
  opportunities: SEED_OPPORTUNITIES,
  events: SEED_EVENTS,
  subscribers: [],
  galleries: SEED_GALLERIES,
  media_items: SEED_MEDIA,
};
