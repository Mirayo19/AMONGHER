import { useEffect, useState } from 'react';
import { api } from '@/data/api';
import type { Category, Situation, WishTopic } from '@/lib/types';

interface Tax { categories: Category[]; situations: Situation[]; wishTopics: WishTopic[] }
let cache: Promise<Tax> | null = null;
const subs = new Set<() => void>();

const fetchTax = (): Promise<Tax> =>
  Promise.all([api.listCategories(), api.listSituations(), api.listWishTopics()])
    .then(([categories, situations, wishTopics]) => ({ categories, situations, wishTopics }));

export function invalidateTaxonomy() { cache = null; subs.forEach((s) => s()); }

/** Categories, situations and wish topics are small, admin-managed config: fetched once and shared. */
export function useTaxonomy() {
  const [tax, setTax] = useState<Tax | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { const f = () => setTick((t) => t + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  useEffect(() => {
    let live = true;
    cache ??= fetchTax();
    cache.then((t) => live && setTax(t)).catch(() => { cache = null; });
    return () => { live = false; };
  }, [tick]);
  const categories = tax?.categories ?? [];
  return {
    ready: !!tax,
    categories: categories.filter((c) => c.is_active),
    allCategories: categories,
    situations: (tax?.situations ?? []).filter((s) => s.is_active),
    allSituations: tax?.situations ?? [],
    wishTopics: (tax?.wishTopics ?? []).filter((w) => w.is_active),
    allWishTopics: tax?.wishTopics ?? [],
    cat: (id?: string | null) => categories.find((c) => c.id === id) ?? null,
    situation: (id?: string | null) => (tax?.situations ?? []).find((s) => s.id === id) ?? null,
    wishLabel: (slug?: string | null) => (tax?.wishTopics ?? []).find((w) => w.slug === slug)?.label ?? slug ?? '',
  };
}
