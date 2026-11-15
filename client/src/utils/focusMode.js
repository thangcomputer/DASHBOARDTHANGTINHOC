import { useCallback, useEffect, useState } from 'react';

export const FOCUS_MODE_EVENT = 'cms:focus-mode-change';

/** Kiểm tra Chế độ Tập trung (ẩn sidebar, thanh đáy và chat nổi khi học). */
export function isFocusMode() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.dataset.focusMode === 'true';
}

export function setFocusMode(enabled) {
  const next = Boolean(enabled);
  if (typeof document !== 'undefined') {
    if (next) {
      document.documentElement.dataset.focusMode = 'true';
    } else {
      delete document.documentElement.dataset.focusMode;
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FOCUS_MODE_EVENT, { detail: { enabled: next } }));
  }
  return next;
}

export function toggleFocusMode() {
  return setFocusMode(!isFocusMode());
}

/** Hook đồng bộ trạng thái Chế độ Tập trung giữa Topbar, Command Palette và trang học. */
export function useFocusMode() {
  const [focusMode, setFocusState] = useState(isFocusMode);

  useEffect(() => {
    const sync = () => setFocusState(isFocusMode());
    sync();
    window.addEventListener(FOCUS_MODE_EVENT, sync);
    return () => window.removeEventListener(FOCUS_MODE_EVENT, sync);
  }, []);

  const setMode = useCallback((next) => setFocusMode(next), []);
  const toggle = useCallback(() => toggleFocusMode(), []);

  return { focusMode, setFocusMode: setMode, toggle };
}

