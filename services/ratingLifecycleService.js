/**
 * Teacher rating moderation (Phase 11 / ADR 0003).
 * pending → approved | rejected; approved → hidden
 * Public aggregate chỉ đếm approved (+ legacy không có status).
 */
const Evaluation = require('../models/Evaluation');
const Student = require('../models/Student');
const { writeAudit } = require('./auditLogService');
const NotificationService = require('./NotificationService');
const { DEEP_LINKS } = require('../constants/deepLinks');
const logger = require('../config/logger');

const RATING_STATUSES = Object.freeze(['pending', 'approved', 'rejected', 'hidden']);

const TRANSITIONS = Object.freeze({
  pending: ['approved', 'rejected'],
  approved: ['hidden', 'rejected'],
  rejected: ['pending'], // cho phép mở lại để sửa hiếm
  hidden: ['approved'],
});

const RATING_WINDOW_DAYS = Math.max(1, parseInt(process.env.RATING_WINDOW_DAYS || '30', 10) || 30);
const REQUIRE_MODERATION = process.env.RATING_REQUIRE_MODERATION !== '0';

function isValidRatingStatus(status) {
  return RATING_STATUSES.includes(String(status || ''));
}

function canTransitionRating(from, to) {
  const f = String(from || 'pending');
  const t = String(to || '');
  if (f === t) return true;
  const allowed = TRANSITIONS[f];
  return Array.isArray(allowed) && allowed.includes(t);
}

function assertRatingTransition(from, to) {
  if (!isValidRatingStatus(to)) {
    const err = new Error(`Trạng thái rating không hợp lệ: ${to}`);
    err.status = 400;
    throw err;
  }
  if (!canTransitionRating(from, to)) {
    const err = new Error(`Không thể chuyển rating từ "${from}" sang "${to}"`);
    err.status = 400;
    throw err;
  }
}

/** Mongo filter — chỉ rating public (approved). Legacy không có status = đã public trước Phase 11. */
function publicRatingFilter(extra = {}) {
  return {
    type: 'teacher_rating',
    $or: [
      { status: 'approved' },
      { status: { $exists: false } },
      { status: null },
    ],
    ...extra,
  };
}

function isPublicRating(doc) {
  if (!doc || doc.type !== 'teacher_rating') return false;
  if (doc.status == null || doc.status === undefined) return true; // legacy
  return doc.status === 'approved';
}

function extractStars(criteria = {}, explicitStars) {
  if (Number.isFinite(Number(explicitStars))) {
    return Math.min(5, Math.max(1, Math.round(Number(explicitStars) * 10) / 10));
  }
  if (criteria && Number.isFinite(Number(criteria.stars))) {
    return Math.min(5, Math.max(1, Math.round(Number(criteria.stars) * 10) / 10));
  }
  return null;
}

/**
 * Tìm enrollment đủ điều kiện đánh giá GV.
 */
function findEligibleEnrollment(student, teacherId, enrollmentId = null) {
  const enrollments = Array.isArray(student?.enrollments) ? student.enrollments : [];
  const tid = String(teacherId || '');
  let list = enrollments.filter((e) => {
    if (enrollmentId && String(e._id) !== String(enrollmentId)) return false;
    if (e.teacherId && String(e.teacherId) !== tid) return false;
    return true;
  });
  if (!list.length && !enrollmentId) {
    // fallback: primary / any completed
    list = enrollments.slice();
  }

  const completed = list.filter((e) => String(e.status || '') === 'completed');
  if (completed.length) return completed[0];

  // legacy: HV gắn teacherId top-level + đủ buổi
  if (
    student?.teacherId
    && String(student.teacherId) === tid
    && Number(student.completedSessions || 0) >= Number(student.totalSessions || 12)
  ) {
    return {
      _id: enrollmentId || 'legacy',
      status: 'completed',
      completedAt: student.updatedAt || new Date(),
      teacherId: student.teacherId,
    };
  }
  return null;
}

function withinRatingWindow(enrollment, now = new Date()) {
  if (!enrollment) return false;
  const completedAt = enrollment.completedAt
    ? new Date(enrollment.completedAt)
    : null;
  if (!completedAt || Number.isNaN(completedAt.getTime())) {
    // completed nhưng chưa có completedAt — cho phép trong Phase 11
    return true;
  }
  const ms = RATING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() - completedAt.getTime() <= ms;
}

