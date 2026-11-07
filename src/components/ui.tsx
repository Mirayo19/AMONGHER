import {
  forwardRef, useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, BadgeCheck, Baby, Briefcase, GraduationCap, HeartPulse, Info, Loader2, Shield, ShieldCheck,
  Sparkles, Users, Wallet, X, type LucideIcon,
} from 'lucide-react';
import type { AvatarMotif, Category } from '@/lib/types';
import { cx, toneClass } from '@/lib/util';

/* ---------------------------------------------------------------- Brand */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#5e2c52" />
      <g fill="none" stroke="#fbf7f0" strokeWidth="4.5" strokeLinecap="round">
        <circle cx="25" cy="32" r="12" /><circle cx="39" cy="32" r="12" opacity=".7" />
      </g>
      <circle cx="32" cy="32" r="3.2" fill="#dcc08a" />
    </svg>
  );
}
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx('font-display text-[17px] font-semibold uppercase tracking-[0.2em] text-plum-900', className)}>
      Among<span className="text-brass-500">her</span>
    </span>
  );
}
export function BrandLink({ to = '/' }: { to?: string }) {
  return <Link to={to} className="flex items-center gap-2.5" aria-label="AMONGHER home"><LogoMark size={30} /><Wordmark /></Link>;
}

/* ---------------------------------------------------------------- Avatar (generated, never a photo) */
const AVATAR_TONES = [
  { bg: '#f3e8ef', fg: '#5e2c52' }, { bg: '#f7e8eb', fg: '#8b3a4f' }, { bg: '#e6edf5', fg: '#2f4f73' }, { bg: '#e6eee7', fg: '#3f5a48' },
  { bg: '#f8eadf', fg: '#8a4b25' }, { bg: '#ebeaf6', fg: '#44418a' }, { bg: '#f6eed9', fg: '#7a5a1d' }, { bg: '#2a1a26', fg: '#dcc08a' },
];
export const AVATAR_MOTIFS: AvatarMotif[] = ['ring', 'arc', 'petal', 'dots', 'wave', 'leaf', 'sun', 'knot'];
export const AVATAR_TONE_COUNT = AVATAR_TONES.length;

function Motif({ m, c }: { m: AvatarMotif; c: string }) {
  const s = { fill: 'none', stroke: c, strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (m) {
    case 'ring': return <g><circle cx="20" cy="20" r="9" {...s} /><circle cx="20" cy="20" r="2.6" fill={c} /></g>;
    case 'arc': return <g><path d="M9 25a11 11 0 0 1 22 0" {...s} /><path d="M14 25a6 6 0 0 1 12 0" {...s} /></g>;
    case 'petal': return <g fill={c} opacity=".92">{[0, 90, 180, 270].map((r) => <ellipse key={r} cx="20" cy="12.5" rx="3.6" ry="6" transform={`rotate(${r} 20 20)`} />)}</g>;
    case 'dots': return <g fill={c}>{[0, 1, 2].flatMap((x) => [0, 1, 2].map((y) => <circle key={`${x}${y}`} cx={11 + x * 9} cy={11 + y * 9} r={(x + y) % 2 ? 1.6 : 2.6} />))}</g>;
    case 'wave': return <g><path d="M8 14q3-4 6 0t6 0 6 0 6 0" {...s} /><path d="M8 21q3-4 6 0t6 0 6 0 6 0" {...s} /><path d="M8 28q3-4 6 0t6 0 6 0 6 0" {...s} /></g>;
    case 'leaf': return <g><path d="M12 28C10 17 17 10 29 11c1 11-6 18-17 17z" fill={c} opacity=".9" /><path d="M13 27L24 16" stroke="#fff" strokeOpacity=".6" strokeWidth="1.8" strokeLinecap="round" /></g>;
    case 'sun': return <g><circle cx="20" cy="20" r="5" fill={c} />{Array.from({ length: 8 }, (_, i) => <path key={i} d="M20 7.5v3.5" {...s} transform={`rotate(${i * 45} 20 20)`} />)}</g>;
    case 'knot': return <g><circle cx="16" cy="20" r="8" {...s} /><circle cx="24" cy="20" r="8" {...s} opacity=".6" /></g>;
  }
}
export function Avatar({ motif = 'ring', tone = 0, size = 40, className }: { motif?: AvatarMotif | null; tone?: number | null; size?: number; className?: string }) {
  const t = AVATAR_TONES[(tone ?? 0) % AVATAR_TONES.length];
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={cx('shrink-0 rounded-full', className)} role="img" aria-label="Member avatar">
      <rect width="40" height="40" fill={t.bg} /><Motif m={motif ?? 'ring'} c={t.fg} />
    </svg>
  );
}
export function AnonymousAvatar({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0 rounded-full" role="img" aria-label="Anonymous">
      <rect width="40" height="40" fill="#efe6d8" />
      <circle cx="20" cy="20" r="10" fill="none" stroke="#a2969c" strokeWidth="2" strokeDasharray="2.5 3.5" strokeLinecap="round" />
    </svg>
  );
}

