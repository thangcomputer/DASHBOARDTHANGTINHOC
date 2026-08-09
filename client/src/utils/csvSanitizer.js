/**
 * CSV injection prevention utility for frontend exports.
 * Protects against formula injection starting with =, +, -, @, \t, \r
 */
export function sanitizeCsvField(field) {
  const s = String(field || '').replace(/,/g, ' ');
  if (/^[=+\-@\t\r]/.test(s)) {
    return "'" + s;
  }
  return s;
}
