'use strict';

const VN_PHONE_RE = /^0[35789]\d{8}$/;
const ALLOWED_INPUT_RE = /^\+?[\d\s.\-()]+$/;

function normalizeVNPhone(value) {
  const raw = String(value || '').trim();
  if (!raw || !ALLOWED_INPUT_RE.test(raw)) return '';
  if (raw.slice(1).includes('+')) return '';

  const compact = raw.replace(/[\s.\-()]/g, '');
  let canonical = compact;
  if (compact.startsWith('+84')) {
    canonical = `0${compact.slice(3)}`;
  } else if (compact.startsWith('+')) {
    return '';
  }
  return VN_PHONE_RE.test(canonical) ? canonical : '';
}

function phoneLookupVariants(value) {
  const canonical = normalizeVNPhone(value);
  if (!canonical) return [];
  const national = canonical.slice(1);
  return [...new Set([
    canonical,
    `+84${national}`,
    `84${national}`,
    canonical.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3'),
    canonical.replace(/(\d{4})(\d{3})(\d{3})/, '$1.$2.$3'),
    canonical.replace(/(\d{4})(\d{3})(\d{3})/, '$1-$2-$3'),
  ])];
}

function maskPhone(value) {
  const canonical = normalizeVNPhone(value);
  if (!canonical) return '***';
  return `${canonical.slice(0, 3)}****${canonical.slice(-3)}`;
}

module.exports = {
  normalizeVNPhone,
  phoneLookupVariants,
  maskPhone,
  VN_PHONE_RE,
};
