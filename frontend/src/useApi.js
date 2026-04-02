import { useState, useEffect, useCallback, useRef } from "react";

/**
 * useApi — fetches data automatically when the component mounts (or when deps change).
 * Returns { data, loading, error, refetch }.
 */
export function useApi(apiFn, deps = []) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const mountedRef             = useRef(true);

  const fetch = useCallback(async () => {
    if (!apiFn) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFn();
      if (mountedRef.current) setData(res.data);
    } catch (err) {
      if (mountedRef.current)
        setError(err?.response?.data?.detail || err.message || "Erreur réseau");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiFn, ...deps]);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    return () => { mountedRef.current = false; };
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

/**
 * useMutation — wraps a POST/PATCH/DELETE call.
 * Returns { mutate, loading, error }.
 * Call mutate(payload) to trigger; it returns the response data.
 */
export function useMutation(apiFn) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const mutate = useCallback(async (payload) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFn(payload);
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message || "Erreur";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiFn]);

  return { mutate, loading, error };
}
