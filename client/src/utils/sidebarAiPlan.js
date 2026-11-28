import { AI_PACKAGES } from '../data/aiPackagesData.js';

const PLAN_NAME_MAP = {
  '1d': 'Gói AI 1 Ngày',
  '1m': 'Gói AI 1 Tháng',
  '3m': 'Gói AI 3 Tháng',
  '6m': 'Gói AI 6 Tháng',
  '12m': 'Gói AI 12 Tháng',
};

function resolvePlanDisplayName(aiPlan) {
  const planKey = String(aiPlan?.plan || '').trim().toLowerCase();
  if (planKey && PLAN_NAME_MAP[planKey]) return PLAN_NAME_MAP[planKey];

  const rawLabel = String(aiPlan?.label || '').trim();
  if (rawLabel) {
    if (rawLabel.toLowerCase().startsWith('gói ai')) return rawLabel;
    if (rawLabel.toLowerCase().startsWith('gói ')) return rawLabel.replace(/^gói\s+/i, 'Gói AI ');
    return `Gói AI ${rawLabel}`;
  }

  return 'Gói AI Không giới hạn';
}

/**
 * Xác định biến thể hiển thị 4 trạng thái cho SidebarAIPlanCard.
 * @returns {'subscribed' | 'free_high' | 'free_low' | 'free_empty'}
 */
export function resolveSidebarAiCardVariant({ isSubscribed = false, quotaPercent = 100 } = {}) {
  if (isSubscribed) return 'subscribed';
  const pct = Math.max(0, Math.min(100, Math.round(Number(quotaPercent) || 0)));
  if (pct <= 0) return 'free_empty';
  if (pct <= 20) return 'free_low';
  return 'free_high';
}

/**
 * Chuyển đổi dữ liệu từ useAIQuota sang props chuẩn cho SidebarAIPlanCard.
 */
export function deriveSidebarAiPlan({
  aiQuotaPercent = 100,
  aiPlan = null,
  isPaidUnlimited = false,
  nowMs = Date.now(),
} = {}) {
  const expiresMs = aiPlan?.expiresAt ? new Date(aiPlan.expiresAt).getTime() : NaN;
  const activatedMs = aiPlan?.activatedAt ? new Date(aiPlan.activatedAt).getTime() : NaN;
  const msLeft = Number.isFinite(expiresMs) ? Math.max(0, expiresMs - nowMs) : 0;

  const isSubscribed = Boolean(
    isPaidUnlimited || (aiPlan?.isUnlimited && (!aiPlan?.expiresAt || msLeft > 0)),
  );

  const planKey = String(aiPlan?.plan || '').trim().toLowerCase();
  const pkg = planKey ? AI_PACKAGES[planKey] : null;
  const defaultDurationMs = pkg
    ? (pkg.durationHours > 0 ? pkg.durationHours * 3600e3 : pkg.durationDays * 86400e3)
    : 30 * 86400e3;

  let remainingDays = 0;
  let remainingHours = 0;
  let timeRemainingPercent = 100;

  if (isSubscribed) {
    if (!Number.isFinite(expiresMs)) {
      remainingDays = pkg?.durationDays || 30;
      remainingHours = pkg?.durationHours || remainingDays * 24;
      timeRemainingPercent = 100;
    } else if (msLeft > 0) {
      const isShortHourDisplay = (planKey === '1d' && msLeft <= 48 * 3600e3) || msLeft < 86400e3;
      if (isShortHourDisplay) {
        remainingDays = 0;
        remainingHours = Math.max(1, Math.ceil(msLeft / 3600e3));
      } else {
        remainingDays = Math.max(1, Math.ceil(msLeft / 86400e3));
        remainingHours = Math.max(1, Math.ceil(msLeft / 3600e3));
      }
      const spanMs = (Number.isFinite(activatedMs) && expiresMs > activatedMs)
        ? Math.max(defaultDurationMs, expiresMs - activatedMs)
        : defaultDurationMs;
      timeRemainingPercent = Math.max(4, Math.min(100, Math.round((msLeft / spanMs) * 100)));
    } else {
      timeRemainingPercent = 0;
    }
  }

  const quotaPercent = Math.max(
    0,
    Math.min(100, Math.round(Number(aiQuotaPercent ?? 100) || 0)),
  );
  const variant = resolveSidebarAiCardVariant({ isSubscribed, quotaPercent });

  return {
    isSubscribed,
    planName: resolvePlanDisplayName(aiPlan),
    quotaPercent,
    remainingDays,
    remainingHours,
    timeRemainingPercent,
    variant,
  };
}
