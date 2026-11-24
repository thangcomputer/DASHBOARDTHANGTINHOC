'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const DailyPracticeTopic = require('../models/DailyPracticeTopic');
const DailyPracticeQuestion = require('../models/DailyPracticeQuestion');
const rules = require('./dailyPracticeRules');
const { resolveQuestionUnit } = require('./dailyPracticePathService');
const { isAiConfigured, chatCompletion } = require('./ai/llmClient');
const { getModelProfile, isComplexQuery } = require('./ai/modelRouter');
const { classifySecurityRisk, classifyItDomainScope } = require('./ai/knowledgeSearchService');
const cache = require('../utils/cache');
const logger = require('../config/logger');

const { httpError } = rules;
const MAX_COUNT = 10;
const DIFFICULTY_LABEL = { easy: 'dễ (người mới bắt đầu)', medium: 'trung bình', hard: 'khó (nâng cao)' };

const LESSON_AI_CACHE_TTL_SEC = Math.max(300, Number(process.env.AI_LESSON_CACHE_TTL_SEC) || 6 * 3600);
const PLACEMENT_AI_CACHE_TTL_SEC = Math.max(600, Number(process.env.AI_PLACEMENT_CACHE_TTL_SEC) || 24 * 3600);

const GUARD_REPLIES = {
  security: {
    vi: 'Yêu cầu này nằm ngoài phạm vi hỗ trợ an toàn của DewSkill AI. Mình không thể tiết lộ cấu hình hệ thống, thông tin bảo mật, tài khoản nội bộ hoặc bỏ qua quy tắc vận hành.',
    en: 'This request is outside my scope of safe support with DewSkill AI. I cannot reveal system prompts, secrets, internal credentials, or bypass safety rules.',
  },
  platformMeta: {
    vi: 'Mình hỗ trợ học Tin học, Office và cách dùng LMS trong bài học. Mình không trả lời về mã nguồn, đường dẫn kỹ thuật, công nghệ nền hay bảo mật nội bộ của web DewSkill / Thắng Tin Học.',
    en: 'I help with digital skills, Office, and learning within the LMS. I cannot discuss source code, internal URLs, underlying tech stack, or internal security of DewSkill / Thang Tin Hoc.',
  },
  outOfScope: {
    vi: 'Mình là DewSkill AI, trợ lý chuyên về Tin học văn phòng và Công nghệ thông tin tại Thắng Tin Học. Câu hỏi này hiện nằm ngoài phạm vi hỗ trợ của bài học.',
    en: 'I am DewSkill AI, an IT and Digital Skills assistant at Thang Tin Hoc. This question is currently outside the scope of this lesson.',
  },
};

let quickMemoryPromise = null;
async function getQuickMemoryMatcher() {
  if (!quickMemoryPromise) {
    quickMemoryPromise = import('../shared/ai/quickSearchMemory.mjs')
      .then((mod) => mod?.matchLocalOfficeMemory || null)
      .catch(() => null);
  }
  return quickMemoryPromise;
}

const LESSON_DEICTIC_CONTEXT_RE = /(?:video\s*này|bài\s*này|bước\s*này|mục\s*này|đang\s*xem|phút\s*thứ|giây\s*thứ|trong\s*bài|mốc\s*này|this\s*video|this\s*lesson)/i;

const TYPE_SCHEMA = {
  mcq: '{"type":"mcq","prompt":"...","options":["A","B","C","D"],"correctIndex":0,"hint":"...","explanation":"..."}',
  truefalse: '{"type":"truefalse","prompt":"Một phát biểu để đánh giá Đúng/Sai","answerBool":true,"hint":"...","explanation":"..."}',
  order: '{"type":"order","prompt":"Sắp xếp các bước ...","items":["bước 1","bước 2","bước 3","bước 4"],"hint":"...","explanation":"..."}',
  match: '{"type":"match","prompt":"Ghép ... với ...","pairs":[{"left":"Ctrl + C","right":"Sao chép"}],"hint":"...","explanation":"..."}',
  fill: '{"type":"fill","prompt":"Kéo từ thích hợp vào chỗ trống","text":"Nhấn {{Ctrl}} + {{S}} để lưu tài liệu","distractors":["Alt","P"],"hint":"...","explanation":"..."}',
  sort: '{"type":"sort","prompt":"Phân loại ...","groups":[{"name":"Phần cứng","items":["Chuột","RAM"]},{"name":"Phần mềm","items":["Word","Windows"]}],"hint":"...","explanation":"..."}',
};

