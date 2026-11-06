/** API trả 403 SUBSCRIPTION_EXPIRED → gate chuyển sang màn gia hạn. */
export const SUBSCRIPTION_EXPIRED_EVENT = 'cms:subscription-expired';

export const PLAN_LABELS = {
  '1m': '1 tháng',
  '3m': '3 tháng',
  '6m': '6 tháng',
  '12m': '12 tháng',
  lifetime: 'Vĩnh viễn',
};

export function formatVnd(value) {
  return `${Math.round(Number(value) || 0).toLocaleString('vi-VN')}đ`;
}

export function formatExpiryDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Dòng ngắn cho sidebar / hồ sơ. */
export function subscriptionShortLabel(subscription, options = {}) {
  if (!subscription) return '';
  const freePortal = options.freePortal === true;
  if (subscription.freeTier || (freePortal && subscription.state === 'lifetime' && !subscription.meetLifetime)) {
    return 'Gói miễn phí';
  }
  if (subscription.state === 'lifetime') return 'Gói Vĩnh viễn';
  if (subscription.state === 'expired') {
    return subscription.activated ? `Đã hết hạn ${formatExpiryDate(subscription.expiresAt)}` : 'Chưa kích hoạt';
  }
  return `Hạn: ${formatExpiryDate(subscription.expiresAt)} · còn ${subscription.daysLeft} ngày`;
}

/** Chuẩn hóa mã người dùng gõ: bỏ khoảng trắng/gạch, viết hoa, thêm gạch theo dạng TTH-XXXX-XXXX. */
export function formatActivationCodeInput(value) {
  const raw = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^TTH/, '').slice(0, 8);
  if (!raw) return '';
  return raw.length > 4 ? `TTH-${raw.slice(0, 4)}-${raw.slice(4)}` : `TTH-${raw}`;
}

export function reminderStorageKey(studentId) {
  return `cms_subscription_reminder:${studentId || 'student'}`;
}

/**
 * Mốc nhắc gia hạn (khớp cron server): còn ≤7 ngày nhắc 1 lần, ngày cuối (≤1 ngày) nhắc 1 lần.
 * Trả khóa theo kỳ hạn + mốc; null = không cần nhắc.
 */
export function reminderMilestoneKey(subscription) {
  if (subscription?.state !== 'expiring' || !subscription.expiresAt) return null;
  const milestone = Number(subscription.daysLeft) <= 1 ? 1 : 7;
  return `${subscription.expiresAt}:${milestone}`;
}
