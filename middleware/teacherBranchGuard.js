/**
 * Chặn STAFF thao tác giảng viên thuộc chi nhánh khác (sau branchFilter).
 * Yêu cầu route có param :id là teacherId.
 * Trusted scope: req.userBranchId từ JWT/DB — không tin branchId client.
 */
const Teacher = require('../models/Teacher');

const assertTeacherBranchAccess = async (req, res, next) => {
  if (!req.userBranchId) return next();

  try {
    const teacher = await Teacher.findById(req.params.id).select('branchId').lean();
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giảng viên' });
    }

    const teacherBranch = teacher.branchId ? String(teacher.branchId) : null;
    if (teacherBranch && teacherBranch !== String(req.userBranchId)) {
      return res.status(403).json({
        success: false,
        message: 'Không có quyền thao tác giảng viên chi nhánh khác',
      });
    }

    next();
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi kiểm tra chi nhánh giảng viên' });
  }
};

module.exports = { assertTeacherBranchAccess };
