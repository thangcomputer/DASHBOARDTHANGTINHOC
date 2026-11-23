'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const Student = require('../models/Student');
const SystemSettings = require('../models/SystemSettings');
const ConversationAiAutoReply = require('../models/ConversationAiAutoReply');
const AiAutoReplyTask = require('../models/AiAutoReplyTask');
const logger = require('../config/logger');
const {
  getMessagingRole,
  parseDirectConversationTokens,
  isAdminLevelMessagingUser,
  canAccessDirectConversation,
} = require('../utils/messagingRoles');
const { expandConversationIdAliases, assertMessagingPairAllowed } = require('./messagingPairing');
const { enrichMessageIdentities } = require('./messagingIdentity');
const { writeAudit } = require('./auditLogService');
const { invalidateSettingsCache } = require('./settingsCache');
const { enqueueAiAutoReply, cancelAiAutoReplyJob } = require('./queue/jobQueue');
const {
  stripVietnameseMarks,
  classifySecurityRisk,
  classifyItDomainScope,
  searchKnowledge,
  buildRagPromptContext,
} = require('./ai/knowledgeSearchService');
const modelRouter = require('./ai/modelRouter');

const ALLOWED_DELAY_MINUTES = [1, 3, 5, 10, 15, 30];
const DEFAULT_GLOBAL_SETTINGS = Object.freeze({
  enabled: true,
  defaultDelayMinutes: 5,
  allowTeacherToggle: true,
  maxConsecutiveReplies: 2,
  maxDailyRepliesPerConversation: 10,
  updatedBy: '',
  updatedByName: '',
  updatedAt: null,
});

const AI_AUTO_REPLY_CAPTION = 'AI tự động phản hồi vì giảng viên chưa trả lời trong thời gian chờ.';
const SAFE_HANDOFF_TEXT = 'DewSkill AI đã ghi nhận câu hỏi của bạn và chuyển tới giảng viên/Admin để kiểm tra và phản hồi chính xác nhất cho bạn sớm nhé.';
const NEEDS_HUMAN_MARKER = '[[NEEDS_HUMAN]]';

const GLOBAL_CACHE_TTL_MS = 10_000;
let cachedGlobal = null;
let cachedGlobalAt = 0;

let watcherTimer = null;
let watcherBusy = false;
let runtimeIo = null;
let runtimeNotifyUser = null;

// Injectable test hooks for deterministic unit/staging tests
let testHooks = {
  generateReply: null,
  delayScaleMs: null,
};

function _setTestHooks(hooks = {}) {
  testHooks = { ...testHooks, ...hooks };
}

function _resetTestHooks() {
  testHooks = { generateReply: null, delayScaleMs: null };
}

function invalidateGlobalCache() {
  cachedGlobal = null;
  cachedGlobalAt = 0;
}

function vietnamDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date));
}

function normalizeDelayMinutes(raw, fallback = 5) {
  const num = Number(raw);
  if (ALLOWED_DELAY_MINUTES.includes(num)) return num;
  return ALLOWED_DELAY_MINUTES.includes(Number(fallback)) ? Number(fallback) : 5;
}

function getDelayScaleMs() {
  if (typeof testHooks.delayScaleMs === 'number' && Number.isFinite(testHooks.delayScaleMs) && testHooks.delayScaleMs > 0) {
    return testHooks.delayScaleMs;
  }
  const envVal = Number(process.env.AI_AUTO_REPLY_DELAY_SCALE_MS || 0);
  if (Number.isFinite(envVal) && envVal > 0) return envVal;
  return 60_000;
}

function isStaffOrAdminUser(user = {}) {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  const ar = String(user.adminRole || '').toUpperCase();
  return (
    String(user.id || user._id || '') === 'admin'
    || role === 'admin'
    || role === 'staff'
    || role === 'teacher'
    || ar === 'SUPER_ADMIN'
    || ar === 'HIGH_ADMIN'
    || ar === 'STAFF'
    || ar === 'SUPPORT'
  );
}

function isAdminGovernanceUser(user = {}) {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  const ar = String(user.adminRole || '').toUpperCase();
  return (
    String(user.id || user._id || '') === 'admin'
    || isAdminLevelMessagingUser(user)
    || role === 'admin'
    || ar === 'SUPER_ADMIN'
    || ar === 'HIGH_ADMIN'
  );
}

/**
 * Canonicalizes direct conversationId and extracts the Student <-> Teacher/Admin/Staff pair.
 * Returns null for groups, ai_support threads, or non-student pairs.
 */
function parseStudentDirectConversation(conversationId) {
  const cid = String(conversationId || '').trim();
  if (!cid || cid.startsWith('group_') || cid.includes('system_ai_support') || cid.includes('ALL_')) {
    return null;
  }
  const { canonical, ids } = expandConversationIdAliases(cid);
  const tokens = parseDirectConversationTokens(canonical);
  if (!tokens || tokens.length !== 2) return null;

  const studentToken = tokens.find((t) => t.role === 'student');
  const peerToken = tokens.find((t) => t.role !== 'student');
  if (!studentToken || !peerToken) return null;
  if (!['teacher', 'admin', 'staff'].includes(peerToken.role)) return null;

  return {
    canonicalConversationId: canonical,
    aliasConversationIds: ids,
    studentId: String(studentToken.id),
    recipientId: String(peerToken.id),
    recipientRole: String(peerToken.role),
  };
}

function resolveNotificationTargets({ io, notifyUser }) {
  return {
    io: io || runtimeIo,
    notifyUser: typeof notifyUser === 'function' ? notifyUser : runtimeNotifyUser,
  };
}

/**
 * Emit AI Auto-Reply live status strictly to teacher/admin/staff — NEVER to student!
 */
function emitStatusToStaffOnly(targets, parsedConv, statusPayload) {
  const { io, notifyUser } = resolveNotificationTargets(targets || {});
  if (!parsedConv || !statusPayload) return;
  const payload = {
    conversationId: parsedConv.canonicalConversationId,
    aliasConversationIds: parsedConv.aliasConversationIds,
    ...statusPayload,
  };

  if (typeof notifyUser === 'function') {
    if (parsedConv.recipientId === 'admin') {
      notifyUser('admin', 'admin', 'ai-auto-reply:status', payload);
    } else {
      notifyUser(parsedConv.recipientRole, parsedConv.recipientId, 'ai-auto-reply:status', payload);
    }
    return;
  }

  if (io) {
    if (parsedConv.recipientId === 'admin') {
      io.to('admin').to('ALL_ADMIN').emit('ai-auto-reply:status', payload);
    } else {
      io.to(String(parsedConv.recipientId)).emit('ai-auto-reply:status', payload);
    }
  }
}

async function getGlobalAiAutoReplySettings({ bypassCache = false } = {}) {
  const now = Date.now();
  if (!bypassCache && cachedGlobal && now - cachedGlobalAt < GLOBAL_CACHE_TTL_MS) {
    return { ...cachedGlobal };
  }
  try {
    const doc = await SystemSettings.findOne({ _key: 'main' }).select('aiAutoReplyGlobal').lean();
    const raw = doc?.aiAutoReplyGlobal || {};
    const resolved = {
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_GLOBAL_SETTINGS.enabled,
      defaultDelayMinutes: normalizeDelayMinutes(raw.defaultDelayMinutes, DEFAULT_GLOBAL_SETTINGS.defaultDelayMinutes),
      allowTeacherToggle: typeof raw.allowTeacherToggle === 'boolean' ? raw.allowTeacherToggle : DEFAULT_GLOBAL_SETTINGS.allowTeacherToggle,
      maxConsecutiveReplies: Math.min(10, Math.max(1, Number(raw.maxConsecutiveReplies) || DEFAULT_GLOBAL_SETTINGS.maxConsecutiveReplies)),
      maxDailyRepliesPerConversation: Math.min(50, Math.max(1, Number(raw.maxDailyRepliesPerConversation) || DEFAULT_GLOBAL_SETTINGS.maxDailyRepliesPerConversation)),
      updatedBy: String(raw.updatedBy || ''),
      updatedByName: String(raw.updatedByName || ''),
      updatedAt: raw.updatedAt || null,
    };
    cachedGlobal = resolved;
    cachedGlobalAt = now;
    return { ...resolved };
  } catch (err) {
    logger.warn({ err: err?.message }, '[AI Auto-Reply] failed loading global settings, using safe defaults');
    return { ...DEFAULT_GLOBAL_SETTINGS };
  }
}

