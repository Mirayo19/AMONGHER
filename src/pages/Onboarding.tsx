import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { api } from '@/data/api';
import { errorMessage } from '@/lib/errors';
import { useTitle } from '@/lib/hooks';
import type { AvatarMotif, DmPermission, Visibility } from '@/lib/types';
import { cx } from '@/lib/util';
import { useAuth } from '@/state/auth';
import { useTaxonomy } from '@/state/taxonomy';
import { useToast } from '@/state/toast';
import AvatarPicker from '@/components/AvatarPicker';
import { BrandLink, Button, CategoryIcon, Counter, Field, Input, Notice, Switch, Textarea } from '@/components/ui';
import { toneClass } from '@/lib/util';

export default function Onboarding() {
  useTitle('Welcome');
  const { me, refresh } = useAuth(); const nav = useNavigate(); const toast = useToast();
  const { categories } = useTaxonomy();
  const [step, setStep] = useState(0);
  const [motif, setMotif] = useState<AvatarMotif>(me?.avatar_motif ?? 'ring'); const [tone, setTone] = useState(me?.avatar_tone ?? 0);
  const [bio, setBio] = useState(''); const [loc, setLoc] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<Visibility>('members'); const [dm, setDm] = useState<DmPermission>('everyone');
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    setBusy(true);
    try {
      await api.updateSettings({ dm_permission: dm });
      await api.updateProfile({ avatar_motif: motif, avatar_tone: tone, bio: bio.trim() || null, location: loc.trim() || null, interests, visibility, onboarded_at: new Date().toISOString() });
      await refresh(); toast(`Welcome, @${me?.username}`); nav('/home', { replace: true });
    } catch (e) { toast(errorMessage(e), 'error'); } finally { setBusy(false); }
  };
  const steps = ['Your look', 'Your interests', 'Your privacy'];
  return (
    <div className="mx-auto min-h-dvh max-w-xl px-5 pb-16 pt-6">
      <BrandLink />
      <ol className="mt-8 flex gap-2" aria-label="Progress">
        {steps.map((s, i) => <li key={s} className={cx('h-1.5 flex-1 rounded-full transition', i <= step ? 'bg-plum-600' : 'bg-ivory-300')} aria-current={i === step ? 'step' : undefined} />)}
      </ol>
      <p className="eyebrow mt-4 text-brass-700">Step {step + 1} of 3 · {steps[step]}</p>

      {step === 0 && (
        <div className="mt-3 animate-rise space-y-6">
          <div><h1 className="text-3xl font-semibold">Hello, @{me?.username}</h1><p className="mt-2 text-ink-muted">Pick an avatar. You can add a short bio and location if you like — both are optional, and neither needs to be real.</p></div>
          <AvatarPicker motif={motif} tone={tone} onChange={(m, t) => { setMotif(m); setTone(t); }} />
          <Field label="Bio (optional)" htmlFor="bio" hint={<Counter value={bio.length} max={280} />}><Textarea id="bio" maxLength={280} value={bio} onChange={(e) => setBio(e.target.value)} className="min-h-[88px]" placeholder="A line or two about what you’re navigating, or what you could help with." /></Field>
          <Field label="Location (optional)" htmlFor="loc" hint="A city or country is plenty. Leave blank if you prefer."><Input id="loc" maxLength={60} value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="e.g. Lisbon" /></Field>
        </div>
      )}
      {step === 1 && (
        <div className="mt-3 animate-rise space-y-5">
          <div><h1 className="text-3xl font-semibold">What would you like to learn about?</h1><p className="mt-2 text-ink-muted">Choose a few topics to start with. This is only used to personalise suggestions — you can change it any time.</p></div>
          <div className="grid grid-cols-2 gap-3">
            {categories.map((c) => {
              const on = interests.includes(c.slug);
              return (
                <button key={c.id} onClick={() => setInterests((s) => on ? s.filter((x) => x !== c.slug) : [...s, c.slug])} aria-pressed={on}
                  className={cx(toneClass(c.tone), 'relative rounded-2xl border p-4 text-left transition', on ? 't-bg border-[var(--t-fg)] shadow-soft' : 'border-ivory-300 bg-ivory-50 hover:border-[var(--t-line)]')}>
                  <span className="t-fg"><CategoryIcon name={c.icon} size={22} /></span>
                  <span className="mt-2 block font-semibold text-ink">{c.name}</span>
                  {on && <Check size={18} className="t-fg absolute right-3 top-3" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="mt-3 animate-rise space-y-5">
          <div><h1 className="text-3xl font-semibold">You decide who sees you</h1><p className="mt-2 text-ink-muted">Sensible defaults, all changeable in Settings.</p></div>
          <div className="card divide-y divide-ivory-300 px-5">
            <Switch checked={visibility === 'members'} onChange={(v) => setVisibility(v ? 'members' : 'private')} label="Show my bio and interests on my profile" description="Off keeps your profile to just your username and avatar." />
            <Switch checked={dm === 'everyone'} onChange={(v) => setDm(v ? 'everyone' : 'nobody')} label="Let members send me message requests" description="You always choose whether to accept. You can switch this off at any time." />
          </div>
          <Notice tone="info" title="What to expect">
            Posting anonymously hides your username from other members. Our moderators can still see the account behind a post if it’s reported — so everyone stays safe. Your email is never shown to anyone.
          </Notice>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <Button variant="quiet" onClick={() => setStep((s) => s - 1)} disabled={step === 0}><ArrowLeft size={16} />Back</Button>
        {step < 2 ? <Button onClick={() => setStep((s) => s + 1)}>Continue<ArrowRight size={16} /></Button> : <Button loading={busy} onClick={finish}>Enter AMONGHER</Button>}
      </div>
    </div>
  );
}
