/**
 * Configuration-only taxonomy. Mirrors supabase/seed.sql.
 * Contains NO members, posts, comments, reviews or testimonials.
 */
import type { Category, WishTopic, Tone } from '@/lib/types';

export const SEED_CATEGORIES: Omit<Category, 'id'>[] = [
  { slug: 'womens-health', name: "Women's Health", description: 'Bodies, cycles, care, and navigating the health system.', icon: 'heart-pulse', tone: 'rose', sensitive: true, sort: 1, is_active: true },
  { slug: 'relationships', name: 'Relationships', description: 'Love, family, friendship, boundaries and breakups.', icon: 'users', tone: 'plum', sensitive: false, sort: 2, is_active: true },
  { slug: 'career', name: 'Career', description: 'Work, negotiation, ambition, burnout and changing direction.', icon: 'briefcase', tone: 'blue', sensitive: false, sort: 3, is_active: true },
  { slug: 'finance', name: 'Finance', description: 'Money habits, saving, debt, investing and independence.', icon: 'wallet', tone: 'sage', sensitive: false, sort: 4, is_active: true },
  { slug: 'motherhood', name: 'Motherhood', description: 'Pregnancy, birth, postpartum, parenting and identity.', icon: 'baby', tone: 'apricot', sensitive: true, sort: 5, is_active: true },
  { slug: 'education', name: 'Education', description: 'Studying, scholarships, universities and learning later in life.', icon: 'graduation-cap', tone: 'indigo', sensitive: false, sort: 6, is_active: true },
  { slug: 'safety', name: 'Safety', description: 'Personal safety, harassment, scams and staying protected.', icon: 'shield', tone: 'clay', sensitive: true, sort: 7, is_active: true },
  { slug: 'lifestyle', name: 'Lifestyle', description: 'Moving, homes, travel, routines and everyday life.', icon: 'sparkles', tone: 'ochre', sensitive: false, sort: 8, is_active: true },
];

export const SEED_WISH_TOPICS: WishTopic[] = [
  { slug: 'marriage', label: 'Before marriage', sort: 1, is_active: true },
  { slug: 'university', label: 'Before university', sort: 2, is_active: true },
  { slug: 'business', label: 'Before starting a business', sort: 3, is_active: true },
  { slug: 'health', label: 'About my health', sort: 4, is_active: true },
  { slug: 'motherhood', label: 'Before motherhood', sort: 5, is_active: true },
  { slug: 'money', label: 'About money', sort: 6, is_active: true },
  { slug: 'career', label: 'Early in my career', sort: 7, is_active: true },
  { slug: 'moving', label: 'Before moving abroad', sort: 8, is_active: true },
  { slug: 'friendship', label: 'About friendships', sort: 9, is_active: true },
];

export const SEED_SITUATIONS: { slug: string; label: string; cat: string; sort: number }[] = [
  { slug: 'relocating-abroad', label: "I'm preparing to relocate abroad", cat: 'lifestyle', sort: 1 },
  { slug: 'first-baby', label: "I'm expecting my first child", cat: 'motherhood', sort: 2 },
  { slug: 'life-after-birth', label: "I'm navigating life after giving birth", cat: 'motherhood', sort: 3 },
  { slug: 'changing-careers', label: "I'm changing careers", cat: 'career', sort: 4 },
  { slug: 'starting-business', label: "I'm starting a business", cat: 'career', sort: 5 },
  { slug: 'negotiating-pay', label: "I'm negotiating pay or a promotion", cat: 'career', sort: 6 },
  { slug: 'recovering-burnout', label: "I'm recovering from burnout", cat: 'career', sort: 7 },
  { slug: 'starting-university', label: "I'm about to start university", cat: 'education', sort: 8 },
  { slug: 'returning-to-study', label: "I'm going back to study as an adult", cat: 'education', sort: 9 },
  { slug: 'managing-money', label: "I'm learning to manage money on my own", cat: 'finance', sort: 10 },
  { slug: 'preparing-marriage', label: "I'm preparing for marriage", cat: 'relationships', sort: 11 },
  { slug: 'leaving-relationship', label: "I'm leaving a difficult relationship", cat: 'relationships', sort: 12 },
  { slug: 'long-term-condition', label: "I'm living with a long-term health condition", cat: 'womens-health', sort: 13 },
  { slug: 'caring-for-parent', label: "I'm caring for an ageing parent", cat: 'lifestyle', sort: 14 },
  { slug: 'living-alone', label: "I'm living alone for the first time", cat: 'lifestyle', sort: 15 },
];

export const SEED_COLLECTIONS: { slug: string; title: string; description: string; cat: string; sort: number }[] = [
  { slug: 'things-i-wish-i-knew-before-motherhood', title: 'Things I Wish I Knew Before Motherhood', description: 'Lessons, honest advice and community insight on pregnancy, birth and the first years.', cat: 'motherhood', sort: 1 },
  { slug: 'moving-abroad', title: "Moving Abroad: Lessons From Women Who've Done It", description: 'Practical knowledge on visas, loneliness, money, housing and building a life somewhere new.', cat: 'lifestyle', sort: 2 },
  { slug: 'your-first-year-in-business', title: 'Your First Year in Business', description: 'What women learned launching, pricing, hiring and surviving the early months.', cat: 'career', sort: 3 },
  { slug: 'money-earlier-than-later', title: 'Money Lessons, Earlier Than Later', description: 'Saving, debt, negotiating and independence, shared plainly.', cat: 'finance', sort: 4 },
  { slug: 'walking-into-university', title: 'Walking Into University', description: "Study habits, funding and finding your people, from women who've been there.", cat: 'education', sort: 5 },
  { slug: 'understanding-your-health', title: 'Understanding Your Health', description: "Advocating for yourself in appointments, and what experience can (and can't) tell you.", cat: 'womens-health', sort: 6 },
  { slug: 'staying-safe-staying-sure', title: 'Staying Safe, Staying Sure', description: 'Experience-based awareness on scams, harassment and trusting your instincts.', cat: 'safety', sort: 7 },
];
export const CURATOR_NOTE = 'Entries are chosen by AMONGHER editors from experiences whose authors agreed to be featured, and are reviewed before they appear here.';
export const toneOf = (cats: { slug: string; tone: Tone }[], slug: string): Tone => cats.find((c) => c.slug === slug)?.tone ?? 'plum';
