-- =====================================================================
-- AMONGHER · seed.sql — configuration only.
-- NO fake members, posts, comments, reviews or testimonials are created.
-- Collections are empty editorial shells: admins add entries only from
-- real posts whose authors consented and which passed review.
-- Safe to re-run.
-- =====================================================================

insert into public.categories (slug, name, description, icon, tone, sensitive, sort) values
 ('womens-health','Women''s Health','Bodies, cycles, care, and navigating the health system.','heart-pulse','rose',true,1),
 ('relationships','Relationships','Love, family, friendship, boundaries and breakups.','users','plum',false,2),
 ('career','Career','Work, negotiation, ambition, burnout and changing direction.','briefcase','blue',false,3),
 ('finance','Finance','Money habits, saving, debt, investing and independence.','wallet','sage',false,4),
 ('motherhood','Motherhood','Pregnancy, birth, postpartum, parenting and identity.','baby','apricot',true,5),
 ('education','Education','Studying, scholarships, universities and learning later in life.','graduation-cap','indigo',false,6),
 ('safety','Safety','Personal safety, harassment, scams and staying protected.','shield','clay',true,7),
 ('lifestyle','Lifestyle','Moving, homes, travel, routines and everyday life.','sparkles','ochre',false,8)
on conflict (slug) do nothing;

insert into public.wish_topics (slug, label, sort) values
 ('marriage','Before marriage',1),
 ('university','Before university',2),
 ('business','Before starting a business',3),
 ('health','About my health',4),
 ('motherhood','Before motherhood',5),
 ('money','About money',6),
 ('career','Early in my career',7),
 ('moving','Before moving abroad',8),
 ('friendship','About friendships',9)
on conflict (slug) do nothing;

insert into public.situations (slug, label, category_id, sort)
select s.slug, s.label, c.id, s.sort from (values
 ('relocating-abroad','I''m preparing to relocate abroad','lifestyle',1),
 ('first-baby','I''m expecting my first child','motherhood',2),
 ('life-after-birth','I''m navigating life after giving birth','motherhood',3),
 ('changing-careers','I''m changing careers','career',4),
 ('starting-business','I''m starting a business','career',5),
 ('negotiating-pay','I''m negotiating pay or a promotion','career',6),
 ('recovering-burnout','I''m recovering from burnout','career',7),
 ('starting-university','I''m about to start university','education',8),
 ('returning-to-study','I''m going back to study as an adult','education',9),
 ('managing-money','I''m learning to manage money on my own','finance',10),
 ('preparing-marriage','I''m preparing for marriage','relationships',11),
 ('leaving-relationship','I''m leaving a difficult relationship','relationships',12),
 ('long-term-condition','I''m living with a long-term health condition','womens-health',13),
 ('caring-for-parent','I''m caring for an ageing parent','lifestyle',14),
 ('living-alone','I''m living alone for the first time','lifestyle',15)
) as s(slug, label, cat, sort) left join public.categories c on c.slug = s.cat
on conflict (slug) do nothing;

insert into public.collections (slug, title, description, curator_note, category_id, tone, status, sort)
select v.slug, v.title, v.description,
       'Entries are chosen by AMONGHER editors from experiences whose authors agreed to be featured, and are reviewed before they appear here.',
       c.id, c.tone, 'published', v.sort
from (values
 ('things-i-wish-i-knew-before-motherhood','Things I Wish I Knew Before Motherhood','Lessons, honest advice and community insight on pregnancy, birth and the first years.','motherhood',1),
 ('moving-abroad','Moving Abroad: Lessons From Women Who''ve Done It','Practical knowledge on visas, loneliness, money, housing and building a life somewhere new.','lifestyle',2),
 ('your-first-year-in-business','Your First Year in Business','What women learned launching, pricing, hiring and surviving the early months.','career',3),
 ('money-earlier-than-later','Money Lessons, Earlier Than Later','Saving, debt, negotiating and independence, shared plainly.','finance',4),
 ('walking-into-university','Walking Into University','Study habits, funding and finding your people, from women who''ve been there.','education',5),
 ('understanding-your-health','Understanding Your Health','Advocating for yourself in appointments, and what experience can (and can''t) tell you.','womens-health',6),
 ('staying-safe-staying-sure','Staying Safe, Staying Sure','Experience-based awareness on scams, harassment and trusting your instincts.','safety',7)
) as v(slug, title, description, cat, sort) left join public.categories c on c.slug = v.cat
on conflict (slug) do nothing;
