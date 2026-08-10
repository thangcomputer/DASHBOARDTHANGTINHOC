/**
 * Phase 7.20 — Controlled cutover gate for LIVE /api/messages ONLY.
 *
 * LEGACY (default):
 *   All actions → auth already applied (router.use); pass-through.
 *   Ownership / self-scope / DM / group checks remain in handlers.
 *
 * POLICY (env opt-in): Policy decision is HTTP authority.
 * Fail-safe: ERROR / UNKNOWN / malformed → Legacy path above.
 * Does not create/send/recall messages, emit sockets, queue jobs, or mutate auth.
 */
const logger = require('../config/logger');
const {
  AUTHORITY,
  getAuthorizationAuthority,
} = require('../services/policyShadow/cutoverAuthority');

function denyMessages(res, statusHint, reason, action, detail = {}) {
  const r = String(reason || '');
  const a = String(action || '');
  if (
    statusHint === 401
    || r === 'unauthenticated'
    || r === 'policy_unauthenticated'
  ) {
    return res.status(401).json({
      success: false,
      message: 'Không có token, truy cập bị từ chối',
    });
  }
  if (r === 'not_self_or_admin' || r === 'policy_not_self_or_admin') {
    if (a === 'search') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền tìm kiếm',
      });
    }
    if (a === 'sync') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền đồng bộ dữ liệu này',
      });
    }
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền xem thông tin này',
    });
  }
  if (r === 'not_self' || r === 'policy_not_self') {
    return res.status(403).json({
      success: false,
      message: 'Quyền truy cập bị từ chối',
    });
  }
  if (
    r === 'not_conversation_participant'
    || r === 'policy_not_conversation_participant'
    || r === 'read_not_allowed'
    || r === 'policy_read_not_allowed'
    || r === 'not_message_participant'
    || r === 'policy_not_message_participant'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Bạn không thuộc cuộc hội thoại này',
    });
  }
  if (
    r === 'not_group_member'
    || r === 'policy_not_group_member'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Bạn không thuộc nhóm chat này',
    });
  }
  if (
    r === 'broadcast_role_denied'
    || r === 'policy_broadcast_role_denied'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Chỉ admin/staff được gửi thông báo broadcast',
    });
  }
  if (r === 'dm_denied' || r === 'policy_dm_denied') {
    const body = {
      success: false,
      message: (detail.message && String(detail.message).trim())
        || 'Không được nhắn tin đến người này',
    };
    if (detail.code) body.code = detail.code;
    return res.status(403).json(body);
  }
  if (r === 'not_sender' || r === 'policy_not_sender') {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền thu hồi tin nhắn này',
    });
  }
  if (
    r === 'student_cannot_create_group'
    || r === 'policy_student_cannot_create_group'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Học viên không có quyền tạo nhóm',
    });
  }
  if (
    r === 'group_list_denied'
    || r === 'policy_group_list_denied'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Không có quyền xem nhóm của người khác',
    });
  }
  if (
    r === 'student_cannot_delete_group'
    || r === 'policy_student_cannot_delete_group'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Học viên không có quyền xóa nhóm',
    });
  }
  if (
    r === 'group_delete_denied'
    || r === 'policy_group_delete_denied'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Chỉ người tạo nhóm hoặc Super Admin mới có quyền xóa nhóm',
    });
  }
  return res.status(403).json({
    success: false,
    message: 'Không có quyền thực hiện',
  });
}

function legacyMessagesGate(_action, _req, _res, next) {
  return next();
}

/**
 * @param {string} action - messagePolicy action key
 */
function messagesCutoverGate(action) {
  return (req, res, next) => {
    let authority = AUTHORITY.LEGACY;
    try {
      authority = getAuthorizationAuthority('messages');
    } catch (err) {
      authority = AUTHORITY.LEGACY;
      logger.warn(
        {
          event: 'POLICY_CUTOVER_FALLBACK',
          family: 'messages',
          action: `message_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: 'authority_helper_throw',
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] messages authority helper failed — Legacy gate',
      );
    }

    req.authzAuthority = authority;
    req.authzFamily = 'messages';

    if (authority !== AUTHORITY.POLICY) {
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'messages',
          action: `message_${action}`,
          authority: AUTHORITY.LEGACY,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] messages using Legacy authority',
      );
      return legacyMessagesGate(action, req, res, next);
    }

    const shadow = req.policyShadow || {};
    const comparison = shadow.comparison;
    const decision = shadow.policyDecision;
    const reason = shadow.policyReason || '';
    const statusHint = shadow.policyStatusHint;

    if (
      comparison === 'ERROR'
      || comparison === 'UNKNOWN'
      || (decision !== 'ALLOW' && decision !== 'DENY')
    ) {
      logger.warn(
        {
          event: 'POLICY_CUTOVER_FALLBACK',
          family: 'messages',
          action: `message_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: comparison === 'ERROR' ? 'policy_eval_error' : 'policy_unknown_or_malformed',
          comparison: comparison || null,
          policyDecision: decision || null,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] messages Policy unsafe — fallback Legacy',
      );
      req.authzAuthority = AUTHORITY.LEGACY;
      req.policyAuthoritative = false;
      return legacyMessagesGate(action, req, res, next);
    }

    if (decision === 'ALLOW') {
      req.policyAuthoritative = true;
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'messages',
          action: `message_${action}`,
          authority: AUTHORITY.POLICY,
          policyDecision: 'ALLOW',
          policyReason: reason,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] messages Policy ALLOW',
      );
      return next();
    }

    req.policyAuthoritative = true;
    logger.info(
      {
        event: 'POLICY_CUTOVER_AUTHORITY',
        family: 'messages',
        action: `message_${action}`,
        authority: AUTHORITY.POLICY,
        policyDecision: 'DENY',
        policyReason: reason,
        requestId: req.requestId,
        correlationId: req.correlationId,
      },
      '[POLICY_CUTOVER] messages Policy DENY',
    );
    return denyMessages(res, statusHint, reason, action, {
      message: shadow.policyMessage || null,
      code: shadow.policyDenyCode || null,
    });
  };
}

module.exports = {
  messagesCutoverGate,
  denyMessages,
  legacyMessagesGate,
};
