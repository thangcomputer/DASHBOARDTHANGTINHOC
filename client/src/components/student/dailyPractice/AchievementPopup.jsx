import { useEffect, useMemo } from 'react';
import { Award, CheckCircle2, Eye, Play, Sparkles, Star, Trophy, X, Zap } from 'lucide-react';
import { practiceFinishXpDisplay } from '../../../utils/dailyPractice';
import { GameSoundManager } from '../../../utils/sound';
import MascotEmotion from './MascotEmotion';
import GameButton from './GameButton';
import LevelUnlockEffect from './LevelUnlockEffect';
import { DEWSKILL_ANIMATION, useAnimatedNumber, useReducedMotion } from './animationConstants';

const CELEBRATED_MEMORY = new Set();

export function hasCelebratedSession(eventKey) {
  if (!eventKey) return false;
  if (CELEBRATED_MEMORY.has(eventKey)) return true;
  try {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(`dp_achievement_celebrated:${eventKey}`) === '1';
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function markCelebratedSession(eventKey) {
  if (!eventKey) return;
  CELEBRATED_MEMORY.add(eventKey);
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(`dp_achievement_celebrated:${eventKey}`, '1');
    }
  } catch {
    /* ignore */
  }
}

const CONFETTI_PALETTE = ['#10B981', '#F59E0B', '#0EA5E9', '#34D399', '#FBBF24', '#A855F7'];

function LightConfetti({ count = 28, spread = 190 }) {
  const reducedMotion = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.18;
        const distance = spread * (0.48 + ((i * 5) % 9) / 14);
        return {
          dx: `${Math.round(Math.cos(angle) * distance)}px`,
          dy: `${Math.round(Math.sin(angle) * distance - 36)}px`,
          rot: `${(i * 67) % 720 - 360}deg`,
          color: CONFETTI_PALETTE[i % CONFETTI_PALETTE.length],
          delay: `${(i * 35) % 240}ms`,
        };
      }),
    [count, spread],
  );

  if (reducedMotion) return null;

  return pieces.map((piece, index) => (
    <span
      key={index}
      className="cms-goal-confetti"
      style={{
        background: piece.color,
        '--dx': piece.dx,
        '--dy': piece.dy,
        '--rot': piece.rot,
        animationDelay: piece.delay,
      }}
      aria-hidden="true"
    />
  ));
}

/**
 * AchievementPopup - Popup chúc mừng hoàn thành bài học chuẩn Game Hóa DewSkill:
 * - Hiển thị độ chính xác (%), điểm số (câu đúng/tổng số) và XP thực tế đã xác nhận.
 * - Mascot ăn mừng kèm pháo giấy nhẹ.
 * - Huy chương xuất hiện với hiệu ứng pop và phát sáng (1–2s).
 * - Đầy đủ 3 nút: Đóng, Tiếp tục học, Xem lại kết quả.
 * - Chỉ kích hoạt chúc mừng 1 lần cho mỗi sự kiện hoàn thành.
 */
