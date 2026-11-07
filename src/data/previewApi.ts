/**
 * PREVIEW BACKEND — used ONLY when Supabase is not configured.
 *
 * Everything is stored in this browser's localStorage. There is no server, no real email
 * delivery, no real security boundary and nothing is shared between browsers. It exists so the
 * product can be explored and tested before Supabase is connected, and it mirrors the rules that
 * the real database enforces (see supabase/migrations). It starts EMPTY: no fake members, posts
 * or testimonials are ever created.
 */
import { AppError } from '@/lib/errors';
import { looksSensitive, uid, USERNAME_RE } from '@/lib/util';
import type {
  AdminUser, Appeal, Category, Collection, Comment, ConversationSummary, ContentStatus, LibraryEntry, LogEntry,
  Me, Member, Message, MessageRequest, Post, Report, Role, Situation, StaffStats, Understander,
  VerificationRequest, WishTopic, ReactionType, ItemType, AvatarMotif, Visibility, Settings,
} from '@/lib/types';
import type { Api, PostQuery } from './api';
import { CURATOR_NOTE, SEED_CATEGORIES, SEED_COLLECTIONS, SEED_SITUATIONS, SEED_WISH_TOPICS, toneOf } from './seedData';

const KEY = 'amongher.preview.v1';
const RESERVED = ['admin', 'administrator', 'moderator', 'mod', 'staff', 'team', 'support', 'help', 'amongher', 'official', 'security', 'system', 'anonymous', 'safety'];

interface U {
  id: string; email: string; salt: string; pw: string; confirmed: boolean; username: string;
  avatar_motif: AvatarMotif; avatar_tone: number; bio: string | null; location: string | null; interests: string[];
  visibility: Visibility; verified: boolean; onboarded_at: string | null; created_at: string;
  settings: Settings; role: Role; status: 'active' | 'suspended'; reason: string | null; until: string | null;
}
interface P { id: string; author_id: string; kind: Post['kind']; category_id: string; wish_topic: string | null; situation_id: string | null;
  title: string; body: string; is_anonymous: boolean; sensitive: boolean; allow_curation: boolean; status: ContentStatus; reviewed_at: string | null; created_at: string }
interface C { id: string; post_id: string; parent_id: string | null; author_id: string; body: string; is_anonymous: boolean; is_helpful: boolean; status: ContentStatus; created_at: string }
interface Item { id: string; collection_id: string; post_id: string; item_type: ItemType; key_takeaway: string; position: number; reviewed_by: string; reviewed_at: string }
interface Req { id: string; requester_id: string; recipient_id: string; intro: string; context_post_id: string | null; context_situation_id: string | null; status: MessageRequest['status']; conversation_id: string | null; created_at: string; responded_at: string | null }
interface Part { conversation_id: string; user_id: string; muted: boolean; hidden: boolean; cleared_at: string | null; last_read_at: string }
interface Rep { id: string; reporter_id: string; target_type: Report['target_type']; target_id: string; reported_user_id: string | null; reason: Report['reason']; details: string | null; evidence: unknown | null; status: Report['status']; resolution_note: string | null; created_at: string }

interface DB {
  users: U[]; session: string | null;
  categories: Category[]; situations: Situation[]; wishTopics: WishTopic[];
  posts: P[]; comments: C[]; reactions: { user_id: string; post_id: string; type: ReactionType }[];
  bookmarks: { user_id: string; post_id: string }[]; follows: { follower_id: string; followee_id: string }[];
  blocks: { blocker_id: string; blocked_id: string; created_at: string }[];
  collections: Omit<Collection, 'entry_count' | 'saved_by_me'>[]; items: Item[]; saved: { user_id: string; collection_id: string }[];
  profSit: { user_id: string; situation_id: string }[];
  requests: Req[]; conversations: { id: string; pair_key: string; created_at: string }[]; parts: Part[]; messages: Message[];
  reports: Rep[]; log: LogEntry[]; appeals: Appeal[]; verifications: VerificationRequest[];
}

function seed(): DB {
  const categories: Category[] = SEED_CATEGORIES.map((c) => ({ ...c, id: uid() }));
  const bySlug = (s: string) => categories.find((c) => c.slug === s)!;
  return {
    users: [], session: null, categories,
    situations: SEED_SITUATIONS.map((s) => ({ id: uid(), slug: s.slug, label: s.label, category_id: bySlug(s.cat).id, sort: s.sort, is_active: true })),
    wishTopics: [...SEED_WISH_TOPICS],
    posts: [], comments: [], reactions: [], bookmarks: [], follows: [], blocks: [],
    collections: SEED_COLLECTIONS.map((c) => ({
      id: uid(), slug: c.slug, title: c.title, description: c.description, curator_note: CURATOR_NOTE,
      category_id: bySlug(c.cat).id, tone: toneOf(categories, c.cat), status: 'published' as const, sort: c.sort, updated_at: new Date().toISOString(),
    })),
    items: [], saved: [], profSit: [], requests: [], conversations: [], parts: [], messages: [],
    reports: [], log: [], appeals: [], verifications: [],
  };
}

let db: DB;
function load(): DB {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) as DB; } catch { /* corrupted → reseed */ }
  return seed();
}
const listeners = new Set<() => void>();       // data changes (used by live message updates)
const authListeners = new Set<() => void>();   // session changes only
function save(authChanged = false) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* quota */ }
  listeners.forEach((l) => l());
  if (authChanged) authListeners.forEach((l) => l());
}

