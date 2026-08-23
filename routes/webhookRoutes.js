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
const { policyShadowFinance } = require('../middleware/policyShadowFinance');
const { policyShadowWebhook } = require('../middleware/policyShadowWebhook');

const PaymentSession = require('../models/PaymentSession');
const logger = require('../config/logger');
const { emitFinanceEvent } = require('../utils/realtimeEmit');

function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

// ── SePay Webhook verification ────────────────────────────────────────────────
// SePay hỗ trợ 2 kiểu chứng thực:
// 1. API Key: Authorization: Apikey <KEY>
// 2. HMAC: x-sepay-token = HMAC-SHA256(rawBody, SECRET_KEY)
function verifySepaySignature(req, res, next) {
  logger.info('[SEPAY] Incoming webhook', {
    hasAuthorization: Boolean(req.headers['authorization']),
    hasSepayToken: Boolean(req.headers['x-sepay-token']),
    hasApiKeyHeader: Boolean(req.headers['x-api-key']),
  });

  const apiKey = process.env.SEPAY_API_KEY;
  const hmacSecret = process.env.SEPAY_SECRET_KEY;

  if (!apiKey && !hmacSecret) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('[SEPAY] Webhook rejected — SEPAY_API_KEY / SEPAY_SECRET_KEY not configured');
      return res.status(503).json({ success: false, message: 'Webhook payment not configured' });
    }
    logger.warn('[SEPAY] Dev mode — webhook verification skipped (no SEPAY keys)');
    req.sepayVerificationStatus = 'dev_skip';
    return next();
  }

  if (apiKey) {
    const authHeader = req.headers['authorization'] || '';
    const incomingKey = authHeader.replace(/^Apikey\s+/i, '').trim();
    const headerKey = String(req.headers['x-api-key'] || '').trim();
    if (timingSafeEqualString(incomingKey, apiKey) || timingSafeEqualString(headerKey, apiKey)) {
      logger.info('[SEPAY] ✅ API Key verified');
      req.sepayVerificationStatus = 'verified';
      return next();
    }
    // Fall through to HMAC if configured; otherwise reject
    if (!hmacSecret) {
      logger.warn('[SEPAY] ❌ API Key mismatch — rejected');
      return res.status(401).json({ success: false, message: 'Invalid API Key' });
    }
  }

  if (hmacSecret) {
    const signature = req.headers['x-sepay-token'];
    if (!signature) {
      logger.warn('[SEPAY] Missing HMAC signature — rejected');
      return res.status(401).json({ success: false, message: 'Missing webhook signature' });
    }
    const rawBody = Buffer.isBuffer(req.rawBody)
      ? req.rawBody
      : Buffer.from(JSON.stringify(req.body || {}), 'utf8');
    const expected = crypto.createHmac('sha256', hmacSecret).update(rawBody).digest('hex');
    if (!timingSafeEqualString(signature, expected)) {
      logger.warn('[SEPAY] Invalid HMAC signature — rejected');
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }
    req.sepayVerificationStatus = 'verified';
    return next();
  }

  return res.status(401).json({ success: false, message: 'Invalid webhook credentials' });
}

const SESSION_TTL_MS = 15 * 60 * 1000; // 15 phút

// ── POST /api/webhooks/payment-session & /api/webhooks/create-session ──
const handleCreateSession = async (req, res) => {
  try {
    const { ref, content, amount, studentName, courseName, courseId, branchId, branchCode, studentId } = req.body;
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
      courseId: courseId || null,
      branchId: branchId || null,
      branchCode: branchCode || '',
      studentId: studentId || null,
    });

    logger.info(`[PAYMENT SESSION] Tạo mới (DB): ${sessionId} — ref: "${finalRef}"`);
    return res.json({
      success: true,
      sessionId,
      ref: finalRef,
      expiresIn: SESSION_TTL_MS / 1000,
    });
  } catch (err) {
    logger.error('[CREATE SESSION ERROR]', err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi tạo phiên' });
  }
};

router.post('/payment-session', authMiddleware, policyShadowFinance('wh_payment_session'), handleCreateSession);
router.post('/create-session', authMiddleware, policyShadowFinance('wh_payment_session'), handleCreateSession);

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

router.get('/payment-session/:id', authMiddleware, policyShadowFinance('wh_payment_session'), handleCheckSession);
router.get('/payment-status', authMiddleware, policyShadowFinance('wh_payment_session'), handleCheckSession);


