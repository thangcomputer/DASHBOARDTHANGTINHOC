/**
 * Policy shadow for LIVE /api/messages (Wave 6.9).
 * Mirrors routes/messageRoutes.js — role/ownership/contacts matrix.
 * MANAGE_MESSAGES exists in constants but is NOT used on live message routes.
 * Socket message:send in server.js is documented separately (not HTTP-shadowed).
 */
const { assertCanDirectMessage } = require('../chatAccessService');

const ACTIONS = new Set([
  'contacts',
  'conversations',
  'search',
  'hidden',
  'get_conversation',
  'sync',
  'upload',
  'send',
  'hide',
  'read',
  'reaction',
  'recall',
  'soft_delete',
  'group_create',
  'group_list',
  'group_delete',
  'unread',
  'broadcast',
]);

function buildSubject({ user, actorDoc, userBranchId }) {
  return {
    id: String(user?.id || user?._id || ''),
    role: String(user?.role || actorDoc?.role || ''),
    adminRole: actorDoc?.adminRole || user?.adminRole || null,
    permissions: Array.isArray(actorDoc?.permissions)
      ? actorDoc.permissions
      : (Array.isArray(user?.permissions) ? user.permissions : []),
    userBranchId: userBranchId != null && userBranchId !== '' ? String(userBranchId) : null,
    branchCode: user?.branchCode || actorDoc?.branchCode || '',
  };
}

function isStaffAccount(u = {}) {
  return u.role === 'staff' || u.adminRole === 'STAFF' || u.adminRole === 'SUPPORT';
}
function isSuperAdminAccount(u = {}) {
  return u.id === 'admin' || u.adminRole === 'SUPER_ADMIN';
}
function isHighAdminAccount(u = {}) {
  return u.adminRole === 'HIGH_ADMIN';
}
function isAdminLevelAccount(u = {}) {
  return isSuperAdminAccount(u) || isHighAdminAccount(u);
}

function evaluateAuthOnly(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  return { decision: 'ALLOW', reason: 'authenticated', statusHint: 200 };
}

/** conversations/search/sync: role === 'admin' OR self (staff role alone cannot view others). */
function evaluateSelfOrAdminRole(subject, targetUserId) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  if (subject.role === 'admin' || String(subject.id) === String(targetUserId)) {
    return { decision: 'ALLOW', reason: 'self_or_admin_role', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'not_self_or_admin', statusHint: 403 };
}

/** unread: self only (stricter than conversations). */
function evaluateSelfOnly(subject, targetUserId) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  if (String(subject.id) === String(targetUserId)) {
    return { decision: 'ALLOW', reason: 'self_only', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'not_self', statusHint: 403 };
}

function conversationHasSelf(conversationId, userId) {
  const parts = String(conversationId || '').split('__').filter(Boolean);
  return parts.some((p) => p.endsWith(`_${userId}`));
}

function evaluateGetConversation(subject, ctx) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const conversationId = ctx.conversationId;
  const isStaffOrAdmin = subject.role === 'admin' || isStaffAccount(subject);
  if (conversationHasSelf(conversationId, subject.id)) {
    return { decision: 'ALLOW', reason: 'conversation_participant', statusHint: 200 };
  }
  const parts = String(conversationId || '').split('__').filter(Boolean);
  if (isStaffOrAdmin && isAdminLevelAccount(subject) && parts.includes('admin_admin')) {
    return { decision: 'ALLOW', reason: 'admin_mailbox', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'not_conversation_participant', statusHint: 403 };
}

function evaluateRead(subject, ctx) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const conversationId = ctx.conversationId;
  const isGroupConv = String(conversationId || '').startsWith('group_');
  if (isGroupConv) {
    if (ctx.groupMember === true) {
      return { decision: 'ALLOW', reason: 'group_member', statusHint: 200 };
    }
    return { decision: 'DENY', reason: 'not_group_member', statusHint: 403 };
  }
  const isStaffOrAdmin = subject.role === 'admin' || isStaffAccount(subject);
  if (conversationHasSelf(conversationId, subject.id)) {
    return { decision: 'ALLOW', reason: 'conversation_participant', statusHint: 200 };
  }
  const parts = String(conversationId || '').split('__').filter(Boolean);
  if (isStaffOrAdmin && isAdminLevelAccount(subject) && parts.includes('admin_admin')) {
    return { decision: 'ALLOW', reason: 'admin_mailbox', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'read_not_allowed', statusHint: 403 };
}

async function evaluateSend(subject, ctx) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const receiverId = ctx.receiverId;
  const isBroadcast =
    receiverId === 'ALL_USERS'
    || receiverId === 'ALL_STUDENTS'
    || receiverId === 'ALL_TEACHERS';
  if (isBroadcast) {
    if (subject.role === 'admin' || subject.role === 'staff') {
      return { decision: 'ALLOW', reason: 'broadcast_role_ok', statusHint: 200 };
    }
    return { decision: 'DENY', reason: 'broadcast_role_denied', statusHint: 403 };
  }
  if (ctx.isGroup && ctx.groupId) {
    if (ctx.groupMissing) {
      return { decision: 'ALLOW', reason: 'missing_group_handler_404', statusHint: 200 };
    }
    if (ctx.groupMember || isAdminLevelAccount(subject)) {
      return { decision: 'ALLOW', reason: 'group_send_ok', statusHint: 200 };
    }
    return { decision: 'DENY', reason: 'not_group_member', statusHint: 403 };
  }
  // DM: reuse live contacts matrix
  const access = ctx.dmAccess != null
    ? ctx.dmAccess
    : await assertCanDirectMessage(subject, receiverId, ctx.receiverRole);
  if (!access.ok) {
    return {
      decision: 'DENY',
      reason: 'dm_denied',
      statusHint: 403,
      message: access.message || 'Không được nhắn tin đến người này',
      denyCode: access.code || access.reason || null,
    };
  }
  return { decision: 'ALLOW', reason: 'dm_ok', statusHint: 200 };
}

