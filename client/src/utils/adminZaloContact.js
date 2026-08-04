/** Zalo Admin hỗ trợ cấp mật khẩu / tư vấn (hotline trung tâm). */
export const ADMIN_ZALO_PHONE = import.meta.env.VITE_SUPPORT_PHONE || '';

export function buildForgotPasswordZaloMessage({ name, phone, role }) {
  const roleLabel = role === 'teacher' ? 'Giảng viên' : 'Học viên';
  const safeName = String(name || '').trim() || '(chưa rõ tên)';
  const safePhone = String(phone || '').trim();
  return (
    `[THẮNG TIN HỌC] Yêu cầu cấp lại mật khẩu\n`
    + `\n`
    + `Vai trò: ${roleLabel}\n`
    + `Họ tên: ${safeName}\n`
    + `SĐT: ${safePhone}\n`
    + `\n`
    + `Anh/chị Admin vui lòng cấp mật khẩu mới giúp em. Xin cảm ơn!`
  );
}

export function adminZaloUrl(message = '') {
  const base = `https://zalo.me/${ADMIN_ZALO_PHONE}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}

/** Chỉ copy tin nhắn. */
export async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Chỉ mở Zalo Admin (có sẵn text nếu truyền message). */
export function openAdminZalo(message = '') {
  const url = adminZaloUrl(message);
  window.open(url, '_blank', 'noopener,noreferrer');
  return url;
}

/**
 * Copy tin nhắn vào clipboard rồi mở chat Zalo Admin.
 * @returns {Promise<{ copied: boolean, url: string }>}
 */
export async function openAdminZaloWithMessage(message) {
  const copied = await copyTextToClipboard(message);
  const url = openAdminZalo(message);
  return { copied, url };
}
