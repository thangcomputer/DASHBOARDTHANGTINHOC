/**
 * Exam attempt lifecycle (Phase 9 / ADR 0004).
 *
 * Canonical: locked → unlocked → in_progress → submitted → graded → pass|fail
 *                                                         ↘ void | violation
 *
 * Legacy UI statuses map 1:1 khi lưu trên Student.examProgress.status:
 *   chua_thi ↔ locked|unlocked (phụ thuộc studentExamUnlocked)
 *   dang_thi ↔ in_progress
 *   dat ↔ pass
 *   khong_dat ↔ fail
 *   + submitted | void | violation (mới, tương thích đọc)
 */
const Student = require('../models/Student');
const { writeAudit } = require('./auditLogService');
const NotificationService = require('./NotificationService');
const { DEEP_LINKS } = require('../constants/deepLinks');
const logger = require('../config/logger');
const { legacyEnrollmentFromStudent } = require('./enrollmentService');

const CANONICAL = Object.freeze([
  'locked',
  'unlocked',
  'in_progress',
  'submitted',
  'graded',
  'pass',
  'fail',
  'void',
  'violation',
]);

const LEGACY = Object.freeze(['chua_thi', 'dang_thi', 'dat', 'khong_dat']);

/** Transition map (canonical). Same-state allowed. */
const TRANSITIONS = Object.freeze({
  locked: ['unlocked', 'void'],
  unlocked: ['in_progress', 'locked', 'void', 'fail', 'violation'],
  in_progress: ['submitted', 'pass', 'fail', 'violation', 'void', 'in_progress'],
  submitted: ['graded', 'pass', 'fail', 'void', 'violation'],
  graded: ['pass', 'fail', 'void'],
  pass: ['void', 'unlocked'], // retake grant → unlocked/chua_thi
  fail: ['unlocked', 'void'], // retake
  violation: ['unlocked', 'void'],
  void: [],
});

function toCanonical(status, { roomUnlocked = true } = {}) {
  const s = String(status || '').trim();
  if (CANONICAL.includes(s)) return s;
  if (s === 'dang_thi') return 'in_progress';
  if (s === 'dat') return 'pass';
  if (s === 'khong_dat') return 'fail';
  if (s === 'chua_thi' || !s) return roomUnlocked ? 'unlocked' : 'locked';
  return s;
}

function toLegacyStorage(canonical) {
  const c = String(canonical || '');
  if (c === 'in_progress') return 'dang_thi';
  if (c === 'pass' || c === 'graded') return 'dat';
  if (c === 'fail') return 'khong_dat';
  if (c === 'locked' || c === 'unlocked') return 'chua_thi';
  // submitted | void | violation — lưu thẳng để UI/API mới đọc được
  if (['submitted', 'void', 'violation'].includes(c)) return c;
  if (LEGACY.includes(c)) return c;
  return c;
}

function isValidExamStatus(status) {
  const s = String(status || '');
  return CANONICAL.includes(s) || LEGACY.includes(s) || ['submitted', 'void', 'violation'].includes(s);
}

function canTransitionExam(from, to, opts = {}) {
  const f = toCanonical(from, opts);
  const t = toCanonical(to, opts);
  if (f === t) return true;
  const allowed = TRANSITIONS[f];
  if (!allowed) return false;
  return allowed.includes(t);
}

function assertExamTransition(from, to, opts = {}) {
  if (!isValidExamStatus(to) && !CANONICAL.includes(toCanonical(to, opts))) {
    const err = new Error(`Trạng thái thi không hợp lệ: ${to}`);
    err.status = 400;
    throw err;
  }
  if (!canTransitionExam(from, to, opts)) {
    const err = new Error(
      `Không thể chuyển trạng thái thi từ "${from || 'locked'}" sang "${to}"`,
    );
    err.status = 400;
    throw err;
  }
}

/**
 * Chuẩn hóa changes.status qua SM; trả về status lưu (legacy-compatible).
 */
function normalizeAttemptStatusChange(existingEntry, rawStatus, { roomUnlocked = true } = {}) {
  if (rawStatus == null || rawStatus === '') return undefined;
  const from = existingEntry?.attemptStatus
    || toCanonical(existingEntry?.status, { roomUnlocked });
  const toCanon = toCanonical(rawStatus, { roomUnlocked });
  assertExamTransition(from, toCanon, { roomUnlocked });
  return {
    attemptStatus: toCanon,
    status: toLegacyStorage(toCanon),
  };
}

async function writeExamAudit({
  action,
  actor = {},
  student,
  subjectId = null,
  oldValue = {},
  newValue = {},
  reqMeta = {},
}) {
  try {
    await writeAudit({
      action,
      actorUserId: actor.id || '',
      actorRole: actor.role || '',
      branchId: reqMeta.branchId || student?.branchId || null,
      entityType: 'exam',
      entityId: subjectId ? `${student._id}:${subjectId}` : String(student._id),
      studentId: student._id,
      teacherId: student.teacherId || null,
      oldValue,
      newValue,
      ip: reqMeta.ip || '',
      userAgent: reqMeta.userAgent || '',
    });
  } catch (err) {
    logger.warn('[examLifecycle] audit: %s', err.message);
  }
}

/**
 * Mở khóa phòng thi (room-level) + audit + notify.
 */
async function unlockStudentExam({
  studentId,
  actor = {},
  io = null,
  reqMeta = {},
  reason = '',
}) {
  const student = await Student.findById(studentId);
  if (!student) {
    const err = new Error('Không tìm thấy học viên');
    err.status = 404;
    throw err;
  }

  const oldValue = {
    studentExamUnlocked: Boolean(student.studentExamUnlocked),
    examApproved: Boolean(student.examApproved),
  };

  if (!student.enrollments?.length && student.course) {
    student.enrollments = [legacyEnrollmentFromStudent(student)];
    student.enrollments[0].isPrimary = true;
  }

  student.studentExamUnlocked = true;
  student.examApproved = true;
  (student.enrollments || []).forEach((e) => { e.examUnlocked = true; });
  if (student.enrollments?.length) student.markModified('enrollments');
  await student.save({ validateModifiedOnly: true });

  await writeExamAudit({
    action: 'exam.unlock',
    actor,
    student,
    oldValue,
    newValue: {
      studentExamUnlocked: true,
      examApproved: true,
      reason: reason || 'manual',
    },
    reqMeta,
  });

  if (io) {
    try {
      await NotificationService.sendFromTemplate(io, {
        templateCode: 'EXAM_UNLOCKED',
        receivers: [String(student._id)],
        data: { studentName: student.name },
        eventId: `exam.unlock:${student._id}`,
        link: DEEP_LINKS.STUDENT_EXAM,
      });
    } catch (err) {
      // fallback nếu template fail
      try {
        await NotificationService.send(io, {
          type: 'EXAM',
          title: '🔓 Phòng thi đã mở',
          content: 'Giảng viên/Admin đã cấp quyền cho bạn vào thi.',
          receivers: [String(student._id)],
          link: DEEP_LINKS.STUDENT_EXAM,
          eventId: `exam.unlock:${student._id}`,
        });
      } catch (e2) {
        logger.warn('[examLifecycle] unlock notify: %s', e2.message);
      }
    }
    io.emit('exam:unlocked', {
      studentId: String(student._id),
      studentName: student.name,
    });
    io.emit('data:refresh', { type: 'student', id: student._id });
  }

  return student;
}

/**
 * Khóa phòng thi / đánh trượt (violation hoặc fail tùy reasonKind).
 */
