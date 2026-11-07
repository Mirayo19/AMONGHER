import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Ban, BadgeCheck, Calendar, EyeOff, Flag, MapPin, MessageSquarePlus, MoreHorizontal, Settings as Cog, UserCheck, UserPlus } from 'lucide-react';
import { api } from '@/data/api';
import { errorMessage } from '@/lib/errors';
import { useAsync, useTitle } from '@/lib/hooks';
import type { Member } from '@/lib/types';
import { useAuth } from '@/state/auth';
import { useTaxonomy } from '@/state/taxonomy';
import { useToast } from '@/state/toast';
import { PostList } from '@/components/Feed';
import RequestDialog from '@/components/RequestDialog';
import { ReportDialog } from '@/components/Safety';
import { Avatar, Button, ConfirmSheet, EmptyState, Menu, MenuItem, Notice, SkeletonCards, Tabs, VerifiedBadge } from '@/components/ui';

export default function Profile() {
  const { username } = useParams(); const { me } = useAuth();
  const handle = username ?? me?.username ?? '';
  const isMe = !!me && handle.toLowerCase() === me.username;
  const { data: member, loading, setData } = useAsync(() => (isMe ? Promise.resolve<Member | null>(null) : api.getMember(handle)), [handle, isMe]);
  useTitle(`@${handle}`);
  if (isMe && me) return <ProfileView m={{ id: me.id, username: me.username, avatar_motif: me.avatar_motif, avatar_tone: me.avatar_tone, verified_contributor: me.verified_contributor, created_at: '', visibility: me.visibility, is_me: true, bio: me.bio, location: me.location, interests: me.interests, followed_by_me: false }} />;
  if (loading) return <SkeletonCards n={2} />;
  if (!member) return <EmptyState title="Member not found" action={<Link to="/home" className="btn-primary btn-sm">Back to Home</Link>}>This profile doesn’t exist, or you can’t see it.</EmptyState>;
  return <ProfileView m={member} onFollow={(v) => setData({ ...member, followed_by_me: v })} />;
}

function ProfileView({ m, onFollow }: { m: Member; onFollow?: (v: boolean) => void }) {
  const { me } = useAuth(); const { categories } = useTaxonomy(); const toast = useToast(); const nav = useNavigate();
  const [tab, setTab] = useState<'posts' | 'saved'>('posts');
  const [dlg, setDlg] = useState<null | 'message' | 'report' | 'block'>(null);
  const isMe = m.is_me || m.id === me?.id;
  const interests = m.interests.map((s) => categories.find((c) => c.slug === s)).filter(Boolean);
  const follow = async () => {
    try { await api.setFollow(m.id, !m.followed_by_me); onFollow?.(!m.followed_by_me); toast(m.followed_by_me ? `Unfollowed @${m.username}` : `Following @${m.username}`); } catch (e) { toast(errorMessage(e), 'error'); }
  };
  return (
    <div>
      <section className="card relative overflow-hidden p-6">
        <div aria-hidden className="absolute inset-x-0 top-0 h-20 bg-gradient-to-br from-plum-200/70 via-plum-100 to-brass-300/30" />
        <div className="relative flex items-end justify-between">
          <Avatar motif={m.avatar_motif} tone={m.avatar_tone} size={84} className="ring-4 ring-ivory-50" />
          {isMe ? <Link to="/settings" className="btn-secondary btn-sm"><Cog size={15} />Edit profile</Link> : (
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant={m.followed_by_me ? 'secondary' : 'primary'} onClick={follow}>{m.followed_by_me ? <UserCheck size={16} /> : <UserPlus size={16} />}{m.followed_by_me ? 'Following' : 'Follow'}</Button>
              <Button size="sm" variant="secondary" onClick={() => setDlg('message')}><MessageSquarePlus size={16} />Message</Button>
              <Menu trigger={<MoreHorizontal size={19} />}>{(close) => (<>
                <MenuItem icon={<Flag size={17} />} onClick={() => { close(); setDlg('report'); }}>Report @{m.username}</MenuItem>
                <MenuItem danger icon={<Ban size={17} />} onClick={() => { close(); setDlg('block'); }}>Block @{m.username}</MenuItem>
              </>)}</Menu>
            </div>)}
        </div>
        <h1 className="relative mt-4 flex items-center gap-1.5 text-2xl font-semibold">@{m.username}{m.verified_contributor && <VerifiedBadge />}</h1>
        {m.verified_contributor && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-brass-700"><BadgeCheck size={14} />Verified contributor, reviewed by the AMONGHER team</p>}
        {m.bio ? <p className="prose-body mt-3">{m.bio}</p> : isMe ? <p className="mt-3 text-sm text-ink-muted">Add a short bio in <Link to="/settings" className="font-semibold text-plum-700 underline">Settings</Link>. It’s optional.</p> : null}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-muted">
          {m.location && <span className="flex items-center gap-1"><MapPin size={14} />{m.location}</span>}
          {m.created_at && <span className="flex items-center gap-1"><Calendar size={14} />Joined {new Date(m.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>}
        </div>
        {!!interests.length && <div className="mt-4 flex flex-wrap gap-1.5">{interests.map((c) => <Link key={c!.id} to={`/explore/${c!.slug}`} className="rounded-full bg-plum-50 px-3 py-1 text-xs font-semibold text-plum-800 hover:bg-plum-100">{c!.name}</Link>)}</div>}
        {m.visibility === 'private' && !isMe && <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-muted"><EyeOff size={13} />This member keeps her bio private.</p>}
        {isMe && m.visibility === 'private' && <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-muted"><EyeOff size={13} />Your profile is private: others see only your username and avatar.</p>}
      </section>

      <div className="my-5">{isMe ? <Tabs value={tab} onChange={setTab} items={[{ id: 'posts', label: 'My posts' }, { id: 'saved', label: 'Saved experiences' }]} /> : <h2 className="text-xl font-semibold">Posts</h2>}</div>
      {isMe && tab === 'posts' && <Notice tone="info" className="mb-4">This list includes your anonymous posts. Only you (and moderators, if reported) can tell they’re yours.</Notice>}
      {isMe && tab === 'saved'
        ? <PostList query={{ bookmarked: true }} empty={<EmptyState title="Nothing saved yet">Tap the bookmark on any post to keep it here.</EmptyState>} />
        : <PostList query={isMe ? { mine: true } : { authorId: m.id }} empty={<EmptyState title={isMe ? 'You haven’t posted yet' : 'No public posts'} action={isMe ? <Link to="/share" className="btn-primary btn-sm">Share something</Link> : undefined}>{isMe ? 'Your first post could help someone.' : 'Anonymous posts are never attributed to a profile.'}</EmptyState>} />}

      {!isMe && <>
        <RequestDialog open={dlg === 'message'} onClose={() => setDlg(null)} recipient={{ id: m.id, username: m.username }} />
        <ReportDialog open={dlg === 'report'} onClose={() => setDlg(null)} type="user" targetId={m.id} label={`@${m.username}`} />
        <ConfirmSheet open={dlg === 'block'} onClose={() => setDlg(null)} title={`Block @${m.username}?`} confirmLabel="Block" danger
          onConfirm={async () => { await api.setBlock(m.id, true); toast(`Blocked @${m.username}`); nav('/home'); }}>
          You won’t see each other’s posts or profiles, and neither of you can message the other. You can unblock any time from Settings.
        </ConfirmSheet>
      </>}
    </div>
  );
}
