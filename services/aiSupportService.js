'use strict';

const fs = require('fs');
const path = require('path');
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
const AI_IMAGE_DAILY_LIMIT = Math.max(1, Number(process.env.AI_SUPPORT_IMAGE_DAILY_LIMIT) || 5);
const AI_QUESTION_DAILY_LIMIT_STUDENT = Math.max(1, Number(process.env.AI_SUPPORT_QUESTION_DAILY_LIMIT_STUDENT || process.env.AI_SUPPORT_QUESTION_DAILY_LIMIT) || 15);
const AI_QUESTION_DAILY_LIMIT_TEACHER = Math.max(1, Number(process.env.AI_SUPPORT_QUESTION_DAILY_LIMIT_TEACHER) || 25);
const IDLE_PING_MS = Math.max(30_000, Number(process.env.AI_SUPPORT_IDLE_PING_MS) || 5 * 60 * 1000);
const IDLE_END_MS = Math.max(15_000, Number(process.env.AI_SUPPORT_IDLE_END_MS) || 5 * 60 * 1000);
const IDLE_SWEEP_MS = Math.max(10_000, Number(process.env.AI_SUPPORT_IDLE_SWEEP_MS) || 30_000);
const ESCALATE_MARKER = 'Đã chuyển yêu cầu tới nhân viên hỗ trợ';
const BUSY_REPLY = 'Trợ lý AI đang bận. Bạn chọn "Cần nhân viên hỗ trợ" bên dưới nếu muốn gặp người thật.';
const EMPTY_REPLY = 'Xin lỗi, mình chưa trả lời được lúc này. Bạn thử hỏi lại giúp mình nhé.';
const OUT_OF_SCOPE_REPLY = 'Em là Trợ lý AI Tin Học của Thắng Tin Học. Câu hỏi này nằm ngoài phạm vi em hỗ trợ.';
const QUESTION_LIMIT_MARKER = 'lượt hỏi Trợ lý AI hôm nay';
function questionLimitReply(limit) {
  const n = Number(limit) || 0;
  return `Bạn đã hết ${n} ${QUESTION_LIMIT_MARKER}. Cần hỗ trợ tiếp thì bấm **Cần nhân viên hỗ trợ** bên dưới, hoặc ngày mai hỏi AI tiếp.`;
}
const IMAGE_GEN_REFUSE = 'Em không tạo hình ảnh. Bạn gửi ảnh màn hình Word, Excel hoặc PowerPoint nếu cần em xem giúp.';
const GHOSTWRITE_REFUSE = 'Em chỉ hướng dẫn cách làm (dàn ý, thao tác Word). Em không viết hộ tiểu luận, báo cáo hay văn bản hành chính.';
const IDLE_PING_TEXT = 'Bạn có còn đó không, cần hỗ trợ gì nữa không?';
const IDLE_END_TEXT = 'Phiên hỗ trợ đã kết thúc.';
const IDLE_STILL_HERE = 'Mình vẫn ở đây. Bạn hỏi gì ạ?';

