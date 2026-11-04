-- =====================================================================
-- AMONGHER · 0003 · Views, Row Level Security and grants
--
-- Model
--   * Every table has RLS enabled. Nobody is granted anything by default.
--   * Members never SELECT the raw `profiles` / `posts` / `comments` tables
--     for other people's rows. They read *views* that shape the data:
--       - anonymous posts/comments have the author fields nulled
--       - private profiles have bio/location/interests nulled
--       - blocked members, suspended viewers and hidden content are filtered
--   * Views run with the owner's rights (that is how they can see across
--     rows), so each one re-applies the viewer checks using auth.uid().
--   * Writes go through column-limited grants + RLS, or through the
--     SECURITY DEFINER RPCs in 0002.
-- =====================================================================

-- ---------- Start from zero ------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------- Views ----------------------------------------------------

create view public.public_profiles with (security_barrier = true) as
select p.id, p.username, p.avatar_motif, p.avatar_tone, p.verified_contributor, p.created_at, p.visibility,
       (p.id = auth.uid()) as is_me,
       case when p.visibility = 'members' or p.id = auth.uid() or private.is_staff() then p.bio end       as bio,
       case when p.visibility = 'members' or p.id = auth.uid() or private.is_staff() then p.location end  as location,
       case when p.visibility = 'members' or p.id = auth.uid() or private.is_staff() then p.interests
            else '{}'::text[] end                                                                          as interests,
       exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.id)  as followed_by_me
  from public.profiles p
 where auth.uid() is not null
   and private.account_is_active(auth.uid())
   and not private.blocked_between(auth.uid(), p.id);

create view public.post_feed with (security_barrier = true) as
select p.id, p.kind, p.category_id, p.wish_topic, p.situation_id, p.title, p.body,
       p.sensitive, p.status, p.created_at, p.is_anonymous,
       (p.author_id = auth.uid())                                           as is_mine,
       case when p.author_id = auth.uid() or private.is_staff() then p.allow_curation end as allow_curation,
       case when reveal.ok then p.author_id end                             as author_id,
       case when reveal.ok then a.username end                              as author_username,
       case when reveal.ok then a.avatar_motif end                          as author_avatar_motif,
       case when reveal.ok then a.avatar_tone end                           as author_avatar_tone,
       case when reveal.ok then a.verified_contributor end                  as author_verified,
       coalesce(rc.felt, 0)::int      as felt_count,
       coalesce(rc.helpful, 0)::int   as helpful_count,
       coalesce(rc.strength, 0)::int  as strength_count,
       coalesce(rc.total, 0)::int     as reaction_count,
       coalesce(cc.n, 0)::int         as comment_count,
       (coalesce(rc.total, 0) * 2 + coalesce(cc.n, 0) * 3)::int as popularity,
       (select r.type from public.reactions r where r.post_id = p.id and r.user_id = auth.uid()) as my_reaction,
       exists (select 1 from public.bookmarks b where b.post_id = p.id and b.user_id = auth.uid()) as bookmarked,
       (not p.is_anonymous and exists (select 1 from public.follows f
                                        where f.follower_id = auth.uid() and f.followee_id = p.author_id)) as followed_by_me,
       p.fts
  from public.posts p
  join public.profiles a on a.id = p.author_id
 cross join lateral (select (not p.is_anonymous or p.author_id = auth.uid() or private.is_staff()) as ok) reveal
  left join lateral (select count(*) filter (where r.type = 'felt_this')        as felt,
                            count(*) filter (where r.type = 'helpful')          as helpful,
                            count(*) filter (where r.type = 'sending_strength') as strength,
                            count(*)                                            as total
                       from public.reactions r where r.post_id = p.id) rc on true
  left join lateral (select count(*) as n from public.comments c
                      where c.post_id = p.id and c.status = 'published') cc on true
 where auth.uid() is not null
   and private.account_is_active(auth.uid())
   and ((p.status = 'published' and not private.blocked_between(auth.uid(), p.author_id))
        or p.author_id = auth.uid()
        or private.is_staff());

create view public.comment_feed with (security_barrier = true) as
select c.id, c.post_id, c.parent_id, c.body, c.is_helpful, c.status, c.created_at, c.is_anonymous,
       (c.author_id = auth.uid()) as is_mine,
       -- "Original poster" label: never attaches to a comment that chose to be anonymous on a named post.
       (c.author_id = p.author_id and (p.is_anonymous or not c.is_anonymous)) as is_op,
       case when reveal.ok then c.author_id end             as author_id,
       case when reveal.ok then a.username end              as author_username,
       case when reveal.ok then a.avatar_motif end          as author_avatar_motif,
       case when reveal.ok then a.avatar_tone end           as author_avatar_tone,
       case when reveal.ok then a.verified_contributor end  as author_verified
  from public.comments c
  join public.posts p on p.id = c.post_id
  join public.profiles a on a.id = c.author_id
 cross join lateral (select (not c.is_anonymous or c.author_id = auth.uid() or private.is_staff()) as ok) reveal
 where auth.uid() is not null
   and private.account_is_active(auth.uid())
   and exists (select 1 from public.post_feed pf where pf.id = c.post_id)
   and ((c.status = 'published' and not private.blocked_between(auth.uid(), c.author_id))
        or c.author_id = auth.uid()
        or private.is_staff());

