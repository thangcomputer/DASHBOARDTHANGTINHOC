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
const { policyShadowFinance } = require('../middleware/policyShadowFinance');
const { sanitizeRegex } = require('../middleware/sanitizeRegex');
const logger = require('../config/logger');
const { postSalary, voidLedgerEntry } = require('../services/ledgerService');
const LedgerEntry = require('../models/LedgerEntry');
const { allowHardDeleteFinance } = require('../utils/financeFlags');
const { emitFinanceEvent, emitDataRefresh } = require('../utils/realtimeEmit');

// ─── GET /api/transactions ─────────────────────────────────────────────────────
// Admin/Staff: Lấy giao dịch lương (STAFF chỉ thấy chi nhánh của mình)
router.get('/', [authMiddleware, branchFilter, policyShadowFinance('tx_list'), checkPermission(PERMISSIONS.MANAGE_FINANCE)], async (req, res) => {
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
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));
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
router.get('/stats', [authMiddleware, branchFilter, policyShadowFinance('tx_stats'), checkPermission(PERMISSIONS.MANAGE_FINANCE)], async (req, res) => {
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
router.get('/teacher/:teacherId', authMiddleware, policyShadowFinance('tx_teacher_history'), async (req, res) => {
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
router.post('/calculate', authMiddleware, policyShadowFinance('tx_calculate'), isTeacher, async (req, res) => {
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
router.post('/', authMiddleware, policyShadowFinance('tx_create'), checkPermission(PERMISSIONS.MANAGE_FINANCE), async (req, res) => {
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

      emitDataRefresh(io, { type: 'transaction', id: transaction._id }, {
        branchId: teacher.branchId,
        userIds: [teacherId],
      });
    }

    res.status(201).json({ success: true, data: transaction });
  } catch (err) {
    logger.error('[TRANSACTIONS] Create error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/transactions/:id/confirm ────────────────────────────────────────
// Admin xác nhận đã thanh toán lương
router.put('/:id/confirm', authMiddleware, policyShadowFinance('tx_confirm'), checkPermission(PERMISSIONS.MANAGE_FINANCE), async (req, res) => {
  try {
    const { confirmedBy = 'Admin' } = req.body;

    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      { status: 'confirmed', confirmedBy, confirmedAt: new Date() },
      { returnDocument: 'after' }
    ).populate('teacherId', 'name phone');

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
    }

    try {
      const teacherDoc = transaction.teacherId?._id
        ? transaction.teacherId
        : await Teacher.findById(transaction.teacherId).lean();
      await postSalary({
        teacher: teacherDoc,
        amount: transaction.amount,
        transaction,
        branchId: teacherDoc?.branchId || transaction.branchId || null,
        idempotencyKey: `salary:tx:${transaction._id}`,
        sourceRef: `tx:${transaction._id}`,
        actor: { id: req.user?.id || '', role: req.user?.role || 'admin', name: confirmedBy },
        note: transaction.description || `Chi lương ${transaction.month || ''}`,
      });
    } catch (ledgerErr) {
      logger.error('[TRANSACTIONS] salary ledger on confirm FAILED — rollback: %s', ledgerErr.message);
      try {
        await Transaction.findByIdAndUpdate(transaction._id, {
          status: 'pending',
          confirmedBy: '',
          confirmedAt: null,
        });
      } catch (rbErr) {
        logger.error('[TRANSACTIONS] confirm rollback failed: %s', rbErr.message);
      }
      return res.status(500).json({
        success: false,
        message: 'Ghi sổ lương thất bại — phiếu vẫn pending. Thử lại.',
      });
    }

    // Thông báo real-time cho giảng viên
    const io = req.app.get('io');
    if (io) {
      const NotificationService = require('../services/NotificationService');
      await NotificationService.send(io, {
        type: 'FINANCE',
        title: '✅ Lương đã được thanh toán',
        content: `Đã xác nhận thanh toán ${transaction.amount.toLocaleString('vi-VN')}đ cho ${transaction.month}`,
        receivers: transaction.teacherId._id.toString(),
        link: '/teacher/finance'
      });

      const branchId = transaction.branchId
        || transaction.teacherId?.branchId
        || null;
      const teacherUid = transaction.teacherId?._id || transaction.teacherId;
      emitFinanceEvent(io, { branchId, userIds: teacherUid ? [teacherUid] : [] }, 'revenue:updated', {
        amount: transaction.amount,
        type: 'salary',
      });
      emitDataRefresh(io, { type: 'transaction', id: transaction._id }, {
        branchId,
        userIds: teacherUid ? [teacherUid] : [],
      });
    }

    res.json({ success: true, data: transaction });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/transactions/:id/cancel ─────────────────────────────────────────
router.put('/:id/cancel', authMiddleware, policyShadowFinance('tx_cancel'), checkPermission(PERMISSIONS.MANAGE_FINANCE), async (req, res) => {
  try {
    const prev = await Transaction.findById(req.params.id);
    if (!prev) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
    }
    if (prev.status === 'cancelled') {
      return res.json({ success: true, data: prev });
    }

    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      { status: 'cancelled' },
      { returnDocument: 'after' }
    );

    // H8: hủy phiếu confirmed → void SALARY ledger
    if (prev.status === 'confirmed') {
      try {
        const salaryEntry = await LedgerEntry.findOne({
          type: 'salary',
          status: 'posted',
          $or: [
            { sourceRef: `tx:${prev._id}` },
            { idempotencyKey: `salary:tx:${prev._id}` },
            { 'metadata.transactionId': String(prev._id) },
          ],
        });
        if (salaryEntry) {
          await voidLedgerEntry({
            entryId: salaryEntry._id,
            reason: `Hủy phiếu chi ${prev._id}`,
            actor: { id: req.user?.id || '', role: req.user?.role || 'admin' },
            createReversal: true,
          });
        }
      } catch (voidErr) {
        logger.error('[TRANSACTIONS] void salary on cancel: %s', voidErr.message);
        // Không rollback cancel phiếu — admin có thể void tay; log để reconcile
      }
    }

    res.json({ success: true, data: transaction });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/transactions/:id ────────────────────────────────────────────
// P3: cấm hard-delete phiếu đã confirmed; chỉ cho phép khi FINANCE_ALLOW_HARD_DELETE=true
router.delete('/:id', authMiddleware, policyShadowFinance('tx_delete'), checkPermission(PERMISSIONS.MANAGE_FINANCE), async (req, res) => {
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
