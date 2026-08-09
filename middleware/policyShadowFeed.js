/**
 * Policy SHADOW for /api/feed. Always next(); never alters feed_room emits.
 */
const Teacher = require('../models/Teacher');
const FeedPost = require('../models/FeedPost');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyFeed,
  evaluatePolicyFeed,
  compareDecisions,
} = require('../services/policyShadow/feedPolicy');

function policyShadowFeed(action) {
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

      const ctx = { post: null, comment: null };
      if (['delete_post', 'delete_comment', 'like', 'react', 'comment'].includes(action) && req.params?.id) {
        // delete/like need post; only load fields needed for ownership on delete*
        if (action === 'delete_post' || action === 'delete_comment') {
          const post = await FeedPost.findById(req.params.id).select('authorId comments').lean();
          ctx.post = post;
          if (action === 'delete_comment' && post && req.params?.commentId) {
            const comments = post.comments || [];
            ctx.comment = comments.find((c) => String(c._id) === String(req.params.commentId)) || null;
          }
        }
      }

      const untrusted = {
        bodyRole: req.body?.role,
        clientAdminRole: req.body?.adminRole,
        clientPermissions: req.body?.permissions,
        bodyAuthorId: req.body?.authorId,
        bodyAuthorAvatar: req.body?.authorAvatar,
        bodyBranchId: req.body?.branchId,
        bodyTenantId: req.body?.tenantId,
        bodyUserId: req.body?.userId,
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';
      try {
        legacy = evaluateLegacyFeed(subject, action, ctx);
        policy = evaluatePolicyFeed(subject, action, ctx, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `feed_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: 'auth_or_ownership',
            resourceType: 'feed',
            resourceId: req.params?.id || null,
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] feed evaluation error — legacy still authoritative',
        );
        req.policyShadow = { action: `feed_${action}`, comparison: 'ERROR', error: evalErr.message };
        return next();
      }

      req.policyShadow = {
        action: `feed_${action}`,
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
            action: `feed_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: 'auth_or_ownership',
            resourceType: 'feed',
            resourceId: req.params?.id || null,
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] feed shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `feed_${action}`,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected feed error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowFeed };
