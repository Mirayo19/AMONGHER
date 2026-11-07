// Verifies a real Supabase project against what AMONGHER expects.
//   npm run check:supabase
// Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env.local (or the environment).
// Optional second phase — sign up a test member in the app first, confirm her email, then:
//   CHECK_EMAIL=you@example.com CHECK_PASSWORD=… npm run check:supabase
// It only ever uses the PUBLIC anon key. It cleans up after itself (one temporary post, one temporary file).
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const env = { ...process.env };
  for (const f of ['.env.local', '.env']) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  return env;
}
const env = loadEnv();
const url = env.VITE_SUPABASE_URL; const anon = env.VITE_SUPABASE_ANON_KEY;
const results = []; const t0 = Date.now();

async function check(name, fn, hint) {
  try { const detail = await fn(); results.push({ name, ok: true }); console.log(`  ✔ ${name}${detail ? ` — ${detail}` : ''}`); }
  catch (e) { results.push({ name, ok: false }); console.log(`  ✘ ${name}\n      ${String(e.message ?? e).split('\n')[0]}${hint ? `\n      → ${hint}` : ''}`); }
}
const must = (cond, msg) => { if (!cond) throw new Error(msg); };
const denied = (error) => !!error && /permission denied|not found|PGRST202|PGRST205|42501|42883|401|404|JWT|row-level security/i.test(`${error.code} ${error.message}`);

if (!url || !anon || url.includes('YOUR-PROJECT')) {
  console.error('✘ VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set (create .env.local from .env.example).');
  process.exit(2);
}
if (/service_role/i.test(anon) || (() => { try { return JSON.parse(Buffer.from(anon.split('.')[1], 'base64').toString()).role === 'service_role'; } catch { return false; } })()) {
  console.error('✘ STOP: that looks like the service_role key. Never put it in .env.local or anywhere in the app. Use the anon (public) key.');
  process.exit(2);
}

const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
console.log(`\nChecking ${new URL(url).host}\n\nAnonymous visitor (nobody signed in)`);

// Fail fast: if the project can't even be reached, every later result would be noise.
try {
  const r = await fetch(`${url}/rest/v1/`, { headers: { apikey: anon } });
  if (r.status === 401 || r.status === 403) { console.log(`  ✘ the API rejected the key (HTTP ${r.status})\n      → Copy the "anon public" key from Supabase → Project Settings → API.`); process.exit(1); }
} catch (e) {
  console.log(`  ✘ cannot reach ${url} (${e.cause?.code ?? e.message})\n      → Check VITE_SUPABASE_URL (it looks like https://<project-ref>.supabase.co) and your internet connection / that the project is not paused.`);
  process.exit(1);
}

await check('project is reachable and migrations 0002/0003 are applied', async () => {
  const { data, error } = await sb.rpc('username_available', { p_username: `check_${Date.now().toString(36)}` });
  if (error) throw new Error(`${error.code ?? ''} ${error.message}`);
  must(data === true, `username_available returned ${JSON.stringify(data)}, expected true`);
}, 'Run all migrations in order (see /setup). If the error mentions the function, 0002/0003 did not run.');

await check('anonymous cannot read member profiles', async () => {
  const { data, error } = await sb.from('profiles').select('id').limit(1);
  must(denied(error), `anon read profiles: ${error ? error.message : `got ${data?.length} rows with no error`}`);
}, 'Migration 0003 (Row Level Security + grants) must be applied.');

await check('anonymous cannot read the feed', async () => {
  const { error } = await sb.from('post_feed').select('id').limit(1);
  must(denied(error), 'anon could query post_feed');
});

await check('anonymous cannot call staff or messaging functions', async () => {
  for (const fn of ['staff_stats', 'export_my_data', 'list_my_conversations', 'admin_list_users']) {
    const { error } = await sb.rpc(fn);
    must(denied(error), `anon could call ${fn}`);
  }
});

await check('internal helper functions are not exposed over the API', async () => {
  const { error } = await sb.rpc('blocked_between', { a: crypto.randomUUID(), b: crypto.randomUUID() });
  must(denied(error), 'blocked_between is callable — the private schema must not be exposed');
}, 'In Supabase → Settings → API, "Exposed schemas" should be only: public (and graphql_public).');

const email = env.CHECK_EMAIL; const password = env.CHECK_PASSWORD;
if (!email || !password) {
  console.log('\nSigned-in checks skipped. To run them: sign up a test member in the app, confirm her email, then\n  CHECK_EMAIL=… CHECK_PASSWORD=… npm run check:supabase');
} else {
  console.log('\nSigned-in member');
  let uid = null;
  await check('sign in with email + password', async () => {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    uid = data.user.id; return data.user.email_confirmed_at ? 'email confirmed' : 'WARNING: email not confirmed';
  }, 'Sign up in the app first and click the link in the confirmation email.');

  if (uid) {
    await check('sign-up trigger created profile, settings and status rows', async () => {
      const [p, s, a] = await Promise.all([
        sb.from('profiles').select('username,verified_contributor').eq('id', uid).maybeSingle(),
        sb.from('user_settings').select('age_assurance,dm_permission').eq('user_id', uid).maybeSingle(),
        sb.from('account_status').select('status').eq('user_id', uid).maybeSingle(),
      ]);
      for (const r of [p, s, a]) if (r.error) throw new Error(r.error.message);
      must(p.data && s.data && a.data, 'one of the rows is missing — the on_auth_user_created trigger did not run');
      must(s.data.age_assurance === 'self_declared', 'age_assurance should be self_declared');
      return `@${p.data.username}`;
    }, 'Migration 0002 creates the trigger on auth.users; re-run it, then sign up a NEW test member.');

    await check('seed data is present (categories, situations, collections)', async () => {
      const [c, s, k] = await Promise.all([sb.from('categories').select('id', { count: 'exact', head: true }), sb.from('situations').select('id', { count: 'exact', head: true }), sb.from('collection_overview').select('id', { count: 'exact', head: true })]);
      for (const r of [c, s, k]) if (r.error) throw new Error(r.error.message);
      must(c.count >= 8, `only ${c.count} categories`); must(k.count >= 1, 'no collections');
      return `${c.count} categories, ${s.count} situations, ${k.count} collections`;
    }, 'Run supabase/seed.sql.');

    await check('member can create, read and delete her own (anonymous) post', async () => {
      const { data: cat } = await sb.from('categories').select('id').eq('slug', 'lifestyle').single();
      const { data: ins, error } = await sb.from('posts').insert({ author_id: uid, kind: 'experience', category_id: cat.id, title: 'AMONGHER connection check', body: 'Temporary post created by the connection check script.', is_anonymous: true }).select('id').single();
      if (error) throw new Error(`insert: ${error.message}`);
      const { data: seen, error: e2 } = await sb.from('post_feed').select('id,is_anonymous,author_username,is_mine').eq('id', ins.id).single();
      if (e2) throw new Error(`read back via post_feed: ${e2.message}`);
      must(seen.is_mine && seen.is_anonymous, 'view did not mark the post as mine/anonymous');
      const { error: e3 } = await sb.from('posts').delete().eq('id', ins.id);
      if (e3) throw new Error(`delete: ${e3.message}`);
    });

    await check('prefix full-text search works on the feed', async () => {
      const { error } = await sb.from('post_feed').select('id').textSearch('fts', 'conn:*', { config: 'simple' }).limit(1);
      if (error) throw new Error(error.message);
    });

    await check('inbox badge and data export RPCs work', async () => {
      const b = await sb.rpc('inbox_badge'); if (b.error) throw new Error(`inbox_badge: ${b.error.message}`);
      const x = await sb.rpc('export_my_data'); if (x.error) throw new Error(`export_my_data: ${x.error.message}`);
      must(x.data?.account?.email, 'export has no account.email'); must(!JSON.stringify(x.data).includes('"fts"'), 'export leaked the search vector');
    }, 'Migration 0005 must be applied.');

    await check('a normal member is refused staff functions', async () => {
      const { error } = await sb.rpc('staff_stats');
      must(error && /forbidden|42501|permission/i.test(`${error.code} ${error.message}`), `expected "forbidden", got ${error ? error.message : 'success (!)'}`);
    });

    await check('role and verification columns cannot be self-edited', async () => {
      const a = await sb.from('profiles').update({ verified_contributor: true }).eq('id', uid);
      must(a.error, 'member could set verified_contributor');
      const b = await sb.from('user_roles').insert({ user_id: uid, role: 'admin' });
      must(b.error, 'member could insert into user_roles');
    });

    await check('private evidence bucket accepts an upload to her own folder only', async () => {
      const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
      const mine = `${uid}/check-${Date.now()}.png`;
      const up = await sb.storage.from('verification-evidence').upload(mine, new Blob([png], { type: 'image/png' }));
      if (up.error) throw new Error(`own folder: ${up.error.message}`);
      await sb.storage.from('verification-evidence').remove([mine]);
      const other = await sb.storage.from('verification-evidence').upload(`${crypto.randomUUID()}/x.png`, new Blob([png], { type: 'image/png' }));
      must(other.error, "member could upload into someone else's folder");
    }, 'Migration 0004 creates the private bucket and its policies.');

    await check('realtime channel subscribes', async () => {
      await new Promise((resolve, reject) => {
        const ch = sb.channel(`check-${Date.now()}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {})
          .subscribe((status) => { if (status === 'SUBSCRIBED') { sb.removeChannel(ch); resolve(); } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(`status ${status}`)); });
        setTimeout(() => reject(new Error('no SUBSCRIBED within 10s')), 10000);
      });
    }, 'Realtime must be enabled for the project; migration 0003 adds `messages` to the supabase_realtime publication.');

    await sb.auth.signOut();
  }
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${failed ? `✘ ${failed} of ${results.length} checks failed` : `✔ all ${results.length} checks passed`} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
process.exit(failed ? 1 : 0);
