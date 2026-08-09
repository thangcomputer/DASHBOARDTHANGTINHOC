/**
 * Policy SHADOW for /api/files. Always next(); never alters HTTP/storage.
 */
const Teacher = require('../models/Teacher');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyFile,
  evaluatePolicyFile,
  compareDecisions,
} = require('../services/policyShadow/filePolicy');
const { SYSTEM_SETTINGS_LIVE } = require('../services/policyShadow/livePermissionAdapter');

function policyShadowFile(action) {
  return async (req, res, next) => {
    try {
      let actorDoc = null;
      if (req.user?.id && req.user.id !== 'admin') {
        actorDoc = await Teacher.findById(req.user.id)
          .select('adminRole permissions role')
          .lean();
      }
      const subject = buildSubject({
        user: req.user || {},
        actorDoc,
        userBranchId: req.userBranchId || null,
      });

      const ctx = {
        category: String(req.query?.category || req.body?.category || 'general').toLowerCase(),
        asset: null,
      };

      if (action === 'delete' && req.params?.id) {
        try {
          const FileAsset = require('../models/FileAsset');
          ctx.asset = await FileAsset.findById(req.params.id).select('uploadedBy status').lean();
          if (ctx.asset && ctx.asset.status === 'deleted') ctx.asset = null;
        } catch {
          ctx.asset = null;
        }
      }

      const untrusted = {
        bodyRole: req.body?.role,
        clientAdminRole: req.body?.adminRole,
        clientPermissions: req.body?.permissions,
        bodyUserId: req.body?.userId,
        bodyOwnerId: req.body?.ownerId || req.body?.uploadedBy,
        bodyBranchId: req.body?.branchId,
        bodyTenantId: req.body?.tenantId,
        queryUploadedBy: req.query?.uploadedBy,
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';
      try {
        legacy = evaluateLegacyFile(subject, action, ctx);
        policy = evaluatePolicyFile(subject, action, ctx, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `file_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: SYSTEM_SETTINGS_LIVE,
            resourceType: 'file',
            resourceId: req.params?.id || null,
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] file evaluation error — legacy still authoritative',
        );
        req.policyShadow = { action: `file_${action}`, comparison: 'ERROR', error: evalErr.message };
        return next();
      }

      req.policyShadow = {
        action: `file_${action}`,
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
            action: `file_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: SYSTEM_SETTINGS_LIVE,
            resourceType: 'file',
            resourceId: req.params?.id || null,
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] file shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `file_${action}`,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected file error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowFile };
