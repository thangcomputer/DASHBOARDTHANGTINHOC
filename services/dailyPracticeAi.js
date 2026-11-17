'use strict';

const mongoose = require('mongoose');
const DailyPracticeTopic = require('../models/DailyPracticeTopic');
const DailyPracticeQuestion = require('../models/DailyPracticeQuestion');
const rules = require('./dailyPracticeRules');
const { resolveQuestionUnit } = require('./dailyPracticePathService');
const { isAiConfigured, chatCompletion } = require('./ai/llmClient');
const logger = require('../config/logger');

const { httpError } = rules;
const MAX_COUNT = 10;
const DIFFICULTY_LABEL = { easy: 'dễ (người mới bắt đầu)', medium: 'trung bình', hard: 'khó (nâng cao)' };

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

  const { getSupportModelFallbacks } = require('./aiSupportService');
  let lastErr = null;
  for (const model of getSupportModelFallbacks()) {
    try {
      const result = await chatCompletion({
        messages: buildMessages(topic, difficulty, useTypes, total, testOutFlag),
        model,
        temperature: 0.7,
        maxTokens: 4000,
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

/** Trợ lý AI hỏi đáp trong bài học / video (dùng Gemini/LLM đã cấu hình trên server). */
async function askLessonAssistant({
  question = '',
  lessonTitle = '',
  unitTitle = '',
  courseTitle = '',
  history = [],
} = {}) {
  const cleanQuestion = String(question || '').trim().slice(0, 1000);
  if (!cleanQuestion) throw httpError(400, 'Vui lòng nhập câu hỏi');
  if (!isAiConfigured()) throw httpError(503, 'Trợ lý AI chưa được cấu hình API key trên máy chủ');

  const contextParts = [
    courseTitle ? `Khóa học/Chủ đề: ${String(courseTitle).trim().slice(0, 160)}` : '',
    unitTitle ? `Chặng/Chương: ${String(unitTitle).trim().slice(0, 160)}` : '',
    lessonTitle ? `Bài học đang xem: ${String(lessonTitle).trim().slice(0, 160)}` : '',
  ].filter(Boolean);

  const systemPrompt = [
    'Bạn là Trợ lý AI Tin Học của trung tâm Thắng Tin Học.',
    'Nhiệm vụ: giải đáp thắc mắc của học viên về bài học đang xem và kiến thức Tin học văn phòng (Windows 10/11, Microsoft Word, Excel, PowerPoint, IC3, phím tắt, thao tác thực hành).',
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

  const safeHistory = (Array.isArray(history) ? history : [])
    .slice(-6)
    .map((m) => ({
      role: m?.role === 'user' ? 'user' : 'assistant',
      content: String(m?.body || m?.content || '').trim().slice(0, 1000),
    }))
    .filter((m) => m.content);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...safeHistory,
    { role: 'user', content: cleanQuestion },
  ];

  const { getSupportModelFallbacks } = require('./aiSupportService');
  let lastErr = null;
  for (const model of getSupportModelFallbacks()) {
    try {
      const result = await chatCompletion({
        messages,
        model,
        temperature: 0.4,
        maxTokens: 4096,
      });
      const answer = String(result?.content || '').trim();
      if (answer) return { answer, model };
    } catch (err) {
      lastErr = err;
      logger.warn({ model, err: err.message }, '[DAILY_PRACTICE] lesson AI assistant failed');
    }
  }

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
  if (!isAiConfigured()) throw httpError(503, 'Trợ lý AI chưa được cấu hình API key trên máy chủ');

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

  const systemPrompt = [
    'Bạn là cố vấn học tập AI của DewSkill Academy (trung tâm Thắng Tin Học).',
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

  const { getSupportModelFallbacks } = require('./aiSupportService');
  let lastErr = null;
  for (const model of getSupportModelFallbacks()) {
    try {
      const result = await chatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        model,
        temperature: 0.5,
        maxTokens: 1500,
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
      return {
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
    } catch (err) {
      lastErr = err;
      logger.warn({ model, err: err.message }, '[DAILY_PRACTICE] placement AI failed');
    }
  }
  logger.warn({ err: lastErr?.message }, '[DAILY_PRACTICE] placement AI exhausted fallbacks');
  throw httpError(503, 'AI đang bận, chưa phân tích được kết quả. Bạn thử lại sau ít giây nhé.');
}

module.exports = { generateDrafts, buildMessages, parseJsonLoose, askLessonAssistant, placementAdvice };
