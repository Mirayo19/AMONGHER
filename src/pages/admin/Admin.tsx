import { useMemo, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { AlertTriangle, Ban, CheckCircle2, ExternalLink, EyeOff, Flag, Plus, Search, ShieldAlert, Trash2, Undo2, UserCheck, X } from 'lucide-react';
import { api } from '@/data/api';
import { errorMessage } from '@/lib/errors';
import { useAsync, useTitle } from '@/lib/hooks';
import type { AdminUser, Appeal, Category, Collection, Comment, ContentStatus, ItemType, Post, Report, Role, Tone, VerificationRequest } from '@/lib/types';
import { cx, fullDate, timeAgo, toneClass } from '@/lib/util';
import { useAuth } from '@/state/auth';
import { invalidateTaxonomy, useTaxonomy } from '@/state/taxonomy';
import { useToast } from '@/state/toast';
import { REPORT_REASONS } from '@/components/Safety';
import { Avatar, Button, CategoryIcon, ConfirmSheet, EmptyState, ErrorState, Field, Input, Notice, PageHeader, Select, Sheet, SkeletonCards, Spinner, Switch, Tabs, Textarea } from '@/components/ui';
import { ITEM_TYPES } from '../Library';

const TONES: Tone[] = ['rose', 'plum', 'blue', 'sage', 'apricot', 'indigo', 'clay', 'ochre'];
const ICONS = ['heart-pulse', 'users', 'briefcase', 'wallet', 'baby', 'graduation-cap', 'shield', 'sparkles'];

export function AdminLayout() {
  useTitle('Admin');
  const { me } = useAuth(); const admin = me?.role === 'admin';
  const links = [
    { to: '/admin', label: 'Overview', end: true, all: true }, { to: '/admin/reports', label: 'Reports', all: true }, { to: '/admin/content', label: 'Content', all: true },
    { to: '/admin/users', label: 'Users' }, { to: '/admin/categories', label: 'Categories' }, { to: '/admin/collections', label: 'Collections' },
    { to: '/admin/verification', label: 'Verification' }, { to: '/admin/appeals', label: 'Appeals' }, { to: '/admin/activity', label: 'Activity', all: true },
  ].filter((l) => admin || l.all);
  return (
    <div>
      <PageHeader eyebrow={admin ? 'Administrator' : 'Moderator'} title={admin ? 'Admin dashboard' : 'Moderation'} subtitle="Every action here is checked again by the database, and recorded in the audit log." />
      <nav className="scroll-x -mx-4 mb-6 px-4" aria-label="Admin sections">
        {links.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => cx('shrink-0 rounded-full px-4 py-2 text-sm font-semibold', isActive ? 'bg-plum-900 text-ivory-50' : 'text-ink-muted hover:bg-plum-100/70')}>{l.label}</NavLink>)}
      </nav>
      <Outlet />
    </div>
  );
}

/* ---------------------------------------------------------------- Overview */
export function AdminOverview() {
  const { data: s, loading, error, reload } = useAsync(() => api.staffStats(), []);
  const { me } = useAuth(); const admin = me?.role === 'admin';
  if (loading) return <SkeletonCards n={2} />;
  if (error || !s) return <ErrorState message={error ?? 'No data'} onRetry={() => reload()} />;
  const tiles = [
    { l: 'Open reports', v: s.open_reports, to: '/admin/reports', hot: s.open_reports > 0 },
    { l: 'Auto-hidden, awaiting review', v: s.under_review, to: '/admin/content', hot: s.under_review > 0 },
    { l: 'Sensitive posts to review', v: s.sensitive_unreviewed, to: '/admin/content', hot: s.sensitive_unreviewed > 0 },
    ...(admin ? [{ l: 'Pending appeals', v: s.pending_appeals, to: '/admin/appeals', hot: s.pending_appeals > 0 }, { l: 'Verification requests', v: s.pending_verifications, to: '/admin/verification', hot: s.pending_verifications > 0 }, { l: 'Suspended accounts', v: s.suspended, to: '/admin/users', hot: false }] : []),
  ];
  const max = Math.max(1, ...s.daily.map((d) => d.posts + d.comments));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.l} to={t.to} className={cx('card p-4 transition hover:shadow-lift', t.hot && 'ring-2 ring-brass-300')}>
            <p className="font-display text-3xl font-semibold text-plum-900 tabular-nums">{t.v}</p><p className="mt-1 text-[13px] leading-snug text-ink-muted">{t.l}</p>
          </Link>))}
      </div>
      <section className="card p-5">
        <h2 className="text-lg font-semibold">Activity, last 14 days</h2>
        <svg viewBox="0 0 420 140" className="mt-3 w-full" role="img" aria-label="Posts and comments per day">
          {s.daily.map((d, i) => {
            const x = 8 + i * 29.5; const hp = (d.posts / max) * 100; const hc = (d.comments / max) * 100;
            return <g key={d.day}><rect x={x} y={110 - hp} width="11" height={hp} rx="2.5" fill="#5e2c52" /><rect x={x + 12} y={110 - hc} width="11" height={hc} rx="2.5" fill="#b08a4c" />
              {i % 2 === 0 && <text x={x + 11} y="128" textAnchor="middle" fontSize="8.5" fill="#7a6b73">{d.day.slice(5)}</text>}</g>;
          })}
          <line x1="4" x2="416" y1="110" y2="110" stroke="#e8dfd0" />
        </svg>
        <p className="mt-1 flex gap-4 text-xs text-ink-muted"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-plum-700" />Posts</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-brass-500" />Comments</span></p>
      </section>
      <section className="card grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        {[['Members', s.members], ['New this week', s.new_members_7d], ['Posts this week', s.posts_7d], ['Messages this week', s.messages_7d]].map(([l, v]) => <div key={l as string}><p className="font-display text-2xl font-semibold tabular-nums">{v}</p><p className="text-xs text-ink-muted">{l}</p></div>)}
        <p className="col-span-full text-xs text-ink-muted">Message counts are totals only. Administrators cannot read private conversations; moderators see messages only when a participant reports a conversation.</p>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- Reports */
