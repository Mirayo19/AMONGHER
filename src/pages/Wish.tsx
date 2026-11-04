import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Quote } from 'lucide-react';
import { useTitle } from '@/lib/hooks';
import { useTaxonomy } from '@/state/taxonomy';
import { PostList } from '@/components/Feed';
import { Chip, EmptyState, PageHeader } from '@/components/ui';

export default function Wish() {
  useTitle('I wish I knew');
  const { wishTopics } = useTaxonomy();
  const [topic, setTopic] = useState<string>('');
  const label = wishTopics.find((w) => w.slug === topic)?.label;
  return (
    <div>
      <PageHeader eyebrow="Lessons, shared" title={<>I wish <em className="italic text-plum-600">I’d</em> known…</>} subtitle="Small warnings and big realisations from women who learned the hard way — so you don’t have to."
        action={<Link to={`/share/wish${topic ? `?topic=${topic}` : ''}`} className="btn-primary btn-sm hidden shrink-0 sm:inline-flex">Add yours</Link>} />
      <div className="scroll-x -mx-4 mb-5 px-4">
        <Chip active={!topic} onClick={() => setTopic('')}>Everything</Chip>
        {wishTopics.map((w) => <Chip key={w.slug} active={topic === w.slug} onClick={() => setTopic(w.slug)}>{w.label}</Chip>)}
      </div>
      <PostList query={{ kind: 'wish', wishTopic: topic || undefined, filter: 'latest' }}
        empty={<EmptyState icon={<Quote size={22} />} title={label ? `No lessons yet — ${label.toLowerCase()}` : 'No lessons shared yet'} action={<Link to={`/share/wish${topic ? `?topic=${topic}` : ''}`} className="btn-primary btn-sm">Share what you wish you’d known</Link>}>
          What do you wish someone had told you? Your hindsight is someone else’s head start.</EmptyState>} />
      <Link to={`/share/wish${topic ? `?topic=${topic}` : ''}`} className="btn-primary btn-lg mt-8 w-full sm:hidden">Add yours</Link>
    </div>
  );
}
