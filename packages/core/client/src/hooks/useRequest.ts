import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseRequestOptions<T> {
  manual?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  defaultData?: T;
}

export interface UseRequestResult<T> {
  data?: T;
  loading: boolean;
  error?: Error;
  run: (...args: any[]) => Promise<void>;
  refresh: () => Promise<void>;
  mutate: (data: T | undefined) => void;
}

export function useRequest<T = any>(
  service: (...args: any[]) => Promise<T>,
  options: UseRequestOptions<T> = {},
): UseRequestResult<T> {
  const { manual = false, onSuccess, onError, defaultData } = options;

  const [data, setData] = useState<T | undefined>(defaultData);
  const [loading, setLoading] = useState(!manual);
  const [error, setError] = useState<Error | undefined>();

  const serviceRef = useRef(service);
  serviceRef.current = service;

  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const lastArgsRef = useRef<any[]>([]);

  const run = useCallback(async (...args: any[]) => {
    lastArgsRef.current = args;
    setLoading(true);
    setError(undefined);
    try {
      const result = await serviceRef.current(...args);
      setData(result);
      onSuccessRef.current?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onErrorRef.current?.(error);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await run(...lastArgsRef.current);
  }, [run]);

  const mutate = useCallback((newData: T | undefined) => {
    setData(newData);
  }, []);

  useEffect(() => {
    if (!manual) {
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, loading, error, run, refresh, mutate };
}

export default useRequest;
