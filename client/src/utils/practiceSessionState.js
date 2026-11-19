export const PRACTICE_SESSION_ACTIVE_EVENT = 'cms:practice-session-active';

/** Kiểm tra học viên có đang ở trong phiên làm bài luyện tập hay không. */
export function isPracticeSessionActive() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.dataset.practiceSession === 'true';
}

/** Đồng bộ trạng thái phiên luyện tập để ẩn thanh tiêu đề và nút Hỗ trợ nổi khi đang làm bài. */
export function setPracticeSessionActive(active) {
  const next = Boolean(active);
  if (typeof document !== 'undefined') {
    if (next) {
      document.documentElement.dataset.practiceSession = 'true';
    } else {
      delete document.documentElement.dataset.practiceSession;
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PRACTICE_SESSION_ACTIVE_EVENT, { detail: { active: next } }));
  }
  return next;
}
