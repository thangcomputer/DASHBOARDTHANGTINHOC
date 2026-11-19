'use strict';

const MobileBillingTransaction = require('../models/MobileBillingTransaction');
const VideoCoursePurchase = require('../models/VideoCoursePurchase');
const Student = require('../models/Student');
const { writeAudit } = require('./auditLogService');
const logger = require('../config/logger');

const PRODUCT_CLASSIFICATION_CATALOG = [
  {
    category: 'digital_video_course',
    title: 'Khóa học video số',
    requiresStoreBillingOnNative: true,
    storeProductType: 'non_consumable',
    companionReadOnlyOnNative: true,
    exemptionBasis: null,
    recommendedMobileBehavior: 'Sử dụng Apple IAP / Google Play Billing (non-consumable) hoặc chỉ cho phép xem nội dung đã sở hữu ở chế độ Reader/Companion (không đặt nút/QR thanh toán ngoài).',
  },
  {
    category: 'digital_xp_pack',
    title: 'Gói XP và tính năng mở khóa bằng XP',
    requiresStoreBillingOnNative: true,
    storeProductType: 'consumable',
    companionReadOnlyOnNative: false,
    exemptionBasis: null,
    recommendedMobileBehavior: 'Bắt buộc dùng Apple IAP / Google Play Billing (consumable) nếu bán trong ứng dụng iOS/Android; XP kiếm miễn phí từ luyện tập không phải IAP.',
  },
  {
    category: 'digital_subscription',
    title: 'Gói thuê bao tài khoản LMS (1m / 3m / 6m / 12m / lifetime)',
    requiresStoreBillingOnNative: true,
    storeProductType: 'subscription',
    companionReadOnlyOnNative: true,
    exemptionBasis: null,
    recommendedMobileBehavior: 'Dùng Auto-Renewable Subscription trên App Store / Google Play (hoặc non-consumable cho lifetime), hỗ trợ Restore Purchases & xử lý hoàn tiền webhook.',
  },
  {
    category: 'live_1on1_tutoring',
    title: 'Học trực tuyến 1 kèm 1 với giảng viên',
    requiresStoreBillingOnNative: false,
    storeProductType: 'exempt_real_time_tutoring',
    companionReadOnlyOnNative: true,
    exemptionBasis: 'Apple Guideline 3.1.3(d) Real-time person-to-person tutoring / Google Play physical/live services',
    recommendedMobileBehavior: 'Hiển thị trạng thái học phí theo khóa từ hệ thống; tránh gắn nút dẫn thanh toán kèm tính năng số trong app nếu có gói video gộp chung.',
  },
  {
    category: 'live_group_class',
    title: 'Lớp trực tuyến theo nhóm qua Google Meet',
    requiresStoreBillingOnNative: false,
    storeProductType: 'exempt_live_group_or_review_needed',
    companionReadOnlyOnNative: true,
    exemptionBasis: 'Apple Guideline 3.1.3(d) (chỉ miễn trừ khi học tương tác trực tiếp với giáo viên, không bao gồm kho video thu sẵn bán kèm)',
    recommendedMobileBehavior: 'Tách bạch lớp Meet trực tiếp với nội dung số thu sẵn trong danh mục sản phẩm gửi Apple/Google Review.',
  },
  {
    category: 'offline_classroom',
    title: 'Khóa học trực tiếp tại trung tâm',
    requiresStoreBillingOnNative: false,
    storeProductType: 'exempt_offline_service',
    companionReadOnlyOnNative: true,
    exemptionBasis: 'Apple Guideline 3.1.3(e) Physical services outside the app',
    recommendedMobileBehavior: 'Chỉ xem lịch học, điểm danh và công nợ học phí do trung tâm ghi nhận.',
  },
];

