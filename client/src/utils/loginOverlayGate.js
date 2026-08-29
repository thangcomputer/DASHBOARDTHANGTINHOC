export const LOGIN_OVERLAY_EVENT = 'cms:login-overlay';

/** Overlay đăng nhập đang mở — popup tin/lịch đợi xong mới hiện. */
export function setLoginOverlay(id, open) {
  if (!id || typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(LOGIN_OVERLAY_EVENT, {
      detail: { id: String(id), open: Boolean(open) },
    }));
  } catch { /* ignore */ }
}
