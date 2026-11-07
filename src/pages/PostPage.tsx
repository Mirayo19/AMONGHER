import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, MessageSquarePlus } from 'lucide-react';
import { api } from '@/data/api';
import { useAsync, useTitle } from '@/lib/hooks';
import { CommentSection } from '@/components/Feed';
import PostCard from '@/components/PostCard';
import RequestDialog from '@/components/RequestDialog';
import { SafetyNotice } from '@/components/Safety';
import { Button, EmptyState, ErrorState, SkeletonCards } from '@/components/ui';

export default function PostPage() {
  const { id = '' } = useParams(); const nav = useNavigate();
  const { data: post, loading, error, reload } = useAsync(() => api.getPost(id), [id]);
  const [ask, setAsk] = useState(false);
  useTitle(post?.title ?? 'Post');
  return (
    <div>
      <button onClick={() => (history.length > 1 ? nav(-1) : nav('/home'))} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-plum-800"><ChevronLeft size={16} />Back</button>
      {loading ? <SkeletonCards n={1} /> : error ? <ErrorState message={error} onRetry={() => reload()} /> : !post ? (
        <EmptyState title="This post isn’t available" action={<Link to="/home" className="btn-primary btn-sm">Back to Home</Link>}>It may have been deleted, hidden by a moderator, or posted by someone you’ve blocked.</EmptyState>
      ) : (<>
        <PostCard post={post} detail onChange={(n) => n && reload(true)} />
        {post.sensitive && <div className="mt-4"><SafetyNotice /></div>}
        {!post.is_mine && post.author_id && !post.is_anonymous && (
          <div className="card mt-4 flex items-center justify-between gap-3 p-4">
            <p className="text-sm text-ink-muted">Want to talk privately with @{post.author_username}? She decides whether to accept.</p>
            <Button variant="secondary" size="sm" onClick={() => setAsk(true)}><MessageSquarePlus size={16} />Request chat</Button>
          </div>
        )}
        <CommentSection post={post} onCountChange={() => reload(true)} />
        {post.author_id && post.author_username && <RequestDialog open={ask} onClose={() => setAsk(false)} recipient={{ id: post.author_id, username: post.author_username }} contextPostId={post.id} prompt={`Hi, your post “${post.title.slice(0, 50)}” really resonated with me…`} />}
      </>)}
    </div>
  );
}
