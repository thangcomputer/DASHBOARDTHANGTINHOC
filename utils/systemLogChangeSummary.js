/**
 * Tóm tắt thay đổi cho SystemLog (mô tả rõ trường nào đổi).
 */

function formatVnd(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n ?? '');
  return `${Math.round(v).toLocaleString('vi-VN')}đ`;
}

function normStr(v) {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v._id) return String(v._id);
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v).trim();
}

function sameVal(a, b) {
  return normStr(a) === normStr(b);
}

/** Chuẩn hóa ngày về YYYY-MM-DD để so form (date input) vs Mongo ISO/Date. */
function normDateKey(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'string') {
    const s = v.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  }
  const d = v instanceof Date ? v : new Date(v);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return String(v).trim();
}

function sameDate(a, b) {
  return normDateKey(a) === normDateKey(b);
}

function sameScore(a, b) {
  const na = a == null || a === '' ? null : Number(a);
  const nb = b == null || b === '' ? null : Number(b);
  if (na == null && nb == null) return true;
  if (na == null || nb == null) return false;
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return sameVal(a, b);
  return na === nb;
}

const TEACHER_STATUS_LABEL = {
  active: 'Đã cấp quyền',
  pending: 'Chờ duyệt / được thi',
  inactive: 'Chưa cấp quyền',
  locked: 'Đã khóa',
  suspended: 'Tạm dừng',
};

const STUDENT_STATUS_HINT = {
  'đang học': 'Đang học',
  'chờ xếp lớp': 'Chờ xếp lớp',
  'đã tốt nghiệp': 'Đã tốt nghiệp',
  suspended: 'Tạm dừng',
  inactive: 'Ngưng',
};

function teacherStatusLabel(s) {
  const k = String(s || '').toLowerCase();
  return TEACHER_STATUS_LABEL[k] || s || '—';
}

function studentStatusLabel(s) {
  const k = String(s || '').toLowerCase();
  return STUDENT_STATUS_HINT[k] || s || '—';
}

/**
 * @param {Record<string, any>} updates
 * @param {Record<string, any>|null} prev
 * @returns {string[]}
 */
function summarizeTeacherUpdates(updates, prev = null) {
  const parts = [];
  if (!updates || typeof updates !== 'object') return parts;

  if (updates.name !== undefined && !sameVal(updates.name, prev?.name)) {
    parts.push(prev?.name
      ? `Họ tên: ${prev.name} → ${updates.name}`
      : `Họ tên → ${updates.name}`);
  }
  if (updates.phone !== undefined && !sameVal(updates.phone, prev?.phone)) {
    parts.push('Đổi SĐT đăng nhập');
  }
  if (updates.email !== undefined && !sameVal(updates.email, prev?.email)) {
    parts.push(prev?.email ? `Email: ${prev.email} → ${updates.email || '(xoá)'}` : `Email → ${updates.email}`);
  }
  if (updates.specialty !== undefined && !sameVal(updates.specialty, prev?.specialty)) {
    parts.push(prev?.specialty
      ? `Chuyên môn: ${prev.specialty} → ${updates.specialty || '(xoá)'}`
      : `Chuyên môn → ${updates.specialty}`);
  }
  if (updates.subjectIds !== undefined) {
    const from = Array.isArray(prev?.subjectIds) ? prev.subjectIds.join(',') : '';
    const to = Array.isArray(updates.subjectIds) ? updates.subjectIds.join(',') : '';
    if (from !== to) parts.push('Đổi môn chuyên môn (subjectIds)');
  }
  if (updates.baseSalaryPerSession !== undefined) {
    const from = Number(prev?.baseSalaryPerSession) || 0;
    const to = Number(updates.baseSalaryPerSession) || 0;
    if (from !== to) {
      if (to > from) parts.push(`Tăng lương/buổi ${formatVnd(from)} → ${formatVnd(to)}`);
      else parts.push(`Giảm lương/buổi ${formatVnd(from)} → ${formatVnd(to)}`);
    }
  }
  if (updates.customStarBonusAmount !== undefined) {
    const from = prev?.customStarBonusAmount != null ? Number(prev.customStarBonusAmount) : null;
    const to = Number(updates.customStarBonusAmount) || 0;
    if (from == null || from !== to) {
      parts.push(from != null
        ? `Thưởng sao: ${formatVnd(from)} → ${formatVnd(to)}`
        : `Thưởng sao → ${formatVnd(to)}`);
    }
  }
  if (updates.status !== undefined && !sameVal(updates.status, prev?.status)) {
    parts.push(`Trạng thái: ${teacherStatusLabel(prev?.status)} → ${teacherStatusLabel(updates.status)}`);
  }
  if (updates.branchId !== undefined && !sameVal(updates.branchId, prev?.branchId)) {
    parts.push(updates.branchCode
      ? `Chi nhánh → ${updates.branchCode}`
      : 'Đổi chi nhánh');
  } else if (updates.branchCode !== undefined && !sameVal(updates.branchCode, prev?.branchCode)) {
    parts.push(`Chi nhánh → ${updates.branchCode || '(chưa phân)'}`);
  }
  if (updates.bankAccount !== undefined) {
    const fromAcc = prev?.bankAccount?.accountNumber || '';
    const toAcc = updates.bankAccount?.accountNumber || '';
    const fromBank = prev?.bankAccount?.bankCode || prev?.bankAccount?.bankName || '';
    const toBank = updates.bankAccount?.bankCode || updates.bankAccount?.bankName || '';
    if (fromAcc !== toAcc || fromBank !== toBank) {
      parts.push('Đổi tài khoản ngân hàng');
    }
  }
  if (updates.address !== undefined && !sameVal(updates.address, prev?.address)) {
    parts.push('Đổi địa chỉ');
  }
  if (updates.bio !== undefined && !sameVal(updates.bio, prev?.bio)) {
    parts.push('Đổi giới thiệu');
  }
  if (updates.startDate !== undefined && !sameDate(updates.startDate, prev?.startDate)) {
    parts.push('Đổi ngày vào làm');
  }
  if (updates.testScore !== undefined || updates.testStatus !== undefined) {
    const scoreChanged = updates.testScore !== undefined
      && !sameScore(updates.testScore, prev?.testScore);
    const statusChanged = updates.testStatus !== undefined
      && !sameVal(updates.testStatus, prev?.testStatus);
    if (scoreChanged || statusChanged) {
      const score = updates.testScore != null ? updates.testScore : prev?.testScore;
      const st = updates.testStatus != null && updates.testStatus !== ''
        ? updates.testStatus
        : prev?.testStatus;
      parts.push(`Cập nhật kết quả thi${st ? ` (${st})` : ''}${score != null ? ` ${score}/100` : ''}`);
    }
  }
  if (updates.practicalStatus !== undefined && !sameVal(updates.practicalStatus, prev?.practicalStatus)) {
    parts.push(`File thực hành: ${updates.practicalStatus}`);
  }
  if (updates.password !== undefined || updates._passwordChanged) {
    parts.push('Đổi mật khẩu');
  }

  // Fallback: có field lạ nhưng chưa map
  if (!parts.length) {
    const keys = Object.keys(updates).filter((k) => !k.startsWith('_'));
    if (keys.length) parts.push(`Cập nhật: ${keys.slice(0, 6).join(', ')}`);
  }
  return parts;
}

/**
 * @param {Record<string, any>} body
 * @param {Record<string, any>|null} prev
 * @param {{ passwordChanged?: boolean }} [opts]
 * @returns {string[]}
 */
