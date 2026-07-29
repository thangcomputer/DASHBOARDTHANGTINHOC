/**
 * RBAC guards — Phase 3 harden cho thao tác nhạy cảm.
 */
const { userHasPermission } = require('./auth');
const { provisionPermissionForTarget } = require('../constants/rbacMatrix');

/** Chỉ Admin/Staff nội bộ (chặn teacher/student). */
function requireStaffOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Chưa xác thực', code: 'UNAUTHENTICATED' });
  }
  if (req.user.role !== 'admin' && req.user.role !== 'staff') {
    return res.status(403).json({
      success: false,
      message: '403 Forbidden: Yêu cầu quyền Admin/Staff',
      code: 'ROLE_DENIED',
    });
  }
  return next();
}

/**
 * Cấp mật khẩu / OTP: Staff cần perm theo đối tượng (HV → manage_students, GV → view_teachers).
 * Super Admin / hardcoded admin: pass qua userHasPermission.
 */
async function assertProvisionAccess(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Chưa xác thực', code: 'UNAUTHENTICATED' });
    }
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({
        success: false,
        message: '403 Forbidden: Yêu cầu quyền Admin/Staff',
        code: 'ROLE_DENIED',
      });
    }

    const userRole = req.body?.userRole === 'teacher' ? 'teacher' : 'student';
    const needed = provisionPermissionForTarget(userRole);
    const ok = await userHasPermission(req.user, needed);
    if (!ok) {
      return res.status(403).json({
        success: false,
        message: '403 Forbidden: Bạn không có quyền cấp mật khẩu cho đối tượng này',
        code: 'PERMISSION_DENIED',
        required: needed,
      });
    }
    return next();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi kiểm tra quyền' });
  }
}

module.exports = {
  requireStaffOrAdmin,
  assertProvisionAccess,
};
