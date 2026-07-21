/**
 * AI service — cong cu admin: quiz, notification draft, summarize, complete.
 */
const { isAiConfigured, getConfig, chatCompletion } = require('./ai/llmClient');
const logger = require('../config/logger');

const MAX_INPUT = 8000;

function clampText(s, max = MAX_INPUT) {
  return String(s || '').slice(0, max);
}

function parseJsonLoose(text) {
  const raw = String(text || '').trim();
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { /* fall */ }
    }
  }
  return null;
}

function getStatus() {
  const configured = isAiConfigured();
  const cfg = getConfig();
  return {
    configured,
    enabled: process.env.AI_ENABLED !== '0',
    model: configured ? cfg.model : null,
    baseUrl: configured ? cfg.baseUrl : null,
    features: ['quiz', 'notification', 'summarize', 'complete'],
  };
}

/** Fallback quiz khi chua co API key — demo co cau truc dung */
function fallbackQuiz({ topic, count, subject }) {
  const n = Math.min(10, Math.max(1, Number(count) || 5));
  const questions = [];
  for (let i = 1; i <= n; i++) {
    questions.push({
      question: '[' + (subject || 'Tin hoc') + '] ' + (topic || 'Kien thuc co ban') + ' — cau ' + i + '?',
      options: ['Dap an A', 'Dap an B', 'Dap an C', 'Dap an D'],
      correct: 0,
      explanation: 'Cau hoi mau (AI chua cau hinh). Hay dat AI_API_KEY de sinh that.',
    });
  }
  return { questions, source: 'fallback', model: null };
}

async function generateQuiz({ topic, count = 5, subject = 'Tin hoc van phong' } = {}) {
  const n = Math.min(10, Math.max(1, Number(count) || 5));
  const t = clampText(topic || subject, 200);
  if (!isAiConfigured()) return fallbackQuiz({ topic: t, count: n, subject });

  const system =
    'Ban la giao vien tin hoc. Tra ve JSON object: {"questions":[{"question":"...","options":["A","B","C","D"],"correct":0,"explanation":"..."}]}. ' +
    'correct la index 0-3. Tieng Viet, ro rang, phu hop hoc vien.';
  const user =
    'Sinh ' + n + ' cau trac nghiem mon "' + clampText(subject, 80) + '", chu de: ' + t;

  const result = await chatCompletion({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.5,
    maxTokens: 2000,
    responseFormat: 'json',
  });

  const parsed = parseJsonLoose(result.content);
  let questions = parsed?.questions || parsed;
  if (!Array.isArray(questions)) questions = [];
  questions = questions.slice(0, n).map((q) => ({
    question: String(q.question || q.text || '').slice(0, 500),
    options: Array.isArray(q.options) ? q.options.slice(0, 4).map((o) => String(o).slice(0, 200)) : [],
    correct: Math.min(3, Math.max(0, Number(q.correct) || 0)),
    explanation: String(q.explanation || '').slice(0, 400),
  })).filter((q) => q.question && q.options.length >= 2);

  if (!questions.length) {
    logger.warn('[AI] quiz parse empty, using fallback');
    return fallbackQuiz({ topic: t, count: n, subject });
  }
  return { questions, source: 'llm', model: result.model, usage: result.usage };
}

async function draftNotification({ purpose, audience = 'all', tone = 'professional' } = {}) {
  const p = clampText(purpose, 500);
  if (!p) {
    const err = new Error('Thieu purpose');
    err.status = 400;
    throw err;
  }
  if (!isAiConfigured()) {
    return {
      title: 'Thong bao: ' + p.slice(0, 60),
      content:
        'Kinh gui ' + audience + ',\n\n' + p + '\n\nTran trong,\nTrung tam Thang Tin Hoc',
      source: 'fallback',
      model: null,
    };
  }
  const result = await chatCompletion({
    messages: [
      {
        role: 'system',
        content:
          'Ban soan thong bao ngan cho he thong quan ly dao tao. Tra JSON {"title":"...","content":"..."}. Tieng Viet, tone: ' +
          tone + '.',
      },
      {
        role: 'user',
        content: 'Doi tuong: ' + audience + '. Muc dich: ' + p,
      },
    ],
    temperature: 0.4,
    maxTokens: 600,
    responseFormat: 'json',
  });
  const parsed = parseJsonLoose(result.content) || {};
  return {
    title: String(parsed.title || 'Thong bao').slice(0, 200),
    content: String(parsed.content || result.content).slice(0, 2000),
    source: 'llm',
    model: result.model,
    usage: result.usage,
  };
}

async function summarizeText({ text, maxWords = 120 } = {}) {
  const t = clampText(text, MAX_INPUT);
  if (!t.trim()) {
    const err = new Error('Thieu text');
    err.status = 400;
    throw err;
  }
  if (!isAiConfigured()) {
    const words = t.split(/\s+/).slice(0, Math.min(40, maxWords));
    return {
      summary: words.join(' ') + (t.split(/\s+/).length > words.length ? '...' : ''),
      source: 'fallback',
      model: null,
    };
  }
  const result = await chatCompletion({
    messages: [
      {
        role: 'system',
        content: 'Tom tat van ban tieng Viet, toi da ' + maxWords + ' tu. Chi tra ve doan tom tat, khong tieu de.',
      },
      { role: 'user', content: t },
    ],
    temperature: 0.2,
    maxTokens: 400,
  });
  return {
    summary: String(result.content || '').trim().slice(0, 2000),
    source: 'llm',
    model: result.model,
    usage: result.usage,
  };
}

async function complete({ prompt, system } = {}) {
  const p = clampText(prompt, MAX_INPUT);
  if (!p.trim()) {
    const err = new Error('Thieu prompt');
    err.status = 400;
    throw err;
  }
  if (!isAiConfigured()) {
    return {
      content: '[AI chua cau hinh] Ban da gui: ' + p.slice(0, 200),
      source: 'fallback',
      model: null,
    };
  }
  const messages = [];
  if (system) messages.push({ role: 'system', content: clampText(system, 1000) });
  messages.push({ role: 'user', content: p });
  const result = await chatCompletion({
    messages,
    temperature: 0.5,
    maxTokens: 1500,
  });
  return {
    content: String(result.content || '').trim(),
    source: 'llm',
    model: result.model,
    usage: result.usage,
  };
}

module.exports = {
  getStatus,
  generateQuiz,
  draftNotification,
  summarizeText,
  complete,
  isAiConfigured,
};