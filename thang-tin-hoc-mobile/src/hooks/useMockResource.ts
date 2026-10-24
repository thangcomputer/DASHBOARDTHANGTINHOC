import { useCallback, useEffect, useState } from 'react';

type ResourceState<T> = {
  data: T | null;
  loading: boolean;
  error: boolean;
  reload: () => void;
};

export function useMockResource<T>(loader: () => Promise<T>): ResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    loader()
      .then((result) => { if (active) setData(result); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loader, reloadKey]);

  return { data, loading, error, reload };
}
