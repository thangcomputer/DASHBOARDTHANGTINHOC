/**
 * systemLogger.js — Middleware ghi nhật ký hoạt động hệ thống
 *
 * Chỉ ghi các hành động trong SYSTEM_LOG_VISIBLE_ACTIONS.
 */
const SystemLog = require('../models/SystemLog');
const logger = require('../config/logger');
const { isVisibleSystemLogAction } = require('../constants/systemLogActions');

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

  // ── Students ──
  if (p.includes('/students') && p.includes('/enrollments') && p.includes('/pay') && method === 'PUT') {
    return { skip: true };
  }

  if (p.includes('/students') && p.includes('/enrollments') && method === 'DELETE') {
    const refundAmt = firstPositiveAmount(
      responseBody?.meta?.refundedAmount,
      body?.refundAmount,
    );
    const course = responseBody?.data?.course || body?.courseName || '';
    if (refundAmt > 0) {
      return {
        action: 'HOÀN HỌC PHÍ',
        category: 'finance',
        desc: `Hoàn tiền khi hủy khóa${course ? ` "${course}"` : ''}`,
        amount: -Math.abs(refundAmt),
      };
    }
    return { skip: true };
  }

  if (p.includes('/students') && p.includes('/refund')) {
    const amount = firstPositiveAmount(
      responseBody?.data?.refundedAmount,
      body?.amount,
    );
    const name = responseBody?.data?.student?.name || '';
    return {
      action: 'HOÀN HỌC PHÍ',
      category: 'finance',
      desc: `Hoàn tiền học viên${name ? `: ${name}` : ''}`,
      amount: amount ? -Math.abs(amount) : 0,
    };
  }

  if (p.includes('/students') && method === 'POST' && !p.includes('/enrollments') && !p.includes('/import')) {
    const sName = responseBody?.data?.name || body?.name || '';
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
      desc: `Thêm học viên${sName ? `: ${sName}` : ''}${paid && amount ? ` (đã thu)` : ''}`,
      amount: paid ? amount : 0,
    };
  }

  if (p.includes('/students') && method === 'PUT'
    && !p.includes('/pay')
    && !p.includes('/refund')
    && !p.includes('/price')
    && !p.includes('/unlock')
    && !p.includes('/lock')
    && !p.includes('/exam')
    && !p.includes('/assign')
    && !p.includes('/enrollments')) {
    const sName = responseBody?.data?.name || body?.name || '';
    return {
      action: 'CẬP NHẬT HV',
      category: 'student',
      desc: `Đổi thông tin học viên${sName ? `: ${sName}` : ''}`,
      amount: 0,
    };
  }

  if (p.includes('/students') && method === 'DELETE' && !p.includes('/enrollments')) {
    return { action: 'XÓA HỌC VIÊN', category: 'student', desc: 'Xóa học viên khỏi hệ thống', amount: 0 };
  }

  // ── Teachers ──
  if (p.includes('/teachers') && method === 'POST' && !p.includes('/finance')) {
    const tName = body?.name || responseBody?.data?.name || '';
    return {
      action: 'THÊM GIẢNG VIÊN',
      category: 'teacher',
      desc: `Thêm giảng viên${tName ? `: ${tName}` : ''}`,
      amount: 0,
    };
  }
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
  if (p.includes('/teachers') && method === 'PUT'
    && !p.includes('/approve')
    && !p.includes('/reject')
    && !p.includes('/score')
    && !p.includes('/finance')) {
    const tName = responseBody?.data?.name || body?.name || '';
    return {
      action: 'CẬP NHẬT GV',
      category: 'teacher',
      desc: `Đổi thông tin giảng viên${tName ? `: ${tName}` : ''}`,
      amount: 0,
    };
  }
  if (p.includes('/teachers') && method === 'DELETE') {
    return { action: 'XÓA GIẢNG VIÊN', category: 'teacher', desc: 'Xóa giảng viên khỏi hệ thống', amount: 0 };
  }

  // ── Transactions (confirm lương) ──
  if (p.includes('/transactions') && p.includes('/confirm')) {
    const amount = firstPositiveAmount(responseBody?.data?.amount, body?.amount);
    const name = responseBody?.data?.teacherName
      || responseBody?.data?.teacherId?.name
      || '';
    return {
      action: 'XÁC NHẬN LƯƠNG',
      category: 'finance',
      desc: `Xác nhận thanh toán lương GV${name ? `: ${name}` : ''}`,
      amount: amount ? -Math.abs(amount) : 0,
    };
  }

  // ── Staff ──
  if (p.includes('/staff') && method === 'POST') {
    return {
      action: 'THÊM NHÂN VIÊN',
      category: 'staff',
      desc: `Thêm nhân viên${body?.name ? `: ${body.name}` : ''}`,
      amount: 0,
    };
  }
  if (p.includes('/staff') && method === 'PUT') {
    return {
      action: 'PHÂN QUYỀN',
      category: 'staff',
      desc: `Cấp / cập nhật quyền nhân viên${body?.name ? `: ${body.name}` : ''}`,
      amount: 0,
    };
  }
  if (p.includes('/staff') && method === 'DELETE') {
    return { action: 'XÓA NHÂN VIÊN', category: 'staff', desc: 'Xóa nhân viên khỏi hệ thống', amount: 0 };
  }

  // ── Employees (HR) ──
  if (p.includes('/employees') && p.includes('/pay') && method === 'POST') {
    const empName = responseBody?.data?.employeeName || body?.employeeName || '';
    const amount = firstPositiveAmount(responseBody?.data?.amount, body?.amount);
    return {
      action: 'THANH TOÁN LƯƠNG',
      category: 'hr',
      desc: `Thanh toán tiền nhân viên${empName ? `: ${empName}` : ''}${body?.monthLabel ? ` (${body.monthLabel})` : ''}`,
      amount: amount ? -Math.abs(amount) : 0,
    };
  }
  if (p.includes('/employees') && method === 'POST') {
    return {
      action: 'THÊM NHÂN SỰ',
      category: 'hr',
      desc: `Thêm nhân sự${body?.name ? `: ${body.name}` : ''}${body?.position ? ` (${body.position})` : ''}`,
      amount: 0,
    };
  }
  if (p.includes('/employees') && method === 'DELETE') {
    return {
      action: 'XÓA NHÂN SỰ',
      category: 'hr',
      desc: responseBody?.message || 'Xóa nhân sự khỏi hệ thống',
      amount: 0,
    };
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
