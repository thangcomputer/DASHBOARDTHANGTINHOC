/**
 * Policy shadow for LIVE finance authorization (Wave 6.6).
 * AUTHORIZATION ONLY — does not touch money/ledger/SePay/idempotency logic.
 *
 * Covers: /api/finance, /api/transactions, /api/invoices, JWT webhook payment-status.
 * Already shadowed elsewhere (documented, not re-wired): student pay/refund/price,
 * teacher finance pay-flexible/pay-all/pending/self.
 */
const {
  FINANCE_WRITE_LIVE,
  VIEW_BRANCH_REVENUE_LIVE,
  actorHasLivePermission,
  actorHasAnyLivePermission,
} = require('./livePermissionAdapter');

const ACTIONS = {
  // /api/finance — read (MANAGE_FINANCE OR VIEW_BRANCH_REVENUE)
  summary: { family: 'any_finance_read', resource: null },
  ledger_list: { family: 'any_finance_read', resource: null },
  student_card: { family: 'any_finance_read', resource: 'student', branch: true },
  // /api/finance — manage
  heal_orphans: { family: 'manage_finance', resource: 'student', branch: true },
  ledger_void: { family: 'manage_finance', resource: null },
  discount: { family: 'manage_finance', resource: null },
  reconcile: { family: 'manage_finance', resource: null },
  snapshots_rebuild: { family: 'manage_finance', resource: null },
  sync_cache: { family: 'manage_finance', resource: null },
  // /api/transactions
  tx_list: { family: 'manage_finance', resource: null },
  tx_stats: { family: 'manage_finance', resource: null },
  tx_teacher_history: { family: 'admin_staff_or_self', resource: null },
  tx_calculate: { family: 'tx_calculate', resource: null },
  tx_create: { family: 'manage_finance', resource: null },
  tx_confirm: { family: 'manage_finance', resource: null },
  tx_cancel: { family: 'manage_finance', resource: null },
  tx_delete: { family: 'manage_finance', resource: null },
  // /api/invoices
  inv_list: { family: 'manage_finance', resource: null },
  inv_stats: { family: 'manage_finance', resource: null },
  inv_get: { family: 'admin_or_invoice_owner', resource: 'invoice' },
  inv_pdf: { family: 'admin_or_invoice_owner', resource: 'invoice' },
  inv_create: { family: 'manage_finance', resource: null },
  inv_pdf_queue: { family: 'manage_finance', resource: null },
  inv_email: { family: 'manage_finance', resource: null },
  inv_delete: { family: 'manage_finance', resource: null },
  // JWT webhooks
  wh_payment_session: { family: 'authenticated', resource: null },
  wh_payment_status_student: { family: 'self_or_staff', resource: null },
};

function buildSubject({ user, actorDoc, userBranchId }) {
  return {
    id: String(user?.id || user?._id || ''),
    role: String(user?.role || actorDoc?.role || ''),
    adminRole: actorDoc?.adminRole || user?.adminRole || null,
    permissions: Array.isArray(actorDoc?.permissions)
      ? actorDoc.permissions
      : (Array.isArray(user?.permissions) ? user.permissions : []),
    userBranchId: userBranchId != null && userBranchId !== '' ? String(userBranchId) : null,
  };
}

function isStaffRole(subject) {
  const role = String(subject.role || '').toLowerCase();
  return role === 'admin' || role === 'staff';
}

function evaluateCheckPermission(subject, livePermission) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  if (subject.id === 'admin') {
    return { decision: 'ALLOW', reason: 'hardcoded_admin', statusHint: 200 };
  }
  if (!isStaffRole(subject)) {
    return { decision: 'DENY', reason: 'role_not_staff', statusHint: 403 };
  }
  if (subject.adminRole === 'SUPER_ADMIN') {
    return { decision: 'ALLOW', reason: 'super_admin', statusHint: 200 };
  }
  if (!actorHasLivePermission(subject, livePermission)) {
    return { decision: 'DENY', reason: `missing_${livePermission}`, statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: `has_${livePermission}`, statusHint: 200 };
}