export default function AchievementPopup({
  summary,
  eventKey = '',
  onContinue,
  onReviewResults,
  onClose,
}) {
  const total = Math.max(1, Number(summary?.total) || 1);
  const correctCount = Math.max(0, Number(summary?.correctCount) || 0);
  const accuracy = typeof summary?.path?.scorePercent === 'number'
    ? summary.path.scorePercent
    : Math.round((correctCount / total) * 100);
  const xpDisplay = practiceFinishXpDisplay(summary || {});
  const animatedXp = useAnimatedNumber(xpDisplay.amount, DEWSKILL_ANIMATION.XP_FLOAT_MS, true);
  const animatedAccuracy = useAnimatedNumber(accuracy, DEWSKILL_ANIMATION.XP_FLOAT_MS, true);
  const stars = Number(summary?.stars) || (accuracy >= 90 ? 3 : accuracy >= 60 ? 2 : 1);
  const good = stars >= 2;
  const isPerfect = Boolean(
    summary && (summary.total || 0) >= 2 && (summary.correctCount === summary.total || summary.maxCombo === summary.total),
  );
  const unlockedUnit = summary?.path?.unlockedUnit || null;

  useEffect(() => {
    const key = eventKey || summary?.sessionId || summary?.id || '';
    if (key && hasCelebratedSession(key)) return;
    if (key) markCelebratedSession(key);
    if (good) {
      GameSoundManager.complete();
    }
  }, [eventKey, summary, good]);

  return (
    <div
      data-achievement-popup="true"
      className="dp-card-in relative mx-auto w-full max-w-lg overflow-hidden rounded-[32px] border-2 border-emerald-200/90 bg-gradient-to-b from-emerald-50/75 via-white to-teal-50/35 p-5 text-center shadow-[0_24px_60px_-15px_rgba(16,185,129,0.22)] sm:p-7"
    >
      {good && <LightConfetti count={30} spread={200} />}

      {/* Nút Đóng ở góc trên */}
      {onClose && (
        <button
          type="button"
          onClick={() => {
            GameSoundManager.click();
            onClose();
          }}
          aria-label="Đóng"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 !shadow-none"
        >
          <X size={17} />
        </button>
      )}

      {/* Huy chương phát sáng + Mascot ăn mừng */}
      <div className="relative mt-1 flex flex-col items-center">
        <div className="mb-2 flex items-center justify-center gap-1.5">
          {[1, 2, 3].map((n) => (
            <Star
              key={n}
              size={n === 2 ? 26 : 20}
              className={n <= stars ? 'dp-star-in fill-amber-400 text-amber-500 drop-shadow-xs' : 'fill-slate-200 text-slate-300'}
              style={{ animationDelay: `${n * 140}ms` }}
            />
          ))}
        </div>

        <div className="relative flex items-center justify-center gap-3 sm:gap-5">
          <div className="dp-fly-in">
            <MascotEmotion emotion={good ? 'completed' : 'incorrect'} size={118} />
          </div>

          {/* Huy chương pop + phát sáng 1.4s */}
          <div
            data-achievement-medal="true"
            className="dp-medal-glow relative flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-[26px] bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 text-white shadow-[0_8px_0_#B45309,0_16px_32px_rgba(245,158,11,0.4)] ring-4 ring-amber-200"
          >
            {isPerfect ? (
              <Trophy size={44} strokeWidth={2.3} className="drop-shadow-xs" aria-hidden="true" />
            ) : (
              <Award size={44} strokeWidth={2.3} className="drop-shadow-xs" aria-hidden="true" />
            )}
            <Sparkles
              size={18}
              className="dp-twinkle absolute -right-2 -top-2 fill-yellow-200 text-amber-500"
              aria-hidden="true"
            />
            <span className="mt-0.5 text-[9px] font-black uppercase tracking-wider text-amber-950">
              {isPerfect ? 'Hoàn hảo' : good ? 'Đạt chuẩn' : 'Cố gắng'}
            </span>
          </div>
        </div>
      </div>

      {/* Tiêu đề chính (giữ nguyên chuỗi kiểm thử 'Đã luyện tập xong!') */}
      <h2 className="mt-4 text-2xl font-black tracking-tight text-emerald-700 sm:text-3xl">
        {isPerfect
          ? 'Xuất sắc tuyệt đối! Đã luyện tập xong!'
          : good
            ? 'Đã luyện tập xong!'
            : 'Hoàn thành lượt luyện!'}
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-xs font-semibold text-slate-500 sm:text-sm">
        {xpDisplay.caption}
      </p>

      {/* 3 chỉ số thực tế: Độ chính xác · Điểm số · XP xác nhận */}
      <div className="mt-5 grid w-full grid-cols-3 gap-2.5">
        <div className="dp-card-in overflow-hidden rounded-2xl border-2 border-emerald-500 bg-white" style={{ animationDelay: '100ms' }}>
          <p className="bg-emerald-500 px-2 py-1 text-center text-[10px] font-black uppercase tracking-wider text-white">
            Chính xác
          </p>
          <p className="flex items-center justify-center gap-1 px-2 py-3 text-xl font-black tabular-nums text-emerald-600">
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>{animatedAccuracy}%</span>
          </p>
        </div>

        <div className="dp-card-in overflow-hidden rounded-2xl border-2 border-sky-500 bg-white" style={{ animationDelay: '220ms' }}>
          <p className="bg-sky-500 px-2 py-1 text-center text-[10px] font-black uppercase tracking-wider text-white">
            Điểm số
          </p>
          <p className="flex items-center justify-center gap-1 px-2 py-3 text-xl font-black tabular-nums text-sky-600">
            <Award size={18} aria-hidden="true" />
            <span>{correctCount}/{total}</span>
          </p>
        </div>

        <div className="dp-card-in overflow-hidden rounded-2xl border-2 border-amber-500 bg-white" style={{ animationDelay: '340ms' }}>
          <p className="bg-amber-500 px-2 py-1 text-center text-[10px] font-black uppercase tracking-wider text-white">
            Nhận về
          </p>
          <p className="flex items-center justify-center gap-1 px-2 py-3 text-xl font-black tabular-nums text-amber-600">
            <Zap size={18} className="fill-amber-400" aria-hidden="true" />
            <span>{xpDisplay.prefix ? `${xpDisplay.prefix}${animatedXp}` : animatedXp}</span>
          </p>
        </div>
      </div>

      {/* Nếu vừa mở khóa chặng mới, hiển thị hiệu ứng mở khóa ngay bên dưới */}
      {unlockedUnit && (
        <div className="mt-4">
          <LevelUnlockEffect unlockedUnit={unlockedUnit} active />
        </div>
      )}

      {/* Ba nút hành động: Đóng · Xem lại kết quả · Tiếp tục học */}
      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        {onClose && (
          <GameButton
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto sm:px-4 !py-3 text-xs"
          >
            <X size={15} />
            <span>Đóng</span>
          </GameButton>
        )}
        {onReviewResults && (
          <GameButton
            variant="outline"
            onClick={onReviewResults}
            className="w-full flex-1 !py-3 text-xs"
          >
            <Eye size={15} />
            <span>Xem lại kết quả</span>
          </GameButton>
        )}
        <GameButton
          variant="primary"
          onClick={onContinue}
          className="w-full flex-1 !py-3.5 text-sm uppercase"
        >
          <Play size={16} fill="currentColor" />
          <span>Tiếp tục học</span>
        </GameButton>
      </div>
    </div>
  );
}
