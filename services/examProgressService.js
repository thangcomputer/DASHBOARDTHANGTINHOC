/**
 * Server-side merge/validate cho examProgress (học viên tự cập nhật tiến độ thi).
 * Phase 9: state machine qua examLifecycleService.
 * Admin/staff vẫn có thể ghi đè qua PUT /students/:id.
 */

const {
  normalizeAttemptStatusChange,
  toCanonical,
  assertExamTransition,
  canTransitionExam,
} = require('./examLifecycleService');

const ALLOWED_STATUS = new Set([
  'chua_thi',
  'dang_thi',
  'khong_dat',
  'dat',
  'submitted',
  'void',
  'violation',
  // canonical aliases accepted from clients
  'locked',
  'unlocked',
  'in_progress',
  'graded',
  'pass',
  'fail',
]);
const ALLOWED_THUC_HANH = new Set(['chua_nop', 'da_nop']);

function sanitizeTracNghiem(tn) {
  if (!tn || typeof tn !== 'object') return undefined;
  const total = Math.max(0, Math.min(500, Number(tn.total) || 0));
  let score = Number(tn.score);
  if (!Number.isFinite(score)) score = 0;
  score = Math.max(0, Math.min(total || 500, Math.floor(score)));
  return { score, total };
}

function sanitizeChanges(raw = {}) {
  const out = {};
  if (raw.tracNghiem !== undefined) {
    const tn = sanitizeTracNghiem(raw.tracNghiem);
    if (tn) out.tracNghiem = tn;
  }
  if (raw.thucHanh !== undefined) {
    const th = String(raw.thucHanh);
    if (ALLOWED_THUC_HANH.has(th)) out.thucHanh = th;
  }
  if (raw.status !== undefined) {
    const st = String(raw.status);
    if (ALLOWED_STATUS.has(st)) out.status = st;
  }
  if (raw.lockUntil !== undefined) {
    const lu = Number(raw.lockUntil);
    if (Number.isFinite(lu) && lu > 0) out.lockUntil = Math.floor(lu);
  }
  if (raw.essayFile !== undefined) {
    const f = String(raw.essayFile || '').trim().slice(0, 500);
    // Chỉ path nội bộ uploads — chặn URL ngoài
    if (!f || f.startsWith('/uploads/') || f.startsWith('uploads/')) {
      out.essayFile = f.startsWith('uploads/') ? `/${f}` : f;
    }
  }
  if (raw.essayScore !== undefined) {
    // Học viên không được tự ghi điểm tự luận
  }
  return out;
}

/**
 * @param {object} student lean or doc
 * @param {string} subjectId
 * @param {object} rawChanges
 * @param {{ actorRole?: string, enforceSm?: boolean }} [opts]
 * @returns {{ progress: array, entry: object }}
 */
function applyStudentExamProgress(student, subjectId, rawChanges, opts = {}) {
  const sid = String(subjectId || '').trim();
  if (!sid) {
    const err = new Error('Thiếu subjectId');
    err.status = 400;
    throw err;
  }

  const changes = sanitizeChanges(rawChanges);
  if (!Object.keys(changes).length) {
    const err = new Error('Không có trường tiến độ hợp lệ');
    err.status = 400;
    throw err;
  }

  const now = Date.now();
  const roomUnlocked = Boolean(student.studentExamUnlocked || student.examApproved);
  const progress = Array.isArray(student.examProgress)
    ? student.examProgress.map((e) => ({ ...(e.toObject ? e.toObject() : e) }))
    : [];

  const idx = progress.findIndex((s) => String(s.id) === sid);
  const existing = idx >= 0 ? progress[idx] : { id: sid };

  // Không cho HV tự gỡ khóa khi còn hiệu lực
  if (existing.lockUntil && Number(existing.lockUntil) > now) {
    if (changes.lockUntil !== undefined && Number(changes.lockUntil) < Number(existing.lockUntil)) {
      const err = new Error('Không thể rút ngắn thời gian khóa thi');
      err.status = 403;
      throw err;
    }
    if (changes.status && changes.status !== 'khong_dat' && changes.status !== 'fail'
      && changes.status !== 'violation'
      && (existing.status === 'khong_dat' || existing.attemptStatus === 'fail' || existing.attemptStatus === 'violation')) {
      const err = new Error('Môn đang bị khóa, không thể đổi trạng thái');
      err.status = 403;
      throw err;
    }
  }

  // Không cho sửa điểm TN đã chốt (trừ khi chưa có)
  if (
    existing.tracNghiem &&
    Number.isFinite(Number(existing.tracNghiem.score)) &&
    changes.tracNghiem &&
    Number(changes.tracNghiem.score) !== Number(existing.tracNghiem.score)
  ) {
    const err = new Error('Điểm trắc nghiệm đã được ghi nhận, không thể sửa');
    err.status = 403;
    throw err;
  }

  // lockUntil chỉ cho phép tăng / set khi rớt
  if (changes.lockUntil !== undefined && changes.status !== 'khong_dat' && changes.status !== 'fail'
    && changes.status !== 'violation'
    && existing.status !== 'khong_dat'
    && existing.attemptStatus !== 'fail'
    && existing.attemptStatus !== 'violation') {
    if (!existing.lockUntil || Number(existing.lockUntil) <= now) {
      if (!['khong_dat', 'fail', 'violation'].includes(changes.status)) delete changes.lockUntil;
    }
  }

  // Phase 9 — enforce state machine trên status
  const enforceSm = opts.enforceSm !== false;
  if (enforceSm && changes.status !== undefined) {
    const normalized = normalizeAttemptStatusChange(existing, changes.status, { roomUnlocked });
    if (normalized) {
      changes.status = normalized.status;
      changes.attemptStatus = normalized.attemptStatus;
    }
  } else if (changes.status !== undefined) {
    // staff override: vẫn ghi attemptStatus nếu map được
    try {
      const normalized = normalizeAttemptStatusChange(existing, changes.status, { roomUnlocked });
      if (normalized) {
        changes.status = normalized.status;
        changes.attemptStatus = normalized.attemptStatus;
      }
    } catch {
      // admin có thể set trực tiếp legacy
      changes.attemptStatus = toCanonical(changes.status, { roomUnlocked });
    }
  }

  // Nộp thực hành → submitted nếu đang in_progress và chưa pass/fail
  if (
    changes.thucHanh === 'da_nop'
    && !changes.status
    && (existing.status === 'dang_thi' || existing.attemptStatus === 'in_progress')
  ) {
    if (canTransitionExam(existing.attemptStatus || 'in_progress', 'submitted', { roomUnlocked })) {
      changes.status = 'submitted';
      changes.attemptStatus = 'submitted';
    }
  }

  const entry = { ...existing, id: sid, ...changes };
  if (idx >= 0) progress[idx] = entry;
  else progress.push(entry);

  return { progress, entry };
}

module.exports = {
  applyStudentExamProgress,
  sanitizeChanges,
  ALLOWED_STATUS,
  assertExamTransition,
};
