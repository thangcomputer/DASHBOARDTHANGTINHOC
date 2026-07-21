/** SDT Viet Nam: 10 chu so, bat dau 0[3|5|7|8|9] */
export function isValidVNPhone(value) {
  const v = String(value || '').replace(/\s/g, '');
  return /^0[35789]\d{8}$/.test(v);
}

export function isValidEmail(value) {
  return /^[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}$/.test(String(value || '').trim());
}

export function normalizePhone(value) {
  return String(value || '').replace(/\s/g, '').trim();
}