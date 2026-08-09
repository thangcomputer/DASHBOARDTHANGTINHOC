'use strict';
const express = require('express');
const router  = express.Router();
const { authMiddleware, branchFilter } = require('../../../shared/middleware/authMiddleware');
const { authorize, authorizeAny, authorizeAll } = require('../../../shared/middleware/authorize');
const legacyMapping = require('../../../shared/constants/legacyPermissionMapping');
const NEW_PERMISSIONS = require('../../../shared/constants/permissions');
const { PERMISSIONS } = require('../../../constants/permissions');

const invoiceController = require('../controllers/InvoiceController');
const invoiceStrangler  = require('./invoiceStrangler');

// ─── GET /api/invoices ─────────────────────────────────────────────────────
// Admin/Staff: Lấy hóa đơn (STAFF bị giới hạn theo chi nhánh)
router.get('/', [authMiddleware, authorizeAny(...legacyMapping.resolve(PERMISSIONS.MANAGE_FINANCE)), branchFilter], invoiceController.get_root);

// ─── GET /api/invoices/stats (branch-aware, timezone-safe) ─────────────────
router.get('/stats', [authMiddleware, authorizeAny(...legacyMapping.resolve(PERMISSIONS.MANAGE_FINANCE)), branchFilter], invoiceController.get_stats);

// ─── GET /api/invoices/:id ─────────────────────────────────────────────────
router.get('/:id', authMiddleware, invoiceController.get_id);

// ─── POST /api/invoices ────────────────────────────────────────────────────
// Tạo hóa đơn thủ công (Admin) — dùng field names từ Student schema mới
// Uses Strangler Facade: routes to CQRS controller when flag enabled
router.post('/', [authMiddleware, authorize(NEW_PERMISSIONS.FINANCE_PAYMENT_CREATE)], invoiceStrangler.post_root);

// ─── GET /api/invoices/:id/pdf ─────────────────────────────────────────────
// Xuất hóa đơn PDF (đồng bộ — tải ngay)
router.get('/:id/pdf', authMiddleware, invoiceController.get_id_pdf);

// ─── POST /api/invoices/:id/pdf/queue ── Sinh PDF nền (lưu uploads/invoices) ──
router.post('/:id/pdf/queue', [authMiddleware, authorizeAny(...legacyMapping.resolve(PERMISSIONS.MANAGE_FINANCE))], invoiceController.post_id_pdf_queue);

// ─── POST /api/invoices/:id/email ── Gửi PDF hóa đơn qua email (queue) ────
router.post('/:id/email', [authMiddleware, authorizeAny(...legacyMapping.resolve(PERMISSIONS.MANAGE_FINANCE))], invoiceController.post_id_email);

// ─── DELETE /api/invoices/:id ─────────────────────────────────────────────
// P3: cấm hard-delete HĐ — chỉ void (status=void) trừ khi FINANCE_ALLOW_HARD_DELETE=true
router.delete('/:id', [authMiddleware, authorize(NEW_PERMISSIONS.FINANCE_REFUND_APPROVE)], invoiceController.delete_id);

module.exports = router;
