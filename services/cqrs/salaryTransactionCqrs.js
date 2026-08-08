'use strict';

const Transaction = require('../../models/Transaction');
const Teacher = require('../../models/Teacher');
const LedgerEntry = require('../../models/LedgerEntry');
const { withTransaction } = require('../../shared/cqrs/withTransaction');
const { requireReplicaOrThrow } = require('../../shared/cqrs/flags');
const { postSalary, voidLedgerEntry } = require('../ledgerService');

/**
 * Confirm salary voucher + post salary ledger atomically.
 */
async function confirmTransactionCqrs(req) {
  requireReplicaOrThrow();
  const { confirmedBy = 'Admin' } = req.body || {};
  const actor = {
    id: req.user?.id || '',
    role: req.user?.role || 'admin',
    name: confirmedBy,
  };

  return withTransaction(async (session) => {
    const claimed = await Transaction.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: 'confirmed' } },
      {
        $set: {
          status: 'confirmed',
          confirmedBy,
          confirmedAt: new Date(),
        },
      },
      { returnDocument: 'after', session }
    ).populate('teacherId', 'name phone branchId');

    if (!claimed) {
      const existing = await Transaction.findById(req.params.id).session(session);
      if (!existing) {
        const err = new Error('Không tìm thấy giao dịch');
        err.status = 404;
        throw err;
      }
      if (existing.status === 'confirmed') {
        return { transaction: existing, alreadyConfirmed: true };
      }
      const err = new Error('Không thể xác nhận giao dịch');
      err.status = 409;
      throw err;
    }

    const teacherDoc = claimed.teacherId?._id
      ? claimed.teacherId
      : await Teacher.findById(claimed.teacherId).session(session).lean();

    await postSalary({
      teacher: teacherDoc,
      amount: claimed.amount,
      transaction: claimed,
      branchId: teacherDoc?.branchId || claimed.branchId || null,
      idempotencyKey: `salary:tx:${claimed._id}`,
      sourceRef: `tx:${claimed._id}`,
      actor,
      note: claimed.description || `Chi lương ${claimed.month || ''}`,
      session,
    });

    return { transaction: claimed, alreadyConfirmed: false };
  });
}

/**
 * Cancel voucher; if was confirmed, void salary ledger in same TX (fail-closed).
 */
async function cancelTransactionCqrs(req) {
  requireReplicaOrThrow();
  const actor = {
    id: req.user?.id || '',
    role: req.user?.role || 'admin',
  };

  return withTransaction(async (session) => {
    const prev = await Transaction.findById(req.params.id).session(session);
    if (!prev) {
      const err = new Error('Không tìm thấy giao dịch');
      err.status = 404;
      throw err;
    }
    if (prev.status === 'cancelled') {
      return { transaction: prev, alreadyCancelled: true };
    }

    if (prev.status === 'confirmed') {
      const salaryEntry = await LedgerEntry.findOne({
        type: 'salary',
        status: 'posted',
        $or: [
          { sourceRef: `tx:${prev._id}` },
          { idempotencyKey: `salary:tx:${prev._id}` },
          { 'metadata.transactionId': String(prev._id) },
        ],
      }).session(session);

      if (salaryEntry) {
        await voidLedgerEntry({
          entryId: salaryEntry._id,
          reason: `Hủy phiếu chi ${prev._id}`,
          actor,
          createReversal: true,
          session,
        });
      }
    }

    prev.status = 'cancelled';
    await prev.save({ session });
    return { transaction: prev, alreadyCancelled: false };
  });
}

/**
 * Void ledger entry (+ reversal) in one TX.
 */
async function voidLedgerCqrs(req) {
  requireReplicaOrThrow();
  return withTransaction(async (session) => voidLedgerEntry({
    entryId: req.params.id,
    reason: req.body?.reason || '',
    actor: {
      id: req.user?.id || req.user?._id || '',
      name: req.user?.name || '',
      role: req.user?.role || '',
    },
    createReversal: req.body?.createReversal !== false,
    session,
  }));
}

module.exports = {
  confirmTransactionCqrs,
  cancelTransactionCqrs,
  voidLedgerCqrs,
};
