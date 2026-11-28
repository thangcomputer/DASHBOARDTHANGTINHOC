import { useEffect, useState } from 'react';
import { Award, Eye, Play, RotateCcw, Share2, Timer, X, Zap } from 'lucide-react';
import { buildPracticeShareData } from '../../../../../shared/dailyPractice/shareAchievement.mjs';
import { practiceFinishXpDisplay } from '../../../utils/dailyPractice';
import { GameSoundManager } from '../../../utils/sound';
import { dewClass } from '../../../utils/dewskillTheme';
import ShareAchievementModal from '../ShareAchievementModal';
import Mascot from './Mascot';
import { DEWSKILL_ANIMATION, useAnimatedNumber, useReducedMotion } from './animationConstants';

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function CrystalStar3D({ filled = true, large = false, delay = '0ms' }) {
  const size = large ? 48 : 38;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={filled ? 'dp-star-in drop-shadow-[0_6px_12px_rgba(245,158,11,0.38)]' : 'opacity-85 drop-shadow-[0_4px_10px_rgba(148,163,184,0.28)]'}
      style={{ animationDelay: delay }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={filled ? 'dewStarGold' : 'dewStarIce'} x1="10" y1="4" x2="38" y2="44" gradientUnits="userSpaceOnUse">
          {filled ? (
            <>
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="50%" stopColor="#FACC15" />
              <stop offset="100%" stopColor="#D97706" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="55%" stopColor="#E2E8F0" />
              <stop offset="100%" stopColor="#CBD5E1" />
            </>
          )}
        </linearGradient>
      </defs>
      <path
        d="M24 4.5L29.6 16.2L42.5 18L33.1 27L35.4 39.8L24 33.7L12.6 39.8L14.9 27L5.5 18L18.4 16.2L24 4.5Z"
        fill={`url(#${filled ? 'dewStarGold' : 'dewStarIce'})`}
        stroke={filled ? '#FDE047' : '#FFFFFF'}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <ellipse cx="20" cy="16" rx="4" ry="2" transform="rotate(-25 20 16)" fill="#FFFFFF" fillOpacity={filled ? 0.65 : 0.8} />
    </svg>
  );
}

/**
 * Popup Tổng kết "Đã luyện tập xong!" theo phong cách Giọt Nước 3D (Hình 4).
 */
export default function PracticeCompletionModal({
  summary,
  eventKey: _eventKey = '',
  onContinue,
  onReviewResults,
  onReplay,
  onDismiss,
  onClose,
}) {
  const reducedMotion = useReducedMotion();
  const [shareOpen, setShareOpen] = useState(false);

  const totalCount = Math.max(1, Number(summary?.total) || 1);
  const correctCount = Math.max(0, Number(summary?.correctCount) || 0);
  const accuracy = typeof summary?.path?.scorePercent === 'number'
    ? summary.path.scorePercent
    : Math.round((correctCount / totalCount) * 100);
  const xpDisplay = practiceFinishXpDisplay(summary || {});
  const animatedXp = useAnimatedNumber(xpDisplay.amount, DEWSKILL_ANIMATION.XP_FLOAT_MS, true);
  const stars = Number(summary?.stars) || (accuracy >= 90 ? 3 : accuracy >= 60 ? 2 : 1);
  const good = stars >= 2;
  const durationFormatted = formatDuration(summary?.durationSeconds);
  const earnedXpText = xpDisplay.prefix ? `${xpDisplay.prefix}${animatedXp}` : `${animatedXp}`;
  const closeHandler = onDismiss || onClose;

  useEffect(() => {
    if (good) GameSoundManager.complete();
  }, [good]);

  return (
    <div
      data-achievement-popup="true"
      className="dew-modal dew-student-theme relative mx-auto w-full max-w-md overflow-hidden rounded-[32px] border border-white bg-white/95 text-center shadow-2xl backdrop-blur-2xl"
    >
      {closeHandler ? (
        <button
          type="button"
          onClick={() => {
            GameSoundManager.click();
            closeHandler();
          }}
          aria-label="Đóng"
          className="absolute right-3.5 top-3.5 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white bg-white/85 text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-800 cursor-pointer"
        >
          <X size={16} />
        </button>
      ) : null}

      {/* Vòm gradient xanh bạc hà – xanh trời đặt 3 ngôi sao 3D + Mascot ôm trái tim */}
      <div className="relative overflow-hidden bg-gradient-to-b from-[#CCFBF1]/85 via-[#E0F2FE]/80 to-white px-6 pb-2 pt-7">
        <div
          className="pointer-events-none absolute -bottom-10 left-1/2 h-24 w-[135%] -translate-x-1/2 rounded-[100%] bg-white"
          aria-hidden="true"
        />

        <div className="relative z-[1] flex items-end justify-center gap-2">
          <div className="translate-y-1.5 -rotate-12">
            <CrystalStar3D filled={stars >= 1} delay={reducedMotion ? '0ms' : '80ms'} />
          </div>
          <div className="-translate-y-1">
            <CrystalStar3D filled={stars >= 2} large delay={reducedMotion ? '0ms' : '180ms'} />
          </div>
          <div className="translate-y-1.5 rotate-12">
            <CrystalStar3D filled={stars >= 3} delay={reducedMotion ? '0ms' : '280ms'} />
          </div>
        </div>

        <div className={`relative z-[1] mt-1 flex justify-center ${reducedMotion ? '' : 'dp-bounce'}`}>
          <Mascot mood={good ? 'completed' : 'thinking'} size={104} className="mx-auto drop-shadow-md" />
        </div>
      </div>

      {/* Tiêu đề & Pill XP */}
      <div className="px-6 pt-1">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Đã luyện tập xong!
        </h2>
        <div className="mt-2 flex justify-center">
          <span className="inline-flex items-center rounded-full border border-emerald-200/80 bg-emerald-50 px-3.5 py-1 text-xs font-extrabold text-emerald-700">
            {xpDisplay.caption || `Lời +${xpDisplay.amount} XP`}
          </span>
        </div>
      </div>

      {/* 3 thẻ thông số có đầy đủ dấu tiếng Việt */}
      <div className="mt-5 grid grid-cols-3 gap-3 px-6">
        {/* 1. Thời gian */}
        <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
          <div className="flex items-center justify-center gap-1 bg-gradient-to-r from-[#10B981] to-[#22C55E] py-1.5 text-[11px] font-bold text-white">
            <Timer size={12} strokeWidth={2.4} aria-hidden="true" />
            <span>Thời gian</span>
          </div>
          <p className="py-2.5 text-base font-black tabular-nums text-emerald-700 sm:text-lg">
            {durationFormatted}
          </p>
        </div>

        {/* 2. Số câu đúng */}
        <div className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm">
          <div className="flex items-center justify-center gap-1 bg-gradient-to-r from-[#38BDF8] to-[#3B82F6] py-1.5 text-[11px] font-bold text-white">
            <Award size={12} strokeWidth={2.4} aria-hidden="true" />
            <span>Số câu đúng</span>
          </div>
          <p className="py-2.5 text-sm font-black tabular-nums text-blue-700 sm:text-[15px]">
            {correctCount} / {totalCount} câu
          </p>
        </div>

        {/* 3. Nhận về */}
        <div className="overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm">
          <div className="flex items-center justify-center gap-1 bg-gradient-to-r from-[#F59E0B] to-[#D97706] py-1.5 text-[11px] font-bold text-white">
            <Zap size={12} strokeWidth={2.4} aria-hidden="true" />
            <span>Nhận về</span>
          </div>
          <p className="py-2.5 text-base font-black tabular-nums text-amber-600 sm:text-lg">
            {earnedXpText} XP
          </p>
        </div>
      </div>

      {/* 2 hàng nút đáy */}
      <div className="mt-5 space-y-3 px-6 pb-6">
        {(onReplay || onReviewResults) ? (
          <div className="grid grid-cols-2 gap-3">
            {onReplay ? (
              <button
                type="button"
                onClick={() => {
                  GameSoundManager.click();
                  onReplay();
                }}
                className={dewClass(
                  'dew-btn-white inline-flex w-full items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-slate-700 cursor-pointer sm:text-sm',
                  'inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer sm:text-sm',
                )}
              >
                <RotateCcw size={14} aria-hidden="true" />
                <span>Làm lại</span>
              </button>
            ) : <span />}
            {onReviewResults ? (
              <button
                type="button"
                onClick={() => {
                  GameSoundManager.click();
                  onReviewResults();
                }}
                className={dewClass(
                  'dew-btn-white inline-flex w-full items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-slate-700 cursor-pointer sm:text-sm',
                  'inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer sm:text-sm',
                )}
              >
                <Eye size={14} aria-hidden="true" />
                <span>Xem lại kết quả</span>
              </button>
            ) : <span />}
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              GameSoundManager.click();
              setShareOpen(true);
            }}
            className={dewClass(
              'dew-btn-white inline-flex items-center justify-center gap-1.5 px-5 py-3.5 text-xs font-bold text-slate-700 cursor-pointer sm:text-sm',
              'inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer sm:text-sm',
            )}
          >
            <Share2 size={14} aria-hidden="true" />
            <span>Chia sẻ</span>
          </button>

          <button
            type="button"
            onClick={() => {
              GameSoundManager.click();
              onContinue?.();
            }}
            className={dewClass(
              'dew-btn-primary inline-flex flex-1 items-center justify-center gap-2 py-3.5 text-sm font-extrabold cursor-pointer',
              'inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 text-sm font-extrabold shadow-md cursor-pointer',
            )}
          >
            <Play size={15} fill="currentColor" aria-hidden="true" />
            <span>Tiếp tục học</span>
          </button>
        </div>
      </div>

      <ShareAchievementModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        data={buildPracticeShareData(summary)}
      />
    </div>
  );
}
