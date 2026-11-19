import { useCallback, useEffect, useRef, useState } from 'react';

type ResourceState<T> = {
  data: T | null;
  loading: boolean;
  error: boolean;
  errorMessage: string;
  reload: () => void;
  silentReload: () => void;
};

export function useMockResource<T>(loader: () => Promise<T>): ResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const dataRef = useRef<T | null>(null);
  dataRef.current = data;
  const silentNextRef = useRef(false);

  const reload = useCallback(() => {
    silentNextRef.current = false;
    setReloadKey((value) => value + 1);
  }, []);

  const silentReload = useCallback(() => {
    silentNextRef.current = dataRef.current !== null;
    setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const isSilent = silentNextRef.current && dataRef.current !== null;
    silentNextRef.current = false;
    if (!isSilent) {
      setLoading(true);
      setError(false);
      setErrorMessage('');
    }
    loader()
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(false);
        setErrorMessage('');
      })
      .catch((reason: unknown) => {
        if (!active || isSilent) return;
        setError(true);
        setErrorMessage(reason instanceof Error ? reason.message : 'Không thể tải nội dung. Vui lòng thử lại.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loader, reloadKey]);

  return { data, loading, error, errorMessage, reload, silentReload };
}