// ── POST /api/webhooks/sepay ── SePay Webhook (HMAC verified) ──────────────────
// Policy SHADOW after Legacy verification — never re-verifies / never mutates finance
router.post('/sepay', verifySepaySignature, policyShadowWebhook('sepay'), async (req, res) => {
  try {
    const SepayWebhookEvent = require('../models/SepayWebhookEvent');
    const body = req.body;
    const content = (body.content || body.description || '').toLowerCase().trim();
    const amount  = Number(body.transferAmount || body.amount || 0);
    let gatewayTxnId = String(
      body.id || body.transactionID || body.transaction_id || body.referenceCode || body.transferId || ''
    ).trim();

    // Stable fallback idempotency when gateway omits txn id
    if (!gatewayTxnId) {
      gatewayTxnId = crypto
        .createHash('sha256')
        .update([
          String(amount),
          content,
          String(body.accountNumber || body.account || ''),
          String(body.transactionDate || body.when || body.transferDate || ''),
        ].join('|'))
        .digest('hex')
        .slice(0, 40);
      if (process.env.NODE_ENV === 'production') {
        logger.warn('[SEPAY] Missing gateway txn id — using content hash fallback');
      }
    }

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
          const existing = await SepayWebhookEvent.findOne({ gatewayTxnId }).select('matched matchedRef').lean();
          // Đã khớp trước đó → idempotent OK; chưa khớp (crash giữa chừng) → rematch bên dưới
          if (existing?.matched) {
            return res.json({
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
        try {
          const { settlePayment } = require('../services/ledgerService');
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
            reqMeta: { ip: req.ip, userAgent: 'sepay-webhook', branchId: claimed.branchId || null },
          });
          matched = true;
          matchedRef = claimed.ref;
          logger.info(`[SEPAY] Session ${claimed.sessionId} khớp ref="${claimed.ref}" — ${amount}đ (+Ledger)`);

          // Update student if studentId is present
          if (claimed.studentId) {
            try {
              const Student = require('../models/Student');
              const setStudentFields = {
                paid: true,
                paidAmount: amount,
                paidAt: new Date(),
                paidNote: String(body.content || '').slice(0, 300),
              };
              if (claimed.branchId) {
                setStudentFields.branchId = claimed.branchId;
                setStudentFields.branchCode = claimed.branchCode || '';
              }
              if (claimed.courseName) {
                setStudentFields.course = claimed.courseName;
              }
              if (claimed.courseId) {
                setStudentFields.courseId = claimed.courseId;
              }
              setStudentFields.price = claimed.amount;
              setStudentFields.status = 'Active';

              const newEnrollment = {
                courseName: claimed.courseName || '',
                courseId: claimed.courseId || null,
                branchId: claimed.branchId || null,
                status: 'active',
                paid: true,
                price: claimed.amount,
                paidAmount: amount,
                totalSessions: 12,
                remainingSessions: 12,
                learningMode: 'OFFLINE',
                registeredAt: new Date(),
                learningAccess: true
              };
  
              await Student.findByIdAndUpdate(claimed.studentId, { 
                $set: setStudentFields,
                $push: { enrollments: newEnrollment }
              });
              logger.info(`[SEPAY] Updated student ${claimed.studentId} with branch and course info from session`);
            } catch (stuErr) {
              logger.error(`[SEPAY] Failed to update student ${claimed.studentId} from session: %s`, stuErr.message);
            }
          }

          const io = req.app.get('io');
          if (io) {
            emitFinanceEvent(io, {
              branchId: claimed.branchId || null,
              userIds: claimed.studentId ? [claimed.studentId] : [],
            }, 'tuition:paid', {
              sessionId: claimed.sessionId,
              amount,
              message: `✅ Đã nhận ${amount.toLocaleString('vi-VN')}đ`,
            });
          }
        } catch (ledgerErr) {
          logger.error('[SEPAY] session ledger FAILED — rollback session: %s', ledgerErr.message);
          try {
            await PaymentSession.findByIdAndUpdate(claimed._id, {
              $set: { status: 'pending' },
              $unset: { paidAmount: 1 },
            });
          } catch (rbErr) {
            logger.error('[SEPAY] session rollback failed: %s', rbErr.message);
          }
        }
      }
    }

    // ── 2. Học viên hiện có: studentCode OR legacyStudentCodes — FAIL CLOSED nếu >1 ─
    if (!matched) {
      const {
        extractStudentCodeCandidates,
        selectUnpaidStudentCandidates,
      } = require('../utils/sepayMatch');
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
        const ids = selection.candidates.map((c) => String(c.student._id));
        logger.error(
          '[SEPAY] FAIL CLOSED multi-match unpaid students — no settlement. ids=%j identities=%j amount=%s',
          ids,
          selection.candidates.map((c) => c.matchedIdentity),
          amount,
        );
        if (gatewayTxnId) {
          try {
            await SepayWebhookEvent.updateOne(
              { gatewayTxnId },
              {
                $set: {
                  matched: false,
                  matchedRef: 'ambiguous_student_code',
                  ambiguityStudentIds: ids,
                },
              },
            );
          } catch (e) {
            logger.warn('[SEPAY] ambiguous audit update failed: %s', e.message);
          }
        }
      } else if (selection.status === 'one') {
        const { student: s, matchedIdentity } = selection.candidates[0];
        const list = Array.isArray(s.enrollments) ? s.enrollments : [];
        const unpaidEnr = list.find((e) => {
          const st = String(e.status || 'active');
          if (st === 'cancelled' || st === 'refunded') return false;
          return e.paid !== true;
        }) || list.find((e) => e.isPrimary) || list[0];
        const enrId = unpaidEnr?._id ? String(unpaidEnr._id) : '';

        const setFields = {
          paid: true,
          paidAmount: amount,
          paidAt: new Date(),
          paidNote: String(body.content || '').slice(0, 300),
        };
        if (enrId) {
          setFields['enrollments.$[enr].paid'] = true;
          setFields['enrollments.$[enr].paidAt'] = new Date();
          setFields['enrollments.$[enr].learningAccess'] = true;
          setFields['enrollments.$[enr].status'] = 'active';
        }

        const updateOpts = { returnDocument: 'after' };
        if (enrId) {
          updateOpts.arrayFilters = [{ 'enr._id': unpaidEnr._id }];
        }

        const updated = await Student.findOneAndUpdate(
          { _id: s._id, paid: false },
          { $set: setFields },
          updateOpts
        );

        if (updated) {
          matched = true;
          matchedRef = matchedIdentity;
          let sepayInvoice = null;
          try {
            const Invoice = require('../models/Invoice');
            const count = await Invoice.countDocuments();
            const now = new Date();
            const maHD = `HD${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;
            sepayInvoice = await Invoice.create({
              maHoaDon: maHD,
              hocVien: updated._id,
              hoTen: updated.name || s.name,
              khoaHoc: updated.course || unpaidEnr?.courseName || 'Học phí',
              hocPhi: amount,
              ghiChu: `SePay CK — ${String(body.content || '').slice(0, 120)}`,
            });
          } catch (invErr) {
            logger.warn('[SEPAY] Invoice create skipped:', invErr.message);
          }
          try {
            const { settlePayment } = require('../services/ledgerService');
            const primary = (updated.enrollments || []).find((e) => String(e._id) === enrId)
              || (updated.enrollments || []).find((e) => e.isPrimary)
              || (updated.enrollments || [])[0];
            const settledEnrId = primary?._id ? String(primary._id) : enrId;
            await settlePayment({
              student: updated,
              amount,
              invoice: sepayInvoice,
              enrollmentId: settledEnrId,
              courseName: updated.course || primary?.courseName || '',
              source: 'sepay',
              sourceRef: sepayInvoice?.maHoaDon || gatewayTxnId || matchedRef,
              idempotencyKey: settledEnrId
                ? `payment:student:${updated._id}:enr:${settledEnrId}`
                : `payment:student:${updated._id}:primary`,
              actor: { id: 'sepay', role: 'system' },
              note: String(body.content || '').slice(0, 300),
              reqMeta: { ip: req.ip, userAgent: 'sepay-webhook', branchId: updated.branchId },
            });
          } catch (ledgerErr) {
            logger.error('[SEPAY] ledger settle FAILED — rollback paid: %s', ledgerErr.message);
            try {
              const rollbackSet = {
                paid: false,
                paidAmount: 0,
                paidNote: '',
              };
              if (enrId) {
                rollbackSet['enrollments.$[enr].paid'] = false;
                rollbackSet['enrollments.$[enr].learningAccess'] = false;
                rollbackSet['enrollments.$[enr].status'] = 'pending_payment';
              }
              const rbOpts = { $set: rollbackSet, $unset: { paidAt: 1 } };
              if (enrId) {
                await Student.findByIdAndUpdate(updated._id, rbOpts, {
                  arrayFilters: [{ 'enr._id': unpaidEnr._id }],
                });
              } else {
                await Student.findByIdAndUpdate(updated._id, rbOpts);
              }
              if (sepayInvoice?._id) {
                const Invoice = require('../models/Invoice');
                await Invoice.findByIdAndUpdate(sepayInvoice._id, { status: 'void' });
              }
            } catch (rbErr) {
              logger.error('[SEPAY] student paid rollback failed: %s', rbErr.message);
            }
            matched = false;
            matchedRef = '';
          }

          if (matched) {
            const io = req.app.get('io');
            if (io) {
              emitFinanceEvent(io, {
                branchId: updated?.branchId || s.branchId || null,
                userIds: [s._id],
              }, 'tuition:paid', {
                studentId: String(s._id),
                amount,
                message: `✅ ${s.name} đã thanh toán ${amount.toLocaleString('vi-VN')}đ`,
              });
            }
            logger.info(`[SEPAY] Học viên ${s.name} đã thanh toán ${amount}đ (identity=${matchedIdentity})`);
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

    return res.json({ success: true, matched });

  } catch (err) {
    logger.error('[SEPAY WEBHOOK ERROR]', err);
    return res.json({ success: false, message: 'Lỗi server: ' + err.message });
  }
});

// ── GET /api/webhooks/payment-status/:studentId ── Polling HV đã có tài khoản ─
router.get('/payment-status/:studentId', authMiddleware, policyShadowFinance('wh_payment_status_student'), async (req, res) => {
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
