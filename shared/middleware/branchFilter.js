/**
 * Reusable branch query scoping middleware.
 * Ensures staff users are scoped strictly to their assigned branchId.
 */
const branchFilter = (req, res, next) => {
  if (!req.currentUser) {
    req.userBranchId = null;
    req.branchFilter = {};
    return next();
  }

  const role = String(req.currentUser.role || '').toLowerCase();
  const adminRole = String(req.currentUser.adminRole || '').toUpperCase();
  const roleCode = String(req.currentUser.roleCode || '').toUpperCase();

  const isStaff = role === 'staff' || adminRole === 'STAFF' || adminRole === 'ADMIN_STAFF' || roleCode === 'ADMIN_STAFF';

  if (isStaff && req.currentUser.branchId) {
    req.userBranchId = req.currentUser.branchId;
    req.branchFilter = { branchId: req.currentUser.branchId };
  } else {
    req.userBranchId = null;
    req.branchFilter = {};
  }

  next();
};

module.exports = branchFilter;