function evaluateAnyFinanceRead(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  if (subject.id === 'admin') {
    return { decision: 'ALLOW', reason: 'hardcoded_admin', statusHint: 200 };
  }
  if (!isStaffRole(subject)) {
    return { decision: 'DENY', reason: 'role_not_staff', statusHint: 403 };
  }
  if (subject.adminRole === 'SUPER_ADMIN') {
    return { decision: 'ALLOW', reason: 'super_admin', statusHint: 200 };
  }
  if (
    !actorHasAnyLivePermission(subject, [FINANCE_WRITE_LIVE, VIEW_BRANCH_REVENUE_LIVE])
  ) {
    return { decision: 'DENY', reason: 'missing_finance_or_view_revenue', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'has_finance_or_view_revenue', statusHint: 200 };
}

/** financeRoutes student card / heal: branchFilter.branchId equality */
function evaluateFinanceStudentBranch(trustedBranchFilter, student) {
  const bfId = trustedBranchFilter?.branchId;
  if (bfId == null || bfId === '') {
    return { decision: 'ALLOW', reason: 'no_branch_filter', statusHint: 200 };
  }
  if (!student) {
    return { decision: 'DENY', reason: 'student_not_found', statusHint: 404 };
  }
  const allowed = String(student.branchId || '') === String(bfId);
  if (!allowed) {
    return { decision: 'DENY', reason: 'cross_branch', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'branch_ok', statusHint: 200 };
}

function evaluateAdminStaffOrSelf(subject, selfId) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  if (isStaffRole(subject) || subject.id === 'admin') {
    return { decision: 'ALLOW', reason: 'admin_or_staff', statusHint: 200 };
  }
  if (selfId != null && String(subject.id) === String(selfId)) {
    return { decision: 'ALLOW', reason: 'self', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'not_admin_staff_or_self', statusHint: 403 };
}

function evaluateTxCalculate(subject, teacherId) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const role = String(subject.role || '').toLowerCase();
  if (role !== 'teacher' && role !== 'admin' && role !== 'staff' && subject.id !== 'admin') {
    return { decision: 'DENY', reason: 'not_teacher_middleware', statusHint: 403 };
  }
  return evaluateAdminStaffOrSelf(subject, teacherId);
}

/** Invoice get/pdf: role === 'admin' OR owner (staff NOT treated as admin). */
function evaluateAdminOrInvoiceOwner(subject, invoice) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  if (String(subject.role || '').toLowerCase() === 'admin' || subject.id === 'admin') {
    return { decision: 'ALLOW', reason: 'admin_role', statusHint: 200 };
  }
  if (!invoice) {
    return { decision: 'ALLOW', reason: 'invoice_missing_handler_404', statusHint: 200 };
  }
  const ownerId = invoice.hocVien?._id || invoice.hocVien || invoice.studentId;
  if (ownerId != null && String(subject.id) === String(ownerId)) {
    return { decision: 'ALLOW', reason: 'invoice_owner', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'not_admin_or_owner', statusHint: 403 };
}

function evaluateSelfOrStaff(subject, studentId) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const role = String(subject.role || '').toLowerCase();
  if (role === 'student' && String(subject.id) === String(studentId)) {
    return { decision: 'ALLOW', reason: 'student_self', statusHint: 200 };
  }
  if (isStaffRole(subject) || subject.id === 'admin') {
    return { decision: 'ALLOW', reason: 'staff', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'payment_status_forbidden', statusHint: 403 };
}

function evaluateFamily(subject, family, ctx) {
  switch (family) {
    case 'any_finance_read':
      return evaluateAnyFinanceRead(subject);
    case 'manage_finance':
      return evaluateCheckPermission(subject, FINANCE_WRITE_LIVE);
    case 'admin_staff_or_self':
      return evaluateAdminStaffOrSelf(subject, ctx.selfId);
    case 'tx_calculate':
      return evaluateTxCalculate(subject, ctx.selfId);
    case 'admin_or_invoice_owner':
      return evaluateAdminOrInvoiceOwner(subject, ctx.invoice);
    case 'authenticated':
      if (!subject?.id) {
        return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
      }
      return { decision: 'ALLOW', reason: 'authenticated', statusHint: 200 };
    case 'self_or_staff':
      return evaluateSelfOrStaff(subject, ctx.selfId);
    default:
      return { decision: 'DENY', reason: 'unknown_family', statusHint: 403 };
  }
}

function evaluateLegacyFinance(subject, action, ctx = {}) {
  const def = ACTIONS[action];
  if (!def) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  const permission = evaluateFamily(subject, def.family, ctx);
  if (permission.decision === 'DENY') {
    return {
      decision: 'DENY',
      reason: permission.reason,
      statusHint: permission.statusHint,
      permission,
      branch: null,
      action,
    };
  }
  if (def.branch && def.resource === 'student') {
    const branch = evaluateFinanceStudentBranch(ctx.trustedBranchFilter, ctx.student);
    if (branch.decision === 'DENY') {
      return {
        decision: 'DENY',
        reason: branch.reason,
        statusHint: branch.statusHint,
        permission,
        branch,
        action,
      };
    }
    return {
      decision: 'ALLOW',
      reason: 'legacy_allow',
      statusHint: 200,
      permission,
      branch,
      action,
    };
  }
  return {
    decision: 'ALLOW',
    reason: 'legacy_allow',
    statusHint: 200,
    permission,
    branch: { decision: 'ALLOW', reason: 'no_branch_assert' },
    action,
  };
}

function evaluatePolicyFinance(subject, action, ctx = {}, _untrusted = {}) {
  void _untrusted.bodyBranchId;
  void _untrusted.queryBranchId;
  void _untrusted.queryTenantId;
  void _untrusted.bodyTenantId;
  void _untrusted.clientRole;
  void _untrusted.clientAdminRole;
  void _untrusted.clientPermissions;

  const legacy = evaluateLegacyFinance(subject, action, ctx);
  if (legacy.decision === 'DENY') {
    return {
      ...legacy,
      reason: legacy.reason.startsWith('policy_') ? legacy.reason : `policy_${legacy.reason}`,
    };
  }
  return { ...legacy, reason: 'policy_allow' };
}

function compareDecisions(legacy, policy) {
  if (!legacy || !policy) return 'UNKNOWN';
  if (legacy.decision === policy.decision) return 'MATCH';
  return 'MISMATCH';
}

module.exports = {
  ACTIONS,
  FINANCE_WRITE_LIVE,
  VIEW_BRANCH_REVENUE_LIVE,
  buildSubject,
  evaluateLegacyFinance,
  evaluatePolicyFinance,
  compareDecisions,
  evaluateFinanceStudentBranch,
  evaluateAnyFinanceRead,
  evaluateCheckPermission,
};
