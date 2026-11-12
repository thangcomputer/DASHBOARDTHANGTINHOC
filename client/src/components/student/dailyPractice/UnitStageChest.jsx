import { useEffect, useMemo, useState } from 'react';
import { Check, Gift, Loader2, Lock, Sparkles, X, Zap } from 'lucide-react';
import dailyPracticeApi from '../../../services/dailyPracticeApi';
import { gameSounds } from '../../../utils/sound';

export const UNIT_CHEST_REWARD_XP = 50;

export function unitStepProgress(unit) {
  const steps = Array.isArray(unit?.steps) ? unit.steps : [];
  const totalSteps = steps.length;
  const doneSteps = steps.filter((step) => step.state === 'completed').length;
  return { doneSteps, totalSteps };
}

const CONFETTI_COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6', '#F97316', '#FACC15'];

function ChestRewardConfetti({ count = 28, spread = 200 }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.15;
    const distance = spread * (0.45 + ((i * 7) % 10) / 16);
    return {
      dx: `${Math.round(Math.cos(angle) * distance)}px`,
      dy: `${Math.round(Math.sin(angle) * distance - 35)}px`,
      rot: `${(i * 67) % 720 - 360}deg`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: `${(i * 30) % 240}ms`,
    };
  }), [count, spread]);

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

function useAnimatedCount(target, duration = 850, active = false) {
  const [count, setCount] = useState(1);

  useEffect(() => {
    if (!active || target <= 0) {
      setCount(1);
      return undefined;
    }
    let startTimestamp = null;
    let frameId;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic: fast initial rise, smooth settle into target
      const ease = 1 - (1 - progress) ** 3;
      const current = Math.max(1, Math.round(1 + (target - 1) * ease));
      setCount(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [target, duration, active]);

  return count;
}

/** Rương phần thưởng cuối chặng — đồng bộ mobile, bấm để +XP qua API. */
export function UnitStageChest({
  unit,
  rewardXp = unit?.chestRewardXp ?? UNIT_CHEST_REWARD_XP,
  className = '',
  onClaimed,
}) {
  const { doneSteps, totalSteps } = unitStepProgress(unit);
  const complete = unit?.state === 'completed' || (totalSteps > 0 && doneSteps >= totalSteps);
  const claimed = Boolean(unit?.chestClaimed);
  const claimable = complete && !claimed && Boolean(unit?.id);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);
  const [claimedXp, setClaimedXp] = useState(rewardXp);
  const [lastResult, setLastResult] = useState(null);

  const liveCounter = useAnimatedCount(claimedXp, 850, showCelebration);

  const handleClaim = async () => {
    if (!claimable || claiming) return;
    setClaimError('');
    setClaiming(true);
    gameSounds.tap();
    try {
      const result = await dailyPracticeApi.student.claimUnitChest(unit.id);
      const earned = Number(result?.xp) || rewardXp || 50;
      setClaimedXp(earned);
      setLastResult(result);
      setShowCelebration(true);
      if (earned > 0) gameSounds.win();
    } catch (err) {
      setClaimError(err?.message || 'Không mở được rương');
    } finally {
      setClaiming(false);
    }
  };

  const handleCloseCelebration = () => {
    setShowCelebration(false);
    onClaimed?.(lastResult);
  };

  const toneDone = complete && !claimed;
  const toneClaimed = claimed;

  const body = (
    <>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border-b-[3px] ${
          toneClaimed
            ? 'border-b-emerald-700 bg-gradient-to-b from-emerald-400 to-emerald-500 text-white'
            : toneDone
              ? 'border-b-amber-600 bg-gradient-to-b from-amber-400 to-amber-500 text-white'
              : 'border-b-slate-300 bg-slate-200 text-slate-400'
        }`}
      >
        {toneClaimed ? <Check size={20} strokeWidth={3} aria-hidden="true" /> : <Gift size={20} strokeWidth={2.5} aria-hidden="true" />}
      </span>
      <section className="min-w-0 flex-1 text-left">
        <p className={`text-sm font-extrabold ${toneClaimed ? 'text-emerald-900' : toneDone ? 'text-amber-900' : 'text-slate-600'}`}>
          {toneClaimed
            ? `Đã mở rương · +${rewardXp} XP`
            : toneDone
              ? `Mở rương chặng · +${rewardXp} XP`
              : `Rương phần thưởng chặng (${doneSteps}/${totalSteps})`}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">
          {toneClaimed
            ? 'Phần thưởng đã vào ví XP của bạn'
            : toneDone
              ? 'Chúc mừng bạn đã chinh phục toàn bộ chặng!'
              : 'Hoàn thành các bài tập để nhận quà'}
        </p>
        {claimError ? <p className="mt-1 text-xs font-semibold text-red-600">{claimError}</p> : null}
      </section>
      {toneClaimed ? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100">
          <Sparkles size={14} className="text-emerald-600" aria-hidden="true" />
        </span>
      ) : toneDone ? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100">
          {claiming ? (
            <Loader2 size={14} className="animate-spin text-amber-600" aria-hidden="true" />
          ) : (
            <Sparkles size={14} className="text-amber-600" aria-hidden="true" />
          )}
        </span>
      ) : (
        <Lock size={16} className="shrink-0 text-slate-300" aria-hidden="true" />
      )}
    </>
  );

  const boxClass = `duo-unit-chest flex w-full max-w-[380px] items-center gap-3 rounded-[20px] border-[1.5px] px-4 py-3 ${
    toneClaimed
      ? 'border-emerald-200 bg-emerald-50'
      : toneDone
        ? 'duo-unit-chest--done border-amber-200 bg-amber-50'
        : 'border-slate-200 bg-slate-50'
  } ${className}`;

  return (
    <>
      {claimable ? (
        <button
          type="button"
          disabled={claiming}
          onClick={handleClaim}
          className={`${boxClass} duo-pressable cursor-pointer transition hover:brightness-[1.02] disabled:opacity-80`}
          aria-label={`Mở rương chặng, nhận ${rewardXp} XP`}
        >
          {body}
        </button>
      ) : (
        <div className={boxClass}>{body}</div>
      )}

      {/* Modal chúc mừng mở rương chặng nhận 50XP + lớp phủ trắng mờ sang trọng */}
      {showCelebration && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Chúc mừng nhận 50 XP rương chặng"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/90 backdrop-blur-md transition-opacity duration-300"
        >
          {/* Backdrop click to dismiss */}
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={handleCloseCelebration}
            aria-label="Đóng popup"
            tabIndex={-1}
          />

          {/* Hạt pháo hoa confetti bung ra rực rỡ */}
          <ChestRewardConfetti count={32} spread={220} />

          <div className="relative z-10 w-full max-w-sm rounded-[32px] border-2 border-amber-300/70 bg-white p-7 text-center shadow-[0_25px_60px_-15px_rgba(245,158,11,0.3)] transition-transform duration-300 animate-in zoom-in-75">
            {/* Nút X đóng */}
            <button
              type="button"
              onClick={handleCloseCelebration}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
              aria-label="Đóng"
            >
              <X size={18} strokeWidth={2.5} />
            </button>

            {/* Tag danh hiệu */}
            <div className="mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100/80 px-3 py-1 text-[11px] font-extrabold tracking-wide text-amber-900">
              <Sparkles size={12} className="text-amber-600" />
              <span>PHẦN THƯỞNG HOÀN THÀNH CHẶNG</span>
            </div>

            {/* Rương bay ra với hiệu ứng nhún nhảy và quầng sáng vàng */}
            <div className="relative mx-auto mb-4 flex h-24 w-24 items-center justify-center">
              <div className="absolute h-24 w-24 animate-pulse rounded-full bg-amber-300/30 blur-md" />
              <div className="relative flex h-20 w-20 animate-bounce items-center justify-center rounded-[24px] border-[3px] border-amber-200 bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-[0_12px_28px_rgba(245,158,11,0.45)]">
                <Gift size={44} strokeWidth={2.5} />
                <Sparkles size={20} className="absolute -right-2 -top-2 text-yellow-200" />
              </div>
            </div>

            {/* Tiêu đề & nội dung */}
            <h3 className="text-xl font-black text-slate-900">Mở Rương Thành Công!</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Chúc mừng bạn đã chinh phục toàn bộ chặng học và nhận trọn vẹn phần thưởng!
            </p>

            {/* Khung số XP nhảy số từ 1 đến 50 siêu nhanh & chuyên nghiệp */}
            <div className="mx-auto my-4 flex items-center justify-center gap-2 rounded-2xl border-2 border-amber-200 bg-amber-50/90 px-6 py-2.5 shadow-inner">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-200 text-amber-700">
                <Zap size={20} className="fill-amber-500 text-amber-600" />
              </span>
              <span className="text-3xl font-black tracking-tight text-amber-600">
                +{liveCounter} XP
              </span>
            </div>

            <p className="text-[11.5px] font-bold text-emerald-600">
              {liveCounter >= claimedXp ? '✨ 50 XP đã được cộng vào tài khoản của bạn!' : 'Đang đồng bộ phần thưởng...'}
            </p>

            {/* Nút hành động 3D nổi bật */}
            <button
              type="button"
              onClick={handleCloseCelebration}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border-b-[4px] border-emerald-700 bg-emerald-600 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-600/30 transition hover:brightness-105 active:border-b-0 active:translate-y-1"
            >
              <Check size={18} strokeWidth={3} />
              <span>Tuyệt vời · Nhận ngay</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