function TargetPreview({ r }: { r: Report }) {
  const t = useAsync(async () => {
    if (r.target_type === 'post') return { post: await api.getPost(r.target_id) };
    if (r.target_type === 'comment') return { comment: await api.staffGetComment(r.target_id) };
    if (r.target_type === 'user') return { member: await api.staffGetMemberById(r.target_id) };
    return {};
  }, [r.id]);
  if (t.loading) return <Spinner />;
  const d = t.data ?? {};
  if ('post' in d) return d.post ? <div className="rounded-xl bg-plum-50/70 p-3.5 text-sm"><p className="font-semibold">{d.post.title}</p><p className="prose-body mt-1 line-clamp-6 text-[13.5px]">{d.post.body}</p><p className="mt-2 text-xs text-ink-muted">Status: <b>{d.post.status}</b> · by {d.post.author_username ? `@${d.post.author_username}` : 'unknown'}{d.post.is_anonymous && ' (anonymous to members)'}</p></div> : <p className="text-sm text-ink-muted">Post no longer exists.</p>;
  if ('comment' in d) return d.comment ? <div className="rounded-xl bg-plum-50/70 p-3.5 text-sm"><p className="prose-body text-[13.5px]">{d.comment.body}</p><p className="mt-2 text-xs text-ink-muted">Status: <b>{d.comment.status}</b> · by {d.comment.author_username ? `@${d.comment.author_username}` : 'unknown'}</p></div> : <p className="text-sm text-ink-muted">Comment no longer exists.</p>;
  if ('member' in d) return d.member ? <p className="rounded-xl bg-plum-50/70 p-3.5 text-sm">Member <b>@{d.member.username}</b>{d.member.bio && <> — {d.member.bio}</>}</p> : <p className="text-sm text-ink-muted">Member no longer exists.</p>;
  const ev = (r.evidence as { from_reporter: boolean; body: string; at: string; reported?: boolean }[] | null) ?? [];
  return <div className="space-y-1 rounded-xl bg-plum-50/70 p-3.5 text-[13px]"><p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-muted">{r.target_type === 'message' ? 'Reported message, with the messages before it' : 'Messages attached by the reporter'}</p>{ev.length ? ev.map((m, i) => <p key={i} className={cx(m.reported && 'rounded-md bg-clay-100 px-1.5 py-1 font-semibold text-clay-700')}><b>{m.from_reporter ? 'Reporter' : 'Reported'}:</b> {m.body}</p>) : <p className="text-ink-muted">No messages.</p>}</div>;
}

export function AdminReports() {
  const toast = useToast(); const { me } = useAuth();
  const [status, setStatus] = useState<Report['status'] | 'all'>('open');
  const { data, loading, error, reload } = useAsync(() => api.staffListReports(status), [status]);
  const [act, setAct] = useState<{ r: Report; resolution: 'actioned' | 'dismissed'; content: ContentStatus | null } | null>(null);
  const [note, setNote] = useState(''); const [suspend, setSuspend] = useState<Report | null>(null);
  const [group, setGroup] = useState<'items' | 'members'>('items');
  const counts = useMemo(() => { const m = new Map<string, number>(); (data ?? []).forEach((r) => m.set(r.target_id, (m.get(r.target_id) ?? 0) + 1)); return m; }, [data]);
  const doResolve = async () => {
    if (!act) return;
    try { await api.staffResolveReport(act.r.id, act.resolution, note.trim() || undefined, act.content); toast('Report resolved'); setAct(null); setNote(''); void reload(true); } catch (e) { toast(errorMessage(e), 'error'); }
  };
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={status} onChange={setStatus} items={[{ id: 'open', label: 'Open' }, { id: 'actioned', label: 'Actioned' }, { id: 'dismissed', label: 'Dismissed' }, { id: 'all', label: 'All' }]} />
        <Tabs value={group} onChange={setGroup} items={[{ id: 'items', label: 'By report' }, { id: 'members', label: 'By member' }]} />
      </div>
      {group === 'members' && data ? <ByMember reports={data} onSuspend={(id) => setSuspend({ reported_user_id: id } as Report)} /> : loading ? <SkeletonCards n={2} /> : error ? <ErrorState message={error} onRetry={() => reload()} /> : !data?.length ? <EmptyState icon={<Flag size={22} />} title="Nothing here">No reports match this filter.</EmptyState> : (
        <ul className="space-y-4">{data.map((r) => (
          <li key={r.id} className="card p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-clay-100 px-2.5 py-1 text-[11px] font-bold text-clay-700">{REPORT_REASONS.find((x) => x.id === r.reason)?.label ?? r.reason}</span>
              <span className="eyebrow text-ink-muted">{r.target_type}</span>
              {(counts.get(r.target_id) ?? 0) > 1 && <span className="text-xs font-semibold text-brass-700">{counts.get(r.target_id)} reports on this item</span>}
              <span className="ml-auto text-xs text-ink-muted">{timeAgo(r.created_at)}</span>
            </div>
            {r.details && <p className="mt-3 text-sm italic text-ink-soft">“{r.details}”</p>}
            <div className="mt-3"><TargetPreview r={r} /></div>
            {r.status === 'open' ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setAct({ r, resolution: 'dismissed', content: null })}><CheckCircle2 size={15} />Dismiss</Button>
                {(r.target_type === 'post' || r.target_type === 'comment') && <>
                  <Button size="sm" variant="secondary" onClick={() => setAct({ r, resolution: 'actioned', content: 'hidden' })}><EyeOff size={15} />Hide</Button>
                  <Button size="sm" variant="danger" onClick={() => setAct({ r, resolution: 'actioned', content: 'removed' })}><Trash2 size={15} />Remove</Button></>}
                {r.target_type !== 'post' && r.target_type !== 'comment' && <Button size="sm" variant="secondary" onClick={() => setAct({ r, resolution: 'actioned', content: null })}>Mark actioned</Button>}
                {me?.role === 'admin' && r.reported_user_id && <Button size="sm" variant="danger" onClick={() => setSuspend(r)}><Ban size={15} />Suspend member</Button>}
              </div>
            ) : <p className="mt-3 text-xs text-ink-muted"><b className="capitalize">{r.status}</b>{r.resolution_note && <> — {r.resolution_note}</>}</p>}
          </li>))}</ul>)}
      <Sheet open={!!act} onClose={() => setAct(null)} title={act?.resolution === 'dismissed' ? 'Dismiss report' : act?.content ? `${act.content === 'hidden' ? 'Hide' : 'Remove'} content` : 'Mark as actioned'}
        footer={<><Button variant="quiet" onClick={() => setAct(null)}>Cancel</Button><Button onClick={doResolve} variant={act?.content === 'removed' ? 'danger' : 'primary'}>Confirm</Button></>}>
        <Field label="Note for the audit log (optional)"><Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="min-h-[90px]" /></Field>
        {act?.resolution === 'dismissed' && <p className="hint">If the content was auto-hidden by member reports and no other reports are open, it will be restored.</p>}
      </Sheet>
      {suspend?.reported_user_id && <SuspendSheet userId={suspend.reported_user_id} name="this member" onClose={() => { setSuspend(null); void reload(true); }} />}
    </div>
  );
}

/** Repeat-offender view: who is being reported most, and for what. */
function ByMember({ reports, onSuspend }: { reports: Report[]; onSuspend: (id: string) => void }) {
  const { me } = useAuth();
  const groups = useMemo(() => {
    const m = new Map<string, Report[]>();
    reports.filter((r) => r.reported_user_id).forEach((r) => m.set(r.reported_user_id!, [...(m.get(r.reported_user_id!) ?? []), r]));
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [reports]);
  const names = useAsync(async () => new Map(await Promise.all(groups.map(async ([id]) => [id, (await api.staffGetMemberById(id))?.username ?? null] as const))), [groups.map((g) => g[0]).join()]);
  if (!groups.length) return <EmptyState icon={<Flag size={22} />} title="Nothing here">No reports against members in this filter.</EmptyState>;
  return (
    <ul className="space-y-3">{groups.map(([id, rs]) => {
      const reasons = [...new Set(rs.map((r) => REPORT_REASONS.find((x) => x.id === r.reason)?.label ?? r.reason))];
      const reporters = new Set(rs.map((r) => r.reporter_id)).size;
      return (
        <li key={id} className={cx('card flex flex-wrap items-center gap-3 p-4', reporters >= 3 && 'ring-2 ring-clay-500/40')}>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{names.data?.get(id) ? `@${names.data.get(id)}` : 'Deleted member'} <span className="font-normal text-ink-muted">· {rs.length} {rs.length === 1 ? 'report' : 'reports'} from {reporters} {reporters === 1 ? 'member' : 'members'}</span></p>
            <p className="mt-0.5 text-xs text-ink-muted">{reasons.join(' · ')}</p>
            {reporters >= 3 && <p className="mt-1 text-xs font-bold text-clay-700">Pattern: three or more members have reported this account.</p>}
          </div>
          {me?.role === 'admin' && <Button size="sm" variant="danger" onClick={() => onSuspend(id)}><Ban size={15} />Suspend</Button>}
        </li>);
    })}</ul>
  );
}

/* ---------------------------------------------------------------- Content */
export function AdminContent() {
  const toast = useToast();
  const [tab, setTab] = useState<'attention' | 'posts' | 'comments'>('attention');
  const [q, setQ] = useState(''); const [status, setStatus] = useState<ContentStatus | 'any'>('any');
  const posts = useAsync(async () => {
    if (tab === 'comments') return [] as Post[];
    if (tab === 'attention') return api.staffReviewQueue();     // computed by the database: auto-hidden + sensitive-and-unreviewed
    return api.listPosts({ status, search: q || undefined, limit: 50 });
  }, [tab, status, q]);
  const comments = useAsync(() => (tab === 'comments' ? api.staffListComments(status) : Promise.resolve([] as Comment[])), [tab, status]);
  const act = async (type: 'post' | 'comment', id: string, s: 'published' | 'hidden' | 'removed') => {
    try { await api.staffSetContentStatus(type, id, s); toast(s === 'published' ? 'Approved / restored' : s === 'hidden' ? 'Hidden' : 'Removed'); void (type === 'post' ? posts.reload(true) : comments.reload(true)); } catch (e) { toast(errorMessage(e), 'error'); }
  };
  const Actions = ({ type, id, st }: { type: 'post' | 'comment'; id: string; st: ContentStatus }) => (
    <div className="mt-3 flex flex-wrap gap-2">
      {st !== 'published' ? <Button size="sm" variant="secondary" onClick={() => act(type, id, 'published')}><Undo2 size={14} />Restore</Button> : <Button size="sm" variant="secondary" onClick={() => act(type, id, 'published')}><CheckCircle2 size={14} />Approve</Button>}
      {st !== 'hidden' && <Button size="sm" variant="secondary" onClick={() => act(type, id, 'hidden')}><EyeOff size={14} />Hide</Button>}
      {st !== 'removed' && <Button size="sm" variant="danger" onClick={() => act(type, id, 'removed')}><Trash2 size={14} />Remove</Button>}
    </div>);
  return (
    <div>
      <div className="mb-4"><Tabs value={tab} onChange={setTab} items={[{ id: 'attention', label: 'Needs attention' }, { id: 'posts', label: 'All posts' }, { id: 'comments', label: 'Comments' }]} /></div>
      {tab !== 'attention' && (
        <div className="mb-4 flex gap-2">
          {tab === 'posts' && <div className="relative flex-1"><Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" /><input className="input pl-10" placeholder="Search posts…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search posts" /></div>}
          <Select value={status} onChange={(e) => setStatus(e.target.value as ContentStatus | 'any')} className="w-44" aria-label="Status"><option value="any">Any status</option><option value="published">Published</option><option value="under_review">Under review</option><option value="hidden">Hidden</option><option value="removed">Removed</option></Select>
        </div>)}
      {tab === 'attention' && <Notice tone="care" className="mb-4" title="Review queue">Auto-hidden items (three member reports) and sensitive posts. “Approve” marks a sensitive post as reviewed — required before it can be featured in the Library.</Notice>}
      {(tab === 'comments' ? comments.loading : posts.loading) ? <SkeletonCards n={2} /> : tab === 'comments' ? (
        comments.data?.length ? <ul className="space-y-3">{comments.data.map((c) => <li key={c.id} className="card p-4"><p className="prose-body text-[14px]">{c.body}</p><p className="mt-2 text-xs text-ink-muted">{c.author_username ? `@${c.author_username}` : '—'} · {timeAgo(c.created_at)} · <b>{c.status}</b></p><Actions type="comment" id={c.id} st={c.status} /></li>)}</ul> : <EmptyState title="No comments">Nothing matches.</EmptyState>
      ) : posts.data?.length ? <ul className="space-y-3">{posts.data.map((p) => (
        <li key={p.id} className="card p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-plum-100 px-2 py-0.5 font-bold text-plum-800">{p.kind}</span><b className="uppercase tracking-wide text-ink-muted">{p.status.replace('_', ' ')}</b>{p.sensitive && <span className="flex items-center gap-1 font-bold text-brass-700"><ShieldAlert size={12} />sensitive</span>}<span className="ml-auto text-ink-muted">{p.author_username ? `@${p.author_username}` : '—'}{p.is_anonymous && ' (anon)'} · {timeAgo(p.created_at)}</span></div>
          <Link to={`/post/${p.id}`} className="mt-2 block font-semibold hover:text-plum-700">{p.title}</Link><p className="prose-body mt-1 line-clamp-3 text-[13.5px]">{p.body}</p><Actions type="post" id={p.id} st={p.status} />
        </li>))}</ul> : <EmptyState icon={<CheckCircle2 size={22} />} title="All clear">Nothing needs attention.</EmptyState>}
    </div>
  );
}

/* ---------------------------------------------------------------- Users */
function SuspendSheet({ userId, name, onClose }: { userId: string; name: string; onClose: () => void }) {
  const toast = useToast(); const [reason, setReason] = useState(''); const [days, setDays] = useState('7'); const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { await api.adminSetAccountStatus(userId, 'suspended', reason.trim(), days === 'indef' ? null : new Date(Date.now() + Number(days) * 864e5).toISOString()); toast('Account suspended'); onClose(); } catch (e) { toast(errorMessage(e), 'error'); } finally { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={`Suspend ${name}`} footer={<><Button variant="quiet" onClick={onClose}>Cancel</Button><Button variant="danger" loading={busy} disabled={reason.trim().length < 5} onClick={go}>Suspend</Button></>}>
      <div className="space-y-4">
        <Field label="Reason (shown to the member)" htmlFor="sr"><Textarea id="sr" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Repeated harassment in replies" className="min-h-[88px]" /></Field>
        <Field label="Duration" htmlFor="sd"><Select id="sd" value={days} onChange={(e) => setDays(e.target.value)}><option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option><option value="indef">Until an administrator reviews</option></Select></Field>
        <p className="hint">The member can still sign in to read the reason and submit an appeal.</p>
      </div>
    </Sheet>
  );
}

export function AdminUsers() {
  const toast = useToast(); const [q, setQ] = useState(''); const [term, setTerm] = useState('');
  const { data, loading, error, reload } = useAsync(() => api.adminListUsers(term), [term]);
  const [sus, setSus] = useState<AdminUser | null>(null);
  const setRole = async (u: AdminUser, role: Role) => { try { await api.adminSetRole(u.id, role); toast(`@${u.username} is now ${role}`); void reload(true); } catch (e) { toast(errorMessage(e), 'error'); } };
  return (
    <div>
      <form className="relative mb-4" onSubmit={(e) => { e.preventDefault(); setTerm(q); }}><Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" /><input className="input pl-10" placeholder="Search by username" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search members" /></form>
      <Notice tone="info" className="mb-4">Email addresses are deliberately not shown here. Look them up in the Supabase dashboard only if there’s a legal or safety need.</Notice>
      {loading ? <SkeletonCards n={2} /> : error ? <ErrorState message={error} onRetry={() => reload()} /> : (
        <ul className="space-y-3">{data?.map((u) => (
          <li key={u.id} className="card flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1"><p className="flex items-center gap-2 font-semibold">@{u.username}{u.role !== 'member' && <span className="rounded bg-plum-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-plum-800">{u.role}</span>}{u.status === 'suspended' && <span className="rounded bg-clay-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-clay-700">suspended</span>}</p>
              <p className="text-xs text-ink-muted">Joined {fullDate(u.created_at)} · {u.post_count} posts{u.open_reports > 0 && <b className="text-clay-700"> · {u.open_reports} open reports</b>}</p>
              {u.status === 'suspended' && u.reason && <p className="mt-1 text-xs text-clay-700">{u.reason}{u.suspended_until && ` · until ${fullDate(u.suspended_until)}`}</p>}</div>
            <Select aria-label={`Role for ${u.username}`} className="!w-36 !py-2 text-sm" value={u.role} onChange={(e) => setRole(u, e.target.value as Role)}><option value="member">Member</option><option value="moderator">Moderator</option><option value="admin">Admin</option></Select>
            {u.status === 'suspended' ? <Button size="sm" variant="secondary" onClick={async () => { try { await api.adminSetAccountStatus(u.id, 'active'); toast('Reinstated'); void reload(true); } catch (e) { toast(errorMessage(e), 'error'); } }}><UserCheck size={15} />Reinstate</Button>
              : <Button size="sm" variant="danger" onClick={() => setSus(u)} disabled={u.role === 'admin'}><Ban size={15} />Suspend</Button>}
          </li>))}</ul>)}
      {sus && <SuspendSheet userId={sus.id} name={`@${sus.username}`} onClose={() => { setSus(null); void reload(true); }} />}
    </div>
  );
}

/* ---------------------------------------------------------------- Categories + situations */
export function AdminCategories() {
  const toast = useToast(); const { allCategories, allSituations, cat, allWishTopics } = useTaxonomy();
  const [topic, setTopic] = useState<{ slug: string; label: string; isNew: boolean } | null>(null);
  const [edit, setEdit] = useState<Partial<Category> | null>(null);
  const [sit, setSit] = useState<{ id?: string; label: string; slug: string; category_id: string | null } | null>(null);
  const save = async () => {
    if (!edit?.name) return;
    try { await api.adminSaveCategory({ ...edit, name: edit.name.trim(), slug: edit.slug || edit.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }); invalidateTaxonomy(); toast('Category saved'); setEdit(null); } catch (e) { toast(errorMessage(e), 'error'); }
  };
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-semibold">Categories</h2><Button size="sm" onClick={() => setEdit({ tone: 'plum', icon: 'sparkles', sensitive: false, is_active: true })}><Plus size={15} />New</Button></div>
        <ul className="space-y-2">{allCategories.map((c) => (
          <li key={c.id} className={cx(toneClass(c.tone), 'card flex items-center gap-3 p-3.5', !c.is_active && 'opacity-60')}>
            <span className="t-bg t-fg flex h-10 w-10 items-center justify-center rounded-xl"><CategoryIcon name={c.icon} /></span>
            <div className="min-w-0 flex-1"><p className="font-semibold">{c.name} {c.sensitive && <span className="ml-1 text-[11px] font-bold text-brass-700">SENSITIVE</span>}{!c.is_active && <span className="ml-1 text-[11px] font-bold text-ink-muted">RETIRED</span>}</p><p className="truncate text-xs text-ink-muted">{c.description}</p></div>
            <Button size="sm" variant="secondary" onClick={() => setEdit(c)}>Edit</Button>
          </li>))}</ul>
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-semibold">Situations</h2><Button size="sm" onClick={() => setSit({ label: '', slug: '', category_id: null })}><Plus size={15} />New</Button></div>
        <p className="mb-3 text-sm text-ink-muted">Used by “Find someone who understands”. Members choose which they’re happy to talk about.</p>
        <ul className="card divide-y divide-ivory-300">{allSituations.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm"><span className={cx('flex-1', !s.is_active && 'text-ink-faint line-through')}>{s.label}<span className="ml-2 text-xs text-ink-muted">{cat(s.category_id)?.name}</span></span>
            <Button size="sm" variant="quiet" onClick={async () => { try { await api.adminSaveSituation({ id: s.id, slug: s.slug, label: s.label, is_active: !s.is_active }); invalidateTaxonomy(); } catch (e) { toast(errorMessage(e), 'error'); } }}>{s.is_active ? 'Retire' : 'Restore'}</Button></li>))}</ul>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-semibold">“I wish I knew” themes</h2><Button size="sm" onClick={() => setTopic({ slug: '', label: '', isNew: true })}><Plus size={15} />New</Button></div>
        <ul className="card divide-y divide-ivory-300">{allWishTopics.map((w) => (
          <li key={w.slug} className="flex items-center gap-3 px-4 py-2.5 text-sm"><span className={cx('flex-1', !w.is_active && 'text-ink-faint line-through')}>{w.label}</span>
            <Button size="sm" variant="quiet" onClick={() => setTopic({ slug: w.slug, label: w.label, isNew: false })}>Rename</Button>
            <Button size="sm" variant="quiet" onClick={async () => { try { await api.adminSaveWishTopic({ slug: w.slug, label: w.label, is_active: !w.is_active }); invalidateTaxonomy(); } catch (e) { toast(errorMessage(e), 'error'); } }}>{w.is_active ? 'Retire' : 'Restore'}</Button></li>))}</ul>
      </section>

      <Sheet open={!!topic} onClose={() => setTopic(null)} title={topic?.isNew ? 'New theme' : 'Rename theme'} footer={<><Button variant="quiet" onClick={() => setTopic(null)}>Cancel</Button><Button disabled={!topic || topic.label.trim().length < 3} onClick={async () => { try { await api.adminSaveWishTopic({ slug: topic!.slug || topic!.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40), label: topic!.label.trim() }); invalidateTaxonomy(); toast('Theme saved'); setTopic(null); } catch (e) { toast(errorMessage(e), 'error'); } }}>Save</Button></>}>
        {topic && <Field label="Label (completes “I wish I’d known…”)" htmlFor="wl"><Input id="wl" value={topic.label} maxLength={60} onChange={(e) => setTopic({ ...topic, label: e.target.value })} placeholder="e.g. Before buying a home" /></Field>}
      </Sheet>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit category' : 'New category'} footer={<><Button variant="quiet" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save} disabled={!edit?.name || edit.name.length < 2}>Save</Button></>}>
        {edit && <div className="space-y-4">
          <Field label="Name" htmlFor="cn"><Input id="cn" value={edit.name ?? ''} maxLength={40} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label="Description" htmlFor="cd"><Textarea id="cd" value={edit.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} className="min-h-[72px]" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Colour"><Select value={edit.tone} onChange={(e) => setEdit({ ...edit, tone: e.target.value as Tone })}>{TONES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
            <Field label="Icon"><Select value={edit.icon} onChange={(e) => setEdit({ ...edit, icon: e.target.value })}>{ICONS.map((t) => <option key={t}>{t}</option>)}</Select></Field>
          </div>
          <Switch checked={!!edit.sensitive} onChange={(v) => setEdit({ ...edit, sensitive: v })} label="Sensitive topic" description="Adds content notes, defaults posts to anonymous and queues them for review." />
          <Switch checked={edit.is_active !== false} onChange={(v) => setEdit({ ...edit, is_active: v })} label="Active" description="Retired categories keep their old posts but can’t be chosen for new ones." />
        </div>}
      </Sheet>
      <Sheet open={!!sit} onClose={() => setSit(null)} title="New situation" footer={<><Button variant="quiet" onClick={() => setSit(null)}>Cancel</Button><Button disabled={!sit || sit.label.trim().length < 3} onClick={async () => { try { await api.adminSaveSituation({ label: sit!.label.trim(), slug: sit!.slug || sit!.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40), category_id: sit!.category_id }); invalidateTaxonomy(); toast('Situation added'); setSit(null); } catch (e) { toast(errorMessage(e), 'error'); } }}>Add</Button></>}>
        {sit && <div className="space-y-4"><Field label="Label (first person)" htmlFor="sl"><Input id="sl" value={sit.label} onChange={(e) => setSit({ ...sit, label: e.target.value })} placeholder="I’m preparing for…" /></Field>
          <Field label="Category"><Select value={sit.category_id ?? ''} onChange={(e) => setSit({ ...sit, category_id: e.target.value || null })}><option value="">None</option>{allCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field></div>}
      </Sheet>
    </div>
  );
}