function evaluateMessageParticipant(subject, ctx) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  if (!ctx.message) {
    return { decision: 'ALLOW', reason: 'missing_message_handler_404', statusHint: 200 };
  }
  if (ctx.message.isGroup && ctx.message.groupId) {
    if (ctx.groupMember || isAdminLevelAccount(subject)) {
      return { decision: 'ALLOW', reason: 'group_participant', statusHint: 200 };
    }
    return { decision: 'DENY', reason: 'not_group_member', statusHint: 403 };
  }
  const uid = String(subject.id);
  const isParticipant =
    String(ctx.message.senderId) === uid
    || String(ctx.message.receiverId) === uid
    || (isAdminLevelAccount(subject)
      && (ctx.message.senderId === 'admin' || ctx.message.receiverId === 'admin'));
  if (!isParticipant) {
    return { decision: 'DENY', reason: 'not_message_participant', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'message_participant', statusHint: 200 };
}

function evaluateRecall(subject, ctx) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  if (!ctx.message) {
    return { decision: 'ALLOW', reason: 'missing_message_handler_404', statusHint: 200 };
  }
  const isStaffOrAdmin = subject.role === 'admin' || isStaffAccount(subject);
  const senderMatch =
    String(ctx.message.senderId) === String(subject.id)
    || (isStaffOrAdmin
      && (ctx.message.senderId === 'admin' || String(ctx.message.senderId) === String(subject.id)));
  if (!senderMatch) {
    return { decision: 'DENY', reason: 'not_sender', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'recall_sender_ok', statusHint: 200 };
}

function evaluateGroupCreate(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  if (subject.role === 'student') {
    return { decision: 'DENY', reason: 'student_cannot_create_group', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'group_create_ok', statusHint: 200 };
}

function evaluateGroupList(subject, targetUserId) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const isSelf = String(subject.id) === String(targetUserId);
  const isAdminOrStaff = subject.role === 'admin' || subject.role === 'staff';
  if (isSelf || isAdminOrStaff) {
    return { decision: 'ALLOW', reason: 'group_list_ok', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'group_list_denied', statusHint: 403 };
}

function evaluateGroupDelete(subject, ctx) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  if (subject.role === 'student') {
    return { decision: 'DENY', reason: 'student_cannot_delete_group', statusHint: 403 };
  }
  if (!ctx.group) {
    return { decision: 'ALLOW', reason: 'missing_group_handler_404', statusHint: 200 };
  }
  const isCreator = String(ctx.group.createdBy?.userId) === String(subject.id);
  if (isCreator || isAdminLevelAccount(subject)) {
    return { decision: 'ALLOW', reason: 'group_delete_ok', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'group_delete_denied', statusHint: 403 };
}

function evaluateBroadcast(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  if (subject.role === 'admin' || subject.role === 'staff') {
    return { decision: 'ALLOW', reason: 'broadcast_role_ok', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'broadcast_role_denied', statusHint: 403 };
}

async function evaluateLegacyMessage(subject, action, ctx = {}) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  switch (action) {
    case 'contacts':
    case 'hidden':
    case 'upload':
    case 'hide':
      return evaluateAuthOnly(subject);
    case 'conversations':
    case 'search':
    case 'sync':
      return evaluateSelfOrAdminRole(subject, ctx.targetUserId);
    case 'unread':
      return evaluateSelfOnly(subject, ctx.targetUserId);
    case 'get_conversation':
      return evaluateGetConversation(subject, ctx);
    case 'read':
      return evaluateRead(subject, ctx);
    case 'send':
      return evaluateSend(subject, ctx);
    case 'reaction':
    case 'soft_delete':
      return evaluateMessageParticipant(subject, ctx);
    case 'recall':
      return evaluateRecall(subject, ctx);
    case 'group_create':
      return evaluateGroupCreate(subject);
    case 'group_list':
      return evaluateGroupList(subject, ctx.targetUserId);
    case 'group_delete':
      return evaluateGroupDelete(subject, ctx);
    case 'broadcast':
      return evaluateBroadcast(subject);
    default:
      return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
}

async function evaluatePolicyMessage(subject, action, ctx = {}, _untrusted = {}) {
  void _untrusted.bodyBranchId;
  void _untrusted.queryBranchId;
  void _untrusted.clientRole;
  void _untrusted.clientPermissions;
  void _untrusted.bodySenderId;
  void _untrusted.bodyTenantId;
  void _untrusted.queryTenantId;
  const legacy = await evaluateLegacyMessage(subject, action, ctx);
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
  buildSubject,
  isStaffAccount,
  isAdminLevelAccount,
  evaluateLegacyMessage,
  evaluatePolicyMessage,
  compareDecisions,
  evaluateAuthOnly,
  evaluateSelfOrAdminRole,
  evaluateBroadcast,
};
