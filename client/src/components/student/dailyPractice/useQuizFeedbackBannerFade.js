import { useEffect, useState } from 'react';

/**
 * Tự ẩn banner ngắn (mascot + tiêu đề + dòng tóm tắt) sau 2s đúng / 3s sai.
 * Không tự chuyển câu; giữ nút hành động. Hủy timer khi đổi câu hoặc mở giải thích.
 */
export function useQuizFeedbackBannerFade(result, questionId, explainOpen = false) {
  const [bannerFaded, setBannerFaded] = useState(false);

  useEffect(() => {
    setBannerFaded(false);
    if (!result) return undefined;

    if (explainOpen) {
      setBannerFaded(false);
      return undefined;
    }

    const delayMs = result.correct ? 2000 : 3000;
    const timer = window.setTimeout(() => setBannerFaded(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [result, questionId, explainOpen]);

  useEffect(() => {
    if (explainOpen) setBannerFaded(false);
  }, [explainOpen]);

  return bannerFaded;
}