/* ---------------------------------------------------------------- Category icons */
const ICONS: Record<string, LucideIcon> = {
  'heart-pulse': HeartPulse, users: Users, briefcase: Briefcase, wallet: Wallet, baby: Baby,
  'graduation-cap': GraduationCap, shield: Shield, sparkles: Sparkles,
};
export function CategoryIcon({ name, size = 20 }: { name: string; size?: number }) {
  const I = ICONS[name] ?? Sparkles; return <I size={size} strokeWidth={1.8} />;
}
export function CategoryPill({ cat, className }: { cat?: Category | null; className?: string }) {
  if (!cat) return null;
  return (
    <span className={cx(toneClass(cat.tone), 't-bg t-fg inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide', className)}>
      <CategoryIcon name={cat.icon} size={12} />{cat.name}
    </span>
  );
}
export function VerifiedBadge({ title = 'Verified contributor, reviewed by the AMONGHER team' }: { title?: string }) {
  return <span title={title} className="inline-flex text-brass-500"><BadgeCheck size={15} aria-label={title} /></span>;
}

/* ---------------------------------------------------------------- Buttons & fields */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet' | 'danger'; size?: 'sm' | 'md' | 'lg'; loading?: boolean };
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }, ref) {
  return (
    <button ref={ref} type="button" disabled={disabled || loading}
      className={cx(`btn-${variant}`, size === 'sm' && 'btn-sm', size === 'lg' && 'btn-lg', className)} {...rest}>
      {loading && <Loader2 size={16} className="animate-spin" />}{children}
    </button>
  );
});

export function Field({ label, hint, error, children, htmlFor }: { label?: string; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      {label && <label className="label" htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? <p role="alert" className="mt-1.5 text-xs font-medium text-clay-700">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cx('input', className)} {...p} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cx('input min-h-[120px] resize-y leading-relaxed', className)} {...p} />;
});
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx('input appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%237a6b73%27 stroke-width=%272%27><path d=%27m6 9 6 6 6-6%27/></svg>")] bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10', className)} {...p}>{children}</select>;
}
export function Counter({ value, max }: { value: number; max: number }) {
  return <span className={cx('text-xs tabular-nums', value > max * 0.9 ? 'text-clay-500' : 'text-ink-faint')}>{value}/{max}</span>;
}

export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[15px] font-semibold text-ink">{label}</label>
        {description && <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">{description}</p>}
      </div>
      <button id={id} type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50', checked ? 'bg-plum-600' : 'bg-ivory-400')}>
        <span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </div>
  );
}

export function Checkbox({ checked, onChange, children, error }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; error?: boolean }) {
  return (
    <label className={cx('flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm leading-snug', checked ? 'border-plum-300 bg-plum-50' : error ? 'border-clay-500/60 bg-clay-100/40' : 'border-ivory-400/70 bg-ivory-50')}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-plum-700" />
      <span className="text-ink-soft">{children}</span>
    </label>
  );
}

