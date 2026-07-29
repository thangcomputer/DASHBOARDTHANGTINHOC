/**
 * passwordProvisionService — Admin cấp mật khẩu (manual | auto).
 * Gửi Zalo/Email (queue) + in-app Notification + Audit + lịch sử.
 * Không ghi plaintext password vào Audit/Log DB.
 */
const crypto = require('crypto');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const PasswordProvisionLog = require('../models/PasswordProvisionLog');
const { enqueuePassword } = require('./queue/jobQueue');
const NotificationService = require('./NotificationService');
const { writeAudit } = require('./auditLogService');
const logger = require('../config/logger');

const MIN_LEN = 6;

function generatePassword(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

function resolvePassword(mode, newPassword) {
  const m = mode === 'manual' ? 'manual' : 'auto';
  if (m === 'manual') {
    const pw = String(newPassword || '').trim();
    if (pw.length < MIN_LEN) {
      const err = new Error(`Mật khẩu thủ công phải ít nhất ${MIN_LEN} ký tự`);
      err.status = 400;
      throw err;
    }
    return { mode: m, password: pw };
  }
  return { mode: 'auto', password: generatePassword(8) };
}

/**
 * @param {object} opts
 * @param {string} opts.userId
 * @param {'student'|'teacher'} opts.userRole
 * @param {'manual'|'auto'} [opts.mode]
 * @param {string} [opts.newPassword]
 * @param {object} opts.actor - { id, role }
 * @param {object} [opts.reqMeta] - { ip, userAgent, branchId }
 * @param {object} [opts.io]
 * @param {boolean} [opts.returnPassword=true] — trả 1 lần cho Admin (không lưu DB)
 */
async function provisionPassword(opts = {}) {
  const userRole = opts.userRole === 'teacher' ? 'teacher' : 'student';
  const Model = userRole === 'teacher' ? Teacher : Student;
  const user = await Model.findById(opts.userId).select('+password name phone zalo email branchId');
  if (!user) {
    const err = new Error('Không tìm thấy tài khoản');
    err.status = 404;
    throw err;
  }

  const { mode, password } = resolvePassword(opts.mode, opts.newPassword);

  user.password = password;
  user.isFirstLogin = true;
  await user.save({ validateModifiedOnly: true });

  const destPhone = String(user.zalo || user.phone || '').trim();
  const destEmail = String(user.email || '').trim();

  let queueJob = null;
  try {
    queueJob = await enqueuePassword({
      phone: destPhone || undefined,
      email: destEmail || undefined,
      password,
      userName: user.name,
    });
  } catch (err) {
    logger.warn('[passwordProvision] enqueuePassword: %s', err.message);
  }

  const io = opts.io || global.io;
  let notified = false;
  try {
    await NotificationService.send(io, {
      type: 'SYSTEM',
      title: 'Mật khẩu đã được cấp lại',
      content: 'Admin đã cấp mật khẩu mới. Vui lòng đăng nhập và đổi mật khẩu ngay. Chi tiết đã gửi Zalo/Email (nếu có).',
      receivers: [String(user._id)],
      payload: { action: 'PASSWORD_PROVISIONED', mode },
      link: userRole === 'teacher' ? '/teacher' : '/student',
    });
    notified = true;
  } catch (err) {
    logger.warn('[passwordProvision] notify: %s', err.message);
  }

  const actor = opts.actor || {};
  const reqMeta = opts.reqMeta || {};

  try {
    await writeAudit({
      action: 'auth.password_provisioned',
      actorUserId: actor.id || '',
      actorRole: actor.role || '',
      branchId: reqMeta.branchId || user.branchId || null,
      entityType: userRole,
      entityId: String(user._id),
      studentId: userRole === 'student' ? user._id : null,
      teacherId: userRole === 'teacher' ? user._id : null,
      oldValue: { isFirstLogin: false },
      newValue: { mode, isFirstLogin: true, password: '[REDACTED]' },
      ip: reqMeta.ip || '',
      userAgent: reqMeta.userAgent || '',
    });
  } catch (err) {
    logger.warn('[passwordProvision] audit: %s', err.message);
  }

  let history = null;
  try {
    history = await PasswordProvisionLog.create({
      targetUserId: String(user._id),
      targetRole: userRole,
      targetName: user.name,
      mode,
      actorUserId: actor.id != null ? String(actor.id) : '',
      actorRole: actor.role || '',
      branchId: reqMeta.branchId || user.branchId || null,
      channelsQueued: {
        zalo: Boolean(destPhone && queueJob),
        email: Boolean(destEmail && queueJob),
        notification: notified,
      },
      queueJobId: queueJob?.id != null ? String(queueJob.id) : '',
      ip: reqMeta.ip || '',
    });
  } catch (err) {
    logger.warn('[passwordProvision] history: %s', err.message);
  }

  const returnPassword = opts.returnPassword !== false;
  return {
    success: true,
    name: user.name,
    mode,
    phone: destPhone,
    email: destEmail || null,
    queued: Boolean(queueJob),
    queueMode: queueJob?.mode,
    historyId: history?._id ? String(history._id) : null,
    ...(returnPassword ? { temporaryPassword: password } : {}),
  };
}

module.exports = {
  generatePassword,
  resolvePassword,
  provisionPassword,
  MIN_LEN,
};
