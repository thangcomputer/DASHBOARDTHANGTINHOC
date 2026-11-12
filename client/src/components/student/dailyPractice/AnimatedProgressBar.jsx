import { useEffect, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { DEWSKILL_ANIMATION, useReducedMotion } from './animationConstants';

/**
 * AnimatedProgressBar / QuizProgressBar - Thanh tiến độ bài học mượt mà chuẩn thương hiệu DewSkill:
 * - Chuyển động màu xanh lá ngọc lục bảo (emerald/teal).
 * - Hiển thị huy hiệu +XP kèm tia sáng nhỏ phía trên thanh tiến độ khi trả lời đúng được xác nhận.
 * - Khi đạt 100%, hiển thị hiệu ứng hoàn thành hữu hạn (không chạy lặp vô hạn tốn CPU).
 */
export function QuizProgressBar({
  progress = 0,
  currentStep = 0,
  totalSteps = 0,
  label = '',
  confirmedXp = 0,
  className = '',
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));
  const isComplete = clamped >= 100;
  const reducedMotion = useReducedMotion();
  const [burstActive, setBurstActive] = useState(false);

  useEffect(() => {
    if (!isComplete || reducedMotion) {
      setBurstActive(false);
      return undefined;
    }
    setBurstActive(true);
    const timer = window.setTimeout(() => {
      setBurstActive(false);
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [isComplete, reducedMotion]);

  return (
    <div className={`relative min-w-0 flex-1 ${className}`} data-progress-value={clamped}>
      {(label || totalSteps > 0 || confirmedXp > 0) && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          {label ? (
            <span className="truncate text-xs font-extrabold text-slate-700 sm:text-[13px]">
              {label}
            </span>
          ) : <span />}

          <div className="flex shrink-0 items-center gap-2">
            {confirmedXp > 0 && (
              <span
                className="dp-pop relative inline-flex items-center gap-1 rounded-full border border-amber-300/80 bg-[#FFF3C4] px-2.5 py-0.5 text-[11px] font-black text-amber-900 shadow-2xs"
                data-progress-xp-pill={confirmedXp}
              >
                <span>+{confirmedXp} XP</span>
                {/* 3 tia sáng nhỏ góc phải trên theo hình mẫu */}
                <svg
                  className="pointer-events-none absolute -right-2.5 -top-2 h-3.5 w-3.5 text-amber-500"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M3 7L1 4M8 5V1M12 8L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
            )}

            {totalSteps > 0 && (
              <span
                className={`shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-black tabular-nums transition-colors ${
                  isComplete
                    ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {isComplete && <Check size={12} strokeWidth={3} className="text-emerald-600" aria-hidden="true" />}
                <span>{currentStep}/{totalSteps}</span>
              </span>
            )}
          </div>
        </div>
      )}

      <div
        className={`relative h-3 overflow-hidden rounded-full bg-slate-100 p-0.5 ring-1 ring-inset transition-shadow ${
          isComplete ? 'ring-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.28)]' : 'ring-slate-200/80'
        }`}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="relative h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.35)]"
          style={{
            width: `${clamped}%`,
            transition: reducedMotion
              ? 'none'
              : `width ${DEWSKILL_ANIMATION.PROGRESS_MS}ms ${DEWSKILL_ANIMATION.EASE_OUT}`,
          }}
        >
          {/* Ánh sáng bóng 3D phía trên thanh tiến độ */}
          <div className="pointer-events-none absolute inset-x-1.5 top-0.5 h-[3px] rounded-full bg-white/45" />

          {/* Hiệu ứng hoàn thành 100% chạy đúng 1 lần, không lặp vô hạn */}
          {burstActive && (
            <span
              className="dp-progress-complete-flash pointer-events-none absolute inset-0 rounded-full bg-white/50"
              aria-hidden="true"
            />
          )}
        </div>

        {isComplete && burstActive && (
          <span
            className="dp-pop pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-amber-400"
            aria-hidden="true"
          >
            <Sparkles size={12} className="fill-amber-300 text-amber-500" />
          </span>
        )}
      </div>
    </div>
  );
}

export default QuizProgressBar;
