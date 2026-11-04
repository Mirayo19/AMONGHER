import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '@/data/api';
import type { Me } from '@/lib/types';

interface AuthState { me: Me | null; loading: boolean; refresh: () => Promise<void>; signOut: () => Promise<void> }
const Ctx = createContext<AuthState>({ me: null, loading: true, refresh: async () => {}, signOut: async () => {} });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try { setMe(await api.getMe()); } catch { setMe(null); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); return api.onAuthChange(() => { void refresh(); }); }, [refresh]);

  const signOut = useCallback(async () => { await api.signOut(); setMe(null); }, []);
  const value = useMemo(() => ({ me, loading, refresh, signOut }), [me, loading, refresh, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
