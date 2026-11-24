import { useState, useEffect, useCallback, useRef } from "react";

export function usePolling(fetchFn, intervalMs, deps = []) {
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const mountedRef = useRef(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stable = useCallback(fetchFn, deps);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const run = useCallback(async () => {
    try {
      const result = await stable();
      if (!mountedRef.current) return;
      setData(result);
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      if (mountedRef.current) setError(e.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [stable]);

  useEffect(() => {
    run();
    const id = setInterval(run, intervalMs);
    return () => clearInterval(id);
  }, [run, intervalMs]);

  return { data, loading, error, lastUpdated, refresh: run };
}
