import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseConfig } from '@/lib/config';
import { AppError, toAppError } from '@/lib/errors';
import type {
  AdminUser, Appeal, BlockedMember, Category, Collection, Comment, ConversationSummary, LibraryEntry, LogEntry,
  Me, Member, Message, MessageRequest, Post, Report, Situation, StaffStats, Understander, VerificationRequest,
  WishTopic, Role,
} from '@/lib/types';
import type { Api, PostQuery } from './api';

const EVIDENCE_BUCKET = 'verification-evidence';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export function createSupabaseApi(): Api {
  if (!supabaseConfig) throw new Error('Supabase is not configured');
  // Only the public anon key is used here. Every permission is enforced by Row Level Security.
  const sb: SupabaseClient = createClient(supabaseConfig.url, supabaseConfig.anon, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  const check = ({ data, error }: { data: unknown; error: Any }): Any => { if (error) throw toAppError(error); return data; };
  const uidOrThrow = async () => {
    const { data } = await sb.auth.getSession();
    if (!data.session) throw new AppError('not_authenticated', 'Please log in again.');
    return data.session.user.id;
  };
  const ignoreDuplicate = (error: Any) => { if (error && error.code !== '23505') throw toAppError(error); };
  const rpc = async <T = void>(fn: string, args?: Record<string, unknown>) => check(await sb.rpc(fn, args)) as T;
  /** Prefix-matching full-text query ("pens" finds "pension"). Returns null when nothing searchable remains. */
  const prefixQuery = (raw: string) => {
    const terms = raw.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 0).slice(0, 8);
    return terms.length ? terms.map((t) => `${t}:*`).join(' & ') : null;
  };
  const namesFor = async (ids: (string | null)[]) => {
    const list = [...new Set(ids.filter(Boolean))] as string[];
    if (!list.length) return new Map<string, string>();
    const rows = check(await sb.from('public_profiles').select('id,username').in('id', list)) as Any[];
    return new Map<string, string>(rows.map((r) => [r.id, r.username]));
  };

  return {
    mode: 'supabase',

    // ---------------------------------------------------------------- auth
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange(() => cb());
      return () => data.subscription.unsubscribe();
    },
    async hasSession() { return !!(await sb.auth.getSession()).data.session; },
    async signUp({ email, password, username, ageConfirmed }) {
      if (!ageConfirmed) throw new AppError('age_confirmation_required');
      const { data, error } = await sb.auth.signUp({
        email, password,
        options: {
          data: { username: username.toLowerCase(), age_confirmed: true },
          emailRedirectTo: `${window.location.origin}/login?confirmed=1`,
        },
      });
      if (error) {
        if (/Database error saving new user/i.test(error.message)) throw new AppError('username_unavailable');
        throw toAppError(error);
      }
      // Supabase hides whether an email exists; an empty identities array means it does.
      if (data.user && data.user.identities && data.user.identities.length === 0) throw new AppError('User already registered');
      return { needsEmailVerification: !data.session };
    },
    async signIn(email, password) { check(await sb.auth.signInWithPassword({ email, password })); },
    async signOut() { await sb.auth.signOut(); },
    async requestPasswordReset(email) {
      check(await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset` }));
    },
    async updatePassword(password) { check(await sb.auth.updateUser({ password })); },
    async resendVerification(email) {
      check(await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${window.location.origin}/login?confirmed=1` } }));
    },
    async usernameAvailable(username) { return (await rpc<boolean>('username_available', { p_username: username })) === true; },
    async deleteAccount() { await rpc('delete_my_account'); await sb.auth.signOut(); },
    async exportMyData() { return await rpc<Record<string, unknown>>('export_my_data'); },

    // ---------------------------------------------------------------- me
    async getMe() {
      const { data: s } = await sb.auth.getSession();
      const user = s.session?.user;
      if (!user) return null;
      const [profile, settings, role, status, sits] = await Promise.all([
        sb.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        sb.from('user_settings').select('*').eq('user_id', user.id).maybeSingle(),
        sb.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
        sb.from('account_status').select('*').eq('user_id', user.id).maybeSingle(),
        sb.from('profile_situations').select('situation_id').eq('user_id', user.id),
      ]);
      const p = check(profile) as Any; const st = check(settings) as Any;
      if (!p || !st) return null;
      const stat = check(status) as Any; const r = check(role) as Any;
      const suspended = stat?.status === 'suspended' && (!stat.suspended_until || new Date(stat.suspended_until) > new Date());
      const me: Me = {
        id: user.id, email: user.email ?? '', username: p.username, avatar_motif: p.avatar_motif, avatar_tone: p.avatar_tone,
        bio: p.bio, location: p.location, interests: p.interests ?? [], visibility: p.visibility,
        verified_contributor: p.verified_contributor, onboarded: !!p.onboarded_at,
        role: (r?.role ?? 'member') as Role,
        status: suspended ? 'suspended' : 'active', suspended_reason: stat?.reason ?? null, suspended_until: stat?.suspended_until ?? null,
        settings: st, situation_ids: (check(sits) as Any[]).map((x) => x.situation_id),
      };
      return me;
    },
    async updateProfile(patch) { check(await sb.from('profiles').update(patch).eq('id', await uidOrThrow())); },
    async updateSettings(patch) { check(await sb.from('user_settings').update(patch).eq('user_id', await uidOrThrow())); },
    async setMySituations(ids) {
      const id = await uidOrThrow();
      check(await sb.from('profile_situations').delete().eq('user_id', id));
      if (ids.length) check(await sb.from('profile_situations').insert(ids.map((situation_id) => ({ user_id: id, situation_id }))));
    },

    // ---------------------------------------------------------------- taxonomy
    async listCategories() { return check(await sb.from('categories').select('*').order('sort')) as Category[]; },
    async listSituations() { return check(await sb.from('situations').select('*').order('sort')) as Situation[]; },
    async listWishTopics() { return check(await sb.from('wish_topics').select('*').order('sort')) as WishTopic[]; },

    // ---------------------------------------------------------------- posts
    async listPosts(q: PostQuery) {
      let query = sb.from('post_feed').select('*');
      if (q.mine) query = query.eq('is_mine', true);
      else if (q.status && q.status !== 'any') query = query.eq('status', q.status);
      else if (!q.status) query = query.eq('status', 'published');
      const kind = q.filter === 'questions' ? 'question' : q.filter === 'experiences' ? 'experience' : q.kind;
      if (kind) query = query.eq('kind', kind);
      if (q.filter === 'following') query = query.eq('followed_by_me', true);
      if (q.categoryId) query = query.eq('category_id', q.categoryId);
      if (q.wishTopic) query = query.eq('wish_topic', q.wishTopic);
      if (q.situationId) query = query.eq('situation_id', q.situationId);
      if (q.authorId) query = query.eq('author_id', q.authorId);
      if (q.bookmarked) query = query.eq('bookmarked', true);
      if (q.allowCurationOnly) query = query.eq('allow_curation', true);
      if (q.ids) query = query.in('id', q.ids.length ? q.ids : ['00000000-0000-0000-0000-000000000000']);
      const fts = q.search ? prefixQuery(q.search) : null;
      if (fts) query = query.textSearch('fts', fts, { config: 'simple' });
      query = q.filter === 'popular'
        ? query.order('popularity', { ascending: false }).order('created_at', { ascending: false })
        : query.order('created_at', { ascending: false });
      const limit = q.limit ?? 20; const offset = q.offset ?? 0;
      return check(await query.range(offset, offset + limit - 1)) as Post[];
    },
    async getPost(id) { return check(await sb.from('post_feed').select('*').eq('id', id).maybeSingle()) as Post | null; },
    async createPost(p) {
      const author_id = await uidOrThrow();
      const row = check(await sb.from('posts').insert({ ...p, author_id }).select('id').single()) as Any;
      return row.id as string;
    },
    async deletePost(id) { check(await sb.from('posts').delete().eq('id', id)); },
    async editPost(id, title, body) { await rpc('edit_post', { p_post: id, p_title: title, p_body: body }); },
    async setCurationConsent(postId, allow) { await rpc('set_post_curation_consent', { p_post: postId, p_allow: allow }); },
    async setReaction(postId, type) {
      const user_id = await uidOrThrow();
      if (!type) check(await sb.from('reactions').delete().eq('user_id', user_id).eq('post_id', postId));
      else check(await sb.from('reactions').upsert({ user_id, post_id: postId, type }, { onConflict: 'user_id,post_id' }));
    },
    async setBookmark(postId, on) {
      const user_id = await uidOrThrow();
      if (on) ignoreDuplicate((await sb.from('bookmarks').insert({ user_id, post_id: postId })).error);
      else check(await sb.from('bookmarks').delete().eq('user_id', user_id).eq('post_id', postId));
    },

    // ---------------------------------------------------------------- comments
    async listComments(postId) {
      return check(await sb.from('comment_feed').select('*').eq('post_id', postId).order('created_at')) as Comment[];
    },
    async addComment({ postId, parentId, body, anonymous }) {
      const author_id = await uidOrThrow();
      check(await sb.from('comments').insert({ post_id: postId, parent_id: parentId ?? null, author_id, body, is_anonymous: anonymous }));
    },
    async deleteComment(id) { check(await sb.from('comments').delete().eq('id', id)); },
    async markHelpful(commentId, value) { await rpc('mark_comment_helpful', { p_comment: commentId, p_value: value }); },

    // ---------------------------------------------------------------- people
    async getMember(username) {
      return check(await sb.from('public_profiles').select('*').eq('username', username.toLowerCase()).maybeSingle()) as Member | null;
    },
    async setFollow(userId, on) {
      const follower_id = await uidOrThrow();
      if (on) ignoreDuplicate((await sb.from('follows').insert({ follower_id, followee_id: userId })).error);
      else check(await sb.from('follows').delete().eq('follower_id', follower_id).eq('followee_id', userId));
    },
    async setBlock(userId, on) {
      const blocker_id = await uidOrThrow();
      if (on) ignoreDuplicate((await sb.from('blocks').insert({ blocker_id, blocked_id: userId })).error);
      else check(await sb.from('blocks').delete().eq('blocker_id', blocker_id).eq('blocked_id', userId));
    },
    async listBlocked() { return (await rpc<BlockedMember[]>('list_my_blocks')) ?? []; },

    // ---------------------------------------------------------------- library
    async listCollections() {
      return check(await sb.from('collection_overview').select('*').eq('status', 'published').order('sort')) as Collection[];
    },
    async getCollection(slug) {
      const collection = check(await sb.from('collection_overview').select('*').eq('slug', slug).maybeSingle()) as Collection | null;
      if (!collection) return null;
      const entries = check(await sb.from('library_entries').select('*').eq('collection_id', collection.id).order('position').order('reviewed_at', { ascending: false })) as LibraryEntry[];
      return { collection, entries };
    },
    async searchLibrary(q) {
      let query = sb.from('library_entries').select('*');
      if (q.collectionId) query = query.eq('collection_id', q.collectionId);
      if (q.categoryId) query = query.eq('category_id', q.categoryId);
      if (q.itemType) query = query.eq('item_type', q.itemType);
      const fts = q.search ? prefixQuery(q.search) : null;
      if (fts) query = query.textSearch('fts', fts, { config: 'simple' });
      return check(await query.order('reviewed_at', { ascending: false }).limit(q.limit ?? 50)) as LibraryEntry[];
    },
    async setCollectionSaved(id, on) {
      const user_id = await uidOrThrow();
      if (on) ignoreDuplicate((await sb.from('saved_collections').insert({ user_id, collection_id: id })).error);
      else check(await sb.from('saved_collections').delete().eq('user_id', user_id).eq('collection_id', id));
    },

    // ---------------------------------------------------------------- understanders
    async findUnderstanders(situationId) { return ((await rpc<Understander[]>('find_understanders', { p_situation: situationId })) ?? []); },

    // ---------------------------------------------------------------- messaging
    async sendRequest({ recipientId, intro, contextPostId, contextSituationId }) {
      await rpc('send_message_request', {
        p_recipient: recipientId, p_intro: intro, p_context_post: contextPostId ?? null, p_context_situation: contextSituationId ?? null,
      });
    },
    async respondToRequest(id, accept) { return (await rpc<string | null>('respond_to_request', { p_request: id, p_accept: accept })) ?? null; },
    async withdrawRequest(id) { await rpc('withdraw_request', { p_request: id }); },
    async listRequests(box) { return ((await rpc<MessageRequest[]>('list_message_requests', { p_box: box })) ?? []); },
    async listConversations() { return ((await rpc<ConversationSummary[]>('list_my_conversations')) ?? []); },
    async getConversation(id) { return (await this.listConversations()).find((c) => c.id === id) ?? null; },
    async listMessages(conversationId) {
      const rows = check(await sb.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(300)) as Message[];
      return rows.reverse();
    },
    async sendMessage(conversationId, body) {
      const sender_id = await uidOrThrow();
      check(await sb.from('messages').insert({ conversation_id: conversationId, sender_id, body }));
    },
    async markRead(conversationId) {
      check(await sb.from('conversation_participants').update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId).eq('user_id', await uidOrThrow()));
    },
    async setMuted(conversationId, muted) {
      check(await sb.from('conversation_participants').update({ muted }).eq('conversation_id', conversationId).eq('user_id', await uidOrThrow()));
    },
    async deleteConversation(conversationId) { await rpc('delete_conversation', { p_conversation: conversationId }); },
    async inboxBadge() { return (await rpc<{ messages: number; requests: number }>('inbox_badge')) ?? { messages: 0, requests: 0 }; },
    subscribeMessages(conversationId, cb) {
      // postgres_changes honours RLS: this channel only ever delivers rows the member may SELECT.
      const ch = sb.channel(`messages:${conversationId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, () => cb())
        .subscribe();
      return () => { void sb.removeChannel(ch); };
    },

    // ---------------------------------------------------------------- safety
    async report({ type, targetId, reason, details }) {
      await rpc('submit_report', { p_type: type, p_target: targetId, p_reason: reason, p_details: details ?? null });
    },
    async submitAppeal(message) { check(await sb.from('appeals').insert({ user_id: await uidOrThrow(), message })); },
    async listMyAppeals() {
      return check(await sb.from('appeals').select('*').eq('user_id', await uidOrThrow()).order('created_at', { ascending: false })) as Appeal[];
    },
    async requestVerification(statement, evidence) {
      const user_id = await uidOrThrow();
      let evidence_path: string | null = null;
      if (evidence) {
        const safe = evidence.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
        evidence_path = `${user_id}/${Date.now()}-${safe}`;
        const up = await sb.storage.from(EVIDENCE_BUCKET).upload(evidence_path, evidence, { contentType: evidence.type, upsert: false });
        if (up.error) throw toAppError(up.error);
      }
      check(await sb.from('verification_requests').insert({ user_id, statement, evidence_path }));
    },
    async getMyVerification() {
      const rows = check(await sb.from('verification_requests').select('*').eq('user_id', await uidOrThrow()).order('created_at', { ascending: false }).limit(1)) as VerificationRequest[];
      return rows[0] ?? null;
    },

    // ---------------------------------------------------------------- staff
    async staffStats() { return await rpc<StaffStats>('staff_stats'); },
    async staffListReports(status) {
      let q = sb.from('reports').select('*').order('created_at', { ascending: false }).limit(100);
      if (status !== 'all') q = q.eq('status', status);
      return check(await q) as Report[];
    },
    async staffResolveReport(id, resolution, note, contentStatus) {
      await rpc('staff_resolve_report', { p_report: id, p_resolution: resolution, p_note: note ?? null, p_content_status: contentStatus ?? null });
    },
    async staffSetContentStatus(type, id, status, note) {
      await rpc('staff_set_content_status', { p_type: type, p_id: id, p_status: status, p_note: note ?? null });
    },
    async staffListComments(status) {
      let q = sb.from('comment_feed').select('*').order('created_at', { ascending: false }).limit(100);
      if (status !== 'any') q = q.eq('status', status);
      return check(await q) as Comment[];
    },
    async staffGetComment(id) { return check(await sb.from('comment_feed').select('*').eq('id', id).maybeSingle()) as Comment | null; },
    async staffReviewQueue() {
      const ids = (await rpc<string[]>('staff_review_queue')) ?? [];
      return ids.length ? await this.listPosts({ ids, status: 'any', limit: 100 }) : [];
    },
    async staffGetMemberById(id) { return check(await sb.from('public_profiles').select('*').eq('id', id).maybeSingle()) as Member | null; },
    async staffListLog() { return check(await sb.from('moderation_log').select('*').order('created_at', { ascending: false }).limit(150)) as LogEntry[]; },

    // ---------------------------------------------------------------- admin
    async adminListUsers(search) { return ((await rpc<AdminUser[]>('admin_list_users', { p_search: search ?? null, p_limit: 100 })) ?? []); },
    async adminSetAccountStatus(userId, status, reason, until) {
      await rpc('admin_set_account_status', { p_user: userId, p_status: status, p_reason: reason ?? null, p_until: until ?? null });
    },
    async adminSetRole(userId, role) { await rpc('admin_set_role', { p_user: userId, p_role: role }); },
    async adminListAppeals() {
      const rows = check(await sb.from('appeals').select('*').order('created_at', { ascending: false }).limit(100)) as Appeal[];
      const names = await namesFor(rows.map((r) => r.user_id));
      return rows.map((r) => ({ ...r, username: names.get(r.user_id) }));
    },
    async adminResolveAppeal(id, decision, note) { await rpc('admin_resolve_appeal', { p_appeal: id, p_decision: decision, p_note: note ?? null }); },
    async adminListVerifications() {
      const rows = check(await sb.from('verification_requests').select('*').order('created_at', { ascending: false }).limit(100)) as VerificationRequest[];
      const names = await namesFor(rows.map((r) => r.user_id));
      return rows.map((r) => ({ ...r, username: names.get(r.user_id) }));
    },
    async adminResolveVerification(id, decision, note) {
      await rpc('admin_resolve_verification', { p_request: id, p_decision: decision, p_note: note ?? null });
    },
    async adminEvidenceUrl(path) {
      const { data, error } = await sb.storage.from(EVIDENCE_BUCKET).createSignedUrl(path, 120);
      if (error) throw toAppError(error);
      return data?.signedUrl ?? null;
    },
    async adminSaveCategory(c) { check(await sb.from('categories').upsert(c)); },
    async adminSaveWishTopic(w) { check(await sb.from('wish_topics').upsert(w)); },
    async adminSaveSituation(s) { check(await sb.from('situations').upsert(s)); },
    async adminSaveCollection(id, c) {
      if (id) check(await sb.from('collections').update(c).eq('id', id));
      else check(await sb.from('collections').insert({ ...c, created_by: await uidOrThrow() }));
    },
    async adminDeleteCollection(id) { check(await sb.from('collections').delete().eq('id', id)); },
    async adminListCollections() { return check(await sb.from('collection_overview').select('*').order('sort')) as Collection[]; },
    async adminAddCollectionItem(collectionId, postId, itemType, takeaway) {
      const { data } = await sb.from('collection_items').select('position').eq('collection_id', collectionId).order('position', { ascending: false }).limit(1);
      const position = ((data?.[0] as Any)?.position ?? 0) + 1;
      check(await sb.from('collection_items').insert({ collection_id: collectionId, post_id: postId, item_type: itemType, key_takeaway: takeaway, position }));
    },
    async adminRemoveCollectionItem(entryId) { check(await sb.from('collection_items').delete().eq('id', entryId)); },
  };
}
