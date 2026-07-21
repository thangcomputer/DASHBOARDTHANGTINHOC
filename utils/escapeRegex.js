/**
 * Escape chuỗi user input trước khi dùng trong MongoDB $regex — tránh ReDoS.
 */
function escapeRegex(str) {
  if (str == null || typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegex };
