/**
 * Chỉ báo hạn mức DewSkill AI theo % còn lại + vòng tròn tiến trình + đếm ngược reset 00:00 GMT+7.
 */
export const AI_QUOTA_UPDATED_EVENT = 'cms:ai-quota-updated';

export function emitAiQuotaUpdated(dailyQuota) {
  if (!dailyQuota || typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(AI_QUOTA_UPDATED_EVENT, { detail: dailyQuota }));
  } catch { /* ignore */ }
}

export function formatAiResetCountdown(resetInMs, resetsAt, isEn = false) {
  let ms = Number(resetInMs);
  if (!Number.isFinite(ms) && resetsAt) {
    ms = new Date(resetsAt).getTime() - Date.now();
  }
  if (!Number.isFinite(ms)) {
    const vnNow = Date.now() + 7 * 60 * 60 * 1000;
    const dayMs = 24 * 60 * 60 * 1000;
    const elapsed = ((vnNow % dayMs) + dayMs) % dayMs;
    ms = Math.max(60 * 1000, dayMs - elapsed);
  }
  const totalMins = Math.max(1, Math.ceil(Math.max(60 * 1000, ms) / 60000));
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (isEn) {
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    return h > 0 ? `${h}h` : `${m}m`;
  }
  if (h > 0 && m > 0) return `${h}h ${m}p`;
  return h > 0 ? `${h}h` : `${m}p`;
}

export default function AiUsageIndicator({
  applies = true,
  percentLeft = 100,
  isUnlimited = false,
  aiPlan = null,
  resetInMs = null,
  resetsAt = null,
  imageDisallowed = false,
  isFreeTier = false,
  xpWallet = null,
  onUpgradeOrBuyXp = null,
  isEn = false,
  dark = false,
  className = '',
}) {
  const planActive = Boolean(
    isUnlimited
    || (aiPlan?.isUnlimited && (!aiPlan?.expiresAt || new Date(aiPlan.expiresAt).getTime() > Date.now())),
  );
  const formattedPlanExpiry = (() => {
    if (!aiPlan?.expiresAt) return '';
    const dt = new Date(aiPlan.expiresAt);
    if (Number.isNaN(dt.getTime())) return '';
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${dt.getFullYear()}`;
  })();
  const isXpMode = !planActive && Boolean(xpWallet?.mode === 'xp' && xpWallet?.applies);
  const xpTotal = Math.max(0, Number(xpWallet?.xpTotal) || 0);
  const xpAllowance = Math.max(0, Number(xpWallet?.dailyAllowanceXp) || 0);
  const xpCost = Math.max(0, Number(xpWallet?.xpCost ?? xpWallet?.aiQuestionCostXp) || 0);
  const isFreeCountMode = Boolean(isXpMode && xpWallet?.isFreeTier && Number(xpWallet?.freeDailyLimit) > 0);
  const freeLimit = isFreeCountMode ? Math.max(1, Number(xpWallet?.freeDailyLimit) || 2) : 0;
  const freeRemaining = isFreeCountMode ? Math.max(0, Number(xpWallet?.freeRemainingToday ?? 0)) : 0;
  const xpSuggestedAction = isFreeCountMode
    ? 'register_course'
    : (xpWallet?.suggestedAction || ((isFreeTier || xpWallet?.isFreeTier) ? 'upgrade_plan' : 'buy_xp'));
  const xpBlocked = isXpMode
    ? (isFreeCountMode ? freeRemaining <= 0 : (xpCost > 0 && xpTotal < xpCost))
    : false;

  const clampedPct = planActive
    ? 100
    : applies
      ? (isXpMode
        ? (isFreeCountMode
          ? (xpBlocked ? 0 : Math.max(1, Math.min(100, Math.round((freeRemaining * 100) / freeLimit))))
          : (xpBlocked ? 0 : Math.max(1, Math.min(100, Math.round((xpTotal * 100) / Math.max(xpCost || 1, xpAllowance || 100))))))
        : Math.max(0, Math.min(100, Number(percentLeft ?? 100) || 0)))
      : 100;
  const blocked = !planActive && (isXpMode ? xpBlocked : (applies && !(clampedPct > 0)));
  const ringCircumference = 2 * Math.PI * 5;
  const ringOffset = ringCircumference * (1 - clampedPct / 100);
  const ringColor = blocked ? '#ef4444' : (clampedPct <= 20 ? '#f59e0b' : '#10b981');
  const countdown = applies ? formatAiResetCountdown(resetInMs || xpWallet?.resetInMs, resetsAt || xpWallet?.resetsAt, isEn) : '';

  let labelText = '';
  if (planActive) {
    labelText = isEn
      ? `Unlimited AI${formattedPlanExpiry ? ` · Valid until ${formattedPlanExpiry}` : ''}`
      : `Không giới hạn${formattedPlanExpiry ? ` · Hạn đến ${formattedPlanExpiry}` : ''}`;
  } else if (!applies) {
    labelText = isEn
      ? '100% · Unlimited (Admin / Staff)'
      : '100% · Không giới hạn (Tài khoản quản trị)';
  } else if (isFreeCountMode) {
    if (xpBlocked) {
      labelText = isEn
        ? `0/${freeLimit} free AI questions left today · Register a course for full benefits`
        : `Đã hết ${freeLimit}/${freeLimit} câu AI miễn phí hôm nay · Đăng ký khóa học để nhận quyền lợi`;
    } else {
      labelText = isEn
        ? `Free: ${freeRemaining}/${freeLimit} AI questions left today · Register a course for full benefits`
        : `Miễn phí: còn ${freeRemaining}/${freeLimit} câu AI hôm nay · Đăng ký khóa học để nhận quyền lợi`;
    }
  } else if (isXpMode) {
    if (xpBlocked) {
      labelText = isEn
        ? '0% AI quota left today · Upgrade AI Support plan'
        : 'Đã hết dung lượng Hỗ trợ AI hôm nay · Nâng cấp gói hỗ trợ AI';
    } else {
      labelText = isEn
        ? `${clampedPct}% AI quota left · Resets in ${countdown}${imageDisallowed ? ' · No images' : ''}`
        : `Hỗ trợ AI còn ${clampedPct}% · Reset sau ${countdown}${imageDisallowed ? ' · Không gửi ảnh' : ''}`;
    }
  } else if (blocked) {
    labelText = isFreeTier || imageDisallowed
      ? (isEn
        ? `0% left · Resets in ${countdown} · Upgrade for more & images`
        : `0% còn lại · Reset sau ${countdown} · Nâng cấp để dùng thêm & gửi ảnh`)
      : (isEn
        ? `0% left · Resets in ${countdown}`
        : `0% còn lại · Reset sau ${countdown}`);
  } else {
    labelText = isEn
      ? `${clampedPct}% left · Resets in ${countdown}${imageDisallowed ? ' · No images' : ''}`
      : `${clampedPct}% còn lại · Reset sau ${countdown}${imageDisallowed ? ' · Không gửi ảnh' : ''}`;
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 text-left text-[10px] font-normal leading-snug ${
        dark
          ? (blocked ? 'text-amber-300/95' : 'text-slate-300/80')
          : (blocked
            ? 'text-amber-600/85 dark:text-amber-400/85'
            : 'text-slate-400/85 dark:text-slate-500')
      } ${className}`.trim()}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 14 14"
        aria-hidden="true"
        className="h-[13px] w-[13px] shrink-0 -rotate-90"
      >
        <circle
          cx="7"
          cy="7"
          r="5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={dark ? 'text-white/20' : 'text-slate-300/70 dark:text-slate-700'}
        />
        {clampedPct > 0 ? (
          <circle
            cx="7"
            cy="7"
            r="5"
            fill="none"
            stroke={ringColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={ringCircumference}
            strokeDashoffset={ringOffset}
          />
        ) : null}
      </svg>
      <span>{labelText}</span>
      {(blocked || isFreeCountMode) && typeof onUpgradeOrBuyXp === 'function' ? (
        <button
          type="button"
          onClick={() => onUpgradeOrBuyXp(xpSuggestedAction)}
          className="ml-1 inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 hover:bg-amber-500/25 dark:text-amber-300 cursor-pointer"
        >
          {xpSuggestedAction === 'register_course'
            ? 'Đăng ký khóa học →'
            : 'Nâng cấp gói Hỗ trợ AI →'}
        </button>
      ) : null}
    </div>
  );
}
