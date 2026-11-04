import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bookmark, BookmarkCheck, BookOpen, ChevronLeft, Lightbulb, Quote, Search, Sparkles, Users } from 'lucide-react';
import { api } from '@/data/api';
import { errorMessage } from '@/lib/errors';
import { useAsync, useTitle } from '@/lib/hooks';
import type { Collection, ItemType, LibraryEntry } from '@/lib/types';
import { cx, debounce, timeAgo, toneClass } from '@/lib/util';
import { useTaxonomy } from '@/state/taxonomy';
import { useToast } from '@/state/toast';
import { PostList } from '@/components/Feed';
import { Byline } from '@/components/PostCard';
import { Button, CategoryPill, Chip, EmptyState, ErrorState, Notice, PageHeader, SkeletonCards, Tabs } from '@/components/ui';

export const ITEM_TYPES: { id: ItemType; label: string; icon: typeof BookOpen }[] = [
  { id: 'experience', label: 'Experience', icon: Users }, { id: 'lesson', label: 'Lesson learned', icon: Lightbulb },
  { id: 'advice', label: 'Helpful advice', icon: Sparkles }, { id: 'insight', label: 'Community insight', icon: Quote },
];

function CollectionCard({ c }: { c: Collection }) {
  return (
    <Link to={`/library/${c.slug}`} className={cx(toneClass(c.tone), 'group relative flex min-h-[168px] flex-col justify-between overflow-hidden rounded-2xl border border-ivory-300/80 bg-ivory-50 p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift')}>
      <span aria-hidden className="t-bg absolute -right-10 -top-10 h-32 w-32 rounded-full transition group-hover:scale-110" />
      <BookOpen size={22} className="t-fg relative" />
      <div className="relative">
        <h3 className="text-xl font-semibold leading-snug">{c.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-ink-muted">{c.description}</p>
        <p className="mt-3 text-xs font-semibold text-ink-muted">{c.entry_count} {c.entry_count === 1 ? 'entry' : 'entries'}{c.saved_by_me && <span className="ml-2 text-brass-700">· Saved</span>}</p>
      </div>
    </Link>
  );
}

export function EntryCard({ e, showCollection = true }: { e: LibraryEntry; showCollection?: boolean }) {
  const { cat } = useTaxonomy();
  const t = ITEM_TYPES.find((x) => x.id === e.item_type)!; const I = t.icon; const category = cat(e.category_id);
  return (
    <article className={cx(toneClass(category?.tone), 'card relative overflow-hidden p-5')}>
      <span aria-hidden className="absolute inset-y-0 left-0 w-[5px] bg-[var(--t-line)]" />
      <div className="flex flex-wrap items-center gap-2"><span className="eyebrow t-fg inline-flex items-center gap-1.5"><I size={13} />{t.label}</span><CategoryPill cat={category} /></div>
      {e.key_takeaway && <blockquote className="mt-3 border-l-2 border-brass-300 pl-3.5 font-display text-[18px] italic leading-snug text-plum-900">{e.key_takeaway}</blockquote>}
      <h3 className="mt-3 text-lg font-semibold leading-snug"><Link to={`/post/${e.id}`} className="hover:text-plum-700">{e.title}</Link></h3>
      <p className="prose-body mt-1.5 line-clamp-3">{e.body}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ivory-300/70 pt-3">
        <Byline post={e} />
        <div className="flex items-center gap-3 text-xs text-ink-muted">
          {showCollection && <Link to={`/library/${e.collection_slug}`} className="font-semibold text-plum-700 hover:underline">{e.collection_title}</Link>}
          <span>{timeAgo(e.created_at)}</span>
        </div>
      </div>
    </article>
  );
}

export default function Library() {
  useTitle('Library');
  const { categories } = useTaxonomy();
  const [tab, setTab] = useState<'collections' | 'saved'>('collections');
  const [q, setQ] = useState(''); const [term, setTerm] = useState('');
  const [catId, setCatId] = useState(''); const [type, setType] = useState<ItemType | ''>('');
  const setTermD = useRef(debounce((v: string) => setTerm(v), 350));
  const filtering = term.trim().length > 1 || !!catId || !!type;
  const { data: collections, loading, error, reload } = useAsync(() => api.listCollections(), []);
  const { data: results, loading: rl } = useAsync(() => (filtering ? api.searchLibrary({ search: term, categoryId: catId || undefined, itemType: type || undefined }) : Promise.resolve([])), [term, catId, type]);

  return (
    <div>
      <PageHeader eyebrow="Lived knowledge" title="Library" subtitle="Experiences, lessons and advice from women — gathered into collections by our editors, after review." />
      <div className="relative mb-4">
        <Search size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input value={q} type="search" aria-label="Search the library" placeholder="Search lessons, advice, experiences…" className="input pl-11" onChange={(e) => { setQ(e.target.value); setTermD.current(e.target.value); }} />
      </div>
      <div className="scroll-x -mx-4 mb-3 px-4">
        <Chip active={!catId} onClick={() => setCatId('')}>All topics</Chip>
        {categories.map((c) => <Chip key={c.id} active={catId === c.id} onClick={() => setCatId(catId === c.id ? '' : c.id)}>{c.name}</Chip>)}
      </div>
      <div className="scroll-x -mx-4 mb-5 px-4">
        {ITEM_TYPES.map((t) => <Chip key={t.id} active={type === t.id} onClick={() => setType(type === t.id ? '' : t.id)}>{t.label}</Chip>)}
      </div>

      {filtering ? (
        <section aria-live="polite">
          <p className="mb-3 text-sm text-ink-muted">{rl ? 'Searching…' : `${results?.length ?? 0} ${results?.length === 1 ? 'entry' : 'entries'}`}</p>
          {rl ? <SkeletonCards n={2} /> : results?.length ? <div className="space-y-4">{results.map((e) => <EntryCard key={e.entry_id} e={e} />)}</div>
            : <EmptyState icon={<Search size={22} />} title="No curated entries match">The Library only contains reviewed, consented entries. Try the community search in <Link to="/explore" className="font-semibold underline">Explore</Link> for everything members have shared.</EmptyState>}
        </section>
      ) : (<>
        <div className="mb-5"><Tabs value={tab} onChange={setTab} items={[{ id: 'collections', label: 'Collections' }, { id: 'saved', label: 'Saved' }]} /></div>
        {tab === 'collections' ? (
          loading ? <SkeletonCards n={3} /> : error ? <ErrorState message={error} onRetry={() => reload()} /> : !collections?.length
            ? <EmptyState icon={<BookOpen size={22} />} title="No collections yet">Editors haven’t published any collections.</EmptyState>
            : <div className="grid gap-4 sm:grid-cols-2">{collections.map((c) => <CollectionCard key={c.id} c={c} />)}</div>
        ) : <Saved collections={collections ?? []} />}
        {!loading && collections?.every((c) => c.entry_count === 0) && (
          <Notice tone="info" className="mt-6" title="These collections are just getting started">
            Entries appear here once a member shares an experience, agrees to let editors feature it, and our team reviews it. <Link to="/share/experience" className="font-bold underline">Share yours</Link> and tick “Allow editors to feature this”.
          </Notice>
        )}
      </>)}
    </div>
  );
}

function Saved({ collections }: { collections: Collection[] }) {
  const saved = collections.filter((c) => c.saved_by_me);
  return (
    <div className="space-y-8">
      <section><h2 className="mb-3 text-xl font-semibold">Saved collections</h2>
        {saved.length ? <div className="grid gap-4 sm:grid-cols-2">{saved.map((c) => <CollectionCard key={c.id} c={c} />)}</div>
          : <EmptyState icon={<Bookmark size={22} />} title="No saved collections">Open a collection and tap Save to keep it here.</EmptyState>}
      </section>
      <section><h2 className="mb-3 text-xl font-semibold">Saved experiences</h2>
        <PostList query={{ bookmarked: true }} empty={<EmptyState icon={<Bookmark size={22} />} title="Nothing saved yet">Tap the bookmark on any post to keep it for later.</EmptyState>} />
      </section>
    </div>
  );
}

export function CollectionPage() {
  const { slug = '' } = useParams(); const toast = useToast();
  const { data, loading, error, reload, setData } = useAsync(() => api.getCollection(slug), [slug]);
  const [type, setType] = useState<ItemType | ''>('');
  useTitle(data?.collection.title ?? 'Collection');
  if (loading) return <SkeletonCards n={2} />;
  if (error) return <ErrorState message={error} onRetry={() => reload()} />;
  if (!data) return <EmptyState title="Collection not found" action={<Link to="/library" className="btn-primary btn-sm">Back to Library</Link>}>It may have been unpublished.</EmptyState>;
  const { collection: c, entries } = data;
  const shown = entries.filter((e) => !type || e.item_type === type);
  const save = async () => {
    try { await api.setCollectionSaved(c.id, !c.saved_by_me); setData({ ...data, collection: { ...c, saved_by_me: !c.saved_by_me } }); toast(c.saved_by_me ? 'Removed from saved' : 'Collection saved'); }
    catch (e) { toast(errorMessage(e), 'error'); }
  };
  return (
    <div className={toneClass(c.tone)}>
      <Link to="/library" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-plum-800"><ChevronLeft size={16} />Library</Link>
      <header className="t-bg mb-5 rounded-3xl p-6">
        <BookOpen className="t-fg" size={26} />
        {c.status === 'draft' && <span className="ml-3 rounded bg-clay-500 px-2 py-0.5 text-[11px] font-bold text-white">DRAFT — staff only</span>}
        <h1 className="mt-4 text-3xl font-semibold leading-tight">{c.title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{c.description}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink-soft">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</p>
          <Button variant={c.saved_by_me ? 'primary' : 'secondary'} size="sm" onClick={save}>{c.saved_by_me ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}{c.saved_by_me ? 'Saved' : 'Save collection'}</Button>
        </div>
      </header>
      {!!entries.length && <div className="scroll-x -mx-4 mb-4 px-4"><Chip active={!type} onClick={() => setType('')}>All</Chip>{ITEM_TYPES.map((t) => <Chip key={t.id} active={type === t.id} onClick={() => setType(t.id)}>{t.label}</Chip>)}</div>}
      {shown.length ? <div className="space-y-4">{shown.map((e) => <EntryCard key={e.entry_id} e={e} showCollection={false} />)}</div> : (
        <EmptyState icon={<BookOpen size={22} />} title="No entries yet" action={<Link to="/share/experience" className="btn-primary btn-sm">Share an experience</Link>}>
          Entries are added by editors after a member shares an experience, agrees to be featured, and the post is reviewed. Yours could be first.
        </EmptyState>
      )}
      <p className="mt-6 text-xs leading-relaxed text-ink-muted">{c.curator_note} Entries are personal experience, not professional advice.</p>
    </div>
  );
}
