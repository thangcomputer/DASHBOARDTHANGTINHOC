import { useEffect, useState } from 'react';
import type { DpAnswerResult } from '../../services/dailyPracticeApi';

/** Ẩn banner ngắn sau 2s (đúng) / 3s (sai); không ẩn khi đang mở giải thích. */
export function useMobileFeedbackBannerFade(
  result: DpAnswerResult | null | undefined,
  questionId: string | undefined,
  explainOpen: boolean,
) {
  const [bannerFaded, setBannerFaded] = useState(false);

  useEffect(() => {
    setBannerFaded(false);
    if (!result || explainOpen) return undefined;

    const delayMs = result.correct ? 2000 : 3000;
    const timer = setTimeout(() => setBannerFaded(true), delayMs);
    return () => clearTimeout(timer);
  }, [result, questionId, explainOpen]);

  useEffect(() => {
    if (explainOpen) setBannerFaded(false);
  }, [explainOpen]);

  return bannerFaded;
}
