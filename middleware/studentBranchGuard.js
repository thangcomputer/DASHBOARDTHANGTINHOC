/**
 * Chặn STAFF thao tác học viên thuộc chi nhánh khác (sau branchFilter).
 * Yêu cầu route có param :id là studentId.
 */
const Student = require('../models/Student');

const assertStudentBranchAccess = async (req, res, next) => {
  if (!req.userBranchId) return next();

  try {
    const student = await Student.findById(req.params.id).select('branchId').lean();
    if (!student) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học viên' });
    }

    const studentBranch = student.branchId ? String(student.branchId) : null;
    if (studentBranch && studentBranch !== String(req.userBranchId)) {
      return res.status(403).json({
        success: false,
        message: 'Không có quyền thao tác học viên chi nhánh khác',
      });
    }

    next();
  } catch {
    res.status(500).json({ success: false, message: 'Lỗi kiểm tra chi nhánh' });
  }
};

module.exports = { assertStudentBranchAccess };
