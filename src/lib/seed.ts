// Starter content shown on first load (demo mode) and mirrored by
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
  hero_subtitle:
    'Films, photography, podcasts and live streams for brands, hospitals, banks and universities across Tanzania.',
  hero_image_url: '',
  hero_video_url: '',
  logo_url: '/logo.svg',
  logo_reverse_url: '/logo-reverse.svg',
  about_story:
    'Basil Media is a Dar es Salaam production house telling Tanzania’s stories on film, in photographs and on air. We cover summits, graduations and launches, make documentaries and brand films, and run podcasts and live streams for hospitals, banks, universities and companies. One crew takes every project from brief to final cut, and every client follows the work in our own studio platform.',
  about_image_url: '',
  mission:
    'To tell the stories of Tanzanian institutions and people with honesty, craft and care, and to deliver every frame on time.',
  vision: 'To be East Africa’s most trusted media house: the studio institutions call when the moment matters.',
  company_profile_url: '',
  contact_email: 'hello@basilmedia.co.tz',
  phone: '+255 700 000 000',
  whatsapp: '+255700000000',
  address: 'Mikocheni, Dar es Salaam, Tanzania',
  map_embed_url: '',
  footer_about:
    'Video, photography, podcasts and live streaming from Dar es Salaam — delivered through our own studio platform.',
  socials: {
    instagram: 'https://instagram.com/',
    youtube: 'https://youtube.com/',
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

const PJ: [string, Project['category'], string, boolean][] = [
  ['Hospital care stories', 'Films & Documentaries', 'National Referral Hospital', true],
  ['Health Summit 2026 — live', 'Corporate', 'Tanzania Health Summit', true],
  ['Graduation day', 'Photo Stories', 'University of Health Sciences', false],
  ['Health talk — episode 4', 'Podcasts', 'Basil Media', true],
  ['Scholarship launch film', 'Films & Documentaries', 'Bank Foundation', true],
  ['Plant safety film', 'Corporate', 'Cement Co.', true],
  ['Delegates of the summit', 'Photo Stories', 'Tanzania Health Summit', false],
  ['Product launch reel', 'Corporate', 'Beverage Co.', true],
  ['Voices of nurses', 'Podcasts', 'National Referral Hospital', true],
];
export const SEED_PROJECTS: Project[] = PJ.map(([title, category, client], i) => ({
  id: id('prj'), title, category, client, image_url: '', video_url: '', external_url: '',
  description: 'Project summary written in the admin: the brief, what we made, and the result for the client.',
  featured: i < 6, sort_order: i + 1, published: true,
}));

export const SEED_PARTNERS: Partner[] = [
  'National Referral Hospital', 'Bank Foundation', 'University of Health Sciences', 'Tanzania Health Summit', 'Cement Co.', 'Beverage Co.',
].map((name, i) => ({ id: id('ptn'), name, logo_url: '', website: '', sort_order: i + 1 }));

export const SEED_HIGHLIGHTS: Highlight[] = [
  'Summit opening — highlight reel', 'Behind the scenes · graduation', 'Podcast clip · health talk', 'Campaign teaser',
].map((title, i) => ({ id: id('hl'), title, video_url: '', thumbnail_url: '', sort_order: i + 1, published: true }));

export const SEED_TEAM: TeamMember[] = [
  ['Emmanuel', 'Chief Executive Officer'], ['Saul', 'General Manager & CFO'], ['Benedicto', 'Head of Production'],
  ['Jonathan', 'Director of Photography'], ['Enock', 'Project Lead · Events'], ['Rehema', 'Front Desk & Client Care'],
].map(([name, role], i) => ({ id: id('tm'), name, role, photo_url: '', bio: '', sort_order: i + 1, published: true }));

export const SEED_TESTIMONIALS: Testimonial[] = [
  ['National Referral Hospital', 'They filmed our wards with real respect for patients and staff. The documentary is now part of our induction for every new nurse.'],
  ['Tanzania Health Summit', 'Three days, four halls, one live stream that never dropped. Delegates had their photos before the closing dinner.'],
  ['Bank Foundation', 'The scholarship film made our board cry and our applications double. Calm crew, sharp edit, delivered early.'],
  ['University of Health Sciences', 'Graduates found their photos with a selfie. Parents still send us thank-you messages about that gallery.'],
].map(([company, quote], i) => ({ id: id('tst'), company, quote, rating: 5, person_name: '', sort_order: i + 1, published: true }));

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
