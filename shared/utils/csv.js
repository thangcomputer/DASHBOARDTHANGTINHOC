/**
 * CSV injection prevention utility.
 * Protects against formula injection starting with =, +, -, @, \t, \r
 */
function sanitizeCsvField(field) {
  const s = String(field || '').replace(/,/g, ' ');
  if (/^[=+\-@\t\r]/.test(s)) {
    return "'" + s;
  }
  return s;
}

module.exports = {
  sanitizeCsvField,
};
