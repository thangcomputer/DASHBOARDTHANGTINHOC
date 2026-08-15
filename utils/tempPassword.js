/**
 * Mật khẩu mặc định = SĐT/Zalo. Chỉ đổi khi user/admin chủ động đổi.
 * Fallback random nếu không có SĐT đủ dài (tối thiểu 6 ký tự theo rule auth).
 */
const crypto = require('crypto');

function generateTempPassword(length = 8) {
  const n = Math.max(6, Math.min(32, Number(length) || 8));
  return crypto.randomBytes(Math.ceil(n / 2)).toString('hex').slice(0, n);
}

/**
 * @param {{ password?: string, phone?: string, zalo?: string }} opts
 * @returns {string} plain password
 */
function resolveDefaultAccountPassword(opts = {}) {
  const explicit = opts.password != null && String(opts.password).trim() !== ''
    ? String(opts.password).trim()
    : '';
  if (explicit) return explicit;
  const contact = String(opts.phone || opts.zalo || '').trim();
  if (contact.length >= 6) return contact;
  return generateTempPassword(8);
}

module.exports = { generateTempPassword, resolveDefaultAccountPassword };
