const jwt       = require('jsonwebtoken');
const Teacher   = require('../models/Teacher');
const Student   = require('../models/Student');
const blacklist = require('./tokenBlacklist');
const logger = require('../config/logger');

// ── authMiddleware: Xác thực JWT + Token Blacklist + Token Version ─────────────
const authMiddleware = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Không có token, truy cập bị từ chối',
    });
  }

  // ⭐ Fix 3: Kiểm tra Token Blacklist (token đã bị đăng xuất)
  if (await blacklist.isBlacklisted(token)) {
    return res.status(401).json({
      success: false,
      code: 'TOKEN_REVOKED',
      message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.accessToken = token; // Lưu token gốc để dùng khi logout
    req.tokenAudience = decoded.aud || 'legacy'; // 'public' | 'internal' | 'legacy'

    // ⭐ Fix 1: Kiểm tra tokenVersion + trạng thái tài khoản (khóa/vô hiệu)
    // Chỉ áp dụng cho user có ID thực (không phải hardcoded admin)
    if (decoded.id && decoded.id !== 'admin') {
      let dbUser = null;
      if (decoded.role === 'student') {
        dbUser = await Student.findById(decoded.id).select('tokenVersion status').lean();
      } else {
        dbUser = await Teacher.findById(decoded.id).select('tokenVersion status role permissions adminRole createdAt branchId').lean();
      }

      if (dbUser) {
        req.user.permissions = dbUser.permissions || decoded.permissions || [];
        req.user.adminRole = dbUser.adminRole || decoded.adminRole;
        if (dbUser.createdAt) req.user.createdAt = dbUser.createdAt;
        if (dbUser.branchId) req.user.branchId = dbUser.branchId;
      }

      if (!dbUser) {
        return res.status(401).json({
          success: false,
          code: 'USER_NOT_FOUND',
          message: 'Tài khoản không còn tồn tại. Vui lòng đăng nhập lại.',
        });
      }

      if (dbUser.tokenVersion !== undefined && decoded.tokenVersion !== undefined
          && dbUser.tokenVersion !== decoded.tokenVersion) {
        return res.status(401).json({
          success: false,
          code: 'TOKEN_VERSION_MISMATCH',
          message: 'Tài khoản đã đăng nhập ở thiết bị khác. Phiên này đã bị vô hiệu.',
        });
      }

      const sStatus = String(dbUser.status || '').toLowerCase();
      if (decoded.role === 'teacher' || decoded.role === 'student') {
        if (sStatus === 'suspended' || sStatus === 'inactive') {
          return res.status(403).json({
            success: false,
            code: 'ACCOUNT_DISABLED',
            isBan: true,
            message: sStatus === 'inactive'
              ? 'Tài khoản chưa được cấp quyền đăng nhập.'
              : 'Tài khoản đã bị vô hiệu hóa.',
          });
        }
      }
    }

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Token đã hết hạn. Vui lòng đăng nhập lại.',
      });
    }
    res.status(401).json({
      success: false,
      message: 'Token không hợp lệ hoặc đã hết hạn',
    });
  }
};

// ── isAdmin: Chỉ cho phép role 'admin' ────────────────────────────────────────
const isAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'staff')) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Quyền truy cập bị từ chối: Yêu cầu quyền Admin',
    });
  }
};

// ── isTeacher: Cho phép role 'teacher' hoặc 'admin' ──────────────────────────
const isTeacher = (req, res, next) => {
  if (req.user && (req.user.role === 'teacher' || req.user.role === 'admin' || req.user.role === 'staff')) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Quyền truy cập bị từ chối: Yêu cầu quyền Giảng viên',
    });
  }
};

