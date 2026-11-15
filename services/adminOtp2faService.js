'use strict';

const crypto = require('crypto');
const logger = require('../config/logger');
const { normalizeVNPhone, maskPhone } = require('../utils/phoneIdentity');
const { sendZaloText } = require('./messaging/zaloOa');
const { sendEmail, isEmailConfigured } = require('./messaging/email');

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

// challengeId -> { otpHash, userId, role, purpose, channel, phone, email, expiresAt, createdAt, lastSentAt, attempts, meta }
const challengeStore = new Map();

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of challengeStore.entries()) {
    if (entry.expiresAt <= now) challengeStore.delete(id);
  }
}, 60 * 1000);
if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref();

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp || '').trim()).digest('hex');
}

function generateSixDigitOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function escapeHtml(raw) {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function maskEmail(email) {
  const s = String(email || '').trim().toLowerCase();
  const atIdx = s.indexOf('@');
  if (atIdx <= 1) return s ? `***${s.slice(atIdx)}` : '';
  const local = s.slice(0, atIdx);
  const domain = s.slice(atIdx + 1);
  return `${local.slice(0, 2)}***@${domain}`;
}

async function deliverOtpChannels({ channel = 'both', phone = '', email = '', otp, userName = 'Quản trị viên' }) {
  const cleanPhone = normalizeVNPhone(phone);
  const cleanEmail = String(email || '').trim().toLowerCase();
  const wantZalo = (channel === 'zalo' || channel === 'both') && Boolean(cleanPhone);
  const wantEmail = (channel === 'email' || channel === 'both') && Boolean(cleanEmail && cleanEmail.includes('@'));

  const sentVia = [];
  const errors = [];

  const textMsg = `[Thắng Tin Học] Mã xác thực 2 lớp (2FA) đăng nhập quản trị của ${userName}: ${otp}. Hiệu lực 5 phút. Tuyệt đối KHÔNG chia sẻ mã này cho bất kỳ ai.`;

  if (wantZalo) {
    try {
      const zRes = await sendZaloText(cleanPhone, textMsg);
      if (zRes?.ok) {
        sentVia.push('zalo');
      } else {
        errors.push({ channel: 'zalo', reason: zRes?.reason || 'failed' });
      }
    } catch (err) {
      errors.push({ channel: 'zalo', reason: err.message });
    }
  }

  const safeUserName = escapeHtml(userName);

  if (wantEmail) {
    try {
      const eRes = await sendEmail({
        to: cleanEmail,
        subject: `[Thắng Tin Học] Mã OTP xác thực 2 lớp (2FA): ${otp}`,
        text: textMsg,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;background:#ffffff">
            <p style="font-size:12px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px">Bảo mật 2 lớp (2FA)</p>
            <h2 style="margin:0 0 12px;color:#0f172a;font-size:20px">Mã xác thực quản trị</h2>
            <p style="color:#475569;font-size:14px;line-height:1.6">Xin chào <strong>${safeUserName}</strong>, mã OTP để xác thực đăng nhập/thiết lập bảo mật 2 lớp của bạn là:</p>
            <div style="margin:20px 0;padding:16px;text-align:center;background:#f0fdf4;border:1px dashed #10b981;border-radius:12px">
              <span style="font-size:32px;font-weight:900;letter-spacing:8px;color:#047857">${otp}</span>
            </div>
            <p style="color:#64748b;font-size:12px;margin:0">Mã có hiệu lực trong <strong>5 phút</strong>. Nếu không phải bạn thực hiện, vui lòng đổi mật khẩu quản trị và đăng xuất các thiết bị lạ ngay lập tức.</p>
          </div>
        `,
      });
      if (eRes?.ok) {
        sentVia.push('email');
      } else {
        errors.push({ channel: 'email', reason: eRes?.reason || 'failed' });
      }
    } catch (err) {
      errors.push({ channel: 'email', reason: err.message });
    }
  }

  return {
    deliveryOk: sentVia.length > 0,
    sentVia,
    errors,
    maskedPhone: cleanPhone ? maskPhone(cleanPhone) : '',
    maskedEmail: cleanEmail ? maskEmail(cleanEmail) : '',
  };
}

/**
 * Creates a fresh 2FA OTP challenge and dispatches the code over Zalo / Email.
 */
async function createAndSendOtpChallenge({
  userId,
  role,
  purpose = 'login_otp',
  channel = 'both',
  phone = '',
  email = '',
  userName = 'Quản trị viên',
  meta = {},
}) {
  const challengeId = crypto.randomUUID();
  const otp = generateSixDigitOtp();
  const now = Date.now();

  const delivery = await deliverOtpChannels({ channel, phone, email, otp, userName });

  challengeStore.set(challengeId, {
    otpHash: hashOtp(otp),
    userId: String(userId),
    role: String(role || 'admin'),
    purpose,
    channel,
    phone: normalizeVNPhone(phone) || '',
    email: String(email || '').trim().toLowerCase(),
    userName,
    expiresAt: now + OTP_TTL_MS,
    createdAt: now,
    lastSentAt: now,
    attempts: 0,
    meta,
  });

  if (process.env.NODE_ENV !== 'production') {
    logger.info(
      { userId: String(userId), purpose, sentVia: delivery.sentVia, otp },
      '[ADMIN_2FA_OTP] Dev OTP issued',
    );
  } else {
    logger.info(
      { userId: String(userId), purpose, sentVia: delivery.sentVia },
      '[ADMIN_2FA_OTP] OTP issued',
    );
  }

  return {
    challengeId,
    expiresIn: Math.floor(OTP_TTL_MS / 1000),
    resendAfterSec: Math.floor(RESEND_COOLDOWN_MS / 1000),
    ...delivery,
  };
}

async function resendOtpChallenge(challengeId) {
  const entry = challengeStore.get(String(challengeId || ''));
  if (!entry || entry.expiresAt <= Date.now()) {
    return { ok: false, status: 401, message: 'Phiên OTP đã hết hạn. Vui lòng đăng nhập lại.' };
  }
  const waitMs = RESEND_COOLDOWN_MS - (Date.now() - entry.lastSentAt);
  if (waitMs > 0) {
    return {
      ok: false,
      status: 429,
      retryAfterSec: Math.ceil(waitMs / 1000),
      message: `Vui lòng đợi ${Math.ceil(waitMs / 1000)} giây trước khi gửi lại OTP.`,
    };
  }

  const nextOtp = generateSixDigitOtp();
  entry.otpHash = hashOtp(nextOtp);
  entry.lastSentAt = Date.now();
  entry.expiresAt = Date.now() + OTP_TTL_MS;
  entry.attempts = 0;

  const delivery = await deliverOtpChannels({
    channel: entry.channel,
    phone: entry.phone,
    email: entry.email,
    otp: nextOtp,
    userName: entry.userName,
  });

  if (process.env.NODE_ENV !== 'production') {
    logger.info({ challengeId, otp: nextOtp, sentVia: delivery.sentVia }, '[ADMIN_2FA_OTP] Dev OTP resent');
  }

  return {
    ok: true,
    expiresIn: Math.floor(OTP_TTL_MS / 1000),
    resendAfterSec: Math.floor(RESEND_COOLDOWN_MS / 1000),
    ...delivery,
  };
}

function verifyOtpChallenge(challengeId, candidateCode, expectedUserId = null, expectedPurpose = null) {
  const id = String(challengeId || '');
  const entry = challengeStore.get(id);
  if (!entry) {
    return { ok: false, status: 401, message: 'Phiên OTP không tồn tại hoặc đã hết hạn.' };
  }
  if (entry.expiresAt <= Date.now()) {
    challengeStore.delete(id);
    return { ok: false, status: 401, message: 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.' };
  }
  if (expectedUserId && String(expectedUserId) !== entry.userId) {
    return { ok: false, status: 403, message: 'Mã OTP không khớp tài khoản.' };
  }
  if (expectedPurpose && entry.purpose !== expectedPurpose) {
    return { ok: false, status: 400, message: 'Loại OTP không hợp lệ.' };
  }

  const clean = String(candidateCode || '').replace(/\D/g, '');
  if (clean.length !== 6) {
    return { ok: false, status: 400, message: 'Vui lòng nhập đủ 6 chữ số OTP.' };
  }

  const a = Buffer.from(entry.otpHash, 'hex');
  const b = Buffer.from(hashOtp(clean), 'hex');
  const matched = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!matched) {
    entry.attempts += 1;
    if (entry.attempts >= MAX_VERIFY_ATTEMPTS) {
      challengeStore.delete(id);
      return { ok: false, status: 401, message: 'Nhập sai OTP quá 5 lần. Phiên đã bị hủy.' };
    }
    return {
      ok: false,
      status: 401,
      message: `Mã OTP không đúng (còn ${MAX_VERIFY_ATTEMPTS - entry.attempts} lần thử).`,
    };
  }

  const meta = entry.meta || {};
  challengeStore.delete(id);
  return { ok: true, userId: entry.userId, role: entry.role, meta };
}

function getChannelReadiness() {
  const zaloReady = Boolean(
    process.env.ZALO_OA_ACCESS_TOKEN
    || (process.env.ZALO_APP_ID && process.env.ZALO_REFRESH_TOKEN),
  );
  const emailReady = isEmailConfigured();
  return { zaloReady, emailReady };
}

module.exports = {
  createAndSendOtpChallenge,
  resendOtpChallenge,
  verifyOtpChallenge,
  maskEmail,
  maskPhone,
  escapeHtml,
  getChannelReadiness,
  _challengeStoreForTest: challengeStore,
};

