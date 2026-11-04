import type { Tone } from './types';

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(1, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return `${m}m`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h`;
  const d = Math.round(h / 24); if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d > 300 ? 'numeric' : undefined });
}
export const fullDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');
export const toneClass = (t: Tone | string | undefined) => `tone-${t ?? 'plum'}`;

export const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

/** Mirrors the server-side keyword list (see posts_before_insert) purely to show the notice early. */
const SENSITIVE_RE = /\b(abus(e|ed|ive|er)|assault(ed)?|rape(d)?|harass(ed|ment|ing)?|stalk(ed|er|ing)?|domestic violence|self[- ]?harm|suicid(e|al)|kill myself|violen(t|ce)|threat(en|ened|ening)?|unsafe|trafficking|coerc(ed|ion|ive)|controlling partner|blackmail|revenge porn)\b/i;
export const looksSensitive = (text: string) => SENSITIVE_RE.test(text);
const CRISIS_RE = /\b(suicid(e|al)|kill myself|self[- ]?harm|end my life|want to die)\b/i;
export const looksLikeCrisis = (text: string) => CRISIS_RE.test(text);

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout>;
  return (...a: A) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
