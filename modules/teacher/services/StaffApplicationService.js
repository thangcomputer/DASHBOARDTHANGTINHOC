'use strict';
const bcrypt  = require('bcryptjs');
const { teacherRepository } = require('./../repositories');
const Teacher = require('./../models/Teacher'); // Temp for new Teacher
const Branch  = require('./../../branch/models/Branch');

/**
 * staffRoutes.js — Quản lý tài khoản nội bộ (Admin / Staff) CRUD
 * Thêm: validate branchId tồn tại trong Branches, auto-fill branchCode
 */
const guard  = [authMiddleware, authorize(NEW_PERMISSIONS.USER_MANAGE)];
function actorIsRootSuperAdmin(req) {
  return req.currentUser?.id === 'admin';
}
function actorIsSuperAdmin(req) {
  return req.currentUser?.id === 'admin' || req.currentUser?.adminRole === 'SUPER_ADMIN';
}
function actorIsHighAdminOrAbove(req) {
  return actorIsSuperAdmin(req) || req.currentUser?.adminRole === 'HIGH_ADMIN';
}
/** Staff không được gán quyền vượt quá quyền của chính mình. */
async function sanitizeAssignedPermissions(req, permissions) {
  const list = Array.isArray(permissions) ? permissions.map(String) : [];
  if (actorIsSuperAdmin(req)) return list;
  const mine = new Set(req.currentUser?.permissions || []);
  return list.filter((p) => mine.has(p));
}
// ── GET /api/staff ─────────────────────────────────────────────────────────────

