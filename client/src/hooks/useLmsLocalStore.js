import { useCallback, useEffect, useRef, useState } from 'react';

function readStore(storageKey, initialValue) {
  if (!storageKey || typeof window === 'undefined') return initialValue;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw == null) return initialValue;
    return JSON.parse(raw);
  } catch {
    return initialValue;
  }
}

/**
 * Persist JSON array/object in localStorage for LMS player tabs (notes / qa / reviews).
 */
export default function useLmsLocalStore(storageKey, initialValue = []) {
  const [value, setValue] = useState(() => readStore(storageKey, initialValue));
  const skipWriteRef = useRef(false);

  // Rehydrate when course/user key changes
  useEffect(() => {
    skipWriteRef.current = true;
    setValue(readStore(storageKey, initialValue));
  }, [storageKey]); // eslint-disable-line react-hooks/exhaustive-deps -- initialValue is seed only

  useEffect(() => {
    if (!storageKey) return;
    if (skipWriteRef.current) {
      skipWriteRef.current = false;
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* quota / private mode */
    }
  }, [storageKey, value]);

  const reset = useCallback(() => setValue(initialValue), [initialValue]);

  return [value, setValue, reset];
}

export function lmsStoreKey(kind, userId, courseId) {
  const u = userId || 'anon';
  const c = courseId || 'course';
  return `lms_${kind}_${u}_${c}`;
}
