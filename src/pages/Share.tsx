import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BookOpen, ChevronLeft, EyeOff, HeartHandshake, MessageCircleQuestion, Quote, Sparkles } from 'lucide-react';
import { api } from '@/data/api';
import { errorMessage } from '@/lib/errors';
import { useTitle } from '@/lib/hooks';
import type { PostKind } from '@/lib/types';
import { cx, looksLikeCrisis, looksSensitive } from '@/lib/util';
import { useAuth } from '@/state/auth';
import { useTaxonomy } from '@/state/taxonomy';
import { useToast } from '@/state/toast';
import { SafetyNotice } from '@/components/Safety';
import { AnonymousAvatar, Avatar, Button, CategoryIcon, Chip, Counter, Field, Input, PageHeader, Select, Switch, Textarea } from '@/components/ui';
import { toneClass } from '@/lib/util';

export default function Share() {
  useTitle('Share');
  const options = [
    { to: '/share/experience', icon: BookOpen, title: 'Share an experience', text: 'Tell what happened and what it taught you.', accent: 'bg-plum-700 text-ivory-50' },
    { to: '/share/ask', icon: MessageCircleQuestion, title: 'Ask a question', text: 'Ask anonymously. Mark the answers that help.', accent: 'bg-sage-500 text-white' },
    { to: '/share/wish', icon: Quote, title: 'I wish I knew…', text: 'The lesson you wish you’d had earlier.', accent: 'bg-brass-500 text-white' },
  ];
  return (
    <div>
      <PageHeader eyebrow="Contribute" title="What would you like to share?" subtitle="Everything you post can be anonymous. You decide, every time." />
      <div className="space-y-3">
        {options.map(({ to, icon: I, title, text, accent }) => (
          <Link key={to} to={to} className="card flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
            <span className={cx('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', accent)}><I size={24} strokeWidth={1.7} /></span>
            <div><h2 className="text-xl font-semibold">{title}</h2><p className="mt-0.5 text-sm text-ink-muted">{text}</p></div>
          </Link>
        ))}
        <Link to="/understand" className="flex items-center gap-3 rounded-2xl border border-dashed border-plum-300 px-5 py-4 text-sm font-semibold text-plum-800 transition hover:bg-plum-50">
          <HeartHandshake size={20} />Looking for someone who’s been through it? Find someone who understands
        </Link>
      </div>
    </div>
  );
}

const COPY: Record<PostKind, { title: string; sub: string; titlePh: string; bodyLabel: string; bodyPh: string; cta: string }> = {
  experience: { title: 'Share an experience', sub: 'Honest and specific helps most. What happened, what you did, what you’d tell her.', titlePh: 'In one line: what happened?', bodyLabel: 'Your story', bodyPh: 'Take your time. What did you learn, and what would you tell someone facing the same thing?', cta: 'Share experience' },
  question: { title: 'Ask the community', sub: 'No question is too small. Women who’ve been there will answer — and you can mark the answers that help.', titlePh: 'What would you like to ask?', bodyLabel: 'Add some detail', bodyPh: 'Context helps people answer well: your situation, what you’ve tried, what worries you.', cta: 'Post question' },
  wish: { title: 'I wish I knew…', sub: 'The lesson, the warning, the thing nobody told you.', titlePh: 'The one thing I wish I’d known…', bodyLabel: 'Why, and what you’d do differently', bodyPh: 'What happened, how it would have changed things, what you’d tell your younger self.', cta: 'Share what I learned' },
};

