# AMONGHER

> **Learn from her. Share with her. Grow together.**

An anonymous-first community for women 18+: a social feed, a curated knowledge library, private messaging by consent, and a way to find women who've chosen to share similar experiences.

**Stack:** React 18 · TypeScript · Tailwind CSS · Supabase (Auth, PostgreSQL + Row Level Security, Storage, Realtime) · Vite

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

With no Supabase variables the app starts in **clearly-labelled preview mode** (banner on every screen): accounts and data live only in your browser's localStorage, no email is sent, and the first account gets admin rights *in preview only* so the dashboard can be explored. It starts empty — there are no fake members, posts or testimonials. Preview mode is not a security boundary and is never used once Supabase is configured.

## Connect Supabase (what is required for real accounts and persistence)

1. Create a project at supabase.com. Note the project URL and the **anon** key.
2. Run `supabase/migrations/0001…0004` in order (SQL editor or `supabase db push`), then `supabase/seed.sql` (taxonomy + empty collection shells; **creates no users or posts**).
3. Authentication → Email: enable, keep **Confirm email** on; set Site URL and add `/login` and `/reset` to Redirect URLs; use your own SMTP in production.
4. `cp .env.example .env.local` and fill `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. **Never** put the `service_role` key in any `VITE_*` variable.
5. Sign up in the app, then promote the first admin in the SQL editor (impossible from inside the app by design):
   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'admin' from public.profiles where username = 'your_username';
   ```

The same steps are shown in-app at `/setup`.

### Verify the connection
```bash
npm run check:supabase                                   # anonymous lock-down checks
CHECK_EMAIL=you@example.com CHECK_PASSWORD=… npm run check:supabase   # + signed-in checks
```
The second form (sign up a test member in the app and confirm her email first) exercises the sign-up trigger, seed data, post create/read/delete, search, RPCs, the private storage bucket and realtime. It uses only the public anon key and removes what it creates.

## Security model

All authorisation is enforced in PostgreSQL; the React app only hides UI.

| Concern | How it is enforced |
|---|---|
| Private data (email, phone) | Only in `auth.users`; never copied to `public`, so it cannot be returned by the API |
| Anonymous posts/comments | Raw `posts`/`comments` are readable only by their author and staff. Members read `post_feed` / `comment_feed` views that null the author fields. An anonymous poster replying in her own thread is forced anonymous |
| Roles & suspension | `user_roles` / `account_status` have **no write grant**; changes only via `admin_*` RPCs that re-check the caller's role and write an audit log |
| Column tampering | Column-level grants: members cannot change `username`, `verified_contributor`, `age_*`, post `status`, etc. |
| Private messaging | Conversations are created only by `respond_to_request()`; `messages` RLS requires participation; per-member deletion; block checks in a trigger |
| Blocks | Filtered inside every view; error messages never reveal that you were blocked |
| Helper predicates | Live in a non-exposed `private` schema so clients cannot probe block/suspension state |
| Moderation | 3 distinct reporters auto-hide content pending review; conversation reports snapshot evidence **server-side** |
| Library | DB trigger requires author consent, published status and (for sensitive posts) explicit staff approval |
| Files | One private bucket (`verification-evidence`), per-user folders, admin read via signed URLs. Avatars are generated shapes — no photos stored |

**151 assertions** exercise these rules against a real PostgreSQL (escalation attempts, anonymity leaks, blocks, message isolation, suspension, appeals, storage…):

```bash
npm run test:db      # needs PostgreSQL server binaries; spins up a throwaway cluster
npm run test:e2e     # 54 browser checks (Playwright) over two members, incl. admin flows
npm test             # typecheck + both
```
(If Chromium is already installed, point the browser tests at it with `CHROMIUM_PATH=/path/to/chrome`.) CI runs all of it on every push — see `.github/workflows/ci.yml`.

## What this app deliberately does *not* claim

- **Age is self-declared**, not verified. The DB even constrains `age_assurance` to `'self_declared'`.
- **Messages are not end-to-end encrypted.** They are protected by access rules only; the UI says so.
- **"Verified contributor"** means a person on the team reviewed a statement/file by hand — not an identity or age check.
- **Anonymous ≠ untraceable**: moderators can see the account behind a reported anonymous post. This is disclosed in the composer, onboarding and Safety centre.
- Notification settings control in-app inbox badges only; email/push delivery is not implemented.
- `/privacy` and `/terms` are **drafts** that describe what the software does; they need lawyer review and the highlighted placeholders filled in before launch.
- Helpline guidance links to findahelpline.com rather than inventing country-specific numbers.

## Project layout

```
supabase/migrations   schema → logic (triggers/RPCs) → security (views/RLS/grants) → storage → additions (edit post, message reports, data export)
e2e/run.mjs           repeatable browser test-suite
supabase/seed.sql     configuration only
supabase/tests        Postgres-backed security test-suite
src/data              Api contract + supabaseApi (real) + previewApi (labelled local emulation)
src/components        design system (ui.tsx), shell, post card, comments, safety/report
src/pages             auth, onboarding, home, explore, share, library, inbox, understand, wish, profile, settings, safety, admin
```

## Deploying the front-end
Any static host works; every route must fall back to `index.html`. Configs are included for Vercel (`vercel.json`, which also sets security headers) and Netlify (`public/_redirects`). Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the host's environment. A web-app manifest is included so the site can be installed to a phone's home screen (there is no offline mode).

## Production checklist

Own SMTP · CAPTCHA/rate limits on Auth · real age-assurance provider if legally required · moderator staffing and response SLAs · privacy policy / terms / data-retention policy · periodic review of the audit log · backups.
