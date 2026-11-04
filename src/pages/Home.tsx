import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass, Feather, UserPlus } from 'lucide-react';
import { useTitle } from '@/lib/hooks';
import type { FeedFilter } from '@/lib/types';
import { useAuth } from '@/state/auth';
import { PostList } from '@/components/Feed';
import { Avatar, EmptyState, Tabs } from '@/components/ui';

const TABS: { id: FeedFilter; label: string }[] = [
  { id: 'latest', label: 'Latest' }, { id: 'popular', label: 'Popular' }, { id: 'following', label: 'Following' },
  { id: 'questions', label: 'Questions' }, { id: 'experiences', label: 'Experiences' },
];

export default function Home() {
  useTitle('Home');
  const { me } = useAuth();
  const [filter, setFilter] = useState<FeedFilter>(() => (sessionStorage.getItem('feedFilter') as FeedFilter) || 'latest');
  const set = (f: FeedFilter) => { setFilter(f); sessionStorage.setItem('feedFilter', f); };

  const empty = {
    following: <EmptyState icon={<UserPlus size={22} />} title="Nobody followed yet" action={<Link to="/explore" className="btn-primary btn-sm">Explore topics</Link>}>Follow members from their profiles and their posts will appear here. Anonymous posts can’t be followed.</EmptyState>,
    questions: <EmptyState icon={<Feather size={22} />} title="No questions yet" action={<Link to="/share/ask" className="btn-primary btn-sm">Ask the first question</Link>}>Is there something you’ve been wondering? Ask it — anonymously if you like.</EmptyState>,
  }[filter as 'following' | 'questions'] ?? (
    <EmptyState icon={<Compass size={22} />} title="The conversation starts with you"
      action={<><Link to="/share/experience" className="btn-primary btn-sm">Share an experience</Link><Link to="/explore" className="btn-secondary btn-sm">Explore</Link></>}>
      Nothing has been shared yet. Be the first to post — what you’ve learned could help someone tonight.
    </EmptyState>
  );

  return (
    <div>
      <Link to="/share" className="card mb-5 flex items-center gap-3 p-3.5 transition hover:shadow-lift">
        <Avatar motif={me?.avatar_motif} tone={me?.avatar_tone} size={40} />
        <span className="flex-1 text-[15px] text-ink-muted">What would you tell her, @{me?.username}?</span>
        <span className="btn-primary btn-sm"><Feather size={15} />Share</span>
      </Link>
      <div className="sticky top-14 z-20 -mx-4 mb-4 bg-ivory-100/90 px-4 py-2 backdrop-blur"><Tabs value={filter} onChange={set} items={TABS} /></div>
      <PostList query={{ filter }} empty={empty} />
    </div>
  );
}