async function lockStudentExam({
  studentId,
  actor = {},
  io = null,
  reqMeta = {},
  reason = '',
  reasonKind = 'violation', // violation | fail
  subjectId = null,
}) {
  const student = await Student.findById(studentId);
  if (!student) {
    const err = new Error('Không tìm thấy học viên');
    err.status = 404;
    throw err;
  }
  if (!student.studentExamUnlocked) {
    const err = new Error('Học viên chưa được mở khóa phòng thi hoặc đã bị đánh trượt');
    err.status = 400;
    throw err;
  }

  const oldValue = {
    studentExamUnlocked: true,
    examApproved: Boolean(student.examApproved),
  };

  student.studentExamUnlocked = false;
  student.examApproved = false;
  (student.enrollments || []).forEach((e) => { e.examUnlocked = false; });
  if (student.enrollments?.length) student.markModified('enrollments');

  // Gắn violation/fail lên môn đang thi (nếu có)
  const progress = Array.isArray(student.examProgress)
    ? student.examProgress.map((e) => (e.toObject ? e.toObject() : { ...e }))
    : [];
  const targetStatus = reasonKind === 'fail' ? 'fail' : 'violation';
  let touchedSubject = subjectId;

  if (touchedSubject) {
    const idx = progress.findIndex((p) => String(p.id) === String(touchedSubject));
    const existing = idx >= 0 ? progress[idx] : { id: String(touchedSubject) };
    const from = existing.attemptStatus || toCanonical(existing.status, { roomUnlocked: true });
    try {
      assertExamTransition(from, targetStatus, { roomUnlocked: true });
    } catch {
      // nếu đang pass rồi thì vẫn cho void-like lock room; skip subject transition
    }
    const next = {
      ...existing,
      id: String(touchedSubject),
      attemptStatus: targetStatus,
      status: toLegacyStorage(targetStatus),
      lockUntil: Date.now() + 7 * 24 * 60 * 60 * 1000,
      violationReason: String(reason || '').slice(0, 500),
    };
    if (idx >= 0) progress[idx] = next;
    else progress.push(next);
  } else {
    const activeIdx = progress.findIndex((p) => {
      const c = p.attemptStatus || toCanonical(p.status, { roomUnlocked: true });
      return c === 'in_progress' || c === 'submitted' || p.status === 'dang_thi';
    });
    if (activeIdx >= 0) {
      touchedSubject = progress[activeIdx].id;
      progress[activeIdx] = {
        ...progress[activeIdx],
        attemptStatus: targetStatus,
        status: toLegacyStorage(targetStatus),
        lockUntil: Date.now() + 7 * 24 * 60 * 60 * 1000,
        violationReason: String(reason || '').slice(0, 500),
      };
    }
  }

  student.examProgress = progress;
  student.markModified('examProgress');
  await student.save({ validateModifiedOnly: true });

  await writeExamAudit({
    action: reasonKind === 'fail' ? 'exam.lock' : 'exam.violation',
    actor,
    student,
    subjectId: touchedSubject,
    oldValue,
    newValue: {
      studentExamUnlocked: false,
      reason: String(reason || '').slice(0, 500),
      reasonKind,
      subjectId: touchedSubject,
      attemptStatus: targetStatus,
    },
    reqMeta,
  });

  const actorLabel = actor.name || actor.role || 'Hệ thống';
  const finalReason = String(reason || '').trim()
    || `Vi phạm quy chế giám sát thi (${actorLabel})`;

  if (io) {
    try {
      const tpl = reasonKind === 'fail' ? 'EXAM_LOCKED' : 'EXAM_VIOLATION';
      await NotificationService.sendFromTemplate(io, {
        templateCode: tpl,
        receivers: [String(student._id)],
        data: { reason: finalReason, studentName: student.name },
        eventId: `exam.${reasonKind}:${student._id}:${Date.now()}`,
        link: DEEP_LINKS.STUDENT_EXAM,
      });
    } catch {
      try {
        await NotificationService.send(io, {
          type: 'EXAM',
          title: reasonKind === 'fail' ? '🔒 Bài thi bị đánh trượt' : '🚨 Vi phạm quy chế thi',
          content: `Phòng thi của bạn đã bị khóa. Lý do: ${finalReason}`,
          receivers: [String(student._id)],
          link: DEEP_LINKS.STUDENT_EXAM,
          eventId: `exam.${reasonKind}:${student._id}`,
        });
      } catch (e2) {
        logger.warn('[examLifecycle] lock notify: %s', e2.message);
      }
    }

    const lockPayload = {
      studentId: String(student._id),
      reason: finalReason,
      message: `🔒 Phòng thi đã bị khóa. Lý do: ${finalReason}`,
      subjectId: touchedSubject || null,
      kind: reasonKind,
    };
    io.to(`student_${student._id}`).emit('exam:locked', lockPayload);
    io.emit('exam:locked', lockPayload);
    io.emit('student:updated', student._id);
    io.emit('data:refresh', { type: 'student', id: student._id });
  }

  return { student, reason: finalReason, subjectId: touchedSubject, reasonKind };
}

/**
 * Void một môn (admin) — hủy kết quả, không tính pass/fail.
 */
function voidSubjectProgress(entry, reason = '') {
  const from = entry.attemptStatus || toCanonical(entry.status, { roomUnlocked: true });
  assertExamTransition(from, 'void', { roomUnlocked: true });
  return {
    ...entry,
    attemptStatus: 'void',
    status: 'void',
    voidReason: String(reason || '').slice(0, 500),
    voidedAt: new Date().toISOString(),
  };
}

module.exports = {
  CANONICAL,
  LEGACY,
  TRANSITIONS,
  toCanonical,
  toLegacyStorage,
  isValidExamStatus,
  canTransitionExam,
  assertExamTransition,
  normalizeAttemptStatusChange,
  unlockStudentExam,
  lockStudentExam,
  voidSubjectProgress,
  writeExamAudit,
};
