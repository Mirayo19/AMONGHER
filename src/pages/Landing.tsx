import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, EyeOff, HeartHandshake, Lock, MessagesSquare, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '@/state/auth';
import { useTitle } from '@/lib/hooks';
import { BrandLink, LogoMark } from '@/components/ui';
import { PreviewBanner } from '@/components/AppShell';

/** Overlapping rings: the "among her" motif used across the brand. */
function RingsArt() {
  const rings = [[150, 150, 96, '#5e2c52', 1], [230, 150, 96, '#935580', .75], [190, 82, 96, '#b08a4c', .8], [190, 218, 96, '#d1a9c3', .8]] as const;
  return (
    <svg viewBox="0 0 380 300" className="mx-auto w-full max-w-md" aria-hidden="true">
      <g fill="none" strokeWidth="2.2">
        {rings.map(([cx, cy, r, c, o], i) => <circle key={i} cx={cx + 0} cy={cy} r={r} stroke={c} opacity={o} />)}
        {rings.map(([cx, cy, r, c, o], i) => <circle key={`s${i}`} cx={cx} cy={cy} r={r - 14} stroke={c} opacity={o * 0.35} strokeDasharray="2 7" strokeLinecap="round" />)}
      </g>
      <circle cx="190" cy="150" r="9" fill="#5e2c52" /><circle cx="190" cy="150" r="3.5" fill="#dcc08a" />
    </svg>
  );
}

const PILLARS = [
  { icon: MessagesSquare, title: 'A community that listens', text: 'Share an experience, ask what you’re afraid to ask, and hear from women who’ve been there. Respond with “Felt this”, not likes.' },
  { icon: BookOpen, title: 'A library of lived knowledge', text: 'Editors gather consented, reviewed experiences into collections, like “Things I wish I knew before motherhood”.' },
  { icon: HeartHandshake, title: 'Find someone who understands', text: 'Tell us what you’re facing and meet women who’ve opted in to share similar experiences. Request a private chat. She decides.' },
  { icon: Lock, title: 'Private by design', text: 'No real names or photos. Message requests you can decline. Block and report in one tap.' },
];

export default function Landing() {
  useTitle('');
  const { me } = useAuth();
  return (
    <div className="min-h-dvh">
      <PreviewBanner />
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <BrandLink />
        <nav className="flex items-center gap-1.5">
          <Link to="/safety" className="btn-quiet btn-sm hidden sm:inline-flex">Safety</Link>
          {me ? <Link to="/home" className="btn-primary btn-sm">Open app</Link> : <><Link to="/login" className="btn-quiet btn-sm">Login</Link><Link to="/signup" className="btn-primary btn-sm">Sign up</Link></>}
        </nav>
      </header>

      <section className="mx-auto grid max-w-5xl items-center gap-8 px-5 pb-14 pt-6 md:grid-cols-[1.1fr_1fr] md:pt-14">
        <div className="animate-rise">
          <p className="eyebrow mb-4 text-brass-700">For women, 18 and over</p>
          <h1 className="text-[40px] font-semibold leading-[1.05] sm:text-6xl">
            Learn from <em className="font-display italic text-plum-600">her.</em><br />Share with <em className="font-display italic text-plum-600">her.</em><br />Grow together.
          </h1>
          <p className="mt-6 max-w-md text-[17px] leading-relaxed text-ink-muted">
            AMONGHER is an anonymous-first space where women trade real-life experience about health, work, money, motherhood, safety and everything in between.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={me ? '/home' : '/signup'} className="btn-primary btn-lg">{me ? 'Go to your feed' : 'Create your anonymous profile'}<ArrowRight size={18} /></Link>
            {!me && <Link to="/login" className="btn-secondary btn-lg">Login</Link>}
          </div>
          <p className="mt-4 text-xs text-ink-muted">No real name. No photo. Age is self-declared. See how we think about <Link to="/safety" className="font-semibold text-plum-700 underline">safety</Link>.</p>
        </div>
        <div className="relative"><RingsArt /></div>
      </section>

      <section className="border-y border-ivory-300/70 bg-ivory-50/70">
        <div className="mx-auto grid max-w-5xl gap-px px-5 py-14 sm:grid-cols-2 sm:gap-x-12 sm:gap-y-10">
          {PILLARS.map(({ icon: I, title, text }) => (
            <div key={title} className="flex gap-4">
              <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-plum-100 text-plum-700"><I size={22} strokeWidth={1.7} /></span>
              <div><h2 className="text-xl font-semibold">{title}</h2><p className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">{text}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="text-center text-3xl font-semibold">Honest about how it works</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { icon: EyeOff, t: 'Anonymous-first', d: 'Posts can hide your username entirely. Your email is never shown. (Moderators can see which account is behind a post when handling a safety report.)' },
            { icon: Users, t: 'You’re in control', d: 'Choose who can message you, whether you’re discoverable, and who you block. Nothing is forced on you.' },
            { icon: ShieldCheck, t: 'Moderated with care', d: 'Reports go to real people, sensitive topics get extra safeguards, and every suspension can be appealed.' },
          ].map(({ icon: I, t, d }) => (
            <div key={t} className="card p-6"><I className="text-brass-500" size={22} /><h3 className="mt-3 text-lg font-semibold">{t}</h3><p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{d}</p></div>
          ))}
        </div>
      </section>

      <footer className="border-t border-ivory-300/70 px-5 py-10 text-center text-sm text-ink-muted">
        <div className="mx-auto mb-3 flex w-fit items-center gap-2"><LogoMark size={22} /><span className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-plum-900">Among<span className="text-brass-500">her</span></span></div>
        <p>Learn from her. Share with her. Grow together.</p>
        <p className="mt-3 flex justify-center gap-5"><Link to="/safety" className="hover:underline">Safety centre</Link><Link to="/safety#guidelines" className="hover:underline">Guidelines</Link><Link to="/privacy" className="hover:underline">Privacy</Link><Link to="/terms" className="hover:underline">Terms</Link><Link to="/setup" className="hover:underline">Setup</Link></p>
      </footer>
    </div>
  );
}