function parseJsonLoose(text) {
  const raw = String(text || '').trim();
  try { return JSON.parse(raw); } catch { /* tiếp */ }
  const match = raw.match(/[[{][\s\S]*[\]}]/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function buildMessages(topic, difficulty, types, count, forTestOut = false) {
  const schemas = types.map((type) => TYPE_SCHEMA[type]).join('\n');
  const testOutNote = forTestOut
    ? '\nMục tiêu: Bộ câu hỏi tổng hợp cho bài Kiểm tra vượt chặng (đánh giá tổng quát kiến thức trọng tâm của chặng).'
    : '';
  return [
    {
      role: 'system',
      content: [
        'Bạn là giáo viên tin học văn phòng tại Việt Nam, soạn câu hỏi luyện tập dạng trò chơi cho học viên.',
        'Chỉ trả về JSON {"questions":[...]} - không giải thích thêm.',
        'Mọi nội dung bằng tiếng Việt có dấu, ngắn gọn, chính xác về kiến thức, phù hợp phiên bản phổ biến (Windows 10/11, Office 2016+).',
        'Mỗi câu có "hint" (gợi ý không lộ thẳng đáp án) và "explanation" (giải thích ngắn vì sao đúng).',
        'Với "fill": chỗ trống viết dạng {{từ}} ngay trong "text" (1–4 chỗ trống), "distractors" là từ gây nhiễu không trùng đáp án.',
        'Với "order": 3–6 bước theo đúng thứ tự. Với "match": 3–5 cặp. Với "sort": 2–3 nhóm, tổng tối đa 8 mục, không trùng nhau.',
        'Với "mcq": 4 phương án không trùng, correctIndex là vị trí đáp án đúng (0-based), phân bố ngẫu nhiên.',
        'Dạng mẫu cho từng loại:',
        schemas,
      ].join('\n'),
    },
    {
      role: 'user',
      content: `Chủ đề: ${topic.name}${topic.description ? ` - ${topic.description}` : ''}${testOutNote}\nĐộ khó: ${DIFFICULTY_LABEL[difficulty]}\nSố câu: ${count}\nDạng câu được dùng: ${types.join(', ')} (trộn đều các dạng).`,
    },
  ];
}

/** AI soạn nháp câu hỏi (status draft) - admin duyệt rồi mới xuất bản cho học viên. */
async function generateDrafts({ topicId, difficulty, types, count, unitId, forTestOut = false } = {}, userId = null) {
  if (!mongoose.Types.ObjectId.isValid(String(topicId || ''))) throw httpError(400, 'Chủ đề không hợp lệ');
  if (!rules.DIFFICULTIES.includes(difficulty)) throw httpError(400, 'Độ khó không hợp lệ');
  const wanted = (Array.isArray(types) ? types : []).filter((type) => rules.TYPES.includes(type));
  const useTypes = wanted.length ? wanted : rules.TYPES;
  const total = Math.min(MAX_COUNT, Math.max(1, Math.floor(Number(count) || 5)));
  const topic = await DailyPracticeTopic.findById(topicId).lean();
  if (!topic) throw httpError(404, 'Không tìm thấy chủ đề');
  const targetUnitId = await resolveQuestionUnit(topic._id, unitId);
  const testOutFlag = Boolean(targetUnitId && forTestOut === true);
  if (!isAiConfigured()) throw httpError(503, 'Trợ lý AI chưa được cấu hình');

  const profile = getModelProfile('admin_quiz', {
    maxTokens: Math.min(3600, 500 + total * 320),
  });
  let lastErr = null;
  for (const model of profile.models) {
    try {
      const result = await chatCompletion({
        messages: buildMessages(topic, difficulty, useTypes, total, testOutFlag),
        model,
        temperature: profile.temperature,
        maxTokens: profile.maxTokens,
        thinkingBudget: profile.thinkingBudget,
        timeoutMs: profile.timeoutMs,
        responseFormat: 'json',
      });
      const parsed = parseJsonLoose(result?.content);
      const list = Array.isArray(parsed) ? parsed : parsed?.questions;
      if (!Array.isArray(list) || !list.length) {
        lastErr = new Error('empty');
        continue;
      }
      const docs = [];
      let skipped = 0;
      for (const raw of list.slice(0, total)) {
        try {
          const doc = rules.validateQuestion({ ...raw, difficulty });
          if (!useTypes.includes(doc.type)) throw new Error('type');
          docs.push({
            ...doc,
            topicId: topic._id,
            unitId: targetUnitId,
            forTestOut: testOutFlag,
            status: 'draft',
            source: 'ai',
            createdBy: mongoose.Types.ObjectId.isValid(String(userId || '')) ? userId : null,
          });
        } catch {
          skipped += 1;
        }
      }
      if (!docs.length) {
        lastErr = new Error('no valid questions');
        continue;
      }
      const created = await DailyPracticeQuestion.insertMany(docs);
      return { created: created.length, skipped, ids: created.map((q) => String(q._id)) };
    } catch (err) {
      lastErr = err;
      logger.warn({ model, err: err.message }, '[DAILY_PRACTICE] AI generate model failed');
    }
  }
  logger.warn({ err: lastErr?.message }, '[DAILY_PRACTICE] AI generate failed');
  throw httpError(502, 'AI chưa tạo được câu hỏi hợp lệ, vui lòng thử lại');
}

function detectLessonQuestionLang(cleanQuestion, safeHistory = []) {
  try {
    const { detectQueryLanguage } = require('./aiSupportService');
    if (typeof detectQueryLanguage === 'function') {
      return detectQueryLanguage(cleanQuestion, safeHistory);
    }
  } catch { /* fallback below */ }
  const VI_DIACRITIC_RE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
  if (!cleanQuestion || VI_DIACRITIC_RE.test(cleanQuestion)) return 'vi';
  if (/\b(xin chao|chao ban|la gi|nhu the nao|cach dung|huong dan|bai tap|trac nghiem|hoc vien|phan mem)\b/i.test(cleanQuestion)) return 'vi';
  return /\b(hello|hi|hey|what|how|why|where|when|who|which|can|could|would|should|do|does|did|is|are|was|were|please|help|explain|tell|show|guide|use|using|formula|function|difference|between|example|error|fix|schedule|class|course|lesson|video|exam|quiz|score|in|of|for|to|with|from|about|the|and|or)\b/i.test(cleanQuestion)
    ? 'en'
    : 'vi';
}

/**
 * Trợ lý AI hỏi đáp trong bài học / video: dùng chung hạn mức % AI hằng ngày với DewSkill AI
 * (khóa cứng khi đã dùng hết 100%, trừ % khi trả lời từ memory/cache/AI, hoàn % nếu Gemini lỗi).
 */
async function askLessonAssistant({
  question = '',
  lessonTitle = '',
  unitTitle = '',
  courseTitle = '',
  history = [],
  user = null,
  _quotaAdapter = null,
} = {}) {
  const cleanQuestion = String(question || '').trim().slice(0, 1000);
  if (!cleanQuestion) throw httpError(400, 'Vui lòng nhập câu hỏi');

  const safeHistory = (Array.isArray(history) ? history : [])
    .slice(-4)
    .map((m) => ({
      role: m?.role === 'user' ? 'user' : 'assistant',
      content: String(m?.body || m?.content || '').trim().slice(0, 700),
    }))
    .filter((m) => m.content);

  const lang = detectLessonQuestionLang(cleanQuestion, safeHistory);
  const isEn = lang === 'en';

  const aiQuotaMod = _quotaAdapter ? null : require('./aiSupportService');
  const quotaCtx = _quotaAdapter
    ? await _quotaAdapter.open(user)
    : await aiQuotaMod.openSharedAiQuotaContext(user);

  const buildQuotaSnapshot = () => {
    if (!quotaCtx?.applies) return {};
    if (_quotaAdapter) {
      return {
        questionQuota: _quotaAdapter.peekQuestionQuota(quotaCtx.sessionDoc, quotaCtx.quotaUser),
        imageQuota: _quotaAdapter.peekImageQuota(quotaCtx.sessionDoc, quotaCtx.quotaUser),
      };
    }
    return {
      questionQuota: aiQuotaMod.peekQuestionQuota(quotaCtx.sessionDoc, quotaCtx.quotaUser),
      imageQuota: aiQuotaMod.peekImageQuota(quotaCtx.sessionDoc, quotaCtx.quotaUser),
    };
  };

  const makeQuotaBlockedError = () => {
    if (_quotaAdapter && typeof _quotaAdapter.buildQuotaError === 'function') {
      return _quotaAdapter.buildQuotaError(quotaCtx.sessionDoc, quotaCtx.quotaUser, lang);
    }
    if (aiQuotaMod && typeof aiQuotaMod.buildAiQuotaError === 'function') {
      return aiQuotaMod.buildAiQuotaError(quotaCtx.sessionDoc, quotaCtx.quotaUser, lang);
    }
    const snap = buildQuotaSnapshot();
    const err = httpError(403, isEn
      ? 'You have used 100% of your AI quota today. Please wait until daily reset to continue.'
      : 'Bạn đã dùng hết 100% hạn mức AI hôm nay. Hạn mức sẽ tự động làm mới vào 00:00.');
    err.code = 'AI_QUESTION_QUOTA';
    if (snap.questionQuota) err.questionQuota = snap.questionQuota;
    if (snap.imageQuota) err.imageQuota = snap.imageQuota;
    return err;
  };

  // Kiểm tra khóa cứng ngay tại 0% trước mọi nhánh (bao gồm chào hỏi / memory / cache / Gemini)
  if (quotaCtx?.applies) {
    const initialSnap = buildQuotaSnapshot();
    if (initialSnap.questionQuota?.applies && !(Number(initialSnap.questionQuota?.percentLeft) > 0)) {
      throw makeQuotaBlockedError();
    }
  }

  let consumedBudgetBp = 0;
  const consumeQuotaTurn = async () => {
    if (!quotaCtx?.applies) return {};
    const q = _quotaAdapter
      ? await _quotaAdapter.consume(quotaCtx.sessionDoc, quotaCtx.quotaUser, { text: cleanQuestion })
      : await aiQuotaMod.consumeAiBudgetQuota(quotaCtx.sessionDoc, quotaCtx.quotaUser, { text: cleanQuestion });
    if (q?.blocked) {
      throw makeQuotaBlockedError();
    }
    consumedBudgetBp = q?.applies ? (Number(q.consumedBp) || 0) : 0;
    return buildQuotaSnapshot();
  };

  const refundQuotaTurn = async () => {
    if (!quotaCtx?.applies || !(consumedBudgetBp > 0) || !quotaCtx.sessionDoc) return;
    try {
      if (_quotaAdapter && typeof _quotaAdapter.refund === 'function') {
        await _quotaAdapter.refund(quotaCtx.sessionDoc, consumedBudgetBp);
      } else if (aiQuotaMod && typeof aiQuotaMod.refundAiBudgetQuota === 'function') {
        await aiQuotaMod.refundAiBudgetQuota(quotaCtx.sessionDoc, consumedBudgetBp);
      }
      consumedBudgetBp = 0;
    } catch { /* ignore refund failure */ }
  };

  // 1. Security gate (0 token)
  const securityGate = classifySecurityRisk(cleanQuestion);
  if (securityGate.blocked) {
    return {
      answer: isEn ? GUARD_REPLIES.security.en : GUARD_REPLIES.security.vi,
      model: 'policy-guard',
      source: 'security_guard',
      ...buildQuotaSnapshot(),
    };
  }

  // 2. 3-state Domain Scope filter (0 token for clear out-of-scope / platform-meta)
  const scopeCheck = classifyItDomainScope(cleanQuestion, safeHistory);
  if (scopeCheck.decision === 'OUT_OF_SCOPE') {
    if (scopeCheck.reason === 'platform_meta') {
      return {
        answer: isEn ? GUARD_REPLIES.platformMeta.en : GUARD_REPLIES.platformMeta.vi,
        model: 'scope-guard',
        source: 'scope_guard',
        ...buildQuotaSnapshot(),
      };
    }
    return {
      answer: isEn ? GUARD_REPLIES.outOfScope.en : GUARD_REPLIES.outOfScope.vi,
      model: 'scope-guard',
      source: 'scope_guard',
      ...buildQuotaSnapshot(),
    };
  }

  // 3. Zero-token Office quick memory for standalone short formula/shortcut queries
  const wordCount = cleanQuestion.split(/\s+/).filter(Boolean).length;
  if (safeHistory.length === 0 && wordCount <= 5 && !LESSON_DEICTIC_CONTEXT_RE.test(cleanQuestion)) {
    const matchLocalOfficeMemory = await getQuickMemoryMatcher();
    const memoryHit = typeof matchLocalOfficeMemory === 'function'
      ? matchLocalOfficeMemory(cleanQuestion, lang)
      : null;
    if (memoryHit?.answer) {
      const turnQuota = await consumeQuotaTurn();
      return {
        answer: memoryHit.answer,
        model: 'quick-memory',
        source: 'memory',
        ...turnQuota,
      };
    }
  }

  // 4. Shared cache lookup (keyed by lessonTitle, unitTitle, lang, normalized question) when single-turn
  const normalizedQ = cleanQuestion.toLowerCase().replace(/\s+/g, ' ').trim();
  const canUseCache = safeHistory.length === 0 && normalizedQ.length >= 3;
  const cacheKey = canUseCache
    ? `lesson_ai:v1:${crypto.createHash('sha256').update(`${lang}|${String(lessonTitle || '').trim()}|${String(unitTitle || '').trim()}|${normalizedQ}`).digest('hex').slice(0, 32)}`
    : '';
  if (cacheKey) {
    try {
      const cached = await cache.get(cacheKey);
      if (cached && cached.answer) {
        const turnQuota = await consumeQuotaTurn();
        return {
          answer: cached.answer,
          model: cached.model || 'cache',
          source: 'cache',
          ...turnQuota,
        };
      }
    } catch (cacheErr) {
      if (cacheErr?.code === 'AI_QUESTION_QUOTA') throw cacheErr;
      /* fallback to LLM */
    }
  }

  if (!isAiConfigured()) throw httpError(503, 'Trợ lý AI chưa được cấu hình API key trên máy chủ');

  const contextParts = isEn
    ? [
      courseTitle ? `Course/Topic: ${String(courseTitle).trim().slice(0, 160)}` : '',
      unitTitle ? `Unit/Chapter: ${String(unitTitle).trim().slice(0, 160)}` : '',
      lessonTitle ? `Current Lesson: ${String(lessonTitle).trim().slice(0, 160)}` : '',
    ].filter(Boolean)
    : [
      courseTitle ? `Khóa học/Chủ đề: ${String(courseTitle).trim().slice(0, 160)}` : '',
      unitTitle ? `Chặng/Chương: ${String(unitTitle).trim().slice(0, 160)}` : '',
      lessonTitle ? `Bài học đang xem: ${String(lessonTitle).trim().slice(0, 160)}` : '',
    ].filter(Boolean);

  const systemPrompt = isEn
    ? [
      'You are DewSkill AI, the Office IT & Digital Skills Assistant at Thang Tin Hoc.',
      'Task: help the student understand the current lesson and IT concepts (Windows 10/11, Microsoft Word, Excel, PowerPoint, MOS/IC3/GMetrix, shortcuts, and hands-on workflows).',
      'CRITICAL LANGUAGE RULE: The student is asking in English. Write your ENTIRE response 100% in clear, natural English.',
      'Markdown formatting rules for readability on dark backgrounds:',
      '- Open with 1–2 concise sentences directly answering the core question.',
      '- Use `###` headings with helpful icons (e.g., `### 🔍 Key Cause`, `### 🛠️ Step-by-Step Fix`, `### 📊 Quick Reference`).',
      '- Use **bold (`**...**`)** for UI buttons, menu paths, important keywords, and step labels.',
      '- Use `` `backtick` `` for Excel formulas, keyboard shortcuts (`Ctrl + S`), commands (`sfc /scannow`), or errors (`#N/A`).',
      '- Prefer **Markdown Tables** (`| ... | ... |`) when comparing options or listing cause/fix pairs.',
      '- Use blockquotes `> 💡 **Tip:** ...` or `> ⚠️ **Note:** ...` for helpful tips and warnings.',
      '- Politely decline questions unrelated to studying or Office IT and guide back to the lesson.',
      contextParts.length ? `Current lesson context:\n${contextParts.join('\n')}` : '',
    ].filter(Boolean).join('\n')
    : [
      'Bạn là DewSkill AI — Trợ giảng AI chuyên về Tin học và Công nghệ thông tin của Trung tâm Thắng Tin Học.',
      'Nhiệm vụ: giải đáp thắc mắc của học viên về bài học đang xem và kiến thức Tin học văn phòng / CNTT (Windows 10/11, Microsoft Word, Excel, PowerPoint, MOS/IC3/GMetrix, phím tắt, thao tác thực hành).',
      'NGÔN NGỮ: Mặc định trả lời hoàn toàn bằng tiếng Việt có dấu (kể cả khi câu hỏi không dấu hoặc chứa thuật ngữ tiếng Anh). Chỉ trả lời tiếng Anh khi người dùng hỏi hoàn toàn bằng tiếng Anh hoặc chủ động yêu cầu.',
      'Quy tắc trình bày Markdown để hiển thị đẹp, dễ đọc trên giao diện tối:',
      '- Mở đầu ngắn gọn 1–2 câu đi thẳng vào vấn đề.',
      '- Dùng tiêu đề `###` kèm 1 icon phù hợp (ví dụ: `### 🔍 Nguyên nhân chính`, `### 🛠️ Cách khắc phục từng bước`, `### 📊 Bảng tra nhanh`).',
      '- **In đậm (`**...**`)** cho tên nút bấm, mục menu, từ khóa quan trọng và tên bước.',
      '- *In nghiêng (`*...*`)* cho thuật ngữ tiếng Anh hoặc ghi chú bổ sung ngắn.',
      '- Dùng `` `backtick` `` cho công thức Excel, phím tắt (`Ctrl + S`), tên lệnh (`sfc /scannow`) hoặc mã lỗi (`#N/A`).',
      '- Khi liệt kê cặp Nguyên nhân – Cách xử lý, so sánh tính năng, hoặc tổng hợp hàm/phím tắt, hãy ưu tiên trình bày bằng **Bảng Markdown** (`| ... | ... |`).',
      '- Dùng khối trích dẫn `> 💡 **Mẹo:** ...` hoặc `> ⚠️ **Lưu ý:** ...` cho cảnh báo hoặc mẹo quan trọng.',
      '- Câu văn ngắn gọn, tách ý rõ ràng, không viết đoạn văn dài đặc chữ.',
      'Nếu câu hỏi hoàn toàn không liên quan đến học tập/tin học, hãy từ chối lịch sự và hướng học viên quay lại nội dung bài học.',
      contextParts.length ? `Ngữ cảnh bài học hiện tại:\n${contextParts.join('\n')}` : '',
    ].filter(Boolean).join('\n');

  const messages = [
    { role: 'system', content: systemPrompt },
    ...safeHistory,
    { role: 'user', content: cleanQuestion },
  ];

  const turnQuota = await consumeQuotaTurn();

  const profile = isComplexQuery(cleanQuestion)
    ? getModelProfile('qa_complex', { maxTokens: 1500 })
    : getModelProfile('lesson_assistant', { maxTokens: 1200 });

  let lastErr = null;
  for (let i = 0; i < profile.models.length; i += 1) {
    const model = profile.models[i];
    try {
      const result = await chatCompletion({
        messages,
        model,
        temperature: 0.35,
        maxTokens: profile.maxTokens,
        thinkingBudget: profile.thinkingBudget,
        timeoutMs: i === 0 ? profile.timeoutMs : Math.min(24000, profile.timeoutMs + 4000),
      });
      const answer = String(result?.content || '').trim();
      if (answer) {
        if (cacheKey && answer.length >= 25 && !/(nằm ngoài phạm vi|outside the scope|outside my scope)/i.test(answer)) {
          cache.set(cacheKey, { answer, model }, LESSON_AI_CACHE_TTL_SEC).catch(() => { });
        }
        return { answer, model, source: 'ai', ...turnQuota };
      }
    } catch (err) {
      lastErr = err;
      logger.warn({ model, err: err.message }, '[DAILY_PRACTICE] lesson AI assistant failed');
    }
  }

  await refundQuotaTurn();
  logger.warn({ err: lastErr?.message }, '[DAILY_PRACTICE] lesson AI assistant exhausted fallbacks');
  throw httpError(503, 'Trợ lý AI đang bận hoặc chưa kết nối được, bạn thử lại sau ít giây nhé.');
}

const PLACEMENT_LEVELS = new Set(['beginner', 'some', 'advanced']);

/** AI phân tích kết quả bài kiểm tra đầu vào và gợi ý lộ trình cá nhân hóa. */
async function placementAdvice({
  score = 0,
  total = 10,
  bySkill = [],
  wrongTopics = [],
  surveyLevel = '',
  topics = [],
} = {}) {
  const safeTotal = Math.min(50, Math.max(1, Math.floor(Number(total) || 10)));
  const safeScore = Math.min(safeTotal, Math.max(0, Math.floor(Number(score) || 0)));
  const skills = (Array.isArray(bySkill) ? bySkill : []).slice(0, 8).map((row) => ({
    skill: String(row?.skill || '').trim().slice(0, 60),
    correct: Math.max(0, Math.floor(Number(row?.correct) || 0)),
    total: Math.max(1, Math.floor(Number(row?.total) || 1)),
  })).filter((row) => row.skill);
  const wrong = (Array.isArray(wrongTopics) ? wrongTopics : [])
    .slice(0, 10)
    .map((t) => String(t || '').trim().slice(0, 200))
    .filter(Boolean);
  const topicNames = (Array.isArray(topics) ? topics : [])
    .slice(0, 12)
    .map((t) => String(t || '').trim().slice(0, 80))
    .filter(Boolean);
  const level = PLACEMENT_LEVELS.has(String(surveyLevel)) ? String(surveyLevel) : '';

  const placementCacheKey = `placement_ai:v1:${crypto.createHash('sha256').update(JSON.stringify({
    score: safeScore,
    total: safeTotal,
    skills,
    wrong,
    level,
    topicNames,
  })).digest('hex').slice(0, 32)}`;

  try {
    const cached = await cache.get(placementCacheKey);
    if (cached && cached.summary) return cached;
  } catch { /* fallback to LLM */ }

  if (!isAiConfigured()) throw httpError(503, 'Trợ lý AI chưa được cấu hình API key trên máy chủ');

  const systemPrompt = [
    'Bạn là cố vấn học tập DewSkill AI (trung tâm Thắng Tin Học).',
    'Nhiệm vụ: phân tích kết quả bài kiểm tra đầu vào Tin học văn phòng và gợi ý lộ trình cá nhân hóa.',
    'Chỉ trả về JSON đúng dạng:',
    '{"levelLabel":"Cơ bản|Trung cấp|Nâng cao","summary":"1-2 câu nhận xét động viên","strengths":["..."],"focus":["..."],"plan":[{"title":"Tuần 1: ...","detail":"..."}],"recommendedTopic":"tên chủ đề nên học trước, ưu tiên chọn đúng 1 tên trong danh sách chủ đề có sẵn"}',
    'Quy tắc: tiếng Việt có dấu, xưng "bạn", giọng thân thiện chuyên nghiệp, ngắn gọn.',
    'strengths và focus mỗi mảng 1-3 ý ngắn; plan gồm 3 bước (3 tuần), mỗi detail tối đa 25 từ.',
    'Không bịa thêm điểm số, không thêm văn bản ngoài JSON.',
  ].join('\n');

  const userContent = [
    `Điểm: ${safeScore}/${safeTotal}`,
    skills.length ? `Theo kỹ năng: ${skills.map((s) => `${s.skill} ${s.correct}/${s.total}`).join('; ')}` : '',
    wrong.length ? `Các câu làm sai:\n- ${wrong.join('\n- ')}` : 'Không sai câu nào.',
    level ? `Học viên tự đánh giá: ${level === 'beginner' ? 'mới bắt đầu' : level === 'some' ? 'biết cơ bản' : 'đã có nền tảng'}` : '',
    topicNames.length ? `Danh sách chủ đề có sẵn: ${topicNames.join(', ')}` : '',
  ].filter(Boolean).join('\n');

  const profile = getModelProfile('placement_advice');
  let lastErr = null;
  for (let i = 0; i < profile.models.length; i += 1) {
    const model = profile.models[i];
    try {
      const result = await chatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        model,
        temperature: profile.temperature,
        maxTokens: profile.maxTokens,
        thinkingBudget: profile.thinkingBudget,
        timeoutMs: i === 0 ? profile.timeoutMs : Math.min(22000, profile.timeoutMs + 4000),
        responseFormat: 'json',
      });
      const parsed = parseJsonLoose(result?.content);
      if (!parsed || typeof parsed !== 'object' || !parsed.summary) {
        lastErr = new Error('invalid placement json');
        continue;
      }
      const list = (value, max) => (Array.isArray(value) ? value : [])
        .map((v) => String(v || '').trim().slice(0, 200))
        .filter(Boolean)
        .slice(0, max);
      const out = {
        levelLabel: String(parsed.levelLabel || '').trim().slice(0, 40),
        summary: String(parsed.summary || '').trim().slice(0, 500),
        strengths: list(parsed.strengths, 3),
        focus: list(parsed.focus, 3),
        plan: (Array.isArray(parsed.plan) ? parsed.plan : []).slice(0, 4).map((p) => ({
          title: String(p?.title || '').trim().slice(0, 80),
          detail: String(p?.detail || '').trim().slice(0, 240),
        })).filter((p) => p.title),
        recommendedTopic: String(parsed.recommendedTopic || '').trim().slice(0, 80),
        model,
      };
      cache.set(placementCacheKey, out, PLACEMENT_AI_CACHE_TTL_SEC).catch(() => { });
      return out;
    } catch (err) {
      lastErr = err;
      logger.warn({ model, err: err.message }, '[DAILY_PRACTICE] placement AI failed');
    }
  }
  logger.warn({ err: lastErr?.message }, '[DAILY_PRACTICE] placement AI exhausted fallbacks');
  throw httpError(503, 'AI đang bận, chưa phân tích được kết quả. Bạn thử lại sau ít giây nhé.');
}

module.exports = { generateDrafts, buildMessages, parseJsonLoose, askLessonAssistant, placementAdvice };