function summarizeStudentUpdates(body, prev = null, opts = {}) {
  const parts = [];
  if (!body || typeof body !== 'object') return parts;

  if (opts.passwordChanged || body._passwordChanged) {
    parts.push('Đổi mật khẩu');
  }
  if (body.name !== undefined && !sameVal(body.name, prev?.name)) {
    parts.push(prev?.name ? `Họ tên: ${prev.name} → ${body.name}` : `Họ tên → ${body.name}`);
  }
  if (body.phone !== undefined && !sameVal(body.phone, prev?.phone)) {
    parts.push('Đổi SĐT đăng nhập');
  }
  if (body.email !== undefined && !sameVal(body.email, prev?.email)) {
    parts.push('Đổi email');
  }
  if (body.course !== undefined && !sameVal(body.course, prev?.course)) {
    parts.push(prev?.course
      ? `Khóa học: ${prev.course} → ${body.course}`
      : `Khóa học → ${body.course}`);
  }
  if (body.totalSessions !== undefined) {
    const from = Number(prev?.totalSessions);
    const to = Number(body.totalSessions);
    if (!Number.isFinite(from) || from !== to) {
      parts.push(Number.isFinite(from)
        ? `Tổng buổi học: ${from} → ${to}`
        : `Tổng buổi học → ${to}`);
    }
  }
  if (body.completedSessions !== undefined) {
    const from = Number(prev?.completedSessions);
    const to = Number(body.completedSessions);
    if (!Number.isFinite(from) || from !== to) {
      parts.push(Number.isFinite(from)
        ? `Buổi đã học: ${from} → ${to}`
        : `Buổi đã học → ${to}`);
    }
  }
  if (body.remainingSessions !== undefined) {
    const from = Number(prev?.remainingSessions);
    const to = Number(body.remainingSessions);
    if (!Number.isFinite(from) || from !== to) {
      parts.push(Number.isFinite(from)
        ? `Buổi còn lại: ${from} → ${to}`
        : `Buổi còn lại → ${to}`);
    }
  }
  if (body.price !== undefined) {
    const from = Number(prev?.price) || 0;
    const to = Number(body.price) || 0;
    if (from !== to) {
      parts.push(`Học phí: ${formatVnd(from)} → ${formatVnd(to)}`);
    }
  }
  if (body.teacherId !== undefined || body.teacherName !== undefined) {
    const toName = body.teacherName || (body.teacherId ? String(body.teacherId) : '');
    if (!body.teacherId && !body.teacherName) {
      parts.push('Bỏ phân công giảng viên');
    } else {
      parts.push(`Phân công GV${toName ? `: ${toName}` : ''}`);
    }
  }
  if (body.status !== undefined && !sameVal(body.status, prev?.status)) {
    parts.push(`Trạng thái: ${studentStatusLabel(prev?.status)} → ${studentStatusLabel(body.status)}`);
  }
  if (body.linkHoc !== undefined && !sameVal(body.linkHoc, prev?.linkHoc)) {
    parts.push('Đổi link vào lớp');
  }
  if (body.nextClass !== undefined || body.nextClassTime !== undefined) {
    parts.push('Đổi lịch buổi học tiếp theo');
  }
  if (body.studentExamUnlocked !== undefined || body.examApproved !== undefined) {
    const unlocked = body.studentExamUnlocked ?? body.examApproved;
    parts.push(unlocked ? 'Cấp quyền vào phòng thi' : 'Thu hồi quyền thi');
  }
  if (body.address !== undefined && !sameVal(body.address, prev?.address)) {
    parts.push('Đổi địa chỉ');
  }
  if (body.examProgress !== undefined) {
    parts.push('Cập nhật tiến độ / mở lại bài thi');
  }

  if (!parts.length) {
    const keys = Object.keys(body).filter((k) => !k.startsWith('_') && k !== 'password');
    if (keys.length) parts.push(`Cập nhật: ${keys.slice(0, 6).join(', ')}`);
  }
  return parts;
}

function summarizeEnrollmentSettings(body) {
  const parts = [];
  if (!body || typeof body !== 'object') return parts;
  if (body.totalSessions != null) parts.push(`Tổng buổi → ${body.totalSessions}`);
  if (body.completedSessions != null) parts.push(`Buổi đã học → ${body.completedSessions}`);
  if (body.remainingSessions != null) parts.push(`Buổi còn lại → ${body.remainingSessions}`);
  if (body.linkHoc !== undefined) parts.push('Đổi link vào lớp');
  if (body.nextClass !== undefined || body.nextClassTime !== undefined) parts.push('Đổi lịch buổi tiếp theo');
  if (body.status !== undefined) parts.push(`Trạng thái khóa → ${body.status}`);
  if (body.notes !== undefined) parts.push('Đổi ghi chú');
  if (body.teacherAlert !== undefined) parts.push('Đổi lưu ý giảng viên');
  if (!parts.length && body.courseName) parts.push(`Khóa "${body.courseName}"`);
  return parts;
}

function describeAssignTeacher({
  studentName = '',
  teacherName = '',
  previousTeacherName = '',
  targetCourse = '',
  unassign = false,
  reassign = false,
} = {}) {
  const courseBit = targetCourse ? ` (Khóa "${targetCourse}")` : '';
  const hvBit = studentName ? ` cho học viên ${studentName}` : '';
  if (unassign) {
    return `Bỏ phân công GV${previousTeacherName ? ` ${previousTeacherName}` : ''}${hvBit}${courseBit}`;
  }
  if (reassign && previousTeacherName && teacherName) {
    return `Đổi GV ${previousTeacherName} → ${teacherName}${hvBit}${courseBit}`;
  }
  return `Phân công GV${teacherName ? ` ${teacherName}` : ''}${hvBit}${courseBit}`;
}

function joinEntityChanges(entityLabel, name, parts) {
  const who = name ? `${entityLabel} ${name}` : entityLabel;
  if (!parts?.length) return `Đổi thông tin ${who}`;
  return `${who}: ${parts.join('; ')}`.slice(0, 480);
}

module.exports = {
  formatVnd,
  summarizeTeacherUpdates,
  summarizeStudentUpdates,
  summarizeEnrollmentSettings,
  describeAssignTeacher,
  joinEntityChanges,
};