// ── isSuperAdmin: Chỉ hardcoded admin hoặc SUPER_ADMIN (đọc từ DB) ────────────
const isSuperAdmin = async (req, res, next) => {
  if (req.user && req.user.id === 'admin') {
    return next();
  }
  try {
    if (!req.user?.id) {
      return res.status(403).json({
        success: false,
        message: 'Quyền truy cập bị từ chối: Chỉ Super Admin mới có quyền này',
      });
    }
    const user = await Teacher.findById(req.user.id).select('adminRole').lean();
    if (user?.adminRole === 'SUPER_ADMIN') {
      req.user.adminRole = 'SUPER_ADMIN';
      return next();
    }
  } catch (err) {
    logger.error('[isSuperAdmin] error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi xác thực Super Admin' });
  }
  return res.status(403).json({
    success: false,
    message: 'Quyền truy cập bị từ chối: Chỉ Super Admin mới có quyền này',
  });
};

/**
 * checkPermission(requiredPermission)
 *
 * Middleware factory kiểm tra quyền cụ thể.
 * - Hardcoded admin ('admin'): toàn quyền
 * - SUPER_ADMIN: toàn quyền
 * - STAFF: chỉ được truy cập nếu permissions[] chứa requiredPermission
 *
 * Lưu ý: permissions được fetch từ DB mỗi lần request để đảm bảo
 * phản ánh thay đổi real-time (không stale cache từ JWT)
 */
async function assertStaffPermissions(req, res, matcher) {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Chưa xác thực' });
    return false;
  }

  if (req.user.id === 'admin') return true;

  if (req.user.role !== 'admin' && req.user.role !== 'staff') {
    res.status(403).json({
      success: false,
      message: '403 Forbidden: Yêu cầu quyền Admin/Staff',
    });
    return false;
  }

  const user = await Teacher.findById(req.user.id).select('adminRole permissions role').lean();
  if (!user) {
    res.status(404).json({ success: false, message: 'Tài khoản không tồn tại' });
    return false;
  }

  if (user.adminRole === 'SUPER_ADMIN') {
    req.user.adminRole = 'SUPER_ADMIN';
    req.user.permissions = user.permissions || [];
    return true;
  }

  // HIGH_ADMIN: có quyền rộng nhưng KHÔNG bypass — phải check permissions
  if (user.adminRole === 'HIGH_ADMIN') {
    req.user.adminRole = 'HIGH_ADMIN';
    const perms = Array.isArray(user.permissions) ? user.permissions : [];
    req.user.permissions = perms;
    if (!matcher(perms)) {
      res.status(403).json({
        success: false,
        message: '403 Forbidden: Bạn không có quyền thực hiện thao tác này.',
      });
      return false;
    }
    return true;
  }

  const perms = Array.isArray(user.permissions) ? user.permissions : [];
  if (!matcher(perms)) {
    res.status(403).json({
      success: false,
      message: '403 Forbidden: Bạn không có quyền thực hiện thao tác này. Liên hệ Super Admin để được cấp quyền.',
    });
    return false;
  }

  req.user.adminRole = user.adminRole;
  req.user.permissions = perms;
  return true;
}

/** Kiểm tra quyền STAFF/admin (boolean) — dùng trong handler đa vai trò. */
async function userHasPermission(reqUser, requiredPermission) {
  if (!reqUser) return false;
  if (reqUser.id === 'admin') return true;
  if (reqUser.role !== 'admin' && reqUser.role !== 'staff') return false;
  try {
    const user = await Teacher.findById(reqUser.id).select('adminRole permissions').lean();
    if (!user) return false;
    if (user.adminRole === 'SUPER_ADMIN') return true;
    if (user.adminRole === 'HIGH_ADMIN') {
      return Array.isArray(user.permissions) && user.permissions.includes(requiredPermission);
    }
    return Array.isArray(user.permissions) && user.permissions.includes(requiredPermission);
  } catch {
    return false;
  }
}

const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const ok = await assertStaffPermissions(
        req,
        res,
        (perms) => perms.includes(requiredPermission),
      );
      if (ok) next();
    } catch (err) {
      logger.error('[checkPermission] error:', err);
      return res.status(500).json({ success: false, message: 'Lỗi kiểm tra quyền' });
    }
  };
};

/** STAFF cần ít nhất một trong các quyền (OR). */
const checkAnyPermission = (...requiredPermissions) => {
  const list = requiredPermissions.flat().filter(Boolean);
  return async (req, res, next) => {
    try {
      const ok = await assertStaffPermissions(
        req,
        res,
        (perms) => list.some((p) => perms.includes(p)),
      );
      if (ok) next();
    } catch (err) {
      logger.error('[checkAnyPermission] error:', err);
      return res.status(500).json({ success: false, message: 'Lỗi kiểm tra quyền' });
    }
  };
};

/**
 * branchFilter — Middleware tự động giới hạn dữ liệu theo chi nhánh
 *
 * Gắn req.branchFilter vào request:
 * - SUPER_ADMIN / hardcoded admin: {}  (không lọc → toàn bộ dữ liệu)
 * - STAFF: { branchId: <ID chi nhánh của nhân viên> }
 *
 * Các route dùng: Student.find({ ...req.branchFilter, ... })
 */
// ── branchFilter — Middleware tự động giới hạn dữ liệu theo chi nhánh
// Phase 15–16: Super Admin co the gui X-Tenant-Id / tenant_id de gioi han theo tenant
const branchFilter = async (req, res, next) => {
  try {
    // Hardcoded admin
    if (!req.user || req.user.id === 'admin') {
      const qBranch = req.query.branch_id;
      if (qBranch && qBranch !== 'all' && qBranch !== '') {
        req.branchFilter = { branchId: qBranch };
      } else {
        req.branchFilter = {};
      }
      await applyTenantScopeIfAny(req);
      return next();
    }

    if (req.user.role === 'admin' || req.user.role === 'staff') {
      const user = await Teacher.findById(req.user.id)
        .select('adminRole branchId branchCode')
        .lean();

      if (!user) {
        req.branchFilter = {};
        await applyTenantScopeIfAny(req);
        return next();
      }

      // 🛡️ SECURITY FIX: Chỉ thực sự là SUPER_ADMIN mới được xem toàn bộ.
      // Nếu không có branchId mà cũng KHÔNG phải SUPER_ADMIN, ép về branchId=null (không thấy gì hoặc lỗi)
      const isActuallySuper = user.adminRole === 'SUPER_ADMIN';
      const isHighAdmin = user.adminRole === 'HIGH_ADMIN';
      const isSupport = user.adminRole === 'SUPPORT';

      if (isActuallySuper || isHighAdmin || isSupport || !user.branchId) {
        const qBranch = req.query.branch_id;
        if (qBranch && qBranch !== 'all' && qBranch !== '' && (isActuallySuper || isHighAdmin || isSupport)) {
          req.branchFilter = { branchId: qBranch };
        } else if (isActuallySuper || isHighAdmin || isSupport) {
          req.branchFilter = {};
        } else {
          // Admin nhưng không có branchId và không phải Super/High/Support Admin? Giới hạn về null để an toàn
          req.branchFilter = { branchId: null };
        }
      } else {
        // STAFF / Regular Admin with branch
        req.branchFilter = { branchId: user.branchId };
        req.userBranchId   = user.branchId;
        req.userBranchCode = user.branchCode || '';
      }
    } else {
      req.branchFilter = {};
    }
    await applyTenantScopeIfAny(req);
    next();
  } catch (err) {
    if (err?.code === 'INVALID_TENANT' || err?.message === 'INVALID_TENANT') {
      return res.status(400).json({ success: false, message: 'X-Tenant-Id / tenant_id không hợp lệ hoặc đã bị khóa' });
    }
    logger.error('[branchFilter] error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi xác thực phạm vi chi nhánh. Thử lại sau.' });
  }
};

