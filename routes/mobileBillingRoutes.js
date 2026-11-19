'use strict';

const crypto = require('crypto');
const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const MobileBillingTransaction = require('../models/MobileBillingTransaction');
const billing = require('../services/mobileBillingService');
const logger = require('../config/logger');

const router = express.Router();

function isSafeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (!bufA.length || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

router.get('/catalog', authMiddleware, (_req, res) => {
  return res.json({
    success: true,
    data: {
      storeStatus: billing.getStoreConfigStatus(),
      products: billing.PRODUCT_CLASSIFICATION_CATALOG,
    },
  });
});

router.get('/history', authMiddleware, async (req, res) => {
  if (req.user?.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Chỉ học viên mới có lịch sử giao dịch.' });
  }
  try {
    const rows = await MobileBillingTransaction.find({ studentId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return res.json({ success: true, data: rows });
  } catch (err) {
    logger.error('[MOBILE_BILLING] history error:', err);
    return res.status(500).json({ success: false, message: 'Không thể tải lịch sử giao dịch.' });
  }
});

router.post('/verify', authMiddleware, async (req, res) => {
  if (req.user?.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Chỉ tài khoản học viên mới được xác minh giao dịch.' });
  }
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const result = await billing.verifyAndFulfillPurchase({
      studentId: req.user.id,
      platform: String(body.platform || ''),
      environment: body.environment === 'production' ? 'production' : 'sandbox',
      productCategory: String(body.productCategory || ''),
      productId: String(body.productId || ''),
      targetEntityId: String(body.targetEntityId || ''),
      storeTransactionId: String(body.storeTransactionId || ''),
      originalTransactionId: String(body.originalTransactionId || ''),
      amount: Number(body.amount || 0),
      currency: String(body.currency || 'VND'),
      courseTitle: String(body.courseTitle || ''),
      reqMeta: { ip: req.ip || '', userAgent: String(req.headers['user-agent'] || '') },
    });
    return res.json({
      success: true,
      alreadyGranted: result.alreadyGranted,
      data: result.transaction,
      entitlement: result.entitlement || null,
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      code: err.code || 'BILLING_VERIFY_ERROR',
      message: err.message || 'Không thể xác minh giao dịch cửa hàng.',
      storeStatus: billing.getStoreConfigStatus(),
    });
  }
});

router.post('/restore', authMiddleware, async (req, res) => {
  if (req.user?.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Chỉ tài khoản học viên mới có giao dịch cần khôi phục.' });
  }
  try {
    const result = await billing.restorePurchasesForStudent(req.user.id);
    return res.json({
      success: true,
      data: result,
      message: `Đã đồng bộ ${result.restoredCourseIds.length} khóa học đã mua và trạng thái gói tài khoản.`,
    });
  } catch (err) {
    logger.error('[MOBILE_BILLING] restore error:', err);
    return res.status(500).json({ success: false, message: 'Không thể khôi phục giao dịch lúc này.' });
  }
});

router.post('/webhook', async (req, res) => {
  const configuredSecret = process.env.MOBILE_BILLING_WEBHOOK_SECRET || '';
  if (!configuredSecret) {
    return res.status(503).json({
      success: false,
      code: 'WEBHOOK_SECRET_NOT_CONFIGURED',
      message: 'Chưa cấu hình MOBILE_BILLING_WEBHOOK_SECRET.',
    });
  }
  const incomingToken = req.get('x-billing-webhook-secret') || '';
  if (!isSafeEqual(configuredSecret, incomingToken)) {
    return res.status(401).json({ success: false, message: 'Chữ ký webhook không hợp lệ.' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const eventType = String(body.eventType || 'REFUND').toUpperCase();
    if (!['REFUND', 'REVOKE', 'EXPIRED'].includes(eventType)) {
      return res.json({ success: true, ignored: true });
    }
    const result = await billing.handleStoreRefundOrRevoke({
      platform: String(body.platform || 'apple_iap'),
      storeTransactionId: String(body.storeTransactionId || ''),
      originalTransactionId: String(body.originalTransactionId || ''),
      eventType,
      reason: String(body.reason || ''),
      reqMeta: { ip: req.ip || '', userAgent: String(req.headers['user-agent'] || '') },
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[MOBILE_BILLING] webhook error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi xử lý webhook thanh toán cửa hàng.' });
  }
});

module.exports = router;
