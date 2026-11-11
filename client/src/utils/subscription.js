/** API trả 403 SUBSCRIPTION_EXPIRED → gate chuyển sang màn gia hạn. */
export const SUBSCRIPTION_EXPIRED_EVENT = 'cms:subscription-expired';

export const PLAN_LABELS = {
  '1m': '1 tháng',
  '3m': '3 tháng',
  '6m': '6 tháng',
  '12m': '1 năm',
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
  if (options.isCourseStudent === true) return 'Gói Khóa học · Khóa chính thức';
  const freePortal = options.freePortal === true;
  const hasActivePaid = subscription.state === 'active' || subscription.state === 'expiring' || Boolean(subscription.meetLifetime);
  if (!hasActivePaid && (subscription.freeTier || subscription.state === 'free' || (freePortal && !subscription.meetLifetime))) {
    return 'Gói miễn phí';
  }
  if (subscription.state === 'lifetime') return 'Gói Vĩnh viễn';
  if (subscription.state === 'expired') {
    return subscription.activated ? `Đã hết hạn ${formatExpiryDate(subscription.expiresAt)}` : 'Chưa kích hoạt';
  }
  return `Gói ${subscription.planLabel || ''} · còn ${subscription.daysLeft} ngày`;
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

/** Khớp server `hasMeetAccess`: cổng miễn phí đã mua gói Meet còn hạn. */
export function hasMeetAccessClient(subscription) {
  if (!subscription) return false;
  if (subscription.state === 'expired' || subscription.freeTier || subscription.state === 'free') return false;
  return Boolean(subscription.meetLifetime || subscription.state === 'active' || subscription.state === 'expiring');
}

/**
 * Quyền đăng bảng tin:
 * - Đã mua gói và còn hạn (active, expiring, lifetime): MỞ (true)
 * - Chưa đăng ký gói (free, freeTier) hoặc hết hạn (expired): KHÓA (false)
 */
export function hasFeedPostAccess({ role, session, subscription }) {
  if (role !== 'student') return true;
  const sub = subscription || session?.subscription;
  if (!sub) {
    if (session?.freePortal === true) return false;
    return false;
  }
  const state = sub.state;
  if (state === 'expired' || state === 'free' || sub.freeTier) return false;
  if (state === 'active' || state === 'expiring') return true;
  if (state === 'lifetime') {
    if (session?.freePortal === true) return Boolean(sub.meetLifetime || sub.activated);
    return true;
  }
  return false;
}

export function isFeedPostLocked({ role, session, subscription }) {
  return !hasFeedPostAccess({ role, session, subscription });
}
