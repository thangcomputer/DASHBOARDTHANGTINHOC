'use strict';

const Teacher = require('../../models/Teacher');
const Schedule = require('../../models/Schedule');
const Transaction = require('../../models/Transaction');
const { withTransaction } = require('../../shared/cqrs/withTransaction');
const { requireReplicaOrThrow } = require('../../shared/cqrs/flags');
const { postSalary } = require('../ledgerService');
const { resolveBonusForPayout } = require('../teacherStarBonus');

/**
 * Atomic teacher flexible pay: claim sessions + Transaction + salary ledger (+ star bonus mark).
 */
async function payTeacherFlexibleCqrs(req) {
  requireReplicaOrThrow();

  const { sessionsCount, amount, note, includeStarBonus, starBonusMonths } = req.body || {};
  const idempotencyKey = String(
    req.headers['idempotency-key'] || req.body?.idempotencyKey || ''
  ).trim() || null;

  const paidCount = Math.max(0, Number(sessionsCount) || 0);
  const wantBonus = includeStarBonus === true || includeStarBonus === 'true' || includeStarBonus === 1;

  if (paidCount <= 0 && !wantBonus) {
    const err = new Error('Số buổi thanh toán phải lớn hơn 0 (hoặc bật thưởng sao)');
    err.status = 400;
    throw err;
  }
  if (!amount || Number(amount) <= 0) {
    const err = new Error('Số tiền thanh toán phải lớn hơn 0');
    err.status = 400;
    throw err;
  }
  if (Number(amount) > 500000000) {
    const err = new Error('Số tiền vượt giới hạn 500 triệu/lần');
    err.status = 400;
    throw err;
  }

  if (idempotencyKey) {
    const existing = await Transaction.findOne({ idempotencyKey }).lean();
    if (existing) {
      return {
        idempotent: true,
        paidSessions: paidCount,
        markedSessions: 0,
        totalAmount: existing.amount,
        starBonusAmount: existing.starBonusAmount || 0,
        starBonusMonths: existing.starBonusMonths || [],
        transaction: existing,
      };
    }
  }

  const teacher = await Teacher.findById(req.params.id);
  if (!teacher) {
    const err = new Error('Teacher not found');
    err.status = 404;
    throw err;
  }

  let bonusPayout = { payoutMonths: [], payoutBonusAmount: 0 };
  if (wantBonus) {
    bonusPayout = await resolveBonusForPayout(
      teacher,
      Array.isArray(starBonusMonths) ? starBonusMonths : null
    );
    if (paidCount <= 0 && bonusPayout.payoutBonusAmount <= 0) {
      const err = new Error('Không có thưởng sao đủ điều kiện để thanh toán');
      err.status = 400;
      throw err;
    }
  }
  const starBonusAmount = Number(bonusPayout.payoutBonusAmount) || 0;
  const starBonusMonthKeys = Array.isArray(bonusPayout.payoutMonths) ? bonusPayout.payoutMonths : [];

  const actor = {
    id: req.user?.id || req.user?._id || '',
    role: req.user?.role || 'admin',
    name: req.user?.name || '',
  };

  try {
    return await withTransaction(async (session) => {
      let sessionIds = [];
      let actualCount = 0;
      if (paidCount > 0) {
        const pendingSessions = await Schedule.find({
          teacherId: req.params.id,
          status: 'completed',
          is_paid_to_teacher: { $ne: true },
        })
          .sort({ date: 1, createdAt: 1 })
          .limit(paidCount)
          .session(session);

        sessionIds = pendingSessions.map((s) => s._id);
        if (sessionIds.length > 0) {
          const claim = await Schedule.updateMany(
            {
              _id: { $in: sessionIds },
              status: 'completed',
              is_paid_to_teacher: { $ne: true },
            },
            { $set: { is_paid_to_teacher: true, paymentStatus: 'paid' } },
            { session }
          );
          actualCount = claim.modifiedCount || 0;
        }
      }

      const now = new Date();
      const monthLabel = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
      const bonusNote = starBonusAmount > 0
        ? ` + thưởng sao ${starBonusAmount.toLocaleString('vi-VN')}đ (${starBonusMonthKeys.join(', ')})`
        : '';
      const defaultDesc = paidCount > 0
        ? `Thù lao ${paidCount} buổi dạy${bonusNote}`
        : `Thưởng sao giảng viên${bonusNote}`;

      const [transaction] = await Transaction.create([{
        teacherId: req.params.id,
        teacherName: teacher.name,
        teacherPhone: teacher.phone || '',
        amount: Number(amount),
        description: note || defaultDesc,
        month: monthLabel,
        status: 'confirmed',
        confirmedBy: req.user?.name || 'Admin',
        confirmedAt: now,
        bankName: teacher.bankAccount?.bankName || '',
        bankAccount: teacher.bankAccount?.accountNumber || '',
        note: note || '',
        starBonusAmount,
        starBonusMonths: starBonusMonthKeys,
        ...(idempotencyKey ? { idempotencyKey } : {}),
      }], { session });

      await postSalary({
        teacher,
        amount: Number(amount),
        transaction,
        branchId: teacher.branchId || null,
        idempotencyKey: `salary:tx:${transaction._id}`,
        sourceRef: `tx:${transaction._id}`,
        actor,
        note: note || defaultDesc,
        metadata: {
          sessionsCount: paidCount,
          sessionIds: sessionIds.map(String),
          starBonusAmount,
          starBonusMonths: starBonusMonthKeys,
        },
        session,
      });

      if (starBonusMonthKeys.length > 0) {
        await Teacher.findByIdAndUpdate(
          req.params.id,
          { $addToSet: { starBonusPaidMonths: { $each: starBonusMonthKeys } } },
          { session }
        );
      }

      return {
        idempotent: false,
        paidSessions: paidCount,
        markedSessions: actualCount,
        totalAmount: Number(amount),
        starBonusAmount,
        starBonusMonths: starBonusMonthKeys,
        transaction,
      };
    });
  } catch (createErr) {
    if (createErr?.code === 11000 && idempotencyKey) {
      const existing = await Transaction.findOne({ idempotencyKey }).lean();
      if (existing) {
        return {
          idempotent: true,
          paidSessions: paidCount,
          markedSessions: 0,
          totalAmount: existing.amount,
          starBonusAmount: existing.starBonusAmount || 0,
          starBonusMonths: existing.starBonusMonths || [],
          transaction: existing,
        };
      }
    }
    throw createErr;
  }
}

module.exports = { payTeacherFlexibleCqrs };
