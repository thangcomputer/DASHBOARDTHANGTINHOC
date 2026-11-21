const express = require('express');
const crypto = require('crypto');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const AiQuickAskFeedback = require('../models/AiQuickAskFeedback');
const AiQuickAskDailyStat = require('../models/AiQuickAskDailyStat');
const {
  evaluateKnowledgeRagAccess,
  getKnowledgeVersion,
  getUserAccessTier,
} = require('../services/ai/knowledgeSearchService');
const { policyShadowMessage } = require('../middleware/policyShadowMessage');
const { messagesCutoverGate } = require('../middleware/messagesCutoverGate');
const { getMessagingRole } = require('../utils/messagingRoles');
const { canViewConversation } = require('../services/messagingPolicy');
const {
  isAiSupportEnabled,
  aiSupportConfigured,
  isAiChatUser,
  isSupportAgent,
  escalateToHuman,
  resetAiSession,
  endAiSession,
  getSession,
  sendWelcomeIfEmpty,
  clearAiHistory,
  listHandoffQueue,
  getHandoffThread,
  claimHandoff,
  resolveHandoff,
  replyAsSupport,
  quickAskAssistant,
  getQuickAskMetricsSummary,
  recordQuickAskFeedback,
  adjustQuickAskFeedback,
  recordQuickAskClientError,
  recordQuickAskSecurityEvent,
  redactPiiText,
  sessionToClient,
  AI_PEER_ID,
  AI_PEER_NAME,
} = require('../services/aiSupportService');
const { buildConversationId } = require('../utils/chatConversationId');

const quickAskLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  keyGenerator: (req) => `quick-ask:${req.user?.id || (req.ip ? ipKeyGenerator(req.ip) : 'anon')}`,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'development',
  message: { success: false, code: 'RATE_LIMITED', message: 'Bạn hỏi hơi nhanh, vui lòng đợi một lát rồi thử lại.' },
});

function denyAiRoles(req, res) {
  if (!isAiChatUser(req.user)) {
    res.status(403).json({ success: false, message: 'Trợ lý AI chỉ dành cho học viên và giảng viên' });
    return true;
  }
  return false;
}

function denyUnlessSupport(req, res) {
  if (!isSupportAgent(req.user)) {
    res.status(403).json({ success: false, message: 'Chỉ nhân viên hỗ trợ được thao tác hàng đợi AI' });
    return true;
  }
  return false;
}

router.get('/status', authMiddleware, (req, res) => {
  const allowed = isAiChatUser(req.user);
  res.json({
    success: true,
    data: {
      enabled: isAiSupportEnabled() && allowed,
      configured: aiSupportConfigured(),
      peer: { id: AI_PEER_ID, name: AI_PEER_NAME, role: 'system' },
    },
  });
});

router.post('/message', authMiddleware, policyShadowMessage('send'), messagesCutoverGate('send'), async (req, res) => {
  try {
    if (!isAiSupportEnabled()) {
      return res.status(503).json({ success: false, message: 'Trợ lý AI chưa được bật' });
    }
    if (denyAiRoles(req, res)) return;

    const role = getMessagingRole(req.user);
    const userId = String(req.user.id);
    const conversationId = buildConversationId(role, userId, 'system', AI_PEER_ID);
    const access = canViewConversation(req.user, conversationId);
    if (!access.allowed) {
      return res.status(403).json({ success: false, message: 'Không có quyền gửi tin nhắn tới Trợ lý AI' });
    }

    const {
      content,
      messageType,
      fileUrl,
      fileName,
      payload,
      conversationId: requestedConversationId,
    } = req.body || {};
    if (requestedConversationId && requestedConversationId !== conversationId) {
      return res.status(400).json({ success: false, message: 'Cuộc trò chuyện AI không hợp lệ' });
    }
    if (!String(content || '').trim() && !String(fileUrl || '').trim() && payload?.type !== 'sticker') {
      return res.status(400).json({ success: false, message: 'Tin nhắn không được để trống' });
    }

    const { sendCanonicalMessage } = require('../services/directMessageService');
    const result = await sendCanonicalMessage({
      sender: req.user,
      receiverId: AI_PEER_ID,
      receiverName: AI_PEER_NAME,
      receiverRole: 'system',
      conversationId,
      content,
      messageType,
      fileUrl,
      fileName,
      payload: payload && typeof payload === 'object' ? payload : null,
      io: req.app.get('io'),
      notifyUser: req.app.notifyUser,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.message,
        ...(result.code ? { code: result.code } : {}),
        ...(result.policy ? { policy: result.policy } : {}),
      });
    }
    return res.status(201).json({ success: true, data: result.clientMessage });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || 'Lỗi server' });
  }
});

