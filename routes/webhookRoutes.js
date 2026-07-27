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
  // Không log full Authorization / HMAC token (tránh leak secret vào log)
  logger.info('[SEPAY] Incoming webhook', {
    hasAuthorization: Boolean(req.headers['authorization']),
    hasSepayToken: Boolean(req.headers['x-sepay-token']),
    hasApiKeyHeader: Boolean(req.headers['x-api-key']),
  });

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
    if (!sessionId) {
       return res.status(400).json({ success: false, message: 'Missing sessionId' });
    }

    const session = await PaymentSession.findOne({ sessionId });
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

router.get('/payment-session/:id', authMiddleware, handleCheckSession);
router.get('/payment-status', authMiddleware, handleCheckSession);


// ── POST /api/webhooks/sepay ── SePay Webhook (HMAC verified) ──────────────────
router.post('/sepay', verifySepaySignature, async (req, res) => {
  try {
    const SepayWebhookEvent = require('../models/SepayWebhookEvent');
    const body = req.body;
    const content = (body.content || body.description || '').toLowerCase().trim();
    const amount  = Number(body.transferAmount || body.amount || 0);
    const gatewayTxnId = String(
      body.id || body.transactionID || body.transaction_id || body.referenceCode || body.transferId || ''
    ).trim();

    logger.info('[SEPAY WEBHOOK]', {
      amount,
      contentLen: content.length,
      gatewayTxnId: gatewayTxnId || null,
    });

    if (!content || amount <= 0) {
      return res.json({ success: false, message: 'Thiếu thông tin giao dịch' });
    }

    // Idempotency theo mã giao dịch cổng
    if (gatewayTxnId) {
      try {
        await SepayWebhookEvent.create({
          gatewayTxnId,
          amount,
          content: content.slice(0, 500),
          rawSummary: JSON.stringify({
            transferType: body.transferType,
            accountNumber: body.accountNumber,
          }).slice(0, 300),
        });
      } catch (dupErr) {
        if (dupErr?.code === 11000) {
          return res.json({ success: true, matched: false, duplicate: true });
        }
        throw dupErr;
      }
    }

    let matched = false;
    let matchedRef = '';

    // ── 1. Payment sessions: khớp ref + số tiền ───────────────────────────────
    const pendingSessions = await PaymentSession.find({ status: 'pending' }).limit(200);
    let pendingSession = null;
    for (const sess of pendingSessions) {
      const ref = String(sess.ref || '').toLowerCase();
      if (!ref || !content.includes(ref)) continue;
      if (sess.amount > 0 && Math.abs(Number(sess.amount) - amount) > 1) continue;
      pendingSession = sess;
      break;
    }

    if (pendingSession) {
      const claimed = await PaymentSession.findOneAndUpdate(
        { _id: pendingSession._id, status: 'pending' },
        { $set: { status: 'paid', paidAmount: amount } },
        { returnDocument: 'after' }
      );

      if (claimed) {
        matched = true;
        matchedRef = claimed.ref;
        logger.info(`[SEPAY] Session ${claimed.sessionId} khớp ref="${claimed.ref}" — ${amount}đ`);

        const io = req.app.get('io');
        if (io) {
          io.emit('tuition:paid', {
            sessionId: claimed.sessionId,
            amount,
            message: `✅ Đã nhận ${amount.toLocaleString('vi-VN')}đ`,
          });
        }
      }
    }

    // ── 2. Học viên hiện có: chỉ khớp studentCode (không fuzzy theo tên) ───────
    if (!matched) {
      const unpaid = await Student.find({ paid: false })
        .select('studentCode name price paid')
        .limit(2000)
        .lean();
      for (const s of unpaid) {
        const code = String(s.studentCode || '').toLowerCase().trim();
        if (!code || code.length < 4) continue;
        if (!content.includes(code)) continue;
        if (s.price > 0 && Math.abs(Number(s.price) - amount) > 1) continue;

        const updated = await Student.findOneAndUpdate(
          { _id: s._id, paid: false },
          {
            $set: {
              paid: true,
              paidAmount: amount,
              paidAt: new Date(),
              paidNote: String(body.content || '').slice(0, 300),
            },
          },
          { returnDocument: 'after' }
        );
        if (!updated) continue;

        matched = true;
        matchedRef = code;
        const io = req.app.get('io');
        if (io) {
          io.emit('tuition:paid', {
            studentId: String(s._id),
            amount,
            message: `✅ ${s.name} đã thanh toán ${amount.toLocaleString('vi-VN')}đ`,
          });
        }
        logger.info(`[SEPAY] Học viên ${s.name} đã thanh toán ${amount}đ`);
        break;
      }
    }

    if (gatewayTxnId && matched) {
      await SepayWebhookEvent.updateOne(
        { gatewayTxnId },
        { $set: { matched: true, matchedRef } }
      );
    }

    if (!matched) {
      logger.warn('[SEPAY] Không match được — contentLen=', content.length);
    }

    return res.json({ success: true, matched });

  } catch (err) {
    logger.error('[SEPAY WEBHOOK ERROR]', err);
    return res.json({ success: false, message: 'Lỗi server: ' + err.message });
  }
});

// ── GET /api/webhooks/payment-status/:studentId ── Polling HV đã có tài khoản ─
router.get('/payment-status/:studentId', authMiddleware, async (req, res) => {
  try {
    const sid = String(req.params.studentId);
    const isSelf = req.user.role === 'student' && String(req.user.id) === sid;
    const isStaff = req.user.role === 'admin' || req.user.role === 'staff';
    if (!isSelf && !isStaff) {
      return res.status(403).json({ success: false, message: 'Không có quyền xem trạng thái thanh toán' });
    }

    const student = await Student.findById(sid).select('paid paidAmount paidAt').lean();
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
