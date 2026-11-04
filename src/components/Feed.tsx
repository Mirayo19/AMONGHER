import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, CornerDownRight, EyeOff, Flag, MoreHorizontal, Trash2 } from 'lucide-react';
import { api, type PostQuery } from '@/data/api';
import { errorMessage } from '@/lib/errors';
import type { Comment, Post } from '@/lib/types';
import { cx, timeAgo } from '@/lib/util';
import { useToast } from '@/state/toast';
import PostCard from './PostCard';
import { SafetyNotice, ReportDialog } from './Safety';
import { AnonymousAvatar, Avatar, Button, ConfirmSheet, EmptyState, ErrorState, Menu, MenuItem, SkeletonCards, Textarea, VerifiedBadge } from './ui';

const PAGE = 12;

/** Paginated list of posts for any PostQuery. */
export function PostList({ query, empty, hideCategory }: { query: PostQuery; empty: ReactNode; hideCategory?: boolean }) {
  const key = JSON.stringify(query);
  const [items, setItems] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gen = useRef(0);

  const load = useCallback(async (offset: number) => {
    const g = ++gen.current;
    offset === 0 ? setLoading(true) : setMore(true);
    try {
      const rows = await api.listPosts({ ...query, limit: PAGE, offset });
      if (g !== gen.current) return;
      setItems((cur) => (offset === 0 ? rows : [...cur, ...rows]));
      setHasMore(rows.length === PAGE); setError(null);
    } catch (e) { if (g === gen.current) setError(errorMessage(e)); }
    finally { if (g === gen.current) { setLoading(false); setMore(false); } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => { setItems([]); void load(0); }, [load]);

  if (loading) return <SkeletonCards />;
  if (error) return <ErrorState message={error} onRetry={() => load(0)} />;
  if (!items.length) return <>{empty}</>;
  return (
    <div className="space-y-4">
      {items.map((p) => (
        <PostCard key={p.id} post={p} hideCategory={hideCategory} onChange={(n) => n === null && setItems((cur) => cur.filter((x) => x.id !== p.id))} />
      ))}
      {hasMore && <div className="flex justify-center pt-2"><Button variant="secondary" loading={more} onClick={() => load(items.length)}>Show more</Button></div>}
    </div>
  );
}

/* ---------------------------------------------------------------- Comments */
function CommentBody({ c, post, onChanged, canReply, onReply }: { c: Comment; post: Post; onChanged: () => void; canReply: boolean; onReply: () => void }) {
  const toast = useToast();
  const [report, setReport] = useState(false);
  const [del, setDel] = useState(false);
  const canMark = post.is_mine && post.kind === 'question' && !c.is_mine;
  const name = c.is_anonymous
    ? <span className="font-semibold text-ink-soft">{c.is_op ? 'Original poster' : 'Anonymous'}{c.is_mine && <span className="ml-1 font-normal text-ink-muted">· you</span>}</span>
    : c.author_username
      ? <Link to={c.is_mine ? '/me' : `/u/${c.author_username}`} className="font-semibold text-ink hover:text-plum-700 hover:underline">@{c.author_username}</Link>
      : <span className="font-semibold text-ink-muted">Deleted member</span>;

  return (
    <div className={cx('rounded-xl', c.is_helpful && 'bg-sage-100/60 p-3 ring-1 ring-sage-500/30')}>
      {c.status !== 'published' && <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-clay-100 px-2.5 py-1.5 text-xs font-semibold text-clay-700"><EyeOff size={13} />{c.status === 'under_review' ? 'Under review' : c.status === 'hidden' ? 'Hidden by a moderator' : 'Removed'}</div>}
      <div className="flex items-start gap-2.5">
        {c.is_anonymous ? <AnonymousAvatar size={28} /> : <Avatar motif={c.author_avatar_motif} tone={c.author_avatar_tone} size={28} />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 text-[13px]">
            {name}{c.author_verified && !c.is_anonymous && <VerifiedBadge />}
            {c.is_op && !c.is_anonymous && <span className="rounded bg-plum-100 px-1.5 py-0.5 text-[10px] font-bold text-plum-800">Original poster</span>}
            <span className="text-ink-muted">{timeAgo(c.created_at)}</span>
            {c.is_anonymous && !c.is_mine && c.author_username && <span className="rounded bg-plum-100 px-1.5 py-0.5 text-[10px] font-bold text-plum-800">staff view: @{c.author_username}</span>}
          </div>
          {c.is_helpful && <p className="mt-1 flex items-center gap-1 text-xs font-bold text-sage-700"><CheckCircle2 size={14} />Marked helpful by the asker</p>}
          <p className="prose-body mt-1">{c.body}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[13px] font-semibold text-ink-muted">
            {canReply && <button onClick={onReply} className="flex items-center gap-1 rounded-full px-2 py-1 hover:bg-plum-100/70 hover:text-plum-800"><CornerDownRight size={14} />Reply</button>}
            {canMark && (
              <button onClick={async () => { try { await api.markHelpful(c.id, !c.is_helpful); onChanged(); } catch (e) { toast(errorMessage(e), 'error'); } }}
                className={cx('flex items-center gap-1 rounded-full px-2 py-1', c.is_helpful ? 'text-sage-700 hover:bg-sage-100' : 'hover:bg-sage-100 hover:text-sage-700')}>
                <CheckCircle2 size={14} />{c.is_helpful ? 'Unmark helpful' : 'Mark as helpful'}
              </button>
            )}
            <Menu trigger={<MoreHorizontal size={16} />} align="left">
              {(close) => c.is_mine
                ? <MenuItem danger icon={<Trash2 size={16} />} onClick={() => { close(); setDel(true); }}>Delete comment</MenuItem>
                : <MenuItem icon={<Flag size={16} />} onClick={() => { close(); setReport(true); }}>Report comment</MenuItem>}
            </Menu>
          </div>
        </div>
      </div>
      <ReportDialog open={report} onClose={() => setReport(false)} type="comment" targetId={c.id} label="comment" />
      <ConfirmSheet open={del} onClose={() => setDel(false)} title="Delete this comment?" confirmLabel="Delete" danger
        onConfirm={async () => { await api.deleteComment(c.id); setDel(false); onChanged(); }}>Replies to it will be removed as well.</ConfirmSheet>
    </div>
  );
}

function CommentComposer({ post, parentId, onDone, autoFocus, placeholder }: { post: Post; parentId?: string | null; onDone: () => void; autoFocus?: boolean; placeholder: string }) {
  const toast = useToast();
  const [body, setBody] = useState('');
  const [anon, setAnon] = useState(false);
  const [busy, setBusy] = useState(false);
  const forced = post.is_anonymous && post.is_mine;
  const submit = async () => {
    setBusy(true);
    try { await api.addComment({ postId: post.id, parentId, body: body.trim(), anonymous: anon || forced }); setBody(''); onDone(); }
    catch (e) { toast(errorMessage(e), 'error'); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-2.5">
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} autoFocus={autoFocus} placeholder={placeholder} className="min-h-[84px]" aria-label={placeholder} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-ink-soft">
          <input type="checkbox" className="h-4 w-4 accent-plum-700" checked={anon || forced} disabled={forced} onChange={(e) => setAnon(e.target.checked)} />
          {forced ? 'Replying anonymously, as the original poster' : 'Reply anonymously'}
        </label>
        <Button size="sm" loading={busy} disabled={!body.trim()} onClick={submit}>Post {parentId ? 'reply' : post.kind === 'question' ? 'answer' : 'comment'}</Button>
      </div>
    </div>
  );
}

export function CommentSection({ post, onCountChange }: { post: Post; onCountChange?: () => void }) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setComments(await api.listComments(post.id)); setError(null); } catch (e) { setError(errorMessage(e)); }
  }, [post.id]);
  useEffect(() => { void load(); }, [load]);
  const changed = () => { void load(); onCountChange?.(); setReplyTo(null); };

  const { tops, replies } = useMemo(() => {
    const all = comments ?? [];
    const t = all.filter((c) => !c.parent_id);
    if (post.kind === 'question') t.sort((a, b) => Number(b.is_helpful) - Number(a.is_helpful));   // helpful answers rise to the top
    const r = new Map<string, Comment[]>();
    all.filter((c) => c.parent_id).forEach((c) => r.set(c.parent_id!, [...(r.get(c.parent_id!) ?? []), c]));
    return { tops: t, replies: r };
  }, [comments, post.kind]);

  const noun = post.kind === 'question' ? 'Answers' : 'Responses';
  return (
    <section id="comments" className="mt-8" aria-label={noun}>
      <h2 className="mb-3 text-xl font-semibold">{noun}{comments ? <span className="ml-2 text-base font-normal text-ink-muted">{comments.length}</span> : null}</h2>
      {post.sensitive && <div className="mb-4"><SafetyNotice compact /><p className="hint mt-2">Please keep replies kind and supportive. Don’t share anyone’s identifying details.</p></div>}
      {post.status === 'published' ? (
        <div className="card mb-6 p-4">
          <CommentComposer post={post} onDone={changed} placeholder={post.kind === 'question' ? 'Share what worked for you…' : 'Add a kind, useful response…'} />
        </div>
      ) : <p className="mb-6 text-sm text-ink-muted">Replies are closed while this post isn’t published.</p>}

      {error ? <ErrorState message={error} onRetry={load} /> : !comments ? <SkeletonCards n={2} /> : tops.length === 0 ? (
        <EmptyState title={post.kind === 'question' ? 'No answers yet' : 'No responses yet'}>
          {post.kind === 'question' ? 'If you’ve been through something similar, your experience could be exactly what she needs.' : 'Be the first to respond with kindness.'}
        </EmptyState>
      ) : (
        <ul className="space-y-5">
          {tops.map((c) => (
            <li key={c.id}>
              <CommentBody c={c} post={post} onChanged={changed} canReply={c.status === 'published' && post.status === 'published'} onReply={() => setReplyTo(replyTo === c.id ? null : c.id)} />
              {(replies.get(c.id)?.length || replyTo === c.id) ? (
                <div className="ml-4 mt-3 space-y-4 border-l-2 border-ivory-300 pl-4 sm:ml-9">
                  {replies.get(c.id)?.map((r) => <CommentBody key={r.id} c={r} post={post} onChanged={changed} canReply={false} onReply={() => {}} />)}
                  {replyTo === c.id && <CommentComposer post={post} parentId={c.id} autoFocus onDone={changed} placeholder="Write a reply…" />}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