/**
 * Submit hoặc cập nhật pending rating.
 */
async function submitTeacherRating({
  studentId,
  targetTeacherId,
  courseId = null,
  enrollmentId = null,
  criteria = {},
  content = '',
  studentName = '',
  teacherName = '',
  courseName = '',
  milestone = '',
  stars: explicitStars,
  actor = {},
  io = null,
  reqMeta = {},
  requireModeration = REQUIRE_MODERATION,
}) {
  const student = await Student.findById(studentId);
  if (!student) {
    const err = new Error('Không tìm thấy học viên');
    err.status = 404;
    throw err;
  }

  const eligible = findEligibleEnrollment(student, targetTeacherId, enrollmentId);
  const teacherMatches = student.teacherId && String(student.teacherId) === String(targetTeacherId);
  if (!eligible && !milestone && !teacherMatches) {
    const err = new Error(
      'Chỉ được đánh giá giảng viên phụ trách sau khi hoàn thành khóa (hoặc theo milestone)',
    );
    err.status = 403;
    err.code = 'RATING_NOT_ELIGIBLE';
    throw err;
  }
  if (eligible && !milestone && !withinRatingWindow(eligible)) {
    const err = new Error(
      `Đã quá thời hạn đánh giá (${RATING_WINDOW_DAYS} ngày sau khi hoàn thành)`,
    );
    err.status = 403;
    err.code = 'RATING_WINDOW_EXPIRED';
    throw err;
  }

  const stars = extractStars(criteria, explicitStars);
  const enrId = enrollmentId
    || (eligible && eligible._id && eligible._id !== 'legacy' ? String(eligible._id) : '');

  const status = requireModeration ? 'pending' : 'approved';
  const criteriaPayload = { ...(criteria || {}) };
  if (stars != null) criteriaPayload.stars = stars;

  // 1 rating hiệu lực / (student, teacher, enrollment) — update nếu còn pending
  const uniqFilter = {
    type: 'teacher_rating',
    studentId,
    targetTeacherId,
    status: { $in: ['pending', 'approved', 'hidden'] },
  };
  if (enrId) uniqFilter.enrollmentId = enrId;

  let existing = await Evaluation.findOne(uniqFilter).sort({ createdAt: -1 });
  if (existing && existing.status === 'approved') {
    const err = new Error('Bạn đã có đánh giá được duyệt cho giảng viên này');
    err.status = 409;
    err.code = 'RATING_ALREADY_APPROVED';
    throw err;
  }

  let doc;
  let created = false;
  if (existing && existing.status === 'pending') {
    existing.criteria = criteriaPayload;
    existing.content = content;
    existing.studentName = studentName || student.name || existing.studentName;
    existing.teacherName = teacherName || existing.teacherName;
    existing.courseName = courseName || existing.courseName;
    existing.milestone = milestone || existing.milestone;
    existing.stars = stars;
    existing.enrollmentId = enrId || existing.enrollmentId;
    if (courseId) existing.courseId = courseId;
    await existing.save();
    doc = existing;
  } else if (existing && existing.status === 'hidden') {
    const err = new Error('Đánh giá đã bị ẩn — liên hệ Admin nếu cần mở lại');
    err.status = 409;
    throw err;
  } else {
    doc = await Evaluation.create({
      studentId,
      targetTeacherId,
      courseId: courseId || undefined,
      enrollmentId: enrId,
      studentName: studentName || student.name || '',
      teacherName,
      courseName,
      milestone,
      type: 'teacher_rating',
      criteria: criteriaPayload,
      content,
      stars,
      status,
      moderatedBy: requireModeration ? null : (actor.id || null),
      moderatedAt: requireModeration ? null : new Date(),
      moderationNote: requireModeration ? '' : 'auto-approve (moderation off)',
    });
    created = true;
  }

  try {
    await writeAudit({
      action: created ? 'rating.submit' : 'rating.update_pending',
      actorUserId: actor.id || String(studentId),
      actorRole: actor.role || 'student',
      branchId: reqMeta.branchId || student.branchId || null,
      entityType: 'evaluation',
      entityId: String(doc._id),
      studentId,
      teacherId: targetTeacherId,
      oldValue: {},
      newValue: { status: doc.status, stars: doc.stars },
      ip: reqMeta.ip || '',
      userAgent: reqMeta.userAgent || '',
    });
  } catch (err) {
    logger.warn('[rating] audit submit: %s', err.message);
  }

  // Chỉ notify GV khi đã approved (auto-approve)
  if (io && doc.status === 'approved') {
    await notifyTeacherApproved(io, doc, student);
  }

  return { evaluation: doc, created, status: doc.status };
}

