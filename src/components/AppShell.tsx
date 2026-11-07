import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Compass, Feather, FlaskConical, Home, LifeBuoy, LogOut, Mail, Search, Settings, ShieldCheck, User } from 'lucide-react';
import { api } from '@/data/api';
import { isPreviewMode } from '@/lib/config';
import { useAuth } from '@/state/auth';
import { cx } from '@/lib/util';
import { Avatar, BrandLink, Menu, MenuItem } from './ui';

const NAV = [
  { to: '/home', label: 'Home', icon: Home, match: ['/home', '/post'] },
  { to: '/explore', label: 'Explore', icon: Compass, match: ['/explore', '/understand', '/wish'] },
  { to: '/share', label: 'Share', icon: Feather, match: ['/share'], center: true },
  { to: '/library', label: 'Library', icon: BookOpen, match: ['/library'] },
  { to: '/inbox', label: 'Inbox', icon: Mail, match: ['/inbox'] },
];

function useActive(match: string[]) {
  const { pathname } = useLocation();
  return match.some((m) => pathname === m || pathname.startsWith(m + '/'));
}

export function PreviewBanner() {
  if (!isPreviewMode) return null;
  return (
    <div className="bg-plum-950 px-4 py-2 text-center text-xs font-medium text-plum-100">
      <FlaskConical size={13} className="mr-1.5 inline -translate-y-px text-brass-300" />
      Preview mode. Supabase isn’t connected, so everything is stored only in this browser and no emails are sent.{' '}
      <Link to="/setup" className="font-bold text-brass-300 underline underline-offset-2">Connect Supabase</Link>
    </div>
  );
}

function BottomNavItem({ item, badge }: { item: (typeof NAV)[number]; badge: number }) {
  const active = useActive(item.match);
  const Icon = item.icon;
  if (item.center) {
    return (
      <NavLink to={item.to} aria-label="Share" className="relative -mt-5 flex flex-col items-center gap-1">
        <span className={cx('flex h-14 w-14 items-center justify-center rounded-full border-4 border-ivory-100 bg-plum-700 text-ivory-50 shadow-lift transition', active && 'bg-plum-900')}>
          <Icon size={24} strokeWidth={1.9} />
        </span>
        <span className={cx('text-[11px] font-bold', active ? 'text-plum-900' : 'text-ink-muted')}>{item.label}</span>
      </NavLink>
    );
  }
  return (
    <NavLink to={item.to} className="relative flex flex-col items-center gap-1 py-2.5" aria-current={active ? 'page' : undefined}>
      <span className={cx('relative flex h-7 w-12 items-center justify-center rounded-full transition', active ? 'bg-plum-100 text-plum-800' : 'text-ink-muted')}>
        <Icon size={21} strokeWidth={active ? 2.2 : 1.8} />
        {badge > 0 && <span className="absolute -right-0.5 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brass-500 px-1 text-[10px] font-bold text-white">{badge > 9 ? '9+' : badge}</span>}
      </span>
      <span className={cx('text-[11px] font-bold', active ? 'text-plum-900' : 'text-ink-muted')}>{item.label}</span>
    </NavLink>
  );
}

function SideNavItem({ item, badge }: { item: (typeof NAV)[number]; badge: number }) {
  const active = useActive(item.match); const Icon = item.icon;
  return (
    <NavLink to={item.to} className={cx('flex items-center gap-3 rounded-xl px-3.5 py-3 text-[15px] font-semibold transition',
      item.center ? 'bg-plum-700 text-ivory-50 shadow-soft hover:bg-plum-800' : active ? 'bg-plum-100 text-plum-900' : 'text-ink-soft hover:bg-plum-50')}>
      <Icon size={20} strokeWidth={1.9} />{item.label}
      {badge > 0 && <span className="ml-auto rounded-full bg-brass-500 px-2 py-0.5 text-[11px] font-bold text-white">{badge}</span>}
    </NavLink>
  );
}

