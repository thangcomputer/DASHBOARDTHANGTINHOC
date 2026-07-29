/**
 * displayCodeService — cấp số atomic + gắn mã (ADR 0002).
 */
const BranchCodeCounter = require('../models/BranchCodeCounter');
const {
  formatDisplayCode,
  formatEnrollmentCode,
  courseTokenFromName,
  rolePrefixForTeacherDoc,
  ROLE_PREFIX,
  parseDisplayCode,
} = require('../utils/displayCode');

/**
 * Tăng sequence và trả display code mới.
 * @param {'HV'|'GV'|'AD'|'ST'} rolePrefix
 * @param {{ _id: any, code: string }} branch
 */
async function allocateDisplayCode(rolePrefix, branch) {
  if (!branch || !branch._id || !branch.code) {
    throw new Error('allocateDisplayCode: branch {_id, code} là bắt buộc');
  }
  const prefix = String(rolePrefix || '').toUpperCase();
  const doc = await BranchCodeCounter.findOneAndUpdate(
    { rolePrefix: prefix, branchId: branch._id },
    {
      $inc: { seq: 1 },
      $setOnInsert: { branchCode: String(branch.code).toUpperCase() },
      $set: { branchCode: String(branch.code).toUpperCase() },
    },
    { upsert: true, new: true }
  );
  return formatDisplayCode(prefix, doc.seq, branch.code);
}

async function allocateStudentDisplayCode(branch) {
  return allocateDisplayCode(ROLE_PREFIX.student, branch);
}

async function allocateTeacherDisplayCode(teacher, branch) {
  return allocateDisplayCode(rolePrefixForTeacherDoc(teacher), branch);
}

function buildEnrollmentCode(displayCode, courseNameOrSlug) {
  return formatEnrollmentCode(displayCode, courseNameOrSlug);
}

/**
 * Đảm bảo counter không thấp hơn seq đã thấy (khi backfill mã cũ).
 */
async function ensureCounterAtLeast(rolePrefix, branch, minSeq) {
  if (!branch?._id || !minSeq) return;
  const prefix = String(rolePrefix).toUpperCase();
  const branchCode = String(branch.code || '').toUpperCase();
  const existing = await BranchCodeCounter.findOne({ rolePrefix: prefix, branchId: branch._id });
  if (!existing) {
    await BranchCodeCounter.create({
      rolePrefix: prefix,
      branchId: branch._id,
      branchCode,
      seq: minSeq,
    });
    return;
  }
  if (existing.seq < minSeq) {
    existing.seq = minSeq;
    existing.branchCode = branchCode || existing.branchCode;
    await existing.save();
  }
}

module.exports = {
  allocateDisplayCode,
  allocateStudentDisplayCode,
  allocateTeacherDisplayCode,
  buildEnrollmentCode,
  courseTokenFromName,
  ensureCounterAtLeast,
  parseDisplayCode,
  ROLE_PREFIX,
};
