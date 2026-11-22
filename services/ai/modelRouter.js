'use strict';

/**
 * Centralized 4-Tier Paid-Model Router for DewSkill AI & Academy grading/admin tasks.
 *
 * Tiers aligned with Google AI Studio paid rate limits:
 *  - Tier 1 (Primary for normal Q&A, classify, text grading, lesson AI, admin light): gemini-3.5-flash-lite
 *  - Tier 2 (Primary for vision, complex Q&A, quiz generation; escalation for Tier 1): gemini-3.6-flash (thinkingBudget: 0)
 *  - Tier 3 (Advanced fallback ONLY for vision, complex Q&A, quiz generation): gemini-3.8-flash (thinkingBudget: 0)
 *  - Tier 4 (Final last-resort fallback, Unlimited RPD): gemini-2.0-flash-lite
 *
 * Never routes to non-chat agent models (Antigravity, Deep Research, Computer Use).
 * Always defaults thinkingBudget=0 so thinking-capable models do not emit costly hidden thought tokens unless needed.
 */

function uniqueList(items) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(items) ? items : []) {
    const k = String(raw || '').trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function isLiteModelName(model) {
  return /\blite\b/i.test(String(model || ''));
}

const COMPLEX_CODE_OR_FORMULA_RE = /\b(index\s*\(|match\s*\(|xlookup|sumproduct|arrayformula|power\s*query|power\s*bi|dax|vba|macro|sub\s+\w+|function\s+\w+|select\s+.+\s+from|join\s+|python|javascript|typescript|c\+\+|html|css|mongodb|nodejs|sql|regex|script|debug|code)\b/i;
const COMPLEX_REASONING_RE = /(so\s*sánh\s*chi\s*tiết|phân\s*tích\s*(sâu|chi\s*tiết|lỗi)|tối\s*ưu\s*công\s*thức|kết\s*hợp\s*nhiều\s*hàm|lỗi\s*công\s*thức|sửa\s*lỗi\s*hàm|viết\s*(mã|code|macro|truy\s*vấn)|lập\s*kế\s*hoạch|thiết\s*kế\s*bảng\s*tính)/i;

function isComplexQuery(text, { multiPart = false, hasImages = false, hasAttachmentText = false } = {}) {
  if (hasImages || multiPart || hasAttachmentText) return true;
  const trimmed = String(text || '').trim();
  if (!trimmed) return false;
  if (trimmed.length > 260) return true;
  return COMPLEX_CODE_OR_FORMULA_RE.test(trimmed) || COMPLEX_REASONING_RE.test(trimmed);
}

function getModelProfile(task, opts = {}) {
  const envLite = String(process.env.AI_LITE_MODEL || '').trim();
  const envFlash = String(process.env.AI_FLASH_MODEL || '').trim();
  const envVision = String(process.env.AI_VISION_MODEL || '').trim();
  const envComplex = String(process.env.AI_COMPLEX_MODEL || '').trim();
  const envGrade = String(process.env.AI_GRADE_MODEL || '').trim();
  const envQuick = String(process.env.AI_QUICK_ASK_MODEL || '').trim();
  const envScope = String(process.env.AI_SCOPE_CLASSIFIER_MODEL || '').trim();
  const envLesson = String(process.env.AI_LESSON_MODEL || '').trim();
  const envGlobal = String(process.env.AI_MODEL || '').trim();

  const nonLiteFlash = envFlash && !isLiteModelName(envFlash) ? envFlash : '';
  const nonLiteGlobal = envGlobal && !isLiteModelName(envGlobal) ? envGlobal : '';

  const profiles = {
    classify: {
      models: uniqueList([envScope, envLite, 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-2.0-flash-lite']),
      thinkingBudget: 0,
      maxTokens: 160,
      temperature: 0,
      timeoutMs: 10000,
    },
    grade_text: {
      models: uniqueList([envGrade, envLite, 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite']),
      thinkingBudget: 0,
      maxTokens: 200,
      temperature: 0,
      timeoutMs: 15000,
    },
    grade_vision: {
      // Never allow lite text overrides (e.g., envQuick / envLite) ahead of Flash vision models
      models: uniqueList([envVision, nonLiteFlash, 'gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']),
      thinkingBudget: 0,
      maxTokens: 220,
      temperature: 0.1,
      timeoutMs: 25000,
    },
    qa_simple: {
      models: uniqueList([envQuick, envLite, 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite']),
      thinkingBudget: 0,
      maxTokens: 1150,
      temperature: 0.3,
      timeoutMs: 12000,
    },
    qa_complex: {
      models: uniqueList([envComplex, nonLiteFlash, 'gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']),
      thinkingBudget: 0,
      maxTokens: 1500,
      temperature: 0.3,
      timeoutMs: 18000,
    },
    qa_vision: {
      // Never allow AI_QUICK_ASK_MODEL=gemini-3.5-flash-lite to override vision routing
      models: uniqueList([envVision, nonLiteFlash, 'gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']),
      thinkingBudget: 0,
      maxTokens: 1500,
      temperature: 0.3,
      timeoutMs: 20000,
    },
    support_simple: {
      models: uniqueList([envLite, 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite']),
      thinkingBudget: 0,
      maxTokens: 1600,
      temperature: 0.35,
      timeoutMs: 18000,
    },
    support_complex: {
      models: uniqueList([envComplex, nonLiteFlash, 'gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']),
      thinkingBudget: 0,
      maxTokens: 2200,
      temperature: 0.35,
      timeoutMs: 22000,
    },
    support_vision: {
      models: uniqueList([envVision, nonLiteFlash, 'gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']),
      thinkingBudget: 0,
      maxTokens: 2200,
      temperature: 0.35,
      timeoutMs: 25000,
    },
    lesson_assistant: {
      models: uniqueList([envLesson, envLite, 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite']),
      thinkingBudget: 0,
      maxTokens: 1200,
      temperature: 0.35,
      timeoutMs: 16000,
    },
    placement_advice: {
      models: uniqueList([envLite, 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite']),
      thinkingBudget: 0,
      maxTokens: 900,
      temperature: 0.4,
      timeoutMs: 16000,
    },
    admin_light: {
      models: uniqueList([envLite, 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-2.0-flash-lite']),
      thinkingBudget: 0,
      maxTokens: 1200,
      temperature: 0.4,
      timeoutMs: 18000,
    },
    admin_quiz: {
      models: uniqueList([nonLiteFlash, nonLiteGlobal, 'gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']),
      thinkingBudget: 0,
      maxTokens: 3200,
      temperature: 0.6,
      timeoutMs: 28000,
    },
  };

  const base = profiles[task] || profiles.qa_simple;
  const customModels = Array.isArray(opts.models) && opts.models.length ? uniqueList(opts.models) : base.models;
  return {
    task: profiles[task] ? task : 'qa_simple',
    models: customModels,
    thinkingBudget: typeof opts.thinkingBudget === 'number' && Number.isFinite(opts.thinkingBudget)
      ? Math.max(0, Math.floor(opts.thinkingBudget))
      : base.thinkingBudget,
    maxTokens: typeof opts.maxTokens === 'number' && Number.isFinite(opts.maxTokens) && opts.maxTokens > 0
      ? Math.floor(opts.maxTokens)
      : base.maxTokens,
    temperature: typeof opts.temperature === 'number' && Number.isFinite(opts.temperature)
      ? opts.temperature
      : base.temperature,
    timeoutMs: typeof opts.timeoutMs === 'number' && Number.isFinite(opts.timeoutMs) && opts.timeoutMs > 0
      ? Math.floor(opts.timeoutMs)
      : base.timeoutMs,
  };
}

function getSupportFallbackChain() {
  return uniqueList([
    process.env.AI_SUPPORT_MODEL,
    process.env.AI_MODEL,
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.0-flash-lite',
  ]);
}

async function chatWithProfile(task, opts = {}) {
  const { chatCompletion } = require('./llmClient');
  const profile = getModelProfile(task, opts);
  const {
    messages = [],
    images = [],
    responseFormat,
    onAttemptError,
  } = opts;

  let lastErr = null;
  let fallbackAttempts = 0;

  for (let i = 0; i < profile.models.length; i += 1) {
    const model = profile.models[i];
    const effectiveTimeoutMs = i === 0
      ? profile.timeoutMs
      : Math.min(30000, profile.timeoutMs + 4000);
    try {
      const payload = {
        messages,
        model,
        temperature: profile.temperature,
        maxTokens: profile.maxTokens,
        thinkingBudget: profile.thinkingBudget,
        timeoutMs: effectiveTimeoutMs,
      };
      if (Array.isArray(images) && images.length > 0) payload.images = images;
      if (responseFormat) payload.responseFormat = responseFormat;
      const res = await chatCompletion(payload);
      return { ...res, fallbackAttempts };
    } catch (err) {
      lastErr = err;
      fallbackAttempts += 1;
      if (typeof onAttemptError === 'function') {
        try {
          onAttemptError(model, err);
        } catch { /* ignore hook errors */ }
      }
    }
  }

  throw lastErr || new Error(`AI task "${profile.task}" unavailable`);
}

module.exports = {
  getModelProfile,
  isComplexQuery,
  getSupportFallbackChain,
  chatWithProfile,
  isLiteModelName,
};
