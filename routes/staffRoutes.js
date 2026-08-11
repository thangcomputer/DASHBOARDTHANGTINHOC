/**
 * staffRoutes.js — Quản lý tài khoản nội bộ (Admin / Staff) CRUD
 * Thêm: validate branchId tồn tại trong Branches, auto-fill branchCode
 */
const express = require('express');
const bcrypt  = require('bcryptjs');
const Teacher = require('../models/Teacher');
const Branch  = require('../models/Branch');
const { authMiddleware } = require('../middleware/auth');
const { policyShadowStaff } = require('../middleware/policyShadowStaff');
const { staffCutoverGate } = require('../middleware/staffCutoverGate');
const { HIGH_ADMIN_DEFAULT_PERMISSIONS, SUPPORT_DEFAULT_PERMISSIONS } = require('../constants/permissions');
const { generateTeacherCode } = require('../services/businessCodeService');

const router = express.Router();
/**
 * Phase 7.28 — Controlled cutover for LIVE /api/staff ONLY.
 *
 * Flow: auth → policyShadowStaff → staffCutoverGate → handler
 * Legacy manage_staff permission gate retained inside staffCutoverGate.
 * SUPER/HIGH create/update/delete messages remain handler-owned on Legacy;
 * Policy mirrors those gates when primary. Mutations stay handler-owned.
 */
const guard = (action) => [
  authMiddleware,
  policyShadowStaff(action),
  staffCutoverGate(action),
];

function actorIsRootSuperAdmin(req) {
  return req.user?.id === 'admin';
}

function actorIsSuperAdmin(req) {
  return req.user?.id === 'admin' || req.user?.adminRole === 'SUPER_ADMIN';
}

function actorIsHighAdminOrAbove(req) {
  return actorIsSuperAdmin(req) || req.user?.adminRole === 'HIGH_ADMIN';
}

/** Staff không được gán quyền vượt quá quyền của chính mình. */
async function sanitizeAssignedPermissions(req, permissions) {
  const list = Array.isArray(permissions) ? permissions.map(String) : [];
  if (actorIsSuperAdmin(req)) return list;
  const mine = new Set(req.user?.permissions || []);
  return list.filter((p) => mine.has(p));
}

