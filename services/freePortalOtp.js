/**
 * Service quản lý gửi và xác minh mã OTP (Gmail hoặc SMS điện thoại) cho đăng ký tài khoản DewSkill / Mobile App.
 * Giúp xác thực người dùng thật và ngăn spam tài khoản.
 */
const crypto = require('crypto');
const Student = require('../models/Student');
const { FREE_COURSE_NAME } = require('./freePortal');
const { issueSession } = require('./freePortalSocial');
const { sendEmail, isEmailConfigured } = require('./messaging/email');
const { sendSms, isSmsConfigured } = require('./messaging/sms');
const { normalizeVNPhone } = require('../utils/phoneIdentity');
const { assertUniqueContact } = require('../utils/uniqueContact');
const logger = require('../config/logger');

const EMAIL_RE = /^[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}$/;
const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;

// Bộ nhớ tạm lưu trữ phiên OTP chờ kích hoạt (Key: canonicalEmail hoặc canonicalPhone)
const pendingRegistrations = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, data] of pendingRegistrations.entries()) {
    if (data.expiresAt < now) {
      pendingRegistrations.delete(key);
    }
  }
}, 120000).unref();

function escapeHtml(raw) {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderOtpHtml(name, otp) {
  const safeName = escapeHtml(name);
  return `
    <div style="max-width:540px;margin:0 auto;font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
      <div style="background:linear-gradient(135deg,#064e3b 0%,#047857 60%,#10b981 100%);padding:28px 24px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:900;letter-spacing:0.5px;">DewSkill · Thắng Tin Học</h1>
        <p style="color:#a7f3d0;margin:6px 0 0;font-size:13px;font-weight:600;">Xác thực đăng ký tài khoản học tập</p>
      </div>
      <div style="padding:28px 24px;color:#1e293b;">
        <p style="font-size:15px;margin:0 0 12px;color:#334155;">Xin chào <strong>${safeName}</strong>,</p>
        <p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 20px;">
          Cảm ơn bạn đã đăng ký tài khoản tại <strong>Thắng Tin Học / DewSkill</strong>. Vui lòng nhập mã xác thực 6 chữ số dưới đây để hoàn tất kích hoạt và vào học ngay:
        </p>
        <div style="background:#ecfdf5;border:2px dashed #10b981;border-radius:12px;padding:18px;text-align:center;margin:0 0 20px;">
          <span style="font-size:11px;font-weight:800;letter-spacing:1px;color:#047857;text-transform:uppercase;display:block;margin-bottom:6px;">MÃ XÁC THỰC ĐĂNG KÝ</span>
          <span style="font-size:32px;font-weight:900;letter-spacing:8px;color:#065f46;font-family:Consolas,monaco,monospace;display:inline-block;padding-left:8px;">${otp}</span>
          <span style="font-size:12px;color:#059669;display:block;margin-top:6px;font-weight:600;">Có hiệu lực trong vòng 5 phút</span>
        </div>
        <p style="font-size:12px;line-height:1.5;color:#64748b;margin:0 0 8px;">
          • Vui lòng không chia sẻ mã này cho bất kỳ ai để đảm bảo an toàn tài khoản.<br/>
          • Nếu bạn không yêu cầu tạo tài khoản này, vui lòng bỏ qua email.
        </p>
      </div>
      <div style="background:#f8fafc;padding:16px 24px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8;">
        <p style="margin:0;">© Thắng Tin Học • DewSkill LMS</p>
      </div>
    </div>
  `;
}

function resolveContactInput({ identifier, email, phone }) {
  const rawIdentifier = String(identifier || '').trim();
  const rawEmail = String(email || '').trim().toLowerCase();
  const rawPhone = String(phone || '').trim();

  if (rawIdentifier) {
    if (EMAIL_RE.test(rawIdentifier.toLowerCase())) {
      const cleanEmail = rawIdentifier.toLowerCase();
      const extraPhone = rawPhone ? normalizeVNPhone(rawPhone) : '';
      return { contactType: 'email', key: cleanEmail, email: cleanEmail, phone: extraPhone };
    }
    const cleanPhone = normalizeVNPhone(rawIdentifier);
    if (cleanPhone) {
      const extraEmail = rawEmail && EMAIL_RE.test(rawEmail) ? rawEmail : '';
      return { contactType: 'sms', key: cleanPhone, email: extraEmail, phone: cleanPhone };
    }
    return null;
  }

  if (rawEmail && EMAIL_RE.test(rawEmail)) {
    const extraPhone = rawPhone ? normalizeVNPhone(rawPhone) : '';
    if (rawPhone && !extraPhone) return null;
    return { contactType: 'email', key: rawEmail, email: rawEmail, phone: extraPhone };
  }

  if (rawPhone) {
    const cleanPhone = normalizeVNPhone(rawPhone);
    if (!cleanPhone) return null;
    return { contactType: 'sms', key: cleanPhone, email: '', phone: cleanPhone };
  }

  return null;
}

function parseAgeOptional(age) {
  if (age === undefined || age === null || String(age).trim() === '') return 18;
  const n = Number.parseInt(String(age).trim(), 10);
  if (!Number.isFinite(n) || n < 10 || n > 80) return null;
  return n;
}

async function dispatchRegistrationOtp({ contactType, email, phone, name, otp }) {
  if (contactType === 'email') {
    const configured = isEmailConfigured();
    let sent = false;
    if (configured) {
      const res = await sendEmail({
        to: email,
        subject: `[Thắng Tin Học] Mã xác thực đăng ký tài khoản: ${otp}`,
        text: `[Thang Tin Hoc] Xin chao ${name}, ma xac thuc dang ky cua ban la: ${otp}. Hieu luc 5 phut.`,
        html: renderOtpHtml(name, otp),
      });
      sent = Boolean(res?.ok);
      if (!sent) {
        logger.warn({ email, err: res?.error || res?.reason }, '[Register OTP] Gửi email thất bại');
      }
    } else if (process.env.NODE_ENV !== 'production') {
      logger.info(`[Register OTP] (Dev - Chưa cấu hình SMTP) Mã OTP của ${email}: ${otp}`);
    }
    return { channel: 'email', channelConfigured: configured, delivered: sent };
  }

  const configured = isSmsConfigured();
  let sent = false;
  if (configured) {
    const res = await sendSms({
      phone,
      code: otp,
      message: `[Thang Tin Hoc] Ma xac thuc dang ky tai khoan cua ban la: ${otp} (hieu luc 5 phut).`,
    });
    sent = Boolean(res?.ok);
    if (!sent) {
      logger.warn({ err: res?.error || res?.reason }, '[Register OTP] Gửi SMS thất bại');
    }
  } else if (process.env.NODE_ENV !== 'production') {
    logger.info(`[Register OTP] (Dev - Chưa cấu hình SMS) Mã OTP của ${phone}: ${otp}`);
  }
  return { channel: 'sms', channelConfigured: configured, delivered: sent };
}

/**
 * Gửi hoặc tạo mã OTP xác thực đăng ký (hỗ trợ cả Gmail và Số điện thoại SMS).
 */
async function sendRegisterOtp({ name, age, identifier, email, phone, password }) {
  const displayName = String(name || '').trim();
  const parsedAge = parseAgeOptional(age);
  const resolved = resolveContactInput({ identifier, email, phone });

  if (displayName.length < 2) {
    const err = new Error('Hãy nhập họ và tên (ít nhất 2 ký tự)');
    err.status = 400;
    throw err;
  }
  if (!parsedAge) {
    const err = new Error('Tuổi hợp lệ từ 10 đến 80');
    err.status = 400;
    throw err;
  }
  if (!resolved) {
    const err = new Error('Vui lòng nhập số điện thoại hoặc Gmail hợp lệ');
    err.status = 400;
    throw err;
  }
  if (!password || String(password).length < 6) {
    const err = new Error('Mật khẩu cần ít nhất 6 ký tự');
    err.status = 400;
    throw err;
  }

  if (resolved.phone) {
    const existingPhone = await Student.findOne({ $or: [{ phone: resolved.phone }, { zalo: resolved.phone }] });
    if (existingPhone) {
      const err = new Error(
        existingPhone.freePortal === true
          ? 'Số điện thoại này đã có tài khoản. Hãy đăng nhập.'
          : 'Số này thuộc học viên khóa học trung tâm. Hãy đăng nhập ở trang LMS.',
      );
      err.status = 409;
      err.code = 'ACCOUNT_ALREADY_EXISTS';
      throw err;
    }
  }

  if (resolved.email) {
    const existingEmail = await Student.findOne({ email: resolved.email });
    if (existingEmail) {
      const err = new Error('Địa chỉ Gmail này đã được sử dụng. Vui lòng đăng nhập.');
      err.status = 409;
      err.code = 'ACCOUNT_ALREADY_EXISTS';
      throw err;
    }
  }

  try {
    await assertUniqueContact({
      ...(resolved.phone ? { phone: resolved.phone } : {}),
      ...(resolved.email ? { email: resolved.email } : {}),
    });
  } catch (dupErr) {
    if (dupErr && dupErr.status === 409) {
      dupErr.code = 'ACCOUNT_ALREADY_EXISTS';
    }
    throw dupErr;
  }

  const current = pendingRegistrations.get(resolved.key);
  const now = Date.now();
  if (current && now - current.lastSentAt < RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (now - current.lastSentAt)) / 1000);
    const err = new Error(`Vui lòng chờ ${waitSec} giây trước khi gửi lại mã.`);
    err.status = 429;
    throw err;
  }

  const otp = String(crypto.randomInt(100000, 1000000));

  pendingRegistrations.set(resolved.key, {
    key: resolved.key,
    contactType: resolved.contactType,
    name: displayName,
    age: parsedAge,
    email: resolved.email || '',
    phone: resolved.phone || '',
    password: String(password),
    otp,
    attempts: 0,
    createdAt: now,
    lastSentAt: now,
    expiresAt: now + OTP_TTL_MS,
  });

  const delivery = await dispatchRegistrationOtp({
    contactType: resolved.contactType,
    email: resolved.email,
    phone: resolved.phone,
    name: displayName,
    otp,
  });

  const targetLabel = resolved.contactType === 'email' ? resolved.email : resolved.phone;
  const devOtpField = process.env.NODE_ENV !== 'production' && !delivery.delivered ? { devOtp: otp } : {};

  return {
    success: true,
    identifier: targetLabel,
    email: resolved.email || '',
    phone: resolved.phone || '',
    channel: delivery.channel,
    channelConfigured: delivery.channelConfigured,
    emailSent: delivery.channel === 'email' && delivery.delivered,
    smsSent: delivery.channel === 'sms' && delivery.delivered,
    expiresIn: 300,
    resendAfterSec: 45,
    ...devOtpField,
    message: delivery.delivered
      ? `Mã xác thực 6 chữ số đã được gửi tới ${targetLabel}`
      : `Đã tạo mã xác thực cho ${targetLabel}`,
  };
}

/**
 * Gửi lại mã OTP cho phiên đăng ký đang chờ xác thực (Gmail hoặc SĐT).
 */
async function resendRegisterOtp({ identifier, email, phone }) {
  const resolved = resolveContactInput({ identifier, email, phone });
  const current = resolved ? pendingRegistrations.get(resolved.key) : null;
  if (!current) {
    const err = new Error('Phiên đăng ký đã hết hạn. Vui lòng nhập lại thông tin.');
    err.status = 400;
    throw err;
  }

  const now = Date.now();
  if (now - current.lastSentAt < RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (now - current.lastSentAt)) / 1000);
    const err = new Error(`Vui lòng chờ ${waitSec} giây trước khi gửi lại mã.`);
    err.status = 429;
    throw err;
  }

  const newOtp = String(crypto.randomInt(100000, 1000000));
  current.otp = newOtp;
  current.attempts = 0;
  current.lastSentAt = now;
  current.expiresAt = now + OTP_TTL_MS;

  const delivery = await dispatchRegistrationOtp({
    contactType: current.contactType,
    email: current.email,
    phone: current.phone,
    name: current.name,
    otp: newOtp,
  });

  const devOtpField = process.env.NODE_ENV !== 'production' && !delivery.delivered ? { devOtp: newOtp } : {};
  return {
    success: true,
    identifier: current.key,
    email: current.email,
    phone: current.phone,
    channel: delivery.channel,
    channelConfigured: delivery.channelConfigured,
    emailSent: delivery.channel === 'email' && delivery.delivered,
    smsSent: delivery.channel === 'sms' && delivery.delivered,
    resendAfterSec: 45,
    ...devOtpField,
    message: `Đã gửi lại mã xác thực tới ${current.key}`,
  };
}

