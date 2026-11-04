import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, EyeOff, HeartHandshake, MessageSquarePlus, Search } from 'lucide-react';
import { api } from '@/data/api';
import { errorMessage } from '@/lib/errors';
import { useAsync, useTitle } from '@/lib/hooks';
import type { Understander } from '@/lib/types';
import { cx } from '@/lib/util';
import { useAuth } from '@/state/auth';
import { useTaxonomy } from '@/state/taxonomy';
import { useToast } from '@/state/toast';
import { PostList } from '@/components/Feed';
import RequestDialog from '@/components/RequestDialog';
import { Avatar, Button, EmptyState, Notice, PageHeader, Spinner, Switch, Textarea, VerifiedBadge, Counter } from '@/components/ui';

export default function Understand() {
  useTitle('Find someone who understands');
  const { situations, cat } = useTaxonomy();
  const [sel, setSel] = useState<string | null>(null);
  const situation = situations.find((s) => s.id === sel);
  const grouped = useMemo(() => {
    const g = new Map<string, typeof situations>();
    situations.forEach((s) => { const k = cat(s.category_id)?.name ?? 'Other'; g.set(k, [...(g.get(k) ?? []), s]); });
    return [...g.entries()];
  }, [situations, cat]);

  if (situation) return <Results situationId={situation.id} label={situation.label} onBack={() => setSel(null)} />;
  return (
    <div>
      <PageHeader eyebrow="Connection" title="Find someone who understands" subtitle="Choose what describes you right now. We’ll show you experiences — and the women who’ve chosen to share theirs." />
      <div className="space-y-6">
        {grouped.map(([name, list]) => (
          <section key={name}><h2 className="eyebrow mb-2.5 text-ink-muted">{name}</h2>
            <div className="space-y-2">{list.map((s) => (
              <button key={s.id} onClick={() => setSel(s.id)} className="card flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:-translate-y-px hover:shadow-lift">
                <span className="font-display text-[17px] leading-snug text-plum-950">{s.label}</span><Search size={17} className="shrink-0 text-ink-faint" />
              </button>))}</div>
          </section>
        ))}
        {!situations.length && <Spinner />}
      </div>
      <Visibility />
    </div>
  );
}

function Results({ situationId, label, onBack }: { situationId: string; label: string; onBack: () => void }) {
  const { data: people, loading, error } = useAsync(() => api.findUnderstanders(situationId), [situationId]);
  const [target, setTarget] = useState<Understander | null>(null);
  return (
    <div>
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-plum-800"><ChevronLeft size={16} />Change situation</button>
      <PageHeader eyebrow="You said" title={<span className="italic">“{label}”</span>} />
      <section className="mb-10">
        <h2 className="mb-1 text-xl font-semibold">Women who’ve opted in to share</h2>
        <p className="mb-4 text-sm text-ink-muted">Each of these members chose to be discoverable for this situation. Requesting a chat is not a promise — she decides.</p>
        {loading ? <Spinner label="Looking" /> : error ? <Notice tone="danger">{error}</Notice> : people?.length ? (
          <ul className="space-y-3">{people.map((p) => (
            <li key={p.user_id} className="card p-4">
              <div className="flex items-start gap-3">
                <Avatar motif={p.avatar_motif} tone={p.avatar_tone} size={44} />
                <div className="min-w-0 flex-1">
                  <Link to={`/u/${p.username}`} className="flex items-center gap-1 font-semibold text-plum-900 hover:underline">@{p.username}{p.verified && <VerifiedBadge />}</Link>
                  {p.note && <p className="mt-1 font-display text-[15px] italic leading-snug text-ink-soft">“{p.note}”</p>}
                  {p.bio && <p className="mt-1.5 line-clamp-2 text-[13px] text-ink-muted">{p.bio}</p>}
                </div>
              </div>
              <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => setTarget(p)}><MessageSquarePlus size={16} />Request a private conversation</Button>
            </li>))}</ul>
        ) : <EmptyState icon={<HeartHandshake size={22} />} title="No one has opted in yet">Members only appear here if they’ve chosen to be found. Meanwhile, the experiences below may help — or ask the community.</EmptyState>}
      </section>
      <section>
        <h2 className="mb-3 text-xl font-semibold">Experiences from the community</h2>
        <PostList query={{ situationId }} empty={<EmptyState title="No tagged experiences yet" action={<Link to={`/share/ask?situation=${situationId}`} className="btn-primary btn-sm">Ask about this</Link>}>Share what you’ve learned, or ask a question and tag this situation.</EmptyState>} />
      </section>
      {target && <RequestDialog open onClose={() => setTarget(null)} recipient={{ id: target.user_id, username: target.username }} contextSituationId={situationId} prompt={`Hi — I’m ${label.replace(/^I'm /, '').replace(/^I’m /, '')}. I saw you’ve been through something similar and would really value hearing how it went for you…`} />}
    </div>
  );
}

