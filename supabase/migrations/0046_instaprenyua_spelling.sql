-- Basil Media OS · 0046 the programme is spelled "Instaprenyua" (two film titles had "Inspirenyua").
update public.projects_public set title = replace(title, 'Inspirenyua', 'Instaprenyua'), description = replace(description, 'Inspirenyua', 'Instaprenyua')
 where title ilike '%inspirenyua%' or description ilike '%inspirenyua%';
