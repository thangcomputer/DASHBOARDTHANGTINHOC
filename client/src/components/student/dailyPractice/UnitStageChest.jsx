import { useState } from 'react';
import { Check, Gift, Loader2, Lock, Sparkles } from 'lucide-react';
import dailyPracticeApi from '../../../services/dailyPracticeApi';
import { gameSounds } from '../../../utils/sound';

export const UNIT_CHEST_REWARD_XP = 50;

export function unitStepProgress(unit) {
  const steps = Array.isArray(unit?.steps) ? unit.steps : [];
  const totalSteps = steps.length;
  const doneSteps = steps.filter((step) => step.state === 'completed').length;
  return { doneSteps, totalSteps };
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

  const handleClaim = async () => {
    if (!claimable || claiming) return;
    setClaimError('');
    setClaiming(true);
    gameSounds.tap();
    try {
      const result = await dailyPracticeApi.student.claimUnitChest(unit.id);
      if (result?.xp > 0) gameSounds.win();
      onClaimed?.(result);
    } catch (err) {
      setClaimError(err?.message || 'Không mở được rương');
    } finally {
      setClaiming(false);
    }
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

  if (claimable) {
    return (
      <button
        type="button"
        disabled={claiming}
        onClick={handleClaim}
        className={`${boxClass} duo-pressable cursor-pointer transition hover:brightness-[1.02] disabled:opacity-80`}
        aria-label={`Mở rương chặng, nhận ${rewardXp} XP`}
      >
        {body}
      </button>
    );
  }

  return <div className={boxClass}>{body}</div>;
}
