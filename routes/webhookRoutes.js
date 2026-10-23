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
const mongoose = require('mongoose');
const Student = require('../models/Student');
const { authMiddleware, checkPermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../constants/permissions');
const { policyShadowFinance } = require('../middleware/policyShadowFinance');
const { policyShadowWebhook } = require('../middleware/policyShadowWebhook');

const PaymentSession = require('../models/PaymentSession');
const logger = require('../config/logger');
const { emitFinanceEvent } = require('../utils/realtimeEmit');
const { verifySepayRequest } = require('../services/sepayWebhookAuth');

// ── SePay Webhook verification ────────────────────────────────────────────────
// SePay hỗ trợ 2 kiểu chứng thực:
// 1. API Key: Authorization: Apikey <KEY>
// 2. HMAC-SHA256: X-SePay-Signature + X-SePay-Timestamp
function verifySepaySignature(req, res, next) {
  logger.info('[SEPAY] Incoming webhook', {
    hasAuthorization: Boolean(req.headers['authorization']),
    hasSepayToken: Boolean(req.headers['x-sepay-token']),
    hasSepaySignature: Boolean(req.headers['x-sepay-signature']),
    hasApiKeyHeader: Boolean(req.headers['x-api-key']),
  });

  const apiKey = String(process.env.SEPAY_API_KEY || '').trim();
  const hmacSecret = String(
    process.env.SEPAY_WEBHOOK_SECRET || process.env.SEPAY_SECRET_KEY || '',
  ).trim();

  if (!apiKey && !hmacSecret) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('[SEPAY] Webhook rejected — API Key / HMAC secret not configured');
      return res.status(503).json({ success: false, message: 'Webhook payment not configured' });
    }
    logger.warn('[SEPAY] Dev mode — webhook verification skipped (no SEPAY keys)');
    req.sepayVerificationStatus = 'dev_skip';
    return next();
  }

  const result = verifySepayRequest({
    headers: req.headers,
    rawBody: req.rawBody,
    apiKey,
    hmacSecret,
  });
  if (result.valid) {
    logger.info(`[SEPAY] ${result.mechanism} verified`);
    req.sepayVerificationStatus = 'verified';
    return next();
  }

  logger.warn(`[SEPAY] Webhook authentication rejected: ${result.reason}`);
  return res.status(result.reason === 'not_configured' ? 503 : 401).json({
    success: false,
    message: result.reason === 'expired_timestamp'
      ? 'Expired webhook timestamp'
      : 'Invalid webhook credentials',
  });
}

const SESSION_TTL_MS = 15 * 60 * 1000; // 15 phút

// ── POST /api/webhooks/payment-session & /api/webhooks/create-session ──
const handleCreateSession = async (req, res) => {
  try {
    const {
      ref, content, amount, studentName, courseName, courseId, branchId,
      branchCode, studentId, kind, teacherId, totalSessions, teacherAlert,
    } = req.body;
    const sessionKind = String(kind || 'tuition');
    let resolvedBranchId = branchId || null;
    let resolvedBranchCode = branchCode || '';
    let finalRef = sessionKind === 'admin_enrollment'
      ? ''
      : String(ref || content || '').toLowerCase().trim();
    if (sessionKind !== 'admin_enrollment' && !finalRef) {
      return res.status(400).json({ success: false, message: 'Thiếu nội dung chuyển khoản (ref/content)' });
    }
    if (sessionKind === 'admin_enrollment' && (!studentId || !courseId || !(Number(amount) > 0))) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin học viên, khóa học hoặc học phí' });
    }
    if (
      sessionKind === 'admin_enrollment'
      && (!mongoose.Types.ObjectId.isValid(studentId)
        || !mongoose.Types.ObjectId.isValid(courseId)
        || (teacherId && !mongoose.Types.ObjectId.isValid(teacherId)))
    ) {
      return res.status(400).json({ success: false, message: 'Mã học viên, khóa học hoặc giảng viên không hợp lệ' });
    }
    if (!['tuition', 'video_course', 'course_purchase', 'admin_enrollment'].includes(sessionKind)) {
      return res.status(400).json({ success: false, message: 'Loại phiên thanh toán không hợp lệ' });
    }
    if (sessionKind === 'admin_enrollment') {
      const Course = require('../models/Course');
      const Teacher = require('../models/Teacher');
      const [student, course] = await Promise.all([
        Student.findById(studentId).select('studentCode enrollments branchId branchCode').lean(),
        Course.findById(courseId).select('name').lean(),
      ]);
      if (!student || !course) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy học viên hoặc khóa học' });
      }
      const readableStudentCode = String(student.studentCode || `HV${String(student._id).slice(-6)}`)
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase();
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const suffix = String(crypto.randomInt(10000, 100000));
        const candidate = `${readableStudentCode} HOC PHI ${suffix}`;
        const existing = await PaymentSession.exists({ ref: candidate, status: 'pending' });
        if (!existing) {
          finalRef = candidate;
          break;
        }
      }
      if (!finalRef) {
        throw new Error('Không tạo được nội dung chuyển khoản duy nhất');
      }
      if (
        req.userBranchId
        && student.branchId
        && String(req.userBranchId) !== String(student.branchId)
      ) {
        return res.status(403).json({ success: false, message: 'Không có quyền thao tác học viên chi nhánh khác' });
      }
      resolvedBranchId = student.branchId || req.userBranchId || null;
      resolvedBranchCode = student.branchCode || '';
      if (teacherId && !(await Teacher.exists({ _id: teacherId }))) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy giảng viên' });
      }
      const duplicate = (student.enrollments || []).some((enrollment) => {
        if (['cancelled', 'refunded'].includes(String(enrollment.status || '').toLowerCase())) return false;
        if (enrollment.courseId && String(enrollment.courseId) === String(courseId)) return true;
        return String(enrollment.courseName || '').toLowerCase() === String(course.name || '').toLowerCase();
      });
      if (duplicate) {
        return res.status(409).json({ success: false, message: 'Học viên đã đăng ký khóa học này' });
      }
    }

    const sessionId = `ps_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    await PaymentSession.create({
      sessionId,
      ref: finalRef,
      amount: Number(amount) || 0,
      status: 'pending',
      studentName: studentName || '',
      courseName: courseName || '',
      courseId: courseId || null,
      branchId: resolvedBranchId,
      branchCode: resolvedBranchCode,
      studentId: studentId || null,
      kind: sessionKind,
      teacherId: teacherId || null,
      totalSessions: Number(totalSessions) > 0 ? Number(totalSessions) : 12,
      teacherAlert: String(teacherAlert || '').slice(0, 500),
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

router.post(
  '/payment-session',
  authMiddleware,
  (req, res, next) => req.body?.kind === 'admin_enrollment'
    ? checkPermission(PERMISSIONS.MANAGE_STUDENTS)(req, res, next)
    : next(),
  policyShadowFinance('wh_payment_session'),
  handleCreateSession,
);
router.post(
  '/create-session',
  authMiddleware,
  (req, res, next) => req.body?.kind === 'admin_enrollment'
    ? checkPermission(PERMISSIONS.MANAGE_STUDENTS)(req, res, next)
    : next(),
  policyShadowFinance('wh_payment_session'),
  handleCreateSession,
);

router.post('/cancel-session', authMiddleware, checkPermission(PERMISSIONS.MANAGE_STUDENTS), policyShadowFinance('wh_payment_session'), async (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId || '').trim();
    if (!sessionId) return res.status(400).json({ success: false, message: 'Thiếu sessionId' });
    const cancelled = await PaymentSession.findOneAndUpdate(
      { sessionId, kind: 'admin_enrollment', status: 'pending' },
      { $set: { status: 'expired' } },
      { returnDocument: 'after' },
    );
    if (cancelled) return res.json({ success: true, status: 'expired' });
    const current = await PaymentSession.findOne({ sessionId }).select('status').lean();
    if (current?.status === 'paid' || current?.status === 'processing') {
      return res.status(409).json({
        success: false,
        status: current.status,
        message: current.status === 'paid'
          ? 'Thanh toán đã được xác nhận'
          : 'Giao dịch đang được xử lý, vui lòng chờ xác nhận',
      });
    }
    return res.json({ success: true, status: current?.status || 'not_found' });
  } catch (error) {
    logger.error('[CANCEL PAYMENT SESSION ERROR]', error);
    return res.status(500).json({ success: false, message: 'Không thể hủy phiên thanh toán' });
  }
});

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
      return res.status(400).json({ success: false, message: 'Thiếu thông tin giao dịch' });
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
        {
          $set: {
            status: String(pendingSession.kind || '') === 'admin_enrollment' ? 'processing' : 'paid',
            paidAmount: amount,
          },
        },
        { returnDocument: 'after' }
      );

      if (claimed) {
        try {
          if (String(claimed.kind || 'tuition') === 'video_course') {
            const { fulfillVideoCoursePurchase } = require('../services/videoCoursePurchaseService');
            await fulfillVideoCoursePurchase({
              session: claimed,
              amount,
              io: req.app.get('io'),
            });
            matched = true;
            matchedRef = claimed.ref;
            logger.info(`[SEPAY] Video-course session ${claimed.sessionId} — ${amount}đ`);
          } else if (String(claimed.kind || 'tuition') === 'course_purchase') {
            const { fulfillCoursePurchase } = require('../services/lessonPracticePurchaseService');
            const purchase = await fulfillCoursePurchase({ session: claimed, amount });
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
            matched = true;
            matchedRef = claimed.ref;
            logger.info(
              `[SEPAY] Course-purchase session ${claimed.sessionId} — student ${purchase.studentId} course ${purchase.courseId} — ${amount}đ`,
            );
          } else if (String(claimed.kind || 'tuition') === 'admin_enrollment') {
            const { fulfillAdminEnrollmentPayment } = require('../services/adminEnrollmentPaymentService');
            const enrollment = await fulfillAdminEnrollmentPayment({
              session: claimed,
              amount,
              transferContent: String(body.content || ''),
            });
            const paidSession = await PaymentSession.findOneAndUpdate(
              { _id: claimed._id, status: 'processing' },
              { $set: { status: 'paid' } },
              { returnDocument: 'after' },
            );
            if (!paidSession) {
              throw new Error(`Could not finalize payment session ${claimed.sessionId}`);
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
            matched = true;
            matchedRef = claimed.ref;
            logger.info(
              `[SEPAY] Admin enrollment session ${claimed.sessionId} — student ${claimed.studentId} enrollment ${enrollment._id} — ${amount}đ`,
            );
          } else {
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

          // Update student if studentId is present (re-enroll sau hoàn → enrollment mới sạch)
          if (claimed.studentId) {
            try {
              const Student = require('../models/Student');
              const Course = require('../models/Course');
              const { applyReEnrollmentAfterPayment } = require('../services/enrollmentService');

              let totalSessions = 12;
              if (claimed.courseId) {
                const courseDoc = await Course.findById(claimed.courseId).select('totalSessions').lean();
                if (Number(courseDoc?.totalSessions) > 0) totalSessions = Number(courseDoc.totalSessions);
              }

              const studentDoc = await Student.findById(claimed.studentId);
              if (studentDoc) {
                await applyReEnrollmentAfterPayment(studentDoc, {
                  courseName: claimed.courseName || '',
                  courseId: claimed.courseId || null,
                  branchId: claimed.branchId || null,
                  branchCode: claimed.branchCode || '',
                  amount,
                  totalSessions,
                  learningMode: 'OFFLINE',
                });
                studentDoc.paidNote = String(body.content || '').slice(0, 300);
                await studentDoc.save({ validateModifiedOnly: true });
                logger.info(`[SEPAY] Re-enrolled student ${claimed.studentId} with fresh enrollment (${totalSessions} buổi)`);
              }
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
          } // end else tuition session
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
        // Chỉ gắn lại enrollment chưa hủy/chưa đóng. Nếu chỉ còn cancelled → enrollment mới (không hồi sinh khóa cũ).
        const unpaidEnr = list.find((e) => {
          const st = String(e.status || 'active');
          if (st === 'cancelled' || st === 'refunded') return false;
          return e.paid !== true;
        });
        const needsFreshEnrollment = !unpaidEnr;
        let updated = null;
        let enrId = '';
        let settledCourseName = '';

        if (needsFreshEnrollment) {
          try {
            const Course = require('../models/Course');
            const { applyReEnrollmentAfterPayment } = require('../services/enrollmentService');
            const lastCancelled = [...list].reverse().find((e) => {
              const st = String(e?.status || '').toLowerCase();
              return st === 'cancelled' || st === 'refunded';
            });
            const rootCourse = String(s.course || '').trim();
            const courseName = (rootCourse && rootCourse !== '(Đã hủy)')
              ? rootCourse
              : (lastCancelled?.courseName || 'Khóa học mới');
            let totalSessions = Number(lastCancelled?.totalSessions) > 0
              ? Number(lastCancelled.totalSessions)
              : 12;
            const courseId = lastCancelled?.courseId || null;
            if (courseId) {
              const courseDoc = await Course.findById(courseId).select('totalSessions').lean();
              if (Number(courseDoc?.totalSessions) > 0) totalSessions = Number(courseDoc.totalSessions);
            }
            const studentDoc = await Student.findOne({ _id: s._id, paid: false });
            if (studentDoc) {
              await applyReEnrollmentAfterPayment(studentDoc, {
                courseName,
                courseId,
                branchId: studentDoc.branchId || s.branchId || null,
                amount,
                totalSessions,
                learningMode: 'OFFLINE',
              });
              studentDoc.paidNote = String(body.content || '').slice(0, 300);
              updated = await studentDoc.save({ validateModifiedOnly: true });
              const primaryAfter = (updated.enrollments || []).find((e) => e.isPrimary)
                || (updated.enrollments || [])[(updated.enrollments || []).length - 1];
              enrId = primaryAfter?._id ? String(primaryAfter._id) : '';
              settledCourseName = courseName;
              logger.info(`[SEPAY] Code-match re-enrolled ${s._id} with fresh enrollment (${totalSessions} buổi)`);
            }
          } catch (reEnrErr) {
            logger.error('[SEPAY] code-match re-enroll failed: %s', reEnrErr.message);
          }
        } else {
          enrId = unpaidEnr?._id ? String(unpaidEnr._id) : '';
          settledCourseName = unpaidEnr?.courseName || s.course || '';

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

          updated = await Student.findOneAndUpdate(
            { _id: s._id, paid: false },
            { $set: setFields },
            updateOpts
          );
        }

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
              khoaHoc: settledCourseName || updated.course || unpaidEnr?.courseName || 'Học phí',
              hocPhi: amount,
              ghiChu: `SePay CK — ${String(body.content || '').slice(0, 120)}`,
            });
          } catch (invErr) {
            logger.warn('[SEPAY] Invoice create skipped:', invErr.message);
          }
          try {
            const { settlePayment } = require('../services/ledgerService');
            const primary = (updated.enrollments || []).find((e) => enrId && String(e._id) === enrId)
              || (updated.enrollments || []).find((e) => e.isPrimary)
              || (updated.enrollments || [])[0];
            const settledEnrId = primary?._id ? String(primary._id) : enrId;
            await settlePayment({
              student: updated,
              amount,
              invoice: sepayInvoice,
              enrollmentId: settledEnrId,
              courseName: settledCourseName || updated.course || primary?.courseName || '',
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
              if (needsFreshEnrollment) {
                // Gỡ enrollment vừa thêm; giữ các enrollment cancelled cũ
                const doc = await Student.findById(updated._id);
                if (doc && Array.isArray(doc.enrollments) && enrId) {
                  doc.enrollments = doc.enrollments.filter((e) => String(e._id) !== enrId);
                  doc.paid = false;
                  doc.paidAmount = 0;
                  doc.paidNote = '';
                  doc.paidAt = undefined;
                  const { syncStudentFromPrimaryEnrollment } = require('../services/enrollmentService');
                  syncStudentFromPrimaryEnrollment(doc);
                  await doc.save({ validateModifiedOnly: true });
                }
              } else {
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

    return res.json({ success: true });

  } catch (err) {
    logger.error('[SEPAY WEBHOOK ERROR]', err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi xử lý webhook' });
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