create view public.library_entries with (security_barrier = true) as
select ci.id as entry_id, ci.collection_id, c.slug as collection_slug, c.title as collection_title,
       ci.item_type, ci.key_takeaway, ci.position, ci.reviewed_at, pf.*
  from public.collection_items ci
  join public.collections c on c.id = ci.collection_id
  join public.post_feed pf on pf.id = ci.post_id
 where pf.status = 'published'
   and (c.status = 'published' or private.is_staff());

create view public.collection_overview with (security_barrier = true) as
select c.id, c.slug, c.title, c.description, c.curator_note, c.category_id, c.tone, c.status, c.sort, c.updated_at,
       (select count(*) from public.library_entries e where e.collection_id = c.id)::int as entry_count,
       exists (select 1 from public.saved_collections s where s.collection_id = c.id and s.user_id = auth.uid()) as saved_by_me
  from public.collections c
 where auth.uid() is not null
   and private.account_is_active(auth.uid())
   and (c.status = 'published' or private.is_staff());

create or replace function public.list_my_blocks()
returns table (user_id uuid, username text, avatar_motif text, avatar_tone smallint, blocked_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id, p.username, p.avatar_motif, p.avatar_tone, b.created_at
    from public.blocks b join public.profiles p on p.id = b.blocked_id
   where b.blocker_id = auth.uid() order by b.created_at desc;
$$;

-- ---------- Enable RLS everywhere ------------------------------------
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- Identity -------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or private.is_staff());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid() and private.account_is_active(auth.uid()))
  with check (id = auth.uid());
-- Only these columns are writable by the member: not username, not verified_contributor.
grant select on public.profiles to authenticated;
grant update (avatar_motif, avatar_tone, bio, location, interests, visibility, onboarded_at)
  on public.profiles to authenticated;

create policy settings_select_own on public.user_settings for select to authenticated using (user_id = auth.uid());
create policy settings_update_own on public.user_settings for update to authenticated
  using (user_id = auth.uid() and private.account_is_active(auth.uid())) with check (user_id = auth.uid());
grant select on public.user_settings to authenticated;
grant update (dm_permission, discoverable, discoverable_note, notify_requests, notify_messages)
  on public.user_settings to authenticated;    -- age_* columns are immutable from the client

create policy roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or private.is_admin());
grant select on public.user_roles to authenticated;          -- no write grant: roles change via admin_set_role()

create policy status_select on public.account_status for select to authenticated
  using (user_id = auth.uid() or private.is_staff());
grant select on public.account_status to authenticated;      -- no write grant: changes via admin_set_account_status()

grant select on public.public_profiles to authenticated;

-- ---------- Taxonomy -------------------------------------------------
create policy categories_select on public.categories for select to authenticated using (true);
create policy categories_admin  on public.categories for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
grant select, insert, update, delete on public.categories to authenticated;

create policy situations_select on public.situations for select to authenticated using (true);
create policy situations_admin  on public.situations for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
grant select, insert, update, delete on public.situations to authenticated;

create policy wish_topics_select on public.wish_topics for select to authenticated using (true);
create policy wish_topics_admin  on public.wish_topics for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
grant select, insert, update, delete on public.wish_topics to authenticated;

create policy profile_situations_own on public.profile_situations for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and private.account_is_active(auth.uid()));
grant select, insert, delete on public.profile_situations to authenticated;

-- ---------- Content --------------------------------------------------
-- Raw table: own rows + staff only. Everyone else reads post_feed.
create policy posts_select on public.posts for select to authenticated
  using (author_id = auth.uid() or private.is_staff());
create policy posts_insert on public.posts for insert to authenticated
  with check (author_id = auth.uid() and private.account_is_active(auth.uid()));
create policy posts_delete_own on public.posts for delete to authenticated
  using (author_id = auth.uid());
grant select on public.posts to authenticated;
grant insert (author_id, kind, category_id, wish_topic, situation_id, title, body, is_anonymous, allow_curation)
  on public.posts to authenticated;
grant delete on public.posts to authenticated;

create policy comments_select on public.comments for select to authenticated
  using (author_id = auth.uid() or private.is_staff());
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = auth.uid() and private.account_is_active(auth.uid()));
create policy comments_delete_own on public.comments for delete to authenticated
  using (author_id = auth.uid());
grant select on public.comments to authenticated;
grant insert (post_id, parent_id, author_id, body, is_anonymous) on public.comments to authenticated;
grant delete on public.comments to authenticated;

create policy reactions_own on public.reactions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and private.account_is_active(auth.uid())
              and exists (select 1 from public.post_feed pf where pf.id = post_id and pf.status = 'published'));
grant select, insert, update, delete on public.reactions to authenticated;

create policy bookmarks_own on public.bookmarks for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and private.account_is_active(auth.uid())
              and exists (select 1 from public.post_feed pf where pf.id = post_id and pf.status = 'published'));
