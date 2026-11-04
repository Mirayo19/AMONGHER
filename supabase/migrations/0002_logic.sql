-- =====================================================================
-- AMONGHER · 0002 · Functions, triggers and RPCs
--
-- Everything that must be enforced regardless of the client lives here.
-- All SECURITY DEFINER functions pin search_path and re-check auth.uid().
-- =====================================================================

-- ---------- Predicates used by RLS and views -------------------------
-- These live in a schema that PostgREST does NOT expose, so a client cannot call them
-- directly (e.g. to probe whether another member has blocked them).
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.user_roles
                 where user_id = auth.uid() and role in ('moderator','admin'));
$$;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin');
$$;

-- true when the profile exists and is not currently suspended
create or replace function private.account_is_active(uid uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select uid is not null
     and exists (select 1 from public.profiles where id = uid)
     and not exists (select 1 from public.account_status s
                     where s.user_id = uid and s.status = 'suspended'
                       and (s.suspended_until is null or s.suspended_until > now()));
$$;

create or replace function private.blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select a is not null and b is not null and a <> b and exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

create or replace function private.is_conversation_member(conv uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.conversation_participants
                 where conversation_id = conv and user_id = auth.uid());
$$;

create or replace function private.require_staff() returns void
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

create or replace function private.require_admin() returns void
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

-- ---------- Sign-up: profile bootstrap -------------------------------

create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select lower(p_username) ~ '^[a-z0-9_]{3,24}$'
     and lower(p_username) <> all (array['admin','administrator','moderator','mod','staff','team','support',
                                         'help','amongher','official','security','system','anonymous','safety'])
     and not exists (select 1 from public.profiles where lower(username) = lower(p_username));
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_username text := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
begin
  -- Self-declaration only (see user_settings.age_assurance). It is recorded, not verified.
  if coalesce(new.raw_user_meta_data ->> 'age_confirmed', '') <> 'true' then
    raise exception 'age_confirmation_required';
  end if;
  if not public.username_available(v_username) then
    raise exception 'username_unavailable';
  end if;
  insert into public.profiles (id, username) values (new.id, v_username);
  insert into public.user_settings (user_id, age_confirmed_at) values (new.id, now());
  insert into public.account_status (user_id) values (new.id);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Members may delete their own account; everything they own cascades.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- ---------- Posts ----------------------------------------------------

create or replace function public.posts_before_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_cat_sensitive boolean;
  v_recent int;
  -- Words that route a post into the extra-care path (notice + staff review queue).
  v_pattern constant text :=
    '\m(abus(e|ed|ive|er)|assault(ed)?|rape(d)?|harass(ed|ment|ing)?|stalk(ed|er|ing)?|domestic violence|'
    'self[- ]?harm|suicid(e|al)|kill myself|violen(t|ce)|threat(en|ened|ening)?|unsafe|trafficking|'
    'coerc(ed|ion|ive)|controlling partner|blackmail|revenge porn)\M';
begin
  select sensitive into v_cat_sensitive from public.categories where id = new.category_id and is_active;
  if not found then raise exception 'invalid_category'; end if;

  select count(*) into v_recent from public.posts
   where author_id = new.author_id and created_at > now() - interval '1 hour';
  if v_recent >= 20 then raise exception 'rate_limited'; end if;

  new.sensitive   := v_cat_sensitive or (new.title || ' ' || new.body) ~* v_pattern;
  new.status      := 'published';
  new.reviewed_at := null;
  return new;
end $$;
create trigger posts_before_insert before insert on public.posts
  for each row execute function public.posts_before_insert();

-- Author withdraws / grants consent to be featured in the Library.
create or replace function public.set_post_curation_consent(p_post uuid, p_allow boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.posts where id = p_post and author_id = auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.posts set allow_curation = p_allow where id = p_post;
  if not p_allow then delete from public.collection_items where post_id = p_post; end if;
end $$;

-- ---------- Comments -------------------------------------------------

create or replace function public.comments_before_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_post public.posts%rowtype;
  v_parent public.comments%rowtype;
  v_recent int;
begin
  select * into v_post from public.posts where id = new.post_id;
  if not found or v_post.status <> 'published' or private.blocked_between(new.author_id, v_post.author_id) then
    raise exception 'post_unavailable';
  end if;

  if new.parent_id is not null then
    select * into v_parent from public.comments where id = new.parent_id;
    if not found or v_parent.post_id <> new.post_id or v_parent.parent_id is not null
       or v_parent.status <> 'published' or private.blocked_between(new.author_id, v_parent.author_id) then
      raise exception 'invalid_parent';           -- threads are one level deep
    end if;
  end if;

  select count(*) into v_recent from public.comments
   where author_id = new.author_id and created_at > now() - interval '1 hour';
  if v_recent >= 60 then raise exception 'rate_limited'; end if;

  -- If an anonymous poster replies in their own thread, never reveal their username.
  if v_post.is_anonymous and v_post.author_id = new.author_id then new.is_anonymous := true; end if;

  new.status := 'published';
  new.is_helpful := false;
  return new;
end $$;
create trigger comments_before_insert before insert on public.comments
  for each row execute function public.comments_before_insert();

-- Only the person who asked can mark an answer helpful.
create or replace function public.mark_comment_helpful(p_comment uuid, p_value boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.comments c join public.posts p on p.id = c.post_id
                 where c.id = p_comment and p.author_id = auth.uid() and p.kind = 'question'
                   and c.author_id <> auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.comments set is_helpful = p_value where id = p_comment;
end $$;

-- ---------- Library: editorial gate ----------------------------------

create or replace function public.collection_items_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_post public.posts%rowtype;
begin
  select * into v_post from public.posts where id = new.post_id;
  if not found or v_post.status <> 'published' then raise exception 'post_not_published'; end if;
  if not v_post.allow_curation then raise exception 'author_has_not_consented'; end if;
  if v_post.sensitive and v_post.reviewed_at is null then raise exception 'sensitive_post_needs_review'; end if;
  new.reviewed_by := auth.uid();
  new.reviewed_at := now();
  return new;
end $$;
create trigger collection_items_guard before insert on public.collection_items
  for each row execute function public.collection_items_guard();

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create trigger collections_touch before update on public.collections
  for each row execute function public.touch_updated_at();

-- Audit trail for admin-managed configuration.
create or replace function public.log_config_change() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row jsonb := to_jsonb(coalesce(new, old)); v_id uuid;
begin
  begin v_id := (v_row ->> 'id')::uuid; exception when others then v_id := null; end;
  insert into public.moderation_log (actor_id, action, target_type, target_id, note)
  values (auth.uid(), lower(tg_op) || '_' || tg_table_name, tg_table_name, v_id,
          coalesce(v_row ->> 'title', v_row ->> 'name', v_row ->> 'label', v_row ->> 'slug'));
  return coalesce(new, old);
end $$;
create trigger audit_categories  after insert or update or delete on public.categories       for each row execute function public.log_config_change();
create trigger audit_situations  after insert or update or delete on public.situations       for each row execute function public.log_config_change();
create trigger audit_collections after insert or update or delete on public.collections      for each row execute function public.log_config_change();
create trigger audit_coll_items  after insert or update or delete on public.collection_items for each row execute function public.log_config_change();

-- ---------- Messaging ------------------------------------------------

create or replace function public.messages_before_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_other uuid;
begin
  if not private.account_is_active(new.sender_id) then raise exception 'account_suspended'; end if;
  select user_id into v_other from public.conversation_participants
   where conversation_id = new.conversation_id and user_id <> new.sender_id;
  if v_other is null or private.blocked_between(new.sender_id, v_other) then
    raise exception 'conversation_unavailable';
  end if;
  return new;
end $$;
create trigger messages_before_insert before insert on public.messages
  for each row execute function public.messages_before_insert();

create or replace function public.messages_after_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.conversation_participants
     set hidden = false,
         last_read_at = case when user_id = new.sender_id then now() else last_read_at end
   where conversation_id = new.conversation_id;
  return new;
end $$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.messages_after_insert();

create or replace function public.send_message_request(
  p_recipient uuid, p_intro text, p_context_post uuid default null, p_context_situation uuid default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare me uuid := auth.uid(); v_key text; v_perm text; v_id uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if not private.account_is_active(me) then raise exception 'account_suspended'; end if;
  if p_recipient is null or p_recipient = me then raise exception 'invalid_recipient'; end if;

  select dm_permission into v_perm from public.user_settings where user_id = p_recipient;
  -- Same answer for "blocked you", "suspended" and "not accepting" so a block is never revealed.
  if v_perm is distinct from 'everyone' or not private.account_is_active(p_recipient)
     or private.blocked_between(me, p_recipient) then
    raise exception 'not_accepting';
  end if;

  v_key := least(me::text, p_recipient::text) || ':' || greatest(me::text, p_recipient::text);
  if exists (select 1 from public.conversations where pair_key = v_key) then raise exception 'already_connected'; end if;
  if exists (select 1 from public.message_requests where status = 'pending'
             and ((requester_id = me and recipient_id = p_recipient) or (requester_id = p_recipient and recipient_id = me))) then
    raise exception 'request_pending';
  end if;
  if exists (select 1 from public.message_requests where requester_id = me and recipient_id = p_recipient
             and status = 'declined' and responded_at > now() - interval '30 days') then
    raise exception 'recently_declined';
  end if;
  if (select count(*) from public.message_requests
       where requester_id = me and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'rate_limited';
  end if;

  insert into public.message_requests (requester_id, recipient_id, intro, context_post_id, context_situation_id)
  values (me, p_recipient, trim(p_intro), p_context_post, p_context_situation)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.respond_to_request(p_request uuid, p_accept boolean) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare me uuid := auth.uid(); r public.message_requests%rowtype; v_conv uuid; v_key text;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if not private.account_is_active(me) then raise exception 'account_suspended'; end if;
  select * into r from public.message_requests where id = p_request and recipient_id = me and status = 'pending' for update;
  if not found then raise exception 'request_not_found'; end if;

  if not p_accept then
    update public.message_requests set status = 'declined', responded_at = now() where id = r.id;
    return null;
  end if;

  if private.blocked_between(me, r.requester_id) or not private.account_is_active(r.requester_id) then
    raise exception 'conversation_unavailable';
  end if;
  v_key := least(me::text, r.requester_id::text) || ':' || greatest(me::text, r.requester_id::text);
  insert into public.conversations (pair_key) values (v_key)
    on conflict (pair_key) do update set pair_key = excluded.pair_key returning id into v_conv;
  insert into public.conversation_participants (conversation_id, user_id) values (v_conv, me), (v_conv, r.requester_id)
    on conflict (conversation_id, user_id) do update set hidden = false;
  update public.message_requests set status = 'accepted', responded_at = now(), conversation_id = v_conv where id = r.id;
  return v_conv;
end $$;

create or replace function public.withdraw_request(p_request uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.message_requests set status = 'withdrawn', responded_at = now()
   where id = p_request and requester_id = auth.uid() and status = 'pending';
end $$;

create or replace function public.delete_conversation(p_conversation uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.conversation_participants set hidden = true, cleared_at = now()
   where conversation_id = p_conversation and user_id = auth.uid();
end $$;

create or replace function public.list_message_requests(p_box text)
returns table (id uuid, direction text, status text, intro text, other_id uuid, other_username text,
               other_avatar_motif text, other_avatar_tone smallint, context_title text,
               created_at timestamptz, conversation_id uuid)
language sql stable security definer set search_path = public, pg_temp as $$
  select r.id,
         case when r.recipient_id = auth.uid() then 'incoming' else 'outgoing' end,
         r.status, r.intro,
         o.id, o.username, o.avatar_motif, o.avatar_tone,
         (select p.title from public.posts p where p.id = r.context_post_id and p.status = 'published'
            and not p.is_anonymous),   -- never reveal a title that could identify an anonymous author
         r.created_at, r.conversation_id
    from public.message_requests r
    join public.profiles o on o.id = case when r.recipient_id = auth.uid() then r.requester_id else r.recipient_id end
   where auth.uid() is not null and private.account_is_active(auth.uid())
     and ((p_box = 'incoming' and r.recipient_id = auth.uid() and r.status = 'pending')
       or (p_box = 'outgoing' and r.requester_id = auth.uid() and r.created_at > now() - interval '30 days'))
     and not private.blocked_between(auth.uid(), o.id)
   order by r.created_at desc
   limit 100;
$$;

create or replace function public.list_my_conversations()
returns table (id uuid, other_id uuid, other_username text, other_avatar_motif text, other_avatar_tone smallint,
               muted boolean, last_body text, last_at timestamptz, last_from_me boolean, unread int, blocked boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.id, o.id, o.username, o.avatar_motif, o.avatar_tone, mp.muted,
         lm.body, coalesce(lm.created_at, c.created_at), coalesce(lm.sender_id = auth.uid(), false),
         (select count(*)::int from public.messages m
           where m.conversation_id = c.id and m.sender_id is distinct from auth.uid()
             and m.created_at > mp.last_read_at and (mp.cleared_at is null or m.created_at > mp.cleared_at)),
         private.blocked_between(auth.uid(), o.id)
    from public.conversations c
    join public.conversation_participants mp on mp.conversation_id = c.id and mp.user_id = auth.uid() and not mp.hidden
    join public.conversation_participants op on op.conversation_id = c.id and op.user_id <> auth.uid()
    join public.profiles o on o.id = op.user_id
    left join lateral (select m.body, m.created_at, m.sender_id from public.messages m
                        where m.conversation_id = c.id and (mp.cleared_at is null or m.created_at > mp.cleared_at)
                        order by m.created_at desc limit 1) lm on true
   where auth.uid() is not null and private.account_is_active(auth.uid())
   order by coalesce(lm.created_at, c.created_at) desc;
$$;

create or replace function public.inbox_badge() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with s as (select * from public.user_settings where user_id = auth.uid())
  select jsonb_build_object(
    'messages', case when (select notify_messages from s) then
       (select coalesce(sum(unread), 0) from public.list_my_conversations() where not muted and not blocked) else 0 end,
    'requests', case when (select notify_requests from s) then
       (select count(*) from public.list_message_requests('incoming')) else 0 end);
$$;

-- ---------- Find someone who understands ----------------------------

create or replace function public.find_understanders(p_situation uuid)
returns table (user_id uuid, username text, avatar_motif text, avatar_tone smallint,
               bio text, note text, verified boolean, shared_since timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id, p.username, p.avatar_motif, p.avatar_tone,
         case when p.visibility = 'members' then p.bio end,
         s.discoverable_note, p.verified_contributor, p.created_at
    from public.profile_situations ps
    join public.user_settings s on s.user_id = ps.user_id and s.discoverable and s.dm_permission = 'everyone'
    join public.profiles p on p.id = ps.user_id
   where ps.situation_id = p_situation
     and auth.uid() is not null and private.account_is_active(auth.uid())
     and p.id <> auth.uid()
     and private.account_is_active(p.id)
     and not private.blocked_between(auth.uid(), p.id)
   order by p.created_at desc
   limit 30;
$$;

-- ---------- Reporting ------------------------------------------------

create or replace function public.submit_report(
  p_type text, p_target uuid, p_reason text, p_details text default null, p_conversation uuid default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare me uuid := auth.uid(); v_reported uuid; v_evidence jsonb; v_id uuid; v_clear timestamptz;
begin
  if me is null then raise exception 'not_authenticated'; end if;

  if p_type = 'post' then
    select author_id into v_reported from public.posts where id = p_target;
  elsif p_type = 'comment' then
    select author_id into v_reported from public.comments where id = p_target;
  elsif p_type = 'user' then
    select id into v_reported from public.profiles where id = p_target;
  elsif p_type = 'conversation' then
    -- Reporter must be a member. The evidence snapshot is built here, server-side, from what
    -- the reporter could already see, so it can neither be forged nor reach into other threads.
    select op.user_id, mp.cleared_at into v_reported, v_clear
      from public.conversation_participants mp
      join public.conversation_participants op on op.conversation_id = mp.conversation_id and op.user_id <> me
     where mp.conversation_id = p_target and mp.user_id = me;
    if v_reported is not null then
      select coalesce(jsonb_agg(jsonb_build_object('from_reporter', m.sender_id = me, 'body', m.body, 'at', m.created_at)
                                order by m.created_at), '[]'::jsonb)
        into v_evidence
        from (select * from public.messages where conversation_id = p_target
                 and (v_clear is null or created_at > v_clear) order by created_at desc limit 20) m;
    end if;
  else
    raise exception 'invalid_target';
  end if;

  if v_reported is null then raise exception 'target_not_found'; end if;
  if v_reported = me then raise exception 'cannot_report_self'; end if;

  insert into public.reports (reporter_id, target_type, target_id, reported_user_id, reason, details, evidence)
  values (me, p_type, p_target, v_reported, p_reason, nullif(trim(p_details), ''), v_evidence)
  on conflict (reporter_id, target_type, target_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.reports
     where reporter_id = me and target_type = p_type and target_id = p_target;
  end if;
  return v_id;
end $$;

-- Community safety net: three separate members reporting the same post/comment hides it
-- from everyone but its author and staff until a moderator reviews it.
create or replace function public.reports_after_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_n int;
begin
  if new.target_type in ('post','comment') then
    select count(distinct reporter_id) into v_n from public.reports
     where target_type = new.target_type and target_id = new.target_id and status = 'open';
    if v_n >= 3 then
      if new.target_type = 'post' then
        update public.posts set status = 'under_review' where id = new.target_id and status = 'published';
      else
        update public.comments set status = 'under_review' where id = new.target_id and status = 'published';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger reports_after_insert after insert on public.reports
  for each row execute function public.reports_after_insert();

-- ---------- Staff (moderator + admin) --------------------------------

create or replace function private.log_action(p_action text, p_type text, p_target uuid, p_note text) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into public.moderation_log (actor_id, action, target_type, target_id, note)
  values (auth.uid(), p_action, p_type, p_target, p_note);
$$;
revoke all on function private.log_action(text, text, uuid, text) from public, anon, authenticated;

create or replace function public.staff_set_content_status(p_type text, p_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform private.require_staff();
  if p_status not in ('published','hidden','removed') then raise exception 'invalid_status'; end if;
  if p_type = 'post' then
    update public.posts set status = p_status,
           reviewed_at = case when p_status = 'published' then now() else reviewed_at end
     where id = p_id;
  elsif p_type = 'comment' then
    update public.comments set status = p_status where id = p_id;
  else
    raise exception 'invalid_target';
  end if;
  perform private.log_action('content_' || p_status, p_type, p_id, p_note);
end $$;

create or replace function public.staff_resolve_report(
  p_report uuid, p_resolution text, p_note text default null, p_content_status text default null
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reports%rowtype;
begin
  perform private.require_staff();
  if p_resolution not in ('actioned','dismissed') then raise exception 'invalid_resolution'; end if;
  select * into r from public.reports where id = p_report for update;
  if not found then raise exception 'report_not_found'; end if;

  if p_content_status is not null and r.target_type in ('post','comment') then
    perform public.staff_set_content_status(r.target_type, r.target_id, p_content_status, p_note);
  end if;

  update public.reports set status = p_resolution, resolution_note = p_note,
         resolved_by = auth.uid(), resolved_at = now() where id = p_report;

  -- A dismissed report must not leave content stuck in auto-hidden state.
  if p_resolution = 'dismissed' and p_content_status is null and r.target_type in ('post','comment')
     and not exists (select 1 from public.reports where target_type = r.target_type and target_id = r.target_id and status = 'open') then
    if r.target_type = 'post' then
      update public.posts set status = 'published' where id = r.target_id and status = 'under_review';
    else
      update public.comments set status = 'published' where id = r.target_id and status = 'under_review';
    end if;
  end if;
  perform private.log_action('report_' || p_resolution, 'report', p_report, p_note);
end $$;

-- ---------- Admin only ----------------------------------------------

create or replace function public.admin_set_account_status(
  p_user uuid, p_status text, p_reason text default null, p_until timestamptz default null
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform private.require_admin();
  if p_status not in ('active','suspended') then raise exception 'invalid_status'; end if;
  if p_user = auth.uid() then raise exception 'cannot_modify_self'; end if;
  if exists (select 1 from public.user_roles where user_id = p_user and role = 'admin') then
    raise exception 'cannot_modify_admin';
  end if;
  update public.account_status
     set status = p_status,
         reason = case when p_status = 'suspended' then p_reason else null end,
         suspended_until = case when p_status = 'suspended' then p_until else null end,
         updated_by = auth.uid(), updated_at = now()
   where user_id = p_user;
  if not found then raise exception 'user_not_found'; end if;
  perform private.log_action('account_' || p_status, 'user', p_user, p_reason);
end $$;

create or replace function public.admin_set_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform private.require_admin();
  if p_role not in ('member','moderator','admin') then raise exception 'invalid_role'; end if;
  if p_user = auth.uid() then raise exception 'cannot_modify_self'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'user_not_found'; end if;
  if p_role = 'member' then
    delete from public.user_roles where user_id = p_user;
  else
    insert into public.user_roles (user_id, role, granted_by) values (p_user, p_role, auth.uid())
      on conflict (user_id) do update set role = excluded.role, granted_by = excluded.granted_by, granted_at = now();
  end if;
  perform private.log_action('role_' || p_role, 'user', p_user, null);
end $$;

create or replace function public.admin_resolve_appeal(p_appeal uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.appeals%rowtype;
begin
  perform private.require_admin();
  if p_decision not in ('granted','denied') then raise exception 'invalid_decision'; end if;
  select * into a from public.appeals where id = p_appeal and status = 'pending' for update;
  if not found then raise exception 'appeal_not_found'; end if;
  update public.appeals set status = p_decision, admin_note = p_note, resolved_by = auth.uid(), resolved_at = now()
   where id = p_appeal;
  if p_decision = 'granted' then
    update public.account_status set status = 'active', reason = null, suspended_until = null,
           updated_by = auth.uid(), updated_at = now() where user_id = a.user_id;
  end if;
  perform private.log_action('appeal_' || p_decision, 'user', a.user_id, p_note);
end $$;

create or replace function public.admin_resolve_verification(p_request uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.verification_requests%rowtype;
begin
  perform private.require_admin();
  if p_decision not in ('approved','rejected') then raise exception 'invalid_decision'; end if;
  select * into v from public.verification_requests where id = p_request and status = 'pending' for update;
  if not found then raise exception 'request_not_found'; end if;
  update public.verification_requests set status = p_decision, reviewer_note = p_note,
         reviewed_by = auth.uid(), reviewed_at = now() where id = p_request;
  if p_decision = 'approved' then update public.profiles set verified_contributor = true where id = v.user_id; end if;
  perform private.log_action('verification_' || p_decision, 'user', v.user_id, p_note);
end $$;

-- Deliberately returns NO email, phone or message content.
create or replace function public.admin_list_users(p_search text default null, p_limit int default 50)
returns table (id uuid, username text, role text, status text, suspended_until timestamptz, reason text,
               created_at timestamptz, post_count bigint, open_reports bigint, verified boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform private.require_admin();
  return query
    select p.id, p.username, coalesce(r.role, 'member'), s.status, s.suspended_until, s.reason, p.created_at,
           (select count(*) from public.posts x where x.author_id = p.id),
           (select count(*) from public.reports x where x.reported_user_id = p.id and x.status = 'open'),
           p.verified_contributor
      from public.profiles p
      left join public.user_roles r on r.user_id = p.id
      left join public.account_status s on s.user_id = p.id
     where p_search is null or p_search = '' or p.username ilike '%' || p_search || '%'
     order by p.created_at desc
     limit least(coalesce(p_limit, 50), 200);
end $$;

-- Aggregate counts only. No private content.
create or replace function public.staff_stats() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v jsonb;
begin
  perform private.require_staff();
  select jsonb_build_object(
    'members',               (select count(*) from public.profiles),
    'new_members_7d',        (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'posts',                 (select count(*) from public.posts),
    'posts_7d',              (select count(*) from public.posts where created_at > now() - interval '7 days'),
    'comments_7d',           (select count(*) from public.comments where created_at > now() - interval '7 days'),
    'conversations',         (select count(*) from public.conversations),
    'messages_7d',           (select count(*) from public.messages where created_at > now() - interval '7 days'),
    'open_reports',          (select count(*) from public.reports where status = 'open'),
    'under_review',          (select count(*) from public.posts where status = 'under_review')
                           + (select count(*) from public.comments where status = 'under_review'),
    'sensitive_unreviewed',  (select count(*) from public.posts where sensitive and reviewed_at is null and status = 'published'),
    'suspended',             (select count(*) from public.account_status where status = 'suspended'),
    'pending_appeals',       (select count(*) from public.appeals where status = 'pending'),
    'pending_verifications', (select count(*) from public.verification_requests where status = 'pending'),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
                'day', d::date,
                'posts',    (select count(*) from public.posts    where created_at::date = d::date),
                'comments', (select count(*) from public.comments where created_at::date = d::date),
                'members',  (select count(*) from public.profiles where created_at::date = d::date)) order by d), '[]'::jsonb)
                from generate_series(current_date - 13, current_date, interval '1 day') d)
  ) into v;
  return v;
end $$;