export function Composer({ kind }: { kind: PostKind }) {
  const copy = COPY[kind];
  useTitle(copy.title);
  const { me } = useAuth(); const nav = useNavigate(); const toast = useToast(); const [sp] = useSearchParams();
  const { categories, situations, wishTopics, ready } = useTaxonomy();
  const [categoryId, setCategoryId] = useState(''); const [topic, setTopic] = useState(sp.get('topic') ?? '');
  const [situationId, setSituationId] = useState(sp.get('situation') ?? '');
  const [title, setTitle] = useState(''); const [body, setBody] = useState('');
  const [anon, setAnon] = useState(kind === 'question'); const [curation, setCuration] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [anonTouched, setAnonTouched] = useState(false);

  useEffect(() => { const slug = sp.get('category'); if (slug && !categoryId) { const c = categories.find((x) => x.slug === slug); if (c) setCategoryId(c.id); } }, [categories, sp, categoryId]);
  const cat = categories.find((c) => c.id === categoryId);
  const text = `${title} ${body}`;
  const sensitive = !!cat?.sensitive || looksSensitive(text);
  const crisis = looksLikeCrisis(text);
  // Sensitive topics default to anonymous (until she chooses otherwise).
  useEffect(() => { if (sensitive && !anonTouched) setAnon(true); }, [sensitive, anonTouched]);
  const relevantSituations = useMemo(() => situations.filter((s) => !categoryId || s.category_id === categoryId), [situations, categoryId]);

  const valid = categoryId && title.trim().length >= 4 && body.trim().length >= 10 && (kind !== 'wish' || topic);
  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const id = await api.createPost({ kind, category_id: categoryId, title: title.trim(), body: body.trim(), wish_topic: kind === 'wish' ? topic : null, situation_id: situationId || null, is_anonymous: anon, allow_curation: kind !== 'question' && curation });
      toast('Posted — thank you for sharing'); nav(`/post/${id}`, { replace: true });
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };

  if (!ready) return null;
  return (
    <div>
      <Link to="/share" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-plum-800"><ChevronLeft size={16} />Share</Link>
      <PageHeader title={copy.title} subtitle={copy.sub} />
      <div className="space-y-6">
        {kind === 'wish' && (
          <Field label="I wish I’d known… (choose a theme)">
            <div className="scroll-x flex-wrap">{wishTopics.map((w) => <Chip key={w.slug} active={topic === w.slug} onClick={() => setTopic(w.slug)}>{w.label}</Chip>)}</div>
          </Field>
        )}
        <Field label="Category">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {categories.map((c) => (
              <button key={c.id} type="button" onClick={() => setCategoryId(c.id)} aria-pressed={categoryId === c.id}
                className={cx(toneClass(c.tone), 'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[13px] font-semibold transition', categoryId === c.id ? 't-bg t-fg border-[var(--t-fg)]' : 'border-ivory-300 bg-ivory-50 text-ink-soft hover:border-[var(--t-line)]')}>
                <span className="t-fg"><CategoryIcon name={c.icon} size={16} /></span>{c.name}
              </button>
            ))}
          </div>
        </Field>

        {sensitive && <SafetyNotice crisis={crisis} />}
        {crisis && <SafetyNotice />}

        <Field label="Title" htmlFor="t" hint={<Counter value={title.length} max={140} />}><Input id="t" maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={copy.titlePh} /></Field>
        <Field label={copy.bodyLabel} htmlFor="b" hint={<Counter value={body.length} max={5000} />}><Textarea id="b" maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} placeholder={copy.bodyPh} className="min-h-[200px]" /></Field>

        {!!relevantSituations.length && (
          <Field label="Is this about a specific situation? (optional)" htmlFor="s" hint="Tagging helps women in that situation find your post in “Find someone who understands”.">
            <Select id="s" value={situationId} onChange={(e) => setSituationId(e.target.value)}>
              <option value="">No specific situation</option>
              {relevantSituations.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </Field>
        )}

        <div className="card divide-y divide-ivory-300 px-5">
          <Switch checked={anon} onChange={(v) => { setAnon(v); setAnonTouched(true); }} label="Post anonymously"
            description="Your username and avatar are hidden from other members. Moderators can still see the account if the post is reported." />
          {kind !== 'question' && <Switch checked={curation} onChange={setCuration} label="Allow editors to feature this in the Library"
            description="Editors may add it to a curated collection after reviewing it. You can withdraw consent at any time, and deleting your post removes it." />}
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-plum-50 px-4 py-3 text-sm text-ink-soft">
          {anon ? <AnonymousAvatar size={32} /> : <Avatar motif={me?.avatar_motif} tone={me?.avatar_tone} size={32} />}
          <span>You’ll appear as <strong className="text-plum-900">{anon ? 'Anonymous' : `@${me?.username}`}</strong>{anon && <EyeOff size={14} className="ml-1.5 inline text-ink-muted" />}</span>
        </div>

        {err && <p role="alert" className="text-sm font-medium text-clay-700">{err}</p>}
        <Button size="lg" className="w-full" disabled={!valid} loading={busy} onClick={submit}><Sparkles size={18} />{copy.cta}</Button>
        <p className="hint text-center">By posting you agree to the <Link to="/safety#guidelines" className="underline">Community Guidelines</Link>. Don’t share anyone’s identifying details.</p>
      </div>
    </div>
  );
}

export function ComposerRoute() {
  const { kind } = useParams();
  const map: Record<string, PostKind> = { experience: 'experience', ask: 'question', wish: 'wish' };
  return map[kind ?? ''] ? <Composer key={kind} kind={map[kind!]} /> : <Navigate to="/share" replace />;
}
