import { Link } from 'react-router-dom';
import { CheckCircle2, CircleDashed, ExternalLink } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/config';
import { useTitle } from '@/lib/hooks';
import { BrandLink, Notice } from '@/components/ui';
import { resetPreviewData } from '@/data/previewApi';

const Code = ({ children }: { children: string }) => <pre className="my-2 overflow-x-auto rounded-xl bg-plum-950 p-3.5 text-[12.5px] leading-relaxed text-plum-100"><code>{children}</code></pre>;

export default function Setup() {
  useTitle('Connect Supabase');
  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-5 pb-20 pt-6">
      <BrandLink />
      <h1 className="mt-8 text-3xl font-semibold">Connect Supabase</h1>
      <p className="mt-2 text-ink-muted">AMONGHER is built for Supabase (Auth, PostgreSQL with Row Level Security, Storage, Realtime). Until it’s connected, accounts and data are <strong>not</strong> real: the app runs in a clearly-labelled preview mode that keeps everything in your browser.</p>
      <div className="mt-5"><Notice tone={isSupabaseConfigured ? 'ok' : 'care'} title={isSupabaseConfigured ? 'Supabase is connected' : 'Currently in preview mode'}>
        {isSupabaseConfigured ? 'Environment variables were found; authentication and data are served by your Supabase project.' : 'No VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY found. Follow the steps below.'}
      </Notice></div>

      <ol className="mt-8 space-y-7">
        <li><h2 className="flex items-center gap-2 text-lg font-semibold">{isSupabaseConfigured ? <CheckCircle2 className="text-sage-500" size={20} /> : <CircleDashed className="text-ink-faint" size={20} />}1 · Create a project</h2>
          <p className="mt-1 text-sm text-ink-muted">At <a className="font-semibold text-plum-700 underline" href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">supabase.com/dashboard <ExternalLink size={12} className="inline" /></a> create a new project. Note the project URL and the <strong>anon (public)</strong> key from Project Settings → API.</p></li>
        <li><h2 className="text-lg font-semibold">2 · Run the migrations, in order</h2>
          <p className="mt-1 text-sm text-ink-muted">Paste each file from <code>supabase/migrations</code> into the SQL editor (or use the Supabase CLI: <code>supabase db push</code>):</p>
          <Code>{`0001_schema.sql      tables
0002_logic.sql       triggers, RPCs, helpers
0003_security.sql    views, Row Level Security, grants
0004_storage.sql     private evidence bucket
0005_additions.sql   edit post, message reports, data export
0006_relax_minimum_lengths.sql   no minimum post length`}</Code>
          <p className="text-sm text-ink-muted">Then run <code>supabase/seed.sql</code>, which adds categories, situations and empty collection shells only. <strong>It creates no members or posts.</strong></p></li>
        <li><h2 className="text-lg font-semibold">3 · Configure authentication</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>Authentication → Providers → Email: enable, and keep <strong>Confirm email</strong> on.</li>
            <li>Authentication → URL Configuration: set Site URL to your app URL and add <code>/login</code> and <code>/reset</code> to Redirect URLs.</li>
            <li>For production, connect your own SMTP provider (the built-in mailer is heavily rate-limited) and review CAPTCHA / rate-limit settings.</li>
          </ul></li>
        <li><h2 className="text-lg font-semibold">4 · Add the environment variables</h2>
          <Code>{`# .env.local  (see .env.example)
VITE_SUPABASE_URL=https://YOUR-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY`}</Code>
          <Notice tone="danger" title="Never use the service_role key here">Anything prefixed <code>VITE_</code> is shipped to every visitor’s browser. Only the anon key is safe; the service_role key bypasses all security.</Notice></li>
        <li><h2 className="text-lg font-semibold">5 · Create your first administrator</h2>
          <p className="mt-1 text-sm text-ink-muted">Sign up in the app, then in the SQL editor (which runs with elevated rights) promote that account. This is deliberately impossible from inside the app:</p>
          <Code>{`insert into public.user_roles (user_id, role)
select id, 'admin' from public.profiles where username = 'your_username';`}</Code></li>
        <li><h2 className="text-lg font-semibold">6 · Realtime</h2><p className="mt-1 text-sm text-ink-muted">Migration 0003 adds <code>messages</code> to the <code>supabase_realtime</code> publication. Row Level Security applies to realtime events too.</p></li>
      </ol>

      {!isSupabaseConfigured && (
        <div className="mt-10 border-t border-ivory-300 pt-6 text-sm text-ink-muted">
          <p><strong>Preview mode</strong> stores data only in this browser. The first account you create gets admin rights <em>in preview only</em>, so you can explore the dashboard.</p>
          <button className="mt-2 font-semibold text-clay-700 underline" onClick={() => { if (confirm('Erase all preview data in this browser?')) { resetPreviewData(); location.href = '/'; } }}>Erase preview data</button>
        </div>
      )}
      <p className="mt-8"><Link to="/" className="font-semibold text-plum-700 hover:underline">← Back to AMONGHER</Link></p>
    </div>
  );
}
