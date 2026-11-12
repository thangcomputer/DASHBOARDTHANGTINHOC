import { useEffect, useRef, useState } from 'react';

/**
 * Hằng số thời lượng animation chuẩn cho hệ thống Game Hóa DewSkill.
 * Tuân thủ:
 * - Button: 150–250ms
 * - Answer feedback: 300–600ms
 * - XP float & counter: 600–1000ms
 * - Celebration popup: 1000–2000ms
 */
export const DEWSKILL_ANIMATION = {
  BUTTON_MS: 180,
  FEEDBACK_MS: 420,
  XP_FLOAT_MS: 850,
  PROGRESS_MS: 480,
  CELEBRATION_MS: 1400,
  UNLOCK_MS: 1100,
  EASE_SPRING: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  EASE_OUT: 'cubic-bezier(0.22, 1, 0.36, 1)',
};

export const STREAK_MILESTONES = [
  {
    days: 3,
    title: 'Mốc 3 ngày liên tiếp!',
    badge: 'Khởi đầu bứt phá',
    message: 'Tuyệt vời! Bạn đã duy trì thói quen học tập 3 ngày liên tiếp cùng DewSkill.',
  },
  {
    days: 7,
    title: 'Chuỗi 7 ngày rực lửa!',
    badge: 'Chiến binh tuần lễ',
    message: 'Một tuần học tập không ngừng nghỉ! Kiến thức tin học của bạn đang tiến bộ vượt bậc.',
  },
  {
    days: 30,
    title: 'Kỷ lục 30 ngày kiên trì!',
    badge: 'Huyền thoại DewSkill',
    message: 'Đỉnh cao kỷ luật! 30 ngày liên tiếp chinh phục kỹ năng số cùng giọt nước DewSkill.',
  },
];

export function getStreakMilestone(streakDays) {
  const days = Number(streakDays) || 0;
  if (days <= 0) return null;
  const exact = STREAK_MILESTONES.find((item) => item.days === days);
  if (exact) return { ...exact, isExactMilestone: true };
  if (days >= 30) return { ...STREAK_MILESTONES[2], isExactMilestone: false };
  if (days >= 7) return { ...STREAK_MILESTONES[1], isExactMilestone: false };
  if (days >= 3) return { ...STREAK_MILESTONES[0], isExactMilestone: false };
  return null;
}

/**
 * Hook kiểm tra cài đặt giảm chuyển động (prefers-reduced-motion) của thiết bị.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event) => setReduced(event.matches);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', onChange);
      return () => mediaQuery.removeEventListener('change', onChange);
    }
    return undefined;
  }, []);

  return reduced;
}

/**
 * Hook chạy số mượt mà (dùng cho tổng XP, XP thưởng, chuỗi ngày, độ chính xác).
 */
export function useAnimatedNumber(targetValue, duration = DEWSKILL_ANIMATION.XP_FLOAT_MS, enabled = true) {
  const target = Number.isFinite(Number(targetValue)) ? Number(targetValue) : 0;
  const reducedMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(target);
  const previousRef = useRef(target);

  useEffect(() => {
    if (!enabled || reducedMotion) {
      previousRef.current = target;
      setDisplayValue(target);
      return undefined;
    }

    const from = previousRef.current;
    const to = target;
    previousRef.current = target;

    if (from === to) {
      setDisplayValue(to);
      return undefined;
    }

    let rafId = 0;
    const startTime = performance.now();
    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / Math.max(120, duration));
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration, enabled, reducedMotion]);

  return displayValue;
}

