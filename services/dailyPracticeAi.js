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

function buildMessages(topic, difficulty, types, count) {
  const schemas = types.map((type) => TYPE_SCHEMA[type]).join('\n');
  return [
    {
      role: 'system',
      content: [
        'Bạn là giáo viên tin học văn phòng tại Việt Nam, soạn câu hỏi luyện tập dạng trò chơi cho học viên.',
        'Chỉ trả về JSON {"questions":[...]} — không giải thích thêm.',
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
      content: `Chủ đề: ${topic.name}${topic.description ? ` — ${topic.description}` : ''}\nĐộ khó: ${DIFFICULTY_LABEL[difficulty]}\nSố câu: ${count}\nDạng câu được dùng: ${types.join(', ')} (trộn đều các dạng).`,
    },
  ];
}

/** AI soạn nháp câu hỏi (status draft) — admin duyệt rồi mới xuất bản cho học viên. */
async function generateDrafts({ topicId, difficulty, types, count, unitId } = {}, userId = null) {
  if (!mongoose.Types.ObjectId.isValid(String(topicId || ''))) throw httpError(400, 'Chủ đề không hợp lệ');
  if (!rules.DIFFICULTIES.includes(difficulty)) throw httpError(400, 'Độ khó không hợp lệ');
  const wanted = (Array.isArray(types) ? types : []).filter((type) => rules.TYPES.includes(type));
  const useTypes = wanted.length ? wanted : rules.TYPES;
  const total = Math.min(MAX_COUNT, Math.max(1, Math.floor(Number(count) || 5)));
  const topic = await DailyPracticeTopic.findById(topicId).lean();
  if (!topic) throw httpError(404, 'Không tìm thấy chủ đề');
  const targetUnitId = await resolveQuestionUnit(topic._id, unitId);
  if (!isAiConfigured()) throw httpError(503, 'Trợ lý AI chưa được cấu hình');

  const { getSupportModelFallbacks } = require('./aiSupportService');
  let lastErr = null;
  for (const model of getSupportModelFallbacks()) {
    try {
      const result = await chatCompletion({
        messages: buildMessages(topic, difficulty, useTypes, total),
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

module.exports = { generateDrafts, buildMessages, parseJsonLoose };