function getStoreConfigStatus() {
  const appleMissing = [];
  if (!process.env.APPLE_IAP_ISSUER_ID) appleMissing.push('APPLE_IAP_ISSUER_ID');
  if (!process.env.APPLE_IAP_KEY_ID) appleMissing.push('APPLE_IAP_KEY_ID');
  if (!process.env.APPLE_IAP_PRIVATE_KEY) appleMissing.push('APPLE_IAP_PRIVATE_KEY');
  if (!process.env.APPLE_BUNDLE_ID) appleMissing.push('APPLE_BUNDLE_ID');

  const googleMissing = [];
  if (!process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) googleMissing.push('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
  if (!process.env.GOOGLE_PLAY_PACKAGE_NAME) googleMissing.push('GOOGLE_PLAY_PACKAGE_NAME');

  const appleConfigured = appleMissing.length === 0;
  const googleConfigured = googleMissing.length === 0;
  const requestedMode = String(process.env.MOBILE_STORE_BILLING_MODE || '').toLowerCase();
  const billingMode = (requestedMode === 'production' && (appleConfigured || googleConfigured))
    ? 'production'
    : (requestedMode === 'sandbox' && (appleConfigured || googleConfigured))
      ? 'sandbox'
      : 'reader_companion';

  return {
    billingMode,
    appleConfigured,
    googleConfigured,
    missingCredentials: {
      apple_iap: appleMissing,
      google_play: googleMissing,
    },
    complianceSummary: 'Không cho phép hiển thị mã QR / cổng thanh toán ngoài trên iOS/Android native cho nội dung số (Apple 3.1.1 / Google Play Payments).',
  };
}

function makeStoreError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  if (code) err.code = code;
  return err;
}

async function verifyWithPlatformAdapter({ platform, storeTransactionId, productId, environment, storeVerifier }) {
  if (typeof storeVerifier === 'function') {
    return storeVerifier({ platform, storeTransactionId, productId, environment });
  }
  const config = getStoreConfigStatus();
  if (platform === 'apple_iap' && !config.appleConfigured) {
    throw makeStoreError(
      412,
      `Chưa cấu hình Apple App Store Server API (${config.missingCredentials.apple_iap.join(', ')}).`,
      'STORE_CREDENTIALS_MISSING',
    );
  }
  if (platform === 'google_play' && !config.googleConfigured) {
    throw makeStoreError(
      412,
      `Chưa cấu hình Google Play Developer API (${config.missingCredentials.google_play.join(', ')}).`,
      'STORE_CREDENTIALS_MISSING',
    );
  }
  throw makeStoreError(
    501,
    'Bộ xác minh biên lai trực tiếp cần khóa API cửa hàng và kết nối App Store / Google Play Developer API.',
    'STORE_VERIFIER_UNAVAILABLE',
  );
}

async function grantEntitlementForTransaction(tx) {
  const studentId = tx.studentId;
  if (tx.productCategory === 'digital_video_course') {
    const courseId = String(tx.targetEntityId || tx.productId || '');
    const sessionRef = `iap:${tx.platform}:${tx.storeTransactionId}`;
    await VideoCoursePurchase.findOneAndUpdate(
      { studentId, courseId, paymentSessionId: sessionRef },
      {
        $set: {
          studentId,
          courseId,
          courseTitle: String(tx.rawSummary?.courseTitle || tx.productId || ''),
          amount: Number(tx.amount || 0),
          paidAmount: Number(tx.amount || 0),
          status: 'paid',
          paymentSessionId: sessionRef,
          ref: tx.storeTransactionId,
          paidAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    return { granted: 'digital_video_course', courseId };
  }

  if (tx.productCategory === 'digital_xp_pack') {
    const dailyPracticeService = require('./dailyPracticeService');
    const { xpPack } = require('./dailyPracticeRules');
    const pack = xpPack(tx.targetEntityId || tx.productId);
    const xpAmount = Number(tx.xpGranted || pack?.xp || 0);
    if (xpAmount > 0) {
      await dailyPracticeService.adjustProfileXp(studentId, xpAmount, { source: 'purchase' });
    }
    return { granted: 'digital_xp_pack', xp: xpAmount };
  }

  if (tx.productCategory === 'digital_subscription') {
    const subscriptionService = require('./subscriptionService');
    const plan = String(tx.targetEntityId || tx.productId || '1m');
    const status = await subscriptionService.applyRenewal(studentId, plan, {
      source: 'payment',
      paymentSessionId: `iap:${tx.platform}:${tx.storeTransactionId}`,
      amount: Number(tx.amount || 0),
      actor: { id: tx.platform, name: tx.platform === 'apple_iap' ? 'Apple IAP' : 'Google Play' },
    });
    return { granted: 'digital_subscription', plan, subscription: status };
  }

  return { granted: 'none' };
}

async function verifyAndFulfillPurchase({
  studentId,
  platform,
  environment = 'sandbox',
  productCategory,
  productId,
  targetEntityId = '',
  storeTransactionId,
  originalTransactionId = '',
  amount = 0,
  currency = 'VND',
  xpGranted = 0,
  courseTitle = '',
  storeVerifier = null,
  reqMeta = {},
}) {
  if (!studentId || !['apple_iap', 'google_play'].includes(platform)) {
    throw makeStoreError(400, 'Nền tảng giao dịch không hợp lệ.', 'INVALID_PLATFORM');
  }
  if (!['digital_video_course', 'digital_xp_pack', 'digital_subscription'].includes(productCategory)) {
    throw makeStoreError(400, 'Loại sản phẩm số không hợp lệ.', 'INVALID_PRODUCT_CATEGORY');
  }
  if (!storeTransactionId || !productId) {
    throw makeStoreError(400, 'Thiếu mã giao dịch cửa hàng hoặc mã sản phẩm.', 'MISSING_STORE_TRANSACTION');
  }

  const existing = await MobileBillingTransaction.findOne({ platform, storeTransactionId }).lean();
  if (existing && existing.status === 'verified') {
    return {
      alreadyGranted: true,
      transaction: existing,
    };
  }
  if (existing && (existing.status === 'refunded' || existing.status === 'revoked')) {
    throw makeStoreError(409, 'Giao dịch này đã được hoàn tiền hoặc thu hồi.', 'TRANSACTION_ALREADY_REFUNDED');
  }

  const verification = await verifyWithPlatformAdapter({
    platform,
    storeTransactionId,
    productId,
    environment,
    storeVerifier,
  });
  if (!verification?.valid) {
    throw makeStoreError(402, verification?.message || 'Xác minh giao dịch cửa hàng thất bại.', 'STORE_VERIFICATION_FAILED');
  }

  const verifiedRecord = await MobileBillingTransaction.findOneAndUpdate(
    { platform, storeTransactionId, status: { $ne: 'verified' } },
    {
      $set: {
        studentId,
        platform,
        environment: verification.environment || environment,
        productCategory,
        productId,
        targetEntityId: String(targetEntityId || productId),
        originalTransactionId: String(originalTransactionId || verification.originalTransactionId || ''),
        status: 'verified',
        amount: Number(verification.amount ?? amount ?? 0),
        currency: String(verification.currency || currency || 'VND'),
        xpGranted: Number(verification.xpGranted ?? xpGranted ?? 0),
        verificationSource: String(verification.source || `${platform}_server_api`),
        rawSummary: { ...(verification.summary || {}), courseTitle },
        grantedAt: new Date(),
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );

  const entitlement = await grantEntitlementForTransaction(verifiedRecord);

  await writeAudit({
    action: 'MOBILE_BILLING_VERIFIED',
    actorUserId: String(studentId),
    actorRole: 'student',
    entityType: 'MobileBillingTransaction',
    entityId: String(verifiedRecord._id),
    studentId,
    newValue: {
      platform,
      productCategory,
      productId,
      storeTransactionId,
      entitlement,
    },
    ip: reqMeta.ip || '',
    userAgent: reqMeta.userAgent || '',
  });

  return {
    alreadyGranted: false,
    transaction: verifiedRecord.toObject ? verifiedRecord.toObject() : verifiedRecord,
    entitlement,
  };
}

async function restorePurchasesForStudent(studentId) {
  const [verifiedTx, paidCourses, student] = await Promise.all([
    MobileBillingTransaction.find({ studentId, status: 'verified' }).sort({ grantedAt: -1 }).lean(),
    VideoCoursePurchase.find({ studentId, status: 'paid' }).sort({ paidAt: -1 }).lean(),
    Student.findById(studentId).select('subscription freePortal').lean(),
  ]);

  const ownedCourseIds = new Set(paidCourses.map((c) => String(c.courseId)));
  let reconciled = 0;

  for (const tx of verifiedTx) {
    if (tx.productCategory === 'digital_video_course') {
      const cid = String(tx.targetEntityId || tx.productId || '');
      if (cid && !ownedCourseIds.has(cid)) {
        await grantEntitlementForTransaction(tx);
        ownedCourseIds.add(cid);
        reconciled += 1;
      }
    }
  }

  return {
    restoredCourseIds: [...ownedCourseIds],
    subscription: student?.subscription || null,
    verifiedTransactionCount: verifiedTx.length,
    reconciledCount: reconciled,
  };
}

async function handleStoreRefundOrRevoke({
  platform,
  storeTransactionId,
  originalTransactionId = '',
  eventType = 'REFUND',
  reason = '',
  reqMeta = {},
}) {
  const query = storeTransactionId
    ? { platform, storeTransactionId }
    : { platform, originalTransactionId };
  const targetStatus = String(eventType).toUpperCase() === 'REVOKE' ? 'revoked' : 'refunded';

  const updated = await MobileBillingTransaction.findOneAndUpdate(
    { ...query, status: 'verified' },
    {
      $set: {
        status: targetStatus,
        refundedAt: new Date(),
        'rawSummary.refundReason': String(reason || '').slice(0, 200),
      },
    },
    { returnDocument: 'after' },
  ).lean();

  if (!updated) {
    return { matched: false, message: 'Không tìm thấy giao dịch đã xác minh cần thu hồi.' };
  }

  if (updated.productCategory === 'digital_video_course') {
    const courseId = String(updated.targetEntityId || updated.productId || '');
    const sessionRef = `iap:${updated.platform}:${updated.storeTransactionId}`;
    await VideoCoursePurchase.updateMany(
      { studentId: updated.studentId, courseId, paymentSessionId: sessionRef, status: 'paid' },
      { $set: { status: 'cancelled' } },
    );
  } else if (updated.productCategory === 'digital_xp_pack') {
    const xpAmount = Number(updated.xpGranted || 0);
    if (xpAmount > 0) {
      const dailyPracticeService = require('./dailyPracticeService');
      await dailyPracticeService.adjustProfileXp(updated.studentId, -xpAmount, { source: 'refund' });
    }
  } else if (updated.productCategory === 'digital_subscription') {
    const subscriptionService = require('./subscriptionService');
    await subscriptionService.adminSetSubscription(
      updated.studentId,
      { mode: 'free', note: `Thu hồi do ${targetStatus} trên ${updated.platform}` },
      { id: updated.platform, name: 'Store Webhook' },
    ).catch((err) => logger.warn('[MOBILE_BILLING] subscription downgrade on refund warn:', err.message));
  }

  await writeAudit({
    action: 'MOBILE_BILLING_REFUNDED',
    actorUserId: String(updated.platform),
    actorRole: 'system',
    entityType: 'MobileBillingTransaction',
    entityId: String(updated._id),
    studentId: updated.studentId,
    oldValue: { status: 'verified' },
    newValue: { status: targetStatus, reason: String(reason || '') },
    ip: reqMeta.ip || '',
    userAgent: reqMeta.userAgent || '',
  });

  return { matched: true, transaction: updated };
}

module.exports = {
  PRODUCT_CLASSIFICATION_CATALOG,
  getStoreConfigStatus,
  handleStoreRefundOrRevoke,
  restorePurchasesForStudent,
  verifyAndFulfillPurchase,
};
