export type ID = string;

export interface SocialLinks {
  instagram?: string;
  youtube?: string;
  facebook?: string;
  linkedin?: string;
  tiktok?: string;
  x?: string;
}

export interface Stat {
  value: number;
  suffix?: string;
  label: string;
}

export interface SiteSettings {
  id: ID;
  tagline: string;
  tagline_highlight: string;
  hero_kicker: string;
  hero_subtitle: string;
  hero_image_url: string;
  hero_video_url: string;
  /** Team, office and studio photos that rotate behind the hero. */
  hero_images: string[];
  office_hours: string;
  home_about_title: string;
  home_about_text: string;
  logo_url: string;
  logo_reverse_url: string;
  about_story: string;
  about_image_url: string;
  mission: string;
  /** "A word from our CEO" on the landing page. */
  ceo_name: string;
  ceo_title: string;
  ceo_message: string;
  /** Show the "New photos" pop-up for freshly published galleries (off by default). */
  gallery_popup?: boolean;
  ceo_photo_url: string;
  vision: string;
  company_profile_url: string;
  contact_email: string;
  phone: string;
  whatsapp: string;
  address: string;
  map_embed_url: string;
  footer_about: string;
  socials: SocialLinks;
  stats: Stat[];
  live_ticker: string;
  services_mega_image_url: string;
  updated_at?: string;
}

export interface Service {
  id: ID;
  title: string;
  slug: string;
  short: string;
  description: string;
  deliverables: string[];
  icon: string;
  image_url: string;
  video_url: string;
  sort_order: number;
  published: boolean;
}

export const WORK_CATEGORIES = ['Films & Documentaries', 'Photo Stories', 'Podcasts', 'Corporate'] as const;
export type WorkCategory = (typeof WORK_CATEGORIES)[number];

export interface Project {
  id: ID;
  title: string;
  client: string;
  category: WorkCategory;
  image_url: string;
  description: string;
  video_url: string;
  orientation?: 'auto' | 'portrait' | 'landscape';
  external_url: string;
  featured: boolean;
  sort_order: number;
  published: boolean;
}

export interface Partner {
  id: ID;
  name: string;
  logo_url: string;
  website: string;
  sort_order: number;
}

export interface Highlight {
  id: ID;
  title: string;
  video_url: string;
  orientation?: 'auto' | 'portrait' | 'landscape';
  thumbnail_url: string;
  sort_order: number;
  published: boolean;
}

export interface TeamMember {
  id: ID;
  name: string;
  role: string;
  photo_url: string;
  bio: string;
  sort_order: number;
  published: boolean;
}

export interface Testimonial {
  id: ID;
  company: string;
  quote: string;
  rating: number;
  person_name: string;
  sort_order: number;
  published: boolean;
}

export interface Booking {
  id: ID;
  name: string;
  contact: string;
  service: string;
  preferred_date: string | null;
  message: string;
  source: 'booking' | 'contact' | 'gallery-selection' | 'find-me';
  status: 'new' | 'contacted' | 'won' | 'lost' | 'archived';
  created_at: string;
}

export const SECTORS = ['Health', 'Education', 'Finance', 'Agribusiness', 'Government', 'NGOs'] as const;

export interface NewsStory {
  id: ID;
  title: string;
  dek: string;
  body: string;
  sector: string;
  tag: string;
  image_url: string;
  read_minutes: number;
  featured: boolean;
  published: boolean;
  published_at: string;
}

export interface Opportunity {
  id: ID;
  title: string;
  org: string;
  location: string;
  kind: 'Job' | 'Fellowship' | 'Scholarship' | 'Call for abstracts';
  closes_on: string;
  link: string;
  published: boolean;
}

export interface EventItem {
  id: ID;
  title: string;
  venue: string;
  starts_on: string;
  cpd: string;
  sector: string;
  link: string;
  published: boolean;
}

export interface Subscriber {
  id: ID;
  full_name: string;
  title: string;
  profession: string;
  specialties: string[];
  institution: string;
  region: string;
  phone: string;
  email: string;
  language: 'en' | 'sw';
  channel: 'sms' | 'email' | 'whatsapp';
  sector: string;
  source: string;
  consent: boolean;
  consent_at: string;
  status: 'pending' | 'active' | 'paused' | 'unsubscribed';
  created_at: string;
}

export interface Gallery {
  id: ID;
  slug: string;
  title: string;
  client_name: string;
  event_date: string;
  location: string;
  cover_url: string;
  collections: string[];
  access_mode: 'public' | 'link' | 'pin';
  pin: string;
  expires_on: string;
  allow_downloads: boolean;
  selection_limit: number;
  face_search_enabled: boolean;
  published: boolean;
}

export interface MediaItem {
  id: ID;
  gallery_id: ID;
  kind: 'photo' | 'video';
  url: string;
  thumb_url: string;
  collection: string;
  caption: string;
  sort_order: number;
}

export interface Tables {
  services: Service;
  projects_public: Project;
  partners: Partner;
  highlights: Highlight;
  team: TeamMember;
  testimonials: Testimonial;
  bookings: Booking;
  news_stories: NewsStory;
  opportunities: Opportunity;
  events: EventItem;
  subscribers: Subscriber;
  galleries: Gallery;
  media_items: MediaItem;
}
export type TableName = keyof Tables;

export type AppRole =
  | 'super_admin'
  | 'boss'
  | 'gm_cfo'
  | 'finance'
  | 'project_lead'
  | 'staff'
  | 'storekeeper'
  | 'growth'
  | 'account_manager'
  | 'receptionist'
  | 'driver'
  | 'client';

export const CMS_ROLES: AppRole[] = ['super_admin', 'gm_cfo', 'growth'];
