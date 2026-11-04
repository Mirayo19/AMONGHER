import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BadgeCheck, Clock, LogOut, ShieldCheck, Trash2, UserX } from 'lucide-react';
import { api } from '@/data/api';
import { isPreviewMode } from '@/lib/config';
import { errorMessage } from '@/lib/errors';
import { useAsync, useTitle } from '@/lib/hooks';
import type { AvatarMotif, DmPermission, Visibility } from '@/lib/types';
import { useAuth } from '@/state/auth';
import { useTaxonomy } from '@/state/taxonomy';
import { useToast } from '@/state/toast';
import AvatarPicker from '@/components/AvatarPicker';
import { Avatar, Button, Chip, ConfirmSheet, Counter, Field, Input, Notice, PageHeader, Switch, Textarea } from '@/components/ui';

const Section = ({ title, desc, children, id }: { title: string; desc?: ReactNode; children: ReactNode; id?: string }) => (
  <section id={id} className="card p-5 sm:p-6"><h2 className="text-xl font-semibold">{title}</h2>{desc && <p className="mt-1 text-sm text-ink-muted">{desc}</p>}<div className="mt-4">{children}</div></section>
);

export default function Settings() {
  useTitle('Settings');
  const { me, refresh, signOut } = useAuth(); const toast = useToast(); const nav = useNavigate();
  const { categories } = useTaxonomy();
  const [motif, setMotif] = useState<AvatarMotif>('ring'); const [tone, setTone] = useState(0);
  const [bio, setBio] = useState(''); const [loc, setLoc] = useState(''); const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(false); const [delText, setDelText] = useState('');
  const [pw, setPw] = useState(''); const [pwBusy, setPwBusy] = useState(false);
  useEffect(() => { if (me) { setMotif(me.avatar_motif); setTone(me.avatar_tone); setBio(me.bio ?? ''); setLoc(me.location ?? ''); setInterests(me.interests); } }, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const blocked = useAsync(() => api.listBlocked(), []);
  const verification = useAsync(() => api.getMyVerification(), []);
  if (!me) return null;
  const st = me.settings;
  const patchSettings = async (p: Parameters<typeof api.updateSettings>[0], msg = 'Saved') => { try { await api.updateSettings(p); await refresh(); toast(msg); } catch (e) { toast(errorMessage(e), 'error'); } };

  const saveProfile = async () => {
    setSaving(true);
    try { await api.updateProfile({ avatar_motif: motif, avatar_tone: tone, bio: bio.trim() || null, location: loc.trim() || null, interests }); await refresh(); toast('Profile updated'); }
    catch (e) { toast(errorMessage(e), 'error'); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={`@${me.username}`} title="Settings & privacy" />

      <Section title="Your profile" desc="Everything here is optional. No real name or photo is ever required.">
        <div className="space-y-5">
          <AvatarPicker motif={motif} tone={tone} onChange={(m, t) => { setMotif(m); setTone(t); }} />
          <Field label="Bio" htmlFor="bio" hint={<Counter value={bio.length} max={280} />}><Textarea id="bio" maxLength={280} value={bio} onChange={(e) => setBio(e.target.value)} className="min-h-[84px]" /></Field>
          <Field label="Location" htmlFor="loc" hint="Shown on your profile if it’s visible. A city or country is plenty."><Input id="loc" maxLength={60} value={loc} onChange={(e) => setLoc(e.target.value)} /></Field>
          <div><p className="label">Interests</p><div className="flex flex-wrap gap-2">{categories.map((c) => <Chip key={c.id} active={interests.includes(c.slug)} onClick={() => setInterests((s) => s.includes(c.slug) ? s.filter((x) => x !== c.slug) : [...s, c.slug])}>{c.name}</Chip>)}</div></div>
          <Button loading={saving} onClick={saveProfile}>Save profile</Button>
        </div>
      </Section>

      <Section title="Privacy & messaging" desc="You’re in control of who can see and contact you.">
        <div className="divide-y divide-ivory-300">
          <Switch checked={me.visibility === 'members'} label="Show bio, location and interests" description="When off, other members see only your username and avatar."
            onChange={async (v) => { try { await api.updateProfile({ visibility: (v ? 'members' : 'private') as Visibility }); await refresh(); toast('Profile visibility updated'); } catch (e) { toast(errorMessage(e), 'error'); } }} />
          <Switch checked={st.dm_permission === 'everyone'} label="Allow message requests" description="Members can ask to chat. You still choose whether to accept every request."
            onChange={(v) => patchSettings({ dm_permission: (v ? 'everyone' : 'nobody') as DmPermission })} />
          <Switch checked={st.discoverable} label="Be discoverable in “Find someone who understands”" description={<>Off by default. Choose situations in <Link to="/understand" className="font-semibold underline">Find someone who understands</Link>.</>}
            onChange={(v) => patchSettings({ discoverable: v }, v ? 'You may now appear for the situations you chose' : 'You are no longer discoverable')} disabled={!st.discoverable && !me.situation_ids.length} />
        </div>
        {!st.discoverable && !me.situation_ids.length && <p className="hint">To turn this on, pick the situations you’re happy to talk about first.</p>}
      </Section>

      <Section title="Notifications" desc="Controls the unread badges on your Inbox.">
        <div className="divide-y divide-ivory-300">
          <Switch checked={st.notify_requests} label="New message requests" onChange={(v) => patchSettings({ notify_requests: v })} />
          <Switch checked={st.notify_messages} label="New messages" description="You can also mute individual conversations from their menu." onChange={(v) => patchSettings({ notify_messages: v })} />
        </div>
        <p className="hint">These control in-app badges only. Email and push notifications aren’t available yet.</p>
      </Section>

      <Section title="Blocked members" desc="Blocked members can’t see your posts, find your profile or message you.">
        {blocked.loading ? null : blocked.data?.length ? (
          <ul className="divide-y divide-ivory-300">{blocked.data.map((b) => (
            <li key={b.user_id} className="flex items-center gap-3 py-2.5"><Avatar motif={b.avatar_motif} tone={b.avatar_tone} size={34} /><span className="flex-1 text-sm font-semibold">@{b.username}</span>
              <Button size="sm" variant="secondary" onClick={async () => { await api.setBlock(b.user_id, false); toast('Unblocked'); void blocked.reload(true); }}>Unblock</Button></li>))}</ul>
        ) : <p className="flex items-center gap-2 text-sm text-ink-muted"><UserX size={16} />You haven’t blocked anyone.</p>}
      </Section>

      <Verification v={verification.data} reload={() => verification.reload(true)} />

      <Section title="Account & safety" id="account">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-ink-muted">Email</dt><dd className="truncate font-semibold">{me.email} <span className="font-normal text-ink-muted">(private)</span></dd></div>
          <div className="flex justify-between gap-4"><dt className="text-ink-muted">Age</dt><dd className="font-semibold">18+ self-declared</dd></div>
        </dl>
        <Notice tone="info" className="mt-4">You confirmed you’re 18 or older at sign-up. This is a declaration — AMONGHER does not independently verify age, and doesn’t claim to.</Notice>
        <form className="mt-5 flex items-end gap-2" onSubmit={async (e) => { e.preventDefault(); setPwBusy(true); try { await api.updatePassword(pw); setPw(''); toast('Password changed'); } catch (ex) { toast(errorMessage(ex), 'error'); } finally { setPwBusy(false); } }}>
          <div className="flex-1"><Field label="Change password" htmlFor="npw"><Input id="npw" type="password" autoComplete="new-password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (8+ characters)" /></Field></div>
          <Button type="submit" variant="secondary" loading={pwBusy} disabled={pw.length < 8}>Update</Button>
        </form>
        <div className="mt-6 flex flex-wrap gap-2 border-t border-ivory-300 pt-5">
          <Button variant="secondary" onClick={async () => { await signOut(); nav('/'); }}><LogOut size={16} />Sign out</Button>
          <Button variant="quiet" className="text-clay-700 hover:bg-clay-100" onClick={() => setDel(true)}><Trash2 size={16} />Delete my account</Button>
        </div>
        {isPreviewMode && <p className="hint mt-3">Preview mode: your data is stored only in this browser.</p>}
      </Section>

      <ConfirmSheet open={del} onClose={() => setDel(false)} title="Delete your account?" confirmLabel="Delete forever" danger
        onConfirm={async () => { if (delText !== me.username) { toast('Type your username to confirm', 'error'); return; } try { await api.deleteAccount(); toast('Your account has been deleted'); nav('/'); } catch (e) { toast(errorMessage(e), 'error'); } }}>
        <p>This permanently deletes your profile, posts, comments, saved items and settings. Messages you sent stay in other members’ conversations but are no longer linked to you. This can’t be undone.</p>
        <div className="mt-4"><Field label={`Type ${me.username} to confirm`}><Input value={delText} onChange={(e) => setDelText(e.target.value)} autoComplete="off" /></Field></div>
      </ConfirmSheet>
    </div>
  );
}

function Verification({ v, reload }: { v: Awaited<ReturnType<typeof api.getMyVerification>> | null; reload: () => void }) {
  const { me } = useAuth(); const toast = useToast();
  const [statement, setStatement] = useState(''); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false);
  if (!me) return null;
  const submit = async () => {
    setBusy(true);
    try { await api.requestVerification(statement.trim(), file); setStatement(''); setFile(null); toast('Request sent to the team'); reload(); } catch (e) { toast(errorMessage(e), 'error'); } finally { setBusy(false); }
  };
  return (
    <Section title="Verified contributor" desc="A badge that tells members a person on our team has reviewed your relevant experience or expertise (for example, a midwife answering birth questions).">
      {me.verified_contributor ? <p className="flex items-center gap-2 text-sm font-semibold text-sage-700"><BadgeCheck size={18} />You’re a verified contributor.</p>
        : v?.status === 'pending' ? <p className="flex items-center gap-2 text-sm text-ink-muted"><Clock size={16} />Your request is awaiting review.</p>
        : (<div className="space-y-4">
          {v?.status === 'rejected' && <Notice tone="care" title="Your last request wasn’t approved">{v.reviewer_note ?? 'You’re welcome to apply again with more detail.'}</Notice>}
          <Field label="Tell us about your experience or expertise" htmlFor="vs" hint={<Counter value={statement.length} max={1000} />}><Textarea id="vs" maxLength={1000} value={statement} onChange={(e) => setStatement(e.target.value)} className="min-h-[96px]" placeholder="e.g. I’m a registered midwife with ten years’ experience…" /></Field>
          <Field label="Supporting document (optional)" htmlFor="vf" hint={isPreviewMode ? 'Files are not stored in preview mode.' : 'JPG, PNG or PDF up to 5 MB. Stored privately — only you and administrators can open it.'}>
            <input id="vf" type="file" accept="image/jpeg,image/png,application/pdf" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f && f.size > 5 * 1024 * 1024 ? (toast('File must be under 5 MB', 'error'), null) : f); }} className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-plum-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-plum-800" />
          </Field>
          <p className="hint flex items-start gap-1.5"><ShieldCheck size={14} className="mt-0.5 shrink-0" />A person reads every request. This badge is not an identity or age check.</p>
          <Button loading={busy} disabled={statement.trim().length < 20} onClick={submit}>Submit for review</Button>
        </div>)}
    </Section>
  );
}
