'use strict';

/**
 * Adapter AI → form trắc nghiệm GV (LessonQuiz).
 * Không tạo/lưu quiz; chỉ sinh câu hỏi để giảng viên duyệt.
 */
const aiService = require('../../services/aiService');
const { isAiConfigured } = require('../../services/ai/llmClient');

const DEFAULT_COUNT = 10;
const MIN_COUNT = 5;
const MAX_COUNT = 15;

function clampCount(count) {
  const n = Number(count);
  if (!Number.isFinite(n)) return DEFAULT_COUNT;
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.round(n)));
}

function padOptions(options) {
  const list = (Array.isArray(options) ? options : []).map((o) => String(o || '').trim());
  while (list.length < 4) list.push('');
  return list.slice(0, 4);
}

function toLessonQuestion(q) {
  const correctRaw = q?.correctAnswer ?? q?.correct ?? 0;
  return {
    questionText: String(q?.questionText || q?.question || q?.text || '').trim(),
    options: padOptions(q?.options),
    correctAnswer: Math.min(3, Math.max(0, Number(correctRaw) || 0)),
    explanation: String(q?.explanation || '').trim(),
  };
}

function isUsable(q) {
  return Boolean(q.questionText) && q.options.filter(Boolean).length >= 4;
}

/**
 * @param {{ topic?: string, courseName?: string, count?: number, difficulty?: string }} opts
 */
async function generateForTeacher(opts = {}) {
  const count = clampCount(opts.count);
  const topic = String(opts.topic || '').trim();
  const subject = String(opts.courseName || opts.subject || 'Tin học văn phòng').trim();
  const difficulty = String(opts.difficulty || 'trung bình').trim();

  if (!topic) {
    const err = new Error('Vui lòng nhập chủ đề / tên bài để AI soạn câu hỏi');
    err.status = 400;
    err.code = 'AI_QUIZ_TOPIC_REQUIRED';
    throw err;
  }

  if (!isAiConfigured()) {
    const err = new Error(
      'VPS chưa cấu hình AI (thiếu GEMINI_API_KEYS / GEMINI_API_KEY hoặc AI_API_KEY trong .env). Thêm key rồi restart server, hoặc soạn tay.',
    );
    err.status = 503;
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }

  const result = await aiService.generateQuiz({
    topic: `${topic} (độ khó: ${difficulty})`,
    count,
    subject,
  });

  // Không cho GV nhận/lưu câu mẫu "Dap an A/B" khi Gemini lỗi hoặc thiếu key
  if (result.source === 'fallback') {
    const err = new Error(
      'AI không phản hồi (sai key, hết hạn mức, hoặc lỗi mạng). Kiểm tra GEMINI_API_KEY trên VPS rồi thử lại, hoặc soạn tay.',
    );
    err.status = 502;
    err.code = 'AI_QUIZ_FALLBACK';
    throw err;
  }

  const questions = (result.questions || [])
    .map(toLessonQuestion)
    .filter(isUsable)
    .slice(0, count);

  if (!questions.length) {
    const err = new Error('AI không tạo được câu hỏi hợp lệ. Thử lại hoặc soạn tay.');
    err.status = 502;
    err.code = 'AI_QUIZ_EMPTY';
    throw err;
  }

  return {
    questions,
    source: result.source || 'llm',
    model: result.model || null,
    configured: true,
    count: questions.length,
  };
}

module.exports = {
  DEFAULT_COUNT,
  MIN_COUNT,
  MAX_COUNT,
  clampCount,
  toLessonQuestion,
  generateForTeacher,
  isAiConfigured,
};
