/**
 * Onboard tài khoản mới: queue email/Zalo + notification in-app.
 * Không ghi mật khẩu vào notification (chỉ qua kênh messaging).
 */
const logger = require('../config/logger');
const NotificationService = require('./NotificationService');
const { enqueueWelcome } = require('./queue/jobQueue');

/**
 * @param {import('socket.io').Server|null} io
 * @param {{
 *   role: 'teacher'|'student',
 *   userId: string,
 *   name?: string,
 *   phone?: string,
 *   zalo?: string,
 *   email?: string,
 *   password?: string,
 * }} opts
 * @returns {Promise<{ queued: boolean, notified: boolean }>}
 */
async function sendAccountWelcome(io, opts = {}) {
  const role = opts.role === 'teacher' ? 'teacher' : 'student';
  const userId = opts.userId ? String(opts.userId) : '';
  const name = opts.name || (role === 'teacher' ? 'Giảng viên' : 'Học viên');
  const phone = String(opts.phone || '').trim();
  const destPhone = String(opts.zalo || opts.phone || '').trim();
  const email = String(opts.email || '').trim() || undefined;
  const password = opts.password != null ? String(opts.password) : '';

  let queued = false;
  if (password && (destPhone || email)) {
    try {
      await enqueueWelcome({
        role,
        phone: destPhone || undefined,
        email,
        password,
        userName: name,
        loginId: phone || destPhone,
      });
      queued = true;
    } catch (err) {
      logger.warn({ err: err.message, role, userId }, '[Welcome] enqueue failed');
    }
  }

  let notified = false;
  if (io && userId) {
    const isTeacher = role === 'teacher';
    try {
      await NotificationService.send(io, {
        type: 'SYSTEM',
        title: isTeacher ? 'Chào mừng giảng viên' : 'Chào mừng học viên',
        content: phone
          ? `Tài khoản của bạn đã được tạo. Đăng nhập bằng SĐT ${phone}. Mật khẩu tạm được gửi qua email/Zalo (nếu hệ thống đã cấu hình).`
          : 'Tài khoản của bạn đã được tạo. Mật khẩu tạm được gửi qua email/Zalo (nếu hệ thống đã cấu hình).',
        receivers: userId,
        link: isTeacher ? '/teacher' : '/student',
        payload: { kind: 'account_welcome', role },
      });
      notified = true;
    } catch (err) {
      logger.warn({ err: err.message, role, userId }, '[Welcome] notification failed');
    }
  }

  return { queued, notified };
}

module.exports = { sendAccountWelcome };
