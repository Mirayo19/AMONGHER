import type { AvatarMotif } from '@/lib/types';
import { cx } from '@/lib/util';
import { AVATAR_MOTIFS, AVATAR_TONE_COUNT, Avatar } from './ui';

export default function AvatarPicker({ motif, tone, onChange }: { motif: AvatarMotif; tone: number; onChange: (m: AvatarMotif, t: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
      <Avatar motif={motif} tone={tone} size={96} className="ring-4 ring-ivory-50 shadow-lift" />
      <div className="w-full space-y-4">
        <div>
          <p className="label">Motif</p>
          <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label="Avatar motif">
            {AVATAR_MOTIFS.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={m === motif} aria-label={m} onClick={() => onChange(m, tone)}
                className={cx('rounded-full p-0.5 transition', m === motif ? 'ring-2 ring-plum-600' : 'hover:ring-2 hover:ring-plum-200')}>
                <Avatar motif={m} tone={tone} size={36} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="label">Colour</p>
          <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label="Avatar colour">
            {Array.from({ length: AVATAR_TONE_COUNT }, (_, t) => (
              <button key={t} type="button" role="radio" aria-checked={t === tone} aria-label={`Colour ${t + 1}`} onClick={() => onChange(motif, t)}
                className={cx('rounded-full p-0.5 transition', t === tone ? 'ring-2 ring-plum-600' : 'hover:ring-2 hover:ring-plum-200')}>
                <Avatar motif="ring" tone={t} size={36} />
              </button>
            ))}
          </div>
        </div>
        <p className="hint">Avatars are generated shapes — you never need to upload a photo.</p>
      </div>
    </div>
  );
}