async function notifyTeacherApproved(io, evaluation, student) {
  try {
    await NotificationService.send(io, {
      type: 'EVALUATION',
      title: '⭐ Đánh giá mới từ học viên',
      content: `Học viên ${student?.name || evaluation.studentName || 'HV'} đã đánh giá bạn${evaluation.stars ? ` ${evaluation.stars}/5` : ''}.`,
      receivers: [String(evaluation.targetTeacherId)],
      payload: { evaluationId: String(evaluation._id), status: 'approved' },
      link: DEEP_LINKS.TEACHER_HOME || '/teacher',
      eventId: `rating.approved:${evaluation._id}`,
    });
    io.to(`teacher_${evaluation.targetTeacherId}`).emit('evaluation:teacher_rating', evaluation);
    io.emit('data:refresh', { type: 'evaluation', targetId: evaluation.targetTeacherId });
  } catch (err) {
    logger.warn('[rating] notify teacher: %s', err.message);
  }
}

/**
 * Admin/Staff moderate: approve | reject | hide
 */
async function moderateRating({
  evaluationId,
  action,
  reason = '',
  actor = {},
  io = null,
  reqMeta = {},
}) {
  const map = {
    approve: 'approved',
    approved: 'approved',
    reject: 'rejected',
    rejected: 'rejected',
    hide: 'hidden',
    hidden: 'hidden',
  };
  const next = map[String(action || '').toLowerCase()];
  if (!next) {
    const err = new Error('action phải là approve | reject | hide');
    err.status = 400;
    throw err;
  }

  const doc = await Evaluation.findById(evaluationId);
  if (!doc || doc.type !== 'teacher_rating') {
    const err = new Error('Không tìm thấy đánh giá giảng viên');
    err.status = 404;
    throw err;
  }

  const from = doc.status || 'pending';
  assertRatingTransition(from, next);

  const oldValue = { status: from };
  doc.status = next;
  doc.moderatedBy = actor.id && String(actor.id).match(/^[a-f\d]{24}$/i) ? actor.id : null;
  doc.moderatedAt = new Date();
  doc.moderationNote = String(reason || '').slice(0, 500);
  await doc.save();

  try {
    await writeAudit({
      action: `rating.${next}`,
      actorUserId: actor.id || '',
      actorRole: actor.role || '',
      branchId: reqMeta.branchId || null,
      entityType: 'evaluation',
      entityId: String(doc._id),
      studentId: doc.studentId,
      teacherId: doc.targetTeacherId,
      oldValue,
      newValue: { status: next, reason: doc.moderationNote },
      ip: reqMeta.ip || '',
      userAgent: reqMeta.userAgent || '',
    });
  } catch (err) {
    logger.warn('[rating] audit moderate: %s', err.message);
  }

  if (io && next === 'approved') {
    const student = await Student.findById(doc.studentId).select('name').lean();
    await notifyTeacherApproved(io, doc, student);
  }

  return doc;
}

function aggregateStars(ratings = []) {
  const publicOnes = ratings.filter(isPublicRating);
  if (!publicOnes.length) return { avg: 0, count: 0, ratings: [] };
  const sum = publicOnes.reduce((s, r) => {
    const stars = extractStars(r.criteria, r.stars) || 0;
    return s + stars;
  }, 0);
  const avg = Math.round((sum / publicOnes.length) * 10) / 10;
  return { avg, count: publicOnes.length, ratings: publicOnes };
}

module.exports = {
  RATING_STATUSES,
  TRANSITIONS,
  RATING_WINDOW_DAYS,
  REQUIRE_MODERATION,
  isValidRatingStatus,
  canTransitionRating,
  assertRatingTransition,
  publicRatingFilter,
  isPublicRating,
  extractStars,
  findEligibleEnrollment,
  withinRatingWindow,
  submitTeacherRating,
  moderateRating,
  aggregateStars,
};
