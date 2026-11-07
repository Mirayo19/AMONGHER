const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True for keys that must never reach a browser: `sb_secret_…` keys and legacy service_role JWTs. */
function isSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  try { return JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role'; } catch { return false; }
}

if (anon && isSecretKey(anon)) {
  // Refuse to run rather than ship a key that bypasses every security rule to every visitor.
  throw new Error('VITE_SUPABASE_ANON_KEY contains a SECRET key. Use the public anon/publishable key and rotate the one you exposed.');
}

/** Only the project URL and the public anon/publishable key ever reach the browser. */
export const supabaseConfig = url && anon && !url.includes('YOUR-PROJECT') ? { url, anon } : null;
export const isSupabaseConfigured = supabaseConfig !== null;
export const isPreviewMode = !isSupabaseConfigured;
