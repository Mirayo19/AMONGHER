-- AMONGHER · database security test-suite.
-- Runs the REAL migrations as different members and asserts what each can / cannot do.
-- Any failed assertion aborts with an error message naming the check.

\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

create schema t;
grant usage on schema t to anon, authenticated;
create table t.ids (k text primary key, id uuid);
create table t.results (n serial, msg text);

create function t.put(k text, v uuid) returns void language sql security definer as
  $$ insert into t.ids values (k, v) on conflict (k) do update set id = excluded.id $$;
create function t.u(k text) returns uuid language sql stable security definer as
  $$ select id from t.ids where t.ids.k = $1 $$;
create function t.ok(cond boolean, msg text) returns void language plpgsql security definer as $$
begin
  if cond is not true then raise exception 'FAILED: %', msg; end if;
  insert into t.results (msg) values (msg);
end $$;
create function t.login(who text) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', coalesce(t.u(who)::text, ''), false);
  if who = 'anon' then execute 'set role anon'; else execute 'set role authenticated'; end if;
end $$;
create function t.root() returns void language plpgsql as $$ begin reset role; end $$;
-- run q as the current role; it must fail and the message must contain `needle`
create function t.fails(q text, needle text, msg text) returns void language plpgsql as $$
declare e text;
begin
  begin execute q; e := null;
  exception when others then e := sqlerrm; end;
  if e is null then raise exception 'FAILED (no error raised): %', msg; end if;
  if e not ilike '%' || needle || '%' then raise exception 'FAILED (wrong error "%"): %', e, msg; end if;
  perform t.ok(true, msg);
end $$;
create function t.exec_id(q text, k text) returns void language plpgsql as $$
declare v uuid; begin execute q into v; perform t.put(k, v); end $$;
create function t.n(q text) returns bigint language plpgsql as $$
declare v bigint; begin execute 'select count(*) from (' || q || ') x' into v; return v; end $$;
create function t.rows(q text) returns bigint language plpgsql as $$
declare v bigint; begin execute q; get diagnostics v = row_count; return v; end $$;
grant execute on all functions in schema t to anon, authenticated;

-- ---------------------------------------------------------------------
-- Cast
-- ---------------------------------------------------------------------
do $$
declare n text; v uuid;
begin
  foreach n in array array['alice','bea','cara','dana','mod','root'] loop
    insert into auth.users (email, raw_user_meta_data)
    values (n || '@example.test', jsonb_build_object('username', n || '_x', 'age_confirmed', 'true'))
    returning id into v;
    perform t.put(n, v);
  end loop;
  insert into public.user_roles (user_id, role) values (t.u('mod'), 'moderator'), (t.u('root'), 'admin');
end $$;

-- ===================================================================
-- 1 · Sign-up guards
-- ===================================================================
select t.fails($$insert into auth.users (email, raw_user_meta_data) values ('z@e.test', '{"username":"zed_x"}')$$,
  'age_confirmation_required', 'sign-up without 18+ confirmation is rejected');
select t.fails($$insert into auth.users (email, raw_user_meta_data) values ('z@e.test', '{"username":"admin","age_confirmed":"true"}')$$,
  'username_unavailable', 'reserved username is rejected');
select t.fails($$insert into auth.users (email, raw_user_meta_data) values ('z@e.test', '{"username":"ALICE_X","age_confirmed":"true"}')$$,
  'username_unavailable', 'duplicate username is rejected case-insensitively');
select t.fails($$update public.user_settings set age_assurance = 'verified'$$, 'check', 'age_assurance can never be set to a verified value');
select t.ok((select count(*) from public.user_settings where age_assurance = 'self_declared') = 6, 'every member is recorded as self-declared, not verified');
select t.ok((select count(*) from information_schema.columns where table_schema = 'public'
              and column_name in ('email','phone','password','real_name')) = 0, 'no public table has an email/phone/real-name column');

select t.login('anon');
select t.fails($$select * from public.profiles$$, 'permission denied', 'anon cannot read profiles');
select t.fails($$select * from public.post_feed$$, 'permission denied', 'anon cannot read the feed');
select t.fails($$select public.list_my_conversations()$$, 'permission denied', 'anon cannot call messaging RPCs');
select t.ok(public.username_available('fresh_name') and not public.username_available('moderator'), 'anon can only check username availability');

