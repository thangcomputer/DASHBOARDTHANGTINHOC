'use strict';

/**
 * CQRS strangler feature flags.
 * Only "true" / "1" enable a path (safe default = legacy).
 */
function envFlagOn(name) {
  const v = String(process.env[name] || '').toLowerCase();
  return v === 'true' || v === '1';
}

function cqrsFlagsEnabled() {
  return [
    'ENABLE_CQRS_STUDENT_CREATE',
    'ENABLE_CQRS_INVOICE',
    'ENABLE_CQRS_TEACHER',
  ].some((k) => envFlagOn(k));
}

function mongoUriLooksLikeReplicaSet(uri) {
  const u = String(uri || '');
  return /(?:[?&]replicaSet=)|(?:mongodb\+srv:\/\/)/i.test(u);
}

module.exports = {
  envFlagOn,
  cqrsFlagsEnabled,
  mongoUriLooksLikeReplicaSet,
  isStudentCreateCqrs: () => envFlagOn('ENABLE_CQRS_STUDENT_CREATE'),
  isInvoiceCqrs: () => envFlagOn('ENABLE_CQRS_INVOICE'),
  isTeacherCqrs: () => envFlagOn('ENABLE_CQRS_TEACHER'),
};
