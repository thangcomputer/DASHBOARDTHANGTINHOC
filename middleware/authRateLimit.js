/**
 * Rate limiting cho /api/auth - chống brute-force và lạm dụng CAPTCHA.
 * Giá trị có thể chỉnh qua biến môi trường (xem README).
 */
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

function parseMax(envKey, defaultVal) {
  const raw = process.env[envKey];
  if (raw === undefined || raw === '') return defaultVal;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : defaultVal;
}

const jsonMessage = (message) => ({ success: false, code: 'RATE_LIMITED', message });

const skipInDev = () => process.env.NODE_ENV === 'development';

function clientIpKey(req) {
  const rawIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  return ipKeyGenerator(rawIp);
}

function loginAccountIdentifier(req) {
  const raw = req.body?.identifier || req.body?.phone || req.body?.deviceFingerprint || 'anon';
  return String(raw).trim().toLowerCase().slice(0, 80) || 'anon';
}

function buildLoginLimiter({ windowMs, max, keyGenerator, skipSuccessfulRequests = false, message }) {
  return rateLimit({
    windowMs,
    max,
    keyGenerator,
    skipSuccessfulRequests,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInDev,
    message: jsonMessage(message),
  });
}

/** Chống spam đăng nhập hàng loạt nhiều tài khoản từ 1 mạng trong thời gian ngắn (10 giây) */
const loginBurstLimiter = buildLoginLimiter({
  windowMs: 10 * 1000,
  max: () => parseMax('RATE_LIMIT_LOGIN_BURST_MAX', 8),
  keyGenerator: (req) => `burst:${clientIpKey(req)}`,
  message: 'Phát hiện đăng nhập dồn dập từ mạng này. Vui lòng đợi vài giây rồi thử lại.',
});

/** Giới hạn tổng lượt đăng nhập từ 1 IP mạng trong 15 phút */
const loginIpLimiter = buildLoginLimiter({
  windowMs: 15 * 60 * 1000,
  max: () => parseMax('RATE_LIMIT_LOGIN_MAX', 25),
  keyGenerator: (req) => `ip:${clientIpKey(req)}`,
  message: 'Đăng nhập quá nhiều lần từ địa chỉ này. Vui lòng thử lại sau ít phút.',
});

/** Chống dò mật khẩu theo từng tài khoản/thiết bị cụ thể (chỉ đếm lần thất bại) */
const loginAccountLimiter = buildLoginLimiter({
  windowMs: 15 * 60 * 1000,
  max: () => parseMax('RATE_LIMIT_LOGIN_ACCOUNT_MAX', 8),
  keyGenerator: (req) => `acct:${clientIpKey(req)}:${loginAccountIdentifier(req)}`,
  skipSuccessfulRequests: true,
  message: 'Tài khoản này thử đăng nhập sai quá nhiều lần. Vui lòng thử lại sau.',
});

/** Đăng nhập (mọi cổng login) - bảo vệ 3 tầng: Burst IP -> IP 15p -> Tài khoản 15p */
const loginLimiter = [loginBurstLimiter, loginIpLimiter, loginAccountLimiter];

/** Lấy CAPTCHA SVG */
const captchaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseMax('RATE_LIMIT_CAPTCHA_MAX', 120),
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage('Yêu cầu mã xác thực quá nhanh. Vui lòng đợi rồi thử lại.'),
});

/** Refresh token - vừa phải để app không bị chặn khi nhiều tab */
const refreshTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseMax('RATE_LIMIT_REFRESH_MAX', 200),
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage('Quá nhiều yêu cầu làm mới phiên. Vui lòng thử lại sau.'),
});

/** Quên mật khẩu / đặt lại / đăng ký - window dài hơn */
const sensitiveFlowLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parseMax('RATE_LIMIT_SENSITIVE_MAX', 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage('Quá nhiều yêu cầu từ địa chỉ này. Vui lòng thử lại sau một lúc.'),
});

/** Kiểm tra role theo SĐT/email - hạn chế enumeration */
const checkRoleLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseMax('RATE_LIMIT_CHECK_ROLE_MAX', 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage('Quá nhiều yêu cầu kiểm tra. Vui lòng thử lại sau.'),
});

module.exports = {
  loginLimiter,
  captchaLimiter,
  refreshTokenLimiter,
  sensitiveFlowLimiter,
  checkRoleLimiter,
};
