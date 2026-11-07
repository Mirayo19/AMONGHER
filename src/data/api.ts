import type {
  AdminUser, Appeal, AvatarMotif, BlockedMember, Category, Collection, Comment, ConversationSummary,
  DmPermission, FeedFilter, ItemType, LibraryEntry, LogEntry, Me, Member, Message, MessageRequest, Post,
  PostKind, ReactionType, Report, ReportReason, ReportTarget, Role, Settings, Situation, StaffStats,
  Understander, VerificationRequest, Visibility, WishTopic, ContentStatus, Tone,
} from '@/lib/types';

export interface PostQuery {
  filter?: FeedFilter;
  kind?: PostKind;
  categoryId?: string;
  wishTopic?: string;
  situationId?: string;
  authorId?: string;
  mine?: boolean;
  bookmarked?: boolean;
  search?: string;
  status?: ContentStatus | 'any';
  allowCurationOnly?: boolean;
  ids?: string[];
  limit?: number;
  offset?: number;
}

export interface NewPost {
  kind: PostKind; category_id: string; title: string; body: string;
  wish_topic?: string | null; situation_id?: string | null; is_anonymous: boolean; allow_curation: boolean;
}

export interface SignUpInput { email: string; password: string; username: string; ageConfirmed: boolean }
export interface ProfilePatch {
  avatar_motif?: AvatarMotif; avatar_tone?: number; bio?: string | null; location?: string | null;
  interests?: string[]; visibility?: Visibility; onboarded_at?: string;
}
export type SettingsPatch = Partial<Pick<Settings, 'dm_permission' | 'discoverable' | 'discoverable_note' | 'notify_requests' | 'notify_messages'>>;

export interface LibraryQuery { search?: string; categoryId?: string; itemType?: ItemType; collectionId?: string; limit?: number }
export interface CollectionInput {
  title: string; slug: string; description: string; curator_note: string; category_id: string | null;
  tone: Tone; status: 'draft' | 'published'; sort?: number;
}

export interface Api {
  mode: 'supabase' | 'preview';
  /** Preview mode only: no email is sent, so the verification link is simulated by this call. */
  previewConfirmEmail?(email: string): Promise<void>;

  // ---- auth
  onAuthChange(cb: () => void): () => void;
  hasSession(): Promise<boolean>;
  signUp(input: SignUpInput): Promise<{ needsEmailVerification: boolean }>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  resendVerification(email: string): Promise<void>;
  usernameAvailable(username: string): Promise<boolean>;
  deleteAccount(): Promise<void>;
  exportMyData(): Promise<Record<string, unknown>>;

  // ---- me
  getMe(): Promise<Me | null>;
  updateProfile(patch: ProfilePatch): Promise<void>;
  updateSettings(patch: SettingsPatch): Promise<void>;
  setMySituations(ids: string[]): Promise<void>;

  // ---- taxonomy
  listCategories(): Promise<Category[]>;
  listSituations(): Promise<Situation[]>;
  listWishTopics(): Promise<WishTopic[]>;

  // ---- posts
  listPosts(q: PostQuery): Promise<Post[]>;
  getPost(id: string): Promise<Post | null>;
  createPost(p: NewPost): Promise<string>;
  deletePost(id: string): Promise<void>;
  editPost(id: string, title: string, body: string): Promise<void>;
  setCurationConsent(postId: string, allow: boolean): Promise<void>;
  setReaction(postId: string, type: ReactionType | null): Promise<void>;
  setBookmark(postId: string, on: boolean): Promise<void>;

  // ---- comments
  listComments(postId: string): Promise<Comment[]>;
  addComment(c: { postId: string; parentId?: string | null; body: string; anonymous: boolean }): Promise<void>;
  deleteComment(id: string): Promise<void>;
  markHelpful(commentId: string, value: boolean): Promise<void>;

  // ---- people
  getMember(username: string): Promise<Member | null>;
  setFollow(userId: string, on: boolean): Promise<void>;
  setBlock(userId: string, on: boolean): Promise<void>;
  listBlocked(): Promise<BlockedMember[]>;

  // ---- library
  listCollections(): Promise<Collection[]>;
  getCollection(slug: string): Promise<{ collection: Collection; entries: LibraryEntry[] } | null>;
  searchLibrary(q: LibraryQuery): Promise<LibraryEntry[]>;
  setCollectionSaved(id: string, on: boolean): Promise<void>;

  // ---- find someone who understands
  findUnderstanders(situationId: string): Promise<Understander[]>;

  // ---- messaging
  sendRequest(input: { recipientId: string; intro: string; contextPostId?: string | null; contextSituationId?: string | null }): Promise<void>;
  respondToRequest(id: string, accept: boolean): Promise<string | null>;
  withdrawRequest(id: string): Promise<void>;
  listRequests(box: 'incoming' | 'outgoing'): Promise<MessageRequest[]>;
  listConversations(): Promise<ConversationSummary[]>;
  getConversation(id: string): Promise<ConversationSummary | null>;
  listMessages(conversationId: string): Promise<Message[]>;
  sendMessage(conversationId: string, body: string): Promise<void>;
  markRead(conversationId: string): Promise<void>;
  setMuted(conversationId: string, muted: boolean): Promise<void>;
  deleteConversation(conversationId: string): Promise<void>;
  inboxBadge(): Promise<{ messages: number; requests: number }>;
  subscribeMessages(conversationId: string, cb: () => void): () => void;

  // ---- safety
  report(input: { type: ReportTarget; targetId: string; reason: ReportReason; details?: string; conversationId?: string }): Promise<void>;
  submitAppeal(message: string): Promise<void>;
  listMyAppeals(): Promise<Appeal[]>;
  requestVerification(statement: string, evidence?: File | null): Promise<void>;
  getMyVerification(): Promise<VerificationRequest | null>;

  // ---- staff (moderator + admin)
  staffStats(): Promise<StaffStats>;
  staffListReports(status: Report['status'] | 'all'): Promise<Report[]>;
  staffResolveReport(id: string, resolution: 'actioned' | 'dismissed', note?: string, contentStatus?: ContentStatus | null): Promise<void>;
  staffSetContentStatus(type: 'post' | 'comment', id: string, status: 'published' | 'hidden' | 'removed', note?: string): Promise<void>;
  staffListComments(status: ContentStatus | 'any'): Promise<Comment[]>;
  staffGetComment(id: string): Promise<Comment | null>;
  staffReviewQueue(): Promise<Post[]>;
  staffGetMemberById(id: string): Promise<Member | null>;
  staffListLog(): Promise<LogEntry[]>;

  // ---- admin only
  adminListUsers(search?: string): Promise<AdminUser[]>;
  adminSetAccountStatus(userId: string, status: 'active' | 'suspended', reason?: string, until?: string | null): Promise<void>;
  adminSetRole(userId: string, role: Role): Promise<void>;
  adminListAppeals(): Promise<Appeal[]>;
  adminResolveAppeal(id: string, decision: 'granted' | 'denied', note?: string): Promise<void>;
  adminListVerifications(): Promise<VerificationRequest[]>;
  adminResolveVerification(id: string, decision: 'approved' | 'rejected', note?: string): Promise<void>;
  adminEvidenceUrl(path: string): Promise<string | null>;
  adminSaveCategory(c: Partial<Category> & { name: string; slug: string }): Promise<void>;
  adminSaveWishTopic(w: Partial<WishTopic> & { label: string; slug: string }): Promise<void>;
  adminSaveSituation(s: Partial<Situation> & { label: string; slug: string }): Promise<void>;
  adminSaveCollection(id: string | null, c: CollectionInput): Promise<void>;
  adminDeleteCollection(id: string): Promise<void>;
  adminListCollections(): Promise<Collection[]>;
  adminAddCollectionItem(collectionId: string, postId: string, itemType: ItemType, takeaway: string): Promise<void>;
  adminRemoveCollectionItem(entryId: string): Promise<void>;
}

export type { DmPermission };

export let api!: Api;
export async function initApi(): Promise<Api> {
  const { isSupabaseConfigured } = await import('@/lib/config');
  api = isSupabaseConfigured
    ? (await import('./supabaseApi')).createSupabaseApi()
    : (await import('./previewApi')).createPreviewApi();
  return api;
}
