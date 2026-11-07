import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from './errors';

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const run = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(async (silent = false) => {
    const id = ++run.current;
    if (!silent) setLoading(true);
    try {
      const d = await fnRef.current();
      if (id === run.current) { setData(d); setError(null); }
    } catch (e) {
      if (id === run.current) setError(errorMessage(e));
    } finally {
      if (id === run.current) setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void reload(); }, deps);
  return { data, setData, error, loading, reload };
}

export function useTitle(title: string) {
  useEffect(() => { document.title = title ? `${title} · AMONGHER` : 'AMONGHER · Learn from her. Share with her.'; }, [title]);
}