/* ---------------------------------------------------------------- Chips & tabs */
export function Chip({ active, onClick, children, tone, className }: { active?: boolean; onClick?: () => void; children: ReactNode; tone?: string; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cx('shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition',
        active ? 'border-plum-700 bg-plum-700 text-ivory-50' : 'border-ivory-400/80 bg-ivory-50 text-ink-soft hover:border-plum-300 hover:text-plum-800',
        tone && !active && toneClass(tone), className)}>
      {children}
    </button>
  );
}
export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; badge?: number }[] }) {
  return (
    <div role="tablist" className="scroll-x -mx-1 px-1">
      {items.map((i) => (
        <button key={i.id} role="tab" aria-selected={value === i.id} onClick={() => onChange(i.id)}
          className={cx('relative shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition',
            value === i.id ? 'bg-plum-900 text-ivory-50 shadow-soft' : 'text-ink-muted hover:bg-plum-100/70 hover:text-plum-800')}>
          {i.label}
          {!!i.badge && <span className="ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-brass-500 px-1 text-[10px] font-bold text-white">{i.badge}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Feedback */
export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-ink-muted"><Loader2 className="animate-spin" size={18} />{label}…</div>;
}
export function SkeletonCards({ n = 3 }: { n?: number }) {
  return <div className="space-y-3" aria-busy="true" aria-label="Loading">{Array.from({ length: n }, (_, i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}</div>;
}
export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-ivory-400 bg-ivory-50/60 px-6 py-10 text-center">
      {icon && <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-plum-100 text-plum-600">{icon}</div>}
      <h3 className="text-lg font-semibold">{title}</h3>
      {children && <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-muted">{children}</p>}
      {action && <div className="mt-4 flex justify-center gap-2">{action}</div>}
    </div>
  );
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-clay-500/30 bg-clay-100/50 p-5 text-center">
      <p className="text-sm font-medium text-clay-700">{message}</p>
      {onRetry && <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>Try again</Button>}
    </div>
  );
}
type NoticeTone = 'info' | 'care' | 'danger' | 'ok';
export function Notice({ tone = 'info', title, children, className }: { tone?: NoticeTone; title?: string; children: ReactNode; className?: string }) {
  const map = {
    info: ['border-plum-200 bg-plum-50 text-plum-900', Info],
    care: ['border-brass-300/70 bg-[#f8f1e1] text-[#5c4620]', ShieldCheck],
    danger: ['border-clay-500/40 bg-clay-100/60 text-clay-700', AlertTriangle],
    ok: ['border-sage-500/30 bg-sage-100 text-sage-700', ShieldCheck],
  } as const;
  const [cls, I] = map[tone];
  return (
    <div className={cx('flex gap-3 rounded-2xl border p-4 text-[13.5px] leading-relaxed', cls, className)}>
      <I size={18} className="mt-0.5 shrink-0" />
      <div>{title && <p className="mb-0.5 font-bold">{title}</p>}<div className="opacity-90">{children}</div></div>
    </div>
  );
}

/* ---------------------------------------------------------------- Sheet / modal */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  // Portal to <body>: the page's entrance animation creates a stacking context that would trap a fixed dialog beneath the nav.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade bg-plum-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={ref} tabIndex={-1} className="relative flex max-h-[92dvh] w-full max-w-lg animate-sheet flex-col rounded-t-3xl bg-ivory-100 shadow-lift outline-none sm:animate-rise sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-ivory-300 px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-ink-muted hover:bg-plum-100"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="pb-safe flex justify-end gap-2 border-t border-ivory-300 px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmSheet({ open, onClose, title, children, confirmLabel, danger, onConfirm }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title={title} footer={<>
      <Button variant="quiet" onClick={onClose}>Cancel</Button>
      <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>{confirmLabel}</Button>
    </>}>
      <div className="text-[15px] leading-relaxed text-ink-soft">{children}</div>
    </Sheet>
  );
}

/* ---------------------------------------------------------------- Popover menu */
export function Menu({ trigger, children, align = 'right' }: { trigger: ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="rounded-full p-2 text-ink-muted transition hover:bg-plum-100/70 hover:text-plum-800">{trigger}</button>
      {open && (
        <div role="menu" className={cx('absolute z-40 mt-1 w-56 animate-fade overflow-hidden rounded-2xl border border-ivory-300 bg-ivory-50 py-1.5 shadow-lift', align === 'right' ? 'right-0' : 'left-0')}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
export function MenuItem({ icon, children, onClick, danger, to }: { icon?: ReactNode; children: ReactNode; onClick?: () => void; danger?: boolean; to?: string }) {
  const cls = cx('flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium transition hover:bg-plum-50', danger ? 'text-clay-700' : 'text-ink-soft');
  return to
    ? <Link role="menuitem" to={to} onClick={onClick} className={cls}>{icon}{children}</Link>
    : <button role="menuitem" onClick={onClick} className={cls}>{icon}{children}</button>;
}

export function PageHeader({ title, subtitle, back, action, eyebrow }: { title: ReactNode; subtitle?: ReactNode; back?: ReactNode; action?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-5">
      {back}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-1 text-brass-700">{eyebrow}</p>}
          <h1 className="text-[28px] font-semibold leading-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-xl text-[15px] leading-relaxed text-ink-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}
