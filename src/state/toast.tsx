import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { uid } from '@/lib/util';

type Kind = 'ok' | 'error';
interface T { id: string; msg: string; kind: Kind }
const Ctx = createContext<{ toast: (msg: string, kind?: Kind) => void }>({ toast: () => {} });
export const useToast = () => useContext(Ctx).toast;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const toast = useCallback((msg: string, kind: Kind = 'ok') => {
    const id = uid(); setItems((s) => [...s, { id, msg, kind }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3200);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-8">
        {items.map((t) => (
          <div key={t.id} role="status" className={`pointer-events-auto flex max-w-md animate-rise items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-lift ${t.kind === 'error' ? 'bg-clay-700 text-white' : 'bg-plum-900 text-ivory-50'}`}>
            {t.kind === 'error' ? <AlertCircle size={18} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-brass-300" />}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
