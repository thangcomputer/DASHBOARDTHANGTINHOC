/**
 * OpenAI-compatible / Gemini chat client.
 * Gemini: hỗ trợ nhiều key (GEMINI_API_KEYS) — round-robin + cooldown khi 429.
 */
const axios = require('axios');
const logger = require('../../config/logger');

let GoogleGenAI = null;
try {
  ({ GoogleGenAI } = require('@google/genai'));
} catch {
  GoogleGenAI = null;
}

/** key -> cooldown until (ms epoch) */
const geminiKeyCooldownUntil = new Map();
let geminiRrIndex = 0;

const KEY_COOLDOWN_MS = Math.max(10_000, Number(process.env.GEMINI_KEY_COOLDOWN_MS) || 60_000);

function parseGeminiKeys() {
  const multi = String(process.env.GEMINI_API_KEYS || '')
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const singles = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
  ].map((s) => String(s || '').trim()).filter(Boolean);

  const seen = new Set();
  const keys = [];
  for (const k of [...multi, ...singles]) {
    if (seen.has(k)) continue;
    seen.add(k);
    keys.push(k);
  }
  return keys;
}

function isAiConfigured() {
  if (process.env.AI_ENABLED === '0') return false;
  if (parseGeminiKeys().length) return true;
  return Boolean(process.env.AI_API_KEY || process.env.OPENAI_API_KEY);
}

function markGeminiKeyCooldown(apiKey, ms = KEY_COOLDOWN_MS) {
  if (!apiKey) return;
  geminiKeyCooldownUntil.set(apiKey, Date.now() + ms);
  logger.warn(
    { keyHint: `${String(apiKey).slice(0, 6)}…`, cooldownSec: Math.round(ms / 1000) },
    '[AI] gemini key cooldown',
  );
}

function pickGeminiKey() {
  const keys = parseGeminiKeys();
  if (!keys.length) return '';
  const now = Date.now();
  const n = keys.length;

  for (let i = 0; i < n; i += 1) {
    const idx = (geminiRrIndex + i) % n;
    const k = keys[idx];
    if ((geminiKeyCooldownUntil.get(k) || 0) <= now) {
      geminiRrIndex = (idx + 1) % n;
      return k;
    }
  }

  // All cooling — use the one that frees soonest
  let best = keys[0];
  let bestUntil = geminiKeyCooldownUntil.get(best) || 0;
  for (const k of keys) {
    const until = geminiKeyCooldownUntil.get(k) || 0;
    if (until < bestUntil) {
      best = k;
      bestUntil = until;
    }
  }
  geminiRrIndex = (keys.indexOf(best) + 1) % n;
  return best;
}

function getConfig(apiKeyOverride) {
  const geminiKeys = parseGeminiKeys();
  const geminiKey = apiKeyOverride || geminiKeys[0] || '';
  const apiKey = apiKeyOverride
    || process.env.AI_API_KEY
    || process.env.OPENAI_API_KEY
    || geminiKey
    || '';
  const useGeminiDefaults = geminiKeys.length > 0
    && !process.env.AI_BASE_URL
    && !process.env.OPENAI_BASE_URL;
  const defaultBase = useGeminiDefaults
    ? 'https://generativelanguage.googleapis.com/v1beta/openai'
    : 'https://api.openai.com/v1';
  const defaultModel = useGeminiDefaults && !process.env.AI_MODEL && !process.env.OPENAI_MODEL
    ? 'gemini-3.6-flash'
    : 'gpt-4o-mini';
  return {
    apiKey,
    baseUrl: (process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || defaultBase).replace(/\/$/, ''),
    model: process.env.AI_MODEL || process.env.OPENAI_MODEL || defaultModel,
    timeoutMs: Math.max(5000, Number(process.env.AI_TIMEOUT_MS) || 45000),
    geminiKeyCount: geminiKeys.length,
  };
}

function isGeminiProvider(cfg) {
  return parseGeminiKeys().length > 0
    || Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
    || /generativelanguage\.googleapis\.com/i.test(cfg.baseUrl || '');
}

function isRateLimitError(err) {
  const status = err?.status || err?.response?.status || err?.code;
  if (status === 429) return true;
  const msg = String(
    err?.response?.data?.error?.message
    || err?.message
    || err
    || '',
  );
  return /429|RESOURCE_EXHAUSTED|rate.?limit|quota|too many requests/i.test(msg);
}

function buildGeminiHeaders(apiKey) {
  if (String(apiKey).startsWith('AQ.')) {
    return { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' };
  }
  return { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' };
}

async function chatCompletionGeminiNative(cfg, opts) {
  const model = String(opts.model || cfg.model || 'gemini-3.6-flash').replace(/^models\//, '');
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
    if (system) config.systemInstruction = system;

    const contents = opts.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content || '') }],
      }));

    const images = Array.isArray(opts.images) ? opts.images.filter((i) => i?.data && i?.mimeType) : [];
    if (images.length) {
      const lastUser = [...contents].reverse().find((c) => c.role === 'user');
      if (lastUser) {
        lastUser.parts = [
          ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
          ...lastUser.parts,
        ];
      } else {
        contents.push({
          role: 'user',
          parts: [
            ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
            { text: 'Hãy xem ảnh này' },
          ],
        });
      }
    }
    const res = await ai.models.generateContent({ model, contents, config });
    return { content: res.text || '', model, usage: res.usageMetadata || null };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const contents = opts.messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }],
    }));
  const images = Array.isArray(opts.images) ? opts.images.filter((i) => i?.data && i?.mimeType) : [];
  if (images.length) {
    const lastUser = [...contents].reverse().find((c) => c.role === 'user');
    if (lastUser) {
      lastUser.parts = [
        ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
        ...lastUser.parts,
      ];
    }
  }
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
  if (/429|RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(`${inner} ${msg}`)) {
    return 'AI dang qua tai (het han muc). Thu lai sau vai phut hoac them GEMINI_API_KEYS.';
  }
  return String(inner).replace(/\s+/g, ' ').slice(0, 180);
}

async function chatCompletionGeminiWithFailover(opts) {
  const keys = parseGeminiKeys();
  if (!keys.length) {
    const err = new Error('AI chua duoc cau hinh (GEMINI_API_KEY)');
    err.code = 'AI_NOT_CONFIGURED';
    err.status = 503;
    throw err;
  }

  const tried = new Set();
  let lastErr = null;

  for (let attempt = 0; attempt < keys.length; attempt += 1) {
    let apiKey = pickGeminiKey();
    if (!apiKey || tried.has(apiKey)) {
      apiKey = keys.find((k) => !tried.has(k));
    }
    if (!apiKey) break;
    tried.add(apiKey);

    try {
      const result = await chatCompletionGeminiNative(getConfig(apiKey), opts);
      if (attempt > 0) {
        logger.info({ attempt: attempt + 1, keys: keys.length }, '[AI] gemini failover ok');
      }
      return result;
    } catch (e) {
      lastErr = e;
      if (!isRateLimitError(e)) throw wrapGeminiError(e);
      markGeminiKeyCooldown(apiKey);
      logger.warn(
        { attempt: attempt + 1, keys: keys.length },
        '[AI] gemini 429 — try next key',
      );
    }
  }

  throw wrapGeminiError(lastErr || new Error('Gemini rate limited on all keys'));
}

function wrapGeminiError(e) {
  const status = e?.status || e?.response?.status || 502;
  const msg = humanizeAiError(e?.response?.data?.error?.message || e?.message || 'Gemini request failed');
  logger.warn({ status, msg: String(msg).slice(0, 200) }, '[AI] gemini native failed');
  const err = new Error(msg);
  err.status = status >= 400 && status < 600 ? status : 502;
  err.code = isRateLimitError(e) || status === 429 ? 'AI_RATE_LIMITED' : 'AI_PROVIDER_ERROR';
  return err;
}

async function chatCompletion(opts) {
  if (!isAiConfigured()) {
    const err = new Error('AI chua duoc cau hinh (AI_API_KEY / GEMINI_API_KEY)');
    err.code = 'AI_NOT_CONFIGURED';
    err.status = 503;
    throw err;
  }
  const cfg = getConfig();

  if (isGeminiProvider(cfg)) {
    return chatCompletionGeminiWithFailover(opts);
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
  parseGeminiKeys,
  pickGeminiKey,
};