/* ---------------------------------------------------------------- Collections */
export function AdminCollections() {
  const toast = useToast(); const { allCategories } = useTaxonomy();
  const { data, loading, error, reload } = useAsync(() => api.adminListCollections(), []);
  const [edit, setEdit] = useState<(Partial<Collection> & { title: string }) | null>(null);
  const [manage, setManage] = useState<Collection | null>(null);
  const [del, setDel] = useState<Collection | null>(null);
  const save = async () => {
    if (!edit) return;
    const slug = edit.slug || edit.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
    try { await api.adminSaveCollection(edit.id ?? null, { title: edit.title.trim(), slug, description: edit.description ?? '', curator_note: edit.curator_note ?? 'Entries are chosen by AMONGHER editors from experiences whose authors agreed to be featured, and are reviewed before they appear here.', category_id: edit.category_id ?? null, tone: edit.tone ?? 'plum', status: edit.status ?? 'draft' }); toast('Collection saved'); setEdit(null); void reload(true); }
    catch (e) { toast(errorMessage(e), 'error'); }
  };
  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">Collections</h2><Button size="sm" onClick={() => setEdit({ title: '', status: 'draft', tone: 'plum' })}><Plus size={15} />New collection</Button></div>
      <Notice tone="info" className="mb-4">Only posts that are published, whose author has consented, and (if sensitive) that a moderator has approved can be added. The database enforces this.</Notice>
      {loading ? <SkeletonCards n={2} /> : error ? <ErrorState message={error} onRetry={() => reload()} /> : (
        <ul className="space-y-3">{data?.map((c) => (
          <li key={c.id} className={cx(toneClass(c.tone), 'card p-4')}>
            <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{c.title}</p><p className="text-xs text-ink-muted">{c.entry_count} entries · <b className={c.status === 'published' ? 'text-sage-700' : 'text-clay-700'}>{c.status}</b></p></div>
              <div className="flex shrink-0 gap-1.5"><Button size="sm" variant="secondary" onClick={() => setManage(c)}>Entries</Button><Button size="sm" variant="secondary" onClick={() => setEdit(c)}>Edit</Button><Button size="sm" variant="quiet" aria-label="Delete collection" className="text-clay-700" onClick={() => setDel(c)}><Trash2 size={15} /></Button></div></div>
          </li>))}</ul>)}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit collection' : 'New collection'} footer={<><Button variant="quiet" onClick={() => setEdit(null)}>Cancel</Button><Button disabled={!edit || edit.title.trim().length < 4} onClick={save}>Save</Button></>}>
        {edit && <div className="space-y-4">
          <Field label="Title" htmlFor="ct"><Input id="ct" maxLength={120} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
          <Field label="Description" htmlFor="cdd"><Textarea id="cdd" value={edit.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} className="min-h-[72px]" /></Field>
          <Field label="Curator note" htmlFor="ccn" hint="Shown at the bottom of the collection."><Textarea id="ccn" value={edit.curator_note ?? ''} onChange={(e) => setEdit({ ...edit, curator_note: e.target.value })} className="min-h-[64px]" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category"><Select value={edit.category_id ?? ''} onChange={(e) => setEdit({ ...edit, category_id: e.target.value || null })}><option value="">None</option>{allCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Colour"><Select value={edit.tone ?? 'plum'} onChange={(e) => setEdit({ ...edit, tone: e.target.value as Tone })}>{TONES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
          </div>
          <Switch checked={edit.status === 'published'} onChange={(v) => setEdit({ ...edit, status: v ? 'published' : 'draft' })} label="Published" description="Drafts are visible to staff only." />
        </div>}
      </Sheet>
      {manage && <ManageEntries c={manage} onClose={() => { setManage(null); void reload(true); }} />}
      <ConfirmSheet open={!!del} onClose={() => setDel(null)} title="Delete this collection?" confirmLabel="Delete" danger onConfirm={async () => { await api.adminDeleteCollection(del!.id); toast('Collection deleted'); setDel(null); void reload(true); }}>
        The collection and its list of entries are removed. The original posts are not affected.
      </ConfirmSheet>
    </div>
  );
}

