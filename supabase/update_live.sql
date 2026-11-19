-- Basil Media OS · 0046 the programme is spelled "Instaprenyua" (two film titles had "Inspirenyua").
update public.projects_public set title = replace(title, 'Inspirenyua', 'Instaprenyua'), description = replace(description, 'Inspirenyua', 'Instaprenyua')
 where title ilike '%inspirenyua%' or description ilike '%inspirenyua%';

-- Basil Media OS · 0047 About text from Basil Media's company profile (vision, mission, who we are).
update public.site_settings set
  about_story = 'Basil Media is a media production and digital communications company committed to empowering brands, institutions, organizations, and businesses through creative storytelling, innovative media solutions, and strategic digital visibility.' || E'\n\n' || 'We specialize in delivering professional media production services that help organizations communicate their impact, tell compelling stories, engage audiences, and strengthen their brand presence.',
  vision = 'To become a leading African media and communications company, using creativity, technology, and storytelling to inspire change, amplify impact, and create opportunities for the next generation.',
  mission = 'To deliver innovative, high-quality media and digital communication solutions while creating opportunities for young people to develop practical skills, gain experience, and participate in the creative economy.';

-- Basil Media OS · 0048 new hero reel ("Basil Media Presents", Nov 2026), letterbox bars trimmed.
update public.site_settings set hero_video_url = '/media/hero/basil-reel-2026.mp4'
 where coalesce(hero_video_url, '') in ('', '/media/hero/basil-hero-reel.mp4', '/media/hero/basil-hero-reel-portrait.mp4');