async function hash(salt: string, pw: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pw}`);
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 5381; for (const b of data) h = ((h << 5) + h + b) | 0;   // preview-only fallback on insecure origins
  return String(h);
}

const now = () => new Date().toISOString();
const sleep = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const FORBIDDEN = () => new AppError('forbidden');

export function createPreviewApi(): Api {
  db = load();
  window.addEventListener('storage', (e) => { if (e.key === KEY) { db = load(); listeners.forEach((l) => l()); authListeners.forEach((l) => l()); } });

  // ------------------------------------------------------------ helpers
  const cur = (): U | null => db.users.find((u) => u.id === db.session) ?? null;
  const must = (): U => { const u = cur(); if (!u) throw new AppError('not_authenticated', 'Please log in.'); return u; };
  const isActive = (u: U | undefined | null) => !!u && !(u.status === 'suspended' && (!u.until || new Date(u.until) > new Date()));
  const mustActive = () => { const u = must(); if (!isActive(u)) throw new AppError('account_suspended'); return u; };
  const staff = (u: U | null) => !!u && (u.role === 'moderator' || u.role === 'admin');
  const mustStaff = () => { const u = must(); if (!staff(u)) throw FORBIDDEN(); return u; };
  const mustAdmin = () => { const u = must(); if (u.role !== 'admin') throw FORBIDDEN(); return u; };
  const user = (id: string | null | undefined) => db.users.find((u) => u.id === id);
  const blocked = (a: string, b: string) => a !== b && db.blocks.some((x) => (x.blocker_id === a && x.blocked_id === b) || (x.blocker_id === b && x.blocked_id === a));
  const log = (action: string, target_type: string | null, target_id: string | null, note: string | null) =>
    db.log.unshift({ id: uid(), actor_id: db.session, action, target_type, target_id, note, created_at: now() });
  const pairKey = (a: string, b: string) => [a, b].sort().join(':');

  function postView(p: P, v: U): Post | null {
    const author = user(p.author_id); if (!author) return null;
    const mine = p.author_id === v.id; const st = staff(v);
    const visible = (p.status === 'published' && !blocked(v.id, p.author_id)) || mine || st;
    if (!visible) return null;
    const reveal = !p.is_anonymous || mine || st;
    const rx = db.reactions.filter((r) => r.post_id === p.id);
    const comments = db.comments.filter((c) => c.post_id === p.id && c.status === 'published').length;
    return {
      id: p.id, kind: p.kind, category_id: p.category_id, wish_topic: p.wish_topic, situation_id: p.situation_id, title: p.title, body: p.body,
      sensitive: p.sensitive, status: p.status, created_at: p.created_at, is_anonymous: p.is_anonymous, is_mine: mine,
      allow_curation: mine || st ? p.allow_curation : null,
      author_id: reveal ? author.id : null, author_username: reveal ? author.username : null,
      author_avatar_motif: reveal ? author.avatar_motif : null, author_avatar_tone: reveal ? author.avatar_tone : null,
      author_verified: reveal ? author.verified : null,
      felt_count: rx.filter((r) => r.type === 'felt_this').length, helpful_count: rx.filter((r) => r.type === 'helpful').length,
      strength_count: rx.filter((r) => r.type === 'sending_strength').length, reaction_count: rx.length, comment_count: comments,
      popularity: rx.length * 2 + comments * 3,
      my_reaction: rx.find((r) => r.user_id === v.id)?.type ?? null,
      bookmarked: db.bookmarks.some((b) => b.post_id === p.id && b.user_id === v.id),
      followed_by_me: !p.is_anonymous && db.follows.some((f) => f.follower_id === v.id && f.followee_id === p.author_id),
    };
  }
  function commentView(c: C, v: U): Comment | null {
    const post = db.posts.find((p) => p.id === c.post_id); const author = user(c.author_id);
    if (!post || !author || !postView(post, v)) return null;
    const mine = c.author_id === v.id; const st = staff(v);
    if (!((c.status === 'published' && !blocked(v.id, c.author_id)) || mine || st)) return null;
    const reveal = !c.is_anonymous || mine || st;
    return {
      id: c.id, post_id: c.post_id, parent_id: c.parent_id, body: c.body, is_helpful: c.is_helpful, status: c.status,
      created_at: c.created_at, is_anonymous: c.is_anonymous, is_mine: mine,
      is_op: c.author_id === post.author_id && (post.is_anonymous || !c.is_anonymous),
      author_id: reveal ? author.id : null, author_username: reveal ? author.username : null,
      author_avatar_motif: reveal ? author.avatar_motif : null, author_avatar_tone: reveal ? author.avatar_tone : null,
      author_verified: reveal ? author.verified : null,
    };
  }
  function memberView(u: U, v: U): Member | null {
    if (blocked(v.id, u.id)) return null;
    const open = u.visibility === 'members' || u.id === v.id || staff(v);
    return {
      id: u.id, username: u.username, avatar_motif: u.avatar_motif, avatar_tone: u.avatar_tone, verified_contributor: u.verified,
      created_at: u.created_at, visibility: u.visibility, is_me: u.id === v.id,
      bio: open ? u.bio : null, location: open ? u.location : null, interests: open ? u.interests : [],
      followed_by_me: db.follows.some((f) => f.follower_id === v.id && f.followee_id === u.id),
    };
  }
  function collectionView(c: DB['collections'][number], v: U): Collection {
    return { ...c, entry_count: entries(c.id, v).length, saved_by_me: db.saved.some((s) => s.collection_id === c.id && s.user_id === v.id) };
  }
  function entries(collectionId: string | null, v: U): LibraryEntry[] {
    const out: LibraryEntry[] = [];
    for (const it of db.items) {
      if (collectionId && it.collection_id !== collectionId) continue;
      const col = db.collections.find((c) => c.id === it.collection_id);
      const p = db.posts.find((x) => x.id === it.post_id);
      if (!col || !p || (col.status !== 'published' && !staff(v))) continue;
      const pv = postView(p, v); if (!pv || pv.status !== 'published') continue;
      out.push({ ...pv, entry_id: it.id, collection_id: col.id, collection_slug: col.slug, collection_title: col.title, item_type: it.item_type, key_takeaway: it.key_takeaway, position: it.position });
    }
    return out;
  }
  const matches = (text: string, q: string) => q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => text.toLowerCase().includes(w));

  function convSummary(conv: DB['conversations'][number], v: U): ConversationSummary | null {
    const mine = db.parts.find((p) => p.conversation_id === conv.id && p.user_id === v.id);
    const other = db.parts.find((p) => p.conversation_id === conv.id && p.user_id !== v.id);
    const ou = other && user(other.user_id);
    if (!mine || mine.hidden || !ou) return null;
    const msgs = db.messages.filter((m) => m.conversation_id === conv.id && (!mine.cleared_at || m.created_at > mine.cleared_at));
    const last = msgs[msgs.length - 1];
    return {
      id: conv.id, other_id: ou.id, other_username: ou.username, other_avatar_motif: ou.avatar_motif, other_avatar_tone: ou.avatar_tone,
      muted: mine.muted, last_body: last?.body ?? null, last_at: last?.created_at ?? conv.created_at, last_from_me: last?.sender_id === v.id,
      unread: msgs.filter((m) => m.sender_id !== v.id && m.created_at > mine.last_read_at).length, blocked: blocked(v.id, ou.id),
    };
  }
  const conversations = (v: U) => db.conversations.map((c) => convSummary(c, v)).filter(Boolean)
    .sort((a, b) => b!.last_at.localeCompare(a!.last_at)) as ConversationSummary[];

  // ------------------------------------------------------------ API
  const api: Api = {
    mode: 'preview',

    onAuthChange(cb) { authListeners.add(cb); return () => { authListeners.delete(cb); }; },
    async hasSession() { return !!cur(); },

    async signUp({ email, password, username, ageConfirmed }) {
      await sleep();
      if (!ageConfirmed) throw new AppError('age_confirmation_required');
      const name = username.toLowerCase();
      if (!USERNAME_RE.test(name) || RESERVED.includes(name) || db.users.some((u) => u.username === name)) throw new AppError('username_unavailable');
      if (db.users.some((u) => u.email === email.toLowerCase())) throw new AppError('User already registered');
      if (password.length < 8) throw new AppError('weak', 'Use at least 8 characters.');
      const salt = uid();
      db.users.push({
        id: uid(), email: email.toLowerCase(), salt, pw: await hash(salt, password), confirmed: false, username: name,
        avatar_motif: 'ring', avatar_tone: 0, bio: null, location: null, interests: [], visibility: 'members', verified: false,
        onboarded_at: null, created_at: now(),
        settings: { dm_permission: 'everyone', discoverable: false, discoverable_note: null, notify_requests: true, notify_messages: true, age_confirmed_at: now(), age_assurance: 'self_declared' },
        // Preview convenience ONLY: the first local account can open the admin dashboard so it can be explored.
        role: db.users.length === 0 ? 'admin' : 'member', status: 'active', reason: null, until: null,
      });
      save();
      return { needsEmailVerification: true };
    },
    async signIn(email, password) {
      await sleep();
      const u = db.users.find((x) => x.email === email.toLowerCase());
      if (!u || u.pw !== (await hash(u.salt, password))) throw new AppError('Invalid login credentials');
      if (!u.confirmed) throw new AppError('Email not confirmed');
      db.session = u.id; save(true);
    },
    async signOut() { db.session = null; save(true); },
    async requestPasswordReset(email) {
      await sleep();
      // Real Supabase never reveals whether an address exists; neither does the preview.
      const u = db.users.find((x) => x.email === email.toLowerCase());
      if (u) sessionStorage.setItem('amongher.preview.reset', u.id);
    },
    async updatePassword(password) {
      const id = db.session ?? sessionStorage.getItem('amongher.preview.reset');
      const u = user(id); if (!u) throw new AppError('expired', 'This reset link has expired.');
      if (password.length < 8) throw new AppError('weak', 'Use at least 8 characters.');
      u.salt = uid(); u.pw = await hash(u.salt, password); sessionStorage.removeItem('amongher.preview.reset'); save();
    },
    async resendVerification() { await sleep(); },
    async previewConfirmEmail(email) {
      const u = db.users.find((x) => x.email === email.toLowerCase()); if (u) { u.confirmed = true; save(); }
    },
    async usernameAvailable(username) {
      const n = username.toLowerCase();
      return USERNAME_RE.test(n) && !RESERVED.includes(n) && !db.users.some((u) => u.username === n);
    },
    async exportMyData() {
      const u = must(); const mine = <T extends { user_id?: string }>(a: T[]) => a.filter((x) => x.user_id === u.id);
      const convs = new Set(db.parts.filter((p) => p.user_id === u.id).map((p) => p.conversation_id));
      return {
        exported_at: now(), account: { id: u.id, email: u.email },
        profile: { username: u.username, bio: u.bio, location: u.location, interests: u.interests, visibility: u.visibility },
        settings: u.settings, posts: db.posts.filter((p) => p.author_id === u.id), comments: db.comments.filter((c) => c.author_id === u.id),
        reactions: mine(db.reactions), bookmarks: mine(db.bookmarks), following: db.follows.filter((f) => f.follower_id === u.id),
        blocked_members: db.blocks.filter((b) => b.blocker_id === u.id), saved_collections: mine(db.saved), situations_shared: mine(db.profSit),
        message_requests: db.requests.filter((r) => r.requester_id === u.id || r.recipient_id === u.id),
        messages: db.messages.filter((m) => convs.has(m.conversation_id)).map((m) => ({ conversation_id: m.conversation_id, from_me: m.sender_id === u.id, body: m.body, sent_at: m.created_at })),
        reports_filed: db.reports.filter((r) => r.reporter_id === u.id).map(({ evidence: _e, ...r }) => r), appeals: db.appeals.filter((a) => a.user_id === u.id),
        verification_requests: db.verifications.filter((v) => v.user_id === u.id),
      };
    },
    async deleteAccount() {
      const u = must(); const id = u.id;
      db.users = db.users.filter((x) => x.id !== id);
      const postIds = new Set(db.posts.filter((p) => p.author_id === id).map((p) => p.id));
      db.posts = db.posts.filter((p) => p.author_id !== id);
      db.comments = db.comments.filter((c) => c.author_id !== id && !postIds.has(c.post_id));
      db.reactions = db.reactions.filter((r) => r.user_id !== id && !postIds.has(r.post_id));
      db.bookmarks = db.bookmarks.filter((b) => b.user_id !== id && !postIds.has(b.post_id));
      db.items = db.items.filter((i) => !postIds.has(i.post_id));
      db.follows = db.follows.filter((f) => f.follower_id !== id && f.followee_id !== id);
      db.blocks = db.blocks.filter((b) => b.blocker_id !== id && b.blocked_id !== id);
      db.profSit = db.profSit.filter((x) => x.user_id !== id); db.saved = db.saved.filter((x) => x.user_id !== id);
      db.requests = db.requests.filter((r) => r.requester_id !== id && r.recipient_id !== id);
      db.parts = db.parts.filter((p) => p.user_id !== id);
      db.messages.forEach((m) => { if (m.sender_id === id) m.sender_id = null; });
      db.session = null; save(true);
    },

    // ---- me
    async getMe() {
      const u = cur(); if (!u) return null;
      const suspended = !isActive(u);
      return {
        id: u.id, email: u.email, username: u.username, avatar_motif: u.avatar_motif, avatar_tone: u.avatar_tone, bio: u.bio, location: u.location,
        interests: u.interests, visibility: u.visibility, verified_contributor: u.verified, onboarded: !!u.onboarded_at, role: u.role,
        status: suspended ? 'suspended' : 'active', suspended_reason: u.reason, suspended_until: u.until, settings: u.settings,
        situation_ids: db.profSit.filter((x) => x.user_id === u.id).map((x) => x.situation_id),
      } satisfies Me;
    },
    async updateProfile(patch) { const u = mustActive(); Object.assign(u, { ...patch }); if (patch.onboarded_at) u.onboarded_at = patch.onboarded_at; save(); },
    async updateSettings(patch) { const u = mustActive(); Object.assign(u.settings, patch); save(); },
    async setMySituations(ids) {
      const u = mustActive();
      db.profSit = db.profSit.filter((x) => x.user_id !== u.id).concat(ids.map((situation_id) => ({ user_id: u.id, situation_id }))); save();
    },

    // ---- taxonomy
    async listCategories() { return [...db.categories].sort((a, b) => a.sort - b.sort); },
    async listSituations() { return [...db.situations].sort((a, b) => a.sort - b.sort); },
    async listWishTopics() { return [...db.wishTopics].sort((a, b) => a.sort - b.sort); },

    // ---- posts
    async listPosts(q: PostQuery) {
      await sleep(30);
      const v = must(); if (!isActive(v)) return [];
      let out = db.posts.map((p) => postView(p, v)).filter(Boolean) as Post[];
      if (q.mine) out = out.filter((p) => p.is_mine);
      else if (q.status && q.status !== 'any') out = out.filter((p) => p.status === q.status);
      else if (!q.status) out = out.filter((p) => p.status === 'published');
      const kind = q.filter === 'questions' ? 'question' : q.filter === 'experiences' ? 'experience' : q.kind;
      if (kind) out = out.filter((p) => p.kind === kind);
      if (q.filter === 'following') out = out.filter((p) => p.followed_by_me);
      if (q.categoryId) out = out.filter((p) => p.category_id === q.categoryId);
      if (q.wishTopic) out = out.filter((p) => p.wish_topic === q.wishTopic);
      if (q.situationId) out = out.filter((p) => p.situation_id === q.situationId);
      if (q.authorId) out = out.filter((p) => p.author_id === q.authorId);
      if (q.bookmarked) out = out.filter((p) => p.bookmarked);
      if (q.allowCurationOnly) out = out.filter((p) => p.allow_curation);
      if (q.ids) out = out.filter((p) => q.ids!.includes(p.id));
      if (q.search?.trim()) out = out.filter((p) => matches(`${p.title} ${p.body}`, q.search!));
      out.sort(q.filter === 'popular' ? (a, b) => b.popularity - a.popularity || b.created_at.localeCompare(a.created_at) : (a, b) => b.created_at.localeCompare(a.created_at));
      const o = q.offset ?? 0; return out.slice(o, o + (q.limit ?? 20));
    },
    async getPost(id) { const v = must(); const p = db.posts.find((x) => x.id === id); return p ? postView(p, v) : null; },
    async createPost(p) {
      const u = mustActive();
      const cat = db.categories.find((c) => c.id === p.category_id && c.is_active); if (!cat) throw new AppError('invalid_category', 'Choose a category.');
      if (db.posts.filter((x) => x.author_id === u.id && Date.now() - +new Date(x.created_at) < 3600_000).length >= 20) throw new AppError('rate_limited');
      const row: P = {
        id: uid(), author_id: u.id, kind: p.kind, category_id: p.category_id, wish_topic: p.kind === 'wish' ? p.wish_topic ?? null : null,
        situation_id: p.situation_id ?? null, title: p.title.trim(), body: p.body.trim(), is_anonymous: p.is_anonymous,
        sensitive: cat.sensitive || looksSensitive(`${p.title} ${p.body}`), allow_curation: p.allow_curation,
        status: 'published', reviewed_at: null, created_at: now(),
      };
      db.posts.push(row); save(); return row.id;
    },
    async deletePost(id) {
      const u = must(); const p = db.posts.find((x) => x.id === id); if (!p || p.author_id !== u.id) return;
      db.posts = db.posts.filter((x) => x.id !== id); db.comments = db.comments.filter((c) => c.post_id !== id);
      db.items = db.items.filter((i) => i.post_id !== id); db.reactions = db.reactions.filter((r) => r.post_id !== id);
      db.bookmarks = db.bookmarks.filter((b) => b.post_id !== id); save();
    },
    async editPost(id, title, body) {
      const u = mustActive(); const p = db.posts.find((x) => x.id === id);
      if (!p || p.author_id !== u.id) throw FORBIDDEN();
      if (p.status === 'hidden' || p.status === 'removed') throw new AppError('post_locked', 'This post is locked by a moderator.');
      const t = title.trim(); const b = body.trim();
      if (t.length < 4 || t.length > 140 || b.length < 10 || b.length > 5000) throw new AppError('invalid_length', 'Check the title and body length.');
      if (t === p.title && b === p.body) return;
      const cat = db.categories.find((c) => c.id === p.category_id);
      p.title = t; p.body = b; p.sensitive = !!cat?.sensitive || looksSensitive(`${t} ${b}`); p.reviewed_at = null;
      db.items = db.items.filter((i) => i.post_id !== id);   // editing voids editorial review
      save();
    },
    async setCurationConsent(postId, allow) {
      const u = must(); const p = db.posts.find((x) => x.id === postId); if (!p || p.author_id !== u.id) throw FORBIDDEN();
      p.allow_curation = allow; if (!allow) db.items = db.items.filter((i) => i.post_id !== postId); save();
    },
    async setReaction(postId, type) {
      const u = mustActive(); db.reactions = db.reactions.filter((r) => !(r.user_id === u.id && r.post_id === postId));
      if (type) db.reactions.push({ user_id: u.id, post_id: postId, type }); save();
    },
    async setBookmark(postId, on) {
      const u = mustActive(); db.bookmarks = db.bookmarks.filter((b) => !(b.user_id === u.id && b.post_id === postId));
      if (on) db.bookmarks.push({ user_id: u.id, post_id: postId }); save();
    },

    // ---- comments
    async listComments(postId) {
      const v = must(); return db.comments.filter((c) => c.post_id === postId).sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((c) => commentView(c, v)).filter(Boolean) as Comment[];
    },
    async addComment({ postId, parentId, body, anonymous }) {
      const u = mustActive(); const post = db.posts.find((p) => p.id === postId);
      if (!post || post.status !== 'published' || blocked(u.id, post.author_id)) throw new AppError('post_unavailable');
      if (parentId) {
        const par = db.comments.find((c) => c.id === parentId);
        if (!par || par.post_id !== postId || par.parent_id || par.status !== 'published' || blocked(u.id, par.author_id)) throw new AppError('invalid_parent');
      }
      db.comments.push({
        id: uid(), post_id: postId, parent_id: parentId ?? null, author_id: u.id, body: body.trim(),
        is_anonymous: anonymous || (post.is_anonymous && post.author_id === u.id), is_helpful: false, status: 'published', created_at: now(),
      });
      save();
    },
    async deleteComment(id) {
      const u = must(); const c = db.comments.find((x) => x.id === id); if (!c || c.author_id !== u.id) return;
      db.comments = db.comments.filter((x) => x.id !== id && x.parent_id !== id); save();
    },
    async markHelpful(commentId, value) {
      const u = must(); const c = db.comments.find((x) => x.id === commentId); const p = c && db.posts.find((x) => x.id === c.post_id);
      if (!c || !p || p.author_id !== u.id || p.kind !== 'question' || c.author_id === u.id) throw FORBIDDEN();
      c.is_helpful = value; save();
    },

    // ---- people
    async getMember(username) { const v = must(); const u = db.users.find((x) => x.username === username.toLowerCase()); return u ? memberView(u, v) : null; },
    async staffReviewQueue() {
      const v = mustStaff();
      return db.posts.filter((p) => p.status === 'under_review' || (p.status === 'published' && p.sensitive && !p.reviewed_at))
        .sort((a, b) => Number(b.status === 'under_review') - Number(a.status === 'under_review') || b.created_at.localeCompare(a.created_at))
        .map((p) => postView(p, v)).filter(Boolean) as Post[];
    },
    async staffGetMemberById(id) { const v = must(); const u = user(id); return u ? memberView(u, v) : null; },
    async setFollow(userId, on) {
      const u = mustActive(); db.follows = db.follows.filter((f) => !(f.follower_id === u.id && f.followee_id === userId));
      if (on && userId !== u.id && !blocked(u.id, userId)) db.follows.push({ follower_id: u.id, followee_id: userId }); save();
    },
    async setBlock(userId, on) {
      const u = must(); db.blocks = db.blocks.filter((b) => !(b.blocker_id === u.id && b.blocked_id === userId));
      if (on && userId !== u.id) db.blocks.push({ blocker_id: u.id, blocked_id: userId, created_at: now() }); save();
    },
    async listBlocked() {
      const u = must();
      return db.blocks.filter((b) => b.blocker_id === u.id).map((b) => {
        const t = user(b.blocked_id)!; return { user_id: t.id, username: t.username, avatar_motif: t.avatar_motif, avatar_tone: t.avatar_tone, blocked_at: b.created_at };
      }).filter((x) => x.username);
    },

    // ---- library
    async listCollections() { const v = must(); return db.collections.filter((c) => c.status === 'published').sort((a, b) => a.sort - b.sort).map((c) => collectionView(c, v)); },
    async getCollection(slug) {
      const v = must(); const c = db.collections.find((x) => x.slug === slug); if (!c || (c.status !== 'published' && !staff(v))) return null;
      return { collection: collectionView(c, v), entries: entries(c.id, v).sort((a, b) => a.position - b.position) };
    },
    async searchLibrary(q) {
      const v = must(); let out = entries(q.collectionId ?? null, v);
      if (q.categoryId) out = out.filter((e) => e.category_id === q.categoryId);
      if (q.itemType) out = out.filter((e) => e.item_type === q.itemType);
      if (q.search?.trim()) out = out.filter((e) => matches(`${e.title} ${e.body} ${e.key_takeaway}`, q.search!));
      return out.slice(0, q.limit ?? 50);
    },
    async setCollectionSaved(id, on) {
      const u = mustActive(); db.saved = db.saved.filter((s) => !(s.user_id === u.id && s.collection_id === id));
      if (on) db.saved.push({ user_id: u.id, collection_id: id }); save();
    },

    // ---- understanders
    async findUnderstanders(situationId) {
      const v = mustActive();
      return db.profSit.filter((x) => x.situation_id === situationId).map((x) => user(x.user_id)!).filter(
        (u) => u && u.id !== v.id && u.settings.discoverable && u.settings.dm_permission === 'everyone' && isActive(u) && !blocked(v.id, u.id),
      ).map((u): Understander => ({
        user_id: u.id, username: u.username, avatar_motif: u.avatar_motif, avatar_tone: u.avatar_tone,
        bio: u.visibility === 'members' ? u.bio : null, note: u.settings.discoverable_note, verified: u.verified,
      }));
    },

    // ---- messaging
    async sendRequest({ recipientId, intro, contextPostId, contextSituationId }) {
      const me = mustActive(); const to = user(recipientId);
      if (recipientId === me.id) throw new AppError('invalid_recipient');
      if (!to || to.settings.dm_permission !== 'everyone' || !isActive(to) || blocked(me.id, to.id)) throw new AppError('not_accepting');
      if (db.conversations.some((c) => c.pair_key === pairKey(me.id, to.id))) throw new AppError('already_connected');
      if (db.requests.some((r) => r.status === 'pending' && ((r.requester_id === me.id && r.recipient_id === to.id) || (r.requester_id === to.id && r.recipient_id === me.id)))) throw new AppError('request_pending');
      if (db.requests.some((r) => r.requester_id === me.id && r.recipient_id === to.id && r.status === 'declined' && r.responded_at && Date.now() - +new Date(r.responded_at) < 30 * 864e5)) throw new AppError('recently_declined');
      if (db.requests.filter((r) => r.requester_id === me.id && Date.now() - +new Date(r.created_at) < 864e5).length >= 10) throw new AppError('rate_limited');
      db.requests.push({ id: uid(), requester_id: me.id, recipient_id: to.id, intro: intro.trim(), context_post_id: contextPostId ?? null, context_situation_id: contextSituationId ?? null, status: 'pending', conversation_id: null, created_at: now(), responded_at: null });
      save();
    },
    async respondToRequest(id, accept) {
      const me = mustActive(); const r = db.requests.find((x) => x.id === id && x.recipient_id === me.id && x.status === 'pending');
      if (!r) throw new AppError('request_not_found', 'That request is no longer available.');
      if (!accept) { r.status = 'declined'; r.responded_at = now(); save(); return null; }
      if (blocked(me.id, r.requester_id) || !isActive(user(r.requester_id))) throw new AppError('conversation_unavailable');
      const key = pairKey(me.id, r.requester_id);
      let conv = db.conversations.find((c) => c.pair_key === key);
      if (!conv) { conv = { id: uid(), pair_key: key, created_at: now() }; db.conversations.push(conv); }
      for (const uidd of [me.id, r.requester_id]) {
        const ex = db.parts.find((p) => p.conversation_id === conv!.id && p.user_id === uidd);
        if (ex) ex.hidden = false; else db.parts.push({ conversation_id: conv.id, user_id: uidd, muted: false, hidden: false, cleared_at: null, last_read_at: now() });
      }
      r.status = 'accepted'; r.responded_at = now(); r.conversation_id = conv.id; save(); return conv.id;
    },
    async withdrawRequest(id) {
      const me = must(); const r = db.requests.find((x) => x.id === id && x.requester_id === me.id && x.status === 'pending');
      if (r) { r.status = 'withdrawn'; r.responded_at = now(); save(); }
    },
    async listRequests(box) {
      const me = must(); if (!isActive(me)) return [];
      return db.requests.filter((r) => box === 'incoming' ? r.recipient_id === me.id && r.status === 'pending'
          : r.requester_id === me.id && Date.now() - +new Date(r.created_at) < 30 * 864e5)
        .filter((r) => !blocked(me.id, box === 'incoming' ? r.requester_id : r.recipient_id))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((r): MessageRequest => {
          const o = user(box === 'incoming' ? r.requester_id : r.recipient_id)!;
          const ctx = db.posts.find((p) => p.id === r.context_post_id && p.status === 'published' && !p.is_anonymous);
          return { id: r.id, direction: box, status: r.status, intro: r.intro, other_id: o.id, other_username: o.username, other_avatar_motif: o.avatar_motif, other_avatar_tone: o.avatar_tone, context_title: ctx?.title ?? null, created_at: r.created_at, conversation_id: r.conversation_id };
        });
    },
    async listConversations() { const v = must(); return isActive(v) ? conversations(v) : []; },
    async getConversation(id) { const v = must(); const c = db.conversations.find((x) => x.id === id); return c ? convSummary(c, v) : null; },
    async listMessages(conversationId) {
      const v = must(); const mine = db.parts.find((p) => p.conversation_id === conversationId && p.user_id === v.id); if (!mine) return [];
      return db.messages.filter((m) => m.conversation_id === conversationId && (!mine.cleared_at || m.created_at > mine.cleared_at)).sort((a, b) => a.created_at.localeCompare(b.created_at));
    },
    async sendMessage(conversationId, body) {
      const me = mustActive(); const mine = db.parts.find((p) => p.conversation_id === conversationId && p.user_id === me.id);
      const other = db.parts.find((p) => p.conversation_id === conversationId && p.user_id !== me.id);
      if (!mine) throw FORBIDDEN();
      if (!other || blocked(me.id, other.user_id)) throw new AppError('conversation_unavailable');
      db.messages.push({ id: uid(), conversation_id: conversationId, sender_id: me.id, body: body.trim(), created_at: now() });
      other.hidden = false; mine.hidden = false; mine.last_read_at = now(); save();
    },
    async markRead(conversationId) {
      // Only write when something is actually unread, otherwise live-update listeners would loop.
      const v = must(); const p = db.parts.find((x) => x.conversation_id === conversationId && x.user_id === v.id);
      if (p && db.messages.some((m) => m.conversation_id === conversationId && m.sender_id !== v.id && m.created_at > p.last_read_at)) { p.last_read_at = now(); save(); }
    },
    async setMuted(conversationId, muted) { const v = must(); const p = db.parts.find((x) => x.conversation_id === conversationId && x.user_id === v.id); if (p) { p.muted = muted; save(); } },
    async deleteConversation(conversationId) { const v = must(); const p = db.parts.find((x) => x.conversation_id === conversationId && x.user_id === v.id); if (p) { p.hidden = true; p.cleared_at = now(); save(); } },
    async inboxBadge() {
      const v = cur(); if (!v || !isActive(v)) return { messages: 0, requests: 0 };
      return {
        messages: v.settings.notify_messages ? conversations(v).filter((c) => !c.muted && !c.blocked).reduce((n, c) => n + c.unread, 0) : 0,
        requests: v.settings.notify_requests ? (await api.listRequests('incoming')).length : 0,
      };
    },
    subscribeMessages(_id, cb) {
      listeners.add(cb); const t = setInterval(cb, 3000); return () => { listeners.delete(cb); clearInterval(t); };
    },

    // ---- safety
    async report({ type, targetId, reason, details }) {
      const me = must(); let reported: string | null = null; let evidence: unknown = null;
      if (type === 'post') reported = db.posts.find((p) => p.id === targetId)?.author_id ?? null;
      else if (type === 'comment') reported = db.comments.find((c) => c.id === targetId)?.author_id ?? null;
      else if (type === 'user') reported = user(targetId)?.id ?? null;
      else if (type === 'message') {
        const m = db.messages.find((x) => x.id === targetId);
        const mine = m && db.parts.find((p) => p.conversation_id === m.conversation_id && p.user_id === me.id);
        if (m && mine && (!mine.cleared_at || m.created_at > mine.cleared_at)) {
          reported = m.sender_id;
          evidence = db.messages.filter((x) => x.conversation_id === m.conversation_id && x.created_at <= m.created_at && (!mine.cleared_at || x.created_at > mine.cleared_at)).slice(-6)
            .map((x) => ({ from_reporter: x.sender_id === me.id, body: x.body, at: x.created_at, reported: x.id === m.id }));
        }
      } else {
        const mine = db.parts.find((p) => p.conversation_id === targetId && p.user_id === me.id);
        reported = mine ? db.parts.find((p) => p.conversation_id === targetId && p.user_id !== me.id)?.user_id ?? null : null;
        if (mine) evidence = db.messages.filter((m) => m.conversation_id === targetId && (!mine.cleared_at || m.created_at > mine.cleared_at)).slice(-20)
          .map((m) => ({ from_reporter: m.sender_id === me.id, body: m.body, at: m.created_at }));
      }
      if (!reported) throw new AppError('target_not_found', 'That item could not be found.');
      if (reported === me.id) throw new AppError('cannot_report_self');
      if (db.reports.some((r) => r.reporter_id === me.id && r.target_type === type && r.target_id === targetId)) return;
      db.reports.push({ id: uid(), reporter_id: me.id, target_type: type, target_id: targetId, reported_user_id: reported, reason, details: details?.trim() || null, evidence, status: 'open', resolution_note: null, created_at: now() });
      if (type === 'post' || type === 'comment') {
        const n = new Set(db.reports.filter((r) => r.target_type === type && r.target_id === targetId && r.status === 'open').map((r) => r.reporter_id)).size;
        if (n >= 3) { const t = type === 'post' ? db.posts.find((p) => p.id === targetId) : db.comments.find((c) => c.id === targetId); if (t && t.status === 'published') t.status = 'under_review'; }
      }
      save();
    },
    async submitAppeal(message) {
      const u = must(); if (isActive(u)) throw FORBIDDEN();
      if (db.appeals.some((a) => a.user_id === u.id && a.status === 'pending')) throw new AppError('duplicate', 'You already have an appeal under review.');
      db.appeals.unshift({ id: uid(), user_id: u.id, message, status: 'pending', admin_note: null, created_at: now() }); save();
    },
    async listMyAppeals() { const u = must(); return db.appeals.filter((a) => a.user_id === u.id); },
    async requestVerification(statement, evidence) {
      const u = mustActive(); if (db.verifications.some((v) => v.user_id === u.id && v.status === 'pending')) throw new AppError('duplicate', 'You already have a request under review.');
      db.verifications.unshift({ id: uid(), user_id: u.id, statement, evidence_path: evidence ? `preview-only/${evidence.name}` : null, status: 'pending', reviewer_note: null, created_at: now() }); save();
    },
    async getMyVerification() { const u = must(); return db.verifications.find((v) => v.user_id === u.id) ?? null; },

    // ---- staff
    async staffStats() {
      mustStaff(); const week = Date.now() - 7 * 864e5;
      const daily = Array.from({ length: 14 }, (_, i) => {
        const d = new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10); const on = (iso: string) => iso.slice(0, 10) === d;
        return { day: d, posts: db.posts.filter((p) => on(p.created_at)).length, comments: db.comments.filter((c) => on(c.created_at)).length, members: db.users.filter((u) => on(u.created_at)).length };
      });
      return {
        members: db.users.length, new_members_7d: db.users.filter((u) => +new Date(u.created_at) > week).length,
        posts: db.posts.length, posts_7d: db.posts.filter((p) => +new Date(p.created_at) > week).length,
        comments_7d: db.comments.filter((c) => +new Date(c.created_at) > week).length,
        conversations: db.conversations.length, messages_7d: db.messages.filter((m) => +new Date(m.created_at) > week).length,
        open_reports: db.reports.filter((r) => r.status === 'open').length,
        under_review: db.posts.filter((p) => p.status === 'under_review').length + db.comments.filter((c) => c.status === 'under_review').length,
        sensitive_unreviewed: db.posts.filter((p) => p.sensitive && !p.reviewed_at && p.status === 'published').length,
        suspended: db.users.filter((u) => u.status === 'suspended').length,
        pending_appeals: db.appeals.filter((a) => a.status === 'pending').length,
        pending_verifications: db.verifications.filter((v) => v.status === 'pending').length, daily,
      } satisfies StaffStats;
    },
    async staffListReports(status) { mustStaff(); return db.reports.filter((r) => status === 'all' || r.status === status).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 100) as Report[]; },
    async staffSetContentStatus(type, id, status, note) {
      mustStaff(); const t = type === 'post' ? db.posts.find((p) => p.id === id) : db.comments.find((c) => c.id === id); if (!t) return;
      t.status = status; if (type === 'post' && status === 'published') (t as P).reviewed_at = now();
      log(`content_${status}`, type, id, note ?? null); save();
    },
    async staffResolveReport(id, resolution, note, contentStatus) {
      mustStaff(); const r = db.reports.find((x) => x.id === id); if (!r) throw new AppError('report_not_found', 'Report not found.');
      if (contentStatus && (r.target_type === 'post' || r.target_type === 'comment' )) {
        const t = r.target_type === 'post' ? db.posts.find((p) => p.id === r.target_id) : db.comments.find((c) => c.id === r.target_id);
        if (t) { t.status = contentStatus; if (r.target_type === 'post' && contentStatus === 'published') (t as P).reviewed_at = now(); log(`content_${contentStatus}`, r.target_type, r.target_id, note ?? null); }
      }
      r.status = resolution; r.resolution_note = note ?? null;
      if (resolution === 'dismissed' && !contentStatus && (r.target_type === 'post' || r.target_type === 'comment')
        && !db.reports.some((x) => x.target_id === r.target_id && x.status === 'open')) {
        const t = r.target_type === 'post' ? db.posts.find((p) => p.id === r.target_id) : db.comments.find((c) => c.id === r.target_id);
        if (t && t.status === 'under_review') t.status = 'published';
      }
      log(`report_${resolution}`, 'report', id, note ?? null); save();
    },
    async staffListComments(status) {
      const v = mustStaff(); return db.comments.filter((c) => status === 'any' || c.status === status).sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((c) => commentView(c, v)).filter(Boolean).slice(0, 100) as Comment[];
    },
    async staffGetComment(id) { const v = mustStaff(); const c = db.comments.find((x) => x.id === id); return c ? commentView(c, v) : null; },
    async staffListLog() { mustStaff(); return db.log.slice(0, 150); },

    // ---- admin
    async adminListUsers(search) {
      mustAdmin();
      return db.users.filter((u) => !search || u.username.includes(search.toLowerCase())).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((u): AdminUser => ({
        id: u.id, username: u.username, role: u.role, status: isActive(u) ? 'active' : 'suspended', suspended_until: u.until, reason: u.reason,
        created_at: u.created_at, post_count: db.posts.filter((p) => p.author_id === u.id).length,
        open_reports: db.reports.filter((r) => r.reported_user_id === u.id && r.status === 'open').length, verified: u.verified,
      }));
    },
    async adminSetAccountStatus(userId, status, reason, until) {
      const me = mustAdmin(); const t = user(userId); if (!t) throw new AppError('user_not_found', 'Member not found.');
      if (t.id === me.id) throw new AppError('cannot_modify_self'); if (t.role === 'admin') throw new AppError('cannot_modify_admin');
      t.status = status; t.reason = status === 'suspended' ? reason ?? null : null; t.until = status === 'suspended' ? until ?? null : null;
      log(`account_${status}`, 'user', userId, reason ?? null); save();
    },
    async adminSetRole(userId, role) {
      const me = mustAdmin(); const t = user(userId); if (!t) throw new AppError('user_not_found', 'Member not found.');
      if (t.id === me.id) throw new AppError('cannot_modify_self'); t.role = role; log(`role_${role}`, 'user', userId, null); save();
    },
    async adminListAppeals() { mustAdmin(); return db.appeals.map((a) => ({ ...a, username: user(a.user_id)?.username })); },
    async adminResolveAppeal(id, decision, note) {
      mustAdmin(); const a = db.appeals.find((x) => x.id === id && x.status === 'pending'); if (!a) throw new AppError('appeal_not_found', 'Appeal not found.');
      a.status = decision; a.admin_note = note ?? null;
      if (decision === 'granted') { const t = user(a.user_id); if (t) { t.status = 'active'; t.reason = null; t.until = null; } }
      log(`appeal_${decision}`, 'user', a.user_id, note ?? null); save();
    },
    async adminListVerifications() { mustAdmin(); return db.verifications.map((v) => ({ ...v, username: user(v.user_id)?.username })); },
    async adminResolveVerification(id, decision, note) {
      mustAdmin(); const v = db.verifications.find((x) => x.id === id && x.status === 'pending'); if (!v) throw new AppError('request_not_found', 'Request not found.');
      v.status = decision; v.reviewer_note = note ?? null; if (decision === 'approved') { const t = user(v.user_id); if (t) t.verified = true; }
      log(`verification_${decision}`, 'user', v.user_id, note ?? null); save();
    },
    async adminEvidenceUrl() { return null; },
    async adminSaveCategory(c) {
      mustAdmin(); const ex = c.id ? db.categories.find((x) => x.id === c.id) : db.categories.find((x) => x.slug === c.slug);
      if (ex) Object.assign(ex, c); else db.categories.push({ id: uid(), description: '', icon: 'sparkles', tone: 'plum', sensitive: false, sort: db.categories.length + 1, is_active: true, ...c } as Category);
      log('save_categories', 'categories', null, c.name); save();
    },
    async adminSaveWishTopic(w) {
      mustAdmin(); const ex = db.wishTopics.find((x) => x.slug === w.slug);
      if (ex) Object.assign(ex, w); else db.wishTopics.push({ sort: db.wishTopics.length + 1, is_active: true, ...w } as WishTopic);
      log('save_wish_topics', 'wish_topics', null, w.label); save();
    },
    async adminSaveSituation(s) {
      mustAdmin(); const ex = s.id ? db.situations.find((x) => x.id === s.id) : null;
      if (ex) Object.assign(ex, s); else db.situations.push({ id: uid(), category_id: null, sort: db.situations.length + 1, is_active: true, ...s } as Situation);
      log('save_situations', 'situations', null, s.label); save();
    },
    async adminSaveCollection(id, c) {
      mustAdmin(); const ex = id ? db.collections.find((x) => x.id === id) : null;
      if (ex) Object.assign(ex, c, { updated_at: now() });
      else db.collections.push({ id: uid(), sort: db.collections.length + 1, updated_at: now(), ...c } as DB['collections'][number]);
      log('save_collections', 'collections', id, c.title); save();
    },
    async adminDeleteCollection(id) { mustAdmin(); db.collections = db.collections.filter((c) => c.id !== id); db.items = db.items.filter((i) => i.collection_id !== id); save(); },
    async adminListCollections() { const v = mustAdmin(); return db.collections.slice().sort((a, b) => a.sort - b.sort).map((c) => collectionView(c, v)); },
    async adminAddCollectionItem(collectionId, postId, itemType, takeaway) {
      const me = mustAdmin(); const p = db.posts.find((x) => x.id === postId);
      if (!p || p.status !== 'published') throw new AppError('post_not_published');
      if (!p.allow_curation) throw new AppError('author_has_not_consented');
      if (p.sensitive && !p.reviewed_at) throw new AppError('sensitive_post_needs_review');
      if (db.items.some((i) => i.collection_id === collectionId && i.post_id === postId)) throw new AppError('duplicate', 'Already in this collection.');
      db.items.push({ id: uid(), collection_id: collectionId, post_id: postId, item_type: itemType, key_takeaway: takeaway, position: db.items.filter((i) => i.collection_id === collectionId).length + 1, reviewed_by: me.id, reviewed_at: now() });
      log('insert_collection_items', 'collection_items', postId, null); save();
    },
    async adminRemoveCollectionItem(entryId) { mustAdmin(); db.items = db.items.filter((i) => i.id !== entryId); save(); },
  };
  return api;
}

/** Wipes the preview database (used by the "reset preview" link). */
export function resetPreviewData() { localStorage.removeItem(KEY); sessionStorage.removeItem('amongher.preview.reset'); }
