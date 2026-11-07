export type Tone = 'rose' | 'plum' | 'blue' | 'sage' | 'apricot' | 'indigo' | 'clay' | 'ochre';
export type AvatarMotif = 'ring' | 'arc' | 'petal' | 'dots' | 'wave' | 'leaf' | 'sun' | 'knot';
export type Role = 'member' | 'moderator' | 'admin';
export type PostKind = 'experience' | 'question' | 'wish';
export type ReactionType = 'felt_this' | 'helpful' | 'sending_strength';
export type ContentStatus = 'published' | 'under_review' | 'hidden' | 'removed';
export type FeedFilter = 'latest' | 'popular' | 'following' | 'questions' | 'experiences';
export type Visibility = 'members' | 'private';
export type DmPermission = 'everyone' | 'nobody';
export type ItemType = 'experience' | 'lesson' | 'advice' | 'insight';

export interface AvatarSpec { avatar_motif: AvatarMotif; avatar_tone: number }

export interface Category {
  id: string; slug: string; name: string; description: string; icon: string; tone: Tone;
  sensitive: boolean; sort: number; is_active: boolean;
}
export interface Situation { id: string; slug: string; label: string; category_id: string | null; sort: number; is_active: boolean }
export interface WishTopic { slug: string; label: string; sort: number; is_active: boolean }

export interface Post {
  id: string; kind: PostKind; category_id: string; wish_topic: string | null; situation_id: string | null;
  title: string; body: string; sensitive: boolean; status: ContentStatus; created_at: string;
  is_anonymous: boolean; is_mine: boolean; allow_curation: boolean | null;
  author_id: string | null; author_username: string | null;
  author_avatar_motif: AvatarMotif | null; author_avatar_tone: number | null; author_verified: boolean | null;
  felt_count: number; helpful_count: number; strength_count: number; reaction_count: number;
  comment_count: number; popularity: number; my_reaction: ReactionType | null;
  bookmarked: boolean; followed_by_me: boolean;
}

export interface Comment {
  id: string; post_id: string; parent_id: string | null; body: string; is_helpful: boolean;
  status: ContentStatus; created_at: string; is_anonymous: boolean; is_mine: boolean; is_op: boolean;
  author_id: string | null; author_username: string | null;
  author_avatar_motif: AvatarMotif | null; author_avatar_tone: number | null; author_verified: boolean | null;
}

export interface Member {
  id: string; username: string; avatar_motif: AvatarMotif; avatar_tone: number; verified_contributor: boolean;
  created_at: string; visibility: Visibility; is_me: boolean;
  bio: string | null; location: string | null; interests: string[]; followed_by_me: boolean;
}

export interface Settings {
  dm_permission: DmPermission; discoverable: boolean; discoverable_note: string | null;
  notify_requests: boolean; notify_messages: boolean; age_confirmed_at: string; age_assurance: 'self_declared';
}

export interface Me {
  id: string; email: string; username: string; avatar_motif: AvatarMotif; avatar_tone: number;
  bio: string | null; location: string | null; interests: string[]; visibility: Visibility;
  verified_contributor: boolean; onboarded: boolean; role: Role;
  status: 'active' | 'suspended'; suspended_reason: string | null; suspended_until: string | null;
  settings: Settings; situation_ids: string[];
}

export interface Collection {
  id: string; slug: string; title: string; description: string; curator_note: string;
  category_id: string | null; tone: Tone; status: 'draft' | 'published'; sort: number;
  entry_count: number; saved_by_me: boolean; updated_at: string;
}
export interface LibraryEntry extends Post {
  entry_id: string; collection_id: string; collection_slug: string; collection_title: string;
  item_type: ItemType; key_takeaway: string; position: number;
}

export interface Understander {
  user_id: string; username: string; avatar_motif: AvatarMotif; avatar_tone: number;
  bio: string | null; note: string | null; verified: boolean;
}

export interface MessageRequest {
  id: string; direction: 'incoming' | 'outgoing'; status: 'pending' | 'accepted' | 'declined' | 'withdrawn';
  intro: string; other_id: string; other_username: string; other_avatar_motif: AvatarMotif; other_avatar_tone: number;
  context_title: string | null; created_at: string; conversation_id: string | null;
}
export interface ConversationSummary {
  id: string; other_id: string; other_username: string; other_avatar_motif: AvatarMotif; other_avatar_tone: number;
  muted: boolean; last_body: string | null; last_at: string; last_from_me: boolean; unread: number; blocked: boolean;
}
export interface Message { id: string; conversation_id: string; sender_id: string | null; body: string; created_at: string }

export type ReportTarget = 'post' | 'comment' | 'user' | 'conversation' | 'message';
export type ReportReason =
  | 'harassment' | 'abuse_or_threats' | 'hate' | 'self_harm' | 'unsafe_advice'
  | 'privacy' | 'spam' | 'misinformation' | 'impersonation' | 'other';
export interface Report {
  id: string; reporter_id: string | null; target_type: ReportTarget; target_id: string;
  reported_user_id: string | null; reason: ReportReason; details: string | null; evidence: unknown | null;
  status: 'open' | 'actioned' | 'dismissed'; resolution_note: string | null; created_at: string;
}
export interface BlockedMember { user_id: string; username: string; avatar_motif: AvatarMotif; avatar_tone: number; blocked_at: string }
export interface Appeal { id: string; user_id: string; message: string; status: 'pending' | 'granted' | 'denied'; admin_note: string | null; created_at: string; username?: string }
export interface VerificationRequest {
  id: string; user_id: string; statement: string; evidence_path: string | null;
  status: 'pending' | 'approved' | 'rejected'; reviewer_note: string | null; created_at: string; username?: string;
}
export interface AdminUser {
  id: string; username: string; role: Role; status: 'active' | 'suspended'; suspended_until: string | null;
  reason: string | null; created_at: string; post_count: number; open_reports: number; verified: boolean;
}
export interface StaffStats {
  members: number; new_members_7d: number; posts: number; posts_7d: number; comments_7d: number;
  conversations: number; messages_7d: number; open_reports: number; under_review: number;
  sensitive_unreviewed: number; suspended: number; pending_appeals: number; pending_verifications: number;
  daily: { day: string; posts: number; comments: number; members: number }[];
}
export interface LogEntry { id: string; actor_id: string | null; action: string; target_type: string | null; target_id: string | null; note: string | null; created_at: string }
