/**
 * webhookRoutes.js
 *
 * POST /api/webhooks/sepay              — SePay gọi khi có tiền vào TK
 * GET  /api/webhooks/payment-status/:id — Polling kiểm tra HV đã thanh toán
 * POST /api/webhooks/payment-session    — Tạo session thanh toán tạm (đăng ký mới)
 * GET  /api/webhooks/payment-session/:id — Kiểm tra session
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Student = require('../models/Student');
const { authMiddleware } = require('../middleware/auth');

const PaymentSession = require('../models/PaymentSession');
const logger = require('../config/logger');

// ── SePay Webhook verification ────────────────────────────────────────────────
// SePay hỗ trợ 2 kiểu chứng thực:
// 1. API Key: Authorization: Apikey <KEY>
// 2. HMAC: x-sepay-token = HMAC-SHA256(body, SECRET_KEY)
// Nếu chưa cấu hình → cho qua (backward compat)
function verifySepaySignature(req, res, next) {
  logger.info('[SEPAY] Incoming webhook headers:', JSON.stringify({
    authorization: req.headers['authorization'],
    'x-sepay-token': req.headers['x-sepay-token'],
    'x-api-key': req.headers['x-api-key'],
  }));

  const apiKey = process.env.SEPAY_API_KEY;
  const hmacSecret = process.env.SEPAY_SECRET_KEY;

  // Production: bắt buộc cấu hình xác thực webhook
  if (!apiKey && !hmacSecret) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('[SEPAY] Webhook rejected — SEPAY_API_KEY / SEPAY_SECRET_KEY not configured');
      return res.status(503).json({ success: false, message: 'Webhook payment not configured' });
    }
    logger.warn('[SEPAY] Dev mode — webhook verification skipped (no SEPAY keys)');
    return next();
  }

  // ── Kiểm tra API Key (SePay gửi: Authorization: Apikey <KEY>) ──
  if (apiKey) {
    const authHeader = req.headers['authorization'] || '';
    const incomingKey = authHeader.replace(/^Apikey\s+/i, '').trim();
    if (incomingKey === apiKey) {
      logger.info('[SEPAY] ✅ API Key verified');
      return next();
    }
    // Cũng kiểm tra header x-api-key
    if (req.headers['x-api-key'] === apiKey) {
      logger.info('[SEPAY] ✅ API Key (x-api-key) verified');
      return next();
    }
    logger.warn('[SEPAY] ❌ API Key mismatch — rejected');
    return res.status(401).json({ success: false, message: 'Invalid API Key' });
  }

  // ── Kiểm tra HMAC (legacy) ──
  if (hmacSecret) {
    const signature = req.headers['x-sepay-token'];
    if (!signature) {
      logger.warn('[SEPAY] Missing HMAC signature — rejected');
      return res.status(401).json({ success: false, message: 'Missing webhook signature' });
    }
    const rawBody = JSON.stringify(req.body);
    const expected = crypto.createHmac('sha256', hmacSecret).update(rawBody).digest('hex');
    if (signature !== expected) {
      logger.warn('[SEPAY] Invalid HMAC signature — rejected');
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }
    return next();
  }

  next();
}

const SESSION_TTL_MS = 15 * 60 * 1000; // 15 phút

/** Chuẩn hoá nội dung CK: bỏ dấu, khoảng trắng, ký tự đặc biệt — khớp với tin nhắn ngân hàng */
function normalizeTransferText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');
}

/** Lấy mọi mã TTH##### từ chuỗi / object webhook */
function extractTthCodes(...parts) {
  const blob = parts
    .map((p) => (typeof p === 'string' ? p : p != null ? JSON.stringify(p) : ''))
    .join(' ');
  const found = blob.match(/tth\d{4,}/gi) || [];
  return [...new Set(found.map((c) => c.toUpperCase()))];
}

function contentMatchesRef(content, ref) {
  const c = normalizeTransferText(content);
  const r = normalizeTransferText(ref);
  if (!c || !r) return false;
  if (c.includes(r) || r.includes(c)) return true;
  const code = (ref.match(/TTH\d{4,}/i) || [])[0];
  if (code && c.includes(normalizeTransferText(code))) return true;
  return false;
}

// ── POST /api/webhooks/payment-session & /api/webhooks/create-session ──
const handleCreateSession = async (req, res) => {
  try {
    const { ref, content, amount, studentName, courseName } = req.body;
    const finalRef = (ref || content || '').toLowerCase().trim();
    if (!finalRef) return res.status(400).json({ success: false, message: 'Thiếu nội dung chuyển khoản (ref/content)' });

    const sessionId = `ps_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    await PaymentSession.create({
      sessionId,
      ref: finalRef,
      amount: Number(amount) || 0,
      status: 'pending',
      studentName: studentName || '',
      courseName: courseName || '',
    });

    logger.info(`[PAYMENT SESSION] Tạo mới (DB): ${sessionId} — ref: "${finalRef}"`);
    return res.json({ success: true, sessionId, expiresIn: SESSION_TTL_MS / 1000 });
  } catch (err) {
    logger.error('[CREATE SESSION ERROR]', err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi tạo phiên' });
  }
};

router.post('/payment-session', authMiddleware, handleCreateSession);
router.post('/create-session', authMiddleware, handleCreateSession);

// ── GET /api/webhooks/payment-session/:id & /api/webhooks/payment-status ── Polling
const handleCheckSession = async (req, res) => {
  try {
    const sessionId = req.params.id || req.query.sessionId;
    const contentQ = (req.query.content || req.query.ref || '').trim();

    let session = null;
    if (sessionId) {
      session = await PaymentSession.findOne({ sessionId });
    }
    // Fallback: tìm theo mã TTH / nội dung CK (khi create-session chậm hoặc mất sessionId)
    if (!session && contentQ) {
      const codes = extractTthCodes(contentQ);
      if (codes.length) {
        const re = new RegExp(codes[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        session = await PaymentSession.findOne({ ref: re }).sort({ createdAt: -1 });
      }
      if (!session) {
        session = await PaymentSession.findOne({
          ref: contentQ.toLowerCase(),
        }).sort({ createdAt: -1 });
      }
    }

    if (!sessionId && !contentQ) {
      return res.status(400).json({ success: false, message: 'Missing sessionId or content' });
    }

    if (!session) {
      return res.json({ success: true, status: 'not_found', paid: false });
    }

    const elapsed = Date.now() - session.createdAt.getTime();
    const remaining = Math.max(0, Math.floor((SESSION_TTL_MS - elapsed) / 1000));

    // Logic kiểm tra hết hạn (nếu cần thiết ngoài TTL của Mongo)
    if (session.status !== 'paid' && elapsed > SESSION_TTL_MS) {
      session.status = 'expired';
      await session.save();
    }

    return res.json({
      success: true,
      status: session.status,   // 'pending' | 'paid' | 'expired'
      paid: session.status === 'paid',
      studentName: session.studentName,
      courseName: session.courseName,
      amount: session.amount,
      ref: session.ref,
      remaining,
      paidAmount: session.paidAmount || 0,
    });
  } catch (err) {
    logger.error('[CHECK SESSION ERROR]', err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi kiểm tra phiên' });
  }
};

router.get('/payment-session/:id', handleCheckSession);
router.get('/payment-status', handleCheckSession);


// ── POST /api/webhooks/sepay ── SePay Webhook (HMAC verified) ──────────────────
router.post('/sepay', verifySepaySignature, async (req, res) => {
  try {
    const body = req.body || {};
    // Pino: object trước, message sau — để thấy đủ payload trong log
    logger.info({ sepay: body }, '[SEPAY WEBHOOK]');

    if (body.transferType && String(body.transferType).toLowerCase() === 'out') {
      return res.json({ success: true, matched: false, skipped: 'transferType=out' });
    }

    const contentParts = [
      body.content,
      body.description,
      body.remark,
      body.code,
      body.subAccount,
      body.referenceCode,
      body.transactionContent,
    ].filter((v) => v != null && String(v).trim() !== '');

    const content = contentParts.join(' ').toLowerCase().trim();
    const amount = Number(body.transferAmount || body.amount || 0);
    const webhookCodes = extractTthCodes(content, body);

    if (amount <= 0) {
      logger.warn({ content, amount, keys: Object.keys(body) }, '[SEPAY] Thiếu amount');
      return res.json({ success: false, message: 'Thiếu thông tin giao dịch' });
    }

    let matched = false;

    // Pending + expired gần đây (CK trễ sau khi UI hết giờ)
    const lookback = new Date(Date.now() - SESSION_TTL_MS * 2);
    const pendingSessions = await PaymentSession.find({
      status: { $in: ['pending', 'expired'] },
      createdAt: { $gte: lookback },
    }).sort({ createdAt: -1 });

    let pendingSession = null;

    if (webhookCodes.length) {
      for (const sess of pendingSessions) {
        const sessCodes = extractTthCodes(sess.ref);
        if (sessCodes.some((c) => webhookCodes.includes(c))) {
          pendingSession = sess;
          break;
        }
      }
    }

    if (!pendingSession && content) {
      for (const sess of pendingSessions) {
        if (contentMatchesRef(content, sess.ref)) {
          pendingSession = sess;
          break;
        }
      }
    }

    // Fallback: đúng 1 session pending cùng số tiền
    if (!pendingSession) {
      const sameAmount = pendingSessions.filter(
        (s) => s.status === 'pending' && Number(s.amount) === amount
      );
      if (sameAmount.length === 1) {
        pendingSession = sameAmount[0];
        logger.info(
          { sessionId: pendingSession.sessionId, amount },
          '[SEPAY] Match theo amount (duy nhất 1 session pending)'
        );
      }
    }

    if (pendingSession) {
      pendingSession.status = 'paid';
      pendingSession.paidAmount = amount;
      await pendingSession.save();
      matched = true;

      logger.info(
        { sessionId: pendingSession.sessionId, ref: pendingSession.ref, amount, webhookCodes },
        '[SEPAY] ✅ Session paid'
      );

      const io = req.app.get('io');
      if (io) {
        io.emit('tuition:paid', {
          sessionId: pendingSession.sessionId,
          amount,
          message: `✅ Đã nhận ${amount.toLocaleString('vi-VN')}đ`,
        });
      }
    }

    if (!matched) {
      const students = await Student.find({ paid: false }).lean();
      for (const s of students) {
        const code = (s.studentCode || String(s._id).slice(-6)).toLowerCase();
        const name = (s.name || '').toLowerCase().replace(/\s+/g, '');
        const studentCodes = extractTthCodes(code, s.studentCode);
        const codeHit = studentCodes.length && studentCodes.some((c) => webhookCodes.includes(c));
        if (codeHit || contentMatchesRef(content, code) || contentMatchesRef(content, name)) {
          await Student.findByIdAndUpdate(s._id, {
            paid: true,
            paidAmount: amount,
            paidAt: new Date(),
            paidNote: body.content || '',
          });
          matched = true;

          const io = req.app.get('io');
          if (io) {
            io.emit('tuition:paid', {
              studentId: String(s._id),
              amount,
              message: `✅ ${s.name} đã thanh toán ${amount.toLocaleString('vi-VN')}đ`,
            });
          }
          logger.info({ name: s.name, amount }, '[SEPAY] ✅ Học viên paid');
          break;
        }
      }
    }

    if (!matched) {
      logger.warn(
        {
          content,
          amount,
          webhookCodes,
          pendingRefs: pendingSessions.map((s) => ({
            ref: s.ref,
            amount: s.amount,
            status: s.status,
          })),
        },
        '[SEPAY] Không match được'
      );
    }

    return res.json({ success: true, matched, codes: webhookCodes });
  } catch (err) {
    logger.error({ err }, '[SEPAY WEBHOOK ERROR]');
    return res.json({ success: false, message: 'Lỗi server: ' + err.message });
  }
});

// ── GET /api/webhooks/payment-status/:studentId ── Polling HV đã có tài khoản ─
router.get('/payment-status/:studentId', authMiddleware, async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId).lean();
    if (!student) return res.status(404).json({ success: false, message: 'Không tìm thấy học viên' });
    return res.json({
      success: true,
      paid: student.paid === true,
      paidAmount: student.paidAmount || 0,
      paidAt: student.paidAt || null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
