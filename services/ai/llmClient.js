/**
 * OpenAI-compatible chat client (OpenAI / Azure-compatible / Ollama / v.v.).
 * Bat khi co AI_API_KEY (hoac OPENAI_API_KEY).
 */
const axios = require('axios');
const logger = require('../../config/logger');

function isAiConfigured() {
  if (process.env.AI_ENABLED === '0') return false;
  return Boolean(process.env.AI_API_KEY || process.env.OPENAI_API_KEY);
}

function getConfig() {
  return {
    apiKey: process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '',
    baseUrl: (process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    timeoutMs: Math.max(5000, Number(process.env.AI_TIMEOUT_MS) || 45000),
  };
}

async function chatCompletion(opts) {
  if (!isAiConfigured()) {
    const err = new Error('AI chua duoc cau hinh (AI_API_KEY)');
    err.code = 'AI_NOT_CONFIGURED';
    err.status = 503;
    throw err;
  }
  const cfg = getConfig();
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
    const msg = e.response?.data?.error?.message || e.message || 'AI request failed';
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
};