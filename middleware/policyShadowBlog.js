/**
 * Policy SHADOW for /api/blog. Always next(); never alters HTTP/notify/io.emit.
 */
const Teacher = require('../models/Teacher');
const BlogPost = require('../models/BlogPost');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyBlog,
  evaluatePolicyBlog,
  compareDecisions,
  MANAGE_BLOG_LIVE,
} = require('../services/policyShadow/blogPolicy');

function policyShadowBlog(action) {
  return async (req, res, next) => {
    try {
      let actorDoc = null;
      if (req.user?.id && req.user.id !== 'admin' && req.user.role !== 'student') {
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
        manageQuery: String(req.query?.manage || '') === '1',
        post: null,
      };

      if (action === 'get') {
        const key = req.params?.slugOrId;
        if (key) {
          const filter = { deletedAt: null };
          if (/^[a-f0-9]{24}$/i.test(key)) filter._id = key;
          else filter.slug = key;
          if (!ctx.manageQuery) filter.status = 'published';
          ctx.post = await BlogPost.findOne(filter)
            .select('status targetAudience authorId')
            .lean();
        }
      } else if (
        ['manage_get', 'manage_update', 'manage_publish', 'manage_hide', 'manage_delete'].includes(action)
        && req.params?.id
      ) {
        ctx.post = await BlogPost.findOne({ _id: req.params.id, deletedAt: null })
          .select('status targetAudience authorId')
          .lean();
      }

      const untrusted = {
        bodyRole: req.body?.role,
        clientAdminRole: req.body?.adminRole,
        clientPermissions: req.body?.permissions,
        bodyAuthorId: req.body?.authorId,
        bodyBranchId: req.body?.branchId,
        bodyTenantId: req.body?.tenantId,
        bodyOwnerId: req.body?.ownerId,
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';
      try {
        legacy = evaluateLegacyBlog(subject, action, ctx);
        policy = evaluatePolicyBlog(subject, action, ctx, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `blog_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: MANAGE_BLOG_LIVE,
            resourceType: 'blog',
            resourceId: req.params?.id || req.params?.slugOrId || null,
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] blog evaluation error — legacy still authoritative',
        );
        req.policyShadow = { action: `blog_${action}`, comparison: 'ERROR', error: evalErr.message };
        return next();
      }

      req.policyShadow = {
        action: `blog_${action}`,
        comparison,
        legacyDecision: legacy.decision,
        policyDecision: policy.decision,
        legacyReason: legacy.reason,
        policyReason: policy.reason,
        policyStatusHint: policy.statusHint,
      };

      if (comparison === 'MISMATCH') {
        logger.warn(
          {
            event: 'POLICY_MISMATCH',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `blog_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: MANAGE_BLOG_LIVE,
            resourceType: 'blog',
            resourceId: req.params?.id || req.params?.slugOrId || null,
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] blog shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `blog_${action}`,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected blog error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowBlog };
