/**
 * systemLogger.js — Middleware ghi nhật ký hoạt động hệ thống
 *
 * Chỉ ghi các hành động trong SYSTEM_LOG_VISIBLE_ACTIONS.
 */
const SystemLog = require('../models/SystemLog');
const logger = require('../config/logger');
const { isVisibleSystemLogAction } = require('../constants/systemLogActions');
const {
  summarizeTeacherUpdates,
  summarizeStudentUpdates,
  summarizeEnrollmentSettings,
  describeAssignTeacher,
  joinEntityChanges,
} = require('../utils/systemLogChangeSummary');

function parseDevice(ua) {
  if (!ua) return 'Không rõ thiết bị';

  let browser = 'Trình duyệt khác';
  let os = 'Hệ điều hành khác';

  if (ua.includes('Edg/'))          browser = 'Edge ' + (ua.match(/Edg\/([\d.]+)/)?.[1]?.split('.')[0] || '');
  else if (ua.includes('OPR/'))     browser = 'Opera ' + (ua.match(/OPR\/([\d.]+)/)?.[1]?.split('.')[0] || '');
  else if (ua.includes('Chrome/'))  browser = 'Chrome ' + (ua.match(/Chrome\/([\d.]+)/)?.[1]?.split('.')[0] || '');
  else if (ua.includes('Firefox/')) browser = 'Firefox ' + (ua.match(/Firefox\/([\d.]+)/)?.[1]?.split('.')[0] || '');
  else if (ua.includes('Safari/') && !ua.includes('Chrome'))
    browser = 'Safari ' + (ua.match(/Version\/([\d.]+)/)?.[1]?.split('.')[0] || '');

  if (ua.includes('Windows NT 10'))       os = 'Windows 10/11';
  else if (ua.includes('Windows NT 6.3')) os = 'Windows 8.1';
  else if (ua.includes('Windows NT 6.1')) os = 'Windows 7';
  else if (ua.includes('Mac OS X'))       os = 'macOS';
  else if (ua.includes('Android'))        os = 'Android ' + (ua.match(/Android ([\d.]+)/)?.[1] || '');
  else if (ua.includes('iPhone'))         os = 'iOS (iPhone)';
  else if (ua.includes('iPad'))           os = 'iOS (iPad)';
  else if (ua.includes('Linux'))          os = 'Linux';

  return `${browser} / ${os}`;
}

function firstPositiveAmount(...vals) {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n) && Math.abs(n) > 0) return Math.round(n);
  }
  return 0;
}

function describeAction(method, path, body, responseBody) {
  const p = path.toLowerCase();
  const m = String(method || '').toUpperCase();

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. STUDENTS & ENROLLMENTS & REFUNDS
  // ═══════════════════════════════════════════════════════════════════════════

  // (A) Hoàn tiền học phí qua PUT /students/:id/refund
  if (p.includes('/students') && p.includes('/refund')) {
    const amount = firstPositiveAmount(
      responseBody?.data?.refundedAmount,
      body?.amount,
    );
    const name = responseBody?.data?.student?.name || responseBody?.data?.name || body?.name || '';
    return {
      action: 'HOÀN HỌC PHÍ',
      category: 'finance',
      desc: `Hoàn tiền học viên${name ? `: ${name}` : ''}${amount ? ` (${amount.toLocaleString('vi-VN')}đ)` : ''}`,
      amount: amount ? -Math.abs(amount) : 0,
    };
  }

  // (B) Hủy khóa học (kèm hoàn tiền hoặc không hoàn tiền) qua DELETE /students/:id/enrollments/:enrollmentId
  if (p.includes('/students') && p.includes('/enrollments') && m === 'DELETE') {
    const refundAmt = firstPositiveAmount(
      responseBody?.meta?.refundedAmount,
      body?.refundAmount,
    );
    const studentName = responseBody?.data?.name || '';
    const course = body?.courseName || '';
    if (refundAmt > 0) {
      return {
        action: 'HOÀN HỌC PHÍ',
        category: 'finance',
        desc: `Hoàn tiền khi hủy khóa${course ? ` "${course}"` : ''}${studentName ? ` (Học viên: ${studentName})` : ''}`,
        amount: -Math.abs(refundAmt),
      };
    }
    return {
      action: 'CẬP NHẬT HV',
      category: 'student',
      desc: `Hủy khóa học${course ? ` "${course}"` : ''}${studentName ? ` của học viên ${studentName}` : ''}`,
      amount: 0,
    };
  }

  // (C) Bỏ qua /pay (thu phí được ghi nhận riêng qua sổ cái/hóa đơn)
  if (p.includes('/students') && p.includes('/pay')) {
    return { skip: true };
  }

  // (D) Đăng ký thêm khóa cho học viên qua POST /students/:id/enrollments
  if (p.includes('/students') && p.includes('/enrollments') && m === 'POST') {
    const sName = responseBody?.data?.name || '';
    const course = body?.courseName || body?.course || '';
    return {
      action: 'CẬP NHẬT HV',
      category: 'student',
      desc: `Đăng ký thêm khóa${course ? ` "${course}"` : ''}${sName ? ` cho học viên ${sName}` : ''}`,
      amount: 0,
    };
  }

  // (E) Cập nhật cài đặt khóa học qua PUT/PATCH /students/:id/enrollments/:enrollmentId/settings
  if (p.includes('/students') && p.includes('/enrollments') && (m === 'PUT' || m === 'PATCH')) {
    const sName = responseBody?.data?.name || '';
    const course = body?.courseName || responseBody?.meta?.courseName || '';
    const parts = Array.isArray(responseBody?.meta?.changes) && responseBody.meta.changes.length
      ? responseBody.meta.changes
      : summarizeEnrollmentSettings(body || {});
    const detail = parts.length ? parts.join('; ') : `Cập nhật khóa học${course ? ` "${course}"` : ''}`;
    return {
      action: 'CẬP NHẬT HV',
      category: 'student',
      desc: `${sName ? `Học viên ${sName}: ` : ''}${detail}${course && parts.length ? ` (Khóa "${course}")` : ''}`.slice(0, 500),
      amount: 0,
    };
  }

  // (F) Phân công giảng viên cho học viên qua /students/:id/assign-teacher
  if (p.includes('/students') && p.includes('/assign')) {
    const sName = responseBody?.data?.name || body?.studentName || '';
    const tName = responseBody?.meta?.teacherName || body?.teacherName || body?.name || '';
    const prevName = responseBody?.meta?.previousTeacherName || body?.previousTeacherName || '';
    const targetCourse = responseBody?.meta?.targetCourse || body?.targetCourse || body?.course || '';
    const unassign = !!(responseBody?.meta?.unassign || body?.teacherId === null || body?.teacherId === '');
    const reassign = !!(responseBody?.meta?.reassign);
    return {
      action: 'CẬP NHẬT HV',
      category: 'student',
      desc: describeAssignTeacher({
        studentName: sName,
        teacherName: tName,
        previousTeacherName: prevName,
        targetCourse,
        unassign,
        reassign,
      }),
      amount: 0,
    };
  }

  // (G) Điều chỉnh học phí riêng qua /students/:id/price
  if (p.includes('/students') && p.includes('/price')) {
    const sName = responseBody?.data?.name || '';
    const newPrice = Number(body?.newPrice || 0);
    return {
      action: 'CẬP NHẬT HV',
      category: 'student',
      desc: `Điều chỉnh học phí${sName ? ` học viên ${sName}` : ''}${newPrice ? ` thành ${newPrice.toLocaleString('vi-VN')}đ` : ''}`,
      amount: 0,
    };
  }

  // (H) Thêm học viên mới qua POST /students
  if (p.includes('/students') && m === 'POST' && !p.includes('/import')) {
    const sName = responseBody?.data?.name || body?.name || '';
    const course = responseBody?.data?.course || body?.course || '';
    const amount = firstPositiveAmount(
      responseBody?.data?.paidAmount,
      responseBody?.data?.price,
      body?.paidAmount,
      body?.price,
    );
    const paid = body?.paid === true || body?.paid === 'true' || responseBody?.data?.paid === true;
    return {
      action: 'THÊM HỌC VIÊN',
      category: 'student',
      desc: `Thêm học viên${sName ? `: ${sName}` : ''}${course ? ` (Khóa: ${course})` : ''}${paid && amount ? ` (đã thu ${amount.toLocaleString('vi-VN')}đ)` : ''}`,
      amount: paid ? amount : 0,
    };
  }

  // (I) Xóa học viên khỏi hệ thống qua DELETE /students/:id
  if (p.includes('/students') && m === 'DELETE') {
    const sName = responseBody?.data?.name || body?.name || '';
    return {
      action: 'XÓA HỌC VIÊN',
      category: 'student',
      desc: `Xóa học viên${sName ? `: ${sName}` : ''} khỏi hệ thống`,
      amount: 0,
    };
  }

  // (J) Cập nhật thông tin học viên chung qua PUT/PATCH /students/:id
  if (p.includes('/students') && (m === 'PUT' || m === 'PATCH')) {
    const sName = responseBody?.data?.name || body?.name || '';
    const parts = Array.isArray(responseBody?.meta?.changes) && responseBody.meta.changes.length
      ? responseBody.meta.changes
      : summarizeStudentUpdates(body || {}, responseBody?.meta?.previous || null, {
        passwordChanged: !!(responseBody?.meta?.passwordChanged || body?._passwordChanged),
      });
    return {
      action: 'CẬP NHẬT HV',
      category: 'student',
      desc: joinEntityChanges('Học viên', sName, parts),
      amount: 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. TEACHERS
  // ═══════════════════════════════════════════════════════════════════════════

  // (A) Thêm giảng viên mới qua POST /teachers
  if (p.includes('/teachers') && m === 'POST' && !p.includes('/finance')) {
    const tName = body?.name || responseBody?.data?.name || '';
    return {
      action: 'THÊM GIẢNG VIÊN',
      category: 'teacher',
      desc: `Thêm giảng viên${tName ? `: ${tName}` : ''}`,
      amount: 0,
    };
  }

  // (B) Thanh toán thù lao giảng viên
  if (p.includes('/teachers') && (p.includes('/finance/pay-flexible') || p.includes('/finance/pay-all'))) {
    const amount = firstPositiveAmount(
      responseBody?.data?.totalAmount,
      responseBody?.data?.amount,
      body?.amount,
    );
    const tName = responseBody?.data?.transaction?.teacherName || body?.teacherName || '';
    return {
      action: p.includes('pay-all') ? 'THANH TOÁN TẤT CẢ' : 'THANH TOÁN GV',
      category: 'finance',
      desc: `Thanh toán tiền giảng viên${tName ? `: ${tName}` : ''}`,
      amount: amount ? -Math.abs(amount) : 0,
    };
  }

  // (C) Cập nhật / Tạm dừng / Từ chối giảng viên qua PUT/PATCH /teachers/:id
  if (p.includes('/teachers') && (m === 'PUT' || m === 'PATCH')
    && !p.includes('/finance')
    && !p.includes('/practical')
    && !p.includes('/score')) {
    const tName = responseBody?.data?.name || body?.name || '';
    if (p.includes('/reject')) {
      return {
        action: 'CẬP NHẬT GV',
        category: 'teacher',
        desc: `Tạm dừng / từ chối giảng viên${tName ? `: ${tName}` : ''}`,
        amount: 0,
      };
    }
    const parts = Array.isArray(responseBody?.meta?.changes) && responseBody.meta.changes.length
      ? responseBody.meta.changes
      : summarizeTeacherUpdates(body || {}, responseBody?.meta?.previous || null);
    return {
      action: 'CẬP NHẬT GV',
      category: 'teacher',
      desc: joinEntityChanges('Giảng viên', tName, parts),
      amount: 0,
    };
  }

  // (D) Xóa giảng viên qua DELETE /teachers/:id
  if (p.includes('/teachers') && m === 'DELETE') {
    const tName = responseBody?.data?.name || '';
    const msg = responseBody?.message || '';
    return {
      action: 'XÓA GIẢNG VIÊN',
      category: 'teacher',
      desc: msg || `Xóa giảng viên${tName ? `: ${tName}` : ''} khỏi hệ thống`,
      amount: 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. TRANSACTIONS & STAFF & EMPLOYEES
  // ═══════════════════════════════════════════════════════════════════════════
  if (p.includes('/transactions') && p.includes('/confirm')) {
    const amount = firstPositiveAmount(responseBody?.data?.amount, body?.amount);
    const name = responseBody?.data?.teacherName || responseBody?.data?.teacherId?.name || '';
    return {
      action: 'XÁC NHẬN LƯƠNG',
      category: 'finance',
      desc: `Xác nhận thanh toán lương GV${name ? `: ${name}` : ''}`,
      amount: amount ? -Math.abs(amount) : 0,
    };
  }

  if (p.includes('/staff') && m === 'POST') {
    return { action: 'THÊM NHÂN VIÊN', category: 'staff', desc: `Thêm nhân viên${body?.name ? `: ${body.name}` : ''}`, amount: 0 };
  }
  if (p.includes('/staff') && (m === 'PUT' || m === 'PATCH')) {
    return { action: 'PHÂN QUYỀN', category: 'staff', desc: `Cấp / cập nhật quyền nhân viên${body?.name ? `: ${body.name}` : ''}`, amount: 0 };
  }
  if (p.includes('/staff') && m === 'DELETE') {
    return { action: 'XÓA NHÂN VIÊN', category: 'staff', desc: 'Xóa nhân viên khỏi hệ thống', amount: 0 };
  }

  if (p.includes('/employees') && p.includes('/pay') && m === 'POST') {
    const empName = responseBody?.data?.employeeName || body?.employeeName || '';
    const amount = firstPositiveAmount(responseBody?.data?.amount, body?.amount);
    return {
      action: 'THANH TOÁN LƯƠNG',
      category: 'hr',
      desc: `Thanh toán tiền nhân viên${empName ? `: ${empName}` : ''}${body?.monthLabel ? ` (${body.monthLabel})` : ''}`,
      amount: amount ? -Math.abs(amount) : 0,
    };
  }
  if (p.includes('/employees') && m === 'POST') {
    return { action: 'THÊM NHÂN SỰ', category: 'hr', desc: `Thêm nhân sự${body?.name ? `: ${body.name}` : ''}${body?.position ? ` (${body.position})` : ''}`, amount: 0 };
  }
  if (p.includes('/employees') && m === 'DELETE') {
    return { action: 'XÓA NHÂN SỰ', category: 'hr', desc: responseBody?.message || 'Xóa nhân sự khỏi hệ thống', amount: 0 };
  }

  return { skip: true };
}

const systemLogger = (req, res, next) => {
  const originalJson = res.json;

  res.json = function (body) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        const path = req.originalUrl || '';
        if (path.includes('/notifications/mark-read')) return originalJson.call(this, body);
        if (path.includes('/messages')) return originalJson.call(this, body);
        if (path.includes('/system-logs')) return originalJson.call(this, body);

        const described = describeAction(req.method, path, req.body, body) || {};
        if (described.skip || !described.action) return originalJson.call(this, body);
        if (!isVisibleSystemLogAction(described.action)) return originalJson.call(this, body);

        const ua = req.headers['user-agent'] || '';
        const device = parseDevice(ua);

        let user_id = req.user ? (req.user.id || req.user._id) : (req.body?.phone || 'Guest');
        let name = req.user ? req.user.name : 'Không rõ';
        let role = req.user ? req.user.role : 'guest';
        let adminRole = req.user?.adminRole || null;
        let branchCode = req.user?.branchCode || req.userBranchCode || '';

        SystemLog.create({
          user_id: String(user_id),
          name: String(name || 'Không rõ'),
          role: String(role),
          adminRole,
          branchCode,
          action: described.action,
          category: described.category || 'system',
          target: path,
          method: req.method,
          message: String(described.desc || described.action).slice(0, 500),
          amount: Number(described.amount) || 0,
          ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim()
            || req.headers['x-real-ip']
            || req.socket?.remoteAddress
            || req.ip
            || 'unknown',
          device,
          userAgent: ua.substring(0, 500),
        }).catch((err) => logger.error('[Logger] Failed to write SystemLog:', err));
      }
    }

    return originalJson.call(this, body);
  };

  next();
};

module.exports = systemLogger;
module.exports.describeAction = describeAction;
