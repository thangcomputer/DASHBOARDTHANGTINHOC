/**
 * Service quản lý gửi và xác minh mã OTP Gmail cho cổng tự học DewSkill.
 * Giúp ngăn chặn 100% người dùng ảo spam tài khoản.
 */
const Student = require('../models/Student');
const { FREE_COURSE_NAME } = require('./freePortal');
const { issueSession } = require('./freePortalSocial');
const { sendEmail, isEmailConfigured } = require('./messaging/email');
const { normalizeVNPhone } = require('../utils/phoneIdentity');
const { assertUniqueContact } = require('../utils/uniqueContact');
const logger = require('../config/logger');

// Bộ nhớ tạm lưu trữ phiên OTP chờ kích hoạt (Key: canonicalEmail)
// Có cơ chế tự động dọn dẹp mỗi 2 phút
const pendingRegistrations = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [email, data] of pendingRegistrations.entries()) {
    if (data.expiresAt < now) {
      pendingRegistrations.delete(email);
    }
  }
}, 120000).unref();

function renderOtpHtml(name, otp) {
  return `
    <div style="max-width:540px;margin:0 auto;font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
      <div style="background:linear-gradient(135deg,#064e3b 0%,#047857 60%,#10b981 100%);padding:28px 24px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:900;letter-spacing:0.5px;">DewSkill</h1>
        <p style="color:#a7f3d0;margin:6px 0 0;font-size:13px;font-weight:600;">Nền tảng tự học Tin học ứng dụng AI</p>
      </div>
      <div style="padding:28px 24px;color:#1e293b;">
        <p style="font-size:15px;margin:0 0 12px;color:#334155;">Xin chào <strong>${name}</strong>,</p>
        <p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 20px;">
          Cảm ơn bạn đã đăng ký tài khoản học tập tại <strong>DewSkill</strong>. Để hoàn tất kích hoạt và bảo vệ hòm thư của bạn, vui lòng nhập mã xác thực (OTP) dưới đây:
        </p>
        <div style="background:#ecfdf5;border:2px dashed #10b981;border-radius:12px;padding:18px;text-align:center;margin:0 0 20px;">
          <span style="font-size:11px;font-weight:800;letter-spacing:1px;color:#047857;text-transform:uppercase;display:block;margin-bottom:6px;">MÃ XÁC THỰC CỦA BẠN</span>
          <span style="font-size:32px;font-weight:900;letter-spacing:8px;color:#065f46;font-family:Consolas,monaco,monospace;display:inline-block;padding-left:8px;">${otp}</span>
          <span style="font-size:12px;color:#059669;display:block;margin-top:6px;font-weight:600;">⏱ Có hiệu lực trong vòng 5 phút</span>
        </div>
        <p style="font-size:12px;line-height:1.5;color:#64748b;margin:0 0 8px;">
          • Vui lòng không chia sẻ mã này cho bất kỳ ai để đảm bảo an toàn tài khoản.<br/>
          • Nếu bạn không yêu cầu đăng ký tài khoản này, vui lòng bỏ qua email.
        </p>
      </div>
      <div style="background:#f8fafc;padding:16px 24px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8;">
        <p style="margin:0;">© 2026 DewSkill • Phát triển bởi Hệ thống Đào tạo Thắng Tin Học</p>
      </div>
    </div>
  `;
}

/**
 * Gửi hoặc tạo mã OTP xác thực đăng ký
 */
async function sendRegisterOtp({ name, email, phone, password }) {
  const displayName = String(name || '').trim();
  const rawEmail = String(email || '').trim().toLowerCase();
  const rawPhone = String(phone || '').trim();
  const canonicalPhone = rawPhone ? normalizeVNPhone(rawPhone) : '';

  if (displayName.length < 2) {
    const err = new Error('Hãy nhập họ và tên');
    err.status = 400;
    throw err;
  }
  if (!rawEmail || !/^[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}$/.test(rawEmail)) {
    const err = new Error('Địa chỉ Gmail / Email không hợp lệ');
    err.status = 400;
    throw err;
  }
  if (rawPhone && !canonicalPhone) {
    const err = new Error('Số điện thoại không hợp lệ');
    err.status = 400;
    throw err;
  }
  if (!password || String(password).length < 6) {
    const err = new Error('Mật khẩu cần ít nhất 6 ký tự');
    err.status = 400;
    throw err;
  }

  // Kiểm tra trùng lặp số điện thoại (nếu có nhập SĐT)
  if (canonicalPhone) {
    const existingPhone = await Student.findOne({ $or: [{ phone: canonicalPhone }, { zalo: canonicalPhone }] });
    if (existingPhone) {
      const err = new Error(
        existingPhone.freePortal === true
          ? 'Số điện thoại này đã có tài khoản DewSkill. Hãy đăng nhập.'
          : 'Số này thuộc học viên khóa học trung tâm. Hãy đăng nhập ở trang LMS.'
      );
      err.status = 409;
      throw err;
    }
  }

  // Kiểm tra trùng lặp email
  const existingEmail = await Student.findOne({ email: rawEmail });
  if (existingEmail) {
    const err = new Error('Địa chỉ Gmail này đã được sử dụng. Vui lòng đăng nhập.');
    err.status = 409;
    throw err;
  }

  await assertUniqueContact({
    ...(canonicalPhone ? { phone: canonicalPhone } : {}),
    email: rawEmail,
  });

  // Kiểm tra tần suất gửi (cooldown 45 giây)
  const current = pendingRegistrations.get(rawEmail);
  const now = Date.now();
  if (current && now - current.lastSentAt < 45000) {
    const waitSec = Math.ceil((45000 - (now - current.lastSentAt)) / 1000);
    const err = new Error(`Vui lòng chờ ${waitSec} giây trước khi gửi lại mã.`);
    err.status = 429;
    throw err;
  }

  // Sinh mã 6 chữ số ngẫu nhiên
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  pendingRegistrations.set(rawEmail, {
    name: displayName,
    email: rawEmail,
    phone: canonicalPhone,
    password: String(password),
    otp,
    attempts: 0,
    createdAt: now,
    lastSentAt: now,
    expiresAt: now + 5 * 60 * 1000, // 5 phút
  });

  const mailOptions = {
    to: rawEmail,
    subject: `[DewSkill] Mã xác thực đăng ký tài khoản: ${otp}`,
    text: `[DewSkill] Xin chao ${displayName}, ma xac thuc dang ky cua ban la: ${otp}. Hieu luc 5 phut.`,
    html: renderOtpHtml(displayName, otp),
  };

  const isConfigured = isEmailConfigured();
  let emailSent = false;
  if (isConfigured) {
    const res = await sendEmail(mailOptions);
    emailSent = res.ok;
    if (!res.ok) {
      logger.warn({ email: rawEmail, err: res.error }, '[DewSkill OTP] Gửi email thất bại');
    }
  } else {
    logger.info(`[DewSkill OTP] (Chế độ phát triển - Chưa cấu hình SMTP) Mã OTP của ${rawEmail} là: ${otp}`);
  }

  return {
    success: true,
    email: rawEmail,
    expiresIn: 300,
    emailSent,
    // Nếu chưa cấu hình SMTP, trả về devOtp để người quản trị kiểm thử thuận tiện
    ...(!isConfigured || process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {}),
    message: emailSent
      ? `Mã xác thực 6 chữ số đã được gửi đến ${rawEmail}`
      : `Đã tạo mã xác thực cho ${rawEmail}`,
  };
}

/**
 * Gửi lại mã OTP cho email đang chờ xác thực
 */
async function resendRegisterOtp({ email }) {
  const rawEmail = String(email || '').trim().toLowerCase();
  const current = pendingRegistrations.get(rawEmail);
  if (!current) {
    const err = new Error('Phiên đăng ký đã hết hạn. Vui lòng nhập lại thông tin.');
    err.status = 400;
    throw err;
  }

  const now = Date.now();
  if (now - current.lastSentAt < 45000) {
    const waitSec = Math.ceil((45000 - (now - current.lastSentAt)) / 1000);
    const err = new Error(`Vui lòng chờ ${waitSec} giây trước khi gửi lại mã.`);
    err.status = 429;
    throw err;
  }

  const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
  current.otp = newOtp;
  current.attempts = 0;
  current.lastSentAt = now;
  current.expiresAt = now + 5 * 60 * 1000;

  const isConfigured = isEmailConfigured();
  let emailSent = false;
  if (isConfigured) {
    const res = await sendEmail({
      to: rawEmail,
      subject: `[DewSkill] Mã xác thực đăng ký tài khoản mới: ${newOtp}`,
      text: `[DewSkill] Ma xac thuc moi cua ban la: ${newOtp}. Hieu luc 5 phut.`,
      html: renderOtpHtml(current.name, newOtp),
    });
    emailSent = res.ok;
  } else {
    logger.info(`[DewSkill OTP RESEND] Mã OTP của ${rawEmail} là: ${newOtp}`);
  }

  return {
    success: true,
    email: rawEmail,
    emailSent,
    ...(!isConfigured || process.env.NODE_ENV !== 'production' ? { devOtp: newOtp } : {}),
    message: `Đã gửi lại mã xác thực tới ${rawEmail}`,
  };
}

/**
 * Xác thực mã OTP và chính thức khởi tạo tài khoản Student
 */
async function verifyOtpAndRegister({ email, otp, deviceFingerprint }) {
  const rawEmail = String(email || '').trim().toLowerCase();
  const code = String(otp || '').trim().replace(/\s+/g, '');

  if (!rawEmail || !code) {
    const err = new Error('Vui lòng nhập đầy đủ email và mã xác thực');
    err.status = 400;
    throw err;
  }

  const pending = pendingRegistrations.get(rawEmail);
  if (!pending) {
    const err = new Error('Mã xác thực đã hết hạn hoặc không tồn tại. Vui lòng gửi lại mã mới.');
    err.status = 400;
    throw err;
  }

  if (Date.now() > pending.expiresAt) {
    pendingRegistrations.delete(rawEmail);
    const err = new Error('Mã xác thực đã quá hạn 5 phút. Vui lòng yêu cầu mã mới.');
    err.status = 400;
    throw err;
  }

  if (pending.attempts >= 5) {
    pendingRegistrations.delete(rawEmail);
    const err = new Error('Bạn đã nhập sai mã quá 5 lần. Vui lòng yêu cầu mã mới.');
    err.status = 429;
    throw err;
  }

  if (code !== pending.otp) {
    pending.attempts += 1;
    const remaining = 5 - pending.attempts;
    const err = new Error(`Mã xác thực không chính xác. Bạn còn ${remaining} lần thử.`);
    err.status = 400;
    throw err;
  }

  // OTP chính xác! Tạo học viên chính thức trong DB
  const student = await Student.create({
    name: pending.name,
    ...(pending.phone ? { phone: pending.phone, zalo: pending.phone } : {}),
    email: pending.email,
    age: 18,
    password: pending.password,
    course: FREE_COURSE_NAME,
    price: 0,
    paid: true,
    paidAmount: 0,
    status: 'Đang học',
    learningMode: 'ONLINE',
    freePortal: true,
    freeUnlocked: false,
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

  // Xóa khỏi danh sách chờ sau khi đăng ký thành công
  pendingRegistrations.delete(rawEmail);

  // Cấp Token và phiên đăng nhập trực tiếp
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
};
