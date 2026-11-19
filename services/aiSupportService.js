'use strict';

const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const net = require('net');
const http = require('http');
const https = require('https');
const Message = require('../models/Message');
const AiSupportSession = require('../models/AiSupportSession');
const { isAiConfigured, chatCompletion } = require('./ai/llmClient');
const { enrichMessageIdentities } = require('./messagingIdentity');
const { sanitizeMessageDoc, resolveDiskPath } = require('../utils/messageFileRetention');
const { getMessagingRole } = require('../utils/messagingRoles');
const { AI_SUPPORT_STATUS, HANDOFF_REASONS } = require('../shared/enums/AiSupportStatus');
const { wantsHumanEscalation, isHumanHandoffButtonHallucination } = require('../shared/aiSupportHandoff');
const logger = require('../config/logger');

const AI_PEER_ID = 'ai_support';
const AI_PEER_NAME = 'Trợ lý Thắng Tin Học';
const TYPING_MS = 900;
const AI_IMAGE_DAILY_LIMIT_STUDENT = Math.max(1, Number(process.env.AI_SUPPORT_IMAGE_DAILY_LIMIT_STUDENT || process.env.AI_SUPPORT_IMAGE_DAILY_LIMIT) || 5);
const AI_IMAGE_DAILY_LIMIT_TEACHER = Math.max(1, Number(process.env.AI_SUPPORT_IMAGE_DAILY_LIMIT_TEACHER) || 10);
const AI_QUESTION_DAILY_LIMIT_STUDENT = Math.max(1, Number(process.env.AI_SUPPORT_QUESTION_DAILY_LIMIT_STUDENT || process.env.AI_SUPPORT_QUESTION_DAILY_LIMIT) || 15);
const AI_QUESTION_DAILY_LIMIT_TEACHER = Math.max(1, Number(process.env.AI_SUPPORT_QUESTION_DAILY_LIMIT_TEACHER) || 30);
const IDLE_PING_MS = Math.max(30_000, Number(process.env.AI_SUPPORT_IDLE_PING_MS) || 5 * 60 * 1000);
const IDLE_END_MS = Math.max(15_000, Number(process.env.AI_SUPPORT_IDLE_END_MS) || 5 * 60 * 1000);
const IDLE_SWEEP_MS = Math.max(10_000, Number(process.env.AI_SUPPORT_IDLE_SWEEP_MS) || 30_000);
const ESCALATE_MARKER = 'Đã chuyển yêu cầu tới nhân viên hỗ trợ';
const BUSY_REPLY = 'Trợ lý AI đang bận. Bạn chọn "Cần nhân viên hỗ trợ" bên dưới nếu muốn gặp người thật.';
const BUSY_REPLY_EN = 'AI Assistant is currently busy. Tap "Need Support Agent" below if you would like to speak with our staff.';
const KEY_INVALID_REPLY = 'Trợ lý AI chưa kết nối được Gemini (API key hết hiệu lực). Admin cần tạo key mới tại Google AI Studio rồi cập nhật GEMINI_API_KEYS trên server. Bạn có thể bấm "Cần nhân viên hỗ trợ" nếu cần gặp người thật.';
const KEY_INVALID_REPLY_EN = 'AI Assistant could not connect to Gemini (API key expired). Please tap "Need Support Agent" below to speak with a human agent.';
const EMPTY_REPLY = 'Xin lỗi, mình chưa trả lời được lúc này. Bạn thử hỏi lại giúp mình nhé.';
const EMPTY_REPLY_EN = 'Sorry, I could not generate a reply right now. Please try asking again.';
const OUT_OF_SCOPE_REPLY = 'Em là Trợ lý AI Tin Học của Thắng Tin Học. Câu hỏi này nằm ngoài phạm vi em hỗ trợ.';
const OUT_OF_SCOPE_REPLY_EN = 'I am the Office IT AI Assistant at Thang Tin Hoc. This question is outside my scope of support.';
const QUESTION_LIMIT_MARKER = 'lượt hỏi Trợ lý AI hôm nay';
function questionLimitReply(limit, lang = 'vi') {
  const n = Number(limit) || 0;
  if (lang === 'en') {
    return `You have used all ${n} AI Assistant questions for today. Tap **Need Support Agent** below for live help, or ask AI again tomorrow.`;
  }
  return `Bạn đã hết ${n} ${QUESTION_LIMIT_MARKER}. Cần hỗ trợ tiếp thì bấm **Cần nhân viên hỗ trợ** bên dưới, hoặc ngày mai hỏi AI tiếp.`;
}
const IMAGE_GEN_REFUSE = 'Em không tạo hình ảnh. Bạn gửi ảnh màn hình Word, Excel hoặc PowerPoint nếu cần em xem giúp.';
const IMAGE_GEN_REFUSE_EN = 'I do not generate images. You can send a screenshot of Word, Excel, or PowerPoint if you need help troubleshooting.';
const GHOSTWRITE_REFUSE = 'Em chỉ hướng dẫn cách làm (dàn ý, thao tác Word). Em không viết hộ tiểu luận, báo cáo hay văn bản hành chính.';
const GHOSTWRITE_REFUSE_EN = 'I only provide step-by-step guidance and outlines. I do not ghostwrite essays, reports, or administrative documents.';
const IDLE_PING_TEXT = 'Bạn có còn đó không, cần hỗ trợ gì nữa không?';
const IDLE_END_TEXT = 'Phiên hỗ trợ đã kết thúc.';
const IDLE_STILL_HERE = 'Mình vẫn ở đây. Bạn hỏi gì ạ?';
const IDLE_STILL_HERE_EN = 'I am still here! How can I help you?';

const VI_DIACRITIC_RE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const VI_RE_EXPLAIN_RE = /^(Tôi không hiểu câu trả lời vừa rồi|Câu trả lời chưa đúng trọng tâm|Câu trả lời còn quá ngắn|Bạn có thể giải thích thêm)/i;
const VI_NO_ACCENT_HINT_RE = /\b(xin chao|chao ban|chao thay|chao co|la gi|nhu the nao|cach dung|cach su dung|huong dan|lich hoc|lich day|diem danh|bai tap|trac nghiem|hoc vien|giang vien|tai chinh|hoc phi|khong duoc|bi loi|giup minh|giup em|cho minh hoi|cho em hoi|o dau|bao nhieu|tai sao|lam sao)\b/i;
const EN_HINT_RE = /\b(hello|hi|hey|good morning|good afternoon|good evening|what|how|why|where|when|who|which|can|could|would|should|do|does|did|is|are|was|were|will|please|help|explain|tell|show|guide|use|using|used|work|works|formula|function|difference|between|example|error|fix|schedule|class|classes|course|courses|lesson|lessons|video|videos|exam|test|quiz|grade|grades|score|tuition|payment|password|account|teacher|student|inbox|message|support|in|of|for|to|with|from|about|the|and|or|not|my|me|you|your)\b/i;

function detectQueryLanguage(text, history = [], preferredLang = '') {
  const t = String(text || '').trim();
  const isPlaceholder = !t || t === '[Hình ảnh]' || t === '[Image]';
  if ((isPlaceholder || VI_RE_EXPLAIN_RE.test(t)) && Array.isArray(history) && history.length) {
    for (let i = history.length - 1; i >= 0; i -= 1) {
      const m = history[i];
      if (!m || String(m.senderId || '') === AI_PEER_ID || String(m.messageType || 'text') === 'system') continue;
      const content = String(m.content || '').trim();
      if (!content || content === '[Hình ảnh]' || content === '[Image]' || VI_RE_EXPLAIN_RE.test(content)) continue;
      return detectQueryLanguage(content, [], preferredLang);
    }
  }
  if (isPlaceholder) {
    return String(preferredLang || '').toLowerCase().startsWith('en') ? 'en' : 'vi';
  }
  if (VI_DIACRITIC_RE.test(t) || VI_NO_ACCENT_HINT_RE.test(t)) return 'vi';
  if (EN_HINT_RE.test(t)) return 'en';
  return String(preferredLang || '').toLowerCase().startsWith('en') ? 'en' : 'vi';
}

const SUPPORT_MODEL_FALLBACKS = [
  process.env.AI_SUPPORT_MODEL,
  process.env.AI_MODEL,
  'gemini-3.6-flash',
  'gemini-flash-latest',
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash',
].filter(Boolean);

function isSimpleGreeting(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[.!?…,-]+$/g, '').trim();
  if (!t || t.length > 48) return false;
  return /^(xin\s*chào|chào(\s+(bạn|em|cô|thầy|ad|admin))?|hello(\s+bạn)?|hi(\s+(bạn|there))?|hey|alo)$/i.test(t);
}

function hadMeaningfulAiReply(history) {
  return (history || []).some((m) => (
    String(m?.senderId || '') === AI_PEER_ID
    && String(m?.messageType || 'text') !== 'system'
    && !isEscalationMessage(m)
    && !isIdlePingMessage(m)
    && !isIdleEndMessage(m)
    && !isIdleStillHereMessage(m)
    && String(m?.content || '').trim()
  ));
}

function detectHandoffReason(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return null;
  if (wantsHumanEscalation(t)) return HANDOFF_REASONS.USER_REQUESTED;
  if (/(hoàn tiền|refund|tranh chấp thanh toán|không thanh toán được|trừ tiền nhầm)/i.test(t)) {
    return HANDOFF_REASONS.PAYMENT_ISSUE;
  }
  if (/(không (vào|truy cập) được khóa|mất quyền học|bị khóa khóa học)/i.test(t)) {
    return HANDOFF_REASONS.ACCESS_ISSUE;
  }
  if (/(tài khoản bị khóa|không đăng nhập được|quên mật khẩu không đổi được)/i.test(t)) {
    return HANDOFF_REASONS.ACCOUNT_ISSUE;
  }
  return null;
}

function isAiSupportConversationId(cid) {
  return String(cid || '').includes('system_ai_support');
}

function isSupportAgent(user) {
  return String(user?.adminRole || '').toUpperCase() === 'SUPPORT';
}

function isAiChatUser(user) {
  const role = getMessagingRole(user);
  return role === 'student' || role === 'teacher';
}

function effectiveStatus(session) {
  if (!session) return AI_SUPPORT_STATUS.AI_ACTIVE;
  if (session.status && Object.values(AI_SUPPORT_STATUS).includes(session.status)) {
    return session.status;
  }
  return session.escalated
    ? AI_SUPPORT_STATUS.WAITING_FOR_SUPPORT
    : AI_SUPPORT_STATUS.AI_ACTIVE;
}

function sessionToClient(session) {
  if (!session) return null;
  const status = effectiveStatus(session);
  return {
    conversationId: session.conversationId,
    userId: session.userId,
    userRole: session.userRole,
    branchId: session.branchId || '',
    status,
    escalated: status !== AI_SUPPORT_STATUS.AI_ACTIVE,
    handoffReason: session.handoffReason || '',
    handoffSummary: session.handoffSummary || '',
    handoffRequestedAt: session.handoffRequestedAt || session.escalatedAt || null,
    claimedBy: session.claimedBy || '',
    claimedByName: session.claimedByName || '',
    claimedAt: session.claimedAt || null,
    resolvedAt: session.resolvedAt || null,
    imageQuota: peekImageQuota(session),
    questionQuota: peekQuestionQuota(session),
  };
}

function aiPaused(status) {
  return status === AI_SUPPORT_STATUS.WAITING_FOR_SUPPORT
    || status === AI_SUPPORT_STATUS.SUPPORT_ACTIVE;
}

function vietnamDateKey(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function imageDailyLimit(role) {
  if (role === 'teacher') return AI_IMAGE_DAILY_LIMIT_TEACHER;
  if (role === 'student') return AI_IMAGE_DAILY_LIMIT_STUDENT;
  return 0;
}

function questionDailyLimit(role) {
  if (role === 'teacher') return AI_QUESTION_DAILY_LIMIT_TEACHER;
  if (role === 'student') return AI_QUESTION_DAILY_LIMIT_STUDENT;
  return 0;
}

function peekQuestionQuota(session) {
  const limit = questionDailyLimit(session?.userRole);
  if (!limit) {
    return { applies: false, used: 0, remaining: null, limit: 0 };
  }
  const today = vietnamDateKey();
  const used = session && String(session.questionDate || '') === today
    ? Number(session.questionCount || 0)
    : 0;
  return {
    applies: true,
    used,
    remaining: Math.max(0, limit - used),
    limit,
    date: today,
  };
}

/**
 * Đếm 1 câu hỏi Gemini (HV/GV). FAQ / chào không gọi hàm này.
 */
async function consumeAiQuestionQuota(sessionDoc) {
  const limit = questionDailyLimit(sessionDoc?.userRole);
  if (!sessionDoc || !limit) {
    return { applies: false, blocked: false, remaining: null, used: 0, limit };
  }
  if (aiPaused(effectiveStatus(sessionDoc))) {
    return { applies: false, blocked: false, remaining: null, used: 0, limit };
  }
  const today = vietnamDateKey();
  const used = String(sessionDoc.questionDate || '') === today
    ? Number(sessionDoc.questionCount || 0)
    : 0;
  if (used >= limit) {
    return { applies: true, blocked: true, remaining: 0, used, limit };
  }
  sessionDoc.questionDate = today;
  sessionDoc.questionCount = used + 1;
  await sessionDoc.save();
  return {
    applies: true,
    blocked: false,
    remaining: limit - used - 1,
    used: used + 1,
    limit,
  };
}

/** Hoàn 1 lượt khi Gemini fail (không trừ oan khi key/model lỗi). */
async function refundAiQuestionQuota(sessionDoc) {
  if (!sessionDoc) return;
  const today = vietnamDateKey();
  if (String(sessionDoc.questionDate || '') !== today) return;
  const used = Number(sessionDoc.questionCount || 0);
  if (used <= 0) return;
  sessionDoc.questionCount = used - 1;
  await sessionDoc.save();
}

function supportFailureReply(err, lang = 'vi') {
  const msg = String(err?.message || '');
  if (/key Gemini het hieu luc|chua chap nhan key|API key|UNAUTHENTICATED|401/i.test(msg)) {
    return lang === 'en' ? KEY_INVALID_REPLY_EN : KEY_INVALID_REPLY;
  }
  return lang === 'en' ? BUSY_REPLY_EN : BUSY_REPLY;
}

function peekImageQuota(session) {
  const limit = imageDailyLimit(session?.userRole);
  const today = vietnamDateKey();
  const used = session && String(session.imageUploadDate || '') === today
    ? Number(session.imageUploadCount || 0)
    : 0;
  return {
    used,
    remaining: Math.max(0, limit - used),
    limit,
    date: today,
  };
}

/**
 * Đếm 1 ảnh gửi cho AI (không áp dụng khi nhân viên đã tiếp nhận).
 * @returns {{ applies: boolean, blocked: boolean, remaining: number|null, used: number, limit: number }}
 */
async function consumeAiImageQuota(sessionDoc) {
  const limit = imageDailyLimit(sessionDoc?.userRole);
  if (!sessionDoc || !limit) {
    return { applies: false, blocked: false, remaining: null, used: 0, limit };
  }
  if (aiPaused(effectiveStatus(sessionDoc))) {
    return { applies: false, blocked: false, remaining: null, used: 0, limit };
  }
  const today = vietnamDateKey();
  const used = String(sessionDoc.imageUploadDate || '') === today
    ? Number(sessionDoc.imageUploadCount || 0)
    : 0;
  if (used >= limit) {
    return {
      applies: true,
      blocked: true,
      remaining: 0,
      used,
      limit,
    };
  }
  sessionDoc.imageUploadDate = today;
  sessionDoc.imageUploadCount = used + 1;
  await sessionDoc.save();
  return {
    applies: true,
    blocked: false,
    remaining: limit - used - 1,
    used: used + 1,
    limit,
  };
}

function loadInlineImage(fileUrl) {
  const disk = resolveDiskPath(fileUrl);
  if (disk && fs.existsSync(disk)) {
    try {
      const stat = fs.statSync(disk);
      if (!stat.size || stat.size > 4 * 1024 * 1024) return null;
      const buf = fs.readFileSync(disk);
      const ext = path.extname(disk).toLowerCase();
      const mime = ext === '.png'
        ? 'image/png'
        : ext === '.webp'
          ? 'image/webp'
          : ext === '.gif'
            ? 'image/gif'
            : 'image/jpeg';
      return { mimeType: mime, data: buf.toString('base64') };
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Fetch ảnh qua HTTP/HTTPS và trả về inline image object cho Gemini Vision.
 * Dùng khi disk file không tồn tại (ephemeral server, cloud host).
 */
async function fetchInlineImageFromUrl(fileUrl) {
  try {
    const rawUrl = String(fileUrl || '').trim();
    if (!rawUrl) return null;

    // AI image analysis may only read files uploaded by this application.
    if (rawUrl.startsWith('/') && !rawUrl.startsWith('/uploads/messages/')) return null;

    // Resolve relative URL to the configured application origin. External hosts
    // must be explicitly allowlisted and are still checked against private IPs.
    let targetUrl = rawUrl;
    if (!targetUrl) return null;
    if (targetUrl.startsWith('/')) {
      const base = (process.env.BASE_URL || process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
      targetUrl = `${base}${targetUrl}`;
    }
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return null;
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;

    const configuredHosts = String(process.env.AI_SUPPORT_ALLOWED_IMAGE_HOSTS || '')
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);
    const baseUrl = new URL(
      (process.env.BASE_URL || process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, ''),
    );
    const isSameOrigin = parsed.hostname.toLowerCase() === baseUrl.hostname.toLowerCase()
      && (parsed.port || (parsed.protocol === 'https:' ? '443' : '80'))
      === (baseUrl.port || (baseUrl.protocol === 'https:' ? '443' : '80'));
    if (isSameOrigin && !parsed.pathname.startsWith('/uploads/messages/')) return null;
    if (!isSameOrigin && !configuredHosts.includes(parsed.hostname.toLowerCase())) return null;
    if (!isSameOrigin && parsed.protocol !== 'https:') return null;

    const addresses = net.isIP(parsed.hostname)
      ? [{ address: parsed.hostname }]
      : await dns.lookup(parsed.hostname, { all: true, verbatim: true });
    const isPrivateAddress = (address) => {
      if (net.isIPv4(address)) {
        const octets = address.split('.').map(Number);
        return octets[0] === 10
          || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
          || octets[0] === 192 && octets[1] === 168
          || octets[0] === 127
          || octets[0] === 169 && octets[1] === 254
          || octets[0] === 0;
      }
      const normalized = address.toLowerCase();
      return normalized === '::1'
        || normalized.startsWith('fc')
        || normalized.startsWith('fd')
        || normalized.startsWith('fe8')
        || normalized.startsWith('fe9')
        || normalized.startsWith('fea')
        || normalized.startsWith('feb');
    };
    if (addresses.some(({ address }) => isPrivateAddress(address)) && !isSameOrigin) return null;

    const MAX_BYTES = 4 * 1024 * 1024;
    return await new Promise((resolve) => {
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.get(parsed, { timeout: 8000, maxRedirects: 0 }, (res) => {
        // Redirect targets are deliberately rejected; they could bypass the
        // host and private-address checks above.
        if (res.statusCode >= 300 && res.statusCode < 400) {
          res.resume();
          resolve(null);
          return;
        }
        if (res.statusCode !== 200) { res.resume(); resolve(null); return; }
        const contentType = res.headers['content-type'] || '';
        const mime = contentType.split(';')[0].trim();
        if (!mime.startsWith('image/')) { res.resume(); resolve(null); return; }
        const chunks = [];
        let total = 0;
        res.on('data', (chunk) => {
          total += chunk.length;
          if (total > MAX_BYTES) { req.destroy(); resolve(null); return; }
          chunks.push(chunk);
        });
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          resolve({ mimeType: mime, data: buf.toString('base64') });
        });
        res.on('error', () => resolve(null));
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });
  } catch {
    return null;
  }
}

function uniqueModels() {
  const seen = new Set();
  const out = [];
  for (const m of SUPPORT_MODEL_FALLBACKS) {
    const k = String(m).trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function getSupportModelFallbacks() {
  return uniqueModels();
}

function isAiSupportEnabled() {
  // Keep the explicit flag as an opt-out, while allowing an already configured
  // AI provider to restore the original automatic-reply behavior.
  return process.env.AI_SUPPORT_ENABLED !== '0' && isAiConfigured();
}

function aiSupportConfigured() {
  return isAiSupportEnabled() && isAiConfigured();
}

async function getSession(conversationId) {
  return AiSupportSession.findOne({ conversationId: String(conversationId) }).lean();
}

async function ensureSession({ conversationId, userId, userRole, branchId = '' }) {
  const cid = String(conversationId);
  let doc = await AiSupportSession.findOne({ conversationId: cid });
  if (!doc) {
    doc = await AiSupportSession.create({
      conversationId: cid,
      userId: String(userId),
      userRole: String(userRole),
      branchId: String(branchId || ''),
      escalated: false,
      status: AI_SUPPORT_STATUS.AI_ACTIVE,
    });
  }
  return doc;
}

function emitTyping(io, { conversationId, userId, show }) {
  if (!io || !userId) return;
  const payload = show
    ? {
      conversationId,
      userId: AI_PEER_ID,
      userName: 'Trợ lý AI',
      userRole: 'system',
    }
    : { conversationId, userId: AI_PEER_ID };
  io.to(String(userId)).emit(show ? 'typing:show' : 'typing:hide', payload);
}

async function loadThreadMessages(conversationId, limit = 14) {
  const rows = await Message.find({ conversationId: String(conversationId), isRecalled: { $ne: true } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return rows.reverse();
}

function isEscalationMessage(m) {
  const c = String(m?.content || '');
  return String(m?.senderId || '') === AI_PEER_ID
    && (c.includes(ESCALATE_MARKER) || /transferred to a support agent/i.test(c));
}

function isIdlePingMessage(m) {
  const t = String(m?.content || '').trim();
  return t === IDLE_PING_TEXT || /Are you still there/i.test(t);
}

function isIdleEndMessage(m) {
  const c = String(m?.content || '');
  return c.includes(IDLE_END_TEXT) || /Support session has ended/i.test(c);
}

function isIdleStillHereMessage(m) {
  const t = String(m?.content || '').trim();
  return t === IDLE_STILL_HERE || t === IDLE_STILL_HERE_EN;
}

function isWelcomeMessage(m) {
  const t = String(m?.content || '');
  return String(m?.senderId || '') === AI_PEER_ID
    && ((/Trợ lý AI Tin Học của Thắng Tin Học/.test(t)
      && /hỗ trợ Word, Excel, PowerPoint, MOS, LMS/i.test(t))
      || (/Office IT AI Assistant at Thang Tin Hoc/i.test(t)
        && /Word, Excel, PowerPoint, MOS, LMS/i.test(t)));
}

/** Phiên đã có lời chào hoặc đang trao đổi - không chào lại trong tin Gemini. */
function isOngoingConversation(history) {
  return (history || []).some((m) => {
    const t = String(m?.messageType || 'text');
    if (t === 'system') return false;
    if (isEscalationMessage(m) || isIdlePingMessage(m) || isIdleEndMessage(m) || isIdleStillHereMessage(m)) return false;
    if (!String(m?.content || '').trim()) return false;
    if (String(m?.senderId || '') === AI_PEER_ID && isWelcomeMessage(m)) return true;
    return true;
  });
}

const LEADING_GREETING_RE = /^(?:\s*(?:Dạ\s+)?(?:Em|Mình)\s+)?(?:Xin\s+chào|Chào(?:\s+Thầy\/Cô|\s+bạn|\s+em)?|Hello|Hi|Hey)\s+[^!\n]+[!….]?\s*(?:\n+)?/i;

function stripLeadingGreeting(text) {
  let t = String(text || '').trim();
  if (!t) return t;
  for (let i = 0; i < 2; i += 1) {
    const next = t.replace(LEADING_GREETING_RE, '').trim();
    if (next === t) break;
    t = next;
  }
  return t;
}

function isIdleDecline(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[.!?…,-]+$/g, '').trim();
  return /^(không|ko|k|khong|no|thôi|thoi|hết rồi|het roi|không cần)$/i.test(t);
}

function isIdleStay(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[.!?…,-]+$/g, '').trim();
  return /^(có|co|yes|còn|con|còn đó|vẫn đây|van day)$/i.test(t);
}

function isTeacherRole(userRole) {
  return String(userRole || '') === 'teacher';
}

function isStudentRole(userRole) {
  return String(userRole || '') === 'student';
}

function normalizeFaqKey(text) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function teacherFaqReply(userRole, userText, lang = 'vi') {
  if (!isTeacherRole(userRole)) return null;
  const t = normalizeFaqKey(userText);
  const enChip = /^(lms (user )?guide|how to use lms|how to (create|schedule) (teaching )?(schedule|student lessons?)|view finance)/i.test(t);
  const isEn = lang === 'en' || enChip;
  if (t === 'hướng dẫn sử dụng lms' || t === 'how to use lms' || t === 'lms user guide' || t === 'lms guide') {
    if (isEn) {
      return [
        'Here is how to use **Thang Tin Hoc LMS**:',
        '**Step 1:** Open the *left sidebar*: **Overview**, **Students**, **Schedule**, **Finance**, **Training**, **Inbox**.',
        '**Step 2:** **Overview** - check upcoming lessons, students, and quick alerts. ⟦go:/teacher|Open Overview⟧',
        '**Step 3:** **Students** - open each student card to *mark attendance*, leave notes, and assign work. ⟦go:/teacher#students|Open Students⟧',
        '**Step 4:** **Training** - internal training videos and materials for teachers. ⟦go:/teacher#training|Open Training⟧',
        '**Step 5:** **Feed** - post questions and share exercise screenshots. ⟦go:/teacher/feed|Open Feed⟧',
        '**Step 6:** **Create Quizzes & Assignments** - prepare tests and assign them to students. ⟦go:/teacher#assignments|Open Assignments⟧',
        'Which step would you like *more details* on?',
      ].join('\n');
    }
    return [
      'Thầy/Cô dùng **LMS Thắng Tin Học** như sau:',
      '**Bước 1:** Mở *menu bên trái*: **Tổng quan**, **Quản lý học viên**, **Lịch dạy**, **Tài chính**, **Đào tạo**, **Hộp thư**.',
      '**Bước 2:** **Tổng quan** - xem lịch sắp tới, học viên, thông báo nhanh. ⟦go:/teacher|Mở Tổng quan⟧',
      '**Bước 3:** **Quản lý học viên** - mở thẻ từng em để *điểm danh*, nhận xét, giao bài. ⟦go:/teacher#students|Mở Quản lý học viên⟧',
      '**Bước 4:** **Đào tạo** - video/tài liệu nội bộ cho giảng viên. ⟦go:/teacher#training|Mở Đào tạo⟧',
      '**Bước 5:** **Bảng tin** - đăng câu hỏi, chia sẻ ảnh bài tập. ⟦go:/teacher/feed|Mở Bảng tin⟧',
      '**Bước 6:** **Tạo trắc nghiệm & bài tập** - soạn đề giao học viên. ⟦go:/teacher#assignments|Mở giao bài⟧',
      'Thầy/Cô cần bước nào *chi tiết hơn* ạ?',
    ].join('\n');
  }
  if (t === 'hướng dẫn tạo lịch dạy cho học viên' || t === 'how to schedule student lessons' || t === 'how to create teaching schedule for students' || t === 'how to create teaching schedule') {
    if (isEn) {
      return [
        'To create a **teaching schedule** for a student:',
        '**Step 1:** Open **Schedule** from the menu (or **Overview**).',
        '**Step 2:** Tap **Schedule New Lesson**.',
        '**Step 3:** Select the *student*, *date*, *time*, and lesson content, then tap **Save**.',
        '**Step 4:** The session appears on the *monthly calendar*. At lesson time, mark **attendance** from the calendar or student card.',
        '**Step 5:** You can *edit or cancel* upcoming lessons that have not been taught.',
        '⟦go:/teacher#schedule|Open Schedule Now⟧',
        'Are you stuck choosing the *student* or the *time slot*?',
      ].join('\n');
    }
    return [
      'Tạo **lịch dạy** cho học viên:',
      '**Bước 1:** Vào menu **Lịch dạy** (hoặc **Tổng quan**).',
      '**Bước 2:** Bấm **Xếp lịch dạy mới**.',
      '**Bước 3:** Chọn *học viên*, *ngày*, *giờ*, nội dung buổi học rồi bấm **Lưu**.',
      '**Bước 4:** Buổi hiện trên *lịch tháng*. Tới giờ dạy thì **điểm danh** trên lịch hoặc thẻ học viên.',
      '**Bước 5:** Có thể *sửa/hủy* buổi *chưa dạy* nếu xếp nhầm.',
      '⟦go:/teacher#schedule|Mở Lịch dạy ngay⟧',
      'Thầy/Cô đang kẹt ở bước chọn *học viên* hay chọn *giờ* ạ?',
    ].join('\n');
  }
  if (t === 'xem tài chính' || t === 'view finance') {
    if (isEn) {
      return [
        'To view teacher **finance**:',
        '**Step 1:** Open **Finance** on the sidebar (or tap Finance on **Overview**).',
        '**Step 2:** This page displays taught lessons, *paid* items, and *estimated* items.',
        '**Step 3:** You can **export a statement** for reconciliation if needed.',
        '**Step 4:** Individual student tuition is managed in *student profile / academic staff* — **do not edit amounts** on this page.',
        '⟦go:/teacher/finance|Open Finance Page⟧',
        'Would you like to check *unpaid* lessons or *this month\'s* statement?',
      ].join('\n');
    }
    return [
      'Xem **tài chính** giảng viên:',
      '**Bước 1:** Vào menu **Tài chính** trên sidebar (hoặc nút Tài chính ở **Tổng quan**).',
      '**Bước 2:** Trang này hiện buổi đã dạy, *đã thanh toán* và còn *tạm tính*.',
      '**Bước 3:** Có thể **xuất bảng kê** nếu cần đối chiếu.',
      '**Bước 4:** Học phí từng học viên nằm ở *hồ sơ học viên / giáo vụ* - **không sửa số tiền** trên trang này.',
      '⟦go:/teacher/finance|Mở trang Tài chính⟧',
      'Thầy/Cô muốn xem buổi *chưa thanh toán* hay bảng kê *tháng này* ạ?',
    ].join('\n');
  }
  return null;
}

function isImageGenRequest(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return false;
  if (/(màn hình|screenshot|chụp ảnh|xem ảnh|gửi ảnh)/i.test(t) && !/(tạo ảnh|vẽ ảnh|sinh ảnh|generate image|create image|draw an image)/i.test(t)) {
    return false;
  }
  return /(tạo ảnh|vẽ ảnh|sinh ảnh|generate image|create image|draw an image|tạo hình ảnh|ai vẽ|dall-?e|midjourney|tạo poster|tạo banner|tạo logo)/i.test(t);
}

function isGhostwriteRequest(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return false;
  const howTo = /(cách viết|hướng dẫn viết|dàn ý|cấu trúc|làm thế nào để viết|trình bày|how to write|outline)/i.test(t);
  const doForMe = /(viết hộ|soạn hộ|làm hộ|viết giúp|soạn giúp|làm giúp|viết luôn|viết đầy đủ|viết hoàn chỉnh|soạn luôn|viết cho mình|nội dung hoàn chỉnh|toàn bộ bài|write for me|write my essay|write a full essay)/i.test(t);
  if (howTo && !doForMe) return false;
  const doc = /(tiểu luận|bài luận|luận văn|báo cáo thực tập|báo cáo môn|công văn|văn bản hành chính|đơn xin|biên bản họp|tờ trình|bài thu hoạch|essay|thesis|official dispatch)/i.test(t);
  if (!doc) return false;
  return doForMe || /(viết|soạn)\s+\d+\s*(chữ|từ|trang)/i.test(t) || /(viết|soạn)\s+(một|1)\s*(bài|bản)/i.test(t);
}

function studentFaqReply(userRole, userText, lang = 'vi') {
  if (!isStudentRole(userRole)) return null;
  const t = normalizeFaqKey(userText);
  const enChip = /^(schedule|class schedule|watch video(s| lessons)?|video lessons?|how to use (sumif|vlookup|if))/i.test(t);
  const isEn = lang === 'en' || enChip;
  if (t === 'lịch học' || t === 'schedule' || t === 'class schedule') {
    if (isEn) {
      return [
        'To view your **class schedule** on LMS:',
        '**Step 1:** Open **Schedule** (or **Overview** → Schedule tab).',
        '**Step 2:** Check the *date*, *time*, and *teacher* for each session.',
        '**Step 3:** Join at your scheduled time; if you will be *absent*, contact your **teacher / staff**.',
        '⟦go:/student#schedule|Open Schedule Now⟧',
        'Are you missing any sessions on your schedule?',
      ].join('\n');
    }
    return [
      'Xem **lịch học** trên LMS:',
      '**Bước 1:** Mở menu **Lịch học** (hoặc **Tổng quan** → tab Lịch học).',
      '**Bước 2:** Xem *ngày*, *giờ*, *giảng viên* của từng buổi.',
      '**Bước 3:** Tới giờ thì vào học theo lịch; *vắng mặt* thì liên hệ **GV/giáo vụ**.',
      '⟦go:/student#schedule|Mở Lịch học ngay⟧',
      'Bạn đang không thấy buổi nào trên lịch à?',
    ].join('\n');
  }
  if (t === 'học video' || t === 'watch video lessons' || t === 'watch videos' || t === 'video lessons') {
    if (isEn) {
      return [
        'To **watch video lessons** on LMS:',
        '**Step 1:** Open **Materials**.',
        '**Step 2:** Choose the **Video Lessons** tab and open lessons in your *enrolled course*.',
        '**Step 3:** Watch *in order*; *locked* lessons unlock once you finish previous ones.',
        '⟦go:/student#materials|Open Video Lessons Now⟧',
        'Is there a lesson you cannot see?',
      ].join('\n');
    }
    return [
      'Học **video** trên LMS:',
      '**Bước 1:** Vào menu **Tài liệu**.',
      '**Bước 2:** Chọn tab **Video học**, mở bài theo *khóa đang học*.',
      '**Bước 3:** Xem *lần lượt*; bài *khóa* thì học hết bài trước.',
      '⟦go:/student#materials|Mở Video học ngay⟧',
      'Bạn không thấy bài nào à?',
    ].join('\n');
  }
  if (t === 'cách sử dụng hàm sumif, sumifs' || t === 'how to use sumif, sumifs' || t === 'how to use sumif / sumifs') {
    if (isEn) {
      return [
        'How to use **SUMIF** and **SUMIFS**:',
        '',
        'Suppose you have a sales table in *A1:C5*:',
        '| Branch | Product | Revenue |',
        '| --- | --- | --- |',
        '| Hanoi | Pen | 100 |',
        '| Hai Phong | Notebook | 200 |',
        '| Hanoi | Ruler | 150 |',
        '| Da Nang | Pen | 300 |',
        '',
        '**SUMIF** — sums based on a *single* condition.',
        '**Step 1:** Syntax: `SUMIF(range, criteria, [sum_range])`.',
        '**Step 2:** *Example* total revenue for **Hanoi** branch → `SUMIF(A2:A5, "Hanoi", C2:C5)` = **250**.',
        '',
        '**SUMIFS** — sums based on *multiple* conditions.',
        '**Step 1:** Syntax: `SUMIFS(sum_range, criteria_range1, criteria1, ...)`.',
        '**Step 2:** *Example* **Hanoi** and **Pen** → `SUMIFS(C2:C5, A2:A5, "Hanoi", B2:B5, "Pen")` = **100**.',
        '',
        'See more lessons on LMS: ⟦go:/student#materials|Open Video Lessons⟧',
        'Which column are you writing your formula on?',
      ].join('\n');
    }
    return [
      'Cách dùng **SUMIF** và **SUMIFS**:',
      '',
      'Giả sử bảng bán hàng *A1:C5* như sau:',
      '| Chi nhánh | Sản phẩm | Doanh thu |',
      '| --- | --- | --- |',
      '| Hà Nội | Bút | 100 |',
      '| Hải Phòng | Vở | 200 |',
      '| Hà Nội | Thước | 150 |',
      '| Đà Nẵng | Bút | 300 |',
      '',
      '**SUMIF** - cộng theo *một* điều kiện.',
      '**Bước 1:** Viết `SUMIF`(range; tiêu_chí; [sum_range]).',
      '**Bước 2:** *Ví dụ* cộng doanh thu chi nhánh **Hà Nội** → `SUMIF(A2:A5; "Hà Nội"; C2:C5)` = **250**.',
      '',
      '**SUMIFS** - cộng theo *nhiều* điều kiện.',
      '**Bước 1:** Viết `SUMIFS`(sum_range; criteria_range1; criteria1; ...).',
      '**Bước 2:** *Ví dụ* **Hà Nội** và sản phẩm **Bút** → `SUMIFS(C2:C5; A2:A5; "Hà Nội"; B2:B5; "Bút")` = **100**.',
      '',
      'Muốn xem thêm bài trên LMS: ⟦go:/student#materials|Mở Video học⟧',
      'Bạn đang làm công thức trên cột nào?',
    ].join('\n');
  }
  if (t === 'cách sử dụng hàm vlookup' || t === 'how to use vlookup') {
    if (isEn) {
      return [
        '**VLOOKUP** searches for a value in the *leftmost* column of a table.',
        '**Step 1:** Syntax: `VLOOKUP(lookup_value, table_array, col_index_num, FALSE)`.',
        '**Step 2:** *Example:* `VLOOKUP(E2, A2:C20, 3, FALSE)`.',
        '**Step 3:** **FALSE** means *exact* match. `#N/A` means the lookup key was *not found*.',
        'See more lessons on LMS: ⟦go:/student#materials|Open Video Lessons⟧',
        'Which column holds your lookup key?',
      ].join('\n');
    }
    return [
      '**VLOOKUP** tìm giá trị theo cột khóa *bên trái* bảng.',
      '**Bước 1:** Viết `VLOOKUP`(giá_trị_cần_tìm; bảng; số_cột; FALSE).',
      '**Bước 2:** *Ví dụ:* `VLOOKUP(E2; A2:C20; 3; FALSE)`.',
      '**Bước 3:** **FALSE** = khớp *chính xác*. Lỗi `#N/A` là *không thấy mã*.',
      'Muốn xem thêm bài trên LMS: ⟦go:/student#materials|Mở Video học⟧',
      'Bạn đang dò mã ở cột nào?',
    ].join('\n');
  }
  if (t === 'cách sử dụng hàm if' || t === 'how to use if' || t === 'how to use if formula') {
    if (isEn) {
      return [
        '**IF** returns different values based on a *True* / *False* test.',
        '**Step 1:** Syntax: `IF(logical_test, value_if_true, value_if_false)`.',
        '**Step 2:** *Example:* `IF(B2>=5, "Pass", "Fail")`.',
        '**Step 3:** For multiple conditions, use `IFS` or *nested* `IF` functions.',
        'See more lessons on LMS: ⟦go:/student#materials|Open Video Lessons⟧',
        'Which column are you evaluating?',
      ].join('\n');
    }
    return [
      '**IF** trả kết quả theo điều kiện *Đúng* / *Sai*.',
      '**Bước 1:** Viết `IF`(điều_kiện; nếu_đúng; nếu_sai).',
      '**Bước 2:** *Ví dụ:* `IF(B2>=5; "Đạt"; "Chưa đạt")`.',
      '**Bước 3:** Lồng nhiều điều kiện thì dùng `IFS` hoặc `IF` *lồng nhau*.',
      'Muốn xem thêm bài trên LMS: ⟦go:/student#materials|Mở Video học⟧',
      'Bạn đang chấm đạt/không đạt theo cột nào?',
    ].join('\n');
  }
  return null;
}

function lmsFaqReply(userRole, userText, lang = 'vi') {
  const t = normalizeFaqKey(userText);
  const teacher = isTeacherRole(userRole);
  const student = isStudentRole(userRole);
  if (!teacher && !student) return null;
  const isEn = lang === 'en';

  if (teacher && /(tổng quan|dashboard|công việc cần xử lý|đang dạy|học viên mới|uy tín|5 sao|teacher dashboard|teacher overview)/i.test(t)) {
    return (isEn ? [
      'Guide to **Teacher Overview**:',
      '• **Pending Tasks**: check attendance, assignments to grade, messages, and lessons to schedule.',
      '• **Monthly Income**: view quick earnings summary and open Finance details.',
      '• **Teaching / New Students**: check active students assigned to you and new learners.',
      '• **Upcoming Schedule**: view sessions this month and jump straight to Schedule.',
      '• **5 Stars / Reputation**: track your student ratings and teacher score.',
      '⟦go:/teacher|Open Overview⟧',
    ] : [
      'Hướng dẫn **Tổng quan giảng viên**:',
      '• **Công việc cần xử lý ngay**: xem điểm danh, bài cần chấm, tin nhắn và lịch cần xếp.',
      '• **Thu nhập tháng**: xem nhanh thu nhập và mở chi tiết tài chính.',
      '• **Đang dạy / Học viên mới**: xem số học viên đang phụ trách và học viên mới.',
      '• **Lịch dạy sắp tới**: xem các buổi trong tháng và mở nhanh Lịch dạy.',
      '• **5 sao / Uy tín**: theo dõi đánh giá và uy tín giảng viên.',
      '⟦go:/teacher|Mở Tổng quan⟧',
    ]).join('\n');
  }

  if (teacher && (/(xếp lịch|sắp lịch|tạo buổi học|thêm buổi học|chọn khung giờ|đặt lịch).*(học viên|hv)|học viên.*(xếp lịch|sắp lịch|tạo buổi học|thêm buổi học|chọn khung giờ|đặt lịch)/i.test(t) || /(schedule.*student|create.*lesson.*student|book.*slot.*student)/i.test(t))) {
    return (isEn ? [
      'To **schedule lessons for a student**:',
      '**Step 1:** Open **Overview** and tap **Schedule**, or open **Students**.',
      '**Step 2:** From **Students**, select the student and tap **Schedule**.',
      '**Step 3:** In the **Weekly Schedule · [Student Name]** modal, verify the course and remaining sessions.',
      '**Step 4:** Switch weeks using previous week, current week, or next week buttons.',
      '**Step 5:** Pick a time slot on the target date.',
      '**Step 6:** Double-check date, time, and student, then tap **Schedule Now**.',
      '*Changes are only saved when you tap **Schedule Now**. Past dates cannot be booked or edited; conflicting slots may be locked.*',
      '⟦go:/teacher#students|Open Students⟧ · ⟦go:/teacher#schedule|Open Schedule & Attendance⟧',
    ] : [
      'Để **xếp lịch học cho học viên**:',
      '**Bước 1:** Mở **Tổng quan** và chọn **Xếp lịch**, hoặc mở **Học viên**.',
      '**Bước 2:** Nếu mở từ **Học viên**, chọn đúng học viên rồi bấm **Sắp lịch**.',
      '**Bước 3:** Trong popup **Xếp lịch tuần · [Tên học viên]**, kiểm tra đúng khóa học và số buổi còn lại.',
      '**Bước 4:** Chọn tuần bằng nút tuần trước, tuần hiện tại hoặc tuần sau.',
      '**Bước 5:** Chọn khung giờ ở đúng ngày cần xếp.',
      '**Bước 6:** Kiểm tra lại ngày, giờ và học viên rồi bấm **Xếp lịch ngay**.',
      '*Chỉ khi bấm **Xếp lịch ngay** hệ thống mới lưu thay đổi. Ngày đã qua không thể xếp hoặc sửa lịch; khung giờ bị trùng có thể bị khóa.*',
      '⟦go:/teacher#students|Mở Học viên⟧ · ⟦go:/teacher#schedule|Mở Lịch học & Điểm danh⟧',
    ]).join('\n');
  }

  if (teacher && /(học viên|tiến độ|ghi chú học viên|manage students|student profile|student progress)/i.test(t)) {
    const parts = isEn ? [
      '**Students** includes these tabs:',
      '• **Progress**: view completed sessions, remaining sessions, and average score.',
      '• **Assignments**: check assigned tasks or tap **Assign**.',
      '• **Quizzes**: create session quizzes, pick students, duration, and questions.',
      '• **Meeting Link**: update the Google Meet/Zoom link for your student.',
      '• **Schedule**: select weekly slots and tap **Schedule Now**.',
      '• **Activity Log**: view attendance history, cancellations, submissions, grading, and reviews.',
      '⟦go:/teacher#students|Open Students⟧',
    ] : [
      '**Học viên** có các mục:',
      '• **Tiến độ**: xem số buổi đã học, còn lại và điểm trung bình.',
      '• **Bài tập**: xem bài đã giao hoặc bấm **Giao bài**.',
      '• **Trắc nghiệm**: tạo bài trắc nghiệm theo buổi học, chọn học viên, thời gian và câu hỏi.',
      '• **Link học**: cập nhật link Google Meet/Zoom để học viên sử dụng.',
      '• **Sắp lịch**: chọn khung giờ trong tuần rồi bấm **Xếp lịch ngay**.',
      '• **Nhật ký**: xem lịch sử điểm danh, hủy buổi, nộp bài, chấm điểm và đánh giá.',
      '⟦go:/teacher#students|Mở Học viên⟧',
    ];
    if (/(bài tập|trắc nghiệm|link học|sắp lịch|nhật ký)/i.test(t)) {
      parts.push(isEn ? 'Open the matching tab at the top of the student profile to perform that action.' : 'Hãy mở thẻ đúng tên ở phía trên hồ sơ học viên để thao tác.');
    }
    return parts.join('\n');
  }

  if (/(chức năng|menu|dùng lms|sử dụng lms|trên lms|lms có gì|hướng dẫn lms|how to use lms|lms features|lms guide|what is on lms)/i.test(t)) {
    if (isEn) {
      return (teacher ? [
        'Main LMS features for **Teachers**:',
        '1. **Overview**: view upcoming schedule, students, and alerts.',
        '2. **Students**: check student profiles, progress, notes, and attendance.',
        '3. **Schedule**: create/edit sessions, select students, mark attendance, and request makeup attendance.',
        '4. **Assignments & Quizzes**: create tasks, quizzes, assign homework, and review results.',
        '5. **Training**: access internal courses and track completion.',
        '6. **Finance**: view taught lessons, estimated pay, and payouts.',
        '7. **Inbox**: message students, academic staff, or live support.',
        '⟦go:/teacher|Open Overview⟧ · ⟦go:/teacher#students|Open Students⟧ · ⟦go:/teacher#schedule|Open Schedule⟧',
        'Which feature would you like help with first?',
      ] : [
        'Main LMS features for **Students**:',
        '1. **Overview**: check your course status and recent activity.',
        '2. **Schedule**: view classes, teacher info, attendance, and session history.',
        '3. **Materials / Videos**: watch video lessons, download materials, and access learning software.',
        '4. **Assignments & Scores**: complete assigned homework and view grades.',
        '5. **Exam Room / MOS-IC3**: take tests or practice for certifications.',
        '6. **Rate Teacher**: submit feedback after eligible lessons.',
        '7. **Inbox**: message your teacher, academic staff, or support.',
        '⟦go:/student|Open Overview⟧ · ⟦go:/student#schedule|Open Schedule⟧ · ⟦go:/student#materials-videos|Open Video Lessons⟧',
        'Which feature would you like help with first?',
      ]).join('\n');
    }
    return teacher
      ? [
        'Các chức năng chính dành cho **giảng viên** trên LMS:',
        '1. **Tổng quan**: xem lịch sắp tới, học viên và thông báo.',
        '2. **Học viên**: xem hồ sơ, tiến độ, ghi chú và thao tác điểm danh.',
        '3. **Lịch dạy**: tạo/sửa buổi học, chọn học viên, điểm danh và yêu cầu điểm danh bù.',
        '4. **Bài tập & kiểm tra**: tạo bài tập, quiz, giao bài và xem kết quả.',
        '5. **Đào tạo**: học khóa nội bộ và theo dõi tiến độ.',
        '6. **Tài chính**: xem buổi đã dạy, tạm tính và thanh toán.',
        '7. **Hộp thư**: nhắn học viên, giáo vụ hoặc hỗ trợ trực tiếp.',
        '⟦go:/teacher|Mở Tổng quan⟧ · ⟦go:/teacher#students|Mở Học viên⟧ · ⟦go:/teacher#schedule|Mở Lịch dạy⟧',
        'Bạn muốn hướng dẫn chức năng nào trước ạ?',
      ].join('\n')
      : [
        'Các chức năng chính dành cho **học viên** trên LMS:',
        '1. **Tổng quan**: xem tình trạng khóa học và hoạt động gần đây.',
        '2. **Lịch học**: xem buổi học, giáo viên, điểm danh và lịch sử.',
        '3. **Tài liệu/Video**: học video, mở tài liệu và phần mềm học tập.',
        '4. **Bài tập & điểm**: làm bài được giao và xem kết quả.',
        '5. **Phòng thi/MOS-IC3**: vào thi hoặc luyện chứng nhận.',
        '6. **Đánh giá giáo viên**: đánh giá sau buổi học đủ điều kiện.',
        '7. **Hộp thư**: nhắn giáo viên, giáo vụ hoặc hỗ trợ trực tiếp.',
        '⟦go:/student|Mở Tổng quan⟧ · ⟦go:/student#schedule|Mở Lịch học⟧ · ⟦go:/student#materials-videos|Mở Video học⟧',
        'Bạn muốn hướng dẫn chức năng nào trước?',
      ].join('\n');
  }

  if (teacher && /(điểm danh|điểm danh bù|mark attendance|makeup attendance)/i.test(t)) {
    return (isEn ? [
      'Guide to **lesson attendance**:',
      '**Step 1:** Open **Schedule** or **Students**.',
      '**Step 2:** Select the lesson and student.',
      '**Step 3:** Choose the attendance status, add a note if needed, and save.',
      '**Step 4:** If a session was missed, tap **Request Makeup Attendance** and enter the reason.',
      '⟦go:/teacher#schedule|Open Schedule⟧',
    ] : [
      'Hướng dẫn **điểm danh buổi học**:',
      '**Bước 1:** Mở **Lịch dạy** hoặc **Học viên**.',
      '**Bước 2:** Chọn đúng buổi học và học viên.',
      '**Bước 3:** Chọn trạng thái điểm danh, nhập nhận xét nếu cần rồi lưu.',
      '**Bước 4:** Nếu bỏ lỡ buổi, chọn **Yêu cầu điểm danh bù** và gửi lý do.',
      '⟦go:/teacher#schedule|Mở Lịch dạy⟧',
    ]).join('\n');
  }
  if (teacher && /(lịch dạy|xếp lịch|tạo lịch|manage schedule|teaching schedule)/i.test(t)) {
    return (isEn ? [
      'Guide to **Schedule & Attendance Management**:',
      '**Step 1:** Open **Schedule & Attendance** to view your weekly calendar.',
      '**Step 2:** Tap **Schedule This Day** from the monthly view, or open a student profile and tap **Schedule**.',
      '**Step 3:** Pick a date and time slot in the popup, then tap **Schedule Now**.',
      '**Step 4:** For existing lessons, use the slot controls to view, add notes/reschedule, or cancel based on your permissions.',
      '⟦go:/teacher#schedule|Open Schedule⟧',
    ] : [
      'Hướng dẫn **Quản lý Lịch học & Điểm danh**:',
      '**Bước 1:** Mở mục **Lịch học & Điểm danh** để xem lịch theo tuần.',
      '**Bước 2:** Chọn **Sắp lịch ngày này** nếu muốn xếp lịch từ lịch tháng, hoặc mở hồ sơ học viên và chọn **Sắp lịch**.',
      '**Bước 3:** Chọn ngày/khung giờ trong popup rồi bấm **Xếp lịch ngay**.',
      '**Bước 4:** Với lịch đã có, dùng thao tác đang hiển thị trên ca để xem, ghi chú/đổi lịch hoặc hủy theo quyền được cấp.',
      '⟦go:/teacher#schedule|Mở Lịch dạy⟧',
    ]).join('\n');
  }
  if (teacher && /(tài chính|hoa hồng|thanh toán|thu nhập|teacher finance|commission|payout)/i.test(t)) {
    return (isEn ? [
      'Guide to **Teacher Finance**:',
      '**Step 1:** Open **Finance** from the menu.',
      '**Step 2:** Review taught lessons, *estimated* items, and *paid* items.',
      '**Step 3:** Export or check the statement when reconciliation is needed.',
      '⟦go:/teacher/finance|Open Finance⟧',
    ] : [
      'Hướng dẫn xem **Tài chính**:',
      '**Bước 1:** Mở menu **Tài chính**.',
      '**Bước 2:** Xem các buổi đã dạy, khoản tạm tính và đã thanh toán.',
      '**Bước 3:** Dùng bảng kê để đối chiếu khi cần.',
      '⟦go:/teacher/finance|Mở Tài chính⟧',
    ]).join('\n');
  }
  if (teacher && /(đào tạo|khóa đào tạo|học khóa|teacher training|internal training)/i.test(t)) {
    return (isEn ? [
      'Guide to **Training**:',
      '**Step 1:** Open **Training**.',
      '**Step 2:** Choose an internal course.',
      '**Step 3:** Study videos and materials in order and track your progress.',
      '⟦go:/teacher#training|Open Training⟧',
    ] : [
      'Hướng dẫn **Đào tạo**:',
      '**Bước 1:** Mở mục **Đào tạo**.',
      '**Bước 2:** Chọn khóa học nội bộ.',
      '**Bước 3:** Học video/tài liệu theo thứ tự và theo dõi tiến độ.',
      '⟦go:/teacher#training|Mở Đào tạo⟧',
    ]).join('\n');
  }
  if (teacher && /(học viên|tiến độ học viên|ghi chú học viên)/i.test(t)) {
    return (isEn ? [
      'Guide to **managing students**:',
      '**Step 1:** Open **Students**.',
      '**Step 2:** Find and open the student profile.',
      '**Step 3:** Review progress, schedule, attendance, and notes.',
      '**Step 4:** Save comments/notes or jump to Schedule to manage sessions.',
      '⟦go:/teacher#students|Open Student List⟧',
    ] : [
      'Hướng dẫn quản lý **học viên**:',
      '**Bước 1:** Mở menu **Học viên**.',
      '**Bước 2:** Tìm và mở hồ sơ học viên.',
      '**Bước 3:** Xem tiến độ, lịch học, điểm danh và ghi chú.',
      '**Bước 4:** Lưu nhận xét/ghi chú hoặc chuyển sang lịch dạy để thao tác buổi học.',
      '⟦go:/teacher#students|Mở danh sách học viên⟧',
    ]).join('\n');
  }
  if (teacher && /(bài tập|quiz|trắc nghiệm|giao bài|create quiz|assign homework)/i.test(t)) {
    return (isEn ? [
      'Guide to **Assignments & Tests**:',
      '**Step 1:** Open **Assignments & Tests**.',
      '**Step 2:** Choose to create an assignment or a quiz.',
      '**Step 3:** Enter questions, answers, due date, and select students.',
      '**Step 4:** Save/assign the task, then view results in the same section.',
      '⟦go:/teacher#assignments|Open Assignments & Tests⟧',
    ] : [
      'Hướng dẫn **bài tập và kiểm tra**:',
      '**Bước 1:** Mở **Bài tập & kiểm tra**.',
      '**Bước 2:** Chọn tạo bài tập hoặc quiz.',
      '**Bước 3:** Nhập câu hỏi, đáp án, thời hạn và chọn học viên.',
      '**Bước 4:** Lưu/giao bài, sau đó xem kết quả trong cùng khu vực.',
      '⟦go:/teacher#assignments|Mở Bài tập & kiểm tra⟧',
    ]).join('\n');
  }
  if (teacher && /(bảng tin|đăng bài|hỏi bài|chia sẻ bài tập|teacher feed|post on feed)/i.test(t)) {
    return (isEn ? [
      'Guide to **Feed**:',
      '**Step 1:** Open **Feed**.',
      '**Step 2:** Write your question or content and attach screenshots if needed.',
      '**Step 3:** Select audience visibility and tap **Post**.',
      '**Step 4:** Follow comments and discussions directly under your post.',
      '⟦go:/teacher/feed|Open Feed⟧',
    ] : [
      'Hướng dẫn **Bảng tin**:',
      '**Bước 1:** Mở **Bảng tin**.',
      '**Bước 2:** Nhập câu hỏi hoặc nội dung muốn chia sẻ, có thể dán ảnh.',
      '**Bước 3:** Chọn phạm vi người xem rồi bấm **Đăng bài**.',
      '**Bước 4:** Theo dõi bình luận và trao đổi ngay dưới bài đăng.',
      '⟦go:/teacher/feed|Mở Bảng tin⟧',
    ]).join('\n');
  }
  if (teacher && /(tin tức|bài viết|thông báo trung tâm|center news)/i.test(t)) {
    return (isEn ? [
      'Guide to **News**:',
      '**Step 1:** Open **Learning & Resources → News**.',
      '**Step 2:** Search articles by keyword, topic, date, or newest first.',
      '**Step 3:** Tap a news card to read the full article.',
      '⟦go:/teacher/news|Open News⟧',
    ] : [
      'Hướng dẫn **Tin tức**:',
      '**Bước 1:** Mở **Học & tài nguyên → Tin tức**.',
      '**Bước 2:** Tìm bài viết theo từ khóa, chủ đề, thời gian hoặc sắp xếp mới nhất.',
      '**Bước 3:** Bấm vào thẻ tin để xem nội dung chi tiết.',
      '⟦go:/teacher/news|Mở Tin tức⟧',
    ]).join('\n');
  }
  if (student && /(tổng quan|dashboard|việc cần làm|tiến độ khóa học|buổi còn lại|điểm trung bình|student dashboard|student overview)/i.test(t)) {
    return (isEn ? [
      'Guide to **Student Overview**:',
      '• **Course & Teacher**: view your enrolled course, teacher, and completed/remaining sessions.',
      '• **Avg Score / Progress**: appears once scores or session records exist in the system.',
      '• **Today\'s Tasks**: check quizzes, assignments, scheduled classes, and unread messages.',
      '• **Study Log & Scores**: review submissions, quizzes, and updated grades.',
      '*If you see "No upcoming schedule", "No courses yet", or "No score data yet", your account may not have data assigned yet. Please contact your teacher or academic staff if you already enrolled.*',
      '⟦go:/student|Open Overview⟧',
    ] : [
      'Hướng dẫn **Tổng quan học viên**:',
      '• **Khóa học và GV**: xem khóa đang học, giảng viên và số buổi đã học/còn lại.',
      '• **Điểm TB / Tiến độ**: chỉ hiển thị khi hệ thống đã có điểm hoặc dữ liệu buổi học.',
      '• **Việc cần làm hôm nay**: xem bài trắc nghiệm, bài tập, lịch học và tin nhắn mới.',
      '• **Nhật ký học tập & Điểm số**: xem bài nộp, trắc nghiệm và điểm đã được cập nhật.',
      '*Nếu màn hình ghi “Chưa có lịch sắp tới”, “Chưa có khóa học” hoặc “Chưa có dữ liệu điểm số”, tài khoản chưa được cấp dữ liệu tương ứng hoặc giáo viên chưa tạo/gửi nội dung. Hãy liên hệ giáo viên/giáo vụ nếu bạn đã đăng ký nhưng vẫn trống.*',
      '⟦go:/student|Mở Tổng quan⟧',
    ]).join('\n');
  }
  if (student && /(lịch học|lịch theo tuần|buổi sắp tới|lịch hủy|chưa điểm danh|nhật ký học tập|my schedule|weekly schedule|class schedule)/i.test(t)) {
    return (isEn ? [
      'Guide to **Class Schedule & Attendance**:',
      '**Step 1:** Open **Learning → Schedule** to see classes scheduled by your teacher.',
      '**Step 2:** Use the arrow buttons to switch weeks and check daily sessions.',
      '**Step 3:** Review completed, upcoming, and cancelled sessions along with their course.',
      '**Step 4:** Under **Study Log**, filter by **All**, **Day**, **Week**, **Month**, **Unmarked**, or **Cancelled**.',
      '**Step 5:** When the attendance popup appears, verify the session details and confirm; contact your teacher/staff if anything is incorrect.',
      '*Students do not create schedules on this screen. If your calendar is empty, your teacher may not have scheduled lessons yet or your course has not been assigned.*',
      '⟦go:/student#schedule|Open Schedule⟧',
    ] : [
      'Hướng dẫn **Lịch học & Điểm danh**:',
      '**Bước 1:** Mở **Học tập → Lịch học** để xem lịch đã được giảng viên xếp.',
      '**Bước 2:** Dùng mũi tên để chuyển tuần và xem lịch theo từng ngày.',
      '**Bước 3:** Xem số buổi đã học, sắp tới, đã hủy và khóa học tương ứng.',
      '**Bước 4:** Ở **Nhật ký học tập**, chọn **Tất cả**, **Ngày**, **Tuần**, **Tháng**, **Chưa điểm danh** hoặc **Lịch hủy** để lọc.',
      '**Bước 5:** Khi popup điểm danh xuất hiện, kiểm tra đúng buổi rồi xác nhận; nếu sai, liên hệ GV/giáo vụ để được xử lý.',
      '*Học viên không tự tạo lịch ở màn hình này. Nếu lịch trống, có thể giáo viên chưa xếp lịch, tài khoản chưa được gắn khóa học, tuần đang xem chưa có buổi hoặc buổi đã bị hủy.*',
      '⟦go:/student#schedule|Mở Lịch học⟧',
    ]).join('\n');
  }
  if (student && /(video|video học|tài liệu|tài liệu khóa học|phần mềm|link phần mềm|course materials|learning software)/i.test(t)) {
    return (isEn ? [
      'Guide to **Videos, Materials & Software**:',
      '**Step 1:** Open **Learning**, then choose **Videos**, **Materials**, or **Software**.',
      '**Step 2:** Use the course/subject filter if shown.',
      '**Step 3:** In **Videos**, open unlocked lessons and watch in sequence.',
      '**Step 4:** In **Materials**, tap **Download** for files attached by Admin/teacher.',
      '**Step 5:** In **Software**, open the installation link or setup guide provided by the center.',
      '*"No courses yet", "No files yet", or "No software links yet" means content has not been assigned to your account yet — please contact Admin if needed.*',
      '⟦go:/student#materials-videos|Open Videos⟧ · ⟦go:/student#materials-files|Open Materials⟧ · ⟦go:/student#materials-software|Open Software⟧',
    ] : [
      'Hướng dẫn **Video, Tài liệu và Phần mềm**:',
      '**Bước 1:** Mở **Học tập** rồi chọn **Video**, **Tài liệu** hoặc **Phần mềm**.',
      '**Bước 2:** Dùng bộ lọc khóa học/môn học nếu màn hình có bộ lọc.',
      '**Bước 3:** Với **Video**, mở bài được cấp và học theo thứ tự.',
      '**Bước 4:** Với **Tài liệu**, bấm **Tải xuống** khi tệp đã được Admin/giáo viên đính kèm.',
      '**Bước 5:** Với **Phần mềm**, mở link hoặc hướng dẫn cài đặt được trung tâm phát hành.',
      '*“Chưa có khóa học nào”, “Chưa có file” hoặc “Chưa có link phần mềm” nghĩa là hiện chưa có dữ liệu được cấp cho tài khoản; hãy liên hệ Admin nếu bạn đã đăng ký.*',
      '⟦go:/student#materials-videos|Mở Video⟧ · ⟦go:/student#materials-files|Mở Tài liệu⟧ · ⟦go:/student#materials-software|Mở Phần mềm⟧',
    ]).join('\n');
  }
  if (student && /(bài tập về nhà|bài tập được giao|nộp bài|hạn nộp|bài chưa làm|submit homework|submit assignment|my assignments)/i.test(t)) {
    return (isEn ? [
      'Guide to **Homework & Assignments**:',
      '**Step 1:** Open **Learning → Assignments**.',
      '**Step 2:** Select an assigned task to check instructions, due date, and attached files.',
      '**Step 3:** Complete your work, upload required files, and tap **Submit**.',
      '**Step 4:** Track submission status, score, and teacher feedback.',
      '*If it displays "You have no assignments due right now", no new task is assigned or all tasks are completed.*',
      '⟦go:/student#materials-assignments|Open Assignments⟧',
    ] : [
      'Hướng dẫn **Bài tập về nhà**:',
      '**Bước 1:** Mở **Học tập → Bài tập**.',
      '**Bước 2:** Chọn bài được giao để xem yêu cầu, hạn nộp và tệp đính kèm.',
      '**Bước 3:** Làm bài theo yêu cầu, tải tệp lên nếu cần rồi bấm **Nộp bài**.',
      '**Bước 4:** Theo dõi trạng thái đã nộp, điểm và nhận xét của giáo viên.',
      '*Nếu hiển thị “Hiện tại bạn không có bài tập nào cần nộp”, hiện chưa có bài được giao hoặc bài đã hoàn tất; hãy kiểm tra lại sau khi giáo viên giao bài.*',
      '⟦go:/student#materials-assignments|Mở Bài tập⟧',
    ]).join('\n');
  }
  if (student && /(điểm thi|bảng điểm|kết quả thi|xem điểm của tôi|exam scores|view my grades)/i.test(t)) {
    return (isEn ? [
      'Guide to **Exam Scores**:',
      '**Step 1:** Open **Exams & Certificates → Exam Scores**.',
      '**Step 2:** View your summary scores by subject: quiz, practical/essay, and overall status.',
      '**Step 3:** **NOT TAKEN** or **Not done** means no result is recorded yet — not a zero score.',
      '**Step 4:** If you already took an exam and scores are missing, send the subject code and exam time to your teacher/staff.',
      '⟦go:/student#exam-scores|Open Exam Scores⟧',
    ] : [
      'Hướng dẫn **Điểm thi**:',
      '**Bước 1:** Mở **Thi & chứng nhận → Điểm thi**.',
      '**Bước 2:** Xem bảng điểm tổng hợp theo từng môn: trắc nghiệm, tự luận/thực hành và kết quả.',
      '**Bước 3:** Trạng thái **CHƯA THI** hoặc **Chưa làm** nghĩa là chưa có kết quả được ghi nhận, không phải điểm 0.',
      '**Bước 4:** Nếu đã thi nhưng chưa cập nhật, gửi mã môn và thời điểm thi cho giáo viên/giáo vụ kiểm tra.',
      '⟦go:/student#exam-scores|Mở Điểm thi⟧',
    ]).join('\n');
  }
  if (student && /(phòng thi|trắc nghiệm buổi học|bài kiểm tra|thi chứng nhận môn học|exam room|session quiz)/i.test(t)) {
    return (isEn ? [
      'Guide to **Exam Room**:',
      '**Step 1:** Open **Exams & Certificates → Exam Room**.',
      '**Step 2:** Choose **Session Quizzes** to see quizzes assigned by your teacher.',
      '**Step 3:** Tap Start only when you are ready; check the duration and rules beforehand.',
      '**Step 4:** For subject certification tests, follow the instructions and submit before time runs out.',
      '*If it says "No new quizzes available", your teacher has not assigned or unlocked one yet.*',
      '⟦go:/student/exam|Open Exam Room⟧',
    ] : [
      'Hướng dẫn **Phòng thi**:',
      '**Bước 1:** Mở **Thi & chứng nhận → Phòng thi**.',
      '**Bước 2:** Chọn **Trắc nghiệm buổi học** để xem bài giáo viên đã giao.',
      '**Bước 3:** Chỉ bấm bắt đầu khi đã sẵn sàng; đọc thời lượng và quy định trước khi làm.',
      '**Bước 4:** Với bài thi chứng nhận môn học, làm bài theo hướng dẫn và nộp trước khi hết giờ.',
      '*Nếu ghi “Hiện chưa có bài trắc nghiệm mới nào”, giáo viên chưa giao bài hoặc bài chưa được mở cho tài khoản.*',
      '⟦go:/student/exam|Mở Phòng thi⟧',
    ]).join('\n');
  }
  if (student && /(ôn thi|luyện chứng nhận|khóa ôn thi|mos\s*\/\s*ic3|cert prep|lms.*(mos|ic3))/i.test(t)) {
    return (isEn ? [
      'Guide to **MOS / IC3 Cert Prep**:',
      '**Step 1:** Open **Exams & Certificates → MOS / IC3**.',
      '**Step 2:** Select your unlocked course/level to view practice tests and progress.',
      '**Step 3:** Complete practice exercises and review your attempt history when available.',
      '*If it says "No cert prep courses assigned to this account", please ask Admin to enable your MOS/IC3 course.*',
      '⟦go:/student/cert-prep|Open MOS / IC3 Prep⟧',
    ] : [
      'Hướng dẫn **Ôn thi MOS/IC3**:',
      '**Bước 1:** Mở **Thi & chứng nhận → MOS / IC3**.',
      '**Bước 2:** Chọn khóa/cấp độ được cấp để xem bài luyện và tiến độ.',
      '**Bước 3:** Làm bài luyện, xem kết quả hoặc lịch sử lần làm nếu khóa có hỗ trợ.',
      '*Nếu ghi “Chưa có khóa ôn thi cho tài khoản này”, Admin chưa liên kết khóa MOS/IC3 hoặc chưa cấp quyền thủ công; hãy liên hệ trung tâm để được kiểm tra.*',
      '⟦go:/student/cert-prep|Mở Ôn thi MOS/IC3⟧',
    ]).join('\n');
  }
  if (student && /(bảng tin|hỏi bài|đăng bài|chia sẻ bài|thêm ảnh bảng tin|student feed|post question)/i.test(t)) {
    return (isEn ? [
      'Guide to **Feed & Q&A**:',
      '**Step 1:** Open **Feed**.',
      '**Step 2:** Enter your question or content you want to share.',
      '**Step 3:** Choose **Public** or an allowed visibility setting and attach screenshots if helpful.',
      '**Step 4:** Tap **Post** and follow replies from teachers and staff.',
      '⟦go:/student/feed|Open Feed⟧',
    ] : [
      'Hướng dẫn **Bảng tin trao đổi & Hỏi bài**:',
      '**Bước 1:** Mở **Bảng tin**.',
      '**Bước 2:** Nhập câu hỏi hoặc nội dung muốn chia sẻ.',
      '**Bước 3:** Chọn phạm vi **Công khai** hoặc phạm vi được phép, có thể thêm ảnh.',
      '**Bước 4:** Bấm **Đăng bài**, sau đó theo dõi phản hồi của giáo viên/trung tâm.',
      '⟦go:/student/feed|Mở Bảng tin⟧',
    ]).join('\n');
  }
  if (student && /(tin tức|tìm bài viết|lọc tin|chủ đề tin tức|thời gian tin tức)/i.test(t)) {
    return (isEn ? [
      'Guide to **News**:',
      '**Step 1:** Open **News & Feedback → News**.',
      '**Step 2:** Search by article title and switch between grid or list view.',
      '**Step 3:** Filter by **Topic**, **Latest**, or **Timeframe**.',
      '**Step 4:** Tap a card to read the full article.',
      '⟦go:/student/news|Open News⟧',
    ] : [
      'Hướng dẫn **Tin tức**:',
      '**Bước 1:** Mở **Tin tức & góp ý → Tin tức**.',
      '**Bước 2:** Tìm theo tên bài viết, chọn chế độ lưới/danh sách.',
      '**Bước 3:** Lọc theo **Chủ đề**, **Tin mới nhất** hoặc **Thời gian**.',
      '**Bước 4:** Bấm thẻ tin để đọc nội dung đầy đủ.',
      '⟦go:/student/news|Mở Tin tức⟧',
    ]).join('\n');
  }
  if (student && /(đánh giá giáo viên|đánh giá gv|phản hồi trung tâm|gửi phản hồi|rate teacher|teacher evaluation|center feedback)/i.test(t)) {
    return (isEn ? [
      'Guide to **Rate Teacher & Center Feedback**:',
      '**Step 1:** Open **News & Feedback → Rate Teacher**.',
      '**Step 2:** Switch between **Rate Teacher** and **Center Feedback** tabs.',
      '**Step 3:** Pick the eligible course/teacher, type your feedback, and submit.',
      '*The **Submit Feedback** button appears only for eligible courses or completed sessions.*',
      '⟦go:/student#evaluation|Open Rate Teacher⟧',
    ] : [
      'Hướng dẫn **Đánh giá GV và Phản hồi trung tâm**:',
      '**Bước 1:** Mở **Tin tức & góp ý → Đánh giá GV**.',
      '**Bước 2:** Chọn tab **Đánh giá GV** để đánh giá giảng viên hoặc **Phản hồi trung tâm** để gửi góp ý khóa học.',
      '**Bước 3:** Chọn đúng khóa học/giảng viên, nhập nhận xét và gửi biểu mẫu.',
      '*Chỉ những khóa học/buổi đủ điều kiện mới xuất hiện nút **Gửi phản hồi**.*',
      '⟦go:/student#evaluation|Mở Đánh giá GV⟧',
    ]).join('\n');
  }
  if (student && /(trung tâm|chi nhánh|nhân sự|mạng xã hội|dịch vụ đào tạo|địa điểm thi|chứng nhận|center info|branch info)/i.test(t)) {
    return (isEn ? [
      'Guide to **Center Info**:',
      '**Step 1:** Open **Center** from the menu.',
      '**Step 2:** Choose **Overview**, **Staff**, **Branches**, **Social**, **Training Services**, **Exam Venues**, or **Certifications**.',
      '**Step 3:** Browse published information in each tab.',
      '*If it says "Content is being updated", that tab has not been published yet — not an error on your side.*',
      '⟦go:/student/center-info|Open Center Info⟧',
    ] : [
      'Hướng dẫn **Thông tin trung tâm**:',
      '**Bước 1:** Mở menu **Trung tâm**.',
      '**Bước 2:** Chọn **Tổng quan**, **Nhân sự**, **Chi nhánh**, **Mạng xã hội**, **Dịch vụ đào tạo**, **Địa điểm thi** hoặc **chứng nhận**.',
      '**Bước 3:** Xem nội dung được trung tâm công bố ở từng tab.',
      '*Nếu hiển thị “Nội dung đang được cập nhật”, dữ liệu tab đó chưa được trung tâm phát hành hoặc đang được cập nhật; không phải lỗi thao tác của bạn.*',
      '⟦go:/student/center-info|Mở Trung tâm⟧',
    ]).join('\n');
  }
  if (student && /(hồ sơ|thông tin cá nhân|đổi mật khẩu|cập nhật số điện thoại|email|địa chỉ|change password|update profile)/i.test(t)) {
    return (isEn ? [
      'Guide to **Profile**:',
      '**Step 1:** Open **Profile** near the bottom of the menu.',
      '**Step 2:** Check progress, average score, remaining lessons, and enrolled courses.',
      '**Step 3:** Tap **Update** under personal info to edit email, phone, or address if permitted.',
      '**Step 4:** Tap **Change Password** to update your login password.',
      '*Missing fields appear as "Not updated"; fill and save, or contact Admin if a field is locked.*',
      '⟦go:/student#profile|Open Profile⟧',
    ] : [
      'Hướng dẫn **Hồ sơ**:',
      '**Bước 1:** Mở **Hồ sơ** ở cuối menu.',
      '**Bước 2:** Xem tiến độ, điểm trung bình, số buổi còn lại và khóa học.',
      '**Bước 3:** Chọn **Cập nhật** trong phần thông tin cá nhân để bổ sung email, số điện thoại hoặc địa chỉ nếu được phép.',
      '**Bước 4:** Chọn **Đổi mật khẩu** để thay đổi mật khẩu đăng nhập.',
      '*Thông tin chưa cập nhật sẽ hiển thị “Chưa cập nhật”; hãy nhập và lưu lại, hoặc liên hệ Admin nếu trường bị khóa.*',
      '⟦go:/student#profile|Mở Hồ sơ⟧',
    ]).join('\n');
  }
  if (student && /(điểm danh|xác nhận điểm danh|vắng|điểm danh bù|check attendance|confirm attendance)/i.test(t)) {
    return (isEn ? [
      'Guide to **student attendance**:',
      '**Step 1:** Open **Schedule** and select the session.',
      '**Step 2:** Confirm attendance when the prompt appears.',
      '**Step 3:** If anything is inaccurate or you missed a class, submit a makeup attendance request with your reason.',
      '⟦go:/student#schedule|Open Schedule⟧',
    ] : [
      'Hướng dẫn **điểm danh học viên**:',
      '**Bước 1:** Mở **Lịch học** và chọn buổi học.',
      '**Bước 2:** Xác nhận trạng thái điểm danh khi popup xuất hiện.',
      '**Bước 3:** Nếu có sai lệch hoặc vắng, gửi yêu cầu điểm danh bù và ghi rõ lý do.',
      '⟦go:/student#schedule|Mở Lịch học⟧',
    ]).join('\n');
  }
  if (student && /(video|tài liệu|phần mềm học)/i.test(t)) {
    return (isEn ? [
      'Guide to **Materials & Videos**:',
      '**Step 1:** Open **Materials**.',
      '**Step 2:** Pick **Video Lessons**, **Materials**, or **Software**.',
      '**Step 3:** Open content by course and continue your current lesson.',
      '⟦go:/student#materials-videos|Open Video Lessons⟧',
    ] : [
      'Hướng dẫn **Tài liệu và Video**:',
      '**Bước 1:** Mở **Tài liệu**.',
      '**Bước 2:** Chọn tab **Video học**, **Tài liệu** hoặc **Phần mềm**.',
      '**Bước 3:** Mở nội dung theo khóa học và tiếp tục bài đang học.',
      '⟦go:/student#materials-videos|Mở Video học⟧',
    ]).join('\n');
  }
  if (student && /(bài tập|bài được giao|xem điểm|kết quả học tập|điểm thi)/i.test(t)) {
    return (isEn ? [
      'Guide to **Assignments & Scores**:',
      '**Step 1:** Open **Learning → Assignments**.',
      '**Step 2:** Select an assigned task to read instructions and due date.',
      '**Step 3:** Submit your work as requested; scores and grades appear under **Exam Scores / Results**.',
      '⟦go:/student#materials-assignments|Open Assignments⟧ · ⟦go:/student#exam-scores|Open Exam Scores⟧',
    ] : [
      'Hướng dẫn **bài tập và điểm**:',
      '**Bước 1:** Mở **Tài liệu/Bài tập**.',
      '**Bước 2:** Chọn bài được giao để xem nội dung và hạn nộp.',
      '**Bước 3:** Nộp bài theo yêu cầu; kết quả và điểm xem tại khu vực **Điểm thi/Kết quả**.',
      '⟦go:/student#materials-assignments|Mở Bài tập⟧ · ⟦go:/student#exam-scores|Mở Điểm thi⟧',
    ]).join('\n');
  }
  if (student && /(phòng thi|vào thi|luyện thi|chứng nhận|lms.*exam)/i.test(t)) {
    return (isEn ? [
      'Guide to **Exam Room & Cert Prep**:',
      '**Step 1:** Choose **Exam Room** to enter unlocked exams.',
      '**Step 2:** Choose **MOS / IC3** to practice by level and review past scores.',
      '**Step 3:** Read exam rules carefully before starting and submit before time expires.',
      '⟦go:/student/exam|Open Exam Room⟧ · ⟦go:/student/cert-prep|Open MOS / IC3⟧',
    ] : [
      'Hướng dẫn **phòng thi và luyện chứng nhận**:',
      '**Bước 1:** Chọn **Phòng thi** để vào bài thi được cấp quyền.',
      '**Bước 2:** Chọn **MOS/IC3** để luyện theo cấp độ và xem lịch sử kết quả.',
      '**Bước 3:** Đọc kỹ quy định trước khi bắt đầu và nộp bài đúng thời gian.',
      '⟦go:/student/exam|Mở Phòng thi⟧ · ⟦go:/student/cert-prep|Mở MOS/IC3⟧',
    ]).join('\n');
  }
  if (/(hộp thư|nhắn tin|tin nhắn|liên hệ giáo viên|liên hệ hỗ trợ|how to use inbox|contact teacher|live support)/i.test(t)) {
    return (isEn ? [
      'Guide to **Inbox**:',
      '**Step 1:** Open **Inbox**.',
      '**Step 2:** Choose the person you want to message or open **AI Assistant**.',
      '**Step 3:** Type your message and send; tap **Need Support Agent** if you want live human assistance.',
      `⟦go:/${student ? 'student' : 'teacher'}/inbox|Open Inbox⟧`,
    ] : [
      'Hướng dẫn **Hộp thư**:',
      '**Bước 1:** Mở **Hộp thư**.',
      '**Bước 2:** Chọn người cần trao đổi hoặc mở **Trợ lý AI**.',
      '**Bước 3:** Nhập nội dung và bấm gửi; cần người thật thì chọn **Chuyển sang hỗ trợ trực tiếp**.',
      `⟦go:/${student ? 'student' : 'teacher'}/inbox|Mở Hộp thư⟧`,
    ]).join('\n');
  }
  return null;
}

function buildWelcomeMessage(userRole, userName, lang = 'vi') {
  const name = String(userName || '').trim();
  const isTeacher = isTeacherRole(userRole);
  if (lang === 'en') {
    if (isTeacher) {
      const who = name ? `Teacher ${name}` : 'there';
      return `Hello ${who}! I am the Office IT AI Assistant at Thang Tin Hoc. I support Word, Excel, PowerPoint, MOS, LMS, and teaching. How can I assist you today?`;
    }
    const who = name || 'there';
    return `Hello ${who}! I am the Office IT AI Assistant at Thang Tin Hoc. I support Word, Excel, PowerPoint, MOS, LMS, and learning. Feel free to ask me any IT question!`;
  }
  if (isTeacher) {
    const who = name ? `Thầy/Cô ${name}` : 'Thầy/Cô';
    return `Xin chào ${who}! Em là Trợ lý AI Tin Học của Thắng Tin Học. Em hỗ trợ Word, Excel, PowerPoint, MOS, LMS và giảng dạy. Thầy/Cô hỏi gì ạ?`;
  }
  const who = name || 'bạn';
  return `Xin chào ${who}! Mình là Trợ lý AI Tin Học của Thắng Tin Học. Mình hỗ trợ Word, Excel, PowerPoint, MOS, LMS và học tập. Bạn hỏi gì về tin học cũng được nhé!`;
}

function buildSupportSystemPrompt(userRole, userName, { ongoing = false, lang = 'vi' } = {}) {
  const isTeacher = isTeacherRole(userRole);
  if (lang === 'en') {
    const roleLabel = isTeacher ? 'Teacher' : 'Student';
    const name = String(userName || '').trim() || roleLabel;
    const greetingRule = ongoing
      ? 'ONGOING SESSION: You already greeted earlier. Do NOT greet again, do NOT write "Hello/Hi [name]" — go straight to the answer.'
      : 'Greet at most once at the start of a session; never repeat greetings in follow-up messages.';
    return [
      'You are an Office IT instructor at Thang Tin Hoc Center. Reply 100% in clear, natural English matching the user\'s question (do NOT switch to Vietnamese unless explicitly asked).',
      `Logged-in user: ${roleLabel} named "${name}". Never ask their role or whether they are a student/teacher.`,
      greetingRule,
      'Scope: Microsoft Word, Excel, PowerPoint, MOS, computer basics, basic printing/networking, Thang Tin Hoc LMS (login, schedules, attendance, materials, exams, assignments), and general tuition guidance.',
      `Out of scope (law, medical, cooking, politics, unrelated topics): reply with this exact sentence and stop: "${OUT_OF_SCOPE_REPLY_EN}"`,
      'Never promise refunds, change scores, or reveal passwords.',
      `Never generate, draw, or create images or suggest AI image generators. Only inspect screenshots the user uploads (e.g., Office screens). If asked to generate images, reply with this exact sentence and stop: "${IMAGE_GEN_REFUSE_EN}"`,
      `Never ghostwrite essays, theses, reports, or administrative documents. If asked to write one for the user, reply with this exact sentence and stop: "${GHOSTWRITE_REFUSE_EN}"`,
      'Help learners directly with actionable formulas (ready-to-use Excel syntax with commas or semicolons noted), step-by-step Word/PowerPoint/LMS instructions, and screenshot troubleshooting.',
      'Never mention or tell the user to click human-agent buttons ("Need Support Agent", "Meet staff") and never print "History:" or "New question:".',
      'RESPONSE STYLE: Complete, teachable, and well-structured. Never cut off mid-list. For broad questions ("which formulas should I learn"), list the common ones concisely with 1–2 lines each (name + syntax or Ribbon location Tab > Group > Command + short example).',
      'LIST FORMATTING: Sequential procedures (how-to steps) -> use **Step 1:** **Step 2:** ... (do NOT use 1. 2. 3.). Lists of multiple functions/methods/items -> use 1. 2. 3. (do NOT write "Step").',
      'Do NOT use markdown headings (##). Use **bold** for step labels/menus/buttons, *italic* for notes/warnings, and `SUMIF` in backticks for function names. For Excel sample tables, always use markdown tables `| col | col |` with a separator row `| --- | --- |`.',
      'FOUNDATIONAL KNOWLEDGE - Excel: COUNT, COUNTA, COUNTBLANK, COUNTIF, COUNTIFS, SUM, SUMIF, SUMIFS, AVERAGE, AVERAGEIF, AVERAGEIFS, MAX, MIN, MEDIAN, MODE, LARGE, SMALL, RANK, STDEV.S; IF, IFS, AND, OR, IFERROR; VLOOKUP, XLOOKUP, INDEX, MATCH; relative A1 vs absolute $A$1 references; Excel Tables (Ctrl+T); PivotTables; Charts; Filter/Sort; Data Validation; Conditional Formatting; Text to Columns.',
      'FOUNDATIONAL KNOWLEDGE - Word: Styles (Heading 1/2/3), Table of Contents, page/section breaks, Header/Footer, page numbers, margins/paper size, Mail Merge, tables, image text wrapping, Find/Replace, Track Changes.',
      'FOUNDATIONAL KNOWLEDGE - PowerPoint: layouts, themes, Slide Master, transitions, animations, SmartArt, charts, Presenter View, Notes, PDF export.',
      'FOUNDATIONAL KNOWLEDGE - MOS: exact task execution for Word/Excel/PowerPoint Associate. Computer basics: File Explorer, copy/cut, USB, printing, basic WiFi.',
      'When images are attached: examine them carefully. For Office screens, exercises, or errors, briefly describe what appears and give step-by-step help without inventing unseen details.',
      'NEVER TRUNCATE YOUR ANSWER. Deliver every step completely from start to finish.',
      'REQUIRED: At the very end of every reply, suggest 2–3 short follow-up questions (each under 10 words) in English, wrapped in this exact syntax on the last line (keep the bracket tag exact): [GỢI Ý: Follow-up 1 | Follow-up 2 | Follow-up 3]',
    ].join('\n');
  }
  const roleLabel = isTeacher ? 'Giảng viên' : 'Học viên';
  const name = String(userName || '').trim() || (isTeacher ? 'Thầy/Cô' : 'Học viên');
  const address = isTeacher ? 'Thầy/Cô' : 'bạn';
  const greetingRule = ongoing
    ? 'ĐANG TRONG PHIÊN CHAT: đã chào ở tin đầu phiên. KHÔNG chào lại, KHÔNG viết "Xin chào/Chào [tên]", vào thẳng nội dung trả lời.'
    : 'Chỉ chào một lần duy nhất ở tin đầu phiên; các tin sau không chào lại.';
  return [
    `Bạn là giáo viên tin học văn phòng của Trung tâm Thắng Tin Học. Nếu người dùng hỏi bằng tiếng Việt thì trả lời hoàn toàn bằng tiếng Việt (xưng hô: ${address}); nếu người dùng hỏi bằng tiếng Anh thì trả lời 100% bằng tiếng Anh rõ ràng, tự nhiên.`,
    `Người đang chat ĐÃ ĐĂNG NHẬP: ${roleLabel} tên "${name}". Không hỏi vai trò, không hỏi chọn học viên/giảng viên.`,
    greetingRule,
    'Phạm vi: Word, Excel, PowerPoint, MOS, máy tính cơ bản, in ấn/mạng cơ bản, LMS Thắng Tin Học (đăng nhập, lịch, điểm danh, tài liệu, thi, bài tập), học phí hướng dẫn chung.',
    `Ngoài phạm vi (luật, y tế, nấu ăn, chính trị, chuyện không liên quan tin học/LMS): trả đúng câu "${OUT_OF_SCOPE_REPLY}" rồi dừng.`,
    'Không hứa hoàn tiền, không đổi điểm, không tiết lộ mật khẩu.',
    'Không tạo, không vẽ, không sinh hình ảnh; không nhắc công cụ AI tạo ảnh. Chỉ xem ảnh người dùng gửi (màn hình Office). Nếu họ yêu cầu tạo ảnh: trả đúng câu "' + IMAGE_GEN_REFUSE + '" rồi dừng.',
    'Không viết hộ tiểu luận, báo cáo, công văn, văn bản hành chính. Nếu họ yêu cầu viết hộ những loại đó: trả đúng câu "' + GHOSTWRITE_REFUSE + '" rồi dừng.',
    'Học viên mới: làm hộ thao tác tin học được - công thức Excel điền sẵn, từng bước Word/PowerPoint/LMS, sửa lỗi trên ảnh màn hình.',
    'Không nhắc, không mô tả, không bảo bấm nút (Gặp nhân viên, Cần nhân viên, biểu tượng hỗ trợ). Không in chữ "Lịch sử" hay "Câu hỏi mới".',
    'CÁCH TRẢ LỜI: đầy đủ, dạy được luôn. Không sơ sài, không cắt giữa danh sách. Câu hỏi dạng "học những gì / hàm nào / thao tác nào" thì liệt kê HẾT nhóm phổ biến, mỗi mục 1–2 dòng.',
    'Mỗi mục: tên + cú pháp hoặc vị trí Ribbon (thẻ > nhóm > lệnh) + ví dụ ngắn. Kết thúc trọn ý, có thể thêm 1 mẹo cuối.',
    'PHÂN BIỆT DANH SÁCH: Hướng dẫn THAO TÁC (một luồng làm tuần tự: cách dùng hàm, cách xếp lịch, cách vào menu) → **Bước 1:** **Bước 2:** … Không viết 1. 2. 3. Liệt kê MỤC / PHƯƠNG ÁN / LỘ TRÌNH / GIẢI THÍCH (nhiều hàm, nhiều cách, lộ trình học) → dùng 1. 2. 3. Không viết "Bước". Ví dụ how-to: "**Bước 1:** Vào tab Data...". Ví dụ liệt kê: "1. COUNT - đếm số. 2. COUNTA - đếm ô không trống."',
    'Không dùng markdown heading (##). Đậm/nghiêng/hàm: **đậm** cho bước và từ khóa (menu, nút, kết quả), *nghiêng* cho ghi chú/cảnh báo, `SUMIF` cho tên hàm. Bảng dữ liệu Excel: markdown table | cột | cột |, có dòng | --- | --- |. Không viết "Dòng 1: A | B".',
    'KIẾN THỨC NỀN - Excel: COUNT, COUNTA, COUNTBLANK, COUNTIF, COUNTIFS, SUM, SUMIF, SUMIFS, AVERAGE, AVERAGEIF, AVERAGEIFS, MAX, MIN, MEDIAN, MODE, LARGE, SMALL, RANK, STDEV.S; IF, IFS, AND, OR, IFERROR; VLOOKUP, XLOOKUP, INDEX, MATCH; tham chiếu A1 vs $A$1; bảng Excel (Ctrl+T); PivotTable; biểu đồ; lọc/sắp xếp; Data Validation; Conditional Formatting; Text to Columns.',
    'KIẾN THỨC NỀN - Word: Styles (Heading 1/2/3), mục lục, ngắt trang/section, Header/Footer, số trang, lề/khổ giấy, mail merge, bảng, bọc chữ ảnh, Find/Replace, Track Changes.',
    'KIẾN THỨC NỀN - PowerPoint: layout, theme, Slide Master, transition, animation, SmartArt, biểu đồ, Presenter View, Notes, xuất PDF.',
    'KIẾN THỨC NỀN - MOS: làm đúng thao tác đề (Word/Excel/PowerPoint Associate). Máy tính: File Explorer, copy/cut, USB, in, WiFi cơ bản.',
    'Khi người dùng gửi ảnh: xem ảnh rồi trả lời. Nếu là màn hình Word/Excel/PowerPoint, đề bài, hoặc lỗi - mô tả ngắn những gì thấy và hướng dẫn từng bước. Không bịa chi tiết không có trong ảnh.',
    'KHÔNG ĐƯỢC CẮT NGANG CÂU TRẢ LỜI. Trả lời chi tiết, trọn vẹn TẤT CẢ các bước từ đầu đến cuối.',
    'BẮT BUỘC: Cuối mỗi câu trả lời, hãy đề xuất 2-3 câu hỏi ngắn (mỗi câu dưới 10 chữ) để người dùng có thể hỏi tiếp. Bọc các gợi ý đó trong cú pháp này ở dòng cuối cùng: [GỢI Ý: Gợi ý 1 | Gợi ý 2 | Gợi ý 3]',
  ].join('\n');
}

/** Chat messages cho Gemini - tách system / user / assistant, không nhét prompt admin. */
function buildSupportMessages(history, userRole, userName, currentPrompt = '', lang = 'vi') {
  const isEn = lang === 'en';
  const ongoing = isOngoingConversation(history);
  const messages = [{ role: 'system', content: buildSupportSystemPrompt(userRole, userName, { ongoing, lang }) }];
  const rows = (history || [])
    .filter((m) => {
      const t = String(m.messageType || 'text');
      const content = String(m.content || '').trim();
      if (!((t === 'text' || t === 'image') && content)) return false;
      if (isEscalationMessage(m) || isIdlePingMessage(m) || isIdleEndMessage(m) || isIdleStillHereMessage(m)) return false;
      // Exclude Vietnamese welcome message when answering in English so Gemini does not mimic Vietnamese phrasing.
      if (isEn && String(m.senderId) === AI_PEER_ID && isWelcomeMessage(m) && !/Office IT AI Assistant/i.test(content)) {
        return false;
      }
      return true;
    })
    .slice(-12);

  for (const m of rows) {
    let text = String(m.content).trim().slice(0, 1500);
    // Nếu tin nhắn là ảnh và caption chỉ là placeholder - thay bằng mô tả rõ hơn
    if (m.messageType === 'image') {
      if (!text || text === '[Hình ảnh]' || text === '[Image]') {
        text = isEn
          ? 'The user sent an image (exercise, screenshot, or document).'
          : 'Người dùng gửi một hình ảnh (đề bài, màn hình hoặc tài liệu).';
      } else {
        // Có caption thực sự - giữ nguyên và thêm chú thích đây là tin kèm ảnh
        text = isEn
          ? `[User sent an image with note] ${text}`
          : `[Người dùng gửi ảnh kèm nội dung] ${text}`;
      }
    }
    if (!text) continue;
    if (isBotLeakText(text)) continue;
    const isBot = String(m.senderId) === AI_PEER_ID;
    messages.push({ role: isBot ? 'assistant' : 'user', content: text });
  }

  const prompt = String(currentPrompt || '').trim();
  if (prompt) {
    const lastItem = messages[messages.length - 1];
    if (!lastItem || lastItem.role !== 'user' || lastItem.content !== prompt) {
      messages.push({ role: 'user', content: prompt });
    }
  }

  // Gemini cần tin user cuối - nếu kết thúc bằng bot thì drop bot thừa hoặc thêm prompt
  if (messages.length > 1 && messages[messages.length - 1].role !== 'user') {
    if (prompt) {
      messages.push({ role: 'user', content: prompt });
    } else {
      while (messages.length > 1 && messages[messages.length - 1].role !== 'user') {
        messages.pop();
      }
    }
  }

  // Gemini cần tin user cuối - nếu history rỗng vẫn có placeholder
  if (!messages.some((x) => x.role === 'user')) {
    messages.push({ role: 'user', content: prompt || (isEn ? 'Hello' : 'Xin chào') });
  }
  return messages;
}

function isBotLeakText(t) {
  return [
    /Lịch sử:/i,
    /Câu hỏi mới:/i,
    /Bạn là trợ lý hỗ trợ LMS/i,
    /Kinh gui quy phu huynh/i,
    /Kính gửi quý phụ huynh/i,
    /Phong Dao tao/i,
    /Phòng Đào tạo - Thang Tin Hoc/i,
    /Noi dung goi y cho:/i,
  ].some((re) => re.test(t));
}

/** Loại bỏ output lỗi (echo prompt / mẫu thông báo local fallback cũ). */
function sanitizeSupportReply(raw, { stripGreeting = false } = {}) {
  let t = String(raw || '').trim();
  if (!t) return '';
  if (isBotLeakText(t)) return '';
  if (stripGreeting) t = stripLeadingGreeting(t);
  if (t.length > 15000) return t.slice(0, 15000).trim();
  return t;
}

async function callSupportLlm(messages, { images } = {}) {
  const models = uniqueModels();
  let lastErr = null;
  for (const model of models) {
    try {
      return await chatCompletion({
        messages,
        model,
        temperature: 0.35,
        maxTokens: 8000,
        images: images || [],
      });
    } catch (err) {
      lastErr = err;
      logger.warn({ model, err: err?.message }, '[AI Support] model try failed');
    }
  }
  throw lastErr || new Error('AI support unavailable');
}

async function persistBotReply({
  conversationId,
  humanUserId,
  humanRole,
  humanName,
  content,
  io,
  notifyUser,
  messageType = 'text',
}) {
  const type = messageType === 'system' ? 'system' : 'text';
  const message = await Message.create({
    conversationId: String(conversationId),
    senderId: AI_PEER_ID,
    senderName: AI_PEER_NAME,
    senderRole: 'system',
    senderBranchCode: '',
    receiverId: String(humanUserId),
    receiverName: humanName || 'Bạn',
    receiverRole: humanRole,
    receiverBranchCode: '',
    content: String(content || '').trim().slice(0, 16000),
    messageType: type,
  });

  const [clientMessage] = await enrichMessageIdentities([message]);
  const payload = sanitizeMessageDoc(clientMessage?.toObject ? clientMessage.toObject() : clientMessage);

  if (typeof notifyUser === 'function') {
    notifyUser(getMessagingRole({ id: humanUserId, role: humanRole }), humanUserId, 'message:receive', payload);
  } else if (io) {
    io.to(String(humanUserId)).emit('message:receive', payload);
  }
  return payload;
}

async function replyToUserMessage({
  conversationId,
  sender,
  userText,
  imageFileUrl = '',
  io,
  notifyUser,
}) {
  if (!isAiSupportEnabled()) return null;

  const humanUserId = String(sender.id || sender._id || '');
  const humanRole = getMessagingRole(sender);
  const humanName = sender.name || 'Bạn';

  if (!isAiChatUser(sender)) return null;

  let sessionDoc = await ensureSession({
    conversationId,
    userId: humanUserId,
    userRole: humanRole,
    branchId: sender.branchId || '',
  });

  const hadIdlePing = Boolean(sessionDoc.idlePingAt);
  sessionDoc.lastUserMessageAt = new Date();
  sessionDoc.idlePingAt = null;
  await sessionDoc.save();

  let status = effectiveStatus(sessionDoc);

  if (status === AI_SUPPORT_STATUS.SUPPORT_RESOLVED || status === AI_SUPPORT_STATUS.CLOSED) {
    sessionDoc.status = AI_SUPPORT_STATUS.AI_ACTIVE;
    sessionDoc.escalated = false;
    sessionDoc.claimedBy = '';
    sessionDoc.claimedByName = '';
    sessionDoc.claimedAt = null;
    await sessionDoc.save();
    status = AI_SUPPORT_STATUS.AI_ACTIVE;
    emitStatus(io, sessionDoc, humanUserId);
  }

  if (aiPaused(status)) {
    const unclaimedWait = status === AI_SUPPORT_STATUS.WAITING_FOR_SUPPORT && !sessionDoc.claimedBy;
    const autoStuck = ['REPEATED_FAILURE', 'TECHNICAL_ISSUE', ''].includes(String(sessionDoc.handoffReason || ''));
    const userAskedHuman = detectHandoffReason(userText) === HANDOFF_REASONS.USER_REQUESTED;
    let resumeAi = unclaimedWait && autoStuck && !userAskedHuman;
    if (unclaimedWait && !userAskedHuman && !resumeAi) {
      const history = await loadThreadMessages(conversationId, 24);
      if (!hadMeaningfulAiReply(history)) resumeAi = true;
    }
    if (resumeAi) {
      sessionDoc.status = AI_SUPPORT_STATUS.AI_ACTIVE;
      sessionDoc.escalated = false;
      sessionDoc.handoffReason = '';
      sessionDoc.consecutiveAiFailures = 0;
      await sessionDoc.save();
      status = AI_SUPPORT_STATUS.AI_ACTIVE;
      emitStatus(io, sessionDoc, humanUserId);
    } else {
      fanoutUserMessageToSupport(io, {
        conversationId,
        session: sessionDoc,
        sender,
        userText,
      });
      return null;
    }
  }

  const categoryReason = detectHandoffReason(userText);
  if (categoryReason === HANDOFF_REASONS.USER_REQUESTED) {
    const result = await escalateToHuman({
      conversationId,
      user: sender,
      reason: categoryReason,
      io,
    });
    emitHandoffEvents(io, notifyUser, result, sender);
    return result.message;
  }

  const threadHistory = await loadThreadMessages(conversationId, 14);
  const lang = detectQueryLanguage(userText, threadHistory, sender?.lang);

  if (hadIdlePing && isIdleDecline(userText) && !imageFileUrl) {
    return endIdleSession({
      conversationId,
      sessionDoc,
      humanUserId,
      humanRole,
      humanName,
      io,
      notifyUser,
    });
  }

  if (hadIdlePing && (isIdleStay(userText) || isSimpleGreeting(userText)) && !imageFileUrl) {
    sessionDoc.consecutiveAiFailures = 0;
    await sessionDoc.save();
    return persistBotReply({
      conversationId,
      humanUserId,
      humanRole,
      humanName,
      content: lang === 'en' ? IDLE_STILL_HERE_EN : IDLE_STILL_HERE,
      io,
      notifyUser,
    });
  }

  if (isSimpleGreeting(userText) && !imageFileUrl) {
    sessionDoc.consecutiveAiFailures = 0;
    await sessionDoc.save();
    const recent = threadHistory.slice(-8);
    const lastBot = [...recent].reverse().find((m) => (
      String(m.senderId) === AI_PEER_ID
      && String(m.messageType || 'text') !== 'system'
    ));
    const lastBotMatchesLang = lastBot && isWelcomeMessage(lastBot) && (
      lang === 'en'
        ? /Office IT AI Assistant/i.test(String(lastBot.content || ''))
        : /Trợ lý AI Tin Học/i.test(String(lastBot.content || ''))
    );
    if (lastBotMatchesLang) return lastBot;
    return persistBotReply({
      conversationId,
      humanUserId,
      humanRole,
      humanName,
      content: buildWelcomeMessage(humanRole, humanName, lang),
      io,
      notifyUser,
    });
  }

  if (isImageGenRequest(userText)) {
    sessionDoc.consecutiveAiFailures = 0;
    await sessionDoc.save();
    return persistBotReply({
      conversationId,
      humanUserId,
      humanRole,
      humanName,
      content: lang === 'en' ? IMAGE_GEN_REFUSE_EN : IMAGE_GEN_REFUSE,
      io,
      notifyUser,
    });
  }

  if (isGhostwriteRequest(userText)) {
    sessionDoc.consecutiveAiFailures = 0;
    await sessionDoc.save();
    return persistBotReply({
      conversationId,
      humanUserId,
      humanRole,
      humanName,
      content: lang === 'en' ? GHOSTWRITE_REFUSE_EN : GHOSTWRITE_REFUSE,
      io,
      notifyUser,
    });
  }

  const faq = lmsFaqReply(humanRole, userText, lang)
    || teacherFaqReply(humanRole, userText, lang)
    || studentFaqReply(humanRole, userText, lang);
  if (faq && !imageFileUrl) {
    sessionDoc.consecutiveAiFailures = 0;
    await sessionDoc.save();
    return persistBotReply({
      conversationId,
      humanUserId,
      humanRole,
      humanName,
      content: faq,
      io,
      notifyUser,
    });
  }

  const q = await consumeAiQuestionQuota(sessionDoc);
  if (q.applies) emitStatus(io, sessionDoc, humanUserId);
  if (q.blocked) {
    return persistBotReply({
      conversationId,
      humanUserId,
      humanRole,
      humanName,
      content: questionLimitReply(q.limit, lang),
      io,
      notifyUser,
    });
  }

  if (!aiSupportConfigured()) {
    return persistBotReply({
      conversationId,
      humanUserId,
      humanRole,
      humanName,
      content: lang === 'en' ? BUSY_REPLY_EN : BUSY_REPLY,
      io,
      notifyUser,
    });
  }

  emitTyping(io, { conversationId, userId: humanUserId, show: true });
  await new Promise((r) => setTimeout(r, TYPING_MS));

  try {
    const messages = buildSupportMessages(threadHistory, humanRole, humanName, userText, lang);
    const ongoing = isOngoingConversation(threadHistory);
    const images = [];
    if (imageFileUrl) {
      const inline = loadInlineImage(imageFileUrl) || await fetchInlineImageFromUrl(imageFileUrl);
      if (inline) images.push(inline);
      // Chỉ thêm tin placeholder nếu không có user message nào trong lịch sử
      // (trường hợp ảnh đầu tiên, chưa có caption)
      const hasUserMessage = messages.some((x) => x.role === 'user');
      if (!hasUserMessage) {
        const hint = userText && userText !== '[Hình ảnh]' && userText !== '[Image]'
          ? (lang === 'en'
            ? `The user sent an image with this request: "${userText.slice(0, 200)}". Please examine the image and explain step by step in English.`
            : `Người dùng gửi ảnh kèm yêu cầu: "${userText.slice(0, 200)}". Hãy xem ảnh và giải thích chi tiết.`)
          : (lang === 'en'
            ? 'The user sent an image (exercise or screen). Please describe what appears and give step-by-step help in English.'
            : 'Người dùng gửi ảnh (đề bài hoặc màn hình). Hãy mô tả và hướng dẫn chi tiết từng bước.');
        messages.push({ role: 'user', content: hint });
      }
      if (!inline) {
        logger.warn({ imageFileUrl }, '[AI Support] Cannot load image inline, AI will respond without image');
      }
    }
    const result = await callSupportLlm(messages, { images });
    const text = sanitizeSupportReply(result?.content, { stripGreeting: ongoing })
      || (lang === 'en' ? EMPTY_REPLY_EN : EMPTY_REPLY);
    if (isHumanHandoffButtonHallucination(text)) {
      const handoff = await escalateToHuman({
        conversationId,
        user: sender,
        reason: HANDOFF_REASONS.USER_REQUESTED,
        io,
      });
      emitHandoffEvents(io, notifyUser, handoff, sender);
      return handoff.message;
    }
    sessionDoc.consecutiveAiFailures = 0;
    await sessionDoc.save();

    return await persistBotReply({
      conversationId,
      humanUserId,
      humanRole,
      humanName,
      content: text,
      io,
      notifyUser,
    });
  } catch (err) {
    logger.warn({ err: err?.message, conversationId }, '[AI Support] reply failed');
    if (q.applies && !q.blocked) {
      try {
        await refundAiQuestionQuota(sessionDoc);
        emitStatus(io, sessionDoc, humanUserId);
      } catch (refundErr) {
        logger.warn({ err: refundErr?.message }, '[AI Support] refund quota failed');
      }
    }
    sessionDoc.consecutiveAiFailures = Number(sessionDoc.consecutiveAiFailures || 0) + 1;
    await sessionDoc.save();
    return await persistBotReply({
      conversationId,
      humanUserId,
      humanRole,
      humanName,
      content: supportFailureReply(err, lang),
      io,
      notifyUser,
    });
  } finally {
    emitTyping(io, { conversationId, userId: humanUserId, show: false });
  }
}

function emitStatus(io, session, userId) {
  if (!io) return;
  const payload = sessionToClient(session);
  if (userId) io.to(String(userId)).emit('ai-support:status', payload);
  io.to('ALL_SUPPORT').emit('ai-support:status', payload);
}

async function resolveIdleUserName(session) {
  const last = await Message.findOne({ conversationId: String(session.conversationId) })
    .sort({ createdAt: -1 })
    .select('senderName receiverName senderId')
    .lean();
  if (!last) return 'Bạn';
  if (String(last.senderId) === AI_PEER_ID) return last.receiverName || 'Bạn';
  return last.senderName || last.receiverName || 'Bạn';
}

async function endIdleSession({
  conversationId,
  sessionDoc,
  humanUserId,
  humanRole,
  humanName,
  io,
  notifyUser,
}) {
  await persistBotReply({
    conversationId,
    humanUserId,
    humanRole,
    humanName,
    content: IDLE_END_TEXT,
    io,
    notifyUser,
    messageType: 'system',
  });
  const welcome = await persistBotReply({
    conversationId,
    humanUserId,
    humanRole,
    humanName,
    content: buildWelcomeMessage(humanRole, humanName),
    io,
    notifyUser,
  });
  if (sessionDoc) {
    sessionDoc.lastUserMessageAt = null;
    sessionDoc.idlePingAt = null;
    sessionDoc.consecutiveAiFailures = 0;
    sessionDoc.status = AI_SUPPORT_STATUS.AI_ACTIVE;
    sessionDoc.escalated = false;
    await sessionDoc.save();
  }
  return welcome;
}

async function sweepIdleSessions(io, notifyUser) {
  if (!isAiSupportEnabled()) return;
  const now = Date.now();
  const rows = await AiSupportSession.find({
    status: AI_SUPPORT_STATUS.AI_ACTIVE,
    lastUserMessageAt: { $ne: null },
  }).limit(200);

  for (const sessionDoc of rows) {
    if (aiPaused(effectiveStatus(sessionDoc))) continue;
    const humanUserId = String(sessionDoc.userId || '');
    const humanRole = String(sessionDoc.userRole || 'student');
    const humanName = await resolveIdleUserName(sessionDoc);
    const conversationId = String(sessionDoc.conversationId);
    const lastUser = new Date(sessionDoc.lastUserMessageAt).getTime();
    if (!Number.isFinite(lastUser)) continue;

    if (!sessionDoc.idlePingAt) {
      if (now - lastUser < IDLE_PING_MS) continue;
      await persistBotReply({
        conversationId,
        humanUserId,
        humanRole,
        humanName,
        content: IDLE_PING_TEXT,
        io,
        notifyUser,
      });
      sessionDoc.idlePingAt = new Date();
      await sessionDoc.save();
      continue;
    }

    const pingAt = new Date(sessionDoc.idlePingAt).getTime();
    if (!Number.isFinite(pingAt) || now - pingAt < IDLE_END_MS) continue;
    await endIdleSession({
      conversationId,
      sessionDoc,
      humanUserId,
      humanRole,
      humanName,
      io,
      notifyUser,
    });
  }
}

let idleTimer = null;

function startAiIdleWatcher(io, notifyUser) {
  if (idleTimer) return;
  if (process.env.NODE_ENV === 'test') return;
  if (!isAiSupportEnabled()) return;
  idleTimer = setInterval(() => {
    sweepIdleSessions(io, notifyUser).catch((err) => {
      logger.warn({ err: err?.message }, '[AI Support] idle sweep');
    });
  }, IDLE_SWEEP_MS);
  if (typeof idleTimer.unref === 'function') idleTimer.unref();
}

function stopAiIdleWatcher() {
  if (idleTimer) clearInterval(idleTimer);
  idleTimer = null;
}

async function clearAiHistory({ conversationId, user, io, notifyUser }) {
  const cid = String(conversationId || '');
  const humanUserId = String(user.id || user._id || '');
  const humanRole = getMessagingRole(user);
  const humanName = user.name || 'Bạn';
  await Message.deleteMany({ conversationId: cid });
  const sessionDoc = await ensureSession({
    conversationId: cid,
    userId: humanUserId,
    userRole: humanRole,
    branchId: user.branchId || '',
  });
  sessionDoc.lastUserMessageAt = null;
  sessionDoc.idlePingAt = null;
  sessionDoc.consecutiveAiFailures = 0;
  sessionDoc.status = AI_SUPPORT_STATUS.AI_ACTIVE;
  sessionDoc.escalated = false;
  sessionDoc.claimedBy = '';
  sessionDoc.claimedByName = '';
  sessionDoc.claimedAt = null;
  sessionDoc.handoffReason = '';
  sessionDoc.handoffSummary = '';
  await sessionDoc.save();
  const welcome = await persistBotReply({
    conversationId: cid,
    humanUserId,
    humanRole,
    humanName,
    content: buildWelcomeMessage(humanRole, humanName),
    io,
    notifyUser,
  });
  emitStatus(io, sessionDoc, humanUserId);
  return { session: sessionDoc, welcome };
}

function emitHandoffEvents(io, notifyUser, result, user) {
  if (!io || !result?.message || result.alreadyEscalated) return;
  const humanUserId = String(user.id || user._id || '');
  const humanRole = getMessagingRole(user);
  io.to(humanUserId).emit('message:receive', result.message);
  if (typeof notifyUser === 'function') {
    notifyUser(humanRole, humanUserId, 'message:sent', result.message);
  }
  io.to('ALL_SUPPORT').emit('ai-support:escalate', {
    conversationId: result.session?.conversationId,
    userId: humanUserId,
    userName: user.name || '',
    userRole: humanRole,
    branchId: user.branchId || null,
    reason: result.session?.handoffReason || HANDOFF_REASONS.USER_REQUESTED,
    summary: result.session?.handoffSummary || '',
    status: effectiveStatus(result.session),
  });
  emitStatus(io, result.session, humanUserId);
}

function fanoutUserMessageToSupport(io, { conversationId, session, sender, userText }) {
  if (!io) return;
  const payload = {
    conversationId: String(conversationId),
    userId: String(sender.id || sender._id || ''),
    userName: sender.name || '',
    userRole: getMessagingRole(sender),
    content: String(userText || '').slice(0, 2000),
    status: effectiveStatus(session),
  };
  const claimedBy = String(session?.claimedBy || '');
  if (claimedBy) io.to(claimedBy).emit('ai-support:user-message', payload);
  else io.to('ALL_SUPPORT').emit('ai-support:user-message', payload);
}

function scheduleAiSupportReply(args) {
  setImmediate(() => {
    replyToUserMessage(args).catch((err) => {
      logger.warn({ err: err?.message }, '[AI Support] schedule failed');
    });
  });
}

async function sendWelcomeIfEmpty({ conversationId, sender, io, notifyUser }) {
  const count = await Message.countDocuments({ conversationId: String(conversationId) });
  if (count > 0) return null;
  const humanUserId = String(sender.id || sender._id || '');
  const humanRole = getMessagingRole(sender);
  return persistBotReply({
    conversationId,
    humanUserId,
    humanRole,
    humanName: sender.name || 'Bạn',
    content: buildWelcomeMessage(humanRole, sender.name),
    io,
    notifyUser,
  });
}

const ESCALATE_TEXT = 'Đã chuyển yêu cầu tới nhân viên hỗ trợ. Bạn có thể tiếp tục nhắn trong cuộc trò chuyện này - nhân viên sẽ nhận toàn bộ nội dung đã trao đổi.';

function currentSessionMessages(history) {
  const rows = (history || []).filter((m) => !isEscalationMessage(m));
  let start = 0;
  for (let i = 0; i < rows.length; i += 1) {
    if (isWelcomeMessage(rows[i])) start = i;
  }
  return rows.slice(start).filter((m) => {
    if (isWelcomeMessage(m)) return false;
    if (isIdlePingMessage(m) || isIdleEndMessage(m) || isIdleStillHereMessage(m)) return false;
    if (String(m.messageType || 'text') === 'system') return false;
    return Boolean(String(m.content || '').trim());
  });
}

function buildLocalHandoffSummary({ history, user, reason }) {
  const role = getMessagingRole(user) === 'teacher' ? 'Teacher' : 'Student';
  const sessionMsgs = currentSessionMessages(history);
  const lines = sessionMsgs.slice(-20).map((m) => {
    const who = String(m.senderId) === AI_PEER_ID ? 'AI' : 'User';
    return `${who}: ${String(m.content || '').slice(0, 180)}`;
  });
  return [
    `AI SUMMARY`,
    `Người dùng: ${role} (${user.name || user.id || ''})`,
    `Lý do chuyển: ${reason || HANDOFF_REASONS.USER_REQUESTED}`,
    '',
    'Hội thoại gần nhất:',
    lines.join('\n') || '(chưa có tin)',
    '',
    'Cần Support xem lại lịch sử trên và tiếp tục hỗ trợ, không hỏi lại từ đầu.',
  ].join('\n').slice(0, 1800);
}

async function escalateToHuman({ conversationId, user, reason, io }) {
  const cid = String(conversationId || '');
  if (!cid) {
    const err = new Error('Thiếu cuộc trò chuyện');
    err.status = 400;
    throw err;
  }

  const session = await ensureSession({
    conversationId: cid,
    userId: user.id,
    userRole: getMessagingRole(user),
    branchId: user.branchId || '',
  });

  const humanUserId = String(user.id || user._id || '');
  const humanRole = getMessagingRole(user);
  const handoffReason = reason || HANDOFF_REASONS.USER_REQUESTED;

  if (aiPaused(effectiveStatus(session))) {
    const existing = await Message.findOne({
      conversationId: cid,
      senderId: AI_PEER_ID,
      content: { $regex: ESCALATE_MARKER },
    }).sort({ createdAt: -1 }).lean();
    if (existing) {
      const [clientMessage] = await enrichMessageIdentities([existing]);
      const payload = sanitizeMessageDoc(clientMessage?.toObject ? clientMessage.toObject() : clientMessage);
      return { session, message: payload, alreadyEscalated: true };
    }
  }

  const history = await loadThreadMessages(cid, 16);
  session.handoffSummary = buildLocalHandoffSummary({ history, user, reason: handoffReason });
  session.handoffReason = handoffReason;
  session.handoffRequestedAt = new Date();
  session.status = AI_SUPPORT_STATUS.WAITING_FOR_SUPPORT;
  session.escalated = true;
  session.escalatedAt = session.handoffRequestedAt;
  session.claimedBy = '';
  session.claimedByName = '';
  session.claimedAt = null;
  session.resolvedAt = null;
  await session.save();

  const message = await Message.create({
    conversationId: cid,
    senderId: AI_PEER_ID,
    senderName: AI_PEER_NAME,
    senderRole: 'system',
    senderBranchCode: '',
    receiverId: humanUserId,
    receiverName: user.name || 'Bạn',
    receiverRole: humanRole,
    receiverBranchCode: '',
    content: ESCALATE_TEXT,
    messageType: 'system',
  });

  const [clientMessage] = await enrichMessageIdentities([message]);
  const payload = sanitizeMessageDoc(clientMessage?.toObject ? clientMessage.toObject() : clientMessage);
  if (io) emitStatus(io, session, humanUserId);

  return { session, message: payload, alreadyEscalated: false };
}

async function resetAiSession({ conversationId, user, io }) {
  const cid = String(conversationId || '');
  const userId = String(user?.id || user?._id || '');
  const doc = await AiSupportSession.findOneAndUpdate(
    { conversationId: cid, userId },
    {
      escalated: false,
      escalatedAt: null,
      status: AI_SUPPORT_STATUS.AI_ACTIVE,
      claimedBy: '',
      claimedByName: '',
      claimedAt: null,
      resolvedAt: null,
      consecutiveAiFailures: 0,
      lastUserMessageAt: null,
      idlePingAt: null,
      handoffReason: '',
      handoffSummary: '',
      handoffRequestedAt: null,
    },
    { new: true },
  );
  if (!doc) {
    const err = new Error('Không tìm thấy phiên Trợ lý AI');
    err.status = 404;
    throw err;
  }
  if (io) emitStatus(io, doc, userId);
  return doc;
}

async function endAiSession({ conversationId, user, io }) {
  const cid = String(conversationId || '');
  const userId = String(user?.id || user?._id || '');
  const doc = await ensureSession({
    conversationId: cid,
    userId,
    userRole: getMessagingRole(user),
    branchId: user?.branchId || '',
  });
  doc.status = AI_SUPPORT_STATUS.CLOSED;
  doc.escalated = false;
  doc.claimedBy = '';
  doc.claimedByName = '';
  doc.claimedAt = null;
  doc.resolvedAt = new Date();
  doc.lastUserMessageAt = null;
  doc.idlePingAt = null;
  doc.consecutiveAiFailures = 0;
  await doc.save();
  if (io) emitStatus(io, doc, userId);
  return doc;
}

async function listHandoffQueue() {
  const rows = await AiSupportSession.find({
    $or: [
      { status: { $in: [AI_SUPPORT_STATUS.WAITING_FOR_SUPPORT, AI_SUPPORT_STATUS.SUPPORT_ACTIVE] } },
      { escalated: true, status: { $exists: false } },
    ],
  }).sort({ updatedAt: -1 }).limit(80).lean();

  const out = [];
  for (const row of rows) {
    const last = await Message.findOne({ conversationId: row.conversationId })
      .sort({ createdAt: -1 })
      .select('content senderName senderId createdAt receiverName')
      .lean();
    out.push({
      ...sessionToClient(row),
      userName: last?.receiverName || last?.senderName || '',
      lastMessage: last?.content || '',
      lastMessageAt: last?.createdAt || row.updatedAt,
    });
  }
  return out;
}

async function getHandoffThread({ conversationId, agent }) {
  if (!isSupportAgent(agent)) {
    const err = new Error('Chỉ nhân viên hỗ trợ xem hàng đợi AI');
    err.status = 403;
    throw err;
  }
  const cid = String(conversationId || '');
  const session = await AiSupportSession.findOne({ conversationId: cid });
  if (!session) {
    const err = new Error('Không tìm thấy yêu cầu hỗ trợ');
    err.status = 404;
    throw err;
  }
  const status = effectiveStatus(session);
  if (status === AI_SUPPORT_STATUS.AI_ACTIVE) {
    const err = new Error('Cuộc trò chuyện này chưa chuyển Support');
    err.status = 403;
    throw err;
  }
  const messages = await Message.find({ conversationId: cid, isRecalled: { $ne: true } })
    .sort({ createdAt: 1 })
    .limit(200);
  const sanitized = messages.map((m) => sanitizeMessageDoc(m.toObject ? m.toObject() : m));
  const enriched = await enrichMessageIdentities(sanitized);
  return { session: sessionToClient(session), messages: enriched };
}

async function claimHandoff({ conversationId, agent, io }) {
  if (!isSupportAgent(agent)) {
    const err = new Error('Chỉ nhân viên hỗ trợ được tiếp nhận');
    err.status = 403;
    throw err;
  }
  const cid = String(conversationId || '');
  const session = await AiSupportSession.findOne({ conversationId: cid });
  if (!session) {
    const err = new Error('Không tìm thấy yêu cầu hỗ trợ');
    err.status = 404;
    throw err;
  }
  const status = effectiveStatus(session);
  const agentId = String(agent.id || agent._id || '');
  if (status === AI_SUPPORT_STATUS.SUPPORT_ACTIVE && session.claimedBy && session.claimedBy !== agentId) {
    const err = new Error('Yêu cầu đã được nhân viên khác tiếp nhận');
    err.status = 409;
    throw err;
  }
  const alreadyClaimedBySelf = status === AI_SUPPORT_STATUS.SUPPORT_ACTIVE && session.claimedBy === agentId;
  session.status = AI_SUPPORT_STATUS.SUPPORT_ACTIVE;
  session.escalated = true;
  session.claimedBy = agentId;
  session.claimedByName = agent.name || 'Hỗ trợ viên';
  if (!session.claimedAt) session.claimedAt = new Date();
  await session.save();

  if (alreadyClaimedBySelf) {
    if (io) emitStatus(io, session, session.userId);
    return { session: sessionToClient(session), message: null, alreadyClaimed: true };
  }

  const claimText = `Nhân viên hỗ trợ ${session.claimedByName} đã tiếp nhận yêu cầu.`;
  const message = await Message.create({
    conversationId: cid,
    senderId: AI_PEER_ID,
    senderName: AI_PEER_NAME,
    senderRole: 'system',
    senderBranchCode: '',
    receiverId: String(session.userId),
    receiverName: 'Bạn',
    receiverRole: session.userRole,
    receiverBranchCode: '',
    content: claimText,
    messageType: 'system',
  });
  const [clientMessage] = await enrichMessageIdentities([message]);
  const payload = sanitizeMessageDoc(clientMessage?.toObject ? clientMessage.toObject() : clientMessage);
  if (io) {
    io.to(String(session.userId)).emit('message:receive', payload);
    io.to('ALL_SUPPORT').emit('ai-support:support_claimed', sessionToClient(session));
    emitStatus(io, session, session.userId);
  }
  return { session: sessionToClient(session), message: payload };
}

async function resolveHandoff({ conversationId, agent, io }) {
  if (!isSupportAgent(agent)) {
    const err = new Error('Chỉ nhân viên hỗ trợ được đóng yêu cầu');
    err.status = 403;
    throw err;
  }
  const cid = String(conversationId || '');
  const session = await AiSupportSession.findOne({ conversationId: cid });
  if (!session) {
    const err = new Error('Không tìm thấy yêu cầu hỗ trợ');
    err.status = 404;
    throw err;
  }
  session.status = AI_SUPPORT_STATUS.SUPPORT_RESOLVED;
  session.escalated = true;
  session.resolvedAt = new Date();
  await session.save();

  const resolveText = 'Vấn đề đã được xử lý. Bạn có thể tiếp tục dùng Trợ lý AI nếu cần.';
  const message = await Message.create({
    conversationId: cid,
    senderId: AI_PEER_ID,
    senderName: AI_PEER_NAME,
    senderRole: 'system',
    senderBranchCode: '',
    receiverId: String(session.userId),
    receiverName: 'Bạn',
    receiverRole: session.userRole,
    receiverBranchCode: '',
    content: resolveText,
    messageType: 'system',
  });
  const [clientMessage] = await enrichMessageIdentities([message]);
  const payload = sanitizeMessageDoc(clientMessage?.toObject ? clientMessage.toObject() : clientMessage);
  if (io) {
    io.to(String(session.userId)).emit('message:receive', payload);
    io.to('ALL_SUPPORT').emit('ai-support:support_resolved', sessionToClient(session));
    emitStatus(io, session, session.userId);
  }
  return { session: sessionToClient(session), message: payload };
}

async function replyAsSupport({
  conversationId,
  agent,
  content,
  fileUrl = '',
  fileName = '',
  messageType = 'text',
  io,
  notifyUser,
}) {
  if (!isSupportAgent(agent)) {
    const err = new Error('Chỉ nhân viên hỗ trợ được trả lời yêu cầu AI');
    err.status = 403;
    throw err;
  }

  const rawUrl = String(fileUrl || '').trim();
  const safeUrl = (!rawUrl || rawUrl.includes('://') || rawUrl.includes('..') || !rawUrl.startsWith('/'))
    ? ''
    : rawUrl.slice(0, 500);
  const type = (messageType === 'image' || messageType === 'file') && safeUrl
    ? messageType
    : 'text';
  const text = String(content || '').trim();
  const body = text
    || (type === 'image' ? '[Hình ảnh]' : '')
    || (type === 'file' ? `Đã gửi tệp: ${String(fileName || 'đính kèm').slice(0, 120)}` : '');
  if (!body) {
    const err = new Error('Nội dung trống');
    err.status = 400;
    throw err;
  }

  let claimed = null;
  const current = await AiSupportSession.findOne({ conversationId: String(conversationId) });
  if (current && effectiveStatus(current) === AI_SUPPORT_STATUS.WAITING_FOR_SUPPORT) {
    claimed = await claimHandoff({ conversationId, agent, io });
  } else if (current && effectiveStatus(current) === AI_SUPPORT_STATUS.SUPPORT_ACTIVE) {
    const agentId = String(agent.id || agent._id || '');
    if (current.claimedBy && current.claimedBy !== agentId) {
      const err = new Error('Yêu cầu đã được nhân viên khác tiếp nhận');
      err.status = 409;
      throw err;
    }
  }

  const session = await AiSupportSession.findOne({ conversationId: String(conversationId) });
  if (!session || !aiPaused(effectiveStatus(session))) {
    const err = new Error('Cuộc trò chuyện không ở trạng thái Support');
    err.status = 400;
    throw err;
  }

  const agentId = String(agent.id || agent._id || '');
  const message = await Message.create({
    conversationId: String(conversationId),
    senderId: agentId,
    senderName: agent.name || 'Hỗ trợ viên',
    senderRole: 'staff',
    senderBranchCode: '',
    receiverId: String(session.userId),
    receiverName: 'Bạn',
    receiverRole: session.userRole,
    receiverBranchCode: '',
    content: body.slice(0, 2000),
    messageType: type,
    fileUrl: type === 'text' ? '' : safeUrl,
    fileName: type === 'text' ? '' : String(fileName || '').slice(0, 200),
  });
  const [clientMessage] = await enrichMessageIdentities([message]);
  const payload = sanitizeMessageDoc(clientMessage?.toObject ? clientMessage.toObject() : clientMessage);
  if (io) {
    io.to(agentId).emit('message:sent', payload);
  }
  if (typeof notifyUser === 'function') {
    notifyUser(session.userRole, session.userId, 'message:receive', payload);
  } else if (io) {
    io.to(String(session.userId)).emit('message:receive', payload);
  }
  return { session: sessionToClient(session), message: payload, claimed: claimed?.session || null };
}

function extractActionLinks(rawText) {
  const actions = [];
  const seen = new Set();
  const stripped = String(rawText || '').replace(/⟦go:([^|\u27E7\]]+)\|([^\u27E7\]]+)⟧/g, (_, rawPath, rawLabel) => {
    const p = String(rawPath || '').trim();
    const label = String(rawLabel || '').trim();
    if (p && label && !seen.has(`${p}|${label}`)) {
      seen.add(`${p}|${label}`);
      actions.push({ path: p, label });
    }
    return '';
  });
  const cleanText = stripped
    .replace(/\[GỢI Ý:[^\]]*\]/gi, '')
    .split('\n')
    .map((line) => line.replace(/^[\s·•-]+$/g, '').replace(/\s{2,}/g, ' ').trimEnd())
    .filter((line, idx, arr) => !(line === '' && (idx === 0 || idx === arr.length - 1 || arr[idx - 1] === '')))
    .join('\n')
    .trim();
  return { cleanText, actions };
}

function normalizeQuickOfficeKey(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const QUICK_OFFICE_COMPLEX_RE = /(?:\bso sanh\b|\bkhac nhau\b|\bcompare\b|\bdifference\b|\bvs\b|#n\/a|#value!|#ref!|#name\?|#div\/0!|\bkhong ra\b|\bbi sai\b|\bkhong chay\b|\btai sao.*loi\b|\bmy formula\b|\bmy sheet\b)/i;

const QUICK_OFFICE_MEMORY_RULES = [
  {
    match: (n) => /\bvlookup\b/.test(n) && !/\bxlookup\b|\bindex\b|\bmatch\b/.test(n),
    vi: [
      '**Hàm `VLOOKUP` trong Excel** dùng để dò tìm một giá trị theo **cột đầu tiên** của bảng và trả về dữ liệu ở cột tương ứng cùng hàng.',
      '- **Cú pháp:** `=VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])`',
      '- **Ý nghĩa từng đối số:** `lookup_value` (giá trị cần tìm) · `table_array` (bảng dò, nhớ bấm `F4` cố định `$A$2:$D$20`) · `col_index_num` (số thứ tự cột cần lấy, tính từ 1) · `0` hoặc `FALSE` để tìm **chính xác**.',
      '- **Ví dụ:** `=VLOOKUP(A2, $E$2:$G$50, 2, 0)` → tìm mã ở `A2` trong cột `E`, lấy giá trị ở cột `F` (cột thứ 2).',
    ].join('\n'),
    en: [
      '**Excel `VLOOKUP`** searches for a value in the **first column** of a table and returns a matching value from the same row.',
      '- **Syntax:** `=VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])`',
      '- **Key tips:** Lock `table_array` with `F4` (e.g., `$E$2:$G$50`), set `col_index_num` counting from column 1 of the table, and use `0` (`FALSE`) for an **exact match**.',
      '- **Example:** `=VLOOKUP(A2, $E$2:$G$50, 2, 0)` → looks up `A2` in column `E` and returns column `F` (2nd column).',
    ].join('\n'),
  },
  {
    match: (n) => /\bxlookup\b/.test(n) && !/\bvlookup\b/.test(n),
    vi: [
      '**Hàm `XLOOKUP` trong Excel** (bản mới) thay thế `VLOOKUP`/`HLOOKUP`: dò được theo mọi hướng (trái/phải/lên/xuống) và mặc định khớp chính xác.',
      '- **Cú pháp:** `=XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found])`',
      '- **Ví dụ:** `=XLOOKUP(A2, $E$2:$E$50, $G$2:$G$50, "Không thấy")`',
    ].join('\n'),
    en: [
      '**Excel `XLOOKUP`** replaces `VLOOKUP`/`HLOOKUP`: it looks up in any direction and defaults to an exact match.',
      '- **Syntax:** `=XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found])`',
      '- **Example:** `=XLOOKUP(A2, $E$2:$E$50, $G$2:$G$50, "Not found")`',
    ].join('\n'),
  },
  {
    match: (n) => /\bsumifs?\b/.test(n) && !/\bcountifs?\b/.test(n),
    vi: [
      '**Hàm `SUMIF` và `SUMIFS`** dùng để tính tổng theo điều kiện trong Excel:',
      '- **1 điều kiện (`SUMIF`):** `=SUMIF(vùng_điều_kiện, điều_kiện, [vùng_tính_tổng])` — ví dụ `=SUMIF(B2:B20, "Excel", C2:C20)`',
      '- **Nhiều điều kiện (`SUMIFS`):** `=SUMIFS(vùng_tính_tổng, vùng_đk_1, đk_1, vùng_đk_2, đk_2)` — lưu ý **`SUMIFS` đưa vùng tính tổng lên đầu tiên**.',
    ].join('\n'),
    en: [
      '**`SUMIF` and `SUMIFS`** sum values that meet one or multiple criteria in Excel:',
      '- **Single criterion (`SUMIF`):** `=SUMIF(criteria_range, criteria, [sum_range])` — e.g. `=SUMIF(B2:B20, "Excel", C2:C20)`',
      '- **Multiple criteria (`SUMIFS`):** `=SUMIFS(sum_range, criteria_range1, criteria1, ...)` — note **`sum_range` comes first** in `SUMIFS`.',
    ].join('\n'),
  },
  {
    match: (n) => /\bcountifs?\b/.test(n),
    vi: [
      '**Hàm `COUNTIF` và `COUNTIFS`** dùng để đếm số ô thỏa điều kiện:',
      '- **1 điều kiện (`COUNTIF`):** `=COUNTIF(B2:B50, ">=8")` hoặc `=COUNTIF(A2:A50, "Đạt")`',
      '- **Nhiều điều kiện (`COUNTIFS`):** `=COUNTIFS(A2:A50, "Excel", B2:B50, ">=8")`',
    ].join('\n'),
    en: [
      '**`COUNTIF` and `COUNTIFS`** count cells matching one or more conditions:',
      '- **1 condition (`COUNTIF`):** `=COUNTIF(B2:B50, ">=8")` or `=COUNTIF(A2:A50, "Pass")`',
      '- **Multiple conditions (`COUNTIFS`):** `=COUNTIFS(A2:A50, "Excel", B2:B50, ">=8")`',
    ].join('\n'),
  },
  {
    match: (n) => /\bham if\b|\bif\b.*(?:\band\b|\bor\b|\bdieu kien\b|\bcondition\b|\bformula\b|\bexcel\b|\bfunction\b|\bla gi\b|\bwhat\b)/.test(n),
    vi: [
      '**Hàm `IF` trong Excel** kiểm tra điều kiện Đúng/Sai rồi trả về giá trị tương ứng:',
      '- **Cú pháp:** `=IF(logical_test, value_if_true, value_if_false)`',
      '- **Kết hợp nhiều điều kiện:** dùng `AND(...)` (đồng thời) hoặc `OR(...)` (một trong các điều kiện). Chuỗi chữ luôn đặt trong dấu ngoặc kép `""`.',
      '- **Ví dụ:** `=IF(AND(B2>=5, C2>=5), "Đạt", "Chưa đạt")`',
    ].join('\n'),
    en: [
      '**Excel `IF`** checks whether a condition is TRUE or FALSE and returns one value accordingly:',
      '- **Syntax:** `=IF(logical_test, value_if_true, value_if_false)`',
      '- **Combine multiple checks:** nest `AND(...)` (all true) or `OR(...)` (any true). Wrap text results in quotes `""`.',
      '- **Example:** `=IF(AND(B2>=5, C2>=5), "Pass", "Review")`',
    ].join('\n'),
  },
  {
    match: (n) => /\bindex\b/.test(n) && /\bmatch\b/.test(n),
    vi: [
      '**Kết hợp `INDEX + MATCH`** giúp tra cứu linh hoạt hai chiều (dò được cả bên trái cột tìm kiếm):',
      '- **Cú pháp:** `=INDEX(cột_kết_quả, MATCH(giá_trị_tìm, cột_tìm, 0))`',
      '- **Ví dụ:** `=INDEX($A$2:$A$50, MATCH(F2, $C$2:$C$50, 0))` — tìm `F2` trong cột `C` rồi lấy giá trị tương ứng ở cột `A`.',
    ].join('\n'),
    en: [
      '**`INDEX + MATCH`** enables flexible two-way lookup (even to the left of the key column):',
      '- **Syntax:** `=INDEX(return_column, MATCH(lookup_value, lookup_column, 0))`',
      '- **Example:** `=INDEX($A$2:$A$50, MATCH(F2, $C$2:$C$50, 0))`',
    ].join('\n'),
  },
  {
    match: (n) => /\bpivot\b|\bpivottable\b/.test(n),
    vi: [
      '**Tạo PivotTable nhanh trong Excel** để tổng hợp & thống kê bảng dữ liệu lớn:',
      '- **Bước 1:** Đặt con trỏ chuột bên trong bảng dữ liệu sạch (có tiêu đề cột, không gộp ô).',
      '- **Bước 2:** Vào thẻ **Insert** → **PivotTable** → nhấn **OK**.',
      '- **Bước 3:** Kéo trường phân nhóm vào **Rows/Columns**, trường cần tính tổng/đếm vào **Values**.',
    ].join('\n'),
    en: [
      '**Create a PivotTable in Excel** to summarize large datasets quickly:',
      '- **Step 1:** Click anywhere inside your clean table (with column headers, no merged header cells).',
      '- **Step 2:** Go to **Insert** → **PivotTable** → click **OK**.',
      '- **Step 3:** Drag category fields to **Rows/Columns** and numeric fields to **Values**.',
    ].join('\n'),
  },
  {
    match: (n) => /\bmuc luc\b|\btable of contents\b/.test(n),
    vi: [
      '**Tạo mục lục tự động trong Word:**',
      '- **Bước 1:** Chọn các tiêu đề chương/mục rồi gán Style **Heading 1, Heading 2, Heading 3** ở thẻ **Home**.',
      '- **Bước 2:** Đặt con trỏ ở trang muốn chèn mục lục, vào thẻ **References** → **Table of Contents** → chọn mẫu có sẵn.',
      '- *Mẹo:* Khi thêm bớt trang, bấm **Update Table** → **Update page numbers only** để cập nhật số trang.',
    ].join('\n'),
    en: [
      '**Create an automatic Table of Contents in Word:**',
      '- **Step 1:** Apply **Heading 1, Heading 2, Heading 3** styles from the **Home** tab to section titles.',
      '- **Step 2:** Place the cursor where you want the TOC, go to **References** → **Table of Contents**, and pick a style.',
      '- *Tip:* Whenever pages shift, click **Update Table** to refresh numbers.',
    ].join('\n'),
  },
  {
    match: (n) => /\bnghi dinh 30\b|\bcan le word\b|\bchinh le word\b|\bmargins?\b.*\bword\b|\bword\b.*\bmargins?\b/.test(n),
    vi: [
      '**Chỉnh lề trang chuẩn trong Word (Nghị định 30):**',
      '- Vào **Layout** (hoặc **Page Layout**) → **Margins** → **Custom Margins…**',
      '- Thiết lập chuẩn A4: **Top:** `20mm` (`2cm`), **Bottom:** `20mm`, **Left:** `30mm`, **Right:** `15mm`.',
      '- Font chữ văn bản hành chính phổ biến: **Times New Roman**, cỡ `13–14pt`, giãn dòng `1.15–1.3`.',
    ].join('\n'),
    en: [
      '**Adjust page margins in Microsoft Word:**',
      '- Go to **Layout** → **Margins** → **Custom Margins…**',
      '- Common standard (Vietnam Decree 30 / A4): **Top:** `20mm`, **Bottom:** `20mm`, **Left:** `30mm`, **Right:** `15mm`.',
      '- Click **Set As Default** if you want the layout applied to future documents.',
    ].join('\n'),
  },
  {
    match: (n) => /\bslide master\b/.test(n),
    vi: [
      '**Dùng Slide Master trong PowerPoint** để đồng bộ font chữ, logo, footer cho toàn bộ bài thuyết trình:',
      '- Vào thẻ **View** → **Slide Master**.',
      '- Chọn **slide đầu tiên (slide cha to nhất ở trên cùng)** để gắn logo/màu/font chung.',
      '- Sau khi chỉnh xong, vào thẻ **Slide Master** → **Close Master View** để quay lại soạn nội dung.',
    ].join('\n'),
    en: [
      '**Use Slide Master in PowerPoint** to keep fonts, colors, and logos consistent across all slides:',
      '- Open the **View** tab → **Slide Master**.',
      '- Select the **top parent slide** to apply global logo/fonts/footer.',
      '- Click **Close Master View** when finished to return to normal editing.',
    ].join('\n'),
  },
  {
    match: (n) => /\bphim tat\b|\bshortcuts?\b/.test(n),
    vi: [
      '**Bộ phím tắt Tin học Văn phòng hay dùng nhất:**',
      '- **Chung / Word / PowerPoint:** `Ctrl + C` (Sao chép) · `Ctrl + X` (Cắt) · `Ctrl + V` (Dán) · `Ctrl + Z` (Hoàn tác) · `Ctrl + S` (Lưu) · `Ctrl + P` (In) · `Ctrl + F` (Tìm kiếm).',
      '- **Excel:** `F4` (Cố định ô `$A$1` khi nhập công thức) · `Ctrl + T` (Tạo Table) · `Alt + =` (AutoSum) · `Ctrl + Shift + L` (Bật/tắt Filter) · `F2` (Sửa ô).',
    ].join('\n'),
    en: [
      '**Most useful Office IT keyboard shortcuts:**',
      '- **General / Word / PPT:** `Ctrl + C` (Copy) · `Ctrl + X` (Cut) · `Ctrl + V` (Paste) · `Ctrl + Z` (Undo) · `Ctrl + S` (Save) · `Ctrl + F` (Find).',
      '- **Excel:** `F4` (Toggle `$A$1` absolute reference) · `Ctrl + T` (Create Table) · `Alt + =` (AutoSum) · `Ctrl + Shift + L` (Toggle Filter) · `F2` (Edit cell).',
    ].join('\n'),
  },
];

function officeItQuickMemory(userText, lang = 'vi') {
  const raw = String(userText || '').trim();
  if (!raw || raw.length > 90) return null;
  const norm = normalizeQuickOfficeKey(raw);
  if (!norm || QUICK_OFFICE_COMPLEX_RE.test(norm)) return null;
  const useEn = lang === 'en';
  for (const rule of QUICK_OFFICE_MEMORY_RULES) {
    if (rule.match(norm)) {
      return useEn ? rule.en : rule.vi;
    }
  }
  return null;
}

function buildQuickAskSystemPrompt(userRole, userName, lang = 'vi') {
  const roleStr = String(userRole || '').toLowerCase();
  const roleLabelVi = roleStr === 'teacher' ? 'Giảng viên' : roleStr === 'admin' ? 'Quản trị viên' : roleStr === 'staff' ? 'Nhân viên' : 'Học viên';
  const roleLabelEn = roleStr === 'teacher' ? 'Teacher' : roleStr === 'admin' ? 'Admin' : roleStr === 'staff' ? 'Staff' : 'Student';
  const name = String(userName || '').trim() || (lang === 'en' ? roleLabelEn : roleLabelVi);
  if (lang === 'en') {
    return [
      'You are DewSkill AI, a fast personal Office IT & LMS assistant for Thang Tin Hoc Academy.',
      `Current user: ${roleLabelEn} ("${name}"). Answer clearly, accurately, and 100% in natural English.`,
      'Scope: Microsoft Word, Excel, PowerPoint, MOS certification, computer basics, printing/networking, and using the Thang Tin Hoc / DewSkill LMS.',
      'Style: concise structured Markdown using **bold** key terms/steps, clean bullet lists `- `, and inline `` `code` `` for formulas/shortcuts. Avoid ## markdown headings and avoid filler greetings.',
      'Do not invent user passwords or promise refunds/grade edits.',
    ].join('\n');
  }
  return [
    'Bạn là DewSkill AI, trợ lý cá nhân giải đáp nhanh về Tin học văn phòng & hệ thống LMS của Thắng Tin Học.',
    `Người đang hỏi: ${roleLabelVi} ("${name}"). Trả lời ngắn gọn, rõ ràng, chính xác bằng tiếng Việt có dấu (trừ khi người dùng hỏi tiếng Anh).`,
    'Phạm vi: Word, Excel, PowerPoint, chứng chỉ MOS, máy tính cơ bản, in ấn/mạng và hướng dẫn sử dụng LMS Thắng Tin Học / DewSkill.',
    'Trình bày bằng Markdown gọn đẹp: **in đậm** bước làm/từ khóa chính, gạch đầu dòng `- `, đặt tên hàm/phím tắt trong `` `code` ``. Không dùng tiêu đề ##, không chào dài dòng.',
    'Không bịa mật khẩu hay cam kết hoàn tiền/sửa điểm.',
  ].join('\n');
}

async function quickAskAssistant({ user, question, history = [], preferredLang = '' }) {
  const rawQuestion = String(question || '').trim().slice(0, 1500);
  if (!rawQuestion) {
    const err = new Error('Nội dung câu hỏi không được để trống');
    err.status = 400;
    throw err;
  }

  const userRole = String(user?.role || getMessagingRole(user) || 'student').toLowerCase();
  const userName = String(user?.name || '').trim();
  const historyMessages = (Array.isArray(history) ? history : [])
    .slice(-8)
    .map((m) => ({
      senderId: m?.role === 'assistant' ? AI_PEER_ID : String(user?.id || 'user'),
      messageType: 'text',
      content: String(m?.text || m?.content || '').trim().slice(0, 1500),
    }))
    .filter((m) => m.content);

  const lang = detectQueryLanguage(rawQuestion, historyMessages, preferredLang);

  // Tier 1: Built-in fast memory
  if (isSimpleGreeting(rawQuestion)) {
    const greeting = lang === 'en'
      ? 'Hello! I am **DewSkill AI**. Ask me any question about Excel, Word, PowerPoint, MOS, or how to use LMS features.'
      : 'Xin chào! Mình là **DewSkill AI**. Bạn có thể hỏi bất kỳ điều gì về Excel, Word, PowerPoint, MOS hoặc cách dùng LMS nhé!';
    return { answer: greeting, source: 'memory', lang, actions: [] };
  }

  if (isImageGenRequest(rawQuestion)) {
    return {
      answer: lang === 'en' ? IMAGE_GEN_REFUSE_EN : IMAGE_GEN_REFUSE,
      source: 'memory',
      lang,
      actions: [],
    };
  }

  if (isGhostwriteRequest(rawQuestion)) {
    return {
      answer: lang === 'en' ? GHOSTWRITE_REFUSE_EN : GHOSTWRITE_REFUSE,
      source: 'memory',
      lang,
      actions: [],
    };
  }

  const faqHit = teacherFaqReply(userRole, rawQuestion, lang)
    || studentFaqReply(userRole, rawQuestion, lang)
    || lmsFaqReply(userRole, rawQuestion, lang);
  if (faqHit) {
    const { cleanText, actions } = extractActionLinks(faqHit);
    return { answer: cleanText, source: 'memory', lang, actions };
  }

  const officeHit = officeItQuickMemory(rawQuestion, lang);
  if (officeHit) {
    return { answer: officeHit, source: 'memory', lang, actions: [] };
  }

  // Tier 2: Gemini AI LLM fallback
  if (!isAiConfigured()) {
    return {
      answer: lang === 'en' ? KEY_INVALID_REPLY_EN : KEY_INVALID_REPLY,
      source: 'fallback',
      lang,
      actions: [],
    };
  }

  const messages = [
    { role: 'system', content: buildQuickAskSystemPrompt(userRole, userName, lang) },
    ...(Array.isArray(history) ? history : [])
      .slice(-8)
      .filter((m) => m && String(m.text || m.content || '').trim())
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.text || m.content || '').trim().slice(0, 1500),
      })),
    { role: 'user', content: rawQuestion },
  ];

  try {
    const result = await callSupportLlm(messages);
    const sanitized = sanitizeSupportReply(result?.content, { stripGreeting: historyMessages.length > 0 });
    const { cleanText, actions } = extractActionLinks(sanitized);
    if (!cleanText) {
      return {
        answer: lang === 'en' ? EMPTY_REPLY_EN : EMPTY_REPLY,
        source: 'fallback',
        lang,
        actions: [],
      };
    }
    return {
      answer: cleanText,
      source: 'ai',
      lang,
      actions,
      ...(result?.model ? { model: result.model } : {}),
    };
  } catch (err) {
    logger.warn({ err: err?.message }, '[Quick Ask AI] fallback error');
    return {
      answer: lang === 'en' ? EMPTY_REPLY_EN : EMPTY_REPLY,
      source: 'fallback',
      lang,
      actions: [],
    };
  }
}

module.exports = {
  AI_PEER_ID,
  AI_PEER_NAME,
  AI_SUPPORT_STATUS,
  HANDOFF_REASONS,
  detectQueryLanguage,
  isAiSupportEnabled,
  aiSupportConfigured,
  getSupportModelFallbacks,
  isAiChatUser,
  isSupportAgent,
  isAiSupportConversationId,
  sessionToClient,
  effectiveStatus,
  getSession,
  ensureSession,
  scheduleAiSupportReply,
  sendWelcomeIfEmpty,
  consumeAiImageQuota,
  peekImageQuota,
  consumeAiQuestionQuota,
  peekQuestionQuota,
  escalateToHuman,
  resetAiSession,
  endAiSession,
  replyToUserMessage,
  clearAiHistory,
  startAiIdleWatcher,
  stopAiIdleWatcher,
  IDLE_PING_TEXT,
  IDLE_END_TEXT,
  listHandoffQueue,
  getHandoffThread,
  claimHandoff,
  resolveHandoff,
  replyAsSupport,
  extractActionLinks,
  officeItQuickMemory,
  quickAskAssistant,
};
