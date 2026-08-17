const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { getMessagingRole } = require('../utils/messagingRoles');
const { canViewConversation } = require('../services/messagingPolicy');
const {
  isAiSupportEnabled,
  aiSupportConfigured,
  isAiChatUser,
  isSupportAgent,
  escalateToHuman,
  resetAiSession,
  getSession,
  sendWelcomeIfEmpty,
  clearAiHistory,
  listHandoffQueue,
  getHandoffThread,
  claimHandoff,
  resolveHandoff,
  replyAsSupport,
  sessionToClient,
  AI_PEER_ID,
  AI_PEER_NAME,
} = require('../services/aiSupportService');
const { buildConversationId } = require('../utils/chatConversationId');

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
    const session = await getSession(conversationId);
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

module.exports = router;
