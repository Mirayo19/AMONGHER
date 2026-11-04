-- =====================================================================
-- AMONGHER · 0001 · Core schema
-- Tables only. Functions/triggers are in 0002, access control in 0003.
--
-- Design principles
--   * auth.users is the only place that holds email / phone. Nothing in
--     `public` copies them, so they can never leak through the API.
--   * Private account data lives in owner-only tables (user_settings,
--     account_status, user_roles) — never in `profiles`.
--   * Roles are NOT a column users can touch: they live in user_roles,
--     which has no INSERT/UPDATE/DELETE policy for ordinary users.
-- =====================================================================

-- ---------- Identity -------------------------------------------------

create table public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  username             text not null,
  avatar_motif         text not null default 'ring'
                         check (avatar_motif in ('ring','arc','petal','dots','wave','leaf','sun','knot')),
  avatar_tone          smallint not null default 0 check (avatar_tone between 0 and 7),
  bio                  text check (char_length(bio) <= 280),
  location             text check (char_length(location) <= 60),
  interests            text[] not null default '{}' check (cardinality(interests) <= 12),
  visibility           text not null default 'members' check (visibility in ('members','private')),
  verified_contributor boolean not null default false,   -- set only by admin_resolve_verification()
  onboarded_at         timestamptz,
  created_at           timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_]{3,24}$')
);
create unique index profiles_username_key on public.profiles (lower(username));

-- Private, owner-only settings. Never exposed to other members.
create table public.user_settings (
  user_id            uuid primary key references public.profiles(id) on delete cascade,
  dm_permission      text not null default 'everyone' check (dm_permission in ('everyone','nobody')),
  discoverable       boolean not null default false,       -- opt-in to "Find someone who understands"
  discoverable_note  text check (char_length(discoverable_note) <= 200),
  notify_requests    boolean not null default true,
  notify_messages    boolean not null default true,
  age_confirmed_at   timestamptz not null,
  -- HONESTY GUARD: the only value permitted today is 'self_declared'. A tick-box is not
  -- verified age assurance. When a real age-assurance provider is integrated, a later
  -- migration must widen this constraint deliberately.
  age_assurance      text not null default 'self_declared' check (age_assurance in ('self_declared'))
);

create table public.user_roles (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  role       text not null check (role in ('moderator','admin')),   -- absence of a row = ordinary member
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now()
);

create table public.account_status (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  status          text not null default 'active' check (status in ('active','suspended')),
  reason          text,
  suspended_until timestamptz,                       -- null while suspended = indefinite
  updated_by      uuid references public.profiles(id) on delete set null,
  updated_at      timestamptz not null default now()
);

-- ---------- Taxonomy -------------------------------------------------

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name        text not null check (char_length(name) between 2 and 40),
  description text not null default '',
  icon        text not null default 'sparkles',
  tone        text not null default 'plum',
  sensitive   boolean not null default false,        -- adds extra safeguards (notices, review queue)
  sort        int not null default 0,
  is_active   boolean not null default true
);

create table public.situations (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  label       text not null check (char_length(label) between 3 and 90),
  category_id uuid references public.categories(id) on delete set null,
  sort        int not null default 0,
  is_active   boolean not null default true
);

-- Voluntary: rows here only matter when user_settings.discoverable = true.
create table public.profile_situations (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  situation_id uuid not null references public.situations(id) on delete cascade,
  primary key (user_id, situation_id)
);

create table public.wish_topics (
  slug      text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  label     text not null,
  sort      int not null default 0,
  is_active boolean not null default true
);

-- ---------- Content --------------------------------------------------

create table public.posts (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null references public.profiles(id) on delete cascade,
  kind           text not null check (kind in ('experience','question','wish')),
  category_id    uuid not null references public.categories(id),
  wish_topic     text references public.wish_topics(slug),
  situation_id   uuid references public.situations(id) on delete set null,
  title          text not null check (char_length(title) between 4 and 140),
  body           text not null check (char_length(body) between 10 and 5000),
  is_anonymous   boolean not null default false,
  sensitive      boolean not null default false,     -- set by trigger; clients cannot unset it
  allow_curation boolean not null default false,     -- author consent to be featured in the Library
  status         text not null default 'published'
                   check (status in ('published','under_review','hidden','removed')),
  reviewed_at    timestamptz,                        -- set when staff explicitly approve
  created_at     timestamptz not null default now(),
  fts            tsvector generated always as
                   (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(body,''))) stored,
  constraint wish_requires_topic check ((kind = 'wish') = (wish_topic is not null))
);
create index posts_feed_idx     on public.posts (status, created_at desc);
create index posts_category_idx on public.posts (category_id, created_at desc);
create index posts_author_idx   on public.posts (author_id, created_at desc);
create index posts_kind_idx     on public.posts (kind, created_at desc);
create index posts_fts_idx      on public.posts using gin (fts);

create table public.comments (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts(id) on delete cascade,
  parent_id    uuid references public.comments(id) on delete cascade,
  author_id    uuid not null references public.profiles(id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 2000),
  is_anonymous boolean not null default false,
  is_helpful   boolean not null default false,       -- toggled only by the post's author (RPC)
  status       text not null default 'published'
                 check (status in ('published','under_review','hidden','removed')),
  created_at   timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at);