class StaffApplicationService {
  async get_root(data) {
  try {
    const staff = await teacherRepository.findMany({ role: { $in: ['admin', 'staff'] } })
      .select('-password -refreshToken').sort({ createdAt: -1 });
    return { _status: 200, _body: ({ success: true, count: staff.length, data: staff });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async post_root(data) {
  try {
    const { name, phone, password, adminRole = 'STAFF', permissions = [], branchId, gender } = data.body;

    if (!name || !phone || !password)
      return { _status: 400, _body: ({ success: false, message: 'Thiếu tên, số điện thoại hoặc mật khẩu' });

    // Tạo tài khoản SUPER_ADMIN chỉ dành cho Admin Super (Hệ thống)
    if (adminRole === 'SUPER_ADMIN' && !actorIsRootSuperAdmin(req)) {
      return { _status: 403, _body: ({
        success: false,
        message: 'Chỉ Admin Super (Hệ thống) mới được phép tạo thêm tài khoản Super Admin.',
      });
    }

    // Tạo HIGH_ADMIN chỉ dành cho SUPER_ADMIN trở lên
    if (adminRole === 'HIGH_ADMIN' && !actorIsSuperAdmin(req)) {
      return { _status: 403, _body: ({
        success: false,
        message: 'Chỉ Super Admin mới được phép tạo tài khoản Admin cấp cao.',
      });
    }

    // Validate branch cho STAFF
    let branchCode = '';
    if (adminRole === 'STAFF') {
      if (!branchId)
        return { _status: 400, _body: ({ success: false, message: 'Nhân viên (STAFF) phải thuộc một chi nhánh. Vui lòng chọn chi nhánh.' });
      const branch = await Branch.findById(branchId);
      if (!branch)
        return { _status: 400, _body: ({ success: false, message: 'Chi nhánh không hợp lệ hoặc không tồn tại.' });
      branchCode = branch.code || '';
    }

    const exists = await teacherRepository.findOne({ phone });
    if (exists)
      return { _status: 409, _body: ({ success: false, message: 'Số điện thoại đã được sử dụng' });

    const safePermissions = (adminRole === 'SUPER_ADMIN')
      ? []
      : await sanitizeAssignedPermissions(req, permissions);

    const resolvedRole = (adminRole === 'SUPER_ADMIN' || adminRole === 'HIGH_ADMIN') ? 'admin' : 'staff';

    const newStaff = await teacherRepository.create({
      name, phone, password,
      role:        resolvedRole,
      adminRole,
      permissions: safePermissions,
      branchId:    (adminRole === 'SUPER_ADMIN' || adminRole === 'HIGH_ADMIN' || adminRole === 'SUPPORT') ? null : (branchId  || null),
      branchCode:  (adminRole === 'SUPER_ADMIN' || adminRole === 'HIGH_ADMIN' || adminRole === 'SUPPORT') ? ''   : branchCode,
      status:    'active',
      gender:    gender || 'male',
      approvedBy: data.currentUser?.name || 'Admin',
      approvedAt: new Date(),
    });

    return { _status: 201, _body: ({
      success: true,
      message: `Đã tạo tài khoản ${adminRole === 'SUPER_ADMIN' ? 'Super Admin' : adminRole === 'HIGH_ADMIN' ? 'Admin cấp cao' : adminRole === 'SUPPORT' ? 'Chuyên viên Hỗ trợ' : 'Nhân viên'}: ${name}`,
      data: { ...newStaff.toObject(), password: undefined },
    });
  } catch (err) {
    if (err.code === 11000) return { _status: 409, _body: ({ success: false, message: 'Số điện thoại đã tồn tại' });
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async put_id(data) {
  try {
    const target = await teacherRepository.findById(data.id).select('adminRole').lean();
    if (!target) return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy tài khoản' });

    // Nếu target là SUPER_ADMIN, chỉ Admin Super (id === admin) mới được sửa
    if (target.adminRole === 'SUPER_ADMIN' && !actorIsRootSuperAdmin(req)) {
      return { _status: 403, _body: ({
        success: false,
        message: 'Chỉ Admin Super mới được chỉnh sửa tài khoản Super Admin.',
      });
    }

    // Nếu target là HIGH_ADMIN, chỉ SUPER_ADMIN trở lên mới được sửa
    if (target.adminRole === 'HIGH_ADMIN' && !actorIsSuperAdmin(req)) {
      return { _status: 403, _body: ({
        success: false,
        message: 'Chỉ Super Admin mới được chỉnh sửa tài khoản Admin cấp cao.',
      });
    }

    const { name, phone, adminRole, permissions = [], status, password, branchId, gender } = data.body;
    const updates = {};

    if (name)   updates.name   = name;
    if (status) updates.status = status;
    if (gender) updates.gender = gender;

    if (phone && phone !== target.phone) {
      if (!actorIsRootSuperAdmin(req)) {
        return { _status: 403, _body: ({ success: false, message: 'Chỉ Admin hệ thống mới được đổi số điện thoại (tài khoản đăng nhập).' });
      }
      const exists = await teacherRepository.findOne({ phone, _id: { $ne: target._id } });
      if (exists) {
        return { _status: 409, _body: ({ success: false, message: 'Số điện thoại đã được sử dụng bởi người khác.' });
      }
      updates.phone = phone;
    }

    if (adminRole) {
      // Đổi vai trò sang SUPER_ADMIN hoặc từ SUPER_ADMIN xuống STAFF: chỉ dành cho Root Admin
      const isRoleChanging = target.adminRole !== adminRole;
      if (isRoleChanging && !actorIsRootSuperAdmin(req)) {
        return { _status: 403, _body: ({
          success: false,
          message: 'Chỉ Admin Super mới có quyền thăng/hạ quyền Admin Cấp Cao.',
        });
      }

      updates.adminRole = adminRole;
      if (adminRole === 'SUPER_ADMIN') {
        updates.role        = 'admin';
        updates.permissions = [];
        updates.branchId    = null;
        updates.branchCode  = '';
      } else if (adminRole === 'HIGH_ADMIN') {
        updates.role        = 'admin';
        updates.permissions = await sanitizeAssignedPermissions(req, permissions);
        updates.branchId    = null;
        updates.branchCode  = '';
      } else if (adminRole === 'SUPPORT') {
        updates.role        = 'staff';
        updates.permissions = await sanitizeAssignedPermissions(req, permissions);
        updates.branchId    = null;
        updates.branchCode  = '';
      } else {
        updates.role        = 'staff';
        updates.permissions = await sanitizeAssignedPermissions(req, permissions);
        if (branchId) {
          const branch = await Branch.findById(branchId);
          if (!branch)
            return { _status: 400, _body: ({ success: false, message: 'Chi nhánh không hợp lệ' });
          updates.branchId   = branchId;
          updates.branchCode = branch.code || '';
        } else if (branchId === null || branchId === '') {
          updates.branchId   = null;
          updates.branchCode = '';
        }
      }
    } else if (target.adminRole === 'STAFF' || target.adminRole === 'HIGH_ADMIN') {
      if (permissions) updates.permissions = await sanitizeAssignedPermissions(req, permissions);
      if (branchId) {
        const branch = await Branch.findById(branchId);
        if (branch) {
          updates.branchId   = branchId;
          updates.branchCode = branch.code || '';
        }
      }
    }

    if (password && password.length >= 6)
      updates.password = await bcrypt.hash(password, 10);

    const updated = await teacherRepository.updateById(data.id, updates, {
      returnDocument: 'after', runValidators: false,
    }).select('-password -refreshToken');

    if (!updated) return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy tài khoản' });
    return { _status: 200, _body: ({ success: true, message: 'Đã cập nhật phân quyền', data: updated });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async delete_id(data) {
  try {
    if (data.id === data.currentUser.id)
      return { _status: 400, _body: ({ success: false, message: 'Không thể tự xóa chính mình' });

    const target = await teacherRepository.findById(data.id).select('adminRole').lean();
    if (!target) return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy tài khoản' });

    // Chỉ Admin Super mới được xóa SUPER_ADMIN. Chỉ SUPER_ADMIN trở lên mới xóa HIGH_ADMIN.
    if (target.adminRole === 'SUPER_ADMIN' && !actorIsRootSuperAdmin(req)) {
      return { _status: 403, _body: ({
        success: false,
        message: 'Chỉ Admin Super mới được xóa tài khoản Super Admin.',
      });
    }
    if (target.adminRole === 'HIGH_ADMIN' && !actorIsSuperAdmin(req)) {
      return { _status: 403, _body: ({
        success: false,
        message: 'Chỉ Super Admin mới được xóa tài khoản Admin cấp cao.',
      });
    }

    await teacherRepository.deleteById(data.id);
    return { _status: 200, _body: ({ success: true, message: 'Đã xóa tài khoản' });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

}

module.exports = new StaffApplicationService();