-- ===================================================================
-- 2 · Privilege escalation
-- ===================================================================
select t.login('alice');
select t.fails($$insert into public.user_roles values (t.u('alice'), 'admin')$$, 'permission denied', 'member cannot grant herself a role');
select t.fails($$update public.profiles set verified_contributor = true where id = t.u('alice')$$, 'permission denied', 'member cannot self-verify');
select t.fails($$update public.profiles set username = 'renamed' where id = t.u('alice')$$, 'permission denied', 'username is immutable from the client');
select t.fails($$update public.account_status set status = 'active'$$, 'permission denied', 'member cannot edit account status');
select t.fails($$update public.user_settings set age_confirmed_at = now() - interval '30 years'$$, 'permission denied', 'age confirmation record is immutable from the client');
select t.fails($$select public.admin_set_role(t.u('alice'), 'admin')$$, 'forbidden', 'member cannot call admin_set_role');
select t.fails($$select public.staff_stats()$$, 'forbidden', 'member cannot read staff stats');
select t.fails($$select * from public.admin_list_users()$$, 'forbidden', 'member cannot list users');
select t.fails($$select public.staff_set_content_status('post', gen_random_uuid(), 'removed')$$, 'forbidden', 'member cannot moderate');
select t.fails($$insert into public.categories (slug, name) values ('zzz','Zzz')$$, 'row-level security', 'member cannot edit categories');
select t.login('mod');
select t.fails($$select public.admin_set_account_status(t.u('alice'), 'suspended', 'x')$$, 'forbidden', 'moderator cannot suspend (admin only)');
select t.fails($$select public.admin_set_role(t.u('alice'), 'moderator')$$, 'forbidden', 'moderator cannot change roles');
select t.ok(public.staff_stats() ? 'open_reports', 'moderator can read staff stats');
select t.fails($$insert into public.collections (slug, title) values ('mod-made','Moderator made')$$, 'row-level security', 'moderator cannot create collections');

-- ===================================================================
-- 3 · Private profile data
-- ===================================================================
select t.login('alice');
update public.profiles set bio = 'Quiet bio', location = 'Lisbon', visibility = 'private' where id = t.u('alice');
update public.user_settings set discoverable_note = 'private note';
select t.login('bea');
select t.ok((select count(*) from public.user_settings) = 1, 'member sees only her own settings row');
select t.ok((select count(*) from public.profiles) = 1, 'member cannot read other raw profiles');
select t.ok((select count(*) from public.user_roles) = 0 and (select count(*) from public.account_status) = 1,
            'member cannot read others'' roles or account status');
select t.ok((select bio is null and location is null and interests = '{}' from public.public_profiles where id = t.u('alice')),
            'a private profile hides bio / location / interests from other members');
select t.login('alice');
select t.ok((select bio = 'Quiet bio' from public.public_profiles where id = t.u('alice')), 'owner still sees her own bio');
update public.profiles set visibility = 'members' where id = t.u('alice');
select t.login('bea');
select t.ok((select bio = 'Quiet bio' from public.public_profiles where id = t.u('alice')), 'members-visible profile shows bio');

-- ===================================================================
-- 4 · Posts, anonymity, comments, reactions
-- ===================================================================
select t.login('alice');
select t.exec_id($$insert into public.posts (author_id, kind, category_id, title, body, is_anonymous, allow_curation)
  values (auth.uid(), 'question', (select id from public.categories where slug='womens-health'),
          'Anonymous health question', 'Has anyone dealt with this before? Looking for gentle advice.', true, true) returning id$$, 'P1');
select t.exec_id($$insert into public.posts (author_id, kind, category_id, title, body)
  values (auth.uid(), 'experience', (select id from public.categories where slug='lifestyle'),
          'Moving cities alone', 'I stalked every rental listing for a month and learned a lot about contracts.') returning id$$, 'P2');
select t.exec_id($$insert into public.posts (author_id, kind, category_id, wish_topic, title, body, allow_curation)
  values (auth.uid(), 'wish', (select id from public.categories where slug='finance'), 'money',
          'Start the pension early', 'I wish I had understood compound interest in my twenties.', true) returning id$$, 'P3');
select t.ok((select sensitive from public.post_feed where id = t.u('P1')), 'health category posts are flagged sensitive');
select t.ok((select sensitive from public.post_feed where id = t.u('P2')), 'keyword detection flags a lifestyle post as sensitive (stalk*)');
select t.ok((select not sensitive from public.post_feed where id = t.u('P3')), 'ordinary post is not flagged');
select t.fails($$insert into public.posts (author_id, kind, category_id, title, body, status)
  values (auth.uid(), 'experience', (select id from public.categories where slug='career'), 'Forced status', 'Trying to set status directly', 'removed')$$,
  'permission denied', 'client cannot choose a post status');
select t.fails($$insert into public.posts (author_id, kind, category_id, title, body)
  values (t.u('bea'), 'experience', (select id from public.categories where slug='career'), 'Impersonation', 'Posting as somebody else here')$$,
  'row-level security', 'cannot post as another member');
select t.ok((select author_id = t.u('alice') and author_username = 'alice_x' from public.post_feed where id = t.u('P1')), 'author can see her own anonymous post attribution');

