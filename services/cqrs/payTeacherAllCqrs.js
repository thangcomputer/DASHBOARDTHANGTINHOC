'use strict';

const Teacher = require('../../models/Teacher');
const Schedule = require('../../models/Schedule');
const Transaction = require('../../models/Transaction');
const { withTransaction } = require('../../shared/cqrs/withTransaction');
const { requireReplicaOrThrow } = require('../../shared/cqrs/flags');
const { postSalary } = require('../ledgerService');

/**
 * Atomic pay-all: claim all unpaid completed sessions + Transaction + salary ledger.
 */
async function payTeacherAllCqrs(req) {
  requireReplicaOrThrow();

  const teacher = await Teacher.findById(req.params.id);
  if (!teacher) {
    const err = new Error('Teacher not found');
    err.status = 404;
    throw err;
  }

  const pendingSessionsCount = await Schedule.countDocuments({
    teacherId: req.params.id,
    status: 'completed',
    is_paid_to_teacher: { $ne: true },
  });

  if (pendingSessionsCount === 0) {
    const err = new Error('Không có buổi dạy nào cần thanh toán');
    err.status = 400;
    throw err;
  }

  const salaryPerSession = teacher.baseSalaryPerSession || 0;
  const estimatedAmount = pendingSessionsCount * salaryPerSession;
  if (estimatedAmount <= 0) {
    const err = new Error(
      'Giảng viên chưa được cấu hình mức lương/buổi. Vui lòng Admin cập nhật trường "Lương/buổi" trước khi thanh toán.'
    );
    err.status = 400;
    throw err;
  }
  if (estimatedAmount > 500000000) {
    const err = new Error(
      `Số tiền thanh toán (${estimatedAmount.toLocaleString('vi-VN')}đ) vượt quá giới hạn 500 triệu. Vui lòng kiểm tra lại mức lương/buổi.`
    );
    err.status = 400;
    throw err;
  }

  const actor = {
    id: req.user?.id || req.user?._id || '',
    role: req.user?.role || 'admin',
    name: req.user?.name || '',
  };

  return withTransaction(async (session) => {
    const pendingSessions = await Schedule.find({
      teacherId: req.params.id,
      status: 'completed',
      is_paid_to_teacher: { $ne: true },
    })
      .select('_id')
      .session(session)
      .lean();

    const sessionIds = pendingSessions.map((s) => s._id);
    if (sessionIds.length === 0) {
      const err = new Error('Các buổi đã được thanh toán bởi yêu cầu khác');
      err.status = 409;
      throw err;
    }

    const claim = await Schedule.updateMany(
      {
        _id: { $in: sessionIds },
        status: 'completed',
        is_paid_to_teacher: { $ne: true },
      },
      { $set: { is_paid_to_teacher: true, paymentStatus: 'paid' } },
      { session }
    );

    const paidCount = claim.modifiedCount || 0;
    if (paidCount === 0) {
      const err = new Error('Các buổi đã được thanh toán bởi yêu cầu khác');
      err.status = 409;
      throw err;
    }

    const totalAmount = paidCount * salaryPerSession;
    const now = new Date();
    const [transaction] = await Transaction.create([{
      teacherId: req.params.id,
      teacherName: teacher.name,
      teacherPhone: teacher.phone,
      amount: totalAmount,
      description: `Thanh toán thù lao ${paidCount} buổi dạy`,
      month: `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`,
      status: 'confirmed',
      confirmedBy: req.user?.name || 'Admin',
      confirmedAt: now,
      bankName: teacher.bankAccount?.bankName || '',
      bankAccount: teacher.bankAccount?.accountNumber || '',
    }], { session });

    await postSalary({
      teacher,
      amount: totalAmount,
      transaction,
      branchId: teacher.branchId || null,
      idempotencyKey: `salary:tx:${transaction._id}`,
      sourceRef: `tx:${transaction._id}`,
      actor,
      note: `Thanh toán thù lao ${paidCount} buổi dạy`,
      metadata: { sessionsCount: paidCount, sessionIds: sessionIds.map(String) },
      session,
    });

    return { paidSessions: paidCount, totalAmount, transaction };
  });
}

module.exports = { payTeacherAllCqrs };
