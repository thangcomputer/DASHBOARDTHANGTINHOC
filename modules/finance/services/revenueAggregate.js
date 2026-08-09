/**
 * Enrollment revenue helpers — projection / legacy.
 * Migrated to Repository Pattern (Batch 3).
 */
const { analyticsRepository } = require('../../analytics/repositories');
const { isLedgerSot } = require('../../../utils/financeFlags');
const logger = require('../../../config/logger');
const mongoose = require('mongoose');

let _warnedDeprecation = false;
function warnIfLegacyKpi(caller) {
  if (!isLedgerSot() || _warnedDeprecation) return;
  _warnedDeprecation = true;
  logger.warn(
    '[revenueAggregate] DEPRECATED for KPI SoT (caller=%s). Use ledgerService.sumFinancialRevenue. Set FINANCE_LEDGER_SOT=false to silence.',
    caller || 'unknown'
  );
}

function toObjectIdMaybe(value) {
  if (!value) return value;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === 'string' && mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return value;
}

function normalizeBranchMatch(branchFilter = {}) {
  const match = { ...branchFilter };
  if (match.branchId) match.branchId = toObjectIdMaybe(match.branchId);
  return match;
}

async function sumPaidRevenue({ branchFilter = {}, start, end } = {}) {
  warnIfLegacyKpi('sumPaidRevenue');
  const match = normalizeBranchMatch(branchFilter);
  return analyticsRepository.sumPaidRevenue({ branchFilter: match, start, end });
}

async function listPaidItems({ branchFilter = {}, start, end } = {}) {
  const match = normalizeBranchMatch(branchFilter);
  return analyticsRepository.listPaidItems({ branchFilter: match, start, end });
}

async function revenueByCourse({ branchFilter = {}, start, end, limit = 8 } = {}) {
  const match = normalizeBranchMatch(branchFilter);
  return analyticsRepository.revenueByCourse({ branchFilter: match, start, end, limit });
}

async function revenueByBranch({ branchFilter = {}, start, end } = {}) {
  const match = normalizeBranchMatch(branchFilter);
  return analyticsRepository.revenueByBranch({ branchFilter: match, start, end });
}

function sumStudentPaidTuition(student) {
  if (!student) return 0;
  const enrollments = Array.isArray(student.enrollments) ? student.enrollments : [];
  if (enrollments.length > 0) {
    return enrollments
      .filter((e) => e && e.paid === true)
      .reduce((s, e) => s + (Number(e.price) || 0), 0);
  }
  if (!student.paid) return 0;
  const paidAmount = Number(student.paidAmount) || 0;
  if (paidAmount > 0) return paidAmount;
  return Number(student.price) || 0;
}

module.exports = {
  sumPaidRevenue,
  listPaidItems,
  revenueByCourse,
  revenueByBranch,
  sumStudentPaidTuition,
  normalizeBranchMatch,
};
