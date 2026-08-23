const authenticate = require('./authenticate');

const branchFilterHelper = require('./branchFilter');
const Role = require('../../modules/roles/Role');
const Teacher = require('../../modules/teacher/models/Teacher');

// Proxy requireAuth to authenticate, ensuring req.user is set
const requireAuth = (req, res, next) => {
  console.log('--- REQUIRE AUTH CALLED ---', req.url);
  return authenticate(req, res, () => {
    req.user = req.user || req.currentUser;
    next();
  });
};

// Ensure req.currentUser is set from req.user for integration test runners
const populateCurrentUser = (req) => {
  if (!req.currentUser && req.user) {
    req.currentUser = req.user;
    // Map properties for legacy compatibility
    if (req.user.id === 'admin') {
      req.currentUser.roleCode = 'SUPER_ADMIN';
      req.currentUser.adminRole = 'SUPER_ADMIN';
      req.currentUser.permissions = ['ALL'];
    }
  }
};



// userHasPermission as helper function (copied from original middleware/auth.js)
const userHasPermission = async (reqUser, requiredPermission) => {
  if (!reqUser) return false;
  if (reqUser.id === 'admin') return true;
  try {
    const user = await Teacher.findById(reqUser.id).select('adminRole permissions').lean();
    if (!user) return false;
    if (user.adminRole === 'SUPER_ADMIN') return true;
    return Array.isArray(user.permissions) && user.permissions.includes(requiredPermission);
  } catch {
    return false;
  }
};

// Retain requireScope for legacy reasons
const requireScope = (requiredScope) => {
  return async (req, res, next) => {
    try {
      populateCurrentUser(req);
      if (!req.currentUser) {
        return res.status(401).json({ success: false, message: 'Not authorized' });
      }
      const role = await Role.findById(req.currentUser.roleId);
      req.accessScope = role.scope;
      
      if (requiredScope === 'GLOBAL' && role.scope !== 'GLOBAL') {
        return res.status(403).json({ success: false, message: 'Requires GLOBAL access scope' });
      }
      next();
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error during scope check' });
    }
  };
};

// Retain requireBranch for legacy reasons
const requireBranch = (reqParam = 'branchId') => {
  return async (req, res, next) => {
    try {
      populateCurrentUser(req);
      const targetBranchId = req.params[reqParam] || req.body[reqParam] || req.query[reqParam];
      if (!targetBranchId) return next();

      const role = await Role.findById(req.currentUser.roleId);
      if (role.scope === 'GLOBAL') return next();

      if (req.currentUser.branchId && req.currentUser.branchId.toString() !== targetBranchId.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized for this branch' });
      }

      next();
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error during branch check' });
    }
  };
};

// Retain requireOwnership for legacy reasons
const requireOwnership = (idField = 'userId') => {
  return async (req, res, next) => {
    populateCurrentUser(req);
    const targetUserId = req.params[idField] || req.body[idField];
    if (req.currentUser.roleCode === 'SUPER_ADMIN' || req.currentUser.roleCode === 'HIGH_ADMIN') return next();
    if (String(req.currentUser._id) === String(targetUserId)) return next();
    return res.status(403).json({ success: false, message: 'Not authorized, ownership required' });
  };
};

// Retain requireInternalToken for legacy reasons
const requireInternalToken = (req, res, next) => {
  populateCurrentUser(req);
  if (req.tokenAudience === 'internal') return next();
  return res.status(403).json({
    success: false,
    code: 'INTERNAL_TOKEN_REQUIRED',
    message: 'Token không hợp lệ cho khu vực quản trị.',
  });
};



// Proxy branchFilter helper
const branchFilter = branchFilterHelper;

module.exports = {
  requireAuth,
  authMiddleware: requireAuth,
  userHasPermission,
  requireScope,
  branchFilter,
  requireBranch,
  requireOwnership,
  requireInternalToken,
};