router.post('/open', authMiddleware, async (req, res) => {
  try {
    if (!isAiSupportEnabled()) {
      return res.status(503).json({ success: false, message: 'Trợ lý AI chưa được bật' });
    }
    if (denyAiRoles(req, res)) return;

    const role = getMessagingRole(req.user);
    const userId = String(req.user.id);
    const conversationId = buildConversationId(role, userId, 'system', AI_PEER_ID);
    const access = canViewConversation(req.user, conversationId);
    if (!access.allowed) {
      return res.status(403).json({ success: false, message: 'Không có quyền mở cuộc trò chuyện AI' });
    }

    const io = req.app.get('io');
    let session = await getSession(conversationId);
    if (session && sessionToClient(session)?.status === 'CLOSED') {
      session = await resetAiSession({ conversationId, user: req.user, io });
    }
    const welcome = session && sessionToClient(session)?.escalated
      ? null
      : await sendWelcomeIfEmpty({
        conversationId,
        sender: req.user,
        io,
        notifyUser: req.app.notifyUser,
      });

    return res.json({
      success: true,
      data: {
        conversationId,
        peer: { id: AI_PEER_ID, name: AI_PEER_NAME, role: 'system' },
        welcome,
        session: sessionToClient(session) || {
          conversationId,
          status: 'AI_ACTIVE',
          escalated: false,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Lỗi server' });
  }
});

router.post('/escalate', authMiddleware, async (req, res) => {
  try {
    if (denyAiRoles(req, res)) return;
    const { conversationId } = req.body || {};
    if (!conversationId) {
      return res.status(400).json({ success: false, message: 'Thiếu conversationId' });
    }

    const access = canViewConversation(req.user, conversationId);
    if (!access.allowed) {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    const io = req.app.get('io');
    const { session, message, alreadyEscalated } = await escalateToHuman({
      conversationId,
      user: req.user,
      io,
    });

    const userId = String(req.user.id);
    if (io && message && !alreadyEscalated) {
      io.to(userId).emit('message:receive', message);
      io.to('ALL_SUPPORT').emit('ai-support:escalate', {
        conversationId,
        userId,
        userName: req.user.name || '',
        userRole: getMessagingRole(req.user),
        branchId: req.user.branchId || null,
        reason: session.handoffReason,
        summary: session.handoffSummary,
        status: session.status,
      });
      try {
        const NotificationService = require('../services/NotificationService');
        await NotificationService.send(io, {
          type: 'MESSAGE',
          title: 'Yêu cầu hỗ trợ trực tiếp',
          content: `${req.user.name || 'Người dùng'} cần gặp nhân viên (sau AI).`,
          receivers: 'ALL_SUPPORT',
          payload: { kind: 'ai_support_escalate', conversationId, userId },
          link: '/admin/inbox',
        });
      } catch (nErr) {
        /* optional */
      }
    }

    return res.json({
      success: true,
      data: { session: sessionToClient(session), message, alreadyEscalated: !!alreadyEscalated },
      message: alreadyEscalated ? 'Đã chuyển nhân viên từ trước' : 'Đã chuyển tới nhân viên hỗ trợ',
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || 'Lỗi server' });
  }
});

router.post('/reset', authMiddleware, async (req, res) => {
  try {
    if (denyAiRoles(req, res)) return;
    const { conversationId } = req.body || {};
    if (!conversationId) {
      return res.status(400).json({ success: false, message: 'Thiếu conversationId' });
    }
    const access = canViewConversation(req.user, conversationId);
    if (!access.allowed) {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }
    const io = req.app.get('io');
    const session = await resetAiSession({ conversationId, user: req.user, io });
    return res.json({
      success: true,
      data: { session: sessionToClient(session), escalated: false },
      message: 'Đã bật lại Trợ lý AI',
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || 'Lỗi server' });
  }
});

router.post('/end', authMiddleware, async (req, res) => {
  try {
    if (denyAiRoles(req, res)) return;
    const { conversationId } = req.body || {};
    if (!conversationId) {
      return res.status(400).json({ success: false, message: 'Thiếu conversationId' });
    }
    const access = canViewConversation(req.user, conversationId);
    if (!access.allowed) {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }
    const io = req.app.get('io');
    const session = await endAiSession({ conversationId, user: req.user, io });
    return res.json({
      success: true,
      data: { session: sessionToClient(session), ended: true },
      message: 'Đã kết thúc phiên trả lời với Trợ lý AI',
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || 'Lỗi server' });
  }
});

router.post('/clear-history', authMiddleware, async (req, res) => {
  try {
    if (!isAiSupportEnabled()) {
      return res.status(503).json({ success: false, message: 'Trợ lý AI chưa được bật' });
    }
    if (denyAiRoles(req, res)) return;
    const role = getMessagingRole(req.user);
    const userId = String(req.user.id);
    const conversationId = buildConversationId(role, userId, 'system', AI_PEER_ID);
    const access = canViewConversation(req.user, conversationId);
    if (!access.allowed) {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }
    const io = req.app.get('io');
    const result = await clearAiHistory({
      conversationId,
      user: req.user,
      io,
      notifyUser: req.app.notifyUser,
    });
    return res.json({
      success: true,
      data: {
        conversationId,
        session: sessionToClient(result.session),
        welcome: result.welcome,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Lỗi server' });
  }
});

router.get('/queue', authMiddleware, async (req, res) => {
  try {
    if (denyUnlessSupport(req, res)) return;
    const data = await listHandoffQueue();
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Lỗi server' });
  }
});

router.get('/thread/:conversationId', authMiddleware, async (req, res) => {
  try {
    if (denyUnlessSupport(req, res)) return;
    const result = await getHandoffThread({
      conversationId: req.params.conversationId,
      agent: req.user,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || 'Lỗi server' });
  }
});

router.post('/claim', authMiddleware, async (req, res) => {
  try {
    if (denyUnlessSupport(req, res)) return;
    const { conversationId } = req.body || {};
    if (!conversationId) {
      return res.status(400).json({ success: false, message: 'Thiếu conversationId' });
    }
    const result = await claimHandoff({
      conversationId,
      agent: req.user,
      io: req.app.get('io'),
    });
    return res.json({ success: true, data: result, message: 'Đã tiếp nhận yêu cầu' });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || 'Lỗi server' });
  }
});

router.post('/resolve', authMiddleware, async (req, res) => {
  try {
    if (denyUnlessSupport(req, res)) return;
    const { conversationId } = req.body || {};
    if (!conversationId) {
      return res.status(400).json({ success: false, message: 'Thiếu conversationId' });
    }
    const result = await resolveHandoff({
      conversationId,
      agent: req.user,
      io: req.app.get('io'),
    });
    return res.json({ success: true, data: result, message: 'Đã đánh dấu xử lý xong' });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || 'Lỗi server' });
  }
});

router.post('/reply', authMiddleware, async (req, res) => {
  try {
    if (denyUnlessSupport(req, res)) return;
    const { conversationId, content, fileUrl, fileName, messageType } = req.body || {};
    if (!conversationId) {
      return res.status(400).json({ success: false, message: 'Thiếu conversationId' });
    }
    const result = await replyAsSupport({
      conversationId,
      agent: req.user,
      content,
      fileUrl,
      fileName,
      messageType,
      io: req.app.get('io'),
      notifyUser: req.app.notifyUser,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || 'Lỗi server' });
  }
});

router.post('/quick-ask', authMiddleware, quickAskLimiter, async (req, res) => {
  try {
    const { question, history, preferredLang, attachment } = req.body || {};
    const hasQuestion = Boolean(String(question || '').trim());
    const hasAttachment = Boolean(
      attachment
      && typeof attachment === 'object'
      && (String(attachment.dataBase64 || '').trim()
        || String(attachment.textContent || '').trim()
        || String(attachment.name || '').trim())
    );
    if (!hasQuestion && !hasAttachment) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập câu hỏi hoặc đính kèm ảnh/tệp' });
    }
    const rawPlatform = String(req.header('X-Client-Platform') || 'web').trim().toLowerCase();
    const safePlatform = ['web', 'mobile', 'api'].includes(rawPlatform) ? rawPlatform : 'web';
    const trafficSource = String(req.header('X-Traffic-Source') || 'pilot').trim().toLowerCase() === 'benchmark'
      ? 'benchmark'
      : 'pilot';
    const data = await quickAskAssistant({
      user: req.user,
      question,
      history: Array.isArray(history) ? history : [],
      preferredLang: String(preferredLang || ''),
      attachment: hasAttachment ? attachment : null,
      platform: safePlatform,
      trafficSource,
    });
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || 'Lỗi server' });
  }
});

function isRagAdminUser(user) {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  const adminRole = String(user.adminRole || '').toUpperCase();
  return role === 'admin' || role === 'superadmin' || adminRole === 'HIGH_ADMIN' || adminRole === 'SUPER_ADMIN';
}

// Phản hồi chất lượng câu trả lời AI (Hữu ích / Chưa chính xác + góp ý ngắn) -> Lưu chờ Admin đánh giá, KHÔNG tự động nạp tri thức, chống trùng lượt đánh giá
router.post('/quick-ask/feedback', authMiddleware, quickAskLimiter, async (req, res) => {
  try {
    const rawPlatform = String(req.body?.platform || req.header('X-Client-Platform') || 'web').trim().toLowerCase();
    const safePlatform = ['web', 'mobile', 'api'].includes(rawPlatform) ? rawPlatform : 'web';

    if (getUserAccessTier(req.user) === 'blocked') {
      recordQuickAskSecurityEvent('authBlocked', safePlatform);
      return res.status(403).json({ success: false, message: 'Tài khoản chưa được mở khóa quyền gửi phản hồi AI' });
    }

    const {
      rating,
      comment = '',
      question = '',
      answer = '',
      source = 'ai',
      model = '',
      responseId = '',
    } = req.body || {};

    const cleanRating = String(rating || '').trim().toLowerCase();
    if (!['helpful', 'inaccurate'].includes(cleanRating)) {
      return res.status(400).json({ success: false, message: 'Giá trị đánh giá không hợp lệ (helpful | inaccurate)' });
    }

    const roleRaw = String(req.user?.role || 'student').trim().toLowerCase();
    const safeRole = ['student', 'teacher', 'staff', 'admin'].includes(roleRaw) ? roleRaw : 'student';
    const ragAccess = evaluateKnowledgeRagAccess(req.user);

    const userId = String(req.user?.id || req.user?._id || 'unknown');
    const cleanResponseId = String(responseId || '').trim().slice(0, 80);
    const cleanComment = redactPiiText(comment, 500);
    const qText = String(question || '').trim();
    const qHash = qText ? crypto.createHash('sha256').update(qText.toLowerCase()).digest('hex').slice(0, 12) : '';

    // Chống trùng lượt đánh giá theo (userId, responseId) hoặc (userId, questionHash) trong 10 phút gần nhất
    let existing = null;
    if (cleanResponseId) {
      existing = await AiQuickAskFeedback.findOne({ userId, responseId: cleanResponseId });
    } else if (qHash) {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
      existing = await AiQuickAskFeedback.findOne({
        userId,
        questionHash: qHash,
        createdAt: { $gte: tenMinAgo },
      }).sort({ createdAt: -1 });
    }

    if (existing) {
      const sameRating = existing.rating === cleanRating;
      const sameComment = String(existing.comment || '') === cleanComment;
      if (sameRating && sameComment) {
        return res.status(200).json({
          success: true,
          data: {
            id: String(existing._id),
            rating: existing.rating,
            reviewStatus: existing.reviewStatus,
            autoPromotedToKnowledge: false,
            deduplicated: true,
            updated: false,
          },
        });
      }
      const prevRating = existing.rating;
      existing.rating = cleanRating;
      if (cleanComment || !sameRating) existing.comment = cleanComment;
      existing.reviewStatus = 'pending_admin_review';
      await existing.save();
      adjustQuickAskFeedback(prevRating, cleanRating, safePlatform);
      return res.status(200).json({
        success: true,
        data: {
          id: String(existing._id),
          rating: existing.rating,
          reviewStatus: existing.reviewStatus,
          autoPromotedToKnowledge: false,
          deduplicated: true,
          updated: true,
        },
      });
    }

    const doc = await AiQuickAskFeedback.create({
      userId,
      userRole: safeRole,
      platform: safePlatform,
      rating: cleanRating,
      comment: cleanComment,
      responseId: cleanResponseId,
      questionHash: qHash,
      questionPreview: redactPiiText(qText, 240),
      answerPreview: redactPiiText(answer, 300),
      answerSource: String(source || 'ai').slice(0, 32),
      model: String(model || '').slice(0, 80),
      knowledgeVersion: getKnowledgeVersion(),
      ragEnabled: ragAccess.enabled,
      reviewStatus: 'pending_admin_review',
      autoPromotedToKnowledge: false,
    });

    recordQuickAskFeedback(cleanRating, safePlatform);

    return res.status(201).json({
      success: true,
      data: {
        id: String(doc._id),
        rating: doc.rating,
        reviewStatus: doc.reviewStatus,
        autoPromotedToKnowledge: false,
        deduplicated: false,
        updated: false,
      },
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || 'Không lưu được phản hồi' });
  }
});

// Báo cáo lỗi phía client Web/Mobile (mạng/timeout) không chứa PII để theo dõi 7–14 ngày
router.post('/quick-ask/client-event', authMiddleware, quickAskLimiter, (req, res) => {
  const rawPlatform = String(req.body?.platform || req.header('X-Client-Platform') || 'web').trim().toLowerCase();
  const safePlatform = ['web', 'mobile'].includes(rawPlatform) ? rawPlatform : 'web';
  const rawType = String(req.body?.errorType || 'network').trim().toLowerCase();
  const safeType = ['timeout', 'network', 'other'].includes(rawType) ? rawType : 'other';
  recordQuickAskClientError({ platform: safePlatform, errorType: safeType });
  return res.status(202).json({ success: true });
});

// Admin-only: Giám sát hiệu năng RAG tách riêng từng luồng (Cold/Warm/Legacy), cảnh báo, rollback & tiêu chí mở rộng 7–14 ngày
router.get('/admin/rag-metrics', authMiddleware, async (req, res) => {
  if (!isRagAdminUser(req.user)) {
    return res.status(403).json({ success: false, message: 'Chỉ Quản trị viên mới được xem thống kê AI RAG' });
  }
  try {
    const days = Math.max(1, Math.min(30, Number(req.query.days) || 14));
    let dailyHistory = [];
    try {
      dailyHistory = await AiQuickAskDailyStat.find({})
        .sort({ dateKey: -1 })
        .limit(days * 3)
        .lean();
    } catch {
      /* optional when running without Mongo */
    }
    const summary = getQuickAskMetricsSummary(dailyHistory);
    let dbFeedback = { helpful: 0, inaccurate: 0, pendingReview: 0 };
    try {
      const grouped = await AiQuickAskFeedback.aggregate([
        {
          $group: {
            _id: null,
            helpful: { $sum: { $cond: [{ $eq: ['$rating', 'helpful'] }, 1, 0] } },
            inaccurate: { $sum: { $cond: [{ $eq: ['$rating', 'inaccurate'] }, 1, 0] } },
            pendingReview: { $sum: { $cond: [{ $eq: ['$reviewStatus', 'pending_admin_review'] }, 1, 0] } },
          },
        },
      ]);
      if (grouped[0]) {
        dbFeedback = {
          helpful: grouped[0].helpful || 0,
          inaccurate: grouped[0].inaccurate || 0,
          pendingReview: grouped[0].pendingReview || 0,
        };
      }
    } catch {
      /* optional when running without Mongo */
    }
    return res.json({
      success: true,
      data: {
        ...summary,
        storedFeedback: dbFeedback,
        dailyHistory,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Lỗi server' });
  }
});

// Admin-only: Xem danh sách phản hồi học viên/giáo viên chờ đánh giá
router.get('/admin/rag-feedback', authMiddleware, async (req, res) => {
  if (!isRagAdminUser(req.user)) {
    return res.status(403).json({ success: false, message: 'Chỉ Quản trị viên mới được xem danh sách phản hồi AI' });
  }
  try {
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 30));
    const filter = {};
    if (['helpful', 'inaccurate'].includes(String(req.query.rating || ''))) {
      filter.rating = String(req.query.rating);
    }
    if (['pending_admin_review', 'reviewed_approved', 'reviewed_dismissed'].includes(String(req.query.reviewStatus || ''))) {
      filter.reviewStatus = String(req.query.reviewStatus);
    }
    const items = await AiQuickAskFeedback.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    return res.json({ success: true, data: { items, total: items.length } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Lỗi server' });
  }
});

// Admin-only: Đánh dấu đã rà soát phản hồi (reviewed_approved | reviewed_dismissed) — KHÔNG tự động nạp vào kho tri thức
router.patch('/admin/rag-feedback/:id', authMiddleware, async (req, res) => {
  if (!isRagAdminUser(req.user)) {
    return res.status(403).json({ success: false, message: 'Chỉ Quản trị viên mới được duyệt phản hồi AI' });
  }
  try {
    const nextStatus = String(req.body?.reviewStatus || '').trim();
    if (!['reviewed_approved', 'reviewed_dismissed', 'pending_admin_review'].includes(nextStatus)) {
      return res.status(400).json({ success: false, message: 'Trạng thái duyệt không hợp lệ' });
    }
    const adminNote = redactPiiText(req.body?.adminNote || '', 300);
    const updated = await AiQuickAskFeedback.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          reviewStatus: nextStatus,
          adminNote,
          reviewedBy: String(req.user?.id || req.user?._id || 'admin'),
          reviewedAt: new Date(),
        },
      },
      { new: true },
    ).lean();
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi phản hồi' });
    }
    return res.json({
      success: true,
      data: {
        id: String(updated._id),
        reviewStatus: updated.reviewStatus,
        autoPromotedToKnowledge: false,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Lỗi server' });
  }
});

module.exports = router;