async function cancelPendingTasksForConversation(aliasIds, {
  cancelledBy = 'system',
  cancelReason = 'disabled_conversation',
  nextConvStatus = 'cancelled_disabled',
  statusReason = 'Đã tắt AI tự động trả lời',
  parsedConv = null,
  io = null,
  notifyUser = null,
} = {}) {
  const now = new Date();
  const pendingTasks = await AiAutoReplyTask.find({
    conversationId: { $in: aliasIds },
    status: 'pending',
  }).select('_id bullJobId triggeringMessageId').lean();

  if (pendingTasks.length > 0) {
    await AiAutoReplyTask.updateMany(
      { _id: { $in: pendingTasks.map((t) => t._id) }, status: 'pending' },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: now,
          cancelledBy: String(cancelledBy || 'system'),
          cancelReason,
        },
      },
    );
    await Promise.all(pendingTasks.map((t) => cancelAiAutoReplyJob(t.bullJobId)));
  }

  if (parsedConv) {
    await ConversationAiAutoReply.findOneAndUpdate(
      { conversationId: parsedConv.canonicalConversationId },
      {
        $set: {
          lastStatus: nextConvStatus,
          lastStatusAt: now,
          lastStatusReason: statusReason,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    emitStatusToStaffOnly({ io, notifyUser }, parsedConv, {
      status: nextConvStatus,
      statusLabel: statusReason,
      reason: statusReason,
      dueAt: null,
      updatedAt: now.toISOString(),
    });
  }

  return pendingTasks.length;
}

async function updateGlobalAiAutoReplySettings(actor, patch = {}, { io = null, notifyUser = null } = {}) {
  if (!isAdminGovernanceUser(actor)) {
    const err = new Error('Chỉ Admin mới có quyền cấu hình AI tự động trả lời toàn hệ thống.');
    err.status = 403;
    throw err;
  }

  const current = await getGlobalAiAutoReplySettings({ bypassCache: true });
  const next = {
    enabled: typeof patch.enabled === 'boolean' ? patch.enabled : current.enabled,
    defaultDelayMinutes: patch.defaultDelayMinutes != null
      ? normalizeDelayMinutes(patch.defaultDelayMinutes, current.defaultDelayMinutes)
      : current.defaultDelayMinutes,
    allowTeacherToggle: typeof patch.allowTeacherToggle === 'boolean'
      ? patch.allowTeacherToggle
      : current.allowTeacherToggle,
    maxConsecutiveReplies: patch.maxConsecutiveReplies != null
      ? Math.min(10, Math.max(1, Number(patch.maxConsecutiveReplies) || current.maxConsecutiveReplies))
      : current.maxConsecutiveReplies,
    maxDailyRepliesPerConversation: patch.maxDailyRepliesPerConversation != null
      ? Math.min(50, Math.max(1, Number(patch.maxDailyRepliesPerConversation) || current.maxDailyRepliesPerConversation))
      : current.maxDailyRepliesPerConversation,
    updatedBy: String(actor.id || actor._id || 'admin'),
    updatedByName: String(actor.name || 'Admin'),
    updatedAt: new Date(),
  };

  await SystemSettings.findOneAndUpdate(
    { _key: 'main' },
    { $set: { aiAutoReplyGlobal: next } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
  invalidateGlobalCache();
  invalidateSettingsCache();

  let cancelledPendingCount = 0;
  // Admin kill-switch: shutting OFF globally immediately cancels all pending tasks across all conversations
  if (current.enabled && next.enabled === false) {
    const pending = await AiAutoReplyTask.find({ status: 'pending' }).lean();
    if (pending.length > 0) {
      const now = new Date();
      await AiAutoReplyTask.updateMany(
        { _id: { $in: pending.map((t) => t._id) }, status: 'pending' },
        {
          $set: {
            status: 'cancelled',
            cancelledAt: now,
            cancelledBy: next.updatedBy,
            cancelReason: 'disabled_global',
          },
        },
      );
      cancelledPendingCount = pending.length;
      await Promise.all(pending.map((t) => cancelAiAutoReplyJob(t.bullJobId)));
      const seenConvs = new Set();
      for (const task of pending) {
        if (seenConvs.has(task.conversationId)) continue;
        seenConvs.add(task.conversationId);
        await ConversationAiAutoReply.updateOne(
          { conversationId: task.conversationId },
          {
            $set: {
              lastStatus: 'cancelled_disabled',
              lastStatusAt: now,
              lastStatusReason: 'Admin đã tắt AI toàn hệ thống',
            },
          },
        );
        const parsed = parseStudentDirectConversation(task.conversationId);
        if (parsed) {
          emitStatusToStaffOnly({ io, notifyUser }, parsed, {
            status: 'cancelled_disabled',
            statusLabel: 'Admin đã tắt AI tự động trả lời toàn hệ thống',
            reason: 'disabled_global',
            dueAt: null,
            globalEnabled: false,
          });
        }
      }
    }
  }

  await writeAudit({
    action: 'AI_AUTO_REPLY_GLOBAL_UPDATED',
    actorUserId: next.updatedBy,
    actorRole: String(actor.role || 'admin'),
    entityType: 'SystemSettings',
    entityId: 'main',
    oldValue: current,
    newValue: { ...next, cancelledPendingCount },
  });

  return { ...next, cancelledPendingCount };
}

/**
 * Enforces strict backend RBAC for per-conversation AI Auto-Reply settings.
 * - Students NEVER allowed (403).
 * - Unassigned teachers NEVER allowed to inspect/toggle other conversations (403).
 * - Admin can view & disable any eligible student direct conversation.
 */
async function assertCanManageConversationAiAutoReply(user, conversationId, { action = 'view', requestedEnabled } = {}) {
  if (!user || !user.id) {
    const err = new Error('Chưa xác thực');
    err.status = 401;
    throw err;
  }
  const role = String(user.role || '').toLowerCase();
  if (role === 'student' || getMessagingRole(user) === 'student' || !isStaffOrAdminUser(user)) {
    const err = new Error('Học viên không có quyền cài đặt AI tự động trả lời.');
    err.status = 403;
    throw err;
  }

  const parsed = parseStudentDirectConversation(conversationId);
  if (!parsed) {
    const err = new Error('Tính năng AI tự động trả lời chỉ áp dụng cho hộp thư trực tiếp với học viên.');
    err.status = 400;
    throw err;
  }

  const isAdmin = isAdminGovernanceUser(user);
  const canAccess = parsed.aliasConversationIds.some((id) => canAccessDirectConversation(id, user));

  if (!isAdmin) {
    if (!canAccess) {
      const err = new Error('Bạn không có quyền truy cập hoặc cấu hình cuộc hội thoại này.');
      err.status = 403;
      throw err;
    }
    if (getMessagingRole(user) === 'teacher' || role === 'teacher') {
      // Verify live assignment scope so an unassigned teacher cannot configure another teacher's student DM
      const pairCheck = await assertMessagingPairAllowed(user, parsed.studentId, 'student');
      if (!pairCheck?.ok) {
        const err = new Error(pairCheck?.message || 'Giảng viên chỉ được cấu hình AI cho học viên được phân công.');
        err.status = 403;
        throw err;
      }
    }
  }

  const global = await getGlobalAiAutoReplySettings();
  if (action === 'update') {
    if (!global.enabled && !isAdmin) {
      const err = new Error('Admin đã khóa tính năng AI tự động trả lời toàn hệ thống.');
      err.status = 403;
      throw err;
    }
    if (!global.enabled && isAdmin && requestedEnabled === true) {
      const err = new Error('Tính năng AI tự động trả lời đang tắt toàn hệ thống. Hãy bật trong Cài đặt hệ thống trước.');
      err.status = 403;
      throw err;
    }
    if (!global.allowTeacherToggle && !isAdmin) {
      const err = new Error('Admin hiện không cho phép giảng viên tự bật/tắt AI tự động trả lời.');
      err.status = 403;
      throw err;
    }
  }

  return { parsed, global, isAdmin };
}

function buildStatusLabel(status, { reason = '', delayMinutes = 5 } = {}) {
  switch (status) {
    case 'pending':
      return 'AI đang chờ';
    case 'processing':
      return 'AI đang xử lý phản hồi...';
    case 'cancelled_human':
      return reason || 'Đã hủy vì giảng viên trả lời';
    case 'cancelled_disabled':
      return reason || 'AI tự động trả lời đã tắt';
    case 'sent':
      return 'AI đã tự động trả lời';
    case 'needs_human':
      return 'AI không thể trả lời, cần giảng viên hỗ trợ';
    case 'rate_limited':
      return reason || 'AI tạm dừng do đạt giới hạn tự động trả lời';
    case 'failed':
      return 'AI không thể trả lời, cần giảng viên hỗ trợ';
    default:
      return `Chờ ${delayMinutes} phút`;
  }
}

async function getConversationAiAutoReplyState(user, conversationId) {
  const { parsed, global, isAdmin } = await assertCanManageConversationAiAutoReply(user, conversationId, { action: 'view' });

  const [convDoc, activeTask] = await Promise.all([
    ConversationAiAutoReply.findOne({ conversationId: parsed.canonicalConversationId }).lean(),
    AiAutoReplyTask.findOne({
      conversationId: { $in: parsed.aliasConversationIds },
      status: { $in: ['pending', 'processing'] },
    }).sort({ createdAt: -1 }).lean(),
  ]);

  const delayMinutes = normalizeDelayMinutes(convDoc?.delayMinutes, global.defaultDelayMinutes);
  const enabled = Boolean(convDoc?.enabled) && global.enabled;
  const effectiveCanToggle = isAdmin ? global.enabled : (global.enabled && global.allowTeacherToggle);

  let lockedReason = '';
  if (!global.enabled) {
    lockedReason = 'Admin đang tắt tính năng AI tự động trả lời toàn hệ thống.';
  } else if (!global.allowTeacherToggle && !isAdmin) {
    lockedReason = 'Admin hiện khóa quyền tự bật/tắt AI của giảng viên.';
  }

  let status = convDoc?.lastStatus || 'idle';
  let statusReason = convDoc?.lastStatusReason || '';
  let dueAt = null;

  if (activeTask) {
    status = activeTask.status;
    dueAt = activeTask.dueAt ? new Date(activeTask.dueAt).toISOString() : null;
  }

  const today = vietnamDateKey();
  const dailyAiReplyCount = convDoc?.dailyAiReplyDate === today ? Number(convDoc.dailyAiReplyCount || 0) : 0;

  return {
    conversationId: parsed.canonicalConversationId,
    enabled,
    configuredEnabled: Boolean(convDoc?.enabled),
    delayMinutes,
    globalEnabled: global.enabled,
    allowTeacherToggle: global.allowTeacherToggle,
    canToggle: effectiveCanToggle,
    lockedReason,
    updatedBy: convDoc?.updatedBy || '',
    updatedByName: convDoc?.updatedByName || '',
    updatedAt: convDoc?.updatedAt || null,
    status,
    statusLabel: buildStatusLabel(status, { reason: statusReason, delayMinutes }),
    dueAt,
    triggeringMessageId: activeTask?.triggeringMessageId || convDoc?.lastTriggeringMessageId || '',
    lastStatus: convDoc?.lastStatus || 'idle',
    lastStatusAt: convDoc?.lastStatusAt || null,
    lastStatusReason: statusReason,
    consecutiveAiReplies: Number(convDoc?.consecutiveAiReplies || 0),
    dailyAiReplyCount,
    maxConsecutiveReplies: global.maxConsecutiveReplies,
    maxDailyRepliesPerConversation: global.maxDailyRepliesPerConversation,
  };
}

async function updateConversationAiAutoReplyConfig(user, conversationId, patch = {}, { io = null, notifyUser = null } = {}) {
  const { parsed, global, isAdmin } = await assertCanManageConversationAiAutoReply(user, conversationId, {
    action: 'update',
    requestedEnabled: patch.enabled,
  });
  const existing = await ConversationAiAutoReply.findOne({ conversationId: parsed.canonicalConversationId }).lean();

  const nextEnabled = typeof patch.enabled === 'boolean'
    ? patch.enabled
    : Boolean(existing?.enabled);
  const nextDelayMinutes = patch.delayMinutes != null
    ? normalizeDelayMinutes(patch.delayMinutes, existing?.delayMinutes || global.defaultDelayMinutes)
    : normalizeDelayMinutes(existing?.delayMinutes, global.defaultDelayMinutes);

  if (patch.delayMinutes != null && !ALLOWED_DELAY_MINUTES.includes(Number(patch.delayMinutes))) {
    const err = new Error(`Thời gian chờ chỉ hỗ trợ: ${ALLOWED_DELAY_MINUTES.join(', ')} phút.`);
    err.status = 400;
    throw err;
  }

  if (nextEnabled && !global.enabled) {
    const err = new Error('Tính năng AI tự động trả lời đang tắt toàn hệ thống.');
    err.status = 403;
    throw err;
  }
  if (!isAdmin && !global.allowTeacherToggle) {
    const err = new Error('Admin không cho phép giảng viên thay đổi cài đặt AI.');
    err.status = 403;
    throw err;
  }

  const now = new Date();
  const actorId = String(user.id || user._id || '');
  const actorName = String(user.name || (isAdmin ? 'Admin' : 'Giảng viên'));
  const actorRole = getMessagingRole(user);

  let auditAction = 'delay_change';
  if (typeof patch.enabled === 'boolean' && patch.enabled !== Boolean(existing?.enabled)) {
    auditAction = patch.enabled ? 'enable' : 'disable';
  }

  const updateFields = {
    conversationId: parsed.canonicalConversationId,
    enabled: nextEnabled,
    delayMinutes: nextDelayMinutes,
    updatedBy: actorId,
    updatedByName: actorName,
    updatedByRole: actorRole,
    updatedAt: now,
  };
  if (nextEnabled && (!existing?.lastStatus || existing?.lastStatus === 'cancelled_disabled')) {
    updateFields.lastStatus = 'idle';
    updateFields.lastStatusAt = now;
    updateFields.lastStatusReason = '';
  }

  await ConversationAiAutoReply.findOneAndUpdate(
    { conversationId: parsed.canonicalConversationId },
    {
      $set: updateFields,
      $push: {
        auditLogs: {
          $each: [{
            action: auditAction,
            enabled: nextEnabled,
            delayMinutes: nextDelayMinutes,
            actorId,
            actorName,
            actorRole,
            note: `enabled=${nextEnabled}, delayMinutes=${nextDelayMinutes}`,
            at: now,
          }],
          $slice: -50,
        },
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );

  // If switched OFF -> immediately cancel pending tasks
  if (!nextEnabled) {
    await cancelPendingTasksForConversation(parsed.aliasConversationIds, {
      cancelledBy: actorId,
      cancelReason: 'disabled_conversation',
      nextConvStatus: 'cancelled_disabled',
      statusReason: `${isAdmin ? 'Admin' : 'Giảng viên'} đã tắt AI tự động trả lời`,
      parsedConv: parsed,
      io,
      notifyUser,
    });
  } else if (patch.delayMinutes != null) {
    // If delayMinutes changed while a pending task exists -> update dueAt & reschedule delayed job
    const pendingTask = await AiAutoReplyTask.findOne({
      conversationId: { $in: parsed.aliasConversationIds },
      status: 'pending',
    });
    if (pendingTask) {
      const nextDueAt = new Date(
        Math.max(
          Date.now(),
          new Date(pendingTask.triggeringMessageAt || pendingTask.scheduledAt || now).getTime()
            + nextDelayMinutes * getDelayScaleMs(),
        ),
      );
      const nextJobId = `autoreply-job:${pendingTask._id}:${Date.now()}`;
      const oldJobId = pendingTask.bullJobId;
      await AiAutoReplyTask.updateOne(
        { _id: pendingTask._id, status: 'pending' },
        { $set: { delayMinutes: nextDelayMinutes, dueAt: nextDueAt, bullJobId: nextJobId } },
      );
      await cancelAiAutoReplyJob(oldJobId);
      await enqueueAiAutoReply(
        { taskId: String(pendingTask._id) },
        { delayMs: nextDueAt.getTime() - Date.now(), jobId: nextJobId },
      );
      emitStatusToStaffOnly({ io, notifyUser }, parsed, {
        status: 'pending',
        statusLabel: 'AI đang chờ',
        dueAt: nextDueAt.toISOString(),
        delayMinutes: nextDelayMinutes,
        enabled: true,
      });
    }
  }

  await writeAudit({
    action: `AI_AUTO_REPLY_CONV_${auditAction.toUpperCase()}`,
    actorUserId: actorId,
    actorRole,
    studentId: mongoose.Types.ObjectId.isValid(parsed.studentId) ? parsed.studentId : null,
    teacherId: parsed.recipientRole === 'teacher' && mongoose.Types.ObjectId.isValid(parsed.recipientId) ? parsed.recipientId : null,
    entityType: 'ConversationAiAutoReply',
    entityId: parsed.canonicalConversationId,
    oldValue: existing ? { enabled: existing.enabled, delayMinutes: existing.delayMinutes } : {},
    newValue: { enabled: nextEnabled, delayMinutes: nextDelayMinutes },
  });

  logger.info(
    {
      conversationId: parsed.canonicalConversationId,
      actorId,
      actorRole,
      enabled: nextEnabled,
      delayMinutes: nextDelayMinutes,
    },
    '[AI Auto-Reply] conversation config updated',
  );

  return getConversationAiAutoReplyState(user, parsed.canonicalConversationId);
}

async function adminDisableConversationAutoReply(adminUser, conversationId, { io = null, notifyUser = null } = {}) {
  if (!isAdminGovernanceUser(adminUser)) {
    const err = new Error('Chỉ Admin mới có quyền tắt AI ở cuộc hội thoại bất kỳ.');
    err.status = 403;
    throw err;
  }
  const parsed = parseStudentDirectConversation(conversationId);
  if (!parsed) {
    const err = new Error('conversationId không hợp lệ.');
    err.status = 400;
    throw err;
  }

  const now = new Date();
  const actorId = String(adminUser.id || adminUser._id || 'admin');
  const actorName = String(adminUser.name || 'Admin');

  await ConversationAiAutoReply.findOneAndUpdate(
    { conversationId: parsed.canonicalConversationId },
    {
      $set: {
        enabled: false,
        updatedBy: actorId,
        updatedByName: actorName,
        updatedByRole: 'admin',
        updatedAt: now,
        lastStatus: 'cancelled_disabled',
        lastStatusAt: now,
        lastStatusReason: 'Admin đã tắt AI trong cuộc hội thoại',
      },
      $push: {
        auditLogs: {
          $each: [{
            action: 'admin_disable',
            enabled: false,
            delayMinutes: 5,
            actorId,
            actorName,
            actorRole: 'admin',
            note: 'Admin force-disabled conversation',
            at: now,
          }],
          $slice: -50,
        },
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );

  const cancelledCount = await cancelPendingTasksForConversation(parsed.aliasConversationIds, {
    cancelledBy: actorId,
    cancelReason: 'disabled_admin',
    nextConvStatus: 'cancelled_disabled',
    statusReason: 'Admin đã tắt AI trong cuộc hội thoại',
    parsedConv: parsed,
    io,
    notifyUser,
  });

  await writeAudit({
    action: 'AI_AUTO_REPLY_ADMIN_DISABLE',
    actorUserId: actorId,
    actorRole: 'admin',
    entityType: 'ConversationAiAutoReply',
    entityId: parsed.canonicalConversationId,
    newValue: { enabled: false, cancelledCount },
  });

  return { conversationId: parsed.canonicalConversationId, enabled: false, cancelledCount };
}

async function listAiAutoReplyHistory(adminUser, { page = 1, limit = 25, status = '', conversationId = '' } = {}) {
  if (!isAdminGovernanceUser(adminUser)) {
    const err = new Error('Chỉ Admin mới có quyền xem lịch sử AI tự động trả lời.');
    err.status = 403;
    throw err;
  }

  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  const filter = {};
  if (status && ['pending', 'processing', 'sent', 'cancelled', 'needs_human', 'failed'].includes(status)) {
    filter.status = status;
  }
  if (conversationId) {
    const { ids } = expandConversationIdAliases(String(conversationId));
    filter.conversationId = { $in: ids };
  }

  const [items, total, countsAgg, enabledConversations, global] = await Promise.all([
    AiAutoReplyTask.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    AiAutoReplyTask.countDocuments(filter),
    AiAutoReplyTask.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ConversationAiAutoReply.find({ enabled: true })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean(),
    getGlobalAiAutoReplySettings(),
  ]);

  const counts = { pending: 0, processing: 0, sent: 0, cancelled: 0, needs_human: 0, failed: 0 };
  for (const row of countsAgg) {
    if (row?._id && Object.prototype.hasOwnProperty.call(counts, row._id)) {
      counts[row._id] = Number(row.count) || 0;
    }
  }

  return {
    items,
    total,
    page: safePage,
    limit: safeLimit,
    counts,
    enabledConversations,
    global,
  };
}

/**
 * Post-send hook invoked right after any canonical DM persists in `directMessageService`.
 * Never blocks message delivery; cancels pending AI tasks when human replies or schedules/coalesces on student message.
 */
async function handlePostMessageAutoReply({
  message,
  sender,
  conversationId,
  isGroup = false,
  io = null,
  notifyUser = null,
} = {}) {
  if (!message || isGroup) return { skipped: 'not_dm' };
  if (String(message.messageType || '') === 'system') return { skipped: 'system_message' };
  if (String(message.senderType || '') === 'ai' || String(message.senderId || '') === 'ai_support') {
    return { skipped: 'ai_self_message' };
  }

  const parsed = parseStudentDirectConversation(conversationId || message.conversationId);
  if (!parsed) return { skipped: 'not_student_dm' };

  const senderId = String(message.senderId || sender?.id || sender?._id || '');
  const senderRole = String(message.senderRole || getMessagingRole(sender || {}) || '').toLowerCase();
  const isStudentSender = senderRole === 'student' && senderId === parsed.studentId;
  const isHumanStaffReply =
    !isStudentSender
    && (
      ['teacher', 'admin', 'staff'].includes(senderRole)
      || (parsed.recipientId === 'admin' && isAdminLevelMessagingUser(sender || {}))
    );

  // Case A: Teacher / Admin / Staff manually replied -> IMMEDIATELY cancel pending AI task(s)
  if (isHumanStaffReply) {
    const now = new Date();
    const pendingTasks = await AiAutoReplyTask.find({
      conversationId: { $in: parsed.aliasConversationIds },
      status: 'pending',
    }).select('_id bullJobId').lean();

    const isAdminActor = senderRole === 'admin' || isAdminLevelMessagingUser(sender || {});
    const reasonText = isAdminActor ? 'Đã hủy vì Admin trả lời' : 'Đã hủy vì giảng viên trả lời';

    if (pendingTasks.length > 0) {
      await AiAutoReplyTask.updateMany(
        { _id: { $in: pendingTasks.map((t) => t._id) }, status: 'pending' },
        {
          $set: {
            status: 'cancelled',
            cancelledAt: now,
            cancelledBy: senderId,
            cancelReason: 'human_replied',
          },
        },
      );
      await Promise.all(pendingTasks.map((t) => cancelAiAutoReplyJob(t.bullJobId)));
    }

    const convUpdate = { consecutiveAiReplies: 0 };
    if (pendingTasks.length > 0) {
      convUpdate.lastStatus = 'cancelled_human';
      convUpdate.lastStatusAt = now;
      convUpdate.lastStatusReason = reasonText;
    }

    await ConversationAiAutoReply.updateOne(
      { conversationId: parsed.canonicalConversationId },
      { $set: convUpdate },
    );

    if (pendingTasks.length > 0) {
      emitStatusToStaffOnly({ io, notifyUser }, parsed, {
        status: 'cancelled_human',
        statusLabel: reasonText,
        reason: reasonText,
        dueAt: null,
        updatedAt: now.toISOString(),
      });
    }

    return { action: 'cancelled_human', cancelledCount: pendingTasks.length };
  }

  // Case B: Student sent message -> schedule or coalesce waiting AI task if enabled
  if (!isStudentSender) return { skipped: 'unrecognized_sender' };

  const [global, convConfig] = await Promise.all([
    getGlobalAiAutoReplySettings(),
    ConversationAiAutoReply.findOne({ conversationId: parsed.canonicalConversationId }).lean(),
  ]);

  if (!global.enabled || !convConfig?.enabled) {
    return { skipped: !global.enabled ? 'global_disabled' : 'conv_disabled' };
  }

  const now = new Date();
  const today = vietnamDateKey(now);
  const dailyCount = convConfig.dailyAiReplyDate === today ? Number(convConfig.dailyAiReplyCount || 0) : 0;
  const consecutive = Number(convConfig.consecutiveAiReplies || 0);

  if (consecutive >= global.maxConsecutiveReplies || dailyCount >= global.maxDailyRepliesPerConversation) {
    const rateReason = consecutive >= global.maxConsecutiveReplies
      ? 'AI tạm dừng vì đã đạt giới hạn trả lời tự động liên tiếp, chờ giảng viên phản hồi.'
      : 'AI tạm dừng vì đã đạt giới hạn tự động trả lời trong ngày cho hội thoại này.';
    await ConversationAiAutoReply.updateOne(
      { conversationId: parsed.canonicalConversationId },
      { $set: { lastStatus: 'rate_limited', lastStatusAt: now, lastStatusReason: rateReason } },
    );
    emitStatusToStaffOnly({ io, notifyUser }, parsed, {
      status: 'rate_limited',
      statusLabel: rateReason,
      reason: rateReason,
      dueAt: null,
      updatedAt: now.toISOString(),
    });
    return { skipped: 'rate_limited' };
  }

  const msgId = String(message._id || message.id || '');
  const msgCreatedAt = message.createdAt ? new Date(message.createdAt) : now;
  const delayMinutes = normalizeDelayMinutes(convConfig.delayMinutes, global.defaultDelayMinutes);
  const dueAt = new Date(msgCreatedAt.getTime() + delayMinutes * getDelayScaleMs());
  const idempotencyKey = `autoreply:${parsed.canonicalConversationId}:${msgId}`;
  const bullJobId = `autoreply:${parsed.canonicalConversationId}:${msgId}:${Date.now()}`;

  // Coalesce burst of consecutive student messages into a SINGLE pending wait task
  const existingPending = await AiAutoReplyTask.findOne({
    conversationId: { $in: parsed.aliasConversationIds },
    status: 'pending',
  }).sort({ createdAt: -1 });

  let taskDoc = null;
  if (existingPending) {
    const oldBullJobId = existingPending.bullJobId;
    taskDoc = await AiAutoReplyTask.findOneAndUpdate(
      { _id: existingPending._id, status: 'pending' },
      {
        $set: {
          conversationId: parsed.canonicalConversationId,
          aliasConversationIds: parsed.aliasConversationIds,
          studentName: String(message.senderName || existingPending.studentName || ''),
          recipientName: String(message.receiverName || existingPending.recipientName || ''),
          triggeringMessageId: msgId,
          triggeringMessageAt: msgCreatedAt,
          delayMinutes,
          scheduledAt: now,
          dueAt,
          idempotencyKey,
          bullJobId,
        },
        $addToSet: { burstMessageIds: msgId },
      },
      { returnDocument: 'after' },
    );
    if (oldBullJobId) {
      await cancelAiAutoReplyJob(oldBullJobId);
    }
  }

  if (!taskDoc) {
    taskDoc = await AiAutoReplyTask.create({
      conversationId: parsed.canonicalConversationId,
      aliasConversationIds: parsed.aliasConversationIds,
      studentId: parsed.studentId,
      studentName: String(message.senderName || 'Học viên'),
      recipientId: parsed.recipientId,
      recipientRole: parsed.recipientRole,
      recipientName: String(message.receiverName || ''),
      triggeringMessageId: msgId,
      triggeringMessageAt: msgCreatedAt,
      burstMessageIds: [msgId],
      delayMinutes,
      scheduledAt: now,
      dueAt,
      status: 'pending',
      idempotencyKey,
      bullJobId,
    });
  }

  await ConversationAiAutoReply.updateOne(
    { conversationId: parsed.canonicalConversationId },
    {
      $set: {
        lastStatus: 'pending',
        lastStatusAt: now,
        lastStatusReason: 'AI đang chờ',
        lastTriggeringMessageId: msgId,
      },
    },
  );

  await enqueueAiAutoReply(
    { taskId: String(taskDoc._id) },
    { delayMs: Math.max(0, dueAt.getTime() - Date.now()), jobId: bullJobId },
  );

  emitStatusToStaffOnly({ io, notifyUser }, parsed, {
    status: 'pending',
    statusLabel: 'AI đang chờ',
    dueAt: dueAt.toISOString(),
    delayMinutes,
    triggeringMessageId: msgId,
    enabled: true,
  });

  return { action: 'scheduled', taskId: String(taskDoc._id), dueAt };
}

/**
 * Distinguishes personal/billing/grade/schedule center-record questions (MUST NOT fabricate!)
 * from general Office/IT/how-to questions mentioning keywords like "hàm tính điểm" or "bảng học phí Excel".
 */
function isSensitivePersonalOrAcademicInquiry(text) {
  const folded = stripVietnameseMarks(String(text || '')).toLowerCase().trim();
  if (!folded) return false;

  // Explicit general Excel/Word/PPT software/formula how-to patterns are safe Office/IT questions
  const isSoftwareHowTo =
    /\b(excel|word|powerpoint|google\s*sheets?|access|vlookup|xlookup|sumif|average|ham\s+|cong\s*thuc|mau\s*bang|pivot|mos|ic3|gmetrix)\b/.test(folded)
    && /\b(cach\s*(?:tinh|tao|dung|lam|su\s*dung|dinh\s*dang)|huong\s*dan|ham\s*nao|cong\s*thuc\s*nao|vi\s*du)\b/.test(folded)
    && !/\b(cua\s*(?:em|minh|toi|con)|da\s*(?:dong|chuyen\s*khoan|nop)|bao\s*nhieu\s*diem|ket\s*qua\s*(?:thi\s*)?cua\s*(?:em|minh|toi))\b/.test(folded);

  if (isSoftwareHowTo) return false;

  const personalPatterns = [
    // Personal schedule / attendance / class time / meet link / rescheduling
    /\b(lich\s*hoc|gio\s*hoc|buoi\s*hoc|ngay\s*hoc|thoi\s*khoa\s*bieu|phong\s*hoc|link\s*(?:meet|zoom|lop)|xin\s*nghi|nghi\s*buoi|doi\s*lich|chuyen\s*lich|bao\s*luu|diem\s*danh|da\s*hoc\s*bao\s*nhieu\s*buoi|con\s*bao\s*nhieu\s*buoi|hoc\s*bu|sap\s*lich)\b/,
    // Tuition / payment / invoice / refund / discount
    /\b(hoc\s*phi|dong\s*tien|nop\s*tien|chuyen\s*khoan|thanh\s*toan|cong\s*no|con\s*no|hoan\s*(?:tien|hoc\s*phi)|bien\s*lai|hoa\s*don|bao\s*nhieu\s*tien|gia\s*khoa\s*hoc|uu\s*dai\s*hoc\s*phi|giam\s*hoc\s*phi|xac\s*nhan\s*(?:da\s*)?(?:chuyen|dong))\b/,
    // Personal scores / exam results / certificate status / account management / other students
    /\b(diem\s*(?:so|thi|kiem\s*tra|trung\s*binh|cua\s*(?:em|minh|toi)|hoc\s*vien)|ket\s*qua\s*thi\s*(?:cua\s*(?:em|minh|toi)|mos|ic3)|co\s*(?:dau|do|dat)\s*khong|bang\s*cap|chung\s*chi\s*cua\s*(?:em|minh|toi)|cap\s*bang|mo\s*khoa\s*(?:bai|thi|tai\s*khoan)|reset\s*(?:mat\s*khau|thiet\s*bi)|doi\s*mat\s*khau\s*giup|thong\s*tin\s*(?:ca\s*nhan|hoc\s*vien\s*khac))\b/,
    // Explicitly asking personal pronoun status: "em được mấy điểm", "tôi nợ mấy buổi"
    /\b(em|minh|toi)\s+(?:duoc|con|no|dong|thi|hoc)\s+(?:may\s*(?:diem|buoi)|bao\s*nhieu|khi\s*nao|may\s*gio)\b/,
  ];

  return personalPatterns.some((re) => re.test(folded));
}

function formatRagRefLocation(location) {
  if (!location) return '';
  if (typeof location === 'string') return location;
  if (typeof location === 'object') {
    const parts = [location.sectionTitle, location.page ? `Trang ${location.page}` : ''].filter(Boolean);
    return parts.join(' - ');
  }
  return String(location);
}

/**
 * Core DewSkill AI response generator for inbox auto-reply.
 * Strictly isolated to `studentText` + student-safe RAG (`['public', 'student']` ONLY).
 */
async function generateAutoReplyContent({
  combinedStudentText,
  recentConversationMessages = [],
  studentName = 'Học viên',
  studentId = '',
}) {
  const question = String(combinedStudentText || '').trim();
  if (!question) {
    return {
      needsHuman: true,
      content: SAFE_HANDOFF_TEXT,
      knowledgeReferences: [],
      model: 'empty_handoff',
      errorMessage: 'Empty student text',
    };
  }

  // 1. Security / prompt-injection gate
  const sec = classifySecurityRisk(question);
  if (sec.blocked) {
    return {
      needsHuman: true,
      content: SAFE_HANDOFF_TEXT,
      knowledgeReferences: [],
      model: 'security_handoff',
      errorMessage: sec.reason || 'security_blocked',
    };
  }

  // 2. Anti-fabrication gate for personal schedules, tuition, grades, payments, personal data
  if (isSensitivePersonalOrAcademicInquiry(question)) {
    return {
      needsHuman: true,
      content: SAFE_HANDOFF_TEXT,
      knowledgeReferences: [],
      model: 'policy_handoff',
      errorMessage: '',
    };
  }

  // 3. Test hook override (unit / integration tests)
  if (typeof testHooks.generateReply === 'function') {
    return testHooks.generateReply({
      question,
      recentConversationMessages,
      studentName,
      studentId,
    });
  }

  // 4. IT / Office / LMS semantic scope + strictly student-safe RAG lookup
  const scope = classifyItDomainScope(question, []);
  const ragResult = await searchKnowledge(question, {
    user: { id: studentId || 'student-autoreply', role: 'student' },
    topK: 4,
  }).catch(() => ({ hits: [] }));
  const hits = Array.isArray(ragResult?.hits) ? ragResult.hits : [];
  const knowledgeReferences = hits.map((h) => ({
    docId: String(h.docId || ''),
    docTitle: String(h.docTitle || ''),
    location: formatRagRefLocation(h.location),
    score: Number(h.score) || 0,
  }));

  if (scope?.decision === 'OUT_OF_SCOPE' && hits.length === 0) {
    return {
      needsHuman: true,
      content: SAFE_HANDOFF_TEXT,
      knowledgeReferences: [],
      model: 'scope_handoff',
      errorMessage: '',
    };
  }

  const ragContext = buildRagPromptContext(hits, 'vi', { maxChunks: 4, maxSnippetChars: 650 });
  const historyLines = (recentConversationMessages || [])
    .slice(-6)
    .map((m) => {
      const who = String(m.senderId) === String(studentId)
        ? `Học viên (${studentName || 'HV'})`
        : (String(m.senderId) === 'ai_support' ? 'DewSkill AI' : 'Giảng viên/Admin');
      return `${who}: ${String(m.content || '').trim().slice(0, 400)}`;
    })
    .filter(Boolean)
    .join('\n');

  const systemPrompt = [
    'Bạn là DewSkill AI – Trợ lý AI của trung tâm Thắng Tin Học.',
    'Bối cảnh: Học viên vừa nhắn tin trong hộp thư cho Giảng viên/Admin nhưng chưa nhận được phản hồi trong thời gian chờ, nên bạn tạm thời hỗ trợ trả lời nhanh trước.',
    '',
    'NGUYÊN TẮC BẮT BUỘC:',
    '1. Mặc định trả lời bằng tiếng Việt rõ ràng, lịch sự, xưng hô thân thiện (chào bạn / mình - gọi bạn).',
    '2. Tuyệt đối KHÔNG giả danh giảng viên hoặc Admin.',
    '3. Đối với câu hỏi Tin học văn phòng (Word, Excel, PowerPoint, Access, MOS, IC3, ICDL, GMetrix...), CNTT, máy tính, phần mềm, hoặc cách dùng LMS chung: hãy hướng dẫn cụ thể, dễ hiểu theo từng bước.',
    '4. Tuyệt đối KHÔNG BỊA: lịch học cụ thể, học phí, số tiền đóng, điểm số, trạng thái thanh toán, thông tin cá nhân hoặc dữ liệu của học viên khác.',
    `5. Nếu câu hỏi cần kiểm tra hồ sơ cá nhân, xử lý nghiệp vụ nội bộ hoặc bạn không có đủ thông tin tin cậy, CHỈ trả về đúng chuỗi: ${NEEDS_HUMAN_MARKER}`,
    ragContext ? `\n${ragContext}` : '',
  ].filter(Boolean).join('\n');

  const userPrompt = [
    historyLines ? `Ngữ cảnh hội thoại gần nhất trong cuộc trò chuyện này:\n${historyLines}\n` : '',
    `Câu hỏi hiện tại của học viên:\n${question}`,
  ].filter(Boolean).join('\n');

  const taskProfile = modelRouter.isComplexQuery(question) ? 'qa_complex' : 'qa_simple';
  try {
    const res = await modelRouter.chatWithProfile(taskProfile, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 900,
      temperature: 0.25,
      timeoutMs: 15_000,
    });

    const rawText = String(res?.content || '').trim();
    if (!rawText || rawText.includes(NEEDS_HUMAN_MARKER)) {
      return {
        needsHuman: true,
        content: SAFE_HANDOFF_TEXT,
        knowledgeReferences,
        model: res?.model || taskProfile,
        errorMessage: '',
      };
    }

    return {
      needsHuman: false,
      content: rawText.slice(0, 8000),
      knowledgeReferences,
      model: res?.model || taskProfile,
      errorMessage: '',
    };
  } catch (err) {
    logger.warn({ err: err?.message }, '[AI Auto-Reply] Gemini/LLM failed, switching safely to needs_human');
    return {
      needsHuman: true,
      content: SAFE_HANDOFF_TEXT,
      knowledgeReferences,
      model: 'fallback_handoff',
      errorMessage: String(err?.message || 'LLM request failed').slice(0, 300),
    };
  }
}

async function checkHumanRepliedSince(aliasIds, studentId, triggeringMessageAt, triggeringMessageId) {
  const afterQuery = {
    conversationId: { $in: aliasIds },
    senderId: { $nin: [String(studentId), 'ai_support'] },
    senderType: { $ne: 'ai' },
    messageType: { $ne: 'system' },
    isRecalled: { $ne: true },
    $or: [
      { createdAt: { $gt: triggeringMessageAt } },
      ...(mongoose.Types.ObjectId.isValid(triggeringMessageId)
        ? [{ createdAt: triggeringMessageAt, _id: { $ne: new mongoose.Types.ObjectId(triggeringMessageId) } }]
        : []),
    ],
  };
  return Message.exists(afterQuery);
}

/**
 * Executes a pending Auto-Reply task under atomic compare-and-set locking,
 * double race verification (before & after AI generation), and idempotent message persistence.
 */
async function executeAutoReplyTask(taskId, { io = null, notifyUser = null } = {}) {
  if (!taskId || !mongoose.Types.ObjectId.isValid(String(taskId))) {
    return { ok: false, skipped: 'invalid_task_id' };
  }

  const now = new Date();
  const lockToken = crypto.randomUUID();
  // Atomic CAS claim: only ONE worker can transition pending -> processing
  const claimed = await AiAutoReplyTask.findOneAndUpdate(
    {
      _id: taskId,
      status: 'pending',
      dueAt: { $lte: new Date(now.getTime() + 250) },
    },
    {
      $set: {
        status: 'processing',
        lockToken,
        lockedAt: now,
      },
      $inc: { attempts: 1 },
    },
    { returnDocument: 'after' },
  );

  if (!claimed) {
    return { ok: false, skipped: 'not_claimable' };
  }

  const parsed = parseStudentDirectConversation(claimed.conversationId);
  const aliasIds = claimed.aliasConversationIds?.length
    ? claimed.aliasConversationIds
    : (parsed?.aliasConversationIds || [claimed.conversationId]);

  const abortCancelled = async (cancelReason, convStatus, statusReason) => {
    await AiAutoReplyTask.updateOne(
      { _id: claimed._id, lockToken },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelledBy: 'system',
          cancelReason,
        },
      },
    );
    await ConversationAiAutoReply.updateOne(
      { conversationId: claimed.conversationId },
      {
        $set: {
          lastStatus: convStatus,
          lastStatusAt: new Date(),
          lastStatusReason: statusReason,
        },
      },
    );
    if (parsed) {
      emitStatusToStaffOnly({ io, notifyUser }, parsed, {
        status: convStatus,
        statusLabel: statusReason,
        reason: statusReason,
        dueAt: null,
      });
    }
    return { ok: false, cancelled: cancelReason };
  };

  try {
    // 1. Pre-generation re-checks (settings + human reply + idempotency + rate limits)
    const [global, convConfig] = await Promise.all([
      getGlobalAiAutoReplySettings({ bypassCache: true }),
      ConversationAiAutoReply.findOne({ conversationId: claimed.conversationId }).lean(),
    ]);

    if (!global.enabled) {
      return abortCancelled('disabled_global', 'cancelled_disabled', 'Admin đã tắt AI toàn hệ thống');
    }
    if (!convConfig?.enabled) {
      return abortCancelled('disabled_conversation', 'cancelled_disabled', 'AI tự động trả lời đã tắt');
    }

    const humanAlreadyReplied = await checkHumanRepliedSince(
      aliasIds,
      claimed.studentId,
      claimed.triggeringMessageAt,
      claimed.triggeringMessageId,
    );
    if (humanAlreadyReplied) {
      return abortCancelled('human_replied', 'cancelled_human', 'Đã hủy vì giảng viên trả lời');
    }

    const existingSentMsg = await Message.findOne({ 'aiMetadata.idempotencyKey': claimed.idempotencyKey }).select('_id').lean();
    if (existingSentMsg) {
      await AiAutoReplyTask.updateOne(
        { _id: claimed._id, lockToken },
        { $set: { status: 'sent', sentMessageId: String(existingSentMsg._id) } },
      );
      return { ok: true, deduplicated: true, messageId: String(existingSentMsg._id) };
    }

    const today = vietnamDateKey();
    const dailyCount = convConfig.dailyAiReplyDate === today ? Number(convConfig.dailyAiReplyCount || 0) : 0;
    const consecutive = Number(convConfig.consecutiveAiReplies || 0);
    if (consecutive >= global.maxConsecutiveReplies || dailyCount >= global.maxDailyRepliesPerConversation) {
      return abortCancelled('rate_limited', 'rate_limited', 'Đã đạt giới hạn trả lời tự động');
    }

    // 2. Load strictly isolated history ONLY from this conversationId
    const recentMsgsDesc = await Message.find({
      conversationId: { $in: aliasIds },
      isRecalled: { $ne: true },
      messageType: { $ne: 'system' },
    })
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();
    const recentMsgs = recentMsgsDesc.reverse();

    // Collect trailing consecutive student messages so AI understands full context of the burst
    const trailingStudentMsgs = [];
    for (let i = recentMsgs.length - 1; i >= 0; i -= 1) {
      const m = recentMsgs[i];
      if (String(m.senderId) === String(claimed.studentId)) {
        trailingStudentMsgs.unshift(m);
      } else {
        break;
      }
    }
    const combinedStudentText = trailingStudentMsgs
      .map((m) => String(m.content || '').trim())
      .filter(Boolean)
      .join('\n');

    let studentName = claimed.studentName;
    if (!studentName && mongoose.Types.ObjectId.isValid(claimed.studentId)) {
      const stu = await Student.findById(claimed.studentId).select('name').lean();
      if (stu?.name) studentName = stu.name;
    }

    // Notify staff that AI started composing (still no message created yet)
    if (parsed) {
      emitStatusToStaffOnly({ io, notifyUser }, parsed, {
        status: 'processing',
        statusLabel: 'AI đang xử lý phản hồi...',
        dueAt: null,
      });
    }

    // 3. Generate response (or safe handoff on uncertain/personal/error)
    const generated = await generateAutoReplyContent({
      combinedStudentText,
      recentConversationMessages: recentMsgs,
      studentName: studentName || 'Học viên',
      studentId: claimed.studentId,
    });

    // 4. Critical Post-Generation Race Re-Check right before persisting!
    const [latestGlobal, latestConv, humanRepliedDuringGen, stillOwner] = await Promise.all([
      getGlobalAiAutoReplySettings({ bypassCache: true }),
      ConversationAiAutoReply.findOne({ conversationId: claimed.conversationId }).lean(),
      checkHumanRepliedSince(
        aliasIds,
        claimed.studentId,
        claimed.triggeringMessageAt,
        claimed.triggeringMessageId,
      ),
      AiAutoReplyTask.findOne({ _id: claimed._id, status: 'processing', lockToken }).select('_id').lean(),
    ]);

    if (!stillOwner) {
      return { ok: false, skipped: 'lock_lost' };
    }
    if (!latestGlobal.enabled) {
      return abortCancelled('disabled_global', 'cancelled_disabled', 'Admin đã tắt AI toàn hệ thống');
    }
    if (!latestConv?.enabled) {
      return abortCancelled('disabled_conversation', 'cancelled_disabled', 'AI tự động trả lời đã tắt');
    }
    if (humanRepliedDuringGen) {
      return abortCancelled('human_replied_race', 'cancelled_human', 'Đã hủy vì giảng viên trả lời');
    }

    // 5. Persist Message atomically with unique idempotencyKey guard
    const needsHuman = Boolean(generated?.needsHuman);
    const replyContent = String(generated?.content || SAFE_HANDOFF_TEXT).trim() || SAFE_HANDOFF_TEXT;
    const knowledgeRefs = Array.isArray(generated?.knowledgeReferences) ? generated.knowledgeReferences : [];
    const modelName = String(generated?.model || '');

    let createdMessage;
    try {
      createdMessage = await Message.create({
        conversationId: claimed.conversationId,
        senderId: 'ai_support',
        senderName: 'DewSkill AI',
        senderRole: 'system',
        senderType: 'ai',
        receiverId: claimed.studentId,
        receiverName: studentName || 'Học viên',
        receiverRole: 'student',
        content: replyContent,
        messageType: 'text',
        isGroup: false,
        groupId: null,
        isRead: false,
        payload: {
          aiAutoReply: {
            senderType: 'ai',
            source: 'ai_auto_reply',
            trigger: 'timeout',
            triggeringMessageId: claimed.triggeringMessageId,
            needsHuman,
            caption: AI_AUTO_REPLY_CAPTION,
          },
        },
        aiMetadata: {
          senderType: 'ai',
          source: 'ai_auto_reply',
          trigger: 'timeout',
          triggeringMessageId: claimed.triggeringMessageId,
          burstMessageIds: claimed.burstMessageIds?.length ? claimed.burstMessageIds : [claimed.triggeringMessageId],
          idempotencyKey: claimed.idempotencyKey,
          recipientId: claimed.recipientId,
          recipientRole: claimed.recipientRole,
          recipientName: claimed.recipientName || '',
          studentId: claimed.studentId,
          studentName: studentName || 'Học viên',
          knowledgeReferences: knowledgeRefs,
          model: modelName,
          needsHuman,
          caption: AI_AUTO_REPLY_CAPTION,
        },
      });
    } catch (dupErr) {
      if (dupErr?.code === 11000) {
        const dupMsg = await Message.findOne({ 'aiMetadata.idempotencyKey': claimed.idempotencyKey }).select('_id').lean();
        await AiAutoReplyTask.updateOne(
          { _id: claimed._id, lockToken },
          { $set: { status: 'sent', sentMessageId: String(dupMsg?._id || '') } },
        );
        return { ok: true, deduplicated: true, messageId: String(dupMsg?._id || '') };
      }
      throw dupErr;
    }

    const doneAt = new Date();
    const finalTaskStatus = needsHuman ? 'needs_human' : 'sent';
    await AiAutoReplyTask.updateOne(
      { _id: claimed._id, lockToken },
      {
        $set: {
          status: finalTaskStatus,
          sentMessageId: String(createdMessage._id),
          replyPreview: replyContent.slice(0, 300),
          model: modelName,
          knowledgeReferences: knowledgeRefs,
          needsHuman,
          errorMessage: String(generated?.errorMessage || '').slice(0, 300),
        },
      },
    );

    const nextDailyCount = latestConv.dailyAiReplyDate === today
      ? Number(latestConv.dailyAiReplyCount || 0) + 1
      : 1;
    const convStatusReason = needsHuman
      ? 'AI không thể trả lời, cần giảng viên hỗ trợ'
      : 'AI đã tự động trả lời';

    await ConversationAiAutoReply.updateOne(
      { conversationId: claimed.conversationId },
      {
        $set: {
          lastStatus: finalTaskStatus,
          lastStatusAt: doneAt,
          lastStatusReason: convStatusReason,
          lastSentMessageId: String(createdMessage._id),
          consecutiveAiReplies: Number(latestConv.consecutiveAiReplies || 0) + 1,
          dailyAiReplyDate: today,
          dailyAiReplyCount: nextDailyCount,
        },
      },
    );

    // 6. Enrich & emit real-time message:receive to BOTH Student and Teacher/Admin + status ONLY to Teacher/Admin
    const [clientMessage] = await enrichMessageIdentities([createdMessage]);
    const targets = resolveNotificationTargets({ io, notifyUser });
    if (typeof targets.notifyUser === 'function') {
      targets.notifyUser('student', claimed.studentId, 'message:receive', clientMessage);
      if (claimed.recipientId === 'admin') {
        targets.notifyUser('admin', 'admin', 'message:receive', clientMessage);
      } else {
        targets.notifyUser(claimed.recipientRole, claimed.recipientId, 'message:receive', clientMessage);
      }
    } else if (targets.io) {
      targets.io.to(String(claimed.studentId)).emit('message:receive', clientMessage);
      if (claimed.recipientId === 'admin') {
        targets.io.to('admin').to('ALL_ADMIN').emit('message:receive', clientMessage);
      } else {
        targets.io.to(String(claimed.recipientId)).emit('message:receive', clientMessage);
      }
    }

    if (parsed) {
      emitStatusToStaffOnly(targets, parsed, {
        status: finalTaskStatus,
        statusLabel: convStatusReason,
        reason: convStatusReason,
        dueAt: null,
        sentMessageId: String(createdMessage._id),
        needsHuman,
        updatedAt: doneAt.toISOString(),
      });
    }

    return {
      ok: true,
      status: finalTaskStatus,
      needsHuman,
      messageId: String(createdMessage._id),
      clientMessage,
    };
  } catch (err) {
    logger.error({ err: err?.message, taskId: String(taskId) }, '[AI Auto-Reply] executeAutoReplyTask unexpected error');
    await AiAutoReplyTask.updateOne(
      { _id: claimed._id, lockToken },
      {
        $set: {
          status: 'failed',
          errorMessage: String(err?.message || 'Execution failed').slice(0, 300),
        },
      },
    ).catch(() => {});
    return { ok: false, error: err?.message || 'Execution failed' };
  }
}

/**
 * Startup & periodic recovery sweep:
 * - Reclaims crashed `processing` tasks older than 60s
 * - Executes overdue `pending` tasks immediately
 * - Re-enqueues future `pending` tasks into BullMQ (survives Redis/API restarts)
 */
async function recoverPendingAutoReplyTasks({ io = null, notifyUser = null, requeueFuture = true } = {}) {
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - 60_000);

  await AiAutoReplyTask.updateMany(
    { status: 'processing', lockedAt: { $lt: staleCutoff } },
    { $set: { status: 'pending', lockToken: '', lockedAt: null } },
  );

  const dueTasks = await AiAutoReplyTask.find({
    status: 'pending',
    dueAt: { $lte: now },
  })
    .sort({ dueAt: 1 })
    .limit(20)
    .select('_id')
    .lean();

  const results = [];
  for (const t of dueTasks) {
    results.push(await executeAutoReplyTask(String(t._id), { io, notifyUser }));
  }

  let requeued = 0;
  if (requeueFuture) {
    const futureTasks = await AiAutoReplyTask.find({
      status: 'pending',
      dueAt: { $gt: now },
    })
      .sort({ dueAt: 1 })
      .limit(100)
      .select('_id dueAt bullJobId')
      .lean();
    for (const ft of futureTasks) {
      const delayMs = Math.max(0, new Date(ft.dueAt).getTime() - Date.now());
      await enqueueAiAutoReply({ taskId: String(ft._id) }, { delayMs, jobId: ft.bullJobId || `autoreply-recover:${ft._id}` });
      requeued += 1;
    }
  }

  return { executedCount: results.length, requeued, results };
}

function startAiAutoReplyWatcher(io, notifyUser) {
  runtimeIo = io || runtimeIo;
  runtimeNotifyUser = typeof notifyUser === 'function' ? notifyUser : runtimeNotifyUser;

  if (watcherTimer) return;

  // Run initial restart recovery immediately after DB is ready
  setImmediate(() => {
    recoverPendingAutoReplyTasks({ io: runtimeIo, notifyUser: runtimeNotifyUser, requeueFuture: true }).catch((err) => {
      logger.warn({ err: err?.message }, '[AI Auto-Reply] startup recovery failed');
    });
  });

  watcherTimer = setInterval(async () => {
    if (watcherBusy) return;
    watcherBusy = true;
    try {
      await recoverPendingAutoReplyTasks({
        io: runtimeIo,
        notifyUser: runtimeNotifyUser,
        requeueFuture: false,
      });
    } catch (err) {
      logger.warn({ err: err?.message }, '[AI Auto-Reply] watcher sweep failed');
    } finally {
      watcherBusy = false;
    }
  }, 5000);

  if (typeof watcherTimer.unref === 'function') {
    watcherTimer.unref();
  }
}

function stopAiAutoReplyWatcher() {
  if (watcherTimer) {
    clearInterval(watcherTimer);
    watcherTimer = null;
  }
  watcherBusy = false;
}

module.exports = {
  ALLOWED_DELAY_MINUTES,
  DEFAULT_GLOBAL_SETTINGS,
  AI_AUTO_REPLY_CAPTION,
  SAFE_HANDOFF_TEXT,
  parseStudentDirectConversation,
  getGlobalAiAutoReplySettings,
  updateGlobalAiAutoReplySettings,
  assertCanManageConversationAiAutoReply,
  getConversationAiAutoReplyState,
  updateConversationAiAutoReplyConfig,
  adminDisableConversationAutoReply,
  listAiAutoReplyHistory,
  handlePostMessageAutoReply,
  generateAutoReplyContent,
  executeAutoReplyTask,
  recoverPendingAutoReplyTasks,
  startAiAutoReplyWatcher,
  stopAiAutoReplyWatcher,
  isSensitivePersonalOrAcademicInquiry,
  invalidateGlobalCache,
  _setTestHooks,
  _resetTestHooks,
};