/**
 * Xác thực mã OTP (Gmail hoặc SĐT) và tạo tài khoản Student mới.
 * Tài khoản mới tạo tự kích hoạt hoàn chỉnh (isFirstLogin=false, mustChangePassword=false) để vào học ngay không cần đổi mật khẩu.
 */
async function verifyOtpAndRegister({ identifier, email, phone, otp, deviceFingerprint }) {
  const resolved = resolveContactInput({ identifier, email, phone });
  const code = String(otp || '').replace(/\D/g, '');

  if (!resolved || code.length !== 6) {
    const err = new Error('Vui lòng nhập đầy đủ SĐT/Gmail và mã xác thực 6 chữ số');
    err.status = 400;
    throw err;
  }

  const pending = pendingRegistrations.get(resolved.key);
  if (!pending) {
    const err = new Error('Mã xác thực đã hết hạn hoặc không tồn tại. Vui lòng gửi lại mã mới.');
    err.status = 400;
    throw err;
  }

  if (Date.now() > pending.expiresAt) {
    pendingRegistrations.delete(resolved.key);
    const err = new Error('Mã xác thực đã quá hạn 5 phút. Vui lòng yêu cầu mã mới.');
    err.status = 400;
    throw err;
  }

  if (pending.attempts >= 5) {
    pendingRegistrations.delete(resolved.key);
    const err = new Error('Bạn đã nhập sai mã quá 5 lần. Vui lòng yêu cầu mã mới.');
    err.status = 429;
    throw err;
  }

  const a = Buffer.from(String(pending.otp || ''), 'utf8');
  const b = Buffer.from(code, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    pending.attempts += 1;
    const remaining = 5 - pending.attempts;
    if (remaining <= 0) {
      pendingRegistrations.delete(resolved.key);
      const err = new Error('Bạn đã nhập sai mã quá 5 lần. Vui lòng yêu cầu mã mới.');
      err.status = 429;
      throw err;
    }
    const err = new Error(`Mã xác thực không chính xác. Bạn còn ${remaining} lần thử.`);
    err.status = 400;
    throw err;
  }

  const student = await Student.create({
    name: pending.name,
    ...(pending.phone ? { phone: pending.phone, zalo: pending.phone } : {}),
    ...(pending.email ? { email: pending.email } : {}),
    age: pending.age || 18,
    password: pending.password,
    course: FREE_COURSE_NAME,
    price: 0,
    paid: true,
    paidAmount: 0,
    status: 'Đang học',
    learningMode: 'ONLINE',
    accountType: 'dewskill',
    freePortal: true,
    freeUnlocked: false,
    isFirstLogin: false,
    mustChangePassword: false,
    enrollments: [{
      courseName: FREE_COURSE_NAME,
      price: 0,
      paid: true,
      status: 'active',
      learningAccess: true,
      isPrimary: true,
      totalSessions: 0,
      remainingSessions: 0,
    }],
  });

  pendingRegistrations.delete(resolved.key);

  const session = await issueSession(student, deviceFingerprint);

  return {
    success: true,
    message: 'Xác thực tài khoản thành công!',
    data: session,
  };
}

module.exports = {
  sendRegisterOtp,
  resendRegisterOtp,
  verifyOtpAndRegister,
  _pendingRegistrationsForTest: pendingRegistrations,
};
