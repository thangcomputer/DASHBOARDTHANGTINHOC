/**
 * Branch scope helpers (Phase 4) — chống cross-branch leak.
 * Dùng sau authMiddleware + branchFilter (để có req.userBranchId).
 */
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');

function isGlobalBranchActor(req) {
  return !req?.userBranchId;
}

function isCrossBranch(actorBranchId, targetBranchId) {
  if (!actorBranchId) return false;
  if (targetBranchId == null || targetBranchId === '') return false;
  return String(actorBranchId) !== String(targetBranchId);
}

function respondCrossBranch(res, message) {
  return res.status(403).json({
    success: false,
    message: message || 'Không có quyền thao tác dữ liệu chi nhánh khác',
    code: 'BRANCH_SCOPE_DENIED',
  });
}

async function getStudentBranchId(studentId) {
  if (!studentId) return null;
  const s = await Student.findById(studentId).select('branchId').lean();
  return s?.branchId || null;
}

async function getTeacherBranchId(teacherId) {
  if (!teacherId) return null;
  const t = await Teacher.findById(teacherId).select('branchId').lean();
  return t?.branchId || null;
}

/** @returns {boolean} true nếu được phép tiếp tục */
async function assertBranchMatch(req, res, targetBranchId) {
  if (!isCrossBranch(req.userBranchId, targetBranchId)) return true;
  respondCrossBranch(res);
  return false;
}

async function assertStudentBranch(req, res, studentId) {
  if (isGlobalBranchActor(req)) return true;
  const branchId = await getStudentBranchId(studentId);
  return assertBranchMatch(req, res, branchId);
}

async function assertTeacherBranch(req, res, teacherId) {
  if (isGlobalBranchActor(req)) return true;
  const branchId = await getTeacherBranchId(teacherId);
  return assertBranchMatch(req, res, branchId);
}

/** Danh sách studentId (string) thuộc chi nhánh actor — null = không giới hạn */
async function listStudentIdsInActorBranch(req) {
  if (!req.userBranchId) return null;
  const rows = await Student.find({ branchId: req.userBranchId }).select('_id').lean();
  return rows.map((r) => String(r._id));
}

async function listTeacherIdsInActorBranch(req) {
  if (!req.userBranchId) return null;
  const rows = await Teacher.find({ branchId: req.userBranchId }).select('_id').lean();
  return rows.map((r) => String(r._id));
}

/**
 * Filter ExamResult theo chi nhánh (studentId/teacherId lưu string).
 * @returns {object|null} thêm vào filter; null = không thêm
 */
async function examResultBranchClause(req) {
  if (!req.userBranchId) return null;
  const [sIds, tIds] = await Promise.all([
    listStudentIdsInActorBranch(req),
    listTeacherIdsInActorBranch(req),
  ]);
  return {
    $or: [
      { studentId: { $in: sIds || [] } },
      { teacherId: { $in: tIds || [] } },
    ],
  };
}

module.exports = {
  isGlobalBranchActor,
  isCrossBranch,
  respondCrossBranch,
  getStudentBranchId,
  getTeacherBranchId,
  assertBranchMatch,
  assertStudentBranch,
  assertTeacherBranch,
  listStudentIdsInActorBranch,
  listTeacherIdsInActorBranch,
  examResultBranchClause,
};
