/**
 * OpenAI-compatible chat client (OpenAI / Azure-compatible / Ollama / v.v.).
 * Bat khi co AI_API_KEY (hoac OPENAI_API_KEY).
 */
const axios = require('axios');
const logger = require('../../config/logger');

let GoogleGenAI = null;
try {
  ({ GoogleGenAI } = require('@google/genai'));
} catch {
  GoogleGenAI = null;
}

function isAiConfigured() {
  if (process.env.AI_ENABLED === '0') return false;
  return Boolean(
    process.env.AI_API_KEY
    || process.env.OPENAI_API_KEY
    || process.env.GEMINI_API_KEY
    || process.env.GOOGLE_API_KEY,
  );
}

function getConfig() {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || geminiKey || '';
  const defaultBase = geminiKey && !process.env.AI_BASE_URL && !process.env.OPENAI_BASE_URL
    ? 'https://generativelanguage.googleapis.com/v1beta/openai'
    : 'https://api.openai.com/v1';
  const defaultModel = geminiKey && !process.env.AI_MODEL && !process.env.OPENAI_MODEL
    ? 'gemini-2.5-flash'
    : 'gpt-4o-mini';
  return {
    apiKey,
    baseUrl: (process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || defaultBase).replace(/\/$/, ''),
    model: process.env.AI_MODEL || process.env.OPENAI_MODEL || defaultModel,
    timeoutMs: Math.max(5000, Number(process.env.AI_TIMEOUT_MS) || 45000),
  };
}

function isGeminiProvider(cfg) {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
    || /generativelanguage\.googleapis\.com/i.test(cfg.baseUrl || '');
}

function buildGeminiHeaders(apiKey) {
  // Auth keys (AQ.) — Bearer; classic keys (AIza) — x-goog-api-key
  if (String(apiKey).startsWith('AQ.')) {
    return { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' };
  }
  return { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' };
}

async function chatCompletionGeminiNative(cfg, opts) {
  const model = String(cfg.model || 'gemini-2.0-flash').replace(/^models\//, '');
  const system = opts.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const userParts = opts.messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
    .join('\n\n');
  const prompt = system ? `${system}\n\n${userParts}` : userParts;

  if (GoogleGenAI) {
    const ai = new GoogleGenAI({ apiKey: cfg.apiKey });
    const config = {
      temperature: opts.temperature ?? 0.4,
      maxOutputTokens: opts.maxTokens ?? 1200,
    };
    if (opts.responseFormat === 'json') config.responseMimeType = 'application/json';
    const res = await ai.models.generateContent({ model, contents: prompt, config });
    return { content: res.text || '', model, usage: res.usageMetadata || null };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const contents = opts.messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }],
    }));
  const body = {
    contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.4,
      maxOutputTokens: opts.maxTokens ?? 1200,
    },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (opts.responseFormat === 'json') {
    body.generationConfig.responseMimeType = 'application/json';
  }
  const res = await axios.post(url, body, {
    timeout: cfg.timeoutMs,
    headers: buildGeminiHeaders(cfg.apiKey),
  });
  const text = res.data?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || '')
    .join('') || '';
  return { content: text, model, usage: res.data?.usageMetadata || null };
}

function humanizeAiError(raw) {
  const msg = String(raw || '');
  let parsed = null;
  try {
    if (msg.trim().startsWith('{')) parsed = JSON.parse(msg);
    else {
      const m = msg.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }
  } catch { /* ignore */ }
  const inner = parsed?.error?.message || parsed?.message || msg;
  if (/401|UNAUTHENTICATED|ACCESS_TOKEN_TYPE_UNSUPPORTED|invalid authentication/i.test(`${inner} ${msg}`)) {
    return 'Google chua chap nhan key. Bat Generative Language API tren Cloud Console.';
  }
  return String(inner).replace(/\s+/g, ' ').slice(0, 180);
}

async function chatCompletion(opts) {
  if (!isAiConfigured()) {
    const err = new Error('AI chua duoc cau hinh (AI_API_KEY)');
    err.code = 'AI_NOT_CONFIGURED';
    err.status = 503;
    throw err;
  }
  const cfg = getConfig();

  if (isGeminiProvider(cfg)) {
    try {
      return await chatCompletionGeminiNative(cfg, opts);
    } catch (e) {
      const status = e.status || e.response?.status || 502;
      const msg = humanizeAiError(e.response?.data?.error?.message || e.message || 'Gemini request failed');
      logger.warn({ status, msg: String(msg).slice(0, 200) }, '[AI] gemini native failed');
      const err = new Error(msg);
      err.status = status >= 400 && status < 600 ? status : 502;
      err.code = 'AI_PROVIDER_ERROR';
      throw err;
    }
  }

  const body = {
    model: cfg.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 1200,
  };
  if (opts.responseFormat === 'json') {
    body.response_format = { type: 'json_object' };
  }

  try {
    const res = await axios.post(cfg.baseUrl + '/chat/completions', body, {
      timeout: cfg.timeoutMs,
      headers: {
        Authorization: 'Bearer ' + cfg.apiKey,
        'Content-Type': 'application/json',
      },
    });
    const choice = res.data?.choices?.[0]?.message?.content || '';
    return {
      content: choice,
      model: res.data?.model || cfg.model,
      usage: res.data?.usage || null,
    };
  } catch (e) {
    const status = e.response?.status || 502;
    const msg = humanizeAiError(e.response?.data?.error?.message || e.message || 'AI request failed');
    logger.warn({ status, msg: String(msg).slice(0, 200) }, '[AI] chatCompletion failed');
    const err = new Error(msg);
    err.status = status >= 400 && status < 600 ? status : 502;
    err.code = 'AI_PROVIDER_ERROR';
    throw err;
  }
}

module.exports = {
  isAiConfigured,
  getConfig,
  chatCompletion,
  humanizeAiError,
};