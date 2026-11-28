'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const Student = require('../models/Student');
const PaymentSession = require('../models/PaymentSession');
const DewskillClassPurchaseLog = require('../models/DewskillClassPurchaseLog');
const SystemSettings = require('../models/SystemSettings');
const { settlePayment } = require('./ledgerService');
const { emitFinanceEvent } = require('../utils/realtimeEmit');

const AI_PACKAGE_PLANS = {
  '1d': {
    id: '1d',
    code: '1D',
    group: 'day',
    name: 'Gói Hỏi AI 1 Ngày',
    shortLabel: '1 ngày',
    durationLabel: '24 giờ',
    durationHours: 24,
    durationDays: 1,
    price: 15000,
    originalPrice: 25000,
    savingsLabel: '',
  },
  '1m': {
    id: '1m',
    code: '1M',
    group: 'standard',
    name: 'Gói Hỏi AI Tiêu Chuẩn · 1 Tháng',
    shortLabel: '1 tháng',
    durationLabel: '30 ngày',
    durationHours: 0,
    durationDays: 30,
    price: 59000,
    originalPrice: 89000,
    savingsLabel: '',
  },
  '3m': {
    id: '3m',
    code: '3M',
    group: 'standard',
    name: 'Gói Hỏi AI Tiêu Chuẩn · 3 Tháng',
    shortLabel: '3 tháng',
    durationLabel: '90 ngày',
    durationHours: 0,
    durationDays: 90,
    price: 149000,
    originalPrice: 177000,
    savingsLabel: 'Tiết kiệm 16%',
  },
  '6m': {
    id: '6m',
    code: '6M',
    group: 'longterm',
    name: 'Gói Hỏi AI Dài Hạn · 6 Tháng',
    shortLabel: '6 tháng',
    durationLabel: '180 ngày',
    durationHours: 0,
    durationDays: 180,
    price: 269000,
    originalPrice: 354000,
    savingsLabel: 'Tiết kiệm 24%',
  },
  '12m': {
    id: '12m',
    code: '12M',
    group: 'longterm',
    name: 'Gói Hỏi AI Dài Hạn · 12 Tháng',
    shortLabel: '12 tháng',
    durationLabel: '365 ngày',
    durationHours: 0,
    durationDays: 365,
    price: 479000,
    originalPrice: 708000,
    savingsLabel: 'Tiết kiệm 32%',
  },
};

const PLAN_RANK = {
  '1d': 1,
  '1m': 2,
  '3m': 3,
  '6m': 4,
  '12m': 5,
};

function makeErr(status, message, code = '') {
  const err = new Error(message);
  err.status = status;
  if (code) err.code = code;
  return err;
}

function getAiPackagePlan(planId) {
  const key = String(planId || '').trim().toLowerCase();
  return AI_PACKAGE_PLANS[key] || null;
}

function hasActiveAiPlan(studentOrUser, now = Date.now()) {
  const plan = studentOrUser?.aiPlan;
  if (!plan || !plan.isUnlimited || !plan.expiresAt) return false;
  const expiresMs = new Date(plan.expiresAt).getTime();
  return Number.isFinite(expiresMs) && expiresMs > now;
}

function formatAiPlanStatus(studentOrUser, now = Date.now()) {
  const raw = studentOrUser?.aiPlan || {};
  const active = hasActiveAiPlan(studentOrUser, now);
  const planId = String(raw.plan || '').trim().toLowerCase();
  const planDef = getAiPackagePlan(planId);
  return {
    plan: active ? planId : '',
    code: active && planDef ? planDef.code : '',
    label: active && planDef ? planDef.name : '',
    isUnlimited: active,
    activatedAt: active && raw.activatedAt ? new Date(raw.activatedAt).toISOString() : null,
    expiresAt: active && raw.expiresAt ? new Date(raw.expiresAt).toISOString() : null,
  };
}

