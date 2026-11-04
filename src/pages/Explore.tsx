import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, BookOpen, ChevronLeft, HeartHandshake, Quote, Search } from 'lucide-react';
import { api } from '@/data/api';
import { useAsync, useTitle } from '@/lib/hooks';
import type { PostKind } from '@/lib/types';
import { cx, debounce, toneClass } from '@/lib/util';
import { useTaxonomy } from '@/state/taxonomy';
import { PostList } from '@/components/Feed';
import { SafetyNotice } from '@/components/Safety';
import { CategoryIcon, EmptyState, Notice, PageHeader, Tabs } from '@/components/ui';

export default function Explore() {
  useTitle('Explore');
  const { categories } = useTaxonomy();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [term, setTerm] = useState(q);
  const input = useRef<HTMLInputElement>(null);
  const setTermDebounced = useRef(debounce((v: string) => setTerm(v), 350));
  useEffect(() => { if (sp.get('focus') === 'search') input.current?.focus(); }, [sp]);
  const { data: collections } = useAsync(() => api.listCollections(), []);
  const searching = term.trim().length > 1;

  return (
    <div>
      <PageHeader eyebrow="Discover" title="Explore" subtitle="Browse by topic, or search every discussion and experience." />
      <div className="relative mb-6">
        <Search size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input ref={input} value={q} type="search" aria-label="Search AMONGHER" placeholder="Search experiences, questions, topics…" className="input pl-11"
          onChange={(e) => { setQ(e.target.value); setTermDebounced.current(e.target.value); setSp(e.target.value ? { q: e.target.value } : {}, { replace: true }); }} />
      </div>

      {searching ? (
        <section aria-live="polite">
          <p className="mb-3 text-sm text-ink-muted">Results for “{term}”</p>
          <PostList query={{ search: term }} empty={<EmptyState icon={<Search size={22} />} title="Nothing found">Try fewer or different words — or ask it as a question and let the community answer.</EmptyState>} />
        </section>
      ) : (<>
        <div className="grid grid-cols-2 gap-3">
          {categories.map((c) => (
            <Link key={c.id} to={`/explore/${c.slug}`} className={cx(toneClass(c.tone), 'group relative overflow-hidden rounded-2xl border border-ivory-300/80 bg-ivory-50 p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift')}>
              <span aria-hidden className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[var(--t-bg)] transition group-hover:scale-125" />
              <span className="t-fg relative flex h-10 w-10 items-center justify-center rounded-xl t-bg"><CategoryIcon name={c.icon} size={21} /></span>
              <h2 className="relative mt-3 text-[17px] font-semibold leading-tight">{c.name}</h2>
              <p className="relative mt-1 line-clamp-2 text-[12.5px] leading-snug text-ink-muted">{c.description}</p>
            </Link>
          ))}
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link to="/understand" className="card group flex gap-4 p-5 transition hover:shadow-lift">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-plum-700 text-ivory-50"><HeartHandshake size={22} /></span>
            <div><h3 className="text-lg font-semibold">Find someone who understands</h3><p className="mt-1 text-sm leading-relaxed text-ink-muted">Going through something specific? Meet women who’ve opted in to share similar experiences.</p></div>
          </Link>
          <Link to="/wish" className="card group flex gap-4 p-5 transition hover:shadow-lift">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brass-500 text-white"><Quote size={22} /></span>
            <div><h3 className="text-lg font-semibold">I wish I knew…</h3><p className="mt-1 text-sm leading-relaxed text-ink-muted">Lessons women wish they’d learned earlier — about marriage, money, health and more.</p></div>
          </Link>
        </div>

        {!!collections?.length && (
          <section className="mt-10">
            <div className="mb-3 flex items-end justify-between"><h2 className="text-xl font-semibold">From the Library</h2><Link to="/library" className="flex items-center gap-1 text-sm font-semibold text-plum-700 hover:underline">All collections<ArrowRight size={14} /></Link></div>
            <div className="scroll-x -mx-4 px-4">
              {collections.slice(0, 6).map((c) => (
                <Link key={c.id} to={`/library/${c.slug}`} className={cx(toneClass(c.tone), 't-bg w-56 shrink-0 rounded-2xl p-4')}>
                  <BookOpen size={18} className="t-fg" /><h3 className="mt-6 line-clamp-3 text-[15px] font-semibold leading-snug">{c.title}</h3>
                  <p className="mt-2 text-xs text-ink-muted">{c.entry_count} {c.entry_count === 1 ? 'entry' : 'entries'}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </>)}
    </div>
  );
}

const SUB: { id: 'all' | PostKind; label: string }[] = [{ id: 'all', label: 'All' }, { id: 'question', label: 'Questions' }, { id: 'experience', label: 'Experiences' }, { id: 'wish', label: 'I wish I knew' }];

export function ExploreCategory() {
  const { slug } = useParams();
  const { categories, ready } = useTaxonomy();
  const cat = categories.find((c) => c.slug === slug);
  useTitle(cat?.name ?? 'Explore');
  const [kind, setKind] = useState<'all' | PostKind>('all');
  const { data: collections } = useAsync(() => api.listCollections(), []);
  if (ready && !cat) return <EmptyState title="Topic not found" action={<Link to="/explore" className="btn-primary btn-sm">Back to Explore</Link>}>That category doesn’t exist or has been retired.</EmptyState>;
  if (!cat) return null;
  const related = collections?.filter((c) => c.category_id === cat.id);
  return (
    <div className={toneClass(cat.tone)}>
      <Link to="/explore" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-plum-800"><ChevronLeft size={16} />Explore</Link>
      <div className="t-bg mb-5 rounded-3xl p-6">
        <span className="t-fg flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70"><CategoryIcon name={cat.icon} size={26} /></span>
        <h1 className="mt-4 text-3xl font-semibold">{cat.name}</h1>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{cat.description}</p>
      </div>
      {cat.sensitive && <div className="mb-5"><SafetyNotice /></div>}
      {!!related?.length && (
        <div className="mb-5 flex flex-wrap gap-2">
          {related.map((c) => <Link key={c.id} to={`/library/${c.slug}`} className="inline-flex items-center gap-1.5 rounded-full border border-ivory-400 bg-ivory-50 px-3 py-1.5 text-[13px] font-semibold text-plum-800 hover:border-plum-300"><BookOpen size={14} />{c.title}</Link>)}
        </div>
      )}
      <div className="mb-4"><Tabs value={kind} onChange={setKind} items={SUB} /></div>
      <PostList hideCategory query={{ categoryId: cat.id, kind: kind === 'all' ? undefined : kind }}
        empty={<EmptyState title={`Nothing in ${cat.name} yet`} action={<Link to={`/share/experience?category=${cat.slug}`} className="btn-primary btn-sm">Share an experience</Link>}>Your experience could be the first thing someone finds here.</EmptyState>} />
      <Notice tone="info" className="mt-8">Looking for someone who’s been through this? Try <Link to="/understand" className="font-bold underline">Find someone who understands</Link>.</Notice>
    </div>
  );
}
