/**
 * transactionRoutes.js — Quản lý phiếu chi lương giảng viên
 * Có branchFilter: STAFF chỉ thấy giao dịch của chi nhánh mình
 */
const express     = require('express');
const router      = express.Router();
const Transaction = require('../models/Transaction');
const Teacher     = require('../models/Teacher');
const Schedule    = require('../models/Schedule');
const { authMiddleware, checkPermission, isTeacher, branchFilter } = require('../middleware/auth');
const { PERMISSIONS } = require('../constants/permissions');
const { sanitizeRegex } = require('../middleware/sanitizeRegex');
const logger = require('../config/logger');
const { allowHardDeleteFinance } = require('../utils/financeFlags');

// ─── GET /api/transactions ─────────────────────────────────────────────────────
// Admin/Staff: Lấy giao dịch lương (STAFF chỉ thấy chi nhánh của mình)
router.get('/', [authMiddleware, checkPermission(PERMISSIONS.MANAGE_FINANCE), branchFilter], async (req, res) => {
  try {
    const { status, teacherId, month, branchId: queryBranch, page, limit } = req.query;
    const filter = { ...req.branchFilter };

    if (queryBranch && queryBranch !== 'all' && !filter.branchId) filter.branchId = queryBranch;
    if (status)    filter.status    = status;
    if (teacherId) filter.teacherId = teacherId;
    if (month) {
      const safeMonth = sanitizeRegex(String(month), 32);
      if (safeMonth) filter.month = { $regex: safeMonth, $options: 'i' };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(1000, Math.max(1, parseInt(limit, 10) || 200));
    const skip = (pageNum - 1) * limitNum;

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate('teacherId', 'name phone specialty bankAccount branchId branchCode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Transaction.countDocuments(filter),
    ]);

    res.json({
      success: true,
      count: transactions.length,
      total,
      page: pageNum,
      limit: limitNum,
      data: transactions,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/transactions/stats ──────────────────────────────────────────────
// Thống kê tài chính giảng viên (Admin/Staff, branch-aware)
router.get('/stats', [authMiddleware, checkPermission(PERMISSIONS.MANAGE_FINANCE), branchFilter], async (req, res) => {
  try {
    // ⭐ Fix: branch-aware stats
    const matchFilter = { status: 'confirmed' };
    const pendingMatchFilter = { status: 'pending' };

    // STAFF chỉ thấy giao dịch của GV thuộc chi nhánh mình
    if (req.userBranchId) {
      // Lấy danh sách teacherIds thuộc chi nhánh
      const branchTeachers = await Teacher.find({ branchId: req.userBranchId }).select('_id').lean();
      const teacherIds = branchTeachers.map(t => t._id);
      matchFilter.teacherId = { $in: teacherIds };
      pendingMatchFilter.teacherId = { $in: teacherIds };
    } else if (req.query.branch_id && req.query.branch_id !== 'all') {
      const branchTeachers = await Teacher.find({ branchId: req.query.branch_id }).select('_id').lean();
      const teacherIds = branchTeachers.map(t => t._id);
      matchFilter.teacherId = { $in: teacherIds };
      pendingMatchFilter.teacherId = { $in: teacherIds };
    }

    const totalResult = await Transaction.aggregate([
      { $match: matchFilter },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const pendingResult = await Transaction.aggregate([
      { $match: pendingMatchFilter },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const totalPaid    = totalResult[0]?.total   || 0;
    const totalPending = pendingResult[0]?.total  || 0;
    const countPending = await Transaction.countDocuments(pendingMatchFilter);
    const countTotal   = await Transaction.countDocuments(
      req.userBranchId ? { teacherId: matchFilter.teacherId } : {}
    );

    res.json({
      success: true,
      data: { totalPaid, totalPending, countPending, countTotal },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/transactions/teacher/:teacherId ──────────────────────────────────
// Giảng viên xem lịch sử nhận lương
router.get('/teacher/:teacherId', authMiddleware, async (req, res) => {
  try {
    // Chỉ Admin hoặc chính Teacher đó mới được xem
    if (req.user.role !== 'admin' && req.user.role !== 'staff' && req.user.id !== req.params.teacherId) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem thông tin này' });
    }
    const transactions = await Transaction.find({ teacherId: req.params.teacherId })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/transactions/calculate ─────────────────────────────────────────
// Tính lương tự động theo buổi dạy đã hoàn thành trong tháng
router.post('/calculate', authMiddleware, isTeacher, async (req, res) => {
  try {
    const { teacherId, month } = req.body;
    
    // Nếu không phải Admin, chỉ được tự tính lương của chính mình
    if (req.user.role !== 'admin' && req.user.role !== 'staff' && req.user.id !== teacherId) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này' });
    }
    // month: "YYYY-MM"
    if (!teacherId || !month) {
      return res.status(400).json({ success: false, message: 'Cần teacherId và month (YYYY-MM)' });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giảng viên' });
    }

    const [year, m] = month.split('-').map(Number);
    const startDate = new Date(year, m - 1, 1);
    const endDate   = new Date(year, m,     1);

    // Đếm số buổi đã hoàn thành
    const completedSessions = await Schedule.countDocuments({
      teacherId,
      status:  'completed',
      date: { $gte: startDate, $lt: endDate },
    });

    const salaryPerSession = teacher.baseSalaryPerSession || 0;
    const totalAmount      = completedSessions * salaryPerSession;
    const monthLabel       = `Tháng ${m}/${year}`;

    res.json({
      success: true,
      data: {
        teacherId,
        teacherName:       teacher.name,
        month:             monthLabel,
        completedSessions,
        salaryPerSession,
        totalAmount,
        bankAccount:       teacher.bankAccount,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/transactions ────────────────────────────────────────────────────
// Admin tạo phiếu chi lương cho giảng viên
router.post('/', authMiddleware, checkPermission(PERMISSIONS.MANAGE_FINANCE), async (req, res) => {
  try {
    const { teacherId, amount, description, month, note } = req.body;

    if (!teacherId || !amount) {
      return res.status(400).json({ success: false, message: 'Thiếu teacherId hoặc amount' });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giảng viên' });
    }

    const transaction = await Transaction.create({
      teacherId,
      teacherName:  teacher.name,
      teacherPhone: teacher.phone || '',
      amount,
      description:  description || `Thù lao giảng dạy ${month || ''}`,
      month:        month       || '',
      note:         note        || '',
      bankName:     teacher.bankAccount?.bankName    || '',
      bankAccount:  teacher.bankAccount?.accountNumber || '',
      // Gắn branchId từ teacher để filter sau này
      branchId:     teacher.branchId   || null,
      branchCode:   teacher.branchCode || '',
      status: 'pending',
    });

    // Thông báo real-time cho giảng viên
    const io = req.app.get('io');
    if (io) {
      const NotificationService = require('../services/NotificationService');
      await NotificationService.send(io, {
        type: 'FINANCE',
        title: '💵 Phiếu chi lương mới',
        content: `Admin đã tạo phiếu chi ${amount.toLocaleString('vi-VN')}đ cho tháng ${month || ''}`,
        receivers: teacherId.toString(),
        payload: { transactionId: transaction._id },
        link: '/teacher/finance'
      });
      
      io.emit('data:refresh', { type: 'transaction', id: transaction._id });
    }

    res.status(201).json({ success: true, data: transaction });
  } catch (err) {
    logger.error('[TRANSACTIONS] Create error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/transactions/:id/confirm ────────────────────────────────────────
// Hướng mới: confirm + salary ledger trong một TX
router.put('/:id/confirm', authMiddleware, checkPermission(PERMISSIONS.MANAGE_FINANCE), async (req, res) => {
  try {
    const { isFinanceCqrs } = require('../shared/cqrs/flags');
    if (!isFinanceCqrs()) {
      return res.status(503).json({
        success: false,
        message: 'Luồng xác nhận lương cũ đã tắt. Bật replica set hoặc ENABLE_CQRS_FINANCE=true.',
      });
    }
    const { confirmTransactionCqrs } = require('../services/cqrs/salaryTransactionCqrs');
    const { transaction } = await confirmTransactionCqrs(req);

    const io = req.app.get('io');
    if (io) {
      const NotificationService = require('../services/NotificationService');
      const teacherId = transaction.teacherId?._id || transaction.teacherId;
      if (teacherId) {
        await NotificationService.send(io, {
          type: 'FINANCE',
          title: '✅ Lương đã được thanh toán',
          content: `Đã xác nhận thanh toán ${transaction.amount.toLocaleString('vi-VN')}đ cho ${transaction.month}`,
          receivers: teacherId.toString(),
          link: '/teacher/finance',
        });
      }
      io.emit('revenue:updated', { amount: transaction.amount, type: 'salary' });
      io.emit('data:refresh', { type: 'transaction', id: transaction._id });
    }

    res.json({ success: true, data: transaction });
  } catch (err) {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) logger.error('[TRANSACTIONS] Confirm error:', err);
    res.status(status).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/transactions/:id/cancel ─────────────────────────────────────────
router.put('/:id/cancel', authMiddleware, checkPermission(PERMISSIONS.MANAGE_FINANCE), async (req, res) => {
  try {
    const { isFinanceCqrs } = require('../shared/cqrs/flags');
    if (!isFinanceCqrs()) {
      return res.status(503).json({
        success: false,
        message: 'Luồng hủy phiếu lương cũ đã tắt. Bật replica set hoặc ENABLE_CQRS_FINANCE=true.',
      });
    }
    const { cancelTransactionCqrs } = require('../services/cqrs/salaryTransactionCqrs');
    const { transaction } = await cancelTransactionCqrs(req);
    res.json({ success: true, data: transaction });
  } catch (err) {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) logger.error('[TRANSACTIONS] Cancel error:', err);
    res.status(status).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/transactions/:id ────────────────────────────────────────────
// P3: cấm hard-delete phiếu đã confirmed; chỉ cho phép khi FINANCE_ALLOW_HARD_DELETE=true
router.delete('/:id', authMiddleware, checkPermission(PERMISSIONS.MANAGE_FINANCE), async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
    }
    if (transaction.status === 'confirmed' && !allowHardDeleteFinance()) {
      return res.status(405).json({
        success: false,
        message: 'Không được xóa phiếu lương đã xác nhận. Hãy hủy (cancel) hoặc void ledger.',
      });
    }
    if (!allowHardDeleteFinance() && transaction.status !== 'pending' && transaction.status !== 'cancelled') {
      return res.status(405).json({
        success: false,
        message: 'Hard-delete bị tắt. Dùng PUT /cancel.',
      });
    }
    await Transaction.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Đã xóa giao dịch' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