async function applyTenantScopeIfAny(req) {
  const isPlatformAdmin =
    req.user?.id === 'admin' || req.user?.adminRole === 'SUPER_ADMIN' || req.user?.adminRole === 'HIGH_ADMIN';
  if (!isPlatformAdmin) return;

  const raw =
    req.headers['x-tenant-id'] ||
    req.query.tenant_id ||
    req.query.tenantId ||
    '';
  if (!raw || raw === 'all') {
    req.tenant = null;
    req.tenantScope = null;
    return;
  }

  const mongoose = require('mongoose');
  // Soft-ignore: tenant cũ trong localStorage / ID sai không được làm sập toàn bộ API (400 spam).
  // Client sẽ tự xóa selected_tenant_id khi nhận header gợi ý.
  if (!mongoose.Types.ObjectId.isValid(String(raw))) {
    logger.warn({ raw }, '[Tenant] ignore invalid X-Tenant-Id');
    req.tenant = null;
    req.tenantScope = null;
    req.ignoredInvalidTenant = String(raw);
    return;
  }

  const Tenant = require('../models/Tenant');
  const tenantService = require('../services/tenantService');
  const tenant = await Tenant.findById(raw).lean();
  if (!tenant || tenant.status === 'suspended') {
    logger.warn({ raw, status: tenant?.status }, '[Tenant] ignore missing/suspended tenant');
    req.tenant = null;
    req.tenantScope = null;
    req.ignoredInvalidTenant = String(raw);
    return;
  }

  const branchIds = await tenantService.resolveBranchIdsForTenant(tenant._id);
  req.tenant = tenant;
  req.tenantScope = { tenantId: tenant._id, branchIds };

  const idStrs = branchIds.map((id) => String(id));
  if (!req.branchFilter) req.branchFilter = {};

  if (req.branchFilter.branchId && !req.branchFilter.branchId.$in) {
    if (!idStrs.includes(String(req.branchFilter.branchId))) {
      req.branchFilter = { branchId: null };
    }
  } else if (!req.branchFilter.branchId) {
    req.branchFilter = {
      branchId: { $in: branchIds.length ? branchIds : [null] },
    };
  }
}

/**
 * requireInternalToken — Chặn token public truy cập API quản trị
 * Áp dụng sau authMiddleware trên các route nhạy cảm (staff/admin routes)
 */
const requireInternalToken = (req, res, next) => {
  // Chỉ token cấp bởi /api/auth/login/internal mới vào được khu quản trị.
  // Token 'public' và token legacy (ký trước khi có claim aud) đều bị chặn.
  if (req.tokenAudience === 'internal') return next();
  return res.status(403).json({
    success: false,
    code: 'INTERNAL_TOKEN_REQUIRED',
    message: 'Token không hợp lệ cho khu vực quản trị. Vui lòng đăng nhập qua cổng nội bộ (/admin/login).',
  });
};

/**
 * isHighAdminOrAbove — Cho phép HIGH_ADMIN hoặc SUPER_ADMIN
 * Dùng cho các route quản lý staff nhưng không yêu cầu SUPER_ADMIN
 */
const isHighAdminOrAbove = async (req, res, next) => {
  if (req.user && req.user.id === 'admin') return next();
  try {
    if (!req.user?.id) {
      return res.status(403).json({ success: false, message: 'Quyền truy cập bị từ chối' });
    }
    const user = await Teacher.findById(req.user.id).select('adminRole').lean();
    if (user?.adminRole === 'SUPER_ADMIN' || user?.adminRole === 'HIGH_ADMIN') {
      req.user.adminRole = user.adminRole;
      return next();
    }
  } catch (err) {
    logger.error('[isHighAdminOrAbove] error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi xác thực quyền' });
  }
  return res.status(403).json({ success: false, message: 'Quyền truy cập bị từ chối: Yêu cầu Admin cấp cao hoặc Super Admin' });
};

module.exports = {
  authMiddleware,
  isAdmin,
  isTeacher,
  isSuperAdmin,
  isHighAdminOrAbove,
  checkPermission,
  checkAnyPermission,
  userHasPermission,
  branchFilter,
  requireInternalToken,
};
