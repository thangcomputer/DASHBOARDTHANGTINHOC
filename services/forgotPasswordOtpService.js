'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const logger = require('../config/logger');
const PasswordResetOtp = require('../models/PasswordResetOtp');
const { normalizeVNPhone, maskPhone } = require('../utils/phoneIdentity');
const { sendEmail, isEmailConfigured } = require('./messaging/email');
const { sendSms, isSmsConfigured } = require('./messaging/sms');

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

const memoryStore = new Map();
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.expiresAt <= now) memoryStore.delete(key);
  }
}, 60 * 1000);
if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref();

function escapeHtml(raw) {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hashOtp(salt, otp) {
  return crypto.createHmac('sha256', String(salt)).update(String(otp || '').trim()).digest('hex');
}

function generateSixDigitOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function buildChallengeKey(role, contactValue) {
  return `${String(role || 'student').toLowerCase()}:${String(contactValue || '').trim().toLowerCase()}`;
}

function useMongoStore() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

function maskEmail(email) {
  const s = String(email || '').trim().toLowerCase();
  const at = s.indexOf('@');
  if (at <= 1) return s ? `***${s.slice(at)}` : '';
  return `${s.slice(0, 2)}***@${s.slice(at + 1)}`;
}

function buildResetEmailHtml({ name, roleLabel, otp }) {
  const safeName = escapeHtml(name || 'bạn');
  const safeRole = escapeHtml(roleLabel);
  return `
    <div style="max-width:540px;margin:0 auto;font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
      <div style="background:linear-gradient(135deg,#064e3b 0%,#059669 65%,#10b981 100%);padding:26px 24px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:900;letter-spacing:0.4px;">Thắng Tin Học · LMS</h1>
        <p style="color:#d1fae5;margin:6px 0 0;font-size:13px;font-weight:600;">Xác thực khôi phục mật khẩu (${safeRole})</p>
      </div>
      <div style="padding:26px 24px;color:#0f172a;">
        <p style="font-size:15px;margin:0 0 10px;color:#334155;">Xin chào <strong>${safeName}</strong>,</p>
        <p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 18px;">
          Hệ thống vừa nhận được yêu cầu khôi phục mật khẩu cho tài khoản <strong>${safeRole}</strong> của bạn. Hãy nhập mã xác nhận 6 số bên dưới vào ứng dụng để đăng nhập và đặt lại mật khẩu mới:
        </p>
        <div style="background:#ecfdf5;border:1.5px solid #a7f3d0;border-radius:14px;padding:18px;text-align:center;margin:0 0 18px;">
          <span style="font-size:11px;font-weight:800;letter-spacing:1px;color:#047857;text-transform:uppercase;display:block;margin-bottom:6px;">MÃ XÁC NHẬN ĐỔI MẬT KHẨU</span>
          <span style="font-size:32px;font-weight:900;letter-spacing:8px;color:#065f46;font-family:Consolas,monaco,monospace;display:inline-block;padding-left:8px;">${otp}</span>
          <span style="font-size:12px;color:#059669;display:block;margin-top:8px;font-weight:600;">Có hiệu lực trong 5 phút</span>
        </div>
        <p style="font-size:12px;line-height:1.55;color:#64748b;margin:0;">
          • Tuyệt đối không chia sẻ mã này cho bất kỳ ai.<br/>
          • Nếu bạn không thực hiện yêu cầu này, bạn có thể bỏ qua email này an toàn.
        </p>
      </div>
      <div style="background:#f8fafc;padding:14px 24px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8;">
        <p style="margin:0;">© Thắng Tin Học · Hệ thống đào tạo Tin học văn phòng &amp; MOS</p>
      </div>
    </div>
  `;
}

async function getChallengeRecord(challengeKey) {
  if (useMongoStore()) {
    return PasswordResetOtp.findOne({ challengeKey }).lean();
  }
  const item = memoryStore.get(challengeKey);
  if (!item) return null;
  if (item.expiresAt <= Date.now()) {
    memoryStore.delete(challengeKey);
    return null;
  }
  return item;
}

async function saveChallengeRecord(record) {
  if (useMongoStore()) {
    await PasswordResetOtp.findOneAndUpdate(
      { challengeKey: record.challengeKey },
      { $set: record },
      { upsert: true, new: true },
    );
    return;
  }
  memoryStore.set(record.challengeKey, { ...record, expiresAt: record.expiresAt.getTime(), lastSentAt: record.lastSentAt.getTime() });
}

async function incrementAttemptOrDelete(challengeKey, currentAttempts) {
  const nextAttempts = Number(currentAttempts || 0) + 1;
  if (nextAttempts >= MAX_VERIFY_ATTEMPTS) {
    if (useMongoStore()) {
      await PasswordResetOtp.deleteOne({ challengeKey });
    } else {
      memoryStore.delete(challengeKey);
    }
    return { exhausted: true, remaining: 0 };
  }
  if (useMongoStore()) {
    await PasswordResetOtp.updateOne({ challengeKey }, { $inc: { attempts: 1 } });
  } else {
    const item = memoryStore.get(challengeKey);
    if (item) item.attempts = nextAttempts;
  }
  return { exhausted: false, remaining: MAX_VERIFY_ATTEMPTS - nextAttempts };
}

async function deleteChallengeRecord(challengeKey) {
  if (useMongoStore()) {
    await PasswordResetOtp.deleteOne({ challengeKey });
  } else {
    memoryStore.delete(challengeKey);
  }
}

async function createAndSendForgotPasswordOtp({ user, role, contactType, contactValue }) {
  const cleanRole = role === 'teacher' ? 'teacher' : 'student';
  const normalizedContact = contactType === 'email'
    ? String(contactValue || '').trim().toLowerCase()
    : normalizeVNPhone(contactValue);
  if (!normalizedContact) {
    return { ok: false, reason: 'invalid_contact' };
  }

  const challengeKey = buildChallengeKey(cleanRole, normalizedContact);
  const existing = await getChallengeRecord(challengeKey);
  const now = Date.now();
  if (existing) {
    const lastSentMs = existing.lastSentAt instanceof Date ? existing.lastSentAt.getTime() : Number(existing.lastSentAt || 0);
    if (now - lastSentMs < RESEND_COOLDOWN_MS) {
      return { ok: true, skippedDueToCooldown: true, sentVia: [] };
    }
  }

  const otp = generateSixDigitOtp();
  const salt = crypto.randomBytes(16).toString('hex');
  await saveChallengeRecord({
    challengeKey,
    userId: String(user._id),
    role: cleanRole,
    contactType: contactType === 'email' ? 'email' : 'sms',
    contactValue: normalizedContact,
    salt,
    otpHash: hashOtp(salt, otp),
    attempts: 0,
    lastSentAt: new Date(now),
    expiresAt: new Date(now + OTP_TTL_MS),
  });

  const roleLabel = cleanRole === 'teacher' ? 'Giảng viên' : 'Học viên';
  const sentVia = [];
  const errors = [];

  if (contactType === 'email') {
    const emailRes = await sendEmail({
      to: normalizedContact,
      subject: `[Thắng Tin Học] Mã xác nhận đặt lại mật khẩu: ${otp}`,
      text: `[Thang Tin Hoc] Ma xac nhan dat lai mat khau (${roleLabel}): ${otp}. Hieu luc 5 phut. Tuyet doi khong chia se ma nay.`,
      html: buildResetEmailHtml({ name: user.name, roleLabel, otp }),
    });
    if (emailRes?.ok) sentVia.push('email');
    else errors.push({ channel: 'email', reason: emailRes?.reason || 'failed' });
  } else {
    const smsRes = await sendSms({
      phone: normalizedContact,
      code: otp,
      message: `[Thang Tin Hoc] Ma xac nhan dat lai mat khau cua ban la: ${otp} (hieu luc 5 phut). Khong chia se ma nay.`,
    });
    if (smsRes?.ok) {
      sentVia.push('sms');
    } else {
      errors.push({ channel: 'sms', reason: smsRes?.reason || 'failed' });
      // Neu SMS chua cau hinh va tai khoan co Gmail + server da cau hinh SMTP -> gui kem ve Gmail da lien ket
      const linkedEmail = String(user.email || '').trim().toLowerCase();
      if (linkedEmail && linkedEmail.includes('@') && isEmailConfigured()) {
        const backupEmailRes = await sendEmail({
          to: linkedEmail,
          subject: `[Thắng Tin Học] Mã xác nhận đặt lại mật khẩu: ${otp}`,
          text: `[Thang Tin Hoc] Ma xac nhan dat lai mat khau (${roleLabel}): ${otp}. Hieu luc 5 phut.`,
          html: buildResetEmailHtml({ name: user.name, roleLabel, otp }),
        });
        if (backupEmailRes?.ok) sentVia.push('email');
      }
    }
  }

  const maskedDestination = contactType === 'email' ? maskEmail(normalizedContact) : maskPhone(normalizedContact);
  if (process.env.NODE_ENV !== 'production' && sentVia.length === 0) {
    logger.info(
      { role: cleanRole, contactType, maskedDestination, otp },
      '[FORGOT_PASSWORD] Dev OTP issued (delivery channel not configured locally)',
    );
  } else {
    logger.info(
      { role: cleanRole, contactType, maskedDestination, sentVia },
      '[FORGOT_PASSWORD] OTP challenge created',
    );
  }

  return {
    ok: true,
    sentVia,
    errors,
    deliveryOk: sentVia.length > 0,
  };
}

async function verifyForgotPasswordOtp({ role, contactType, contactValue, code }) {
  const cleanRole = role === 'teacher' ? 'teacher' : 'student';
  const normalizedContact = contactType === 'email'
    ? String(contactValue || '').trim().toLowerCase()
    : normalizeVNPhone(contactValue);
  const cleanCode = String(code || '').replace(/\D/g, '');
  if (!normalizedContact || cleanCode.length !== 6) {
    return { ok: false, status: 400, message: 'Vui lòng nhập đầy đủ mã xác nhận 6 chữ số.' };
  }

  const challengeKey = buildChallengeKey(cleanRole, normalizedContact);
  const entry = await getChallengeRecord(challengeKey);
  if (!entry) {
    return { ok: false, status: 400, message: 'Mã xác nhận không đúng hoặc đã hết hạn. Vui lòng yêu cầu lại.' };
  }

  const expiresMs = entry.expiresAt instanceof Date ? entry.expiresAt.getTime() : Number(entry.expiresAt || 0);
  if (expiresMs <= Date.now()) {
    await deleteChallengeRecord(challengeKey);
    return { ok: false, status: 400, message: 'Mã xác nhận đã hết hạn (5 phút). Vui lòng yêu cầu lại.' };
  }

  const expected = Buffer.from(entry.otpHash, 'hex');
  const candidate = Buffer.from(hashOtp(entry.salt, cleanCode), 'hex');
  const matched = expected.length === candidate.length && crypto.timingSafeEqual(expected, candidate);
  if (!matched) {
    const attemptState = await incrementAttemptOrDelete(challengeKey, entry.attempts);
    if (attemptState.exhausted) {
      return { ok: false, status: 400, message: 'Bạn đã nhập sai mã quá 5 lần. Vui lòng yêu cầu mã mới.' };
    }
    return {
      ok: false,
      status: 400,
      message: `Mã xác nhận không đúng (còn ${attemptState.remaining} lần thử).`,
    };
  }

  await deleteChallengeRecord(challengeKey);
  return {
    ok: true,
    userId: String(entry.userId),
    role: cleanRole,
    contactType: entry.contactType,
    contactValue: entry.contactValue,
  };
}

function getChannelReadiness() {
  return {
    emailConfigured: isEmailConfigured(),
    smsConfigured: isSmsConfigured(),
  };
}

module.exports = {
  OTP_TTL_MS,
  RESEND_COOLDOWN_MS,
  createAndSendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  getChannelReadiness,
  _memoryStoreForTest: memoryStore,
};
