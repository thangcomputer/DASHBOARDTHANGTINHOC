/**
 * Policy SHADOW for /api/messages. Always next(); never alters HTTP/socket.
 */
const Teacher = require('../models/Teacher');
const Message = require('../models/Message');
const Group = require('../models/Group');
const logger = require('../config/logger');
const { assertCanDirectMessage } = require('../services/chatAccessService');
const {
  buildSubject,
  evaluateLegacyMessage,
  evaluatePolicyMessage,
  compareDecisions,
} = require('../services/policyShadow/messagePolicy');

function policyShadowMessage(action) {
  return async (req, res, next) => {
    try {
      let actorDoc = null;
      if (req.user?.id && req.user.id !== 'admin') {
        actorDoc = await Teacher.findById(req.user.id)
          .select('adminRole permissions role branchCode branchId')
          .lean();
      }
      const subject = buildSubject({
        user: req.user,
        actorDoc,
        userBranchId: req.userBranchId || null,
      });

      const ctx = {
        targetUserId: req.params?.userId || null,
        conversationId: req.params?.conversationId || null,
        receiverId: req.body?.receiverId || null,
        receiverRole: req.body?.receiverRole || null,
        isGroup: !!req.body?.isGroup,
        groupId: req.body?.groupId || null,
        groupMember: false,
        groupMissing: false,
        group: null,
        message: null,
        dmAccess: null,
      };

      if (action === 'send') {
        if (ctx.isGroup && ctx.groupId) {
          const group = await Group.findById(ctx.groupId).select('participants').lean();
          if (!group) ctx.groupMissing = true;
          else {
            ctx.groupMember = (group.participants || []).some(
              (p) => String(p.userId) === String(subject.id),
            );
          }
        } else {
          const isBroadcast =
            ctx.receiverId === 'ALL_USERS'
            || ctx.receiverId === 'ALL_STUDENTS'
            || ctx.receiverId === 'ALL_TEACHERS';
          if (!isBroadcast) {
            ctx.dmAccess = await assertCanDirectMessage(
              { ...subject, ...req.user },
              ctx.receiverId,
              ctx.receiverRole,
            );
          }
        }
      }

      if (action === 'read' && String(ctx.conversationId || '').startsWith('group_')) {
        const groupId = String(ctx.conversationId).slice('group_'.length);
        const g = await Group.findOne({
          _id: groupId,
          'participants.userId': String(subject.id),
        }).select('_id').lean();
        ctx.groupMember = !!g;
      }

      if (action === 'reaction' || action === 'soft_delete' || action === 'recall') {
        ctx.message = await Message.findById(req.params?.messageId)
          .select('senderId receiverId isGroup groupId')
          .lean();
        if (ctx.message?.isGroup && ctx.message.groupId) {
          const group = await Group.findById(ctx.message.groupId).select('participants').lean();
          ctx.groupMember = !!(
            group
            && (group.participants || []).some((p) => String(p.userId) === String(subject.id))
          );
        }
      }

      if (action === 'group_delete') {
        ctx.group = await Group.findById(req.params?.groupId).select('createdBy').lean();
      }

      const untrusted = {
        bodyBranchId: req.body?.branchId,
        queryBranchId: req.query?.branch_id || req.query?.branchId,
        clientRole: req.body?.role || req.query?.role,
        clientPermissions: req.body?.permissions,
        bodySenderId: req.body?.senderId,
        bodyTenantId: req.body?.tenantId,
        queryTenantId: req.query?.tenantId,
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';
      try {
        legacy = await evaluateLegacyMessage(subject, action, ctx);
        policy = await evaluatePolicyMessage(subject, action, ctx, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `message_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            userBranchId: subject.userBranchId,
            resourceType: 'message',
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] message evaluation error — legacy still authoritative',
        );
        req.policyShadow = {
          action: `message_${action}`,
          comparison: 'ERROR',
          error: evalErr.message,
        };
        return next();
      }

      req.policyShadow = {
        action: `message_${action}`,
        comparison,
        legacyDecision: legacy.decision,
        policyDecision: policy.decision,
        legacyReason: legacy.reason,
        policyReason: policy.reason,
        policyStatusHint: policy.statusHint,
        legacyStatusHint: legacy.statusHint,
        policyMessage: policy.message || null,
        policyDenyCode: policy.denyCode || null,
      };

      if (comparison === 'MISMATCH') {
        logger.warn(
          {
            event: 'POLICY_MISMATCH',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `message_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            userBranchId: subject.userBranchId,
            resourceType: 'message',
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] message shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `message_${action}`,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected message error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowMessage };
