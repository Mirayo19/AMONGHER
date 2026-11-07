import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, MailCheck } from 'lucide-react';
import { api } from '@/data/api';
import { isPreviewMode } from '@/lib/config';
import { errorMessage } from '@/lib/errors';
import { useTitle } from '@/lib/hooks';
import { USERNAME_RE, debounce } from '@/lib/util';
import { useToast } from '@/state/toast';
import { Button, BrandLink, Checkbox, Field, Input, Notice } from '@/components/ui';
import { PreviewBanner } from '@/components/AppShell';

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <PreviewBanner />
      <div className="mx-auto flex max-w-md flex-col px-5 pb-12 pt-8">
        <BrandLink />
        <div className="mt-10 animate-rise">
          <h1 className="text-[32px] font-semibold leading-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{subtitle}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-ink-muted">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

function PasswordField({ id, label = 'Password', value, onChange, autoComplete, hint, error }: { id: string; label?: string; value: string; onChange: (v: string) => void; autoComplete: string; hint?: ReactNode; error?: string | null }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error}>
      <div className="relative">
        <Input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} className="pr-12" required minLength={8} />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-plum-700">
          {show ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>
      </div>
    </Field>
  );
}

/* ---------------------------------------------------------------- Login */
export function Login() {
  useTitle('Login');
  const nav = useNavigate(); const loc = useLocation(); const [sp] = useSearchParams();
  const [email, setEmail] = useState((loc.state as { email?: string } | null)?.email ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api.signIn(email.trim(), password); }
    catch (ex) {
      const msg = errorMessage(ex);
      if (/confirm your email/i.test(msg)) nav('/verify', { state: { email: email.trim() } }); else setErr(msg);
    } finally { setBusy(false); }
  };
  return (
    <AuthLayout title="Welcome back" subtitle="Log in to pick up where you left off."
      footer={<>New to AMONGHER? <Link to="/signup" className="font-semibold text-plum-700 hover:underline">Create an account</Link></>}>
      {sp.get('confirmed') && <Notice tone="ok" className="mb-5">Email confirmed. You can log in now.</Notice>}
      <form onSubmit={submit} className="space-y-4" noValidate={false}>
        <Field label="Email" htmlFor="email"><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
        <PasswordField id="pw" value={password} onChange={setPassword} autoComplete="current-password" />
        {err && <p role="alert" className="text-sm font-medium text-clay-700">{err}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>Login</Button>
        <p className="text-center"><Link to="/forgot" className="text-sm font-semibold text-plum-700 hover:underline">Forgot your password?</Link></p>
      </form>
    </AuthLayout>
  );
}

/* ---------------------------------------------------------------- Sign up */
export function SignUp() {
  useTitle('Create your account');
  const nav = useNavigate();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [username, setUsername] = useState('');
  const [age, setAge] = useState(false); const [guidelines, setGuidelines] = useState(false);
  const [uStatus, setUStatus] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [tried, setTried] = useState(false);

  const check = useRef(debounce(async (u: string, set: (s: typeof uStatus) => void) => {
    set((await api.usernameAvailable(u).catch(() => true)) ? 'ok' : 'taken');
  }, 350));
  useEffect(() => {
    const u = username.toLowerCase();
    if (!u) return setUStatus('idle');
    if (!USERNAME_RE.test(u)) return setUStatus('invalid');
    setUStatus('checking'); check.current(u, setUStatus);
  }, [username]);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setTried(true); setErr(null);
    if (!age || !guidelines || uStatus !== 'ok') return;
    setBusy(true);
    try {
      const r = await api.signUp({ email: email.trim(), password, username, ageConfirmed: age });
      nav(r.needsEmailVerification ? '/verify' : '/onboarding', { state: { email: email.trim() } });
    } catch (ex) { setErr(errorMessage(ex)); } finally { setBusy(false); }
  };
  const uMsg = { idle: null, checking: null, ok: null, taken: 'That username is taken or reserved.', invalid: 'Use 3–24 lowercase letters, numbers or underscores.' }[uStatus];

  return (
    <AuthLayout title="Sign up to AMONGHER" subtitle="No real name. No photo. Just a username and your story."
      footer={<>Already a member? <Link to="/login" className="font-semibold text-plum-700 hover:underline">Login</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Choose a username" htmlFor="username" error={uMsg}
          hint={uStatus === 'ok' ? <span className="font-semibold text-sage-700">@{username.toLowerCase()} is available</span> : 'This is how others will know you. Keep it free of your real name.'}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">@</span>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))} className="pl-8" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={24} required />
          </div>
        </Field>
        <Field label="Email" htmlFor="email" hint="Used only to log in and recover your account. It is never shown to anyone.">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <PasswordField id="pw" value={password} onChange={setPassword} autoComplete="new-password" hint="At least 8 characters." />
        <div className="space-y-2.5 pt-1">
          <Checkbox checked={age} onChange={setAge} error={tried && !age}>
            <strong className="text-ink">I am 18 or older.</strong> I understand this is a self-declaration. AMONGHER does not independently verify age.
          </Checkbox>
          <Checkbox checked={guidelines} onChange={setGuidelines} error={tried && !guidelines}>
            I’ve read the <Link to="/safety#guidelines" target="_blank" className="font-semibold text-plum-700 underline">Community Guidelines</Link>, <Link to="/terms" target="_blank" className="font-semibold text-plum-700 underline">Terms</Link> and <Link to="/privacy" target="_blank" className="font-semibold text-plum-700 underline">Privacy policy</Link>. AMONGHER is a space for women, and I’ll treat it that way.
          </Checkbox>
        </div>
        {err && <p role="alert" className="text-sm font-medium text-clay-700">{err}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>Create account</Button>
        {isPreviewMode && <p className="hint text-center">Preview mode: your account stays in this browser only.</p>}
      </form>
    </AuthLayout>
  );
}

/* ---------------------------------------------------------------- Verify email */
export function VerifyEmail() {
  useTitle('Check your inbox');
  const loc = useLocation(); const toast = useToast();
  const email = (loc.state as { email?: string } | null)?.email ?? '';
  const [busy, setBusy] = useState(false); const [cool, setCool] = useState(0);
  useEffect(() => { if (cool <= 0) return; const t = setTimeout(() => setCool((c) => c - 1), 1000); return () => clearTimeout(t); }, [cool]);
  const nav = useNavigate();
  return (
    <AuthLayout title="Check your inbox"
      subtitle={<>We sent a confirmation link{email && <> to <strong className="text-ink">{email}</strong></>}. Open it to activate your account, then log in.</>}>
      <div className="card flex items-center gap-4 p-5"><MailCheck className="shrink-0 text-plum-600" size={32} strokeWidth={1.6} /><p className="text-sm leading-relaxed text-ink-muted">Can’t see it? Check spam or promotions. The link keeps your account yours. Nobody else can use your username without it.</p></div>
      <div className="mt-5 space-y-3">
        <Button variant="secondary" className="w-full" disabled={!email || cool > 0} loading={busy}
          onClick={async () => { setBusy(true); try { await api.resendVerification(email); toast('Confirmation email sent again'); setCool(45); } catch (e) { toast(errorMessage(e), 'error'); } finally { setBusy(false); } }}>
          {cool > 0 ? `Resend in ${cool}s` : 'Resend email'}
        </Button>
        <Link to="/login" state={{ email }} className="btn-quiet w-full">Back to login</Link>
      </div>
      {api.previewConfirmEmail && email && (
        <Notice tone="care" title="Preview mode" className="mt-6">
          No email is sent in preview mode. Use this button to simulate clicking the link in the email.
          <Button size="sm" className="mt-3" onClick={async () => { await api.previewConfirmEmail!(email); toast('Email confirmed (simulated)'); nav('/login?confirmed=1', { state: { email } }); }}>Simulate email confirmation</Button>
        </Notice>
      )}
    </AuthLayout>
  );
}

/* ---------------------------------------------------------------- Forgot / reset */
export function Forgot() {
  useTitle('Reset your password');
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api.requestPasswordReset(email.trim()); setSent(true); } catch (ex) { setErr(errorMessage(ex)); } finally { setBusy(false); }
  };
  return (
    <AuthLayout title="Forgot your password?" subtitle="Enter your email and we’ll send a link to choose a new one."
      footer={<Link to="/login" className="font-semibold text-plum-700 hover:underline">Back to login</Link>}>
      {sent ? (
        <div className="space-y-4">
          <Notice tone="ok" title="If an account exists for that email, a reset link is on its way.">For your privacy we don’t say whether an address is registered.</Notice>
          {isPreviewMode && <Notice tone="care" title="Preview mode">No email is sent. <button className="font-bold underline" onClick={() => nav('/reset')}>Continue to the reset form</button> to simulate the link.</Notice>}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email" htmlFor="email"><Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          {err && <p role="alert" className="text-sm font-medium text-clay-700">{err}</p>}
          <Button type="submit" size="lg" className="w-full" loading={busy}>Send reset link</Button>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPassword() {
  useTitle('Choose a new password');
  const nav = useNavigate(); const toast = useToast();
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState<boolean | null>(null);
  useEffect(() => { // Supabase signs the member in via the recovery link; give it a moment to process the URL.
    let tries = 0; const t = setInterval(async () => { tries++; const has = await api.hasSession(); if (has || isPreviewMode || tries > 8) { setReady(has || isPreviewMode); clearInterval(t); } }, 300);
    return () => clearInterval(t);
  }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null);
    if (pw !== pw2) return setErr('Passwords don’t match.');
    setBusy(true);
    try { await api.updatePassword(pw); toast('Password updated'); nav('/home'); } catch (ex) { setErr(errorMessage(ex)); } finally { setBusy(false); }
  };
  if (ready === false) return <AuthLayout title="Link expired" subtitle="This reset link is invalid or has expired."><Link to="/forgot" className="btn-primary w-full">Request a new link</Link></AuthLayout>;
  return (
    <AuthLayout title="Choose a new password">
      <form onSubmit={submit} className="space-y-4">
        <PasswordField id="pw" label="New password" value={pw} onChange={setPw} autoComplete="new-password" hint="At least 8 characters." />
        <PasswordField id="pw2" label="Confirm new password" value={pw2} onChange={setPw2} autoComplete="new-password" />
        {err && <p role="alert" className="text-sm font-medium text-clay-700">{err}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={ready === null}>Update password</Button>
      </form>
    </AuthLayout>
  );
}