export default function AppShell() {
  const { me, signOut } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [badge, setBadge] = useState(0);

  useEffect(() => {
    let live = true;
    const tick = () => api.inboxBadge().then((b) => live && setBadge(b.messages + b.requests)).catch(() => {});
    tick(); const t = setInterval(tick, 15000);
    return () => { live = false; clearInterval(t); };
  }, [pathname]);

  if (!me) return null;
  return (
    <div className="min-h-dvh">
      <PreviewBanner />
      <header className="sticky top-0 z-30 border-b border-ivory-300/70 bg-ivory-100/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <BrandLink to="/home" />
          <div className="flex items-center gap-1">
            <Link to="/explore?focus=search" aria-label="Search" className="rounded-full p-2 text-ink-muted hover:bg-plum-100/70 hover:text-plum-800"><Search size={20} /></Link>
            <Menu trigger={<Avatar motif={me.avatar_motif} tone={me.avatar_tone} size={30} />}>
              {(close) => (<>
                <div className="border-b border-ivory-300 px-4 pb-2.5 pt-2">
                  <p className="text-xs text-ink-muted">Logged in as</p>
                  <p className="truncate text-sm font-bold text-plum-900">@{me.username}</p>
                </div>
                <MenuItem to="/me" onClick={close} icon={<User size={17} />}>My profile</MenuItem>
                <MenuItem to="/settings" onClick={close} icon={<Settings size={17} />}>Settings & privacy</MenuItem>
                <MenuItem to="/safety-centre" onClick={close} icon={<LifeBuoy size={17} />}>Safety centre</MenuItem>
                {(me.role === 'admin' || me.role === 'moderator') && <MenuItem to="/admin" onClick={close} icon={<ShieldCheck size={17} />}>{me.role === 'admin' ? 'Admin dashboard' : 'Moderation'}</MenuItem>}
                <MenuItem danger icon={<LogOut size={17} />} onClick={async () => { close(); await signOut(); nav('/'); }}>Sign out</MenuItem>
              </>)}
            </Menu>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl gap-10 px-4 lg:grid lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,640px)_280px]">
        <aside className="sticky top-[4.5rem] hidden h-fit space-y-1 pt-6 lg:block" aria-label="Primary">
          {NAV.map((n) => <SideNavItem key={n.to} item={n} badge={n.to === '/inbox' ? badge : 0} />)}
          <p className="px-3.5 pt-6 text-[11px] leading-relaxed text-ink-faint">Learn from her. Share with her. Grow together.</p>
        </aside>
        <main className="mx-auto w-full max-w-2xl animate-rise pb-32 pt-5 lg:mx-0 lg:pb-16 lg:pt-6">
          <Outlet />
        </main>
        <aside className="sticky top-[4.5rem] hidden h-fit space-y-4 pt-6 xl:block" aria-label="Community">
          <div className="card p-5">
            <p className="eyebrow text-brass-700">Find someone who understands</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">Tell us what you’re going through and meet women who’ve chosen to share similar experiences.</p>
            <Link to="/understand" className="btn-secondary btn-sm mt-3">Start here</Link>
          </div>
          <div className="card p-5">
            <p className="eyebrow text-brass-700">Our promise</p>
            <ul className="mt-2 space-y-1.5 text-[13px] leading-snug text-ink-muted">
              <li>You choose who can message you.</li>
              <li>Your email is never shown to anyone.</li>
              <li>Reports are read by real people.</li>
            </ul>
            <Link to="/safety-centre" className="mt-3 inline-block text-[13px] font-semibold text-plum-700 hover:underline">Safety centre →</Link>
          </div>
        </aside>
      </div>

      <nav aria-label="Primary" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-ivory-300/80 bg-ivory-50/95 backdrop-blur-md lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-2">
          {NAV.map((n) => <BottomNavItem key={n.to} item={n} badge={n.to === '/inbox' ? badge : 0} />)}
        </div>
      </nav>
    </div>
  );
}
