const logger = require('../config/logger');
const NotificationService = require('./NotificationService');

const MAX_KNOWN_DEVICES = 30;
/** Báo Admin khi fingerprint mới làm số trình duyệt > 2. Không chặn đăng nhập. */
const ALERT_AFTER_COUNT = 2;

const STUDENT_LOCKED_RESPONSE = {
  success: false,
  isBan: true,
  code: 'ACCOUNT_LOCKED',
  message: 'Tài khoản học viên đã bị khóa đăng nhập. Vui lòng liên hệ trung tâm.',
};

function isStudentAccountLocked(user) {
  return !!(user && user.accountLocked);
}

/**
 * Ghi nhận fingerprint trình duyệt của HV vào knownDevices (không đụng session 1 máy).
 * Cần load +knownDevices trên document trước khi gọi.
 */
function recordStudentKnownDevice(student, fingerprint, userAgent) {
  const fp = String(fingerprint || '').trim().slice(0, 128);
  const currentCount = Array.isArray(student?.knownDevices)
    ? student.knownDevices.length
    : (Number(student?.knownDeviceCount) || 0);
  if (!student || !fp) {
    return { isNew: false, count: currentCount };
  }

  const ua = String(userAgent || '').trim().slice(0, 180);
  const now = new Date();
  if (!Array.isArray(student.knownDevices)) student.knownDevices = [];

  const existing = student.knownDevices.find((d) => String(d.fingerprint) === fp);
  if (existing) {
    existing.lastSeenAt = now;
    if (ua) existing.userAgent = ua;
    student.knownDeviceCount = student.knownDevices.length;
    student.markModified('knownDevices');
    return { isNew: false, count: student.knownDevices.length };
  }

  student.knownDevices.push({
    fingerprint: fp,
    userAgent: ua,
    firstSeenAt: now,
    lastSeenAt: now,
  });
  if (student.knownDevices.length > MAX_KNOWN_DEVICES) {
    student.knownDevices = student.knownDevices.slice(-MAX_KNOWN_DEVICES);
  }
  student.knownDeviceCount = student.knownDevices.length;
  student.markModified('knownDevices');
  return { isNew: true, count: student.knownDevices.length };
}

async function notifyIfNewStudentDevice(io, student, record) {
  if (!record?.isNew || record.count <= ALERT_AFTER_COUNT) return;
  try {
    const sid = String(student._id);
    const name = student.name || 'Học viên';
    const phone = student.phone || student.zalo || '';
    await NotificationService.notifyBranchAdmins(io, {
      branchId: student.branchId || null,
      title: 'Học viên dùng thêm trình duyệt',
      content: `${name}${phone ? ` (${phone})` : ''} vừa đăng nhập trên trình duyệt thứ ${record.count}. Tài khoản vẫn được vào — Admin có thể reset thiết bị hoặc khóa đăng nhập.`,
      payload: {
        kind: 'student_device_alert',
        studentId: sid,
        studentName: name,
        phone,
        deviceCount: record.count,
      },
      link: `/admin#students?studentId=${encodeURIComponent(sid)}`,
    });
  } catch (err) {
    logger.warn('[AUTH] student device notify: %s', err.message);
  }
}

module.exports = {
  recordStudentKnownDevice,
  notifyIfNewStudentDevice,
  isStudentAccountLocked,
  STUDENT_LOCKED_RESPONSE,
};
