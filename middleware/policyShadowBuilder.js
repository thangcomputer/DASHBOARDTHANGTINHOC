/**
 * Policy SHADOW for /api/builder. Always next(); never render/publish/submit/run.
 * Soft-decodes JWT for form_get evaluation only — does not mutate req.user.
 */
const jwt = require('jsonwebtoken');
const Teacher = require('../models/Teacher');
const FormDefinition = require('../models/FormDefinition');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyBuilder,
  evaluatePolicyBuilder,
  compareDecisions,
} = require('../services/policyShadow/builderPolicy');

async function softUserFromAuthHeader(req) {
  if (req.user?.id) return { user: req.user, actorDoc: null };
  const raw = req.header?.('Authorization') || req.headers?.authorization;
  const token = raw?.replace(/^Bearer\s+/i, '');
  if (!token || !process.env.JWT_SECRET) return { user: {}, actorDoc: null };
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let actorDoc = null;
    if (decoded?.id && decoded.id !== 'admin' && decoded.role !== 'student') {
      actorDoc = await Teacher.findById(decoded.id)
        .select('adminRole permissions role')
        .lean();
    }
    return { user: decoded, actorDoc };
  } catch {
    return { user: {}, actorDoc: null };
  }
}

function policyShadowBuilder(action) {
  return async (req, res, next) => {
    try {
      let user = req.user || {};
      let actorDoc = null;

      if (action === 'form_get' && !req.user?.id) {
        const soft = await softUserFromAuthHeader(req);
        user = soft.user;
        actorDoc = soft.actorDoc;
      } else if (req.user?.id && req.user.id !== 'admin' && req.user.role !== 'student') {
        actorDoc = await Teacher.findById(req.user.id)
          .select('adminRole permissions role')
          .lean();
      }

      const subject = buildSubject({
        user,
        actorDoc,
        userBranchId: req.userBranchId || null,
      });

      const ctx = {};
      if (action === 'form_get' && req.params?.idOrSlug) {
        const key = req.params.idOrSlug;
        const filter = {};
        if (/^[a-f0-9]{24}$/i.test(key)) filter._id = key;
        else filter.slug = key;
        ctx.form = await FormDefinition.findOne(filter).select('status createdBy').lean();
      }

      const untrusted = {
        bodyRole: req.body?.role,
        clientAdminRole: req.body?.adminRole,
        clientPermissions: req.body?.permissions,
        bodyUserId: req.body?.userId,
        bodyOwnerId: req.body?.ownerId,
        bodyCreatedBy: req.body?.createdBy,
        bodySubmittedBy: req.body?.submittedBy,
        bodyBranchId: req.body?.branchId,
        bodyTenantId: req.body?.tenantId,
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';
      try {
        legacy = evaluateLegacyBuilder(subject, action, ctx);
        policy = evaluatePolicyBuilder(subject, action, ctx, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `builder_${action}`,
            policyName: 'builderPolicy',
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: action === 'form_submit' || action === 'form_get'
              ? 'public_or_isAdmin'
              : (action === 'form_submit_auth' ? 'auth' : 'isAdmin'),
            resourceType: 'builder',
            resourceId: req.params?.id || req.params?.idOrSlug || null,
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] builder evaluation error — legacy still authoritative',
        );
        req.policyShadow = { action: `builder_${action}`, comparison: 'ERROR', error: evalErr.message };
        return next();
      }

      req.policyShadow = {
        action: `builder_${action}`,
        comparison,
        legacyDecision: legacy.decision,
        policyDecision: policy.decision,
        legacyReason: legacy.reason,
        policyReason: policy.reason,
        policyStatusHint: policy.statusHint,
        legacyStatusHint: legacy.statusHint,
      };

      if (comparison === 'MISMATCH') {
        logger.warn(
          {
            event: 'POLICY_MISMATCH',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `builder_${action}`,
            policyName: 'builderPolicy',
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: 'isAdmin',
            resourceType: 'builder',
            resourceId: req.params?.id || req.params?.idOrSlug || null,
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] builder shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `builder_${action}`,
          policyName: 'builderPolicy',
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected builder error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowBuilder };
