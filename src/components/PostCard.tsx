import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bookmark, BookmarkCheck, Ban, BookOpen, EyeOff, Flag, Heart, HandHeart, Lightbulb, Link2, MessageCircle,
  MoreHorizontal, Pencil, ShieldAlert, Trash2,
} from 'lucide-react';
import { api } from '@/data/api';
import { errorMessage } from '@/lib/errors';
import type { Post, ReactionType } from '@/lib/types';
import { cx, timeAgo, toneClass } from '@/lib/util';
import { useTaxonomy } from '@/state/taxonomy';
import { useToast } from '@/state/toast';
import { AnonymousAvatar, Avatar, Button, CategoryPill, ConfirmSheet, Counter, Field, Input, Menu, MenuItem, Notice, Sheet, Textarea, VerifiedBadge } from './ui';
import { ReportDialog } from './Safety';

export const REACTIONS: { type: ReactionType; label: string; icon: typeof Heart; key: 'felt_count' | 'helpful_count' | 'strength_count' }[] = [
  { type: 'felt_this', label: 'Felt this', icon: Heart, key: 'felt_count' },
  { type: 'helpful', label: 'Helpful', icon: Lightbulb, key: 'helpful_count' },
  { type: 'sending_strength', label: 'Sending strength', icon: HandHeart, key: 'strength_count' },
];
const KIND_LABEL = { experience: 'Experience', question: 'Question', wish: 'I wish I knew' } as const;

export function Byline({ post }: { post: Post }) {
  const staffView = post.is_anonymous && !post.is_mine && post.author_username;
  const body = post.is_anonymous ? (
    <span className="font-semibold text-ink-soft">Anonymous{post.is_mine && <span className="ml-1 font-normal text-ink-muted">· you</span>}</span>
  ) : post.author_username ? (
    <Link to={post.is_mine ? '/me' : `/u/${post.author_username}`} className="font-semibold text-ink hover:text-plum-700 hover:underline">@{post.author_username}</Link>
  ) : <span className="font-semibold text-ink-muted">Deleted member</span>;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {post.is_anonymous ? <AnonymousAvatar size={34} /> : <Avatar motif={post.author_avatar_motif} tone={post.author_avatar_tone} size={34} />}
      <div className="min-w-0 text-[13px] leading-tight">
        <div className="flex items-center gap-1 truncate">{body}{post.author_verified && !post.is_anonymous && <VerifiedBadge />}</div>
        <div className="text-ink-muted">
          {timeAgo(post.created_at)}
          {staffView && <span className="ml-1.5 rounded bg-plum-100 px-1.5 py-0.5 text-[10px] font-bold text-plum-800">staff view: @{post.author_username}</span>}
        </div>
      </div>
    </div>
  );
}

export function StatusBanner({ post }: { post: Post }) {
  if (post.status === 'published') return null;
  const text = {
    under_review: 'Under review. Hidden from other members until a moderator checks it.',
    hidden: 'Hidden by a moderator. Only you and staff can see this.',
    removed: 'Removed by a moderator for breaking the community guidelines.',
  }[post.status];
  return <div className="mb-3 flex items-center gap-2 rounded-lg bg-clay-100 px-3 py-2 text-xs font-semibold text-clay-700"><EyeOff size={14} />{text}</div>;
}

function EditPostSheet({ post, onClose, onSaved }: { post: Post; onClose: () => void; onSaved: (title: string, body: string) => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(post.title); const [body, setBody] = useState(post.body); const [busy, setBusy] = useState(false);
  const valid = title.trim().length >= 4 && body.trim().length >= 10;
  const save = async () => {
    setBusy(true);
    try { await api.editPost(post.id, title, body); onSaved(title.trim(), body.trim()); toast('Post updated'); onClose(); }
    catch (e) { toast(errorMessage(e), 'error'); } finally { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title="Edit your post" footer={<><Button variant="quiet" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!valid} onClick={save}>Save changes</Button></>}>
      <div className="space-y-4">
        <Field label="Title" htmlFor="et" hint={<Counter value={title.length} max={140} />}><Input id="et" maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Your story" htmlFor="eb" hint={<Counter value={body.length} max={5000} />}><Textarea id="eb" maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[200px]" /></Field>
        {(post.allow_curation || post.comment_count > 0) && (
          <Notice tone="care" title="Before you save">
            {post.comment_count > 0 && 'Replies were written to what you originally said, so consider adding a note rather than rewriting. '}
            {post.allow_curation && 'If editors featured this in a Library collection, it will be removed from it until they review the new version.'}
          </Notice>)}
      </div>
    </Sheet>
  );
}

export default function PostCard({ post, onChange, detail, hideCategory }: { post: Post; onChange?: (p: Post | null) => void; detail?: boolean; hideCategory?: boolean }) {
  const { cat, wishLabel } = useTaxonomy();
  const toast = useToast();
  const [p, setP] = useState(post);
  const [report, setReport] = useState(false);
  const [confirm, setConfirm] = useState<null | 'delete' | 'block'>(null);
  const [editing, setEditing] = useState(false);
  const category = cat(p.category_id);
  const tone = category?.tone ?? 'plum';
  const update = (n: Post) => { setP(n); onChange?.(n); };

  const react = async (type: ReactionType) => {
    const next = p.my_reaction === type ? null : type;
    const prev = p;
    const adj = (r: ReactionType | null, d: number, x: Post): Post => {
      if (!r) return x; const k = REACTIONS.find((q) => q.type === r)!.key;
      return { ...x, [k]: Math.max(0, x[k] + d), reaction_count: Math.max(0, x.reaction_count + d) };
    };
    update({ ...adj(next, 1, adj(p.my_reaction, -1, p)), my_reaction: next });
    try { await api.setReaction(p.id, next); } catch (e) { update(prev); toast(errorMessage(e), 'error'); }
  };
  const bookmark = async () => {
    const prev = p; update({ ...p, bookmarked: !p.bookmarked });
    try { await api.setBookmark(p.id, !prev.bookmarked); toast(prev.bookmarked ? 'Removed from saved' : 'Saved to your experiences'); }
    catch (e) { update(prev); toast(errorMessage(e), 'error'); }
  };
  const remove = async () => { await api.deletePost(p.id); toast('Post deleted'); setConfirm(null); onChange?.(null); if (detail) history.back(); };
  const block = async () => {
    if (!p.author_id) return;
    await api.setBlock(p.author_id, true); toast(`Blocked @${p.author_username}. You won’t see each other’s posts.`); setConfirm(null); onChange?.(null);
  };
  const toggleConsent = async () => {
    try { await api.setCurationConsent(p.id, !p.allow_curation); update({ ...p, allow_curation: !p.allow_curation }); toast(p.allow_curation ? 'No longer eligible for the Library' : 'Editors may now consider this for the Library'); }
    catch (e) { toast(errorMessage(e), 'error'); }
  };

  const long = p.body.length > 340;
  return (
    <article className={cx(toneClass(tone), 'group relative overflow-hidden rounded-2xl border border-ivory-300/80 bg-ivory-50 shadow-soft transition hover:shadow-lift')}>
      <span aria-hidden className="absolute inset-y-0 left-0 w-[5px] bg-[var(--t-line)]" />
      <span aria-hidden className="absolute left-[-3px] top-6 h-[11px] w-[11px] rounded-full border-2 border-ivory-50 bg-[var(--t-fg)]" />
      <div className="py-4 pl-6 pr-4 sm:pl-7 sm:pr-5">
        <StatusBanner post={p} />
        <div className="flex items-start justify-between gap-2">
          <Byline post={p} />
          <Menu trigger={<MoreHorizontal size={19} />}>
            {(close) => (<>
              <MenuItem icon={<Link2 size={17} />} onClick={() => { close(); void navigator.clipboard?.writeText(`${location.origin}/post/${p.id}`).then(() => toast('Link copied')); }}>Copy link</MenuItem>
              {p.is_mine && p.status !== 'removed' && p.status !== 'hidden' && <MenuItem icon={<Pencil size={17} />} onClick={() => { close(); setEditing(true); }}>Edit post</MenuItem>}
              {p.is_mine && p.kind !== 'question' && <MenuItem icon={<BookOpen size={17} />} onClick={() => { close(); void toggleConsent(); }}>{p.allow_curation ? 'Withdraw Library consent' : 'Allow Library feature'}</MenuItem>}
              {p.is_mine
                ? <MenuItem danger icon={<Trash2 size={17} />} onClick={() => { close(); setConfirm('delete'); }}>Delete post</MenuItem>
                : <>
                  <MenuItem icon={<Flag size={17} />} onClick={() => { close(); setReport(true); }}>Report post</MenuItem>
                  {p.author_id && !p.is_anonymous && <MenuItem danger icon={<Ban size={17} />} onClick={() => { close(); setConfirm('block'); }}>Block @{p.author_username}</MenuItem>}
                </>}
            </>)}
          </Menu>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {!hideCategory && <CategoryPill cat={category} />}
          <span className="eyebrow text-[10.5px] text-ink-muted">{KIND_LABEL[p.kind]}</span>
          {p.sensitive && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brass-700"><ShieldAlert size={12} />Sensitive topic</span>}
        </div>

        {p.kind === 'wish' && <p className="mt-2.5 font-display text-[13px] italic text-brass-700">I wish I’d known… {wishLabel(p.wish_topic).toLowerCase()}</p>}
        <h3 className={cx('mt-2 font-semibold leading-snug text-plum-950', detail ? 'text-2xl' : 'text-[19px]')}>
          {detail ? p.title : <Link to={`/post/${p.id}`} className="hover:text-plum-700">{p.kind === 'question' && <span className="mr-1.5 text-[var(--t-fg)]">Q.</span>}{p.title}</Link>}
        </h3>
        {detail && p.kind === 'question' && <p className="eyebrow mt-1 text-[var(--t-fg)]">Asked by the community</p>}
        <p className={cx('prose-body mt-2', !detail && 'line-clamp-5')}>{p.body}</p>
        {!detail && long && <Link to={`/post/${p.id}`} className="mt-1 inline-block text-[13px] font-semibold text-plum-700 hover:underline">Keep reading</Link>}

        <div className={cx('mt-4 border-t border-ivory-300/70 pt-3', !detail && 'flex items-center justify-between gap-2')}>
          <div className={cx(detail ? 'grid grid-cols-3 gap-2' : 'flex flex-wrap items-center gap-1.5')}>
            {REACTIONS.map((r) => {
              const on = p.my_reaction === r.type; const Icon = r.icon; const n = p[r.key];
              return (
                <button key={r.type} onClick={() => react(r.type)} aria-pressed={on} aria-label={`${r.label}${n ? `, ${n}` : ''}`} title={r.label}
                  className={cx('flex items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition',
                    detail ? 'flex-col gap-1 rounded-2xl border px-2 py-2.5 sm:flex-row sm:gap-2' : 'px-2.5 py-1.5',
                    on ? 't-bg t-fg border-[var(--t-line)] ring-1 ring-[var(--t-line)]' : cx('text-ink-muted hover:bg-plum-100/70 hover:text-plum-800', detail && 'border-ivory-300 bg-ivory-100/60'))}>
                  <Icon size={detail ? 18 : 16} strokeWidth={on ? 2.4 : 1.8} fill={on && r.type === 'felt_this' ? 'currentColor' : 'none'} />
                  {detail && <span className="text-[12.5px] leading-none">{r.label}</span>}{n > 0 && <span className="tabular-nums">{n}</span>}
                </button>
              );
            })}
          </div>
          <div className={cx('flex items-center gap-1', detail && 'mt-2 justify-end')}>
            {!detail && (
              <Link to={`/post/${p.id}#comments`} className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-semibold text-ink-muted hover:bg-plum-100/70 hover:text-plum-800" aria-label={`${p.comment_count} comments`}>
                <MessageCircle size={16} strokeWidth={1.8} /><span className="tabular-nums">{p.comment_count || (p.kind === 'question' ? 'Answer' : '')}</span>
              </Link>)}
            <button onClick={bookmark} aria-pressed={p.bookmarked} aria-label={p.bookmarked ? 'Remove from saved' : 'Save'} className={cx('flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-semibold transition', p.bookmarked ? 'text-brass-700' : 'text-ink-muted hover:bg-plum-100/70 hover:text-plum-800')}>
              {p.bookmarked ? <BookmarkCheck size={18} fill="currentColor" fillOpacity={0.18} /> : <Bookmark size={18} strokeWidth={1.8} />}{detail && (p.bookmarked ? 'Saved' : 'Save')}
            </button>
          </div>
        </div>
      </div>

      {editing && <EditPostSheet post={p} onClose={() => setEditing(false)} onSaved={(title, body) => update({ ...p, title, body, allow_curation: p.allow_curation })} />}
      <ReportDialog open={report} onClose={() => setReport(false)} type="post" targetId={p.id} label="post" />
      <ConfirmSheet open={confirm === 'delete'} onClose={() => setConfirm(null)} title="Delete this post?" confirmLabel="Delete" danger onConfirm={remove}>
        This permanently removes your post, its comments and any Library entry that features it.
      </ConfirmSheet>
      <ConfirmSheet open={confirm === 'block'} onClose={() => setConfirm(null)} title={`Block @${p.author_username}?`} confirmLabel="Block" danger onConfirm={block}>
        You won’t see each other’s posts or profiles, and neither of you can message the other. You can undo this any time in Settings.
      </ConfirmSheet>
    </article>
  );
}