function ManageEntries({ c, onClose }: { c: Collection; onClose: () => void }) {
  const toast = useToast(); const [q, setQ] = useState('');
  const entries = useAsync(() => api.searchLibrary({ collectionId: c.id, limit: 100 }), [c.id]);
  const candidates = useAsync(() => api.listPosts({ status: 'published', allowCurationOnly: true, search: q || undefined, limit: 30 }), [q]);
  const [pick, setPick] = useState<Post | null>(null); const [type, setType] = useState<ItemType>('experience'); const [take, setTake] = useState('');
  const inColl = new Set(entries.data?.map((e) => e.id));
  const add = async () => {
    if (!pick) return;
    try { await api.adminAddCollectionItem(c.id, pick.id, type, take.trim()); toast('Added to collection'); setPick(null); setTake(''); void entries.reload(true); } catch (e) { toast(errorMessage(e), 'error'); }
  };
  return (
    <Sheet open onClose={onClose} title={c.title}>
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-muted">In this collection ({entries.data?.length ?? 0})</h3>
      {entries.data?.length ? <ul className="mb-6 space-y-2">{entries.data.map((e) => <li key={e.entry_id} className="flex items-center gap-2 rounded-xl bg-ivory-50 p-3 text-sm"><span className="flex-1"><b className="text-xs uppercase text-plum-700">{e.item_type}</b> {e.title}</span><button aria-label="Remove entry" onClick={async () => { await api.adminRemoveCollectionItem(e.entry_id); void entries.reload(true); }} className="text-clay-700"><X size={16} /></button></li>)}</ul> : <p className="mb-6 text-sm text-ink-muted">No entries yet.</p>}
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-muted">Add from consenting authors</h3>
      <input className="input mb-3" placeholder="Search eligible posts…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search eligible posts" />
      {pick ? (
        <div className="space-y-3 rounded-2xl border border-plum-200 bg-plum-50/60 p-4">
          <p className="font-semibold">{pick.title}</p>
          <Field label="Entry type"><Select value={type} onChange={(e) => setType(e.target.value as ItemType)}>{ITEM_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</Select></Field>
          <Field label="Key takeaway (written by the editor)" hint={`${take.length}/280`}><Textarea value={take} maxLength={280} onChange={(e) => setTake(e.target.value)} className="min-h-[64px]" placeholder="The one-line lesson." /></Field>
          <div className="flex gap-2"><Button size="sm" onClick={add}>Add entry</Button><Button size="sm" variant="quiet" onClick={() => setPick(null)}>Cancel</Button></div>
        </div>
      ) : candidates.loading ? <Spinner /> : candidates.data?.filter((p) => !inColl.has(p.id)).length ? (
        <ul className="space-y-2">{candidates.data.filter((p) => !inColl.has(p.id)).map((p) => (
          <li key={p.id}><button onClick={() => setPick(p)} className="flex w-full items-start gap-2 rounded-xl border border-ivory-300 bg-ivory-50 p-3 text-left text-sm hover:border-plum-300"><span className="flex-1"><b>{p.title}</b>{p.sensitive && <span className="ml-2 inline-flex items-center gap-0.5 text-[11px] font-bold text-brass-700"><AlertTriangle size={11} />sensitive</span>}</span><Plus size={16} className="mt-0.5 text-plum-600" /></button></li>))}</ul>
      ) : <p className="text-sm text-ink-muted">No eligible posts. Authors must tick “Allow editors to feature this”, and sensitive posts must be approved in Content first.</p>}
    </Sheet>
  );
}

/* ---------------------------------------------------------------- Verification / Appeals / Activity */
function Decision({ labels, onDecide }: { labels: [string, string]; onDecide: (positive: boolean, note: string) => Promise<void> }) {
  const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  const go = async (p: boolean) => { setBusy(true); try { await onDecide(p, note.trim()); } finally { setBusy(false); } };
  return (
    <div className="mt-3 space-y-2"><Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="min-h-[60px] text-sm" placeholder="Note (shown to the member where relevant)" aria-label="Decision note" />
      <div className="flex gap-2"><Button size="sm" loading={busy} onClick={() => go(true)}>{labels[0]}</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => go(false)}>{labels[1]}</Button></div></div>
  );
}

