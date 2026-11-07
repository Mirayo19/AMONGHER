-- =====================================================================
-- AMONGHER · 0006 · Remove arbitrary minimum lengths on what members write
--
-- Posts, message-request notes, appeals and verification statements used to
-- demand a minimum number of characters. A short lesson is still a lesson, so
-- the only floor now is "not empty or just spaces". Maximums are unchanged.
-- Safe on a live database: it only loosens CHECK constraints, no data changes.
-- =====================================================================

alter table public.posts
  drop constraint posts_title_check,
  drop constraint posts_body_check,
  add constraint posts_title_check check (char_length(btrim(title)) >= 1 and char_length(title) <= 140),
  add constraint posts_body_check  check (char_length(btrim(body))  >= 1 and char_length(body)  <= 5000);

alter table public.message_requests
  drop constraint message_requests_intro_check,
  add constraint message_requests_intro_check check (char_length(btrim(intro)) >= 1 and char_length(intro) <= 500);

alter table public.appeals
  drop constraint appeals_message_check,
  add constraint appeals_message_check check (char_length(btrim(message)) >= 1 and char_length(message) <= 1500);

alter table public.verification_requests
  drop constraint verification_requests_statement_check,
  add constraint verification_requests_statement_check check (char_length(btrim(statement)) >= 1 and char_length(statement) <= 1000);
