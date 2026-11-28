import { ArrowLeft, Zap } from 'lucide-react';
import { dewClass } from '../../../utils/dewskillTheme';
import { AnimatedXpCounter } from './XPRewardAnimation';

/**
 * Thanh tiến độ kính nổi trên cùng (dùng chung cho mọi màn câu hỏi trong PracticeSession).
 */
export default function PracticeTopBar({
  contextLabel = 'Chặng 1 · Luyện tập',
  currentIndex = 1,
  total = 1,
  progress = 0,
  confirmedXp = 0,
  userXP = 0,
  perQuestionXp = 0,
  stakeXp = 0,
  xpDisabled = false,
  combo = 0,
  hintChargedXp = 0,
  onQuit,
}) {
  const safeTotal = Math.max(1, Number(total) || 1);
  const safeIndex = Math.min(safeTotal, Math.max(1, Number(currentIndex) || 1));
  const safePct = Math.min(100, Math.max(0, Number(progress) || 0));

  return (
    <header className="relative z-10 mx-auto mb-5 flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 sm:flex-nowrap">
      {/* Trái: Nút Thoát */}
      <button
        type="button"
        onClick={onQuit}
        aria-label="Thoát lượt luyện tập"
        className={dewClass(
          'dew-btn-white inline-flex shrink-0 items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-700 cursor-pointer',
          'inline-flex shrink-0 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer',
        )}
      >
        <ArrowLeft size={15} strokeWidth={2.2} aria-hidden="true" />
        <span>Thoát</span>
      </button>

      {/* Giữa: Hộp kính tiến độ + badge +5 XP khi đúng */}
      <div className="min-w-[200px] flex-1 rounded-2xl border border-white bg-white/88 px-4 py-2.5 shadow-sm backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-extrabold text-slate-700 sm:text-[13px]">
            {contextLabel}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {confirmedXp > 0 ? (
              <span className="dp-pop inline-flex items-center gap-0.5 rounded-full border border-amber-300 bg-gradient-to-r from-[#FEF3C7] via-[#FDE68A] to-[#FEF3C7] px-2.5 py-0.5 text-[11px] font-extrabold text-amber-800 shadow-[0_0_12px_rgba(251,191,36,0.45)]">
                +{confirmedXp} XP
              </span>
            ) : null}
            <span className="text-xs font-bold tabular-nums text-slate-500">
              {safeIndex}/{safeTotal}
            </span>
          </div>
        </div>

        <div
          className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-emerald-100"
          role="progressbar"
          aria-valuenow={Math.round(safePct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Tiến độ ${safeIndex} trên ${safeTotal} câu`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#059669] via-[#10B981] to-[#34D399] shadow-[0_0_10px_rgba(16,185,129,0.45)] transition-all duration-500 ease-out"
            style={{ width: `${Math.max(safePct, 6)}%` }}
          />
        </div>
      </div>

      {/* Phải: Pill vàng cam giọt nước hiển thị XP */}
      <div className="relative flex shrink-0 items-center">
        {combo >= 2 ? (
          <span className="dp-combo absolute -top-3 right-3 z-[2] flex h-5 min-w-5 items-center justify-center whitespace-nowrap rounded-full bg-orange-500 px-2 text-[10px] font-black leading-none text-white shadow-sm ring-2 ring-white">
            Combo x{combo}
          </span>
        ) : null}

        <div
          className="relative inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-gradient-to-b from-[#FDE68A] via-[#F59E0B] to-[#D97706] px-4 py-2 text-xs font-bold text-amber-950 shadow-md tabular-nums sm:text-sm"
          style={{ boxShadow: '0 8px 18px -6px rgba(217,119,6,0.45), inset 0 2px 2px rgba(255,255,255,0.65)' }}
          title={stakeXp > 0
            ? `Ví ${userXP} XP · ${stakeXp} XP cược`
            : (perQuestionXp > 0 ? `Ví ${userXP} XP · ${perQuestionXp} XP/câu` : `Ví ${userXP} XP · Ôn tập`)}
        >
          <Zap size={15} className="shrink-0 fill-amber-950/80 text-amber-950" aria-hidden="true" />
          <span className="font-extrabold">
            <AnimatedXpCounter value={userXP} /> XP
          </span>
          {stakeXp > 0 ? (
            <span className="rounded-full bg-amber-950/15 px-2 py-0.5 text-[10px] font-extrabold leading-none text-amber-950">
              −{stakeXp} cược
            </span>
          ) : perQuestionXp > 0 && !xpDisabled ? (
            <span className="text-[11px] font-bold opacity-90">
              · {perQuestionXp} XP/câu
            </span>
          ) : xpDisabled ? (
            <span className="text-[11px] font-bold opacity-85">
              · Ôn tập
            </span>
          ) : null}

          {hintChargedXp > 0 ? (
            <span className="dp-xp-hint-spend" aria-live="polite">−{hintChargedXp} XP</span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