export function AdminVerification() {
  const toast = useToast(); const { data, loading, error, reload } = useAsync(() => api.adminListVerifications(), []);
  const open = async (v: VerificationRequest) => { try { const u = v.evidence_path ? await api.adminEvidenceUrl(v.evidence_path) : null; if (u) window.open(u, '_blank', 'noopener'); else toast('File not available in preview mode', 'error'); } catch (e) { toast(errorMessage(e), 'error'); } };
  if (loading) return <SkeletonCards n={2} />; if (error) return <ErrorState message={error} onRetry={() => reload()} />;
  if (!data?.length) return <EmptyState icon={<CheckCircle2 size={22} />} title="No verification requests" />;
  return <ul className="space-y-4">{data.map((v) => (
    <li key={v.id} className="card p-5">
      <div className="flex items-center justify-between"><p className="font-semibold">@{v.username ?? 'deleted member'}</p><span className={cx('rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase', v.status === 'pending' ? 'bg-brass-300/40 text-brass-700' : v.status === 'approved' ? 'bg-sage-100 text-sage-700' : 'bg-clay-100 text-clay-700')}>{v.status}</span></div>
      <p className="prose-body mt-2 text-[14px]">{v.statement}</p>
      {v.evidence_path && <button onClick={() => open(v)} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-plum-700 underline">View supporting file (private, expires in 2 min)<ExternalLink size={13} /></button>}
      <p className="mt-1 text-xs text-ink-muted">{fullDate(v.created_at)}{v.reviewer_note && ` · Note: ${v.reviewer_note}`}</p>
      {v.status === 'pending' && <Decision labels={['Approve badge', 'Reject']} onDecide={async (ok, note) => { try { await api.adminResolveVerification(v.id, ok ? 'approved' : 'rejected', note); toast(ok ? 'Badge granted' : 'Request rejected'); void reload(true); } catch (e) { toast(errorMessage(e), 'error'); } }} />}
    </li>))}</ul>;
}

export function AdminAppeals() {
  const toast = useToast(); const { data, loading, error, reload } = useAsync(() => api.adminListAppeals(), []);
  if (loading) return <SkeletonCards n={2} />; if (error) return <ErrorState message={error} onRetry={() => reload()} />;
  if (!data?.length) return <EmptyState icon={<CheckCircle2 size={22} />} title="No appeals" />;
  return <ul className="space-y-4">{data.map((a: Appeal) => (
    <li key={a.id} className="card p-5">
      <div className="flex items-center justify-between"><p className="font-semibold">@{a.username ?? 'deleted member'}</p><span className="text-xs text-ink-muted">{fullDate(a.created_at)}</span></div>
      <p className="prose-body mt-2 text-[14px]">{a.message}</p>
      {a.status === 'pending' ? <Decision labels={['Reinstate account', 'Uphold suspension']} onDecide={async (ok, note) => { try { await api.adminResolveAppeal(a.id, ok ? 'granted' : 'denied', note); toast(ok ? 'Account reinstated' : 'Suspension upheld'); void reload(true); } catch (e) { toast(errorMessage(e), 'error'); } }} />
        : <p className="mt-2 text-xs text-ink-muted"><b className="capitalize">{a.status}</b>{a.admin_note && ` — ${a.admin_note}`}</p>}
    </li>))}</ul>;
}

export function AdminActivity() {
  const { data, loading, error, reload } = useAsync(() => api.staffListLog(), []);
  if (loading) return <SkeletonCards n={2} />; if (error) return <ErrorState message={error} onRetry={() => reload()} />;
  if (!data?.length) return <EmptyState title="No activity recorded yet">Moderation and configuration actions are logged here, permanently.</EmptyState>;
  return <ul className="card divide-y divide-ivory-300 overflow-hidden">{data.map((l) => (
    <li key={l.id} className="flex items-center gap-3 px-4 py-3 text-sm"><Avatar size={26} /><div className="min-w-0 flex-1"><p className="font-semibold">{l.action.replace(/_/g, ' ')}</p>{l.note && <p className="truncate text-xs text-ink-muted">{l.note}</p>}</div><span className="shrink-0 text-xs text-ink-muted">{fullDate(l.created_at)}</span></li>))}</ul>;
}

