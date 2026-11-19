/**
 * deviceFingerprint.js - Tạo fingerprint phần cứng đồng nhất theo thiết bị vật lý
 *
 * Trước đây fingerprint dùng UUID ngẫu nhiên lưu theo từng trình duyệt (localStorage),
 * khiến việc mở nhiều trình duyệt (Chrome, Edge, Firefox, Cốc Cốc, ẩn danh) trên cùng 1 máy
 * bị tính nhầm thành nhiều thiết bị khác nhau.
 *
 * Hiện tại: tạo mã băm xác định dựa trên đặc trưng hệ điều hành + màn hình + múi giờ
 * để mọi trình duyệt trên cùng 1 thiết bị tạo ra cùng 1 định danh ổn định.
 */

function fnv1a32(input, seed = 0x811c9dc5) {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function detectClientOsFamily() {
  const ua = String(navigator?.userAgent || '');
  const platform = String(navigator?.platform || '');
  if (/Windows/i.test(ua) || /^Win/i.test(platform)) return 'windows';
  if (
    /iPad|Tablet|PlayBook|Silk|Kindle/i.test(ua)
    || (/Mac/i.test(platform) && Number(navigator?.maxTouchPoints || 0) > 1)
  ) {
    return 'ipad';
  }
  if (/iPhone|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'android' : 'android_tablet';
  if (/CrOS/i.test(ua)) return 'chromeos';
  if (/Macintosh|Mac OS X/i.test(ua) || /^Mac/i.test(platform)) return 'mac';
  if (/Linux/i.test(ua) || /^Linux/i.test(platform)) return 'linux';
  return 'other';
}

function getNormalizedScreenSignature() {
  try {
    const w = Number(window.screen?.width || 0);
    const h = Number(window.screen?.height || 0);
    const maxDim = Math.max(w, h);
    const minDim = Math.min(w, h);
    const depth = Number(window.screen?.colorDepth || 24);
    return `${maxDim}x${minDim}x${depth}`;
  } catch {
    return '0x0x24';
  }
}

function getTimeZone() {
  try {
    return String(Intl.DateTimeFormat().resolvedOptions().timeZone || '').trim() || 'UTC';
  } catch {
    return 'UTC';
  }
}

// ── Tổng hợp fingerprint ─────────────────────────────────────────────────────
export function getDeviceFingerprint() {
  if (typeof window === 'undefined') return 'server';

  const LS_KEY = 'cms_device_id_v1';
  const raw = `hw_v2|${detectClientOsFamily()}|${getNormalizedScreenSignature()}|${getTimeZone()}`;
  const id = `cms_hw_v2_${fnv1a32(raw, 0x811c9dc5)}${fnv1a32(`s2:${raw}`, 0x9e3779b9)}`;

  try {
    localStorage.setItem(LS_KEY, id);
  } catch {
    // Ignore storage quota / privacy mode errors
  }
  return id;
}

const SECRET_KEY = 'cms_device_secret_v1';

function buildScopedSecretKey(scope = null) {
  if (!scope || typeof scope !== 'object') return '';
  const role = String(scope.role || '').trim().toLowerCase();
  const identifier = String(scope.identifier || scope.phone || scope.email || '').trim().toLowerCase();
  if (!identifier) return '';
  return `${SECRET_KEY}:${role || 'user'}:${identifier}`;
}

/** Khóa chứng minh thiết bị (không phải hardware ID). Giữ bền vững qua các lần đăng xuất. */
export function getStoredDeviceSecret(scope = null) {
  try {
    const scopedKey = buildScopedSecretKey(scope);
    if (scopedKey) {
      const scopedVal = localStorage.getItem(scopedKey);
      if (scopedVal) return scopedVal;
    }
    return localStorage.getItem(SECRET_KEY) || '';
  } catch {
    return '';
  }
}

export function rememberDeviceSecret(secret, scope = null) {
  if (!secret) return;
  const value = String(secret);
  try {
    localStorage.setItem(SECRET_KEY, value);
    const scopedKey = buildScopedSecretKey(scope);
    if (scopedKey) {
      localStorage.setItem(scopedKey, value);
    }
  } catch {
    /* ignore */
  }
}

export function getDeviceAuthFields(scope = null) {
  return {
    deviceFingerprint: getDeviceFingerprint(),
    deviceKey: getDeviceFingerprint(),
    deviceSecret: getStoredDeviceSecret(scope),
  };
}
