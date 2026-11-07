import { useState } from 'react';
import { api } from '@/data/api';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/state/toast';
import { Button, Counter, Notice, Sheet, Textarea } from './ui';

/** Sends a private message request. Nothing is delivered as a message until she accepts. */
export default function RequestDialog({ open, onClose, recipient, contextPostId, contextSituationId, prompt }: {
  open: boolean; onClose: () => void; recipient: { id: string; username: string }; contextPostId?: string | null; contextSituationId?: string | null; prompt?: string;
}) {
  const toast = useToast();
  const [intro, setIntro] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [sent, setSent] = useState(false);
  const close = () => { onClose(); setTimeout(() => { setSent(false); setIntro(''); setErr(null); }, 200); };
  const send = async () => {
    setBusy(true); setErr(null);
    try { await api.sendRequest({ recipientId: recipient.id, intro, contextPostId, contextSituationId }); setSent(true); toast('Request sent'); }
    catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={close} title={sent ? 'Request sent' : `Message @${recipient.username}`}
      footer={sent ? <Button onClick={close}>Done</Button> : <><Button variant="quiet" onClick={close}>Cancel</Button><Button loading={busy} disabled={intro.trim().length < 1} onClick={send}>Send request</Button></>}>
      {sent ? (
        <p className="text-[15px] leading-relaxed text-ink-soft">She’ll see your note and can accept or decline, and she’s never obliged to. If she accepts, your private conversation opens in your Inbox. You won’t be told if she declines more than “not accepted”.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-ink-muted">Write a short, kind introduction. She only sees your username, your avatar and this note, never your email.</p>
          <div>
            <Textarea value={intro} onChange={(e) => setIntro(e.target.value)} maxLength={500} placeholder={prompt ?? 'Hi, I read what you shared and I’d love to ask you a little about it…'} className="min-h-[120px]" aria-label="Introduction" />
            <div className="mt-1 text-right"><Counter value={intro.length} max={500} /></div>
          </div>
          <Notice tone="info">Please don’t share contact details, your location or anything identifying in your first note.</Notice>
          {err && <p role="alert" className="text-sm font-medium text-clay-700">{err}</p>}
        </div>
      )}
    </Sheet>
  );
}
