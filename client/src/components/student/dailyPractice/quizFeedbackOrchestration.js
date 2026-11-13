/** Combo milestones — celebration overlay, không lặp mỗi 3 câu. */
export const COMBO_CELEBRATION_TIERS = [3, 5, 10];

export function shouldShowComboCelebration(nextCombo) {
  return COMBO_CELEBRATION_TIERS.includes(nextCombo);
}

/**
 * Map trạng thái mascot theo đúng/sai và số lần sai trên cùng câu (official + ôn lại).
 */
export function resolveFeedbackMascotEmotion({ isCorrect, wrongTryCount = 0 }) {
  if (isCorrect) return 'correct';
  if (wrongTryCount >= 4) return 'learning';
  if (wrongTryCount >= 3) return 'learning';
  if (wrongTryCount >= 2) return 'thinking';
  if (wrongTryCount >= 1) return 'incorrect';
  return 'incorrect';
}

export function resolveWrongEncouragement(wrongTryCount, fallback = '') {
  if (wrongTryCount >= 4) {
    return 'Ôn lại phần kiến thức liên quan rồi quay lại — mỗi lần thử bạn tiến thêm một bước!';
  }
  if (wrongTryCount >= 3) {
    return 'Mở Giải thích từng bước để nắm chắc khái niệm nhé!';
  }
  if (wrongTryCount >= 2) {
    return 'Lần tới thử Gợi ý trước khi chọn — bạn làm được mà!';
  }
  return fallback || 'Đừng nản — đọc lại đề và thử lại nhé!';
}

export function shouldSuppressWrongShake(wrongTryCount) {
  return wrongTryCount >= 4;
}
