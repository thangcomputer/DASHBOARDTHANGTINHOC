/**
 * Mật khẩu tạm ngẫu nhiên — không dùng SĐT/Zalo (dễ đoán).
 */
const crypto = require('crypto');

function generateTempPassword(length = 8) {
  const n = Math.max(6, Math.min(32, Number(length) || 8));
  // hex → đủ entropy, dễ đọc/gõ trên mobile
  return crypto.randomBytes(Math.ceil(n / 2)).toString('hex').slice(0, n);
}

module.exports = { generateTempPassword };
