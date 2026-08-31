/**
 * Server-side merge/validate cho examProgress (học viên tự cập nhật tiến độ thi).
 * Admin/staff vẫn có thể ghi đè qua PUT /students/:id.
 */

const { inferExamSubjectsFromCourseName } = require('./examSubjectCatalog');

const ALLOWED_STATUS = new Set(['chua_thi', 'dang_thi', 'khong_dat', 'dat']);
const ALLOWED_THUC_HANH = new Set(['chua_nop', 'da_nop']);
const TERMINAL_STATUS = new Set(['khong_dat', 'dang_khoa', 'dat']);

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

function isActiveEnrollment(enr) {
  if (!enr) return false;
  if (enr.cancelledAt) return false;
  const st = String(enr.status || '').toLowerCase();
  return st !== 'cancelled' && st !== 'refunded';
}

function subjectIdsForEnrollment(enr) {
  if (Array.isArray(enr?.examSubjects) && enr.examSubjects.length) {
    return enr.examSubjects.map(String);
  }
  return inferExamSubjectsFromCourseName(enr?.courseName || enr?.name).map(String);
}

function examMilestoneMet(subjectIds, subjectId, completedSessions, totalSessions) {
  const ids = (subjectIds || []).map(String);
  const idx = ids.indexOf(String(subjectId));
  if (idx < 0) return false;
  const count = Math.max(1, ids.length);
  const total = Math.max(1, Number(totalSessions) || 12);
  const interval = Math.max(1, Math.floor(total / count));
  return Number(completedSessions) >= interval * (idx + 1);
}

/**
 * Cổng ghi tiến độ HV — khớp UI Phòng thi:
 * mở khóa global / theo khóa, đang thi, hoặc đủ mốc buổi.
 */
function canStudentWriteExamProgress(student, subjectId) {
  if (!student) return false;
  const sid = String(subjectId || '').trim();
  if (!sid) return false;

  const entry = (student.examProgress || []).find((e) => String(e.id) === sid);
  if (entry && String(entry.status) === 'dang_thi') return true;

  if (student.studentExamUnlocked || student.examApproved) return true;

  const enrollments = Array.isArray(student.enrollments) ? student.enrollments : [];
  const matched = enrollments.filter((e) => isActiveEnrollment(e) && subjectIdsForEnrollment(e).includes(sid));

  if (matched.some((e) => e.examUnlocked === true)) return true;

  if (matched.some((e) => examMilestoneMet(
    subjectIdsForEnrollment(e),
    sid,
    e.completedSessions || 0,
    e.totalSessions || student.totalSessions || 12,
  ))) return true;

  const allIds = [];
  const seen = new Set();
  enrollments.filter(isActiveEnrollment).forEach((e) => {
    subjectIdsForEnrollment(e).forEach((id) => {
      if (seen.has(id)) return;
      seen.add(id);
      allIds.push(id);
    });
  });
  if (!allIds.length && student.course) {
    inferExamSubjectsFromCourseName(student.course).forEach((id) => allIds.push(String(id)));
  }
  return examMilestoneMet(
    allIds,
    sid,
    student.completedSessions || 0,
    student.totalSessions || 12,
  );
}

/**
 * @param {object} student lean or doc
 * @param {string} subjectId
 * @param {object} rawChanges
 * @returns {{ progress: array, entry: object }}
 */
function applyStudentExamProgress(student, subjectId, rawChanges) {
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
  const progress = Array.isArray(student.examProgress)
    ? student.examProgress.map((e) => ({ ...(e.toObject ? e.toObject() : e) }))
    : [];

  const idx = progress.findIndex((s) => String(s.id) === sid);
  const existing = idx >= 0 ? progress[idx] : { id: sid };
  const existingStatus = String(existing.status || '');

  // Không cho HV tự gỡ khóa khi còn hiệu lực
  if (existing.lockUntil && Number(existing.lockUntil) > now) {
    if (changes.lockUntil !== undefined && Number(changes.lockUntil) < Number(existing.lockUntil)) {
      const err = new Error('Không thể rút ngắn thời gian khóa thi');
      err.status = 403;
      throw err;
    }
    if (changes.status && changes.status !== 'khong_dat' && existing.status === 'khong_dat') {
      const err = new Error('Môn đang bị khóa, không thể đổi trạng thái');
      err.status = 403;
      throw err;
    }
  }

  // khong_dat / dang_khoa: chờ admin reset (đồng bộ UI), kể cả khi lockUntil đã hết
  if (
    (existingStatus === 'khong_dat' || existingStatus === 'dang_khoa')
    && changes.status
    && changes.status !== existingStatus
  ) {
    const err = new Error('Môn đã khóa, không thể đổi trạng thái. Liên hệ admin để mở lại.');
    err.status = 403;
    throw err;
  }

  if (
    changes.status === 'chua_thi'
    && TERMINAL_STATUS.has(existingStatus)
  ) {
    const err = new Error('Không thể tự mở lại bài thi đã chốt');
    err.status = 403;
    throw err;
  }

  if (existingStatus === 'dat' && changes.status && changes.status !== 'dat') {
    const err = new Error('Môn đã ĐẠT, không thể đổi trạng thái');
    err.status = 403;
    throw err;
  }

  if (changes.status === 'dat') {
    const tn = changes.tracNghiem || existing.tracNghiem;
    const score = tn && Number(tn.score);
    const total = tn && Number(tn.total);
    if (!tn || !Number.isFinite(score) || !Number.isFinite(total) || total <= 0) {
      const err = new Error('Không thể ghi ĐẠT khi chưa có điểm trắc nghiệm');
      err.status = 403;
      throw err;
    }
  }

  // Không cho sửa điểm TN đã chốt (trừ khi chưa có)
  if (
    existing.tracNghiem
    && Number.isFinite(Number(existing.tracNghiem.score))
    && changes.tracNghiem
    && Number(changes.tracNghiem.score) !== Number(existing.tracNghiem.score)
  ) {
    const err = new Error('Điểm trắc nghiệm đã được ghi nhận, không thể sửa');
    err.status = 403;
    throw err;
  }

  // lockUntil chỉ cho phép tăng / set khi rớt
  if (changes.lockUntil !== undefined && changes.status !== 'khong_dat' && existing.status !== 'khong_dat') {
    if (!existing.lockUntil || Number(existing.lockUntil) <= now) {
      // cho phép set lock khi hủy bài kèm khong_dat — nếu không có status khong_dat thì bỏ lockUntil
      if (changes.status !== 'khong_dat') delete changes.lockUntil;
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
  canStudentWriteExamProgress,
  examMilestoneMet,
};