/** Opt-in panel: being discoverable is OFF by default and entirely voluntary. */
function Visibility() {
  const { me, refresh } = useAuth(); const toast = useToast(); const { situations } = useTaxonomy();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(me?.settings.discoverable_note ?? '');
  const [picked, setPicked] = useState<string[]>(me?.situation_ids ?? []);
  if (!me) return null;
  const on = me.settings.discoverable;
  const save = async (discoverable: boolean) => {
    try { await api.updateSettings({ discoverable, discoverable_note: note.trim() || null }); await api.setMySituations(picked); await refresh(); toast(discoverable ? 'You’re now discoverable for the situations you chose' : 'You’re no longer discoverable'); }
    catch (e) { toast(errorMessage(e), 'error'); }
  };
  return (
    <section className="mt-10 rounded-3xl border border-plum-200 bg-plum-50/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Been through something yourself?</h2><p className="mt-1 text-sm text-ink-muted">You can choose to be found by women facing what you’ve faced. It’s completely optional and off by default.</p></div>
        <Button size="sm" variant={on ? 'primary' : 'secondary'} onClick={() => setOpen((o) => !o)}>{on ? 'Discoverable' : 'Set up'}</Button>
      </div>
      {open && (
        <div className="mt-5 space-y-4">
          <div>
            <p className="label">Situations I’m happy to talk about</p>
            <div className="flex flex-wrap gap-2">{situations.map((s) => (
              <button key={s.id} type="button" aria-pressed={picked.includes(s.id)} onClick={() => setPicked((p) => p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id])}
                className={cx('rounded-full border px-3 py-1.5 text-left text-[13px] font-semibold', picked.includes(s.id) ? 'border-plum-700 bg-plum-700 text-ivory-50' : 'border-ivory-400 bg-ivory-50 text-ink-soft')}>{s.label.replace(/^I[’']m /, '')}</button>))}</div>
          </div>
          <div><label className="label" htmlFor="dn">A short note (optional)</label><Textarea id="dn" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[72px]" placeholder="e.g. Moved abroad in 2023 — happy to share what I learned." /><div className="mt-1 text-right"><Counter value={note.length} max={200} /></div></div>
          <div className="rounded-2xl bg-ivory-50 px-4"><Switch checked={on} onChange={(v) => save(v)} label="Let members find me" description="Others see your username, avatar, note and (if your profile is public) bio — never your email or location." disabled={!picked.length && !on} /></div>
          {on && <Button variant="secondary" size="sm" onClick={() => save(true)}>Save changes</Button>}
          <p className="hint flex items-center gap-1.5"><EyeOff size={13} />Anyone can still decline or ignore requests, and you can switch this off at any time. You can also stop accepting requests entirely in Settings.</p>
          {me.settings.dm_permission === 'nobody' && <Notice tone="care">Your message requests are currently switched off, so you won’t be listed. Change this in Settings.</Notice>}
        </div>
      )}
    </section>
  );
}
