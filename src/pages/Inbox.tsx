import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Ban, BellOff, Bell, ChevronLeft, Flag, Lock, Mail, MoreHorizontal, Send, Trash2, UserCheck } from 'lucide-react';
import { api } from '@/data/api';
import { errorMessage } from '@/lib/errors';
import { useAsync, useTitle } from '@/lib/hooks';
import type { ConversationSummary, Message, MessageRequest } from '@/lib/types';
import { cx, fullDate, timeAgo } from '@/lib/util';
import { useToast } from '@/state/toast';
import { ReportDialog } from '@/components/Safety';
import { Avatar, Button, ConfirmSheet, EmptyState, ErrorState, Menu, MenuItem, Notice, PageHeader, SkeletonCards, Tabs } from '@/components/ui';

export default function Inbox() {
  useTitle('Inbox');
  const [tab, setTab] = useState<'chats' | 'requests'>('chats');
  const convs = useAsync(() => api.listConversations(), []);
  const incoming = useAsync(() => api.listRequests('incoming'), []);
  useEffect(() => { const t = setInterval(() => { void convs.reload(true); void incoming.reload(true); }, 10000); return () => clearInterval(t); }, [convs, incoming]);
  return (
    <div>
      <PageHeader eyebrow="Private" title="Inbox" subtitle="Conversations begin only when someone accepts a request." />
      <div className="mb-5"><Tabs value={tab} onChange={setTab} items={[{ id: 'chats', label: 'Conversations', badge: convs.data?.reduce((n, c) => n + (c.muted ? 0 : c.unread), 0) }, { id: 'requests', label: 'Requests', badge: incoming.data?.length }]} /></div>
      {tab === 'chats' ? <Chats {...convs} /> : <Requests incoming={incoming.data ?? []} loading={incoming.loading} error={incoming.error} reload={() => { void incoming.reload(); void convs.reload(true); }} />}
      <Notice tone="info" className="mt-8" title="About privacy">
        Messages are private between you and the other person, and protected by strict access rules. They are <strong>not end-to-end encrypted</strong>, so don’t share anything you wouldn’t want a platform to hold. Our moderators only see a conversation if one of you reports it.
      </Notice>
    </div>
  );
}

function Chats({ data, loading, error, reload }: { data: ConversationSummary[] | null; loading: boolean; error: string | null; reload: () => void }) {
  if (loading && !data) return <SkeletonCards n={3} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data?.length) return <EmptyState icon={<Mail size={22} />} title="No conversations yet" action={<Link to="/understand" className="btn-primary btn-sm">Find someone who understands</Link>}>When you or another member accept a message request, the conversation will appear here.</EmptyState>;
  return (
    <ul className="card divide-y divide-ivory-300 overflow-hidden">
      {data.map((c) => (
        <li key={c.id}>
          <Link to={`/inbox/${c.id}`} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-plum-50/60">
            <Avatar motif={c.other_avatar_motif} tone={c.other_avatar_tone} size={46} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2"><span className={cx('truncate font-semibold', c.unread && !c.muted ? 'text-plum-950' : 'text-ink')}>@{c.other_username}</span><span className="shrink-0 text-xs text-ink-muted">{timeAgo(c.last_at)}</span></div>
              <p className={cx('mt-0.5 truncate text-sm', c.unread && !c.muted ? 'font-semibold text-ink' : 'text-ink-muted')}>
                {c.blocked ? 'Blocked' : c.last_body ? `${c.last_from_me ? 'You: ' : ''}${c.last_body}` : 'Say hello'}
              </p>
            </div>
            {c.muted && <BellOff size={15} className="shrink-0 text-ink-faint" aria-label="Muted" />}
            {!c.muted && c.unread > 0 && <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brass-500 px-1.5 text-[11px] font-bold text-white">{c.unread}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Requests({ incoming, loading, error, reload }: { incoming: MessageRequest[]; loading: boolean; error: string | null; reload: () => void }) {
  const out = useAsync(() => api.listRequests('outgoing'), []);
  const nav = useNavigate(); const toast = useToast(); const [busy, setBusy] = useState<string | null>(null);
  const respond = async (r: MessageRequest, accept: boolean) => {
    setBusy(r.id);
    try { const id = await api.respondToRequest(r.id, accept); if (accept && id) { toast('Request accepted'); nav(`/inbox/${id}`); } else { toast('Request declined — she won’t be told more than that'); reload(); } }
    catch (e) { toast(errorMessage(e), 'error'); reload(); } finally { setBusy(null); }
  };
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-xl font-semibold">Message requests</h2>
        {loading ? <SkeletonCards n={1} /> : error ? <ErrorState message={error} onRetry={reload} /> : incoming.length === 0
          ? <EmptyState title="No pending requests">You’re never obliged to accept. Anyone who asks to talk will wait here until you decide.</EmptyState>
          : <ul className="space-y-3">{incoming.map((r) => (
            <li key={r.id} className="card p-4">
              <div className="flex items-start gap-3">
                <Avatar motif={r.other_avatar_motif} tone={r.other_avatar_tone} size={42} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2"><Link to={`/u/${r.other_username}`} className="font-semibold hover:underline">@{r.other_username}</Link><span className="text-xs text-ink-muted">{timeAgo(r.created_at)}</span></div>
                  {r.context_title && <p className="mt-0.5 text-xs text-ink-muted">About your post: “{r.context_title}”</p>}
                  <p className="prose-body mt-2 rounded-xl bg-plum-50/70 p-3 font-display italic">{r.intro}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button className="flex-1" size="sm" loading={busy === r.id} onClick={() => respond(r, true)}><UserCheck size={16} />Accept</Button>
                <Button className="flex-1" size="sm" variant="secondary" disabled={busy === r.id} onClick={() => respond(r, false)}>Decline</Button>
              </div>
              <p className="hint mt-2">Not comfortable? Decline, or block and report from her profile.</p>
            </li>))}</ul>}
      </section>
      <section>
        <h2 className="mb-3 text-xl font-semibold">Requests you sent</h2>
        {out.loading ? null : !out.data?.length ? <p className="text-sm text-ink-muted">Nothing sent recently.</p> : (
          <ul className="card divide-y divide-ivory-300">{out.data.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar motif={r.other_avatar_motif} tone={r.other_avatar_tone} size={36} />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">@{r.other_username}</p><p className="truncate text-xs text-ink-muted">{r.intro}</p></div>
              {r.status === 'pending' && <Button size="sm" variant="quiet" onClick={async () => { await api.withdrawRequest(r.id); void out.reload(true); }}>Withdraw</Button>}
              {r.status === 'accepted' && r.conversation_id && <Link to={`/inbox/${r.conversation_id}`} className="btn-secondary btn-sm">Open chat</Link>}
              {r.status === 'declined' && <span className="text-xs font-semibold text-ink-muted">Not accepted</span>}
              {r.status === 'withdrawn' && <span className="text-xs text-ink-muted">Withdrawn</span>}
            </li>))}</ul>)}
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- Conversation */
export function Conversation() {
  const { id = '' } = useParams(); const nav = useNavigate(); const toast = useToast();
  const conv = useAsync(() => api.getConversation(id), [id]);
  const [msgs, setMsgs] = useState<Message[] | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [text, setText] = useState(''); const [sending, setSending] = useState(false);
  const [dlg, setDlg] = useState<null | 'report' | 'block' | 'delete'>(null);
  const bottom = useRef<HTMLDivElement>(null);
  useTitle(conv.data ? `@${conv.data.other_username}` : 'Conversation');

  const load = useCallback(async () => {
    try { const m = await api.listMessages(id); setMsgs(m); void api.markRead(id); } catch { /* transient */ }
  }, [id]);
  useEffect(() => { void api.getMe().then((m) => setMe(m?.id ?? null)); void load(); return api.subscribeMessages(id, () => { void load(); void conv.reload(true); }); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, load]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [msgs?.length]);

  const send = async () => {
    const body = text.trim(); if (!body) return;
    setSending(true);
    try { await api.sendMessage(id, body); setText(''); await load(); } catch (e) { toast(errorMessage(e), 'error'); void conv.reload(true); } finally { setSending(false); }
  };

  if (conv.loading) return <SkeletonCards n={2} />;
  const c = conv.data;
  if (!c) return <EmptyState title="Conversation not found" action={<Link to="/inbox" className="btn-primary btn-sm">Back to Inbox</Link>}>It may have been deleted.</EmptyState>;

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col">
      <div className="sticky top-14 z-20 -mx-4 mb-3 flex items-center gap-2 border-b border-ivory-300/70 bg-ivory-100/95 px-3 py-2.5 backdrop-blur lg:top-14">
        <Link to="/inbox" aria-label="Back to inbox" className="rounded-full p-2 text-ink-muted hover:bg-plum-100"><ChevronLeft size={21} /></Link>
        <Avatar motif={c.other_avatar_motif} tone={c.other_avatar_tone} size={38} />
        <Link to={`/u/${c.other_username}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">@{c.other_username}</Link>
        <Menu trigger={<MoreHorizontal size={20} />}>
          {(close) => (<>
            <MenuItem icon={c.muted ? <Bell size={17} /> : <BellOff size={17} />} onClick={async () => { close(); await api.setMuted(id, !c.muted); toast(c.muted ? 'Notifications on for this chat' : 'Muted — no unread badge for this chat'); void conv.reload(true); }}>{c.muted ? 'Unmute notifications' : 'Mute notifications'}</MenuItem>
            <MenuItem icon={<Flag size={17} />} onClick={() => { close(); setDlg('report'); }}>Report conversation</MenuItem>
            <MenuItem danger icon={<Ban size={17} />} onClick={() => { close(); setDlg('block'); }}>{c.blocked ? 'Unblock' : 'Block'} @{c.other_username}</MenuItem>
            <MenuItem danger icon={<Trash2 size={17} />} onClick={() => { close(); setDlg('delete'); }}>Delete conversation</MenuItem>
          </>)}
        </Menu>
      </div>

      <p className="mx-auto mb-4 flex max-w-xs items-center justify-center gap-1.5 text-center text-[11.5px] leading-snug text-ink-muted"><Lock size={12} className="shrink-0" />Private between you two. Not end-to-end encrypted.</p>
      <div className="flex-1 space-y-1.5 pb-4" aria-live="polite">
        {msgs === null ? <SkeletonCards n={2} /> : msgs.length === 0 && <p className="py-10 text-center text-sm text-ink-muted">Say hello — she accepted your request, so she’d like to hear from you.</p>}
        {msgs?.map((m, i) => {
          const mine = m.sender_id === me; const prev = msgs[i - 1];
          const newGroup = !prev || prev.sender_id !== m.sender_id || +new Date(m.created_at) - +new Date(prev.created_at) > 5 * 60_000;
          return (
            <div key={m.id}>
              {(!prev || +new Date(m.created_at) - +new Date(prev.created_at) > 3600_000) && <p className="my-3 text-center text-[11px] font-semibold text-ink-faint">{fullDate(m.created_at)}</p>}
              <div className={cx('flex', mine ? 'justify-end' : 'justify-start', newGroup && 'mt-2.5')}>
                <p title={fullDate(m.created_at)} className={cx('max-w-[82%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug shadow-soft', mine ? 'rounded-br-md bg-plum-700 text-ivory-50' : 'rounded-bl-md border border-ivory-300 bg-ivory-50 text-ink')}>{m.body}</p>
              </div>
            </div>);
        })}
        <div ref={bottom} />
      </div>

      <div className="sticky bottom-[5.25rem] z-20 -mx-4 border-t border-ivory-300/70 bg-ivory-100/95 px-4 py-3 backdrop-blur lg:bottom-0">
        {c.blocked ? (
          <div className="flex items-center justify-between gap-3 text-sm text-ink-muted"><span>You can’t message this member.</span><Button size="sm" variant="secondary" onClick={async () => { await api.setBlock(c.other_id, false); toast('Unblocked'); void conv.reload(true); }}>Unblock</Button></div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex items-end gap-2">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={2000} aria-label="Message" placeholder="Write a message…"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
              className="input max-h-32 min-h-[46px] flex-1 resize-none rounded-2xl py-3" />
            <Button type="submit" aria-label="Send message" className="h-[46px] w-[46px] shrink-0 rounded-full p-0" loading={sending} disabled={!text.trim()}><Send size={19} /></Button>
          </form>
        )}
      </div>

      <ReportDialog open={dlg === 'report'} onClose={() => setDlg(null)} type="conversation" targetId={id} label="conversation" />
      <ConfirmSheet open={dlg === 'block'} onClose={() => setDlg(null)} title={`${c.blocked ? 'Unblock' : 'Block'} @${c.other_username}?`} confirmLabel={c.blocked ? 'Unblock' : 'Block'} danger={!c.blocked}
        onConfirm={async () => { await api.setBlock(c.other_id, !c.blocked); setDlg(null); toast(c.blocked ? 'Unblocked' : 'Blocked'); void conv.reload(true); }}>
        {c.blocked ? 'You’ll be able to message each other again.' : 'Neither of you will be able to message the other, and you won’t see each other’s posts.'}
      </ConfirmSheet>
      <ConfirmSheet open={dlg === 'delete'} onClose={() => setDlg(null)} title="Delete this conversation?" confirmLabel="Delete" danger
        onConfirm={async () => { await api.deleteConversation(id); toast('Conversation deleted'); nav('/inbox'); }}>
        It disappears from your inbox and your copy of the history is cleared. The other person keeps hers. If she writes again, the conversation will reappear (without the old messages) — block her if you don’t want that.
      </ConfirmSheet>
    </div>
  );
}
