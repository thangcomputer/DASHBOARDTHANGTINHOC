/**
 * Chỉ báo hạn mức DewSkill AI theo % còn lại + vòng tròn tiến trình + đếm ngược reset 00:00 GMT+7.
 */
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
  resetInMs = null,
  resetsAt = null,
  imageDisallowed = false,
  isFreeTier = false,
  isEn = false,
  className = '',
}) {
  const clampedPct = applies ? Math.max(0, Math.min(100, Number(percentLeft ?? 100) || 0)) : 100;
  const blocked = applies && !(clampedPct > 0);
  const ringCircumference = 2 * Math.PI * 5;
  const ringOffset = ringCircumference * (1 - clampedPct / 100);
  const ringColor = blocked ? '#ef4444' : (clampedPct <= 20 ? '#f59e0b' : '#10b981');
  const countdown = applies ? formatAiResetCountdown(resetInMs, resetsAt, isEn) : '';

  let labelText = '';
  if (!applies) {
    labelText = isEn
      ? '100% · Unlimited (Admin / Staff)'
      : '100% · Không giới hạn (Tài khoản quản trị)';
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
      className={`flex items-center gap-1.5 text-left text-[10px] font-normal leading-snug ${
        blocked
          ? 'text-amber-600/85 dark:text-amber-400/85'
          : 'text-slate-400/85 dark:text-slate-500'
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
          className="text-slate-300/70 dark:text-slate-700"
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
    </div>
  );
}
