/**
 * Chặn STAFF thao tác user (HV/GV) thuộc chi nhánh khác.
 * Đọc target từ req.body.userId + req.body.userRole (hoặc opts).
 * Super Admin / không có userBranchId → bỏ qua.
 */
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');

function getTargetFromReq(req, opts = {}) {
  const userId = opts.userId || req.body?.userId || req.params?.id;
  const userRole = opts.userRole || req.body?.userRole || opts.defaultRole || 'student';
  return { userId, userRole: userRole === 'teacher' ? 'teacher' : 'student' };
}

async function assertTargetUserBranchAccess(req, res, next) {
  if (!req.userBranchId) return next();

  try {
    const { userId, userRole } = getTargetFromReq(req);
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Thiếu userId' });
    }

    const Model = userRole === 'teacher' ? Teacher : Student;
    const doc = await Model.findById(userId).select('branchId').lean();
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: userRole === 'teacher' ? 'Không tìm thấy giảng viên' : 'Không tìm thấy học viên',
      });
    }

    const targetBranch = doc.branchId ? String(doc.branchId) : null;
    if (targetBranch && targetBranch !== String(req.userBranchId)) {
      return res.status(403).json({
        success: false,
        message: 'Không có quyền thao tác tài khoản chi nhánh khác',
        code: 'BRANCH_SCOPE_DENIED',
      });
    }

    return next();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi kiểm tra chi nhánh' });
  }
}

/**
 * Pure helper — dùng unit test / service.
 * @returns {'allow'|'deny'|'unknown'}
 */
function evaluateBranchAccess({ actorBranchId, targetBranchId, isSuperAdmin }) {
  if (isSuperAdmin) return 'allow';
  if (!actorBranchId) return 'allow';
  if (!targetBranchId) return 'allow'; // legacy null branch — không chặn cứng
  return String(actorBranchId) === String(targetBranchId) ? 'allow' : 'deny';
}

module.exports = {
  assertTargetUserBranchAccess,
  evaluateBranchAccess,
  getTargetFromReq,
};
