/**
 * Unique phone / email across Student + Teacher (cross-role).
 * 1 HV / 1 GV chỉ 1 SĐT + 1 email; HV và GV cũng không được trùng nhau.
 */
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const { normalizeVNPhone: normalizePhone, phoneLookupVariants } = require('./phoneIdentity');

function normalizeEmail(value) {
  const e = String(value || '').trim().toLowerCase();
  if (!e || e === 'email@example.com') return '';
  return e;
}

function isPlaceholderPhone(value) {
  const raw = String(value || '').trim().toLowerCase();
  const digits = normalizePhone(raw);
  if (!digits || digits.length < 9) return true;
  if (raw === 'admin' || raw.includes('chưa cập nhật') || raw.includes('chua cap nhat')) return true;
  return false;
}

function phoneVariants(value) {
  const raw = String(value || '').trim();
  const digits = normalizePhone(raw);
  if (!digits || isPlaceholderPhone(raw)) return [];
  return phoneLookupVariants(digits);
}

function contactConflictError(message) {
  const err = new Error(message);
  err.status = 409;
  err.code = 'CONTACT_CONFLICT';
  return err;
}

/**
 * @param {{ phone?: string, zalo?: string, email?: string, excludeRole?: 'student'|'teacher'|null, excludeId?: string|null }} opts
 */
async function assertUniqueContact({
  phone,
  zalo,
  email,
  excludeRole = null,
  excludeId = null,
} = {}) {
  const phoneSet = new Set([
    ...phoneVariants(phone),
    ...phoneVariants(zalo),
  ]);
  const phones = [...phoneSet].filter((p) => p && !isPlaceholderPhone(p));
  const emailNorm = normalizeEmail(email);

  const excludeStudent = excludeRole === 'student' && excludeId
    ? { _id: { $ne: excludeId } }
    : null;
  const excludeTeacher = excludeRole === 'teacher' && excludeId
    ? { _id: { $ne: excludeId } }
    : null;

  if (phones.length) {
    const phoneClause = {
      $or: phones.flatMap((p) => [{ phone: p }, { zalo: p }]),
    };

    const studentPhoneQ = excludeStudent
      ? { $and: [phoneClause, excludeStudent] }
      : phoneClause;
    const hitStudent = await Student.findOne(studentPhoneQ).select('name phone zalo').lean();
    if (hitStudent) {
      throw contactConflictError(
        `Số điện thoại đã được học viên "${hitStudent.name || 'N/A'}" sử dụng — không thể đăng ký trùng`,
      );
    }

    const teacherPhoneQ = excludeTeacher
      ? { $and: [phoneClause, excludeTeacher] }
      : phoneClause;
    const hitTeacher = await Teacher.findOne(teacherPhoneQ).select('name phone zalo').lean();
    if (hitTeacher) {
      throw contactConflictError(
        `Số điện thoại đã được giảng viên "${hitTeacher.name || 'N/A'}" sử dụng — không thể đăng ký trùng`,
      );
    }
  }

  if (emailNorm) {
    const emailClause = { email: emailNorm };
    const studentEmailQ = excludeStudent
      ? { $and: [emailClause, excludeStudent] }
      : emailClause;
    const hitStudentEmail = await Student.findOne(studentEmailQ).select('name email').lean();
    if (hitStudentEmail) {
      throw contactConflictError(
        `Email đã được học viên "${hitStudentEmail.name || 'N/A'}" sử dụng — không thể đăng ký trùng`,
      );
    }

    const teacherEmailQ = excludeTeacher
      ? { $and: [emailClause, excludeTeacher] }
      : emailClause;
    const hitTeacherEmail = await Teacher.findOne(teacherEmailQ).select('name email').lean();
    if (hitTeacherEmail) {
      throw contactConflictError(
        `Email đã được giảng viên "${hitTeacherEmail.name || 'N/A'}" sử dụng — không thể đăng ký trùng`,
      );
    }
  }

  return true;
}

module.exports = {
  assertUniqueContact,
  normalizePhone,
  normalizeEmail,
  isPlaceholderPhone,
  phoneVariants,
};