create table public.reactions (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  post_id    uuid not null references public.posts(id) on delete cascade,
  type       text not null check (type in ('felt_this','helpful','sending_strength')),
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)                      -- one reaction per member per post
);
create index reactions_post_idx on public.reactions (post_id);

create table public.bookmarks (                       -- a member's saved experiences
  user_id    uuid not null references public.profiles(id) on delete cascade,
  post_id    uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

-- ---------- Library --------------------------------------------------

create table public.collections (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  title        text not null check (char_length(title) between 4 and 120),
  description  text not null default '',
  curator_note text not null default '',
  category_id  uuid references public.categories(id) on delete set null,
  tone         text not null default 'plum',
  status       text not null default 'draft' check (status in ('draft','published')),
  sort         int not null default 0,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- A curated entry is a *reference* to a moderated post plus an editor-written takeaway.
-- If the author deletes the post, the entry disappears with it (ON DELETE CASCADE).
create table public.collection_items (
  id             uuid primary key default gen_random_uuid(),
  collection_id  uuid not null references public.collections(id) on delete cascade,
  post_id        uuid not null references public.posts(id) on delete cascade,
  item_type      text not null default 'experience' check (item_type in ('experience','lesson','advice','insight')),
  key_takeaway   text not null default '' check (char_length(key_takeaway) <= 280),
  position       int not null default 0,
  reviewed_by    uuid not null references public.profiles(id),   -- the editor who reviewed it
  reviewed_at    timestamptz not null default now(),
  unique (collection_id, post_id)
);

create table public.saved_collections (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (user_id, collection_id)
);

-- ---------- Private messaging ---------------------------------------

create table public.conversations (
  id         uuid primary key default gen_random_uuid(),
  pair_key   text not null unique,                    -- least(a,b)||':'||greatest(a,b): one thread per pair
  created_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  muted           boolean not null default false,
  hidden          boolean not null default false,     -- "delete conversation" (per member)
  cleared_at      timestamptz,                        -- messages before this are invisible to this member
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conv_part_user_idx on public.conversation_participants (user_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid references public.profiles(id) on delete set null,   -- null = deleted account
  body            text not null check (char_length(body) between 1 and 2000),
  created_at      timestamptz not null default now()
);
create index messages_conv_idx on public.messages (conversation_id, created_at);

create table public.message_requests (
  id                   uuid primary key default gen_random_uuid(),
  requester_id         uuid not null references public.profiles(id) on delete cascade,
  recipient_id         uuid not null references public.profiles(id) on delete cascade,
  intro                text not null check (char_length(intro) between 5 and 500),
  context_post_id      uuid references public.posts(id) on delete set null,
  context_situation_id uuid references public.situations(id) on delete set null,
  status               text not null default 'pending' check (status in ('pending','accepted','declined','withdrawn')),
  conversation_id      uuid references public.conversations(id) on delete set null,
  created_at           timestamptz not null default now(),
  responded_at         timestamptz,
  check (requester_id <> recipient_id)
);
create unique index message_requests_one_pending
  on public.message_requests (requester_id, recipient_id) where status = 'pending';
create index message_requests_recipient_idx on public.message_requests (recipient_id, status);

-- ---------- Safety & moderation -------------------------------------

create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid references public.profiles(id) on delete set null,
  target_type      text not null check (target_type in ('post','comment','user','conversation')),
  target_id        uuid not null,
  reported_user_id uuid references public.profiles(id) on delete set null,
  reason           text not null check (reason in
                     ('harassment','abuse_or_threats','hate','self_harm','unsafe_advice',
                      'privacy','spam','misinformation','impersonation','other')),
  details          text check (char_length(details) <= 1000),
  evidence         jsonb,                              -- server-made snapshot for conversation reports
  status           text not null default 'open' check (status in ('open','actioned','dismissed')),
  resolution_note  text,
  resolved_by      uuid references public.profiles(id) on delete set null,
  resolved_at      timestamptz,
  created_at       timestamptz not null default now()
);
create unique index reports_one_per_reporter on public.reports (reporter_id, target_type, target_id);
create index reports_status_idx on public.reports (status, created_at desc);

create table public.moderation_log (                   -- append-only audit trail
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  target_type text,
  target_id   uuid,
  note        text,
  created_at  timestamptz not null default now()
);
create index moderation_log_idx on public.moderation_log (created_at desc);

create table public.appeals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  message     text not null check (char_length(message) between 10 and 1500),
  status      text not null default 'pending' check (status in ('pending','granted','denied')),
  admin_note  text,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index appeals_one_pending on public.appeals (user_id) where status = 'pending';

-- "Verified contributor" = a human reviewed the statement/evidence. It is not an
-- identity or age check and the UI must not describe it as one.
create table public.verification_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  kind          text not null default 'contributor' check (kind in ('contributor')),
  statement     text not null check (char_length(statement) between 20 and 1000),
  evidence_path text,                                  -- object path in the private storage bucket
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewer_note text,
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create unique index verification_one_pending on public.verification_requests (user_id) where status = 'pending';
