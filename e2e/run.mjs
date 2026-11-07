// End-to-end browser tests (Playwright) for AMONGHER in preview mode.
//   npm run test:e2e              starts its own dev server on :5199 and runs everything
//   BASE_URL=http://… npm run test:e2e   run against an already-running server
//   SHOTS=./shots npm run test:e2e       also save a screenshot of each key screen
// Two members share one browser; the first account is the preview admin.
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5199;
const BASE = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`;
const SHOTS = process.env.SHOTS;
const PW = 'correct horse battery';
let server; let n = 0;
const problems = []; let passed = 0;
const ok = (m) => { passed++; console.log(`  ✔ ${m}`); };
const bad = (m) => { problems.push(m); console.log(`  ✘ ${m}`); };

async function startServer() {
  if (process.env.BASE_URL) return;
  server = spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], { stdio: 'ignore', detached: true });   // own process group, so we can stop vite itself, not just npx
  for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE)).ok) return; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 500)); }
  throw new Error('dev server did not start');
}

async function main() {
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  await startServer();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });   // CHROMIUM_PATH: use an already-installed Chromium
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: SHOTS ? 2 : 1, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') bad(`console error: ${m.text().slice(0, 160)}`); });
  page.on('pageerror', (e) => bad(`page error: ${e.message.slice(0, 160)}`));

  const shot = async (name) => { if (SHOTS) { await page.waitForTimeout(500); await page.screenshot({ path: `${SHOTS}/${String(++n).padStart(2, '0')}-${name}.png` }); } };
  const sees = async (text, label) => { try { await page.getByText(text, { exact: false }).first().waitFor({ timeout: 6000 }); ok(label ?? `sees "${text}"`); } catch { bad(`missing "${text}" (${label ?? ''}) @ ${page.url()}`); } };
  const gone = async (text, label) => { try { await page.getByText(text, { exact: false }).first().waitFor({ state: 'detached', timeout: 6000 }); ok(label); } catch { bad(`still visible: "${text}" (${label})`); } };
  const section = (t) => console.log(`\n${t}`);

  async function signUp(email, username) {
    await page.goto(`${BASE}/signup`);
    await page.fill('#username', username); await page.getByText(`@${username} is available`).waitFor();
    await page.fill('#email', email); await page.fill('#pw', PW);
    await page.locator('input[type=checkbox]').nth(0).check(); await page.locator('input[type=checkbox]').nth(1).check();
    await page.getByRole('button', { name: 'Create account' }).click();
    await sees('Check your inbox', `${username}: verification screen`);
    await page.getByRole('button', { name: 'Simulate email confirmation' }).click();
    await sees('Email confirmed', `${username}: email confirmed`);
    await login(email, '**/onboarding');
  }
  async function login(email, wait = '**/home') {
    await page.goto(`${BASE}/login`); await page.fill('#email', email); await page.fill('#pw', PW);
    await page.getByRole('button', { name: 'Login', exact: true }).click(); await page.waitForURL(wait);
  }
  async function onboard() {
    await page.getByRole('button', { name: /^Continue/ }).click();
    await page.getByRole('button', { name: 'Career' }).click(); await page.getByRole('button', { name: 'Finance' }).click();
    await page.getByRole('button', { name: /^Continue/ }).click();
    await page.getByRole('button', { name: 'Enter AMONGHER' }).click(); await page.waitForURL('**/home');
  }
  async function signOut() {
    await page.locator('header button[aria-haspopup=menu]').click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click(); await page.waitForURL(`${BASE}/`);
  }

  section('Public pages & guards');
  await page.goto(BASE); await sees('Learn from', 'landing renders'); await shot('landing');
  for (const [path, text] of [['/privacy', 'Privacy policy'], ['/terms', 'Terms of use'], ['/safety', 'Safety centre'], ['/setup', 'Connect Supabase']]) { await page.goto(BASE + path); await sees(text, `${path} renders while signed out`); if (path === '/privacy') await shot('privacy-draft'); }
  await page.goto(`${BASE}/home`); await page.waitForURL('**/login'); ok('signed-out /home redirects to /login');
  await page.goto(`${BASE}/signup`); await page.fill('#username', 'ab'); await sees('3–24 lowercase', 'username format validated');
  await page.fill('#username', 'admin'); await sees('taken or reserved', 'reserved username refused'); await shot('signup');

  section('Member A: sign-up, onboarding, posting');
  await signUp('alice@example.test', 'alice_a'); await shot('onboarding'); await onboard();
  await sees('The conversation starts with you', 'empty feed is honest (no fake content)');
  await page.goto(`${BASE}/share/experience`);
  await page.getByRole('button', { name: 'Career' }).click();
  await page.fill('#t', 'Negotiating my first salary');
  await page.fill('#b', 'I asked for 15% more and they said yes. I wish I had rehearsed the sentence out loud first. Practise the silence after you ask.');
  await page.locator('button[role=switch]').nth(1).click(); await shot('composer');
  await page.getByRole('button', { name: 'Share experience' }).click(); await page.waitForURL('**/post/**');
  await sees('Negotiating my first salary', 'experience posted'); const expUrl = page.url();

  await page.goto(`${BASE}/share/ask`); await page.getByRole('button', { name: "Women's Health" }).click();
  await sees('not medical, legal or professional advice', 'sensitive category shows safety notice');
  await page.fill('#t', 'Anyone had a difficult first gynaecologist visit?');
  await page.fill('#b', 'I am nervous about going for the first time and do not know what to expect or what to ask.');
  await page.getByRole('button', { name: 'Post question' }).click(); await page.waitForURL('**/post/**'); const qUrl = page.url();
  await sees('Asked by the community', 'question posted (defaults to anonymous)'); await shot('question');

  await page.goto(`${BASE}/share/wish`); await page.getByRole('button', { name: 'About money' }).click(); await page.getByRole('button', { name: 'Finance' }).click();
  await page.fill('#t', 'Start the pension earlier'); await page.fill('#b', 'Compound interest rewards the patient. I wish I had started at 22, not 31.');
  await page.getByRole('button', { name: 'Share what I learned' }).click(); await page.waitForURL('**/post/**'); ok('wish posted');
  await page.goto(`${BASE}/share/experience`); await page.getByRole('button', { name: 'Lifestyle' }).click();
  await page.fill('#b', 'Some days I think about self-harm and I do not know who to tell.');
  await sees('If you might act on thoughts of harming yourself', 'crisis wording shows the helpline notice');
  await signOut();

  section('Member B: privacy, interaction, requests');
  await signUp('bea@example.test', 'bea_b'); await onboard();
  await sees('Negotiating my first salary', "B sees A's experience");
  await page.goto(qUrl); await sees('Anonymous', 'anonymous question shows "Anonymous"');
  if ((await page.locator('main').innerText()).includes('alice_a')) bad('ANONYMITY LEAK: author visible on question page'); else ok('no username leak on the anonymous question');
  await page.fill('textarea[aria-label^="Share what worked"]', 'Bring a written list of questions — they expect it.');
  await page.getByRole('button', { name: 'Post answer' }).click(); await sees('Bring a written list', 'answer posted');
  await page.goto(expUrl);
  await page.getByRole('button', { name: /Helpful/ }).first().click(); await page.waitForTimeout(150);
  await page.getByRole('button', { name: /^Save$/ }).first().click(); await sees('Saved to your experiences', 'bookmark works');
  await page.fill('textarea[aria-label^="Add a kind"]', 'Great tip about the silence.');
  await page.getByRole('button', { name: 'Post comment' }).click(); await sees('Great tip about the silence', 'comment posted'); await shot('post-detail');
  await page.getByRole('button', { name: 'Request chat' }).click();
  await page.fill('textarea[aria-label=Introduction]', 'Hi Alice, your salary story really helped me.');
  await page.getByRole('button', { name: 'Send request' }).click(); await sees('Request sent', 'message request sent'); await page.getByRole('button', { name: 'Done' }).click();
  await page.locator('article button[aria-haspopup=menu]').first().click(); await page.getByRole('menuitem', { name: 'Report post' }).click();
  await page.getByText('Spam or selling').click(); await page.getByRole('button', { name: 'Send report' }).click(); await sees('Thank you', 'post report submitted'); await page.getByRole('button', { name: 'Done' }).click();
  for (const [path, text] of [['/explore', 'Browse by topic'], ['/library', 'Things I Wish I Knew Before Motherhood'], ['/understand', 'preparing to relocate abroad'], ['/wish', 'Start the pension earlier'], ['/inbox', 'Conversations']]) { await page.goto(BASE + path); await sees(text, `${path} renders`); await shot(path.slice(1)); }
  await page.goto(`${BASE}/explore`); await page.fill('input[type=search]', 'pens'); await sees('Start the pension earlier', 'prefix search finds "pens" → "pension"');
  await page.goto(`${BASE}/admin`); await page.waitForURL('**/home'); ok('non-admin bounced from /admin');
  await signOut();

  section('Member A: accept, chat, edit, export');
  await login('alice@example.test');
  await page.goto(`${BASE}/inbox`); await page.getByRole('tab', { name: /Requests/ }).click();
  await sees('your salary story really helped me', 'A sees the request'); await shot('requests');
  await page.getByRole('button', { name: 'Accept' }).click(); await page.waitForURL('**/inbox/**'); ok('request accepted → conversation opens');
  await page.fill('textarea[aria-label=Message]', 'Happy to help, Bea!'); await page.keyboard.press('Enter');
  await sees('Happy to help, Bea!', 'message sent'); await sees('not end-to-end encrypted', 'honest encryption copy'); await shot('conversation');

  await page.goto(`${BASE}/me`);
  const card = page.locator('article', { hasText: 'Negotiating my first salary' });
  await card.locator('button[aria-haspopup=menu]').click(); await page.getByRole('menuitem', { name: 'Edit post' }).click();
  await page.fill('#et', 'Negotiating my first salary (edited)'); await shot('edit-post'); await page.getByRole('button', { name: 'Save changes' }).click();
  await sees('Negotiating my first salary (edited)', 'author can edit her post');
  await page.goto(`${BASE}/settings`); await page.getByRole('button', { name: 'Download my data' }).scrollIntoViewIfNeeded(); await shot('settings-your-data');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download my data' }).click()]);
  const data = JSON.parse(readFileSync(await dl.path(), 'utf8'));
  if (data.account?.email === 'alice@example.test' && data.posts?.length === 3 && JSON.stringify(data).indexOf('bea@example.test') === -1) ok('data export contains her own data (3 posts) and nobody else’s email'); else bad(`data export looks wrong: ${JSON.stringify(data).slice(0, 120)}`);

  section('Admin: dashboard, review queue, wish themes');
  await page.goto(`${BASE}/admin`); await sees('Admin dashboard', 'admin dashboard opens for admin'); await sees('Open reports', 'stats shown'); await shot('admin');
  await page.goto(`${BASE}/admin/content`); await sees('Anyone had a difficult first gynaecologist visit?', 'sensitive post is in the review queue'); await shot('admin-review-queue');
  await page.locator('li', { hasText: 'Anyone had a difficult' }).getByRole('button', { name: 'Approve' }).click();
  await gone('Anyone had a difficult first gynaecologist visit?', 'approving removes it from the queue');
  await page.goto(`${BASE}/admin/reports`); await sees('Spam or selling', 'report visible to admin'); await shot('admin-reports');
  await page.getByRole('tab', { name: 'By member' }).click(); await sees('@alice_a', 'reports can be grouped by member'); await shot('admin-by-member');
  await page.goto(`${BASE}/admin/categories`); await page.getByText('knew” themes').first().scrollIntoViewIfNeeded(); await shot('admin-wish-themes'); await page.getByRole('button', { name: 'New' }).nth(2).click();
  await page.fill('#wl', 'Before buying a home'); await page.getByRole('button', { name: 'Save', exact: true }).click(); await sees('Theme saved', 'admin can add an “I wish I knew” theme');
  await page.goto(`${BASE}/wish`); await sees('Before buying a home', 'new theme appears on the Wish page');
  for (const p of ['users', 'collections', 'verification', 'appeals', 'activity']) {
    await page.goto(`${BASE}/admin/${p}`); await page.waitForTimeout(250);
    (await page.locator('main').innerText()).length > 40 ? ok(`admin/${p} renders`) : bad(`admin/${p} looks broken`);
  }
  await signOut();

  section('Member B: report a single message');
  await login('bea@example.test');
  await page.goto(`${BASE}/inbox`); await page.locator('a[href^="/inbox/"]').first().click();
  await page.getByText('Happy to help, Bea!').click(); await page.getByRole('button', { name: 'Report this message' }).click();
  await page.getByText('Harassment or bullying').click(); await shot('report-message'); await page.getByRole('button', { name: 'Send report' }).click(); await sees('Thank you', 'single message reported'); await page.getByRole('button', { name: 'Done' }).click();
  await signOut();
  await login('alice@example.test'); await page.goto(`${BASE}/admin/reports`);
  await sees('Reported message, with the messages before it', 'staff see the reported message with its context');

  await page.setViewportSize({ width: 1280, height: 860 }); await page.goto(`${BASE}/home`); await shot('desktop-home');
  await browser.close();
}

let code = 0;
try { await main(); } catch (e) { console.error('\nE2E crashed:', e.message); code = 2; }
if (server) { try { process.kill(-server.pid); } catch { /* already gone */ } }
if (code === 2) console.log('\n✘ E2E DID NOT COMPLETE');
else console.log(problems.length ? `\n${problems.length} PROBLEM(S), ${passed} passed:\n - ${problems.join('\n - ')}` : `\n✔ ALL ${passed} E2E CHECKS PASSED`);
process.exit(code || (problems.length ? 1 : 0));
