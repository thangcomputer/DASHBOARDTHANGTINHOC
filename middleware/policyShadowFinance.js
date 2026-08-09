/**
 * Policy SHADOW for finance authorization. Always next(); never mutates money/filters.
 */
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyFinance,
  evaluatePolicyFinance,
  compareDecisions,
  ACTIONS,
} = require('../services/policyShadow/financePolicy');
const { FINANCE_WRITE_LIVE } = require('../services/policyShadow/livePermissionAdapter');

function policyShadowFinance(action) {
  return async (req, res, next) => {
    try {
      const def = ACTIONS[action];
      let actorDoc = null;
      if (req.user?.id && req.user.id !== 'admin') {
        actorDoc = await Teacher.findById(req.user.id)
          .select('adminRole permissions role')
          .lean();
      }

      const subject = buildSubject({
        user: req.user,
        actorDoc,
        userBranchId: req.userBranchId || null,
      });

      const ctx = {
        trustedBranchFilter: req.branchFilter ? { ...req.branchFilter } : {},
        selfId: null,
        student: null,
        invoice: null,
      };

      if (def?.resource === 'student') {
        const sid = req.params?.id || req.body?.studentId;
        if (sid) {
          ctx.student = await Student.findById(sid).select('branchId').lean();
        }
      }

      if (action === 'tx_teacher_history') {
        ctx.selfId = req.params?.teacherId;
      }
      if (action === 'tx_calculate') {
        ctx.selfId = req.body?.teacherId;
      }
      if (action === 'wh_payment_status_student') {
        ctx.selfId = req.params?.studentId;
      }
      if (action === 'inv_get' || action === 'inv_pdf') {
        // Avoid loading full invoice money fields — only owner id for authz compare
        try {
          const Invoice = require('../models/Invoice');
          const inv = await Invoice.findById(req.params?.id).select('hocVien').lean();
          ctx.invoice = inv;
        } catch {
          ctx.invoice = null;
        }
      }

      const untrusted = {
        bodyBranchId: req.body?.branchId,
        queryBranchId: req.query?.branchId || req.query?.branch_id,
        queryTenantId: req.query?.tenantId,
        bodyTenantId: req.body?.tenantId,
        clientRole: req.body?.role || req.query?.role,
        clientAdminRole: req.body?.adminRole,
        clientPermissions: req.body?.permissions,
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';

      try {
        legacy = evaluateLegacyFinance(subject, action, ctx);
        policy = evaluatePolicyFinance(subject, action, ctx, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `finance_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: FINANCE_WRITE_LIVE,
            userBranchId: subject.userBranchId,
            resourceBranchId: ctx.student?.branchId ? String(ctx.student.branchId) : null,
            resourceType: 'finance',
            legacyDecision: null,
            policyDecision: null,
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] finance evaluation error — legacy still authoritative',
        );
        req.policyShadow = { action: `finance_${action}`, comparison: 'ERROR', error: evalErr.message };
        return next();
      }

      req.policyShadow = {
        action: `finance_${action}`,
        comparison,
        legacyDecision: legacy.decision,
        policyDecision: policy.decision,
        legacyReason: legacy.reason,
        policyReason: policy.reason,
      };

      if (comparison === 'MISMATCH') {
        logger.warn(
          {
            event: 'POLICY_MISMATCH',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `finance_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: FINANCE_WRITE_LIVE,
            userBranchId: subject.userBranchId,
            resourceBranchId: ctx.student?.branchId ? String(ctx.student.branchId) : null,
            resourceType: 'finance',
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] finance shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `finance_${action}`,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected finance error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowFinance };
