'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Isolate env for this file
const PREV = { ...process.env };

test('parseGeminiKeys: multi + single, unique order', async (t) => {
  t.after(() => {
    process.env.GEMINI_API_KEYS = PREV.GEMINI_API_KEYS;
    process.env.GEMINI_API_KEY = PREV.GEMINI_API_KEY;
    process.env.GOOGLE_API_KEY = PREV.GOOGLE_API_KEY;
    delete require.cache[require.resolve('../../services/ai/llmClient')];
  });

  process.env.GEMINI_API_KEYS = 'keyA, keyB;keyC';
  process.env.GEMINI_API_KEY = 'keyA';
  process.env.GOOGLE_API_KEY = 'keyD';
  delete require.cache[require.resolve('../../services/ai/llmClient')];
  const { parseGeminiKeys } = require('../../services/ai/llmClient');
  assert.deepEqual(parseGeminiKeys(), ['keyA', 'keyB', 'keyC', 'keyD']);
});

test('isAiConfigured true when GEMINI_API_KEYS set', async (t) => {
  t.after(() => {
    process.env.GEMINI_API_KEYS = PREV.GEMINI_API_KEYS;
    process.env.GEMINI_API_KEY = PREV.GEMINI_API_KEY;
    process.env.AI_API_KEY = PREV.AI_API_KEY;
    process.env.OPENAI_API_KEY = PREV.OPENAI_API_KEY;
    process.env.GOOGLE_API_KEY = PREV.GOOGLE_API_KEY;
    process.env.AI_ENABLED = PREV.AI_ENABLED;
    delete require.cache[require.resolve('../../services/ai/llmClient')];
  });

  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.AI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  process.env.AI_ENABLED = '1';
  process.env.GEMINI_API_KEYS = 'onlyMultiKey';
  delete require.cache[require.resolve('../../services/ai/llmClient')];
  const { isAiConfigured, parseGeminiKeys } = require('../../services/ai/llmClient');
  assert.equal(parseGeminiKeys().length, 1);
  assert.equal(isAiConfigured(), true);
});