function computeNextAiPlanExpiry(currentAiPlan, planDef, now = new Date()) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const currentExpiresMs = currentAiPlan?.isUnlimited && currentAiPlan?.expiresAt
    ? new Date(currentAiPlan.expiresAt).getTime()
    : 0;
  const baseMs = currentExpiresMs > nowDate.getTime() ? currentExpiresMs : nowDate.getTime();
  const durationMs = Number(planDef?.durationHours) > 0
    ? Number(planDef.durationHours) * 60 * 60 * 1000
    : Math.max(1, Number(planDef?.durationDays) || 30) * 24 * 60 * 60 * 1000;
  return new Date(baseMs + durationMs);
}

function makeAiPackageRef(student, planDef, uniqueSuffix = '') {
  const codePart = String(planDef?.code || '3M').replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || '3M';
  const rawContact = String(
    student?.phone
    || student?.zalo
    || student?.studentCode
    || (student?._id ? String(student._id).slice(-6) : 'HV'),
  ).trim();
  const contactPart = rawContact.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'HV';
  const suffix = String(uniqueSuffix || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `DEW AI ${codePart} ${contactPart}${suffix ? ` ${suffix}` : ''}`.trim();
}

async function resolveUniqueAiPackageRef(student, planDef) {
  const baseRef = makeAiPackageRef(student, planDef);
  const collision = await PaymentSession.exists({ ref: baseRef, status: 'pending' });
  if (!collision) return baseRef;
  for (let i = 0; i < 8; i += 1) {
    const suffix = String(crypto.randomInt(100, 1000));
    const candidate = makeAiPackageRef(student, planDef, suffix);
    const exists = await PaymentSession.exists({ ref: candidate, status: 'pending' });
    if (!exists) return candidate;
  }
  return makeAiPackageRef(student, planDef, String(Date.now()).slice(-4));
}

async function loadBankPaymentInfo() {
  const settings = await SystemSettings.findOne({ _key: 'main' })
    .select('centerBankCode centerBankName centerBankAccountNumber centerBankAccountName')
    .lean();
  return {
    bankCode: String(settings?.centerBankCode || '').trim(),
    bankName: String(settings?.centerBankName || '').trim(),
    accountNumber: String(settings?.centerBankAccountNumber || '').trim(),
    accountName: String(settings?.centerBankAccountName || '').trim(),
  };
}

function buildVietQrUrl(bank, amount, ref) {
  if (!bank?.bankCode || !bank?.accountNumber) return null;
  const params = new URLSearchParams({
    amount: String(Math.max(0, Math.round(Number(amount) || 0))),
    addInfo: String(ref || ''),
    accountName: String(bank.accountName || ''),
  });
  return `https://img.vietqr.io/image/${bank.bankCode}-${bank.accountNumber}-qr_only.png?${params.toString()}`;
}

async function checkoutAiPackage({ user, planId }) {
  const uid = String(user?.id || user?._id || '').trim();
  if (!uid || !mongoose.Types.ObjectId.isValid(uid)) {
    throw makeErr(400, 'Tài khoản học viên không hợp lệ để mua gói AI.');
  }
  const planDef = getAiPackagePlan(planId);
  if (!planDef) {
    throw makeErr(400, 'Gói Hỏi AI không hợp lệ. Vui lòng chọn 1 ngày, 1 tháng, 3 tháng, 6 tháng hoặc 12 tháng.');
  }

  const [student, bankInfo] = await Promise.all([
    Student.findById(uid).select('_id name studentCode phone zalo branchId aiPlan').lean(),
    loadBankPaymentInfo(),
  ]);
  if (!student) throw makeErr(404, 'Không tìm thấy tài khoản học viên.');

  const currentAiPlan = formatAiPlanStatus(student);
  if (currentAiPlan.isUnlimited && currentAiPlan.plan) {
    if (currentAiPlan.plan === planDef.id) {
      throw makeErr(409, 'Bạn đang sử dụng gói Hỏi AI này rồi.', 'AI_PLAN_ALREADY_ACTIVE');
    }
    if ((PLAN_RANK[planDef.id] || 0) < (PLAN_RANK[currentAiPlan.plan] || 0)) {
      throw makeErr(409, 'Bạn đang sử dụng gói Hỏi AI cao hơn gói này.', 'AI_PLAN_HIGHER_ACTIVE');
    }
  }
  const basePrice = Math.max(0, Math.round(Number(planDef.price) || 0));
  const referralConfigService = require('./referralConfigService');
  const DailyPracticeProfile = require('../models/DailyPracticeProfile');
  const [dpProfile, referralCfg, existingPending] = await Promise.all([
    DailyPracticeProfile.findOne({ studentId: student._id })
      .select('referralDiscountAvailableVnd referredByCode')
      .lean(),
    referralConfigService.getReferralConfig(),
    PaymentSession.findOne({
      studentId: student._id,
      kind: 'ai_package',
      status: 'pending',
    }).sort({ createdAt: -1 }),
  ]);

  const { appliedDiscountVnd, finalAmount } = referralConfigService.calculateReferralDiscount({
    basePrice,
    availableDiscountVnd: dpProfile?.referralDiscountAvailableVnd || 0,
    config: referralCfg,
    target: 'ai_package',
  });
  const referralCodeApplied = appliedDiscountVnd > 0 ? String(dpProfile?.referredByCode || '') : '';

  if (
    existingPending
    && String(existingPending.plan || '').toLowerCase() === planDef.id
    && Number(existingPending.amount) === finalAmount
    && Number(existingPending.referralDiscountVnd || 0) === appliedDiscountVnd
  ) {
    return {
      sessionId: existingPending.sessionId,
      ref: existingPending.ref,
      amount: existingPending.amount,
      basePrice: Number(existingPending.originalAmount) || basePrice,
      referralDiscountVnd: Number(existingPending.referralDiscountVnd) || 0,
      referralCodeApplied,
      plan: planDef,
      courseName: planDef.name,
      studentName: student.name || user?.name || '',
      bankInfo,
      qrUrl: buildVietQrUrl(bankInfo, existingPending.amount, existingPending.ref),
      aiPlan: currentAiPlan,
    };
  }

  if (existingPending) {
    existingPending.status = 'expired';
    await existingPending.save();
  }

  const sessionId = `aip_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const ref = await resolveUniqueAiPackageRef(student, planDef);

  await PaymentSession.create({
    sessionId,
    ref,
    amount: finalAmount,
    originalAmount: basePrice,
    referralDiscountVnd: appliedDiscountVnd,
    status: 'pending',
    studentName: student.name || user?.name || '',
    courseName: planDef.name,
    branchId: student.branchId || null,
    studentId: student._id,
    kind: 'ai_package',
    plan: planDef.id,
  });

  return {
    sessionId,
    ref,
    amount: finalAmount,
    basePrice,
    referralDiscountVnd: appliedDiscountVnd,
    referralCodeApplied,
    plan: planDef,
    courseName: planDef.name,
    studentName: student.name || user?.name || '',
    bankInfo,
    qrUrl: buildVietQrUrl(bankInfo, finalAmount, ref),
    aiPlan: currentAiPlan,
  };
}

async function getAiPackageSession({ user, sessionId }) {
  const sidStr = String(sessionId || '').trim();
  if (!sidStr) throw makeErr(400, 'Thiếu mã phiên thanh toán gói AI.');

  const session = await PaymentSession.findOne({
    sessionId: sidStr,
    kind: 'ai_package',
  }).lean();

  if (!session) {
    return {
      status: 'not_found',
      paid: false,
    };
  }

  const requesterId = String(user?.id || user?._id || '');
  if (user?.role !== 'admin' && String(session.studentId || '') !== requesterId) {
    throw makeErr(403, 'Bạn không có quyền truy cập phiên thanh toán này.');
  }

  const [bankInfo, student] = await Promise.all([
    loadBankPaymentInfo(),
    session.studentId
      ? Student.findById(session.studentId).select('_id name aiPlan').lean()
      : Promise.resolve(null),
  ]);

  const planDef = getAiPackagePlan(session.plan);
  const aiPlan = formatAiPlanStatus(student);

  return {
    status: session.status,
    paid: session.status === 'paid',
    sessionId: session.sessionId,
    ref: session.ref,
    amount: session.amount,
    basePrice: Number(session.originalAmount) || Number(session.amount) || 0,
    referralDiscountVnd: Number(session.referralDiscountVnd) || 0,
    paidAmount: session.paidAmount || 0,
    plan: planDef,
    courseName: session.courseName || planDef?.name || '',
    studentName: session.studentName || student?.name || '',
    bankInfo,
    qrUrl: buildVietQrUrl(bankInfo, session.amount, session.ref),
    aiPlan,
  };
}

function resolvePlanFromSession(session) {
  const direct = getAiPackagePlan(session?.plan);
  if (direct) return direct;
  const refMatch = String(session?.ref || '').toUpperCase().match(/\b(1D|1M|3M|6M|12M)\b/);
  if (refMatch) return getAiPackagePlan(refMatch[1]);
  return null;
}

async function fulfillAiPackagePurchase({ session, amount = 0, grantedBy = 'sepay', io = null }) {
  if (!session?.studentId) {
    throw new Error(`Thiếu học viên trong phiên AI package ${session?.sessionId || ''}`);
  }
  const planDef = resolvePlanFromSession(session);
  if (!planDef) {
    throw new Error(`Không xác định được gói AI trong phiên ${session?.sessionId || ''}`);
  }

  const student = await Student.findById(session.studentId).select('_id name branchId aiPlan').lean();
  if (!student) throw new Error(`Không tìm thấy học viên ${session.studentId}`);

  // Idempotency: nếu phiên này đã kích hoạt rồi thì giữ nguyên thời hạn
  if (student.aiPlan?.lastPaymentSessionId && student.aiPlan.lastPaymentSessionId === session.sessionId) {
    return {
      studentId: String(student._id),
      plan: planDef.id,
      aiPlan: formatAiPlanStatus(student),
      alreadyApplied: true,
    };
  }

  const paidAmt = Math.max(0, Number(amount) || 0);
  if (paidAmt > 0) {
    await settlePayment({
      student: { _id: student._id, branchId: session.branchId || student.branchId || null },
      amount: paidAmt,
      courseName: planDef.name,
      source: 'sepay_session',
      sourceRef: session.sessionId,
      idempotencyKey: `payment:sepay:ai-package:${session.sessionId}`,
      actor: { id: grantedBy, role: 'system' },
      note: `Thanh toán ${planDef.name} qua chuyển khoản`,
      metadata: {
        sessionId: session.sessionId,
        ref: session.ref,
        studentName: session.studentName || student.name || '',
        aiPlan: planDef.id,
        purchaseType: 'ai_package',
        paymentMethod: 'transfer',
      },
      reqMeta: { ip: '', userAgent: grantedBy, branchId: session.branchId || student.branchId || null },
    });
  }

  const now = new Date();
  const nextExpiry = computeNextAiPlanExpiry(student.aiPlan, planDef, now);
  const updatedStudent = await Student.findByIdAndUpdate(
    student._id,
    {
      $set: {
        aiPlan: {
          plan: planDef.id,
          isUnlimited: true,
          activatedAt: now,
          expiresAt: nextExpiry,
          lastPaymentSessionId: session.sessionId,
        },
      },
    },
    { returnDocument: 'after' },
  )
    .select('_id aiPlan')
    .lean();

  const aiPlanStatus = formatAiPlanStatus(updatedStudent || { aiPlan: { plan: planDef.id, isUnlimited: true, activatedAt: now, expiresAt: nextExpiry } });

  const existingPurchaseLog = session.sessionId
    ? await DewskillClassPurchaseLog.findOne({ sessionId: session.sessionId, purchaseType: 'ai_package' }).lean()
    : null;
  if (!existingPurchaseLog) {
    const aiMonths = { '1d': 0, '1m': 1, '3m': 3, '6m': 6, '12m': 12 };
    const discountNote = Number(session.referralDiscountVnd) > 0
      ? ` · Giảm mã giới thiệu ${Number(session.referralDiscountVnd).toLocaleString('vi-VN')}đ`
      : '';
    await DewskillClassPurchaseLog.create({
      purchaseType: 'ai_package',
      studentId: student._id,
      classId: null,
      planId: planDef.id,
      courseName: planDef.name,
      courseCode: planDef.code,
      source: grantedBy === 'dev_simulate' ? 'dev_simulate' : 'payment',
      amount: paidAmt,
      durationMonths: aiMonths[planDef.id] ?? 1,
      durationLabel: planDef.shortLabel || planDef.durationLabel || '',
      includesMeet: false,
      paymentRef: session.ref || '',
      sessionId: session.sessionId || '',
      startsAt: now,
      expiresAt: nextExpiry,
      status: 'active',
      note: `Gói Hỏi AI Không Giới Hạn${discountNote}`,
    });
  }

  if (Number(session.referralDiscountVnd) > 0 && session.sessionId) {
    await require('./referralConfigService')
      .consumeStudentReferralDiscount(student._id, session.referralDiscountVnd, session.sessionId)
      .catch(() => {});
  }

  if (!existingPurchaseLog) {
    const NotificationService = require('./NotificationService');
    const { buildPurchaseNotification } = require('./purchaseNotificationHelper');
    const notif = buildPurchaseNotification({
      purchaseType: 'ai_package',
      itemName: planDef.name,
      amount: paidAmt,
      source: grantedBy === 'dev_simulate' ? 'dev_simulate' : 'payment',
      purchasedAt: now,
      durationText: planDef.shortLabel || planDef.durationLabel || '',
      expiresAt: nextExpiry,
      includesMeet: false,
      paymentRef: session.ref || '',
      planId: planDef.id,
    });
    await NotificationService.send(io, {
      ...notif,
      receivers: [String(student._id)],
    }).catch(() => {});
  }

  if (io) {
    emitFinanceEvent(
      io,
      {
        branchId: session.branchId || student.branchId || null,
        userIds: [String(student._id)],
      },
      'aiPackage:paid',
      {
        sessionId: session.sessionId,
        plan: planDef.id,
        amount: paidAmt,
        aiPlan: aiPlanStatus,
        message: `Đã kích hoạt ${planDef.name} (Không giới hạn hỏi AI)`,
      },
    );
  }

  return {
    studentId: String(student._id),
    plan: planDef.id,
    aiPlan: aiPlanStatus,
  };
}

async function simulateAiPackagePurchase({ studentId, sessionId, io = null }) {
  if (!studentId || !mongoose.Types.ObjectId.isValid(String(studentId))) {
    throw makeErr(400, 'Học viên không hợp lệ.');
  }
  const session = await PaymentSession.findOne({
    sessionId: String(sessionId || '').trim(),
    studentId,
    kind: 'ai_package',
  });
  if (!session) throw makeErr(404, 'Không tìm thấy phiên thanh toán gói AI.');
  if (session.status === 'expired') throw makeErr(409, 'Phiên thanh toán đã hết hạn.');

  let claimed = false;
  if (session.status === 'pending') {
    const paidSession = await PaymentSession.findOneAndUpdate(
      { _id: session._id, status: 'pending' },
      { $set: { status: 'paid', paidAmount: session.amount } },
      { returnDocument: 'after' },
    );
    if (!paidSession) {
      const latest = await PaymentSession.findById(session._id);
      if (latest?.status !== 'paid') throw makeErr(409, 'Phiên chuyển khoản không còn hiệu lực.');
      Object.assign(session, latest.toObject());
    } else {
      Object.assign(session, paidSession.toObject());
      claimed = true;
    }
  }

  try {
    const result = await fulfillAiPackagePurchase({
      session,
      amount: session.amount,
      grantedBy: 'dev_simulate',
      io,
    });
    return { ...result, sessionId: session.sessionId, status: 'paid', paid: true };
  } catch (err) {
    if (claimed) {
      await PaymentSession.updateOne(
        { _id: session._id, status: 'paid' },
        { $set: { status: 'pending' }, $unset: { paidAmount: 1 } },
      );
    }
    throw err;
  }
}

module.exports = {
  AI_PACKAGE_PLANS,
  getAiPackagePlan,
  hasActiveAiPlan,
  formatAiPlanStatus,
  computeNextAiPlanExpiry,
  makeAiPackageRef,
  checkoutAiPackage,
  getAiPackageSession,
  fulfillAiPackagePurchase,
  simulateAiPackagePurchase,
};
