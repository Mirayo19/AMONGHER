const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Only the project URL and the public anon key ever reach the browser. */
export const supabaseConfig = url && anon && !url.includes('YOUR-PROJECT') ? { url, anon } : null;
export const isSupabaseConfigured = supabaseConfig !== null;
export const isPreviewMode = !isSupabaseConfigured;
