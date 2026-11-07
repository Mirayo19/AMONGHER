-- =====================================================================
-- AMONGHER · 0005 · Post editing, message reports, data export, review queue
-- =====================================================================

-- One definition of "sensitive wording", shared by insert and edit so they cannot drift apart.
create or replace function private.looks_sensitive(t text) returns boolean
language sql immutable as $$
  select coalesce(t, '') ~* (
    '\m(abus(e|ed|ive|er)|assault(ed)?|rape(d)?|harass(ed|ment|ing)?|stalk(ed|er|ing)?|domestic violence|'
    'self[- ]?harm|suicid(e|al)|kill myself|violen(t|ce)|threat(en|ened|ening)?|unsafe|trafficking|'
    'coerc(ed|ion|ive)|controlling partner|blackmail|revenge porn)\M');
$$;

create or replace function public.posts_before_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_cat_sensitive boolean; v_recent int;
begin
  select sensitive into v_cat_sensitive from public.categories where id = new.category_id and is_active;
  if not found then raise exception 'invalid_category'; end if;
  select count(*) into v_recent from public.posts
   where author_id = new.author_id and created_at > now() - interval '1 hour';
  if v_recent >= 20 then raise exception 'rate_limited'; end if;
  new.sensitive   := v_cat_sensitive or private.looks_sensitive(new.title || ' ' || new.body);
  new.status      := 'published';
  new.reviewed_at := null;
  return new;
end $$;

-- ---------- Edit your own post ---------------------------------------
-- Editing changes what editors approved, so a post that was reviewed or featured
-- loses that status and must be reviewed again.
create or replace function public.edit_post(p_post uuid, p_title text, p_body text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.posts%rowtype; v_cat_sensitive boolean; v_changed boolean;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not private.account_is_active(auth.uid()) then raise exception 'account_suspended'; end if;
  select * into r from public.posts where id = p_post and author_id = auth.uid() for update;
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  if r.status in ('hidden', 'removed') then raise exception 'post_locked'; end if;

  p_title := trim(p_title); p_body := trim(p_body);
  v_changed := p_title is distinct from r.title or p_body is distinct from r.body;
  if not v_changed then return; end if;

  select sensitive into v_cat_sensitive from public.categories where id = r.category_id;
  update public.posts
     set title = p_title, body = p_body,
         sensitive = coalesce(v_cat_sensitive, false) or private.looks_sensitive(p_title || ' ' || p_body),
         reviewed_at = null
   where id = p_post;                                  -- table CHECKs enforce length limits
  delete from public.collection_items where post_id = p_post;
end $$;

-- ---------- Report a single message ----------------------------------
alter table public.reports drop constraint reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('post', 'comment', 'user', 'conversation', 'message'));

create or replace function public.submit_report(
  p_type text, p_target uuid, p_reason text, p_details text default null, p_conversation uuid default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  me uuid := auth.uid(); v_reported uuid; v_evidence jsonb; v_id uuid;
  v_clear timestamptz; v_conv uuid; v_at timestamptz;
begin
  if me is null then raise exception 'not_authenticated'; end if;

  if p_type = 'post' then
    select author_id into v_reported from public.posts where id = p_target;
  elsif p_type = 'comment' then
    select author_id into v_reported from public.comments where id = p_target;
  elsif p_type = 'user' then
    select id into v_reported from public.profiles where id = p_target;
  elsif p_type = 'conversation' then
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
  elsif p_type = 'message' then
    -- The reporter must be able to see the message. Evidence = that message plus up to 5 before it.
    select m.sender_id, m.conversation_id, m.created_at, mp.cleared_at into v_reported, v_conv, v_at, v_clear
      from public.messages m
      join public.conversation_participants mp on mp.conversation_id = m.conversation_id and mp.user_id = me
     where m.id = p_target and (mp.cleared_at is null or m.created_at > mp.cleared_at);
    if v_reported is not null then
      select coalesce(jsonb_agg(jsonb_build_object('from_reporter', x.sender_id = me, 'body', x.body, 'at', x.created_at,
                                                   'reported', x.id = p_target) order by x.created_at), '[]'::jsonb)
        into v_evidence
        from (select * from public.messages where conversation_id = v_conv and created_at <= v_at
                 and (v_clear is null or created_at > v_clear) order by created_at desc limit 6) x;
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
    select id into v_id from public.reports where reporter_id = me and target_type = p_type and target_id = p_target;
  end if;
  return v_id;
end $$;

-- ---------- Accurate review queue for staff --------------------------
create or replace function public.staff_review_queue() returns setof uuid
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform private.require_staff();
  return query
    select id from public.posts
     where status = 'under_review' or (status = 'published' and sensitive and reviewed_at is null)
     order by (status = 'under_review') desc, created_at desc
     limit 100;
end $$;

-- ---------- Data portability: "download my data" ---------------------
create or replace function public.export_my_data() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  return jsonb_build_object(
    'exported_at', now(),
    'account', jsonb_build_object('id', me, 'email', (select email from auth.users where id = me)),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = me),
    'settings', (select to_jsonb(s) from public.user_settings s where s.user_id = me),
    'posts', coalesce((select jsonb_agg(to_jsonb(x) - 'fts' order by x.created_at) from public.posts x where x.author_id = me), '[]'),
    'comments', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.comments x where x.author_id = me), '[]'),
    'reactions', coalesce((select jsonb_agg(to_jsonb(x)) from public.reactions x where x.user_id = me), '[]'),
    'bookmarks', coalesce((select jsonb_agg(to_jsonb(x)) from public.bookmarks x where x.user_id = me), '[]'),
    'following', coalesce((select jsonb_agg(to_jsonb(x)) from public.follows x where x.follower_id = me), '[]'),
    'blocked_members', coalesce((select jsonb_agg(to_jsonb(x)) from public.blocks x where x.blocker_id = me), '[]'),
    'saved_collections', coalesce((select jsonb_agg(to_jsonb(x)) from public.saved_collections x where x.user_id = me), '[]'),
    'situations_shared', coalesce((select jsonb_agg(to_jsonb(x)) from public.profile_situations x where x.user_id = me), '[]'),
    'message_requests', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.message_requests x
                                   where x.requester_id = me or x.recipient_id = me), '[]'),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('conversation_id', m.conversation_id, 'from_me', m.sender_id = me,
                                                              'body', m.body, 'sent_at', m.created_at) order by m.created_at)
                            from public.messages m
                            join public.conversation_participants cp on cp.conversation_id = m.conversation_id and cp.user_id = me
                           where cp.cleared_at is null or m.created_at > cp.cleared_at), '[]'),
    'reports_filed', coalesce((select jsonb_agg(to_jsonb(x) - 'evidence' order by x.created_at) from public.reports x where x.reporter_id = me), '[]'),
    'appeals', coalesce((select jsonb_agg(to_jsonb(x)) from public.appeals x where x.user_id = me), '[]'),
    'verification_requests', coalesce((select jsonb_agg(to_jsonb(x)) from public.verification_requests x where x.user_id = me), '[]')
  );
end $$;

-- ---------- Grants ---------------------------------------------------
-- Be explicit: never rely on default privileges for who may call an RPC.
revoke execute on function
  public.edit_post(uuid, text, text), public.staff_review_queue(), public.export_my_data()
  from public, anon;
grant execute on function
  public.edit_post(uuid, text, text),
  public.staff_review_queue(),
  public.export_my_data()
  to authenticated;