const SUPPORT_MODEL_FALLBACKS = [
  process.env.AI_SUPPORT_MODEL,
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  process.env.AI_MODEL,
  'gemini-flash-latest',
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

function questionDailyLimit(userRole) {
  const role = String(userRole || '');
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

function peekImageQuota(session) {
  const today = vietnamDateKey();
  const used = session && String(session.imageUploadDate || '') === today
    ? Number(session.imageUploadCount || 0)
    : 0;
  const limit = AI_IMAGE_DAILY_LIMIT;
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
  if (!sessionDoc) {
    return { applies: false, blocked: false, remaining: null, used: 0, limit: AI_IMAGE_DAILY_LIMIT };
  }
  if (aiPaused(effectiveStatus(sessionDoc))) {
    return { applies: false, blocked: false, remaining: null, used: 0, limit: AI_IMAGE_DAILY_LIMIT };
  }
  const today = vietnamDateKey();
  const used = String(sessionDoc.imageUploadDate || '') === today
    ? Number(sessionDoc.imageUploadCount || 0)
    : 0;
  if (used >= AI_IMAGE_DAILY_LIMIT) {
    return {
      applies: true,
      blocked: true,
      remaining: 0,
      used,
      limit: AI_IMAGE_DAILY_LIMIT,
    };
  }
  sessionDoc.imageUploadDate = today;
  sessionDoc.imageUploadCount = used + 1;
  await sessionDoc.save();
  return {
    applies: true,
    blocked: false,
    remaining: AI_IMAGE_DAILY_LIMIT - used - 1,
    used: used + 1,
    limit: AI_IMAGE_DAILY_LIMIT,
  };
}

function loadInlineImage(fileUrl) {
  const disk = resolveDiskPath(fileUrl);
  if (!disk || !fs.existsSync(disk)) return null;
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

function isAiSupportEnabled() {
  return process.env.AI_SUPPORT_ENABLED === '1';
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
  return String(m?.senderId || '') === AI_PEER_ID
    && String(m?.content || '').includes(ESCALATE_MARKER);
}

function isIdlePingMessage(m) {
  return String(m?.content || '').trim() === IDLE_PING_TEXT;
}

function isIdleEndMessage(m) {
  return String(m?.content || '').includes(IDLE_END_TEXT);
}

function isIdleStillHereMessage(m) {
  return String(m?.content || '').trim() === IDLE_STILL_HERE;
}

function isWelcomeMessage(m) {
  const t = String(m?.content || '');
  return String(m?.senderId || '') === AI_PEER_ID
    && /Trợ lý AI Tin Học của Thắng Tin Học/.test(t)
    && /hỗ trợ Word, Excel, PowerPoint, MOS, LMS/i.test(t);
}

/** Phiên đã có lời chào hoặc đang trao đổi — không chào lại trong tin Gemini. */
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

const LEADING_GREETING_RE = /^(?:\s*(?:Dạ\s+)?(?:Em|Mình)\s+)?(?:Xin\s+chào|Chào(?:\s+Thầy\/Cô|\s+bạn|\s+em)?)\s+[^!\n]+[!….]?\s*(?:\n+)?/i;

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

function teacherFaqReply(userRole, userText) {
  if (!isTeacherRole(userRole)) return null;
  const t = normalizeFaqKey(userText);
  if (t === 'hướng dẫn sử dụng lms') {
    return [
      'Thầy/Cô dùng **LMS Thắng Tin Học** như sau:',
      '**Bước 1:** Mở *menu bên trái*: **Tổng quan**, **Quản lý học viên**, **Lịch dạy**, **Tài chính**, **Đào tạo**, **Hộp thư**.',
      '**Bước 2:** **Tổng quan** — xem lịch sắp tới, học viên, thông báo nhanh. ⟦go:/teacher|Mở Tổng quan⟧',
      '**Bước 3:** **Quản lý học viên** — mở thẻ từng em để *điểm danh*, nhận xét, giao bài. ⟦go:/teacher#students|Mở Quản lý học viên⟧',
      '**Bước 4:** **Đào tạo** — video/tài liệu nội bộ cho giảng viên. ⟦go:/teacher#training|Mở Đào tạo⟧',
      '**Bước 5:** **Bảng tin** — đăng câu hỏi, chia sẻ ảnh bài tập. ⟦go:/teacher/feed|Mở Bảng tin⟧',
      '**Bước 6:** **Tạo trắc nghiệm & bài tập** — soạn đề giao học viên. ⟦go:/teacher#assignments|Mở giao bài⟧',
      'Thầy/Cô cần bước nào *chi tiết hơn* ạ?',
    ].join('\n');
  }
  if (t === 'hướng dẫn tạo lịch dạy cho học viên') {
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
  if (t === 'xem tài chính') {
    return [
      'Xem **tài chính** giảng viên:',
      '**Bước 1:** Vào menu **Tài chính** trên sidebar (hoặc nút Tài chính ở **Tổng quan**).',
      '**Bước 2:** Trang này hiện buổi đã dạy, *đã thanh toán* và còn *tạm tính*.',
      '**Bước 3:** Có thể **xuất bảng kê** nếu cần đối chiếu.',
      '**Bước 4:** Học phí từng học viên nằm ở *hồ sơ học viên / giáo vụ* — **không sửa số tiền** trên trang này.',
      '⟦go:/teacher/finance|Mở trang Tài chính⟧',
      'Thầy/Cô muốn xem buổi *chưa thanh toán* hay bảng kê *tháng này* ạ?',
    ].join('\n');
  }
  return null;
}

function isImageGenRequest(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return false;
  if (/(màn hình|screenshot|chụp ảnh|xem ảnh|gửi ảnh)/i.test(t) && !/(tạo ảnh|vẽ ảnh|sinh ảnh)/i.test(t)) {
    return false;
  }
  return /(tạo ảnh|vẽ ảnh|sinh ảnh|generate image|tạo hình ảnh|ai vẽ|dall-?e|midjourney|tạo poster|tạo banner|tạo logo)/i.test(t);
}

function isGhostwriteRequest(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return false;
  const howTo = /(cách viết|hướng dẫn viết|dàn ý|cấu trúc|làm thế nào để viết|trình bày)/i.test(t);
  const doForMe = /(viết hộ|soạn hộ|làm hộ|viết giúp|soạn giúp|làm giúp|viết luôn|viết đầy đủ|viết hoàn chỉnh|soạn luôn|viết cho mình|nội dung hoàn chỉnh|toàn bộ bài)/i.test(t);
  if (howTo && !doForMe) return false;
  const doc = /(tiểu luận|bài luận|luận văn|báo cáo thực tập|báo cáo môn|công văn|văn bản hành chính|đơn xin|biên bản họp|tờ trình|bài thu hoạch)/i.test(t);
  if (!doc) return false;
  return doForMe || /(viết|soạn)\s+\d+\s*(chữ|từ|trang)/i.test(t) || /(viết|soạn)\s+(một|1)\s*(bài|bản)/i.test(t);
}

function studentFaqReply(userRole, userText) {
  if (!isStudentRole(userRole)) return null;
  const t = normalizeFaqKey(userText);
  if (t === 'lịch học') {
    return [
      'Xem **lịch học** trên LMS:',
      '**Bước 1:** Mở menu **Lịch học** (hoặc **Tổng quan** → tab Lịch học).',
      '**Bước 2:** Xem *ngày*, *giờ*, *giảng viên* của từng buổi.',
      '**Bước 3:** Tới giờ thì vào học theo lịch; *vắng mặt* thì liên hệ **GV/giáo vụ**.',
      '⟦go:/student#schedule|Mở Lịch học ngay⟧',
      'Bạn đang không thấy buổi nào trên lịch à?',
    ].join('\n');
  }
  if (t === 'học video') {
    return [
      'Học **video** trên LMS:',
      '**Bước 1:** Vào menu **Tài liệu**.',
      '**Bước 2:** Chọn tab **Video học**, mở bài theo *khóa đang học*.',
      '**Bước 3:** Xem *lần lượt*; bài *khóa* thì học hết bài trước.',
      '⟦go:/student#materials|Mở Video học ngay⟧',
      'Bạn không thấy bài nào à?',
    ].join('\n');
  }
  if (t === 'cách sử dụng hàm sumif, sumifs') {
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
      '**SUMIF** — cộng theo *một* điều kiện.',
      '**Bước 1:** Viết `SUMIF`(range; tiêu_chí; [sum_range]).',
      '**Bước 2:** *Ví dụ* cộng doanh thu chi nhánh **Hà Nội** → `SUMIF(A2:A5; "Hà Nội"; C2:C5)` = **250**.',
      '',
      '**SUMIFS** — cộng theo *nhiều* điều kiện.',
      '**Bước 1:** Viết `SUMIFS`(sum_range; criteria_range1; criteria1; ...).',
      '**Bước 2:** *Ví dụ* **Hà Nội** và sản phẩm **Bút** → `SUMIFS(C2:C5; A2:A5; "Hà Nội"; B2:B5; "Bút")` = **100**.',
      '',
      'Muốn xem thêm bài trên LMS: ⟦go:/student#materials|Mở Video học⟧',
      'Bạn đang làm công thức trên cột nào?',
    ].join('\n');
  }
  if (t === 'cách sử dụng hàm vlookup') {
    return [
      '**VLOOKUP** tìm giá trị theo cột khóa *bên trái* bảng.',
      '**Bước 1:** Viết `VLOOKUP`(giá_trị_cần_tìm; bảng; số_cột; FALSE).',
      '**Bước 2:** *Ví dụ:* `VLOOKUP(E2; A2:C20; 3; FALSE)`.',
      '**Bước 3:** **FALSE** = khớp *chính xác*. Lỗi `#N/A` là *không thấy mã*.',
      'Muốn xem thêm bài trên LMS: ⟦go:/student#materials|Mở Video học⟧',
      'Bạn đang dò mã ở cột nào?',
    ].join('\n');
  }
  if (t === 'cách sử dụng hàm if') {
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

function buildWelcomeMessage(userRole, userName) {
  const name = String(userName || '').trim();
  if (isTeacherRole(userRole)) {
    const who = name ? `Thầy/Cô ${name}` : 'Thầy/Cô';
    return `Xin chào ${who}! Em là Trợ lý AI Tin Học của Thắng Tin Học. Em hỗ trợ Word, Excel, PowerPoint, MOS, LMS và giảng dạy. Thầy/Cô hỏi gì ạ?`;
  }
  const who = name || 'bạn';
  return `Xin chào ${who}! Mình là Trợ lý AI Tin Học của Thắng Tin Học. Mình hỗ trợ Word, Excel, PowerPoint, MOS, LMS và học tập. Bạn hỏi gì về tin học cũng được nhé!`;
}

function buildSupportSystemPrompt(userRole, userName, { ongoing = false } = {}) {
  const isTeacher = isTeacherRole(userRole);
  const roleLabel = isTeacher ? 'Giảng viên' : 'Học viên';
  const name = String(userName || '').trim() || (isTeacher ? 'Thầy/Cô' : 'Học viên');
  const address = isTeacher ? 'Thầy/Cô' : 'bạn';
  const greetingRule = ongoing
    ? 'ĐANG TRONG PHIÊN CHAT: đã chào ở tin đầu phiên. KHÔNG chào lại, KHÔNG viết "Xin chào/Chào [tên]", vào thẳng nội dung trả lời.'
    : 'Chỉ chào một lần duy nhất ở tin đầu phiên; các tin sau không chào lại.';
  return [
    `Bạn là giáo viên tin học văn phòng của Trung tâm Thắng Tin Học. Trả lời bằng tiếng Việt, xưng hô: ${address}.`,
    `Người đang chat ĐÃ ĐĂNG NHẬP: ${roleLabel} tên "${name}". Không hỏi vai trò, không hỏi chọn học viên/giảng viên.`,
    greetingRule,
    'Phạm vi: Word, Excel, PowerPoint, MOS, máy tính cơ bản, in ấn/mạng cơ bản, LMS Thắng Tin Học (đăng nhập, lịch, điểm danh, tài liệu, thi, bài tập), học phí hướng dẫn chung.',
    `Ngoài phạm vi (luật, y tế, nấu ăn, chính trị, chuyện không liên quan tin học/LMS): trả đúng câu "${OUT_OF_SCOPE_REPLY}" rồi dừng.`,
    'Không hứa hoàn tiền, không đổi điểm, không tiết lộ mật khẩu.',
    'Không tạo, không vẽ, không sinh hình ảnh; không nhắc công cụ AI tạo ảnh. Chỉ xem ảnh người dùng gửi (màn hình Office). Nếu họ yêu cầu tạo ảnh: trả đúng câu "' + IMAGE_GEN_REFUSE + '" rồi dừng.',
    'Không viết hộ tiểu luận, báo cáo, công văn, văn bản hành chính. Nếu họ yêu cầu viết hộ những loại đó: trả đúng câu "' + GHOSTWRITE_REFUSE + '" rồi dừng.',
    'Học viên mới: làm hộ thao tác tin học được — công thức Excel điền sẵn, từng bước Word/PowerPoint/LMS, sửa lỗi trên ảnh màn hình.',
    'Không nhắc, không mô tả, không bảo bấm nút (Gặp nhân viên, Cần nhân viên, biểu tượng hỗ trợ). Không in chữ "Lịch sử" hay "Câu hỏi mới".',
    'CÁCH TRẢ LỜI: đầy đủ, dạy được luôn. Không sơ sài, không cắt giữa danh sách. Câu hỏi dạng "học những gì / hàm nào / thao tác nào" thì liệt kê HẾT nhóm phổ biến, mỗi mục 1–2 dòng.',
    'Mỗi mục: tên + cú pháp hoặc vị trí Ribbon (thẻ > nhóm > lệnh) + ví dụ ngắn. Kết thúc trọn ý, có thể thêm 1 mẹo cuối.',
    'PHÂN BIỆT DANH SÁCH: Hướng dẫn THAO TÁC (một luồng làm tuần tự: cách dùng hàm, cách xếp lịch, cách vào menu) → **Bước 1:** **Bước 2:** … Không viết 1. 2. 3. Liệt kê MỤC / PHƯƠNG ÁN / LỘ TRÌNH / GIẢI THÍCH (nhiều hàm, nhiều cách, lộ trình học) → dùng 1. 2. 3. Không viết "Bước". Ví dụ how-to: "**Bước 1:** Vào tab Data...". Ví dụ liệt kê: "1. COUNT — đếm số. 2. COUNTA — đếm ô không trống."',
    'Không dùng markdown heading (##). Đậm/nghiêng/hàm: **đậm** cho bước và từ khóa (menu, nút, kết quả), *nghiêng* cho ghi chú/cảnh báo, `SUMIF` cho tên hàm. Bảng dữ liệu Excel: markdown table | cột | cột |, có dòng | --- | --- |. Không viết "Dòng 1: A | B".',
    'KIẾN THỨC NỀN — Excel: COUNT, COUNTA, COUNTBLANK, COUNTIF, COUNTIFS, SUM, SUMIF, SUMIFS, AVERAGE, AVERAGEIF, AVERAGEIFS, MAX, MIN, MEDIAN, MODE, LARGE, SMALL, RANK, STDEV.S; IF, IFS, AND, OR, IFERROR; VLOOKUP, XLOOKUP, INDEX, MATCH; tham chiếu A1 vs $A$1; bảng Excel (Ctrl+T); PivotTable; biểu đồ; lọc/sắp xếp; Data Validation; Conditional Formatting; Text to Columns.',
    'KIẾN THỨC NỀN — Word: Styles (Heading 1/2/3), mục lục, ngắt trang/section, Header/Footer, số trang, lề/khổ giấy, mail merge, bảng, bọc chữ ảnh, Find/Replace, Track Changes.',
    'KIẾN THỨC NỀN — PowerPoint: layout, theme, Slide Master, transition, animation, SmartArt, biểu đồ, Presenter View, Notes, xuất PDF.',
    'KIẾN THỨC NỀN — MOS: làm đúng thao tác đề (Word/Excel/PowerPoint Associate). Máy tính: File Explorer, copy/cut, USB, in, WiFi cơ bản.',
    'Khi người dùng gửi ảnh: xem ảnh rồi trả lời. Nếu là màn hình Word/Excel/PowerPoint, đề bài, hoặc lỗi — mô tả ngắn những gì thấy và hướng dẫn từng bước. Không bịa chi tiết không có trong ảnh.',
  ].join('\n');
}

/** Chat messages cho Gemini — tách system / user / assistant, không nhét prompt admin. */
function buildSupportMessages(history, userRole, userName) {
  const ongoing = isOngoingConversation(history);
  const messages = [{ role: 'system', content: buildSupportSystemPrompt(userRole, userName, { ongoing }) }];
  const rows = (history || [])
    .filter((m) => {
      const t = String(m.messageType || 'text');
      return (t === 'text' || t === 'image')
        && String(m.content || '').trim()
        && !isEscalationMessage(m)
        && !isIdlePingMessage(m)
        && !isIdleEndMessage(m)
        && !isIdleStillHereMessage(m);
    })
    .slice(-12);

  for (const m of rows) {
    let text = String(m.content).trim().slice(0, 1500);
    if (m.messageType === 'image' && (!text || text === '[Hình ảnh]')) {
      text = 'Người dùng gửi một hình ảnh.';
    }
    if (!text) continue;
    if (isBotLeakText(text)) continue;
    const isBot = String(m.senderId) === AI_PEER_ID;
    messages.push({ role: isBot ? 'assistant' : 'user', content: text });
  }

  // Gemini cần tin user cuối — nếu history rỗng vẫn có placeholder
  if (!messages.some((x) => x.role === 'user')) {
    messages.push({ role: 'user', content: 'Xin chào' });
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
  if (t.length > 5500) return t.slice(0, 5500).trim();
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
        maxTokens: 2500,
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
    content: String(content || '').trim().slice(0, 6000),
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
      content: IDLE_STILL_HERE,
      io,
      notifyUser,
    });
  }

  if (isSimpleGreeting(userText) && !imageFileUrl) {
    sessionDoc.consecutiveAiFailures = 0;
    await sessionDoc.save();
    const history = await loadThreadMessages(conversationId, 8);
    const lastBot = [...history].reverse().find((m) => (
      String(m.senderId) === AI_PEER_ID
      && String(m.messageType || 'text') !== 'system'
    ));
    if (lastBot && isWelcomeMessage(lastBot)) return lastBot;
    return persistBotReply({
      conversationId,
      humanUserId,
      humanRole,
      humanName,
      content: buildWelcomeMessage(humanRole, humanName),
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
      content: IMAGE_GEN_REFUSE,
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
      content: GHOSTWRITE_REFUSE,
      io,
      notifyUser,
    });
  }

  const faq = teacherFaqReply(humanRole, userText)
    || studentFaqReply(humanRole, userText);
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
      content: questionLimitReply(q.limit),
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
      content: BUSY_REPLY,
      io,
      notifyUser,
    });
  }

  emitTyping(io, { conversationId, userId: humanUserId, show: true });
  await new Promise((r) => setTimeout(r, TYPING_MS));

  try {
    const history = await loadThreadMessages(conversationId);
    const messages = buildSupportMessages(history, humanRole, humanName);
    const ongoing = isOngoingConversation(history);
    const images = [];
    if (imageFileUrl) {
      const inline = loadInlineImage(imageFileUrl);
      if (inline) images.push(inline);
      const hasUser = messages.some((x) => x.role === 'user');
      if (!hasUser) {
        messages.push({
          role: 'user',
          content: 'Mình gửi ảnh này, xem giúp mình với.',
        });
      }
    }
    const result = await callSupportLlm(messages, { images });
    const text = sanitizeSupportReply(result?.content, { stripGreeting: ongoing }) || EMPTY_REPLY;
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
    sessionDoc.consecutiveAiFailures = Number(sessionDoc.consecutiveAiFailures || 0) + 1;
    await sessionDoc.save();
    return await persistBotReply({
      conversationId,
      humanUserId,
      humanRole,
      humanName,
      content: BUSY_REPLY,
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

const ESCALATE_TEXT = 'Đã chuyển yêu cầu tới nhân viên hỗ trợ. Bạn có thể tiếp tục nhắn trong cuộc trò chuyện này — nhân viên sẽ nhận toàn bộ nội dung đã trao đổi.';

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

module.exports = {
  AI_PEER_ID,
  AI_PEER_NAME,
  AI_SUPPORT_STATUS,
  HANDOFF_REASONS,
  isAiSupportEnabled,
  aiSupportConfigured,
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
};