grant select, insert, delete on public.bookmarks to authenticated;

create policy follows_own on public.follows for all to authenticated
  using (follower_id = auth.uid())
  with check (follower_id = auth.uid() and private.account_is_active(auth.uid())
              and not private.blocked_between(follower_id, followee_id));
grant select, insert, delete on public.follows to authenticated;

create policy blocks_own on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
grant select, insert, delete on public.blocks to authenticated;

grant select on public.post_feed, public.comment_feed to authenticated;

-- ---------- Library --------------------------------------------------
create policy collections_select on public.collections for select to authenticated
  using ((status = 'published' and private.account_is_active(auth.uid())) or private.is_staff());
create policy collections_admin on public.collections for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
grant select, insert, update, delete on public.collections to authenticated;

create policy collection_items_staff_select on public.collection_items for select to authenticated
  using (private.is_staff());
create policy collection_items_admin on public.collection_items for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
grant select on public.collection_items to authenticated;
grant insert (collection_id, post_id, item_type, key_takeaway, position) on public.collection_items to authenticated;
grant update (item_type, key_takeaway, position) on public.collection_items to authenticated;
grant delete on public.collection_items to authenticated;

create policy saved_collections_own on public.saved_collections for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and private.account_is_active(auth.uid()));
grant select, insert, delete on public.saved_collections to authenticated;

grant select on public.library_entries, public.collection_overview to authenticated;

-- ---------- Messaging ------------------------------------------------
-- Conversations are only ever created by respond_to_request(); nobody can insert directly.
create policy conversations_select on public.conversations for select to authenticated
  using (private.is_conversation_member(id));
grant select on public.conversations to authenticated;

create policy participants_select_own on public.conversation_participants for select to authenticated
  using (user_id = auth.uid());
create policy participants_update_own on public.conversation_participants for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select on public.conversation_participants to authenticated;
grant update (muted, last_read_at) on public.conversation_participants to authenticated;

create policy messages_select on public.messages for select to authenticated
  using (exists (select 1 from public.conversation_participants cp
                  where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
                    and (cp.cleared_at is null or messages.created_at > cp.cleared_at)));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and private.is_conversation_member(conversation_id)
              and private.account_is_active(auth.uid()));
grant select on public.messages to authenticated;
grant insert (conversation_id, sender_id, body) on public.messages to authenticated;

create policy requests_select_own on public.message_requests for select to authenticated
  using (requester_id = auth.uid() or recipient_id = auth.uid());
grant select on public.message_requests to authenticated;   -- writes: send_message_request()/respond_to_request() only

-- ---------- Safety & moderation --------------------------------------
create policy reports_select on public.reports for select to authenticated
  using (reporter_id = auth.uid() or private.is_staff());
grant select on public.reports to authenticated;            -- inserts: submit_report(); updates: staff_resolve_report()

create policy moderation_log_staff on public.moderation_log for select to authenticated
  using (private.is_staff());
grant select on public.moderation_log to authenticated;

create policy appeals_select on public.appeals for select to authenticated
  using (user_id = auth.uid() or private.is_admin());
create policy appeals_insert on public.appeals for insert to authenticated
  with check (user_id = auth.uid() and not private.account_is_active(auth.uid()));   -- only suspended members appeal
grant select on public.appeals to authenticated;
grant insert (user_id, message) on public.appeals to authenticated;

create policy verification_select on public.verification_requests for select to authenticated
  using (user_id = auth.uid() or private.is_admin());
create policy verification_insert on public.verification_requests for insert to authenticated
  with check (user_id = auth.uid() and private.account_is_active(auth.uid())
              and (evidence_path is null or evidence_path like auth.uid()::text || '/%'));
grant select on public.verification_requests to authenticated;
grant insert (user_id, statement, evidence_path) on public.verification_requests to authenticated;

-- ---------- RPC surface ---------------------------------------------
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function
  public.delete_my_account(),
  public.set_post_curation_consent(uuid, boolean),
  public.mark_comment_helpful(uuid, boolean),
  public.send_message_request(uuid, text, uuid, uuid),
  public.respond_to_request(uuid, boolean),
  public.withdraw_request(uuid),
  public.delete_conversation(uuid),
  public.list_message_requests(text),
  public.list_my_conversations(),
  public.inbox_badge(),
  public.find_understanders(uuid),
  public.submit_report(text, uuid, text, text, uuid),
  public.list_my_blocks(),
  public.staff_set_content_status(text, uuid, text, text),
  public.staff_resolve_report(uuid, text, text, text),
  public.staff_stats(),
  public.admin_set_account_status(uuid, text, text, timestamptz),
  public.admin_set_role(uuid, text),
  public.admin_resolve_appeal(uuid, text, text),
  public.admin_resolve_verification(uuid, text, text),
  public.admin_list_users(text, int)
  to authenticated;

-- ---------- Realtime (Supabase only) ---------------------------------
-- postgres_changes respects RLS, so members only receive messages they could SELECT.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
