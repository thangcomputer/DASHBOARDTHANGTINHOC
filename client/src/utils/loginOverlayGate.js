export const LOGIN_OVERLAY_EVENT = 'cms:login-overlay';

/** id → đang mở (module-level để PopupBanner / LoginInbox cùng đọc). */
const activeOverlays = new Map();

function emit(id, open) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(LOGIN_OVERLAY_EVENT, {
      detail: { id: String(id), open: Boolean(open) },
    }));
  } catch { /* ignore */ }
}

/** Overlay đăng nhập đang mở — popup tin/lịch / QC đợi xong mới hiện. */
export function setLoginOverlay(id, open) {
  if (!id) return;
  const key = String(id);
  if (open) activeOverlays.set(key, true);
  else activeOverlays.delete(key);
  emit(key, open);
}

export function getActiveLoginOverlayIds() {
  return Array.from(activeOverlays.keys());
}

/** Có overlay đang chặn không? (bỏ qua exceptIds — vd. chính PopupBanner). */
export function hasBlockingLoginOverlay(exceptIds = []) {
  const except = new Set((exceptIds || []).map(String).filter(Boolean));
  for (const id of activeOverlays.keys()) {
    if (!except.has(id)) return true;
  }
  return false;
}

export function subscribeLoginOverlays(onChange) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => {
    try { onChange(getActiveLoginOverlayIds()); } catch { /* ignore */ }
  };
  window.addEventListener(LOGIN_OVERLAY_EVENT, handler);
  return () => window.removeEventListener(LOGIN_OVERLAY_EVENT, handler);
}
