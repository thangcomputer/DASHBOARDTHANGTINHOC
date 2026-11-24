/**
 * CSV injection prevention utility for frontend exports.
 * Protects against formula injection starting with =, +, -, @, \t, \r
 * while preserving numeric values (including negative integers/decimals).
 */
export function sanitizeCsvField(field) {
  if (field === null || field === undefined) return '';
  if (typeof field === 'number') {
    return Number.isFinite(field) ? String(field) : '';
  }
  const s = String(field);
  if (/^-?\d+(\.\d+)?$/.test(s.trim())) {
    return s.trim();
  }
  if (/^[=+\-@\t\r]/.test(s)) {
    return `'${s}`;
  }
  return s;
}
