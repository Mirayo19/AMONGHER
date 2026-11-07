import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ExternalLink, EyeOff, Flag, Gavel, HeartHandshake, LifeBuoy, Lock, ShieldCheck, UserRound } from 'lucide-react';
import { api } from '@/data/api';
import { errorMessage } from '@/lib/errors';
import { useAsync, useTitle } from '@/lib/hooks';
import { fullDate } from '@/lib/util';
import { useAuth } from '@/state/auth';
import { useToast } from '@/state/toast';
import { BrandLink, Button, Counter, Field, Notice, PageHeader, Textarea } from '@/components/ui';

const GUIDELINES = [
  ['Be kind, be curious', 'Respond to the person, not just the problem. Assume she’s doing her best.'],
  ['Share your experience, not a diagnosis', 'Say what happened to you. Don’t present personal stories as medical, legal or financial advice.'],
  ['Protect privacy, yours and others’', 'No real names, workplaces, phone numbers, addresses or photos of other people. Never “out” anyone.'],
  ['No harassment, shaming or hate', 'Disagree respectfully. Bullying, threats and discrimination lead to removal.'],
  ['This is a space for women', 'Please don’t join to observe, recruit, sell or pressure. Solicitation and spam are removed.'],
  ['Handle heavy topics with care', 'Health, abuse and safety posts carry a content note. Reply supportively and point to professional help where it’s needed.'],
];

export default function Safety() {
  useTitle('Safety centre');
  const { hash } = useLocation(); const { me } = useAuth();
  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }); }, [hash]);
  const Row = ({ icon: I, title, children }: { icon: typeof Lock; title: string; children: React.ReactNode }) => (
    <div className="flex gap-4"><span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-plum-100 text-plum-700"><I size={20} strokeWidth={1.7} /></span><div><h3 className="text-lg font-semibold">{title}</h3><div className="mt-1 text-[15px] leading-relaxed text-ink-muted">{children}</div></div></div>
  );
  const body = (
    <div className="space-y-8">
      <Notice tone="danger" title="If you are in immediate danger">
        Contact your local emergency number now. For free, confidential support lines in your country, see{' '}
        <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer" className="font-bold underline">findahelpline.com <ExternalLink size={12} className="inline" /></a>.
        AMONGHER moderators are not an emergency service and can’t respond in real time.
      </Notice>
      <section className="space-y-6" aria-label="How AMONGHER protects you">
        <h2 className="text-2xl font-semibold">How we try to keep you safe</h2>
        <Row icon={EyeOff} title="Anonymous-first, honestly">You can post without your username showing. Your email and any private details are never displayed to members. Moderators can see which account is behind an anonymous post if it’s reported, so we can act on abuse.</Row>
        <Row icon={Lock} title="Private messages, with a caveat">Conversations start only when someone accepts a request. They’re protected by strict database access rules, but they are <strong>not end-to-end encrypted</strong>. Moderators read a conversation only when a participant reports it.</Row>
        <Row icon={UserRound} title="About age">You confirm you’re 18+ when you join. That is a self-declaration. We don’t currently verify age, and we won’t claim otherwise.</Row>
        <Row icon={Flag} title="Reporting and review">Report any post, comment, member or conversation. When three different members report the same post or comment, it’s hidden from others until a moderator reviews it. Reporters are never named to the person they report.</Row>
        <Row icon={Gavel} title="Suspensions and appeals">Moderators can hide or remove content; administrators can suspend accounts. A suspended member sees why and can appeal. An administrator reviews every appeal.</Row>
        <Row icon={HeartHandshake} title="Extra care for sensitive topics">Health, motherhood, safety and abuse-related posts carry a content note, default to anonymous, and are queued for moderator review. Sensitive posts can’t be featured in the Library until a moderator has approved them.</Row>
        <Row icon={ShieldCheck} title="You’re in control">Block anyone in one tap. Switch off message requests. Turn discoverability off. Delete your account and your data at any time from Settings.</Row>
      </section>
      <section id="guidelines" className="card p-6 sm:p-7">
        <h2 className="text-2xl font-semibold">Community guidelines</h2>
        <ol className="mt-4 space-y-4">{GUIDELINES.map(([t, d], i) => (
          <li key={t} className="flex gap-4"><span className="font-display text-2xl text-brass-500">{i + 1}</span><div><h3 className="font-semibold">{t}</h3><p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{d}</p></div></li>))}</ol>
      </section>
      <p className="text-xs leading-relaxed text-ink-muted">AMONGHER hosts personal experiences shared by its members. Nothing here is medical, legal, financial or professional advice.</p>
    </div>
  );
  if (me) return <div><PageHeader eyebrow="Help & trust" title="Safety centre" subtitle="What we do, what we don’t, and what you control." />{body}</div>;
  return <div className="mx-auto max-w-2xl px-5 pb-16 pt-6"><BrandLink /><div className="mt-8"><PageHeader eyebrow="Help & trust" title="Safety centre" subtitle="What we do, what we don’t, and what you control." />{body}<p className="mt-8"><Link to="/" className="font-semibold text-plum-700 hover:underline">← Back to AMONGHER</Link></p></div></div>;
}

/* ---------------------------------------------------------------- Suspended */
export function Suspended() {
  useTitle('Account suspended');
  const { me, signOut, refresh } = useAuth(); const nav = useNavigate(); const toast = useToast();
  const appeals = useAsync(() => api.listMyAppeals(), []);
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (me && me.status === 'active') nav('/home', { replace: true }); }, [me, nav]);
  if (!me) return null;
  const pending = appeals.data?.some((a) => a.status === 'pending');
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await api.submitAppeal(msg.trim()); setMsg(''); toast('Appeal submitted'); void appeals.reload(true); void refresh(); } catch (ex) { toast(errorMessage(ex), 'error'); } finally { setBusy(false); }
  };
  return (
    <div className="mx-auto max-w-lg px-5 pb-16 pt-6">
      <BrandLink />
      <h1 className="mt-10 text-3xl font-semibold">Your account is suspended</h1>
      <p className="mt-2 text-ink-muted">You can’t post, comment or message while a suspension is in place. You can still appeal it below.</p>
      <div className="card mt-6 space-y-2 p-5 text-sm">
        <p><span className="font-semibold">Reason: </span>{me.suspended_reason ?? 'Not provided'}</p>
        <p><span className="font-semibold">Until: </span>{me.suspended_until ? fullDate(me.suspended_until) : 'Until reviewed by an administrator'}</p>
      </div>
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Appeal this decision</h2>
        {pending ? <Notice tone="info" className="mt-3" title="Your appeal is with an administrator">We’ll update this page when it’s been reviewed.</Notice> : (
          <form onSubmit={submit} className="mt-3 space-y-3">
            <Field label="What would you like us to know?" htmlFor="ap" hint={<Counter value={msg.length} max={1500} />}><Textarea id="ap" required minLength={10} maxLength={1500} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Explain what happened, or why you believe this was a mistake." /></Field>
            <Button type="submit" loading={busy} disabled={msg.trim().length < 10}>Submit appeal</Button>
          </form>)}
        {!!appeals.data?.length && <ul className="mt-6 space-y-3">{appeals.data.map((a) => (
          <li key={a.id} className="card p-4 text-sm"><div className="flex justify-between"><span className="font-semibold capitalize">{a.status === 'pending' ? 'Under review' : a.status === 'granted' ? 'Granted' : 'Not upheld'}</span><span className="text-ink-muted">{fullDate(a.created_at)}</span></div><p className="mt-1 text-ink-muted">{a.message}</p>{a.admin_note && <p className="mt-2 rounded-lg bg-plum-50 p-2.5"><strong>Reviewer:</strong> {a.admin_note}</p>}</li>))}</ul>}
      </section>
      <div className="mt-8 flex gap-3"><Button variant="secondary" onClick={async () => { await signOut(); nav('/'); }}>Sign out</Button><Link to="/safety" className="btn-quiet"><LifeBuoy size={16} />Safety centre</Link></div>
    </div>
  );
}

export function NotFound() {
  useTitle('Not found');
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <BrandLink /><h1 className="mt-10 text-4xl font-semibold">We can’t find that page</h1>
      <p className="mt-2 text-ink-muted">It may have moved, or never existed.</p>
      <Link to="/" className="btn-primary mt-6">Back to AMONGHER</Link>
    </div>
  );
}
