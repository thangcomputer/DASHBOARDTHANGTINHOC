'use strict';
const { transactionRepository } = require('./../repositories');
const Transaction = require('./../models/Transaction'); // Temp for new Transaction
const Teacher     = require('./../../teacher/models/Teacher');
const Schedule    = require('./../../attendance/models/Schedule');
const logger = require('./../../../config/logger');
const { postSalary, voidLedgerEntry } = require('./../../finance/services/ledgerService');
const LedgerEntry = require('./../../finance/models/LedgerEntry');
const { allowHardDeleteFinance } = require('./../../../utils/financeFlags');

/**
 * transactionRoutes.js — Quản lý phiếu chi lương giảng viên
 * Có branchFilter: STAFF chỉ thấy giao dịch của chi nhánh mình
 */
const router      = express.Router();
// ─── GET /api/transactions ─────────────────────────────────────────────────────
// Admin/Staff: Lấy giao dịch lương (STAFF chỉ thấy chi nhánh của mình)

class TransactionApplicationService {
  async get_root(data) {
  try {
    const { status, teacherId, month, branchId: queryBranch, page, limit } = data.query;
    const filter = { ...data.branchFilter };

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
      transactionRepository.findMany(filter)
        .populate('teacherId', 'name phone specialty bankAccount branchId branchCode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      transactionRepository.count(filter),
    ]);

    return { _status: 200, _body: ({
      success: true,
      count: transactions.length,
      total,
      page: pageNum,
      limit: limitNum,
      data: transactions,
    });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async get_stats(data) {
  try {
    // ⭐ Fix: branch-aware stats
    const matchFilter = { status: 'confirmed' };
    const pendingMatchFilter = { status: 'pending' };

    // STAFF chỉ thấy giao dịch của GV thuộc chi nhánh mình
    if (data.userBranchId) {
      // Lấy danh sách teacherIds thuộc chi nhánh
      const branchTeachers = await Teacher.find({ branchId: data.userBranchId }).select('_id').lean();
      const teacherIds = branchTeachers.map(t => t._id);
      matchFilter.teacherId = { $in: teacherIds };
      pendingMatchFilter.teacherId = { $in: teacherIds };
    } else if (data.branch_id && data.branch_id !== 'all') {
      const branchTeachers = await Teacher.find({ branchId: data.branch_id }).select('_id').lean();
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
    const countPending = await transactionRepository.count(pendingMatchFilter);
    const countTotal   = await transactionRepository.count(
      data.userBranchId ? { teacherId: matchFilter.teacherId } : {}
    );

    return { _status: 200, _body: ({
      success: true,
      data: { totalPaid, totalPending, countPending, countTotal },
    });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async get_teacher_teacherId(data) {
  try {
    // Chỉ Admin hoặc chính Teacher đó mới được xem
    if (data.currentUser.role !== 'admin' && data.currentUser.role !== 'staff' && data.currentUser.id !== data.teacherId) {
      return { _status: 403, _body: ({ success: false, message: 'Bạn không có quyền xem thông tin này' });
    }
    const transactions = await transactionRepository.findMany({ teacherId: data.teacherId })
      .sort({ createdAt: -1 });
    return { _status: 200, _body: ({ success: true, data: transactions });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async post_calculate(data) {
  try {
    const { teacherId, month } = data.body;
    
    // Nếu không phải Admin, chỉ được tự tính lương của chính mình
    if (data.currentUser.role !== 'admin' && data.currentUser.role !== 'staff' && data.currentUser.id !== teacherId) {
      return { _status: 403, _body: ({ success: false, message: 'Bạn không có quyền thực hiện thao tác này' });
    }
    // month: "YYYY-MM"
    if (!teacherId || !month) {
      return { _status: 400, _body: ({ success: false, message: 'Cần teacherId và month (YYYY-MM)' });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy giảng viên' });
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

    return { _status: 200, _body: ({
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
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async post_root(data) {
  try {
    const { teacherId, amount, description, month, note } = data.body;

    if (!teacherId || !amount) {
      return { _status: 400, _body: ({ success: false, message: 'Thiếu teacherId hoặc amount' });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy giảng viên' });
    }

    const transaction = await transactionRepository.create({
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
    const io = data.app.get('io');
    if (io) {
      const NotificationService = require('../../notification/services/NotificationService');
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

    return { _status: 201, _body: ({ success: true, data: transaction });
  } catch (err) {
    logger.error('[TRANSACTIONS] Create error:', err);
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async put_id_confirm(data) {
  try {
    const { confirmedBy = 'Admin' } = data.body;

    const transaction = await transactionRepository.updateById(
      data.id,
      { status: 'confirmed', confirmedBy, confirmedAt: new Date() },
      { returnDocument: 'after' }
    ).populate('teacherId', 'name phone');

    if (!transaction) {
      return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy giao dịch' });
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
        actor: { id: data.currentUser?.id || '', role: data.currentUser?.role || 'admin', name: confirmedBy },
        note: transaction.description || `Chi lương ${transaction.month || ''}`,
      });
    } catch (ledgerErr) {
      logger.error('[TRANSACTIONS] salary ledger on confirm FAILED — rollback: %s', ledgerErr.message);
      try {
        await transactionRepository.updateById(transaction._id, {
          status: 'pending',
          confirmedBy: '',
          confirmedAt: null,
        });
      } catch (rbErr) {
        logger.error('[TRANSACTIONS] confirm rollback failed: %s', rbErr.message);
      }
      return { _status: 500, _body: ({
        success: false,
        message: 'Ghi sổ lương thất bại — phiếu vẫn pending. Thử lại.',
      });
    }

    // Thông báo real-time cho giảng viên
    const io = data.app.get('io');
    if (io) {
      const NotificationService = require('../../notification/services/NotificationService');
      await NotificationService.send(io, {
        type: 'FINANCE',
        title: '✅ Lương đã được thanh toán',
        content: `Đã xác nhận thanh toán ${transaction.amount.toLocaleString('vi-VN')}đ cho ${transaction.month}`,
        receivers: transaction.teacherId._id.toString(),
        link: '/teacher/finance'
      });

      io.emit('revenue:updated', { amount: transaction.amount, type: 'salary' });
      io.emit('data:refresh', { type: 'transaction', id: transaction._id });
    }

    return { _status: 200, _body: ({ success: true, data: transaction });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async put_id_cancel(data) {
  try {
    const prev = await transactionRepository.findById(data.id);
    if (!prev) {
      return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy giao dịch' });
    }
    if (prev.status === 'cancelled') {
      return { _status: 200, _body: ({ success: true, data: prev });
    }

    const transaction = await transactionRepository.updateById(
      data.id,
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
            actor: { id: data.currentUser?.id || '', role: data.currentUser?.role || 'admin' },
            createReversal: true,
          });
        }
      } catch (voidErr) {
        logger.error('[TRANSACTIONS] void salary on cancel: %s', voidErr.message);
        // Không rollback cancel phiếu — admin có thể void tay; log để reconcile
      }
    }

    return { _status: 200, _body: ({ success: true, data: transaction });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async delete_id(data) {
  try {
    const transaction = await transactionRepository.findById(data.id);
    if (!transaction) {
      return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy giao dịch' });
    }
    if (transaction.status === 'confirmed' && !allowHardDeleteFinance()) {
      return { _status: 405, _body: ({
        success: false,
        message: 'Không được xóa phiếu lương đã xác nhận. Hãy hủy (cancel) hoặc void ledger.',
      });
    }
    if (!allowHardDeleteFinance() && transaction.status !== 'pending' && transaction.status !== 'cancelled') {
      return { _status: 405, _body: ({
        success: false,
        message: 'Hard-delete bị tắt. Dùng PUT /cancel.',
      });
    }
    await transactionRepository.deleteById(data.id);
    return { _status: 200, _body: ({ success: true, message: 'Đã xóa giao dịch' });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

}

module.exports = new TransactionApplicationService();