select t.login('bea');
select t.ok((select allow_curation is null from public.post_feed where id = t.u('P3')), 'other members cannot see curation flags');
select t.ok((select author_id is null and author_username is null and author_avatar_motif is null and is_anonymous
               from public.post_feed where id = t.u('P1')), 'ANONYMITY: other members see no author fields on an anonymous post');
select t.ok((select count(*) from public.posts) = 0, 'ANONYMITY: raw posts table (with author_id) is not readable by other members');
select t.ok((select author_username = 'alice_x' from public.post_feed where id = t.u('P3')), 'named post shows its author');
select t.ok(t.rows($$delete from public.posts where id = t.u('P3')$$) = 0, 'member cannot delete another member''s post');
select t.login('mod');
select t.ok((select author_username = 'alice_x' from public.post_feed where id = t.u('P1')), 'moderators can resolve anonymous authors (needed for safety enforcement)');

-- comments
select t.login('bea');
select t.exec_id($$insert into public.comments (post_id, author_id, body) values (t.u('P1'), auth.uid(), 'Here is what helped me.') returning id$$, 'C1');
select t.exec_id($$insert into public.comments (post_id, parent_id, author_id, body) values (t.u('P1'), t.u('C1'), auth.uid(), 'Following up on that.') returning id$$, 'C1b');
select t.fails($$insert into public.comments (post_id, parent_id, author_id, body) values (t.u('P1'), t.u('C1b'), auth.uid(), 'too deep')$$, 'invalid_parent', 'threads are limited to one reply level');
select t.fails($$insert into public.comments (post_id, parent_id, author_id, body) values (t.u('P2'), t.u('C1'), auth.uid(), 'cross-post parent')$$, 'invalid_parent', 'a reply cannot cross posts');
select t.login('alice');
select t.exec_id($$insert into public.comments (post_id, parent_id, author_id, body, is_anonymous) values (t.u('P1'), t.u('C1'), auth.uid(), 'Thank you! (OP)', false) returning id$$, 'C2');
select t.login('bea');
select t.ok((select is_anonymous and is_op and author_username is null from public.comment_feed where id = t.u('C2')),
            'ANONYMITY: an anonymous poster replying in her own thread is forced anonymous and labelled OP');
select t.fails($$select public.mark_comment_helpful(t.u('C1'), true)$$, 'forbidden', 'only the asker can mark an answer helpful (not the answerer)');
select t.login('alice');
select public.mark_comment_helpful(t.u('C1'), true);
select t.fails($$select public.mark_comment_helpful(t.u('C2'), true)$$, 'forbidden', 'asker cannot mark her own reply helpful');
select t.login('cara');
select t.ok((select is_helpful from public.comment_feed where id = t.u('C1')), 'helpful mark is visible to everyone');
select t.fails($$select public.mark_comment_helpful(t.u('C1'), false)$$, 'forbidden', 'a third party cannot unmark');

-- reactions & bookmarks
select t.login('cara');
insert into public.reactions (user_id, post_id, type) values (auth.uid(), t.u('P3'), 'felt_this');
insert into public.reactions (user_id, post_id, type) values (auth.uid(), t.u('P3'), 'helpful') on conflict (user_id, post_id) do update set type = excluded.type;
select t.ok((select helpful_count = 1 and felt_count = 0 and my_reaction = 'helpful' from public.post_feed where id = t.u('P3')), 'one reaction per member per post (switching replaces)');
select t.fails($$insert into public.reactions (user_id, post_id, type) values (t.u('bea'), t.u('P3'), 'helpful')$$, 'row-level security', 'cannot react as someone else');
insert into public.bookmarks (user_id, post_id) values (auth.uid(), t.u('P3'));
select t.login('bea');
select t.ok((select not bookmarked from public.post_feed where id = t.u('P3')) and (select count(*) from public.bookmarks) = 0, 'bookmarks are private to their owner');

-- ===================================================================
-- 5 · Blocks
-- ===================================================================
select t.login('cara');
select t.exec_id($$insert into public.posts (author_id, kind, category_id, title, body)
  values (auth.uid(), 'experience', (select id from public.categories where slug='career'), 'Cara''s career note', 'A calm note about negotiating a salary.') returning id$$, 'P4');
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), t.u('bea'));
select t.login('bea');
select t.ok((select count(*) from public.post_feed where id = t.u('P4')) = 0, 'blocked member cannot see the blocker''s posts');
select t.ok((select count(*) from public.public_profiles where id = t.u('cara')) = 0, 'blocked member cannot see the blocker''s profile');
select t.fails($$insert into public.comments (post_id, author_id, body) values (t.u('P4'), auth.uid(), 'hello')$$, 'post_unavailable', 'blocked member cannot comment on the blocker''s post');
select t.fails($$select public.send_message_request(t.u('cara'), 'Hi, may I ask you something?')$$, 'not_accepting', 'blocked member cannot send a request — and the error does not reveal the block');
select t.login('cara');
select t.ok((select count(*) from public.public_profiles where id = t.u('bea')) = 0, 'blocker no longer sees the blocked member either');
delete from public.blocks where blocker_id = auth.uid();   -- unblock for the rest of the suite

