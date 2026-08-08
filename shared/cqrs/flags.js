'use strict';

/**
 * CQRS resolution — hướng mới là mặc định khi Mongo hỗ trợ transaction.
 *
 * Priority per flag (ENABLE_CQRS_TEACHER / INVOICE / STUDENT_CREATE / FINANCE):
 *  1. Explicit "false"|"0" → tắt (escape hatch)
 *  2. Explicit "true"|"1" → bật
 *  3. Master ENABLE_CQRS=false → tắt tất cả
 *  4. Unset → bật nếu MONGODB_URI có replicaSet / mongodb+srv
 */
function envFlagExplicit(name) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const v = String(raw).toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0' || v === 'off') return false;
  return null;
}

function mongoUriLooksLikeReplicaSet(uri) {
  const u = String(uri || process.env.MONGODB_URI || '');
  return /(?:[?&]replicaSet=)|(?:mongodb\+srv:\/\/)/i.test(u);
}

function masterCqrsOff() {
  return envFlagExplicit('ENABLE_CQRS') === false;
}

function resolveCqrsFlag(name) {
  if (masterCqrsOff()) return false;
  const explicit = envFlagExplicit(name);
  if (explicit === false) return false;
  if (explicit === true) return true;
  return mongoUriLooksLikeReplicaSet();
}

function cqrsFlagsEnabled() {
  return [
    'ENABLE_CQRS_STUDENT_CREATE',
    'ENABLE_CQRS_INVOICE',
    'ENABLE_CQRS_TEACHER',
    'ENABLE_CQRS_FINANCE',
  ].some((k) => resolveCqrsFlag(k));
}

function requireReplicaOrThrow() {
  if (mongoUriLooksLikeReplicaSet()) return;
  const err = new Error(
    'Luồng mới (CQRS) cần MongoDB replica set. Đặt MONGODB_URI=?replicaSet=rs0 hoặc mongodb+srv://. ' +
    'Tạm tắt: ENABLE_CQRS=false'
  );
  err.status = 503;
  err.code = 'CQRS_REQUIRES_REPLICA_SET';
  throw err;
}

module.exports = {
  envFlagExplicit,
  resolveCqrsFlag,
  cqrsFlagsEnabled,
  mongoUriLooksLikeReplicaSet,
  requireReplicaOrThrow,
  isStudentCreateCqrs: () => resolveCqrsFlag('ENABLE_CQRS_STUDENT_CREATE'),
  isInvoiceCqrs: () => resolveCqrsFlag('ENABLE_CQRS_INVOICE'),
  isTeacherCqrs: () => resolveCqrsFlag('ENABLE_CQRS_TEACHER'),
  isFinanceCqrs: () => resolveCqrsFlag('ENABLE_CQRS_FINANCE'),
};
