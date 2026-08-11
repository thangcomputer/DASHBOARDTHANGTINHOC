'use strict';
const crypto = require('crypto');
const Student = require('./../../student/models/Student');
const { paymentSessionRepository } = require('./../repositories');
const PaymentSession = require('./../models/PaymentSession'); // Temp for new PaymentSession
const logger = require('./../../../config/logger');
const SepayWebhookEvent = require('./../models/SepayWebhookEvent'); // Temp for new SepayWebhookEvent

/**
 * webhookRoutes.js
 *
 * POST /api/webhooks/sepay              — SePay gọi khi có tiền vào TK
 * GET  /api/webhooks/payment-status/:id — Polling kiểm tra HV đã thanh toán
 * POST /api/webhooks/payment-session    — Tạo session thanh toán tạm (đăng ký mới)
 * GET  /api/webhooks/payment-session/:id — Kiểm tra session
 */
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
    await paymentSessionRepository.create({
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

class PaymentApplicationService {
  async post_payment_session(data) {}

  async post_create_session(data) {}

  async get_payment_session_id(data) {}

  async get_payment_status(data) {}

  async post_sepay(data) {
  try {
    const { sepayWebhookEventRepository } = require('../repositories');
const SepayWebhookEvent = require('../models/SepayWebhookEvent'); // Temp for new SepayWebhookEvent
    const body = data.body;
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
      return { _status: 200, _body: ({ success: false, message: 'Thiếu thông tin giao dịch' });
    }

    // Idempotency theo mã giao dịch cổng
    if (gatewayTxnId) {
      try {
        await sepayWebhookEventRepository.create({
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
          const existing = await sepayWebhookEventRepository.findOne({ gatewayTxnId }).select('matched matchedRef').lean();
          // Đã khớp trước đó → idempotent OK; chưa khớp (crash giữa chừng) → rematch bên dưới
          if (existing?.matched) {
            return { _status: 200, _body: ({
              success: true,
              matched: true,
              duplicate: true,
              matchedRef: existing.matchedRef || '',
            });
          }
          logger.warn(`[SEPAY] Duplicate gatewayTxnId chưa matched — rematch: ${gatewayTxnId}`);
        } else {
          throw dupErr;
        }
      }
    }

    let matched = false;
    let matchedRef = '';

    // ── 1. Payment sessions: khớp ref + số tiền ───────────────────────────────
    const pendingSessions = await paymentSessionRepository.findMany({ status: 'pending' }).limit(200);
    let pendingSession = null;
    for (const sess of pendingSessions) {
      const ref = String(sess.ref || '').toLowerCase();
      if (!ref || !content.includes(ref)) continue;
      if (sess.amount > 0 && Math.abs(Number(sess.amount) - amount) > 1) continue;
      pendingSession = sess;
      break;
    }

    if (pendingSession) {
      const claimed = await paymentSessionRepository.updateOne(
        { _id: pendingSession._id, status: 'pending' },
        { $set: { status: 'paid', paidAmount: amount } },
        { returnDocument: 'after' }
      );

      if (claimed) {
        try {
          const { settlePayment } = require('../../finance/services/ledgerService');
          await settlePayment({
            student: claimed.studentId
              ? { _id: claimed.studentId, branchId: claimed.branchId || null }
              : { _id: null, branchId: claimed.branchId || null },
            amount,
            courseName: claimed.courseName || '',
            source: 'sepay_session',
            sourceRef: claimed.sessionId,
            idempotencyKey: `payment:sepay:session:${claimed.sessionId}`,
            actor: { id: 'sepay', role: 'system' },
            note: String(body.content || '').slice(0, 300),
            metadata: {
              sessionId: claimed.sessionId,
              ref: claimed.ref,
              studentName: claimed.studentName || '',
            },
            reqMeta: { ip: data.ip, userAgent: 'sepay-webhook', branchId: claimed.branchId || null },
          });
          matched = true;
          matchedRef = claimed.ref;
          logger.info(`[SEPAY] Session ${claimed.sessionId} khớp ref="${claimed.ref}" — ${amount}đ (+Ledger)`);

          const io = data.app.get('io');
          if (io) {
            io.emit('tuition:paid', {
              sessionId: claimed.sessionId,
              amount,
              message: `✅ Đã nhận ${amount.toLocaleString('vi-VN')}đ`,
            });
          }
        } catch (ledgerErr) {
          logger.error('[SEPAY] session ledger FAILED — rollback session: %s', ledgerErr.message);
          try {
            await paymentSessionRepository.updateById(claimed._id, {
              $set: { status: 'pending' },
              $unset: { paidAmount: 1 },
            });
          } catch (rbErr) {
            logger.error('[SEPAY] session rollback failed: %s', rbErr.message);
          }
        }
      }
    }

    // ── 2. Học viên hiện có: studentCode OR legacy — FAIL CLOSED nếu >1 ─
    if (!matched) {
      const {
        extractStudentCodeCandidates,
        selectUnpaidStudentCandidates,
      } = require('../../../utils/sepayMatch');
      const variants = extractStudentCodeCandidates(content);

      const unpaid = variants.length
        ? await Student.find({
            paid: false,
            $or: [
              { studentCode: { $in: variants } },
              { legacyStudentCodes: { $in: variants } },
            ],
          })
            .select('studentCode legacyStudentCodes name price paid enrollments course branchId')
            .limit(50)
            .lean()
        : [];

      const selection = selectUnpaidStudentCandidates(unpaid, content, amount);
      if (selection.status === 'ambiguous') {
        logger.error(
          '[SEPAY] FAIL CLOSED multi-match (CQRS path) — ids=%j',
          selection.candidates.map((c) => String(c.student._id)),
        );
      } else if (selection.status === 'one') {
        const { student: s, matchedIdentity } = selection.candidates[0];
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
        if (updated) {
          matched = true;
          matchedRef = matchedIdentity;
          let sepayInvoice = null;
          try {
            const Invoice = require('../../invoice/models/Invoice');
            const count = await Invoice.countDocuments();
            const now = new Date();
            const maHD = `HD${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;
            sepayInvoice = await Invoice.create({
              maHoaDon: maHD,
              hocVien: updated._id,
              hoTen: updated.name || s.name,
              khoaHoc: updated.course || 'Học phí',
              hocPhi: amount,
              ghiChu: `SePay CK — ${String(body.content || '').slice(0, 120)}`,
            });
          } catch (invErr) {
            logger.warn('[SEPAY] Invoice create skipped:', invErr.message);
          }
          try {
            const { settlePayment } = require('../../finance/services/ledgerService');
            const list = updated.enrollments || [];
            const primary = list.find((e) => e.isPrimary) || list[0];
            const enrId = primary?._id ? String(primary._id) : '';
            await settlePayment({
              student: updated,
              amount,
              invoice: sepayInvoice,
              enrollmentId: enrId,
              courseName: updated.course || '',
              source: 'sepay',
              sourceRef: sepayInvoice?.maHoaDon || gatewayTxnId || matchedRef,
              idempotencyKey: enrId
                ? `payment:student:${updated._id}:enr:${enrId}`
                : `payment:student:${updated._id}:primary`,
              actor: { id: 'sepay', role: 'system' },
              note: String(body.content || '').slice(0, 300),
              reqMeta: { ip: data.ip, userAgent: 'sepay-webhook', branchId: updated.branchId },
            });
          } catch (ledgerErr) {
            logger.error('[SEPAY] ledger settle FAILED — rollback paid: %s', ledgerErr.message);
            try {
              await Student.findByIdAndUpdate(updated._id, {
                $set: { paid: false, paidAmount: 0, paidNote: '' },
                $unset: { paidAt: 1 },
              });
              if (sepayInvoice?._id) {
                const Invoice = require('../../invoice/models/Invoice');
                await Invoice.findByIdAndUpdate(sepayInvoice._id, { status: 'void' });
              }
            } catch (rbErr) {
              logger.error('[SEPAY] student paid rollback failed: %s', rbErr.message);
            }
            matched = false;
            matchedRef = '';
          }
          if (matched) {
            const io = data.app.get('io');
            if (io) {
              io.emit('tuition:paid', {
                studentId: String(s._id),
                amount,
                message: `✅ ${s.name} đã thanh toán ${amount.toLocaleString('vi-VN')}đ`,
              });
            }
            logger.info(`[SEPAY] Học viên ${s.name} đã thanh toán ${amount}đ`);
          }
        }
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

    return { _status: 200, _body: ({ success: true, matched });

  } catch (err) {
    logger.error('[SEPAY WEBHOOK ERROR]', err);
    return { _status: 200, _body: ({ success: false, message: 'Lỗi server: ' + err.message });
  }
}

  async get_payment_status_studentId(data) {
  try {
    const sid = String(data.studentId);
    const isSelf = data.currentUser.role === 'student' && String(data.currentUser.id) === sid;
    const isStaff = data.currentUser.role === 'admin' || data.currentUser.role === 'staff';
    if (!isSelf && !isStaff) {
      return { _status: 403, _body: ({ success: false, message: 'Không có quyền xem trạng thái thanh toán' });
    }

    const student = await Student.findById(sid).select('paid paidAmount paidAt').lean();
    if (!student) return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy học viên' });
    return { _status: 200, _body: ({
      success: true,
      paid: student.paid === true,
      paidAmount: student.paidAmount || 0,
      paidAt: student.paidAt || null,
    });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

}

module.exports = new PaymentApplicationService();