-- ===================================================================
-- 6 · Private messaging
-- ===================================================================
select t.login('alice');
select t.exec_id($$select public.send_message_request(t.u('cara'), 'Hi, I read your note and would love to chat.')$$, 'R1');
select t.fails($$select public.send_message_request(t.u('cara'), 'Hi again')$$, 'request_pending', 'duplicate pending request is refused');
select t.fails($$select public.send_message_request(auth.uid(), 'Hi me')$$, 'invalid_recipient', 'cannot message yourself');
select t.login('bea');
select t.ok((select count(*) from public.message_requests) = 0 and (select count(*) from public.list_message_requests('incoming')) = 0, 'a third party cannot see someone else''s request');
select t.login('cara');
select t.ok((select count(*) from public.list_message_requests('incoming')) = 1, 'recipient sees the request');
select t.ok((public.inbox_badge() ->> 'requests')::int = 1, 'badge counts pending requests');
select t.login('bea');
select t.fails($$select public.respond_to_request(t.u('R1'), true)$$, 'request_not_found', 'only the recipient can accept');
select t.login('cara');
select t.exec_id($$select public.respond_to_request(t.u('R1'), true)$$, 'CONV');
select t.login('alice');
insert into public.messages (conversation_id, sender_id, body) values (t.u('CONV'), auth.uid(), 'Hello Cara');
select t.fails($$insert into public.messages (conversation_id, sender_id, body) values (t.u('CONV'), t.u('cara'), 'forged')$$, 'row-level security', 'cannot send a message as the other participant');
select t.login('cara');
insert into public.messages (conversation_id, sender_id, body) values (t.u('CONV'), auth.uid(), 'Hi Alice!');
select t.ok((select unread = 0 and last_body = 'Hi Alice!' from public.list_my_conversations()), 'conversation list shows last message');
select t.login('bea');
select t.ok((select count(*) from public.messages) = 0 and (select count(*) from public.conversations) = 0 and (select count(*) from public.conversation_participants) = 0,
            'PRIVACY: an outsider can read no messages, conversations or participants');
select t.fails($$insert into public.messages (conversation_id, sender_id, body) values (t.u('CONV'), auth.uid(), 'sneaking in')$$, 'row-level security', 'outsider cannot post into a conversation');
select t.login('alice');
select t.ok((select unread = 1 from public.list_my_conversations()), 'unread counter works');
update public.conversation_participants set muted = true where conversation_id = t.u('CONV') and user_id = auth.uid();
select t.ok((public.inbox_badge() ->> 'messages')::int = 0, 'muting a conversation silences its badge');
select t.fails($$update public.conversation_participants set user_id = t.u('bea') where conversation_id = t.u('CONV')$$, 'permission denied', 'cannot re-point a participant row');

-- delete conversation = per-member
select t.login('cara');
select public.delete_conversation(t.u('CONV'));
select t.ok((select count(*) from public.list_my_conversations()) = 0 and (select count(*) from public.messages) = 0, 'deleted conversation vanishes for the deleter');
select t.login('alice');
select t.ok((select count(*) from public.messages) = 2, 'deleting is per-member: the other party keeps her copy');
insert into public.messages (conversation_id, sender_id, body) values (t.u('CONV'), auth.uid(), 'Are you still there?');
select t.login('cara');
select t.ok((select count(*) from public.messages) = 1 and (select count(*) from public.list_my_conversations()) = 1,
            'a new message resurfaces the thread but older history stays deleted');

-- block mid-conversation
select t.login('alice');
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), t.u('cara'));
select t.fails($$insert into public.messages (conversation_id, sender_id, body) values (t.u('CONV'), auth.uid(), 'x')$$, 'conversation_unavailable', 'blocker cannot message');
select t.login('cara');
select t.fails($$insert into public.messages (conversation_id, sender_id, body) values (t.u('CONV'), auth.uid(), 'x')$$, 'conversation_unavailable', 'blocked member cannot message');
select t.ok((select blocked from public.list_my_conversations()) is not null, 'conversation list flags blocked state');

