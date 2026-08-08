const express = require('express');
const router  = express.Router();
const Invoice = require('../models/Invoice');
const Student = require('../models/Student');
const { generateInvoicePDF } = require('../modules/pdfInvoice');
const { authMiddleware, checkPermission, branchFilter } = require('../middleware/auth');
const { PERMISSIONS } = require('../constants/permissions');
const { sanitizeRegex } = require('../middleware/sanitizeRegex');
const { enqueueInvoicePdf, enqueueInvoiceEmail } = require('../services/queue/jobQueue');
const logger = require('../config/logger');

// ─── GET /api/invoices ─────────────────────────────────────────────────────
// Admin/Staff: Lấy hóa đơn (STAFF bị giới hạn theo chi nhánh)
router.get('/', [authMiddleware, checkPermission(PERMISSIONS.MANAGE_FINANCE), branchFilter], async (req, res) => {
  try {
    const { studentId, search, branchId: queryBranch, paymentMethod, from, to } = req.query;
    const filter = { ...req.branchFilter }; // {} for admin, {branchId:...} for staff

    // Admin có thể lọc thêm theo chi nhánh cụ thể qua query param
    if (queryBranch && queryBranch !== 'all' && !req.branchFilter?.branchId) {
      filter.branchId = queryBranch;
    }
    if (studentId) filter.hocVien = studentId;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }
    if (search) {
      const safeSearch = sanitizeRegex(search);
      filter.$or = [
        { hoTen:    { $regex: safeSearch, $options: 'i' } },
        { khoaHoc:  { $regex: safeSearch, $options: 'i' } },
        { maHoaDon: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const invoices = await Invoice.find(filter)
      .populate('hocVien', 'name course phone zalo paid paidAt branchId branchCode')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: invoices.length, data: invoices });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/invoices/stats (branch-aware, timezone-safe) ────────────────────
router.get('/stats', [authMiddleware, checkPermission(PERMISSIONS.MANAGE_FINANCE), branchFilter], async (req, res) => {
  try {
    // ⭐ Fix: branch-aware filter
    const bf = { ...req.branchFilter };
    // Admin có thể override bằng query param
    if (req.query.branch_id && req.query.branch_id !== 'all' && !req.userBranchId) {
      bf.branchId = req.query.branch_id;
    }

    const total = await Invoice.countDocuments(bf);
    const revenueResult = await Invoice.aggregate([
      { $match: bf },
      { $group: { _id: null, total: { $sum: '$hocPhi' } } },
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    // ⭐ Fix timezone: dùng UTC+7 cho "tháng hiện tại"
    const nowVN = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    const startOfMonth = new Date(Date.UTC(nowVN.getUTCFullYear(), nowVN.getUTCMonth(), 1) - 7 * 60 * 60 * 1000);
    const thisMonthResult = await Invoice.aggregate([
      { $match: { ...bf, createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$hocPhi' } } },
    ]);
    const thisMonthRevenue = thisMonthResult[0]?.total || 0;

    res.json({ success: true, data: { total, totalRevenue, thisMonthRevenue } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/invoices/:id ─────────────────────────────────────────────────────
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('hocVien', 'name course phone zalo address');
    
    if (!invoice) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn' });
    }

    // Bảo vệ: Chỉ Admin hoặc chính Student sở hữu hóa đơn mới được xem
    if (req.user.role !== 'admin' && req.user.id !== invoice.hocVien?._id?.toString()) {
       return res.status(403).json({ success: false, message: 'Bạn không có quyền xem hóa đơn này' });
    }
    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── POST /api/invoices ────────────────────────────────────────────────────────
// Tạo hóa đơn thủ công — hướng mới: TX Invoice + Outbox (PDF async)
router.post('/', authMiddleware, checkPermission(PERMISSIONS.MANAGE_FINANCE), async (req, res) => {
  try {
    const { isInvoiceCqrs, requireReplicaOrThrow } = require('../shared/cqrs/flags');
    if (!isInvoiceCqrs()) {
      return res.status(503).json({
        success: false,
        message: 'Luồng tạo HĐ cũ đã tắt. Bật replica set (MONGODB_URI=?replicaSet=) hoặc ENABLE_CQRS_INVOICE=true.',
      });
    }
    requireReplicaOrThrow();
    const { createInvoiceCqrs } = require('../services/cqrs/createInvoiceCqrs');
    const result = await createInvoiceCqrs(req);
    return res.status(result.status).json(result.body);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Mã hóa đơn đã tồn tại' });
    }
    const status = error.status || error.statusCode || 400;
    return res.status(status).json({ success: false, message: error.message });
  }
});

// ─── GET /api/invoices/:id/pdf ─────────────────────────────────────────────────
// Xuất hóa đơn PDF (đồng bộ — tải ngay)
router.get('/:id/pdf', authMiddleware, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('hocVien', 'name course phone address');

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn' });
    }

    if (req.user.role !== 'admin' && req.user.id !== invoice.hocVien?._id?.toString()) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền xuất hóa đơn này' });
    }

    const pdfBuffer = generateInvoicePDF({
      maHoaDon: invoice.maHoaDon,
      hoTen:    invoice.hoTen,
      khoaHoc:  invoice.khoaHoc,
      hocPhi:   invoice.hocPhi,
      ngayXuat: invoice.ngayXuat || invoice.createdAt,
      ghiChu:   invoice.ghiChu,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=hoadon-${invoice.maHoaDon}.pdf`);
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── POST /api/invoices/:id/pdf/queue ── Sinh PDF nền (lưu uploads/invoices) ──
router.post('/:id/pdf/queue', authMiddleware, checkPermission(PERMISSIONS.MANAGE_FINANCE), async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).select('_id maHoaDon');
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn' });
    }
    const job = await enqueueInvoicePdf({ invoiceId: invoice._id.toString() });
    return res.json({
      success: true,
      message: 'Đã xếp hàng sinh PDF hóa đơn',
      data: { jobId: job.id, mode: job.mode, maHoaDon: invoice.maHoaDon },
    });
  } catch (error) {
    logger.error('[INVOICE] pdf/queue:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ─── POST /api/invoices/:id/email ── Gửi PDF hóa đơn qua email (queue) ───────
router.post('/:id/email', authMiddleware, checkPermission(PERMISSIONS.MANAGE_FINANCE), async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('hocVien', 'email name');
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn' });
    }

    const email = (req.body?.email || invoice.hocVien?.email || '').trim();
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Học viên chưa có email. Truyền body.email hoặc cập nhật hồ sơ học viên.',
      });
    }

    const job = await enqueueInvoiceEmail({
      invoiceId: invoice._id.toString(),
      email,
    });

    return res.json({
      success: true,
      message: `Đã xếp hàng gửi hóa đơn tới ${email}`,
      data: { jobId: job.id, mode: job.mode, email },
    });
  } catch (error) {
    logger.error('[INVOICE] email:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ─── DELETE /api/invoices/:id ──────────────────────────────────────────────────
// P3: cấm hard-delete HĐ — chỉ void (status=void) trừ khi FINANCE_ALLOW_HARD_DELETE=true
router.delete('/:id', authMiddleware, checkPermission(PERMISSIONS.MANAGE_FINANCE), async (req, res) => {
  try {
    const { allowHardDeleteFinance } = require('../utils/financeFlags');
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn' });
    }
    if (!allowHardDeleteFinance()) {
      invoice.status = 'void';
      await invoice.save();
      return res.json({
        success: true,
        message: `Đã void hóa đơn ${invoice.maHoaDon} (không xóa chứng từ)`,
        data: invoice,
      });
    }
    await Invoice.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: `Đã xóa hóa đơn ${invoice.maHoaDon}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
