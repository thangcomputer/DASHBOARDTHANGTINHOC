/**
 * Điều khiển nhấp nháy Favicon + Tiêu đề tab trình duyệt + App Badge (PWA) khi có tin nhắn/thông báo chưa đọc.
 */

export const TAB_ATTENTION_EVENT = 'cms:tab-attention';

const MAX_FAVICON_CACHE = 40;
const badgedFaviconCache = new Map();

let currentAttention = {
  unreadMessages: 0,
  unreadNotifications: 0,
};

export function formatBadgeCount(count) {
  const n = Math.floor(Number(count) || 0);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n > 99) return '99+';
  return String(n);
}

export function buildAttentionTitle({
  baseTitle = 'Thắng Tin Học',
  unreadMessages = 0,
  unreadNotifications = 0,
  phase = 0,
  lang = 'vi',
} = {}) {
  const cleanBase = String(baseTitle || 'Thắng Tin Học').trim() || 'Thắng Tin Học';
  const msgCount = Math.max(0, Math.floor(Number(unreadMessages) || 0));
  const notifCount = Math.max(0, Math.floor(Number(unreadNotifications) || 0));
  const total = msgCount + notifCount;
  if (total <= 0) return cleanBase;

  const isEn = String(lang || '').toLowerCase() === 'en';
  if (Math.abs(Math.floor(Number(phase) || 0)) % 2 === 1) {
    if (msgCount > 0 && notifCount > 0) {
      return isEn
        ? `🔴 (${total}) New messages & alerts!`
        : `🔴 (${total}) Tin nhắn & thông báo mới!`;
    }
    if (msgCount > 0) {
      return isEn
        ? `💬 (${total}) New message!`
        : `💬 (${total}) Tin nhắn mới!`;
    }
    return isEn
      ? `🔔 (${total}) New notification!`
      : `🔔 (${total}) Thông báo mới!`;
  }

  return `(${total}) ${cleanBase}`;
}

export function syncNavigatorAppBadge(nav, count) {
  const targetNav = nav !== undefined ? nav : (typeof navigator !== 'undefined' ? navigator : null);
  if (!targetNav) return;
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  try {
    if (safeCount > 0 && typeof targetNav.setAppBadge === 'function') {
      Promise.resolve(targetNav.setAppBadge(safeCount)).catch(() => {});
    } else if (safeCount <= 0 && typeof targetNav.clearAppBadge === 'function') {
      Promise.resolve(targetNav.clearAppBadge()).catch(() => {});
    }
  } catch { /* ignore unsupported browsers */ }
}

export function getCurrentTabAttention() {
  return { ...currentAttention };
}

export function emitTabAttention({ unreadMessages = 0, unreadNotifications = 0 } = {}) {
  const next = {
    unreadMessages: Math.max(0, Math.floor(Number(unreadMessages) || 0)),
    unreadNotifications: Math.max(0, Math.floor(Number(unreadNotifications) || 0)),
  };
  if (
    currentAttention.unreadMessages === next.unreadMessages
    && currentAttention.unreadNotifications === next.unreadNotifications
  ) {
    return;
  }
  currentAttention = next;
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(TAB_ATTENTION_EVENT, { detail: { ...next } }));
  } catch { /* ignore */ }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Favicon load error'));
    img.src = src;
  });
}

function drawRoundedRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawFallbackBaseIcon(ctx, size) {
  ctx.fillStyle = '#10B981';
  drawRoundedRectPath(ctx, 4, 4, size - 8, size - 8, 14);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('T', size / 2, size / 2 + 2);
}

/**
 * Vẽ chấm đỏ + số lượng chưa đọc lên favicon (hỗ trợ 2 phase nhấp nháy 0 / 1).
 */
export async function renderBadgedFaviconDataUrl(baseHref, count, blinkPhase = 0) {
  if (typeof document === 'undefined') return null;
  const label = formatBadgeCount(count);
  if (!label) return null;

  const phase = Math.abs(Math.floor(Number(blinkPhase) || 0)) % 2;
  const cacheKey = `${String(baseHref || '')}|${label}|${phase}`;
  if (badgedFaviconCache.has(cacheKey)) {
    return badgedFaviconCache.get(cacheKey);
  }

  try {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (baseHref) {
      try {
        const img = await loadImage(baseHref);
        ctx.drawImage(img, 0, 0, size, size);
      } catch {
        drawFallbackBaseIcon(ctx, size);
      }
    } else {
      drawFallbackBaseIcon(ctx, size);
    }

    const isWide = label.length >= 2;
    const badgeW = label.length >= 3 ? 44 : isWide ? 38 : 32;
    const badgeH = 32;
    const bx = size - badgeW - 1;
    const by = 1;

    if (phase === 1) {
      // Phase nháy sáng: thêm vòng quầng cam-đỏ nổi bật ở góc trên phải
      ctx.save();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.42)';
      drawRoundedRectPath(ctx, Math.max(0, bx - 4), 0, Math.min(size, badgeW + 5), badgeH + 5, 18);
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = phase === 1 ? '#F97316' : '#EF4444';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    drawRoundedRectPath(ctx, bx, by, badgeW, badgeH, badgeH / 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `900 ${label.length >= 3 ? 17 : 20}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + badgeW / 2, by + badgeH / 2 + 1);

    let dataUrl = null;
    try {
      dataUrl = canvas.toDataURL('image/png');
    } catch {
      // Nếu ảnh gốc từ origin khác làm tainted canvas → vẽ lại với icon dự phòng
      ctx.clearRect(0, 0, size, size);
      drawFallbackBaseIcon(ctx, size);
      ctx.fillStyle = phase === 1 ? '#F97316' : '#EF4444';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 4;
      drawRoundedRectPath(ctx, bx, by, badgeW, badgeH, badgeH / 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `900 ${label.length >= 3 ? 17 : 20}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, bx + badgeW / 2, by + badgeH / 2 + 1);
      dataUrl = canvas.toDataURL('image/png');
    }

    if (dataUrl) {
      if (badgedFaviconCache.size >= MAX_FAVICON_CACHE) {
        const oldestKey = badgedFaviconCache.keys().next().value;
        badgedFaviconCache.delete(oldestKey);
      }
      badgedFaviconCache.set(cacheKey, dataUrl);
    }
    return dataUrl;
  } catch {
    return null;
  }
}