// ── GET /api/staff ─────────────────────────────────────────────────────────────
router.get('/', guard('list'), async (req, res) => {
  try {
    const staff = await Teacher.find({ role: { $in: ['admin', 'staff'] } })
      .select('-password -refreshToken').sort({ createdAt: -1 });
    return res.json({ success: true, count: staff.length, data: staff });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/staff ────────────────────────────────────────────────────────────
router.post('/', guard('create'), async (req, res) => {
  try {
    const { name, phone, password, adminRole = 'STAFF', permissions = [], branchId, gender } = req.body;

    if (!name || !phone || !password)
      return res.status(400).json({ success: false, message: 'Thiếu tên, số điện thoại hoặc mật khẩu' });

    // Không cho tạo thêm Super Admin qua API (chỉ tài khoản hệ thống id=admin)
    if (adminRole === 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Không được tạo thêm tài khoản Super Admin. Hãy tạo Admin cấp cao.',
      });
    }

    // Tạo HIGH_ADMIN chỉ dành cho SUPER_ADMIN trở lên
    if (adminRole === 'HIGH_ADMIN' && !actorIsSuperAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Super Admin mới được phép tạo tài khoản Admin cấp cao.',
      });
    }

    // Validate branch cho STAFF
    let branchCode = '';
    if (adminRole === 'STAFF') {
      if (!branchId)
        return res.status(400).json({ success: false, message: 'Nhân viên (STAFF) phải thuộc một chi nhánh. Vui lòng chọn chi nhánh.' });
      const branch = await Branch.findById(branchId);
      if (!branch)
        return res.status(400).json({ success: false, message: 'Chi nhánh không hợp lệ hoặc không tồn tại.' });
      branchCode = branch.code || '';
    }

    const exists = await Teacher.findOne({ phone });
    if (exists)
      return res.status(409).json({ success: false, message: 'Số điện thoại đã được sử dụng' });

    let safePermissions = (adminRole === 'SUPER_ADMIN')
      ? []
      : await sanitizeAssignedPermissions(req, permissions);
    if (adminRole === 'HIGH_ADMIN' && !safePermissions.length) {
      safePermissions = [...HIGH_ADMIN_DEFAULT_PERMISSIONS];
    }
    if (adminRole === 'SUPPORT' && !safePermissions.length) {
      safePermissions = [...SUPPORT_DEFAULT_PERMISSIONS];
    }

    const resolvedRole = (adminRole === 'SUPER_ADMIN' || adminRole === 'HIGH_ADMIN') ? 'admin' : 'staff';

    const newStaff = await Teacher.create({
      name, phone, password,
      role:        resolvedRole,
      adminRole,
      permissions: safePermissions,
      branchId:    (adminRole === 'SUPER_ADMIN' || adminRole === 'HIGH_ADMIN' || adminRole === 'SUPPORT') ? null : (branchId  || null),
      branchCode:  (adminRole === 'SUPER_ADMIN' || adminRole === 'HIGH_ADMIN' || adminRole === 'SUPPORT') ? ''   : branchCode,
      status:    'active',
      gender:    gender || 'male',
      approvedBy: req.user?.name || 'Admin',
      approvedAt: new Date(),
      teacherCode: await generateTeacherCode(),
    });

    return res.status(201).json({
      success: true,
      message: `Đã tạo tài khoản ${adminRole === 'SUPER_ADMIN' ? 'Super Admin' : adminRole === 'HIGH_ADMIN' ? 'Admin cấp cao' : adminRole === 'SUPPORT' ? 'Chuyên viên Hỗ trợ' : 'Nhân viên'}: ${name}`,
      data: { ...newStaff.toObject(), password: undefined },
    });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'Số điện thoại đã tồn tại' });
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/staff/:id ─────────────────────────────────────────────────────────
router.put('/:id', guard('update'), async (req, res) => {
  try {
    const target = await Teacher.findById(req.params.id).select('adminRole').lean();
    if (!target) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });

    // Nếu target là SUPER_ADMIN, chỉ Admin Super (id === admin) mới được sửa
    if (target.adminRole === 'SUPER_ADMIN' && !actorIsRootSuperAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Admin Super mới được chỉnh sửa tài khoản Super Admin.',
      });
    }

    // Nếu target là HIGH_ADMIN, chỉ SUPER_ADMIN trở lên mới được sửa
    if (target.adminRole === 'HIGH_ADMIN' && !actorIsSuperAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Super Admin mới được chỉnh sửa tài khoản Admin cấp cao.',
      });
    }

    const { name, adminRole, permissions = [], status, password, branchId, gender, phone } = req.body;
    const updates = {};

    if (name)   updates.name   = name;
    if (status) updates.status = status;
    if (gender) updates.gender = gender;

    // SUPER_ADMIN/root can update phone for any staff account (HIGH/SUPPORT/STAFF/SUPER).
    // Non-SUPER requests are ignored to keep legacy behavior.
    if (actorIsSuperAdmin(req) && phone != null) {
      const nextPhone = String(phone).trim();
      if (nextPhone) {
        const exists = await Teacher.findOne({
          phone: nextPhone,
          _id: { $ne: req.params.id },
        }).select('_id').lean();
        if (exists) {
          return res.status(409).json({ success: false, message: 'Số điện thoại đã được sử dụng' });
        }
        updates.phone = nextPhone;
      }
    }

    if (adminRole) {
      // Đổi vai trò sang SUPER_ADMIN hoặc từ SUPER_ADMIN xuống STAFF: chỉ dành cho Root Admin
      const isRoleChanging = target.adminRole !== adminRole;
      if (adminRole === 'SUPER_ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Không được gán vai trò Super Admin. Hãy dùng Admin cấp cao.',
        });
      }
      if (isRoleChanging && !actorIsRootSuperAdmin(req)) {
        return res.status(403).json({
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
        const perms = await sanitizeAssignedPermissions(req, permissions);
        updates.permissions = perms.length ? perms : [...HIGH_ADMIN_DEFAULT_PERMISSIONS];
        updates.branchId    = null;
        updates.branchCode  = '';
      } else if (adminRole === 'SUPPORT') {
        updates.role        = 'staff';
        const perms = await sanitizeAssignedPermissions(req, permissions);
        updates.permissions = perms.length ? perms : [...SUPPORT_DEFAULT_PERMISSIONS];
        updates.branchId    = null;
        updates.branchCode  = '';
      } else {
        updates.role        = 'staff';
        updates.permissions = await sanitizeAssignedPermissions(req, permissions);
        if (branchId) {
          const branch = await Branch.findById(branchId);
          if (!branch)
            return res.status(400).json({ success: false, message: 'Chi nhánh không hợp lệ' });
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

    const updated = await Teacher.findByIdAndUpdate(req.params.id, updates, {
      returnDocument: 'after', runValidators: false,
    }).select('-password -refreshToken');

    if (!updated) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
    return res.json({ success: true, message: 'Đã cập nhật phân quyền', data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/staff/:id ──────────────────────────────────────────────────────
router.delete('/:id', guard('delete'), async (req, res) => {
  try {
    if (req.params.id === req.user.id)
      return res.status(400).json({ success: false, message: 'Không thể tự xóa chính mình' });

    const target = await Teacher.findById(req.params.id).select('adminRole').lean();
    if (!target) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });

    // Chỉ Admin Super mới được xóa SUPER_ADMIN. Chỉ SUPER_ADMIN trở lên mới xóa HIGH_ADMIN.
    if (target.adminRole === 'SUPER_ADMIN' && !actorIsRootSuperAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Admin Super mới được xóa tài khoản Super Admin.',
      });
    }
    if (target.adminRole === 'HIGH_ADMIN' && !actorIsSuperAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Super Admin mới được xóa tài khoản Admin cấp cao.',
      });
    }

    await Teacher.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Đã xóa tài khoản' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
