/** Friendly, user-facing messages for the error codes raised by the database layer. */
const MESSAGES: Record<string, string> = {
  not_accepting: "This member isn't accepting message requests right now.",
  already_connected: 'You already have a conversation with her.',
  request_pending: 'There is already a pending request between you two — check your Requests tab.',
  recently_declined: "She didn't accept your last request. You can try again after 30 days.",
  rate_limited: "You're doing that a lot — please wait a little while and try again.",
  account_suspended: 'Your account is currently suspended.',
  invalid_recipient: "You can't do that with your own account.",
  cannot_report_self: "You can't report your own content.",
  post_unavailable: 'That post is no longer available.',
  invalid_parent: "You can't reply to that comment.",
  username_unavailable: 'That username is taken or reserved. Try another.',
  age_confirmation_required: 'You must confirm that you are 18 or older.',
  conversation_unavailable: "This conversation can't receive messages.",
  author_has_not_consented: "The author hasn't agreed to have this featured in the Library.",
  sensitive_post_needs_review: 'Sensitive posts must be reviewed and approved before they can be featured.',
  post_not_published: 'Only published posts can be featured.',
  forbidden: "You don't have permission to do that.",
  cannot_modify_self: "You can't change your own role or status.",
  cannot_modify_admin: "Administrators can't be suspended here.",
  'Invalid login credentials': 'Email or password is incorrect.',
  'Email not confirmed': 'Please confirm your email first — check your inbox.',
  'User already registered': 'An account with this email already exists. Try signing in.',
};

export class AppError extends Error {
  code: string;
  constructor(code: string, message?: string) { super(message ?? MESSAGES[code] ?? code); this.code = code; }
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  const raw = (e as { message?: string } | null)?.message ?? String(e);
  for (const key of Object.keys(MESSAGES)) if (raw.includes(key)) return new AppError(key);
  if (/permission denied|row-level security/i.test(raw)) return new AppError('forbidden');
  if (/duplicate key/i.test(raw)) return new AppError('duplicate', 'That already exists.');
  if (/Failed to fetch|NetworkError|network/i.test(raw)) return new AppError('network', "Can't reach the server. Check your connection and try again.");
  return new AppError('unknown', raw || 'Something went wrong. Please try again.');
}
export const errorMessage = (e: unknown) => toAppError(e).message;
