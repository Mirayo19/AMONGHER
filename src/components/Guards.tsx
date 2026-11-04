import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/state/auth';
import { LogoMark } from './ui';
import type { Role } from '@/lib/types';

export function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4" role="status" aria-label="Loading AMONGHER">
      <div className="animate-pulse"><LogoMark size={48} /></div>
    </div>
  );
}

/** UX gate only. Real authorisation is enforced by Row Level Security in the database. */
export function RequireAuth() {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Splash />;
  if (!me) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (me.status === 'suspended' && loc.pathname !== '/suspended') return <Navigate to="/suspended" replace />;
  if (me.status === 'active' && !me.onboarded && loc.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

export function RequireRole({ roles }: { roles: Role[] }) {
  const { me } = useAuth();
  if (!me || !roles.includes(me.role)) return <Navigate to="/home" replace />;
  return <Outlet />;
}

export function PublicOnly() {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Splash />;
  if (me) {
    const from = (loc.state as { from?: string } | null)?.from;
    return <Navigate to={me.status === 'suspended' ? '/suspended' : me.onboarded ? from ?? '/home' : '/onboarding'} replace />;
  }
  return <Outlet />;
}
