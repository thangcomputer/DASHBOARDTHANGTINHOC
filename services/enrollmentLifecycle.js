/**
 * Enrollment lifecycle — state machine (ADR 0004 / Phase 6).
 */
const ENROLLMENT_STATUSES = Object.freeze([
  'pending_payment',
  'active',
  'paused',
  'completed',
  'cancelled',
  'refunded',
]);

/** Transition map: from → allowed to */
const TRANSITIONS = Object.freeze({
  pending_payment: ['active', 'cancelled'],
  active: ['paused', 'completed', 'cancelled', 'refunded'],
  paused: ['active', 'cancelled'],
  completed: ['refunded'], // hiếm; giữ lịch sử
  cancelled: [],
  refunded: [],
});

function isValidEnrollmentStatus(status) {
  return ENROLLMENT_STATUSES.includes(String(status || ''));
}

function canTransitionEnrollment(from, to) {
  const f = String(from || 'active');
  const t = String(to || '');
  if (f === t) return true;
  const allowed = TRANSITIONS[f];
  if (!allowed) return false;
  return allowed.includes(t);
}

/**
 * @throws Error status 400 nếu không hợp lệ
 */
function assertEnrollmentTransition(from, to) {
  if (!isValidEnrollmentStatus(to)) {
    const err = new Error(`Trạng thái enrollment không hợp lệ: ${to}`);
    err.status = 400;
    throw err;
  }
  if (!canTransitionEnrollment(from, to)) {
    const err = new Error(`Không thể chuyển enrollment từ "${from}" sang "${to}"`);
    err.status = 400;
    throw err;
  }
}

/** Quyền học theo status (AccessGrant logic nhẹ — Phase 6). */
function computeLearningAccess(status, explicit) {
  if (typeof explicit === 'boolean') return explicit;
  return status === 'active' || status === 'paused';
}

function applyEnrollmentStatus(enrollment, nextStatus, { learningAccess } = {}) {
  const from = enrollment.status || 'active';
  assertEnrollmentTransition(from, nextStatus);
  enrollment.status = nextStatus;
  enrollment.learningAccess = computeLearningAccess(nextStatus, learningAccess);
  if (nextStatus === 'active' && !enrollment.activatedAt) {
    enrollment.activatedAt = new Date();
  }
  if (nextStatus === 'completed' && !enrollment.completedAt) {
    enrollment.completedAt = new Date();
  }
  return enrollment;
}

function grantLearningAccess(enrollment) {
  if (enrollment.status === 'pending_payment') {
    applyEnrollmentStatus(enrollment, 'active');
  } else {
    enrollment.learningAccess = true;
  }
  return enrollment;
}

function revokeLearningAccess(enrollment) {
  enrollment.learningAccess = false;
  return enrollment;
}

module.exports = {
  ENROLLMENT_STATUSES,
  TRANSITIONS,
  isValidEnrollmentStatus,
  canTransitionEnrollment,
  assertEnrollmentTransition,
  computeLearningAccess,
  applyEnrollmentStatus,
  grantLearningAccess,
  revokeLearningAccess,
};
