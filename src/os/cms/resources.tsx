// Field definitions for each website content type managed in the CMS.
import { ResourceManager } from './ResourceManager';
import { WORK_CATEGORIES, SECTORS, NEWS_DESKS, OPPORTUNITY_KINDS } from '@/lib/types';
import { fmtDate } from '@/lib/format';
import { youtubeThumb } from '@/lib/video';

const ICONS = ['video', 'camera', 'mic', 'radio', 'sparkles', 'briefcase'] as const;
const today = () => new Date().toISOString().slice(0, 10);

export const ProjectsCms = () => (
  <ResourceManager
    table="projects_public" tag="WEBSITE · OUR WORK" title="Projects" sub="Featured projects also fill the home page mosaic." sortable publishable
    fields={[
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'client', label: 'Client', type: 'text' },
      { key: 'category', label: 'Category', type: 'select', options: WORK_CATEGORIES },
      { key: 'featured', label: 'Featured on home page', type: 'boolean' },
      { key: 'image_url', label: 'Cover picture', type: 'image', folder: 'projects' },
      { key: 'video_url', label: 'Video', type: 'video', folder: 'projects', help: 'Upload a file or paste a YouTube, Vimeo or Instagram link — it plays inside the page.' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'external_url', label: 'External link', type: 'url' },
      { key: 'published', label: 'Published', type: 'boolean' },
    ]}
    blank={() => ({ title: '', client: '', category: 'Corporate' as const, image_url: '', video_url: '', description: '', external_url: '', featured: false, published: true })}
    summary={(r) => [r.title, `${r.category} · ${r.client}${r.featured ? ' · ★ featured' : ''}${r.video_url ? ' · ▶ video' : ''}`]}
    thumb={(r) => r.image_url || youtubeThumb(r.video_url)}
  />
);

export const ServicesCms = () => (
  <ResourceManager
    table="services" tag="WEBSITE · SERVICES" title="Services" sortable publishable
    fields={[
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'slug', label: 'Slug (for links)', type: 'text', required: true, help: 'Lower case, dashes: video-production' },
      { key: 'short', label: 'Short text (menus & cards)', type: 'text', wide: true },
      { key: 'description', label: 'Full description', type: 'textarea' },
      { key: 'deliverables', label: 'Deliverables', type: 'list' },
      { key: 'icon', label: 'Icon', type: 'select', options: ICONS },
      { key: 'published', label: 'Published', type: 'boolean' },
      { key: 'image_url', label: 'Picture', type: 'image', folder: 'services' },
      { key: 'video_url', label: 'Production video', type: 'video', folder: 'services' },
    ]}
    blank={() => ({ title: '', slug: '', short: '', description: '', deliverables: [], icon: 'video', image_url: '', video_url: '', published: true })}
    summary={(r) => [r.title, r.short]}
    thumb={(r) => r.image_url || youtubeThumb(r.video_url)}
  />
);

export const HighlightsCms = () => (
  <ResourceManager
    table="highlights" tag="WEBSITE · HOME" title="Highlights (reels)" sub="Vertical reels on the home page. Instagram profile bar, caption and comments are cropped away automatically." sortable publishable
    fields={[
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'published', label: 'Published', type: 'boolean' },
      { key: 'video_url', label: 'Reel', type: 'video', folder: 'highlights' },
      { key: 'thumbnail_url', label: 'Thumbnail (optional)', type: 'image', folder: 'highlights' },
    ]}
    blank={() => ({ title: '', video_url: '', thumbnail_url: '', published: true })}
    summary={(r) => [r.title, r.video_url || 'No video yet']}
    thumb={(r) => r.thumbnail_url || youtubeThumb(r.video_url)}
  />
);

export const PartnersCms = () => (
  <ResourceManager
    table="partners" tag="WEBSITE · PARTNERS" title="Partners" sub="Shown in the scrolling logo strip and on About Us." sortable
    fields={[
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'website', label: 'Website', type: 'url' },
      { key: 'logo_url', label: 'Logo', type: 'image', folder: 'partners', help: 'Transparent PNG or SVG looks best. Without a logo the name is shown.' },
    ]}
    blank={() => ({ name: '', logo_url: '', website: '' })}
    summary={(r) => [r.name, r.logo_url ? 'Logo uploaded' : 'Text only']}
    thumb={(r) => r.logo_url}
  />
);

export const TeamCms = () => (
  <ResourceManager
    table="team" tag="WEBSITE · ABOUT" title="Team" sortable publishable
    fields={[
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'role', label: 'Role', type: 'text' },
      { key: 'photo_url', label: 'Photo', type: 'image', folder: 'team' },
      { key: 'instagram_url', label: 'Instagram profile', type: 'url' },
      { key: 'linkedin_url', label: 'LinkedIn profile', type: 'url' },
      { key: 'bio', label: 'Short bio', type: 'textarea' },
      { key: 'published', label: 'Published', type: 'boolean' },
    ]}
    blank={() => ({ name: '', role: '', photo_url: '', bio: '', published: true })}
    summary={(r) => [r.name, r.role]}
    thumb={(r) => r.photo_url}
  />
);

export const TestimonialsCms = () => (
  <ResourceManager
    table="testimonials" tag="WEBSITE · HOME" title="Testimonials" sub="Only the company is shown publicly; the person’s name stays internal." sortable publishable
    fields={[
      { key: 'company', label: 'Company', type: 'text', required: true },
      { key: 'rating', label: 'Stars (1–5)', type: 'number' },
      { key: 'quote', label: 'Quote', type: 'textarea', required: true },
      { key: 'person_name', label: 'Person (internal only)', type: 'text' },
      { key: 'published', label: 'Published', type: 'boolean' },
    ]}
    blank={() => ({ company: '', quote: '', rating: 5, person_name: '', published: true })}
    summary={(r) => [r.company, `${'★'.repeat(Number(r.rating))} ${r.quote.slice(0, 80)}`]}
  />
);

export const NewsCms = () => (
  <ResourceManager
    table="news_stories" tag="AUDIENCE · BASIL BRIEF" title="News" sub="Nothing goes live until an editor publishes it." publishable
    fields={[
      { key: 'title', label: 'Headline', type: 'text', required: true, wide: true },
      { key: 'dek', label: 'Summary line', type: 'text', wide: true },
      { key: 'tag', label: 'Topic', type: 'select', options: ['Policy', 'Regulation', 'Research', 'Facilities', 'Events', 'Alert', 'Opportunities', 'Startups', 'Funding', 'Markets', 'Banking', 'Skills'] },
      { key: 'sector', label: 'Desk', type: 'select', options: NEWS_DESKS },
      { key: 'published_at', label: 'Publish date', type: 'date' },
      { key: 'read_minutes', label: 'Read time (minutes)', type: 'number' },
      { key: 'featured', label: 'Featured', type: 'boolean' },
      { key: 'published', label: 'Published', type: 'boolean' },
      { key: 'image_url', label: 'Picture', type: 'image', folder: 'news' },
      { key: 'body', label: 'Story', type: 'textarea' },
    ]}
    blank={() => ({ title: '', dek: '', body: '', tag: 'Policy', sector: 'Health', image_url: '', read_minutes: 3, featured: false, published: false, published_at: today() })}
    summary={(r) => [r.title, `${r.tag} · ${fmtDate(r.published_at)}${r.featured ? ' · ★ featured' : ''}`]}
    thumb={(r) => r.image_url}
  />
);

export const OpportunitiesCms = () => (
  <ResourceManager
    table="opportunities" tag="AUDIENCE · HEALTH BRIEF" title="Opportunities" publishable
    fields={[
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'org', label: 'Organisation', type: 'text' },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'kind', label: 'Type', type: 'select', options: OPPORTUNITY_KINDS },
      { key: 'closes_on', label: 'Closing date', type: 'date' },
      { key: 'link', label: 'Apply link', type: 'url' },
      { key: 'published', label: 'Published', type: 'boolean' },
    ]}
    blank={() => ({ title: '', org: '', location: '', kind: 'Job' as const, closes_on: today(), link: '', published: true })}
    summary={(r) => [r.title, `${r.kind} · ${r.org} · closes ${fmtDate(r.closes_on)}`]}
  />
);

export const EventsCms = () => (
  <ResourceManager
    table="events" tag="AUDIENCE · CALENDAR" title="Events & CPD" publishable
    fields={[
      { key: 'title', label: 'Event', type: 'text', required: true },
      { key: 'venue', label: 'Venue', type: 'text' },
      { key: 'starts_on', label: 'Date', type: 'date' },
      { key: 'cpd', label: 'CPD points', type: 'text' },
      { key: 'sector', label: 'Sector', type: 'select', options: SECTORS },
      { key: 'link', label: 'Link', type: 'url' },
      { key: 'published', label: 'Published', type: 'boolean' },
    ]}
    blank={() => ({ title: '', venue: '', starts_on: today(), cpd: '', sector: 'Health', link: '', published: true })}
    summary={(r) => [r.title, `${fmtDate(r.starts_on)} · ${r.venue}`]}
  />
);
