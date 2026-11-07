import { useState } from 'react';
import { ExternalLink, LifeBuoy } from 'lucide-react';
import { api } from '@/data/api';
import type { ReportReason, ReportTarget } from '@/lib/types';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/state/toast';
import { Button, Notice, Sheet, Textarea } from './ui';

/** Extra-care notice for health / abuse / harassment / personal-safety content. */
export function SafetyNotice({ crisis, compact }: { crisis?: boolean; compact?: boolean }) {
  return (
    <Notice tone={crisis ? 'danger' : 'care'} title={crisis ? 'If you might act on thoughts of harming yourself' : 'A gentle note on sensitive topics'}>
      {crisis ? (
        <>Please contact your local emergency number or a crisis line right now. You don’t have to carry this alone.{' '}
          <a className="font-semibold underline" href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">Find a free helpline in your country <ExternalLink size={12} className="inline" /></a></>
      ) : (
        <>
          Community experiences are personal stories, <strong>not medical, legal or professional advice</strong>.
          {!compact && <> If you are in immediate danger, contact your local emergency services.</>}{' '}
          <a className="font-semibold underline" href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">Find a helpline <LifeBuoy size={12} className="inline" /></a>
        </>
      )}
    </Notice>
  );
}

export const REPORT_REASONS: { id: ReportReason; label: string; hint: string }[] = [
  { id: 'harassment', label: 'Harassment or bullying', hint: 'Targeting, shaming or repeated unwanted contact' },
  { id: 'abuse_or_threats', label: 'Threats or abuse', hint: 'Violence, intimidation or coercion' },
  { id: 'self_harm', label: 'Self-harm or someone at risk', hint: 'Someone may be in danger. We prioritise these' },
  { id: 'unsafe_advice', label: 'Unsafe or harmful advice', hint: 'Health or safety guidance that could hurt someone' },
  { id: 'privacy', label: 'Shares private information', hint: 'Names, contact details, photos or identifying details' },
  { id: 'hate', label: 'Hate or discrimination', hint: '' },
  { id: 'misinformation', label: 'Misinformation', hint: '' },
  { id: 'impersonation', label: 'Impersonation', hint: 'Pretending to be staff or someone else' },
  { id: 'spam', label: 'Spam or selling', hint: '' },
  { id: 'other', label: 'Something else', hint: '' },
];

export function ReportDialog({ open, onClose, type, targetId, label }: { open: boolean; onClose: () => void; type: ReportTarget; targetId: string; label: string }) {
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const close = () => { onClose(); setTimeout(() => { setReason(null); setDetails(''); setDone(false); setErr(null); }, 200); };
  const submit = async () => {
    if (!reason) return;
    setBusy(true); setErr(null);
    try { await api.report({ type, targetId, reason, details: details.trim() || undefined }); setDone(true); toast('Report sent to our moderators'); }
    catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onClose={close} title={`Report ${label}`} footer={done
      ? <Button onClick={close}>Done</Button>
      : <><Button variant="quiet" onClick={close}>Cancel</Button><Button loading={busy} disabled={!reason} onClick={submit}>Send report</Button></>}>
      {done ? (
        <div className="space-y-3 text-[15px] leading-relaxed text-ink-soft">
          <p className="font-semibold text-plum-900">Thank you. This helps keep AMONGHER safe.</p>
          <p>A moderator will review your report. They won’t tell the other person who reported them. If you’d rather not see this member again, you can also block them from their profile or the menu.</p>
          {reason === 'self_harm' && <SafetyNotice crisis />}
        </div>
      ) : (
        <div className="space-y-4">
          <fieldset>
            <legend className="label">What’s wrong?</legend>
            <div className="space-y-2">
              {REPORT_REASONS.map((r) => (
                <label key={r.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${reason === r.id ? 'border-plum-400 bg-plum-50' : 'border-ivory-400/70 bg-ivory-50'}`}>
                  <input type="radio" name="reason" className="mt-1 accent-plum-700" checked={reason === r.id} onChange={() => setReason(r.id)} />
                  <span><span className="block text-sm font-semibold text-ink">{r.label}</span>{r.hint && <span className="block text-xs text-ink-muted">{r.hint}</span>}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label className="label" htmlFor="rd">Anything we should know? <span className="font-normal text-ink-faint">(optional)</span></label>
            <Textarea id="rd" value={details} maxLength={1000} onChange={(e) => setDetails(e.target.value)} className="min-h-[88px]" placeholder="Add context that helps a moderator understand." />
          </div>
          {type === 'conversation' && <p className="hint">The most recent messages you can see in this conversation will be attached for the moderator. Nothing else from your inbox is shared.</p>}
          {err && <p role="alert" className="text-sm font-medium text-clay-700">{err}</p>}
        </div>
      )}
    </Sheet>
  );
}