-- report conversation: evidence is captured server-side
select t.exec_id($$select public.submit_report('conversation', t.u('CONV'), 'harassment', 'unwanted messages')$$, 'REP_CONV');
select t.ok(public.submit_report('conversation', t.u('CONV'), 'harassment', 'again') = t.u('REP_CONV'), 'reporting is idempotent per reporter+target');
select t.root();
select t.ok((select jsonb_array_length(evidence) = 1 and reported_user_id = t.u('alice') from public.reports where id = t.u('REP_CONV')), 'conversation report snapshots only what the reporter could see (post-deletion history excluded)');
select t.login('alice');
delete from public.blocks where blocker_id = auth.uid();
select t.ok((select count(*) from public.reports) = 0, 'reported member cannot see reports about her');
select t.login('bea');
select t.fails($$select public.submit_report('conversation', t.u('CONV'), 'spam')$$, 'target_not_found', 'cannot report (or snapshot) a conversation you are not in');

-- permission settings
select t.login('dana');
update public.user_settings set dm_permission = 'nobody';
select t.login('alice');
select t.fails($$select public.send_message_request(t.u('dana'), 'Hello Dana, may I ask?')$$, 'not_accepting', 'dm_permission=nobody blocks requests');

-- decline then cooldown
select t.login('bea');
select t.exec_id($$select public.send_message_request(t.u('alice'), 'Hello Alice, can we talk?')$$, 'R2');
select t.login('alice');
select public.respond_to_request(t.u('R2'), false);
select t.login('bea');
select t.fails($$select public.send_message_request(t.u('alice'), 'Please reconsider?')$$, 'recently_declined', 'declined requester is in a 30-day cooldown');
select t.ok((select status = 'declined' from public.message_requests where id = t.u('R2')), 'requester sees outcome (declined)');

-- ===================================================================
-- 7 · Reporting, auto-hide, moderation
-- ===================================================================
select t.login('alice');
select t.fails($$select public.submit_report('post', t.u('P2'), 'spam')$$, 'cannot_report_self', 'cannot report yourself');
select t.login('bea');   select public.submit_report('post', t.u('P3'), 'misinformation', 'doubtful');
select t.login('cara');  select public.submit_report('post', t.u('P3'), 'misinformation');
select t.ok((select status = 'published' from public.post_feed where id = t.u('P3')), 'two reports do not hide a post');
select t.login('dana');  select public.submit_report('post', t.u('P3'), 'spam');
select t.login('bea');
select t.ok((select count(*) from public.post_feed where id = t.u('P3')) = 0, 'three independent reports auto-hide a post from other members');
select t.login('alice');
select t.ok((select status = 'under_review' from public.post_feed where id = t.u('P3')), 'the author still sees it (as under review)');
select t.login('bea');
select t.ok((select count(*) from public.reports) = 1, 'a reporter only sees her own reports');
select t.login('mod');
select t.ok((select count(*) from public.reports where target_id = t.u('P3')) = 3, 'moderators see all reports');
select public.staff_resolve_report(id, 'dismissed', 'looks fine') from public.reports where target_id = t.u('P3');
select t.ok((select status = 'published' from public.post_feed where id = t.u('P3')), 'dismissing all reports restores auto-hidden content');
select t.exec_id($$select id from public.reports where target_id = t.u('P3') limit 1$$, 'ANYREP');
select t.ok((select count(*) from public.moderation_log) >= 3, 'moderator actions are written to the audit log');
select public.staff_set_content_status('post', t.u('P2'), 'hidden', 'testing');
select t.login('bea');
select t.ok((select count(*) from public.post_feed where id = t.u('P2')) = 0, 'hidden post disappears for members');
select t.ok((select count(*) from public.moderation_log) = 0, 'members cannot read the audit log');

-- ===================================================================
-- 8 · Suspension + appeals
-- ===================================================================
select t.login('root');
select t.fails($$select public.admin_set_account_status(auth.uid(), 'suspended', 'x')$$, 'cannot_modify_self', 'admin cannot suspend herself');
select t.fails($$select public.admin_set_account_status(t.u('root'), 'suspended', 'x')$$, 'cannot_modify_self', 'admin cannot suspend an admin (self)');
select public.admin_set_account_status(t.u('dana'), 'suspended', 'Abusive replies', null);
select t.login('dana');
select t.ok((select count(*) from public.post_feed) = 0 and (select count(*) from public.public_profiles) = 0, 'suspended member cannot read community content');
select t.fails($$insert into public.posts (author_id, kind, category_id, title, body)
  values (auth.uid(), 'experience', (select id from public.categories where slug='career'), 'Still posting', 'A suspended member should not be able to post.')$$,
  'row-level security', 'suspended member cannot post');
select t.fails($$select public.send_message_request(t.u('alice'), 'Hello Alice')$$, 'account_suspended', 'suspended member cannot message');
select t.ok((select status = 'suspended' and reason = 'Abusive replies' from public.account_status where user_id = auth.uid()), 'suspended member can read her own status + reason');
select t.exec_id($$insert into public.appeals (user_id, message) values (auth.uid(), 'I believe this was a misunderstanding, please review.') returning id$$, 'AP1');
select t.login('alice');
select t.fails($$insert into public.appeals (user_id, message) values (auth.uid(), 'Active members have nothing to appeal.')$$, 'row-level security', 'only suspended members can appeal');
select t.ok((select count(*) from public.appeals) = 0, 'appeals are private');
select t.login('mod');
select t.ok((select count(*) from public.appeals) = 0, 'moderators cannot read appeals (admin only)');
select t.login('root');
select t.ok((select count(*) from public.appeals) = 1, 'admin sees the appeal');
select public.admin_resolve_appeal(t.u('AP1'), 'granted', 'Reviewed — reinstated');
select t.login('dana');
select t.ok((select status = 'active' from public.account_status where user_id = auth.uid()), 'granted appeal reinstates the account');
select t.root();
-- time-boxed suspension expires on its own
select t.login('root');
select public.admin_set_account_status(t.u('dana'), 'suspended', 'cooling off', now() - interval '1 minute');
select t.login('dana');
select t.ok((select count(*) from public.post_feed) > 0, 'an expired suspension no longer blocks access');

-- ===================================================================
-- 9 · Library editorial gate
-- ===================================================================
select t.login('root');
select t.exec_id($$insert into public.collections (slug, title, status) values ('test-draft','Draft collection for tests','draft') returning id$$, 'COLL_D');
select t.exec_id($$select id from public.collections where slug = 'things-i-wish-i-knew-before-motherhood'$$, 'COLL_P');
select public.staff_set_content_status('post', t.u('P2'), 'published', 'restore after earlier test');
select t.fails($$insert into public.collection_items (collection_id, post_id) values (t.u('COLL_P'), t.u('P2'))$$, 'author_has_not_consented', 'cannot curate a post whose author has not consented');
select t.fails($$insert into public.collection_items (collection_id, post_id) values (t.u('COLL_P'), t.u('P1'))$$, 'sensitive_post_needs_review', 'sensitive posts need explicit staff review before curation');
select public.staff_set_content_status('post', t.u('P1'), 'published', 'reviewed and approved');
insert into public.collection_items (collection_id, post_id, item_type, key_takeaway) values (t.u('COLL_P'), t.u('P1'), 'insight', 'Ask early, ask kindly.');
insert into public.collection_items (collection_id, post_id, item_type) values (t.u('COLL_P'), t.u('P3'), 'lesson');
select t.ok((select reviewed_by = t.u('root') from public.collection_items where post_id = t.u('P1')), 'curated entry records the reviewing editor server-side');
select t.fails($$insert into public.collection_items (collection_id, post_id, reviewed_by) values (t.u('COLL_P'), t.u('P3'), t.u('mod'))$$, 'permission denied', 'reviewed_by cannot be set from the client');
select t.login('mod');
select t.fails($$insert into public.collection_items (collection_id, post_id) values (t.u('COLL_P'), t.u('P3'))$$, 'row-level security', 'moderators cannot curate (admin only)');
select t.ok((select allow_curation from public.post_feed where id = t.u('P3')), 'staff can see which posts have curation consent');
select t.login('bea');
select t.ok((select count(*) from public.library_entries where collection_id = t.u('COLL_P')) = 2, 'members see curated entries');
select t.ok((select count(*) from public.collection_overview where id = t.u('COLL_D')) = 0, 'draft collections are invisible to members');
select t.ok((select count(*) from public.collection_overview where slug = 'moving-abroad') = 1, 'published collections are visible');
select t.ok((select count(*) from public.collection_items) = 0, 'members cannot read raw collection_items');
select t.login('cara');
insert into public.saved_collections (user_id, collection_id) values (auth.uid(), t.u('COLL_P'));
select t.ok((select saved_by_me from public.collection_overview where id = t.u('COLL_P')), 'saving a collection is per-member');
select t.login('alice');
select public.set_post_curation_consent(t.u('P3'), false);
select t.login('bea');
select t.ok((select count(*) from public.library_entries where collection_id = t.u('COLL_P')) = 1, 'author withdrawing consent removes the entry');
select t.login('alice');
delete from public.posts where id = t.u('P1');
select t.login('bea');
select t.ok((select count(*) from public.library_entries where collection_id = t.u('COLL_P')) = 0, 'deleting a post removes it from the library');

-- ===================================================================
-- 10 · Find someone who understands
-- ===================================================================
select t.login('root');
select t.exec_id($$select id from public.situations where slug = 'relocating-abroad'$$, 'SIT');
select t.login('cara');
insert into public.profile_situations values (auth.uid(), t.u('SIT'));
select t.login('bea');
select t.ok((select count(*) from public.find_understanders(t.u('SIT'))) = 0, 'members who have not opted in are never discoverable');
select t.login('cara');
update public.user_settings set discoverable = true, discoverable_note = 'Moved to Berlin in 2023 — happy to share what I learned.';
select t.login('bea');
select t.ok((select count(*) = 1 and bool_and(username = 'cara_x') from public.find_understanders(t.u('SIT'))), 'opted-in members appear');
select t.ok(not exists (select 1 from pg_proc p, unnest(p.proargnames) a where p.proname = 'find_understanders' and a ~* 'email|phone|location'), 'discovery exposes no email, phone or location');
select t.login('cara');
update public.user_settings set dm_permission = 'nobody';
select t.login('bea');
select t.ok((select count(*) from public.find_understanders(t.u('SIT'))) = 0, 'members not accepting messages are not listed');
select t.login('cara');
update public.user_settings set dm_permission = 'everyone';
insert into public.blocks values (auth.uid(), t.u('bea'));
select t.login('bea');
select t.ok((select count(*) from public.find_understanders(t.u('SIT'))) = 0, 'blocked members are not listed');
select t.login('cara');
delete from public.blocks;
select t.login('alice');
select t.ok((select count(*) from public.profile_situations) = 0, 'situation choices are private to their owner');

-- ===================================================================
-- 11 · Verification + secure storage
-- ===================================================================
select t.login('alice');
select t.fails($$insert into public.verification_requests (user_id, statement, evidence_path) values (auth.uid(), 'I am a registered midwife of ten years.', concat(t.u('bea'), '/licence.pdf'))$$,
  'row-level security', 'evidence path must sit in the requester''s own folder');
select t.exec_id($$insert into public.verification_requests (user_id, statement, evidence_path) values (auth.uid(), 'I am a registered midwife of ten years.', concat(auth.uid(), '/licence.pdf')) returning id$$, 'VR1');
insert into storage.objects (bucket_id, name, owner) values ('verification-evidence', concat(t.u('alice'), '/licence.pdf'), t.u('alice'));
select t.fails($$insert into storage.objects (bucket_id, name, owner) values ('verification-evidence', concat(t.u('bea'), '/x.pdf'), auth.uid())$$,
  'row-level security', 'cannot upload into another member''s folder');
select t.login('bea');
select t.ok((select count(*) from public.verification_requests) = 0 and (select count(*) from storage.objects) = 0, 'other members cannot see verification requests or evidence files');
select t.login('mod');
select t.ok((select count(*) from storage.objects) = 0, 'moderators cannot open evidence (admin only)');
select t.login('root');
select t.ok((select count(*) from storage.objects) = 1, 'admin can open evidence');
select public.admin_resolve_verification(t.u('VR1'), 'approved', 'Reviewed supplied document by hand');
select t.login('bea');
select t.ok((select verified_contributor from public.public_profiles where id = t.u('alice')), 'approval sets the badge');
select t.root();
select t.ok((select not public from storage.buckets where id = 'verification-evidence'), 'evidence bucket is private');

-- ===================================================================
-- 11b · Edit posts, message reports, review queue, data export  (migration 0005)
-- ===================================================================
select t.login('alice');
select t.exec_id($$insert into public.posts (author_id, kind, category_id, title, body, allow_curation)
  values (auth.uid(), 'experience', (select id from public.categories where slug='career'), 'Asking for a raise', 'I prepared three examples of my impact and it went well.', true) returning id$$, 'P5');
select t.login('root');
insert into public.collection_items (collection_id, post_id, item_type) values (t.u('COLL_P'), t.u('P5'), 'advice');
select t.login('bea');
select t.ok((select count(*) from public.library_entries where id = t.u('P5')) = 1, 'P5 is featured before editing');
select t.fails($$select public.edit_post(t.u('P5'), 'Hijacked title here', 'Someone else rewriting this post body.')$$, 'forbidden', 'only the author can edit a post');
select t.login('alice');
select public.edit_post(t.u('P5'), 'Asking for a raise (updated)', 'I prepared three examples of my impact. Looking back, a stalked-out calendar of wins helped most.');
select t.ok((select title = 'Asking for a raise (updated)' and sensitive from public.post_feed where id = t.u('P5')), 'editing re-runs sensitivity detection');
select t.fails($$select public.edit_post(t.u('P5'), '   ', 'a blank title must still be rejected')$$, 'check', 'edit still refuses a blank title');
select t.login('bea');
select t.ok((select count(*) from public.library_entries where id = t.u('P5')) = 0, 'editing a featured post removes it from the Library until re-reviewed');
select t.login('alice');
select t.ok((select reviewed_at is null from public.posts where id = t.u('P5')), 'editing clears the editorial review stamp');

select t.login('mod');
select t.ok((select count(*) from public.staff_review_queue() q where q = t.u('P5')) = 1, 'edited sensitive post appears in the staff review queue');
select t.login('bea');
select t.fails($$select * from public.staff_review_queue()$$, 'forbidden', 'members cannot read the review queue');

-- no minimum length: a short lesson is still a lesson
select t.exec_id($$insert into public.posts (author_id, kind, category_id, title, body)
  values (auth.uid(), 'experience', (select id from public.categories where slug='lifestyle'), 'Hi', 'Ok') returning id$$, 'P_SHORT');
select t.ok((select title = 'Hi' and body = 'Ok' from public.post_feed where id = t.u('P_SHORT')), 'a 2-letter title and 2-letter body can be posted');
select t.fails($$insert into public.posts (author_id, kind, category_id, title, body)
  values (auth.uid(), 'experience', (select id from public.categories where slug='lifestyle'), '   ', 'text')$$, 'check', 'a blank (spaces-only) title is still refused');
select t.fails($$insert into public.posts (author_id, kind, category_id, title, body)
  values (auth.uid(), 'experience', (select id from public.categories where slug='lifestyle'), 'Title', '   ')$$, 'check', 'a blank (spaces-only) body is still refused');
select t.fails($$insert into public.posts (author_id, kind, category_id, title, body)
  values (auth.uid(), 'experience', (select id from public.categories where slug='lifestyle'), repeat('x', 141), 'text')$$, 'check', 'maximum title length still enforced');
select t.ok(public.send_message_request(t.u('mod'), 'hi') is not null, 'a short message-request note (2 letters) is accepted');
insert into public.verification_requests (user_id, statement) values (auth.uid(), 'ok');
select t.ok(true, 'a short verification statement is accepted (staff can still reject it)');

-- report one message
select t.login('alice');
select t.exec_id($$select id from public.messages where conversation_id = t.u('CONV') and sender_id = t.u('cara') order by created_at limit 1$$, 'MSG_C');
select t.exec_id($$select id from public.messages where conversation_id = t.u('CONV') and sender_id = t.u('alice') order by created_at desc limit 1$$, 'MSG_A');
select t.exec_id($$select public.submit_report('message', t.u('MSG_C'), 'harassment', 'this one')$$, 'REP_MSG');
select t.fails($$select public.submit_report('message', t.u('MSG_A'), 'spam')$$, 'cannot_report_self', 'cannot report your own message');
select t.login('bea');
select t.fails($$select public.submit_report('message', t.u('MSG_C'), 'spam')$$, 'target_not_found', 'cannot report a message from a conversation you are not in');
select t.root();
select t.ok((select target_type = 'message' and reported_user_id = t.u('cara') and (evidence -> -1 ->> 'reported')::boolean from public.reports where id = t.u('REP_MSG')), 'message report records the sender and flags the reported message in the evidence');

-- data export
select t.login('alice');
select t.ok((select (public.export_my_data() ->> 'account') like '%alice@example.test%'), 'export includes the member''s own email');
select t.ok(public.export_my_data()::text not like '%bea@example.test%' and public.export_my_data()::text not like '%cara@example.test%', 'export never contains other members'' emails');
select t.ok(jsonb_array_length(public.export_my_data() -> 'posts') >= 2 and jsonb_array_length(public.export_my_data() -> 'messages') >= 2, 'export includes her posts and her side of conversations');
select t.ok(not (public.export_my_data() -> 'posts' -> 0 ? 'fts'), 'export omits the internal search vector');
select t.login('anon');
select t.fails($$select public.export_my_data()$$, 'permission denied', 'anonymous visitors cannot export');

select t.root();
select t.ok((select coalesce(string_agg(p.proname, ', '), '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')) = 'username_available',
            'GUARD: the only public function anonymous visitors can execute is username_available');

-- ===================================================================
-- 12 · Account deletion
-- ===================================================================
select t.login('bea');
select public.delete_my_account();
select t.root();
select t.ok(not exists (select 1 from public.profiles where id = t.u('bea')) and not exists (select 1 from auth.users where id = t.u('bea')),
            'deleting an account removes the profile and auth record');
select t.ok(not exists (select 1 from public.comments where author_id = t.u('bea')), 'and her comments');
select t.login('cara');
select public.delete_my_account();
select t.root();
select t.ok((select count(*) from public.messages where conversation_id = t.u('CONV') and sender_id is null) >= 1
        and (select count(*) from public.messages where conversation_id = t.u('CONV') and sender_id = t.u('alice')) >= 1,
        'deleting one participant keeps the other''s messages and nulls the deleted sender');

-- ===================================================================
select format('✔ ALL %s SECURITY CHECKS PASSED', count(*)) from t.results;
