'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const redisConfig = require('../../config/redis');
const cache = require('../../utils/cache');
const knowledgeSvc = require('../../services/ai/knowledgeSearchService');
const aiSupportSvc = require('../../services/aiSupportService');

test('P4-01: Redis resolver honors ENABLE_REDIS and REDIS_URL cleanly without silent confusion', () => {
  const origEnable = process.env.ENABLE_REDIS;
  const origUrl = process.env.REDIS_URL;
  try {
    process.env.ENABLE_REDIS = 'false';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    assert.equal(redisConfig.resolveRedisUrl(), null, 'ENABLE_REDIS=false must explicitly disable Redis');

    process.env.ENABLE_REDIS = 'true';
    delete process.env.REDIS_URL;
    assert.equal(redisConfig.resolveRedisUrl(), 'redis://127.0.0.1:6379', 'ENABLE_REDIS=true without REDIS_URL resolves default local Redis');

    process.env.ENABLE_REDIS = 'true';
    process.env.REDIS_URL = 'redis://10.0.0.5:6379';
    assert.equal(redisConfig.resolveRedisUrl(), 'redis://10.0.0.5:6379');
  } finally {
    if (origEnable === undefined) delete process.env.ENABLE_REDIS; else process.env.ENABLE_REDIS = origEnable;
    if (origUrl === undefined) delete process.env.REDIS_URL; else process.env.REDIS_URL = origUrl;
  }
});

test('P4-02: User-ID-first Canary enforcement, production guard, no accidental student rollout, and instant rollback', () => {
  const saved = {
    NODE_ENV: process.env.NODE_ENV,
    AI_KNOWLEDGE_RAG_ENABLED: process.env.AI_KNOWLEDGE_RAG_ENABLED,
    AI_KNOWLEDGE_RAG_CANARY_USER_IDS: process.env.AI_KNOWLEDGE_RAG_CANARY_USER_IDS,
    AI_KNOWLEDGE_RAG_CANARY_ROLES: process.env.AI_KNOWLEDGE_RAG_CANARY_ROLES,
    AI_KNOWLEDGE_RAG_ALLOW_ROLE_EXPANSION: process.env.AI_KNOWLEDGE_RAG_ALLOW_ROLE_EXPANSION,
    AI_KNOWLEDGE_RAG_ALLOW_ALL_PRODUCTION: process.env.AI_KNOWLEDGE_RAG_ALLOW_ALL_PRODUCTION,
  };
  knowledgeSvc.setKnowledgeRagOverrideForTests(null);
  try {
    // 1. Production with AI_KNOWLEDGE_RAG_ENABLED=1 but NO allowlist -> REFUSED (safe guard!)
    process.env.NODE_ENV = 'production';
    process.env.AI_KNOWLEDGE_RAG_ENABLED = '1';
    delete process.env.AI_KNOWLEDGE_RAG_CANARY_USER_IDS;
    delete process.env.AI_KNOWLEDGE_RAG_CANARY_ROLES;
    delete process.env.AI_KNOWLEDGE_RAG_ALLOW_ALL_PRODUCTION;
    const guardRes = knowledgeSvc.evaluateKnowledgeRagAccess({ id: 'stu-1', role: 'student' });
    assert.equal(guardRes.enabled, false);
    assert.equal(guardRes.reason, 'production_requires_canary_allowlist');

    // 2. Priority 1: User-ID Canary allowlist -> ONLY listed IDs enabled, does NOT expand to unlisted teacher/student!
    process.env.AI_KNOWLEDGE_RAG_CANARY_USER_IDS = 'u-admin-1,u-tea-1,u-staff-1,u-stu-pilot';
    process.env.AI_KNOWLEDGE_RAG_CANARY_ROLES = 'teacher,student';
    delete process.env.AI_KNOWLEDGE_RAG_ALLOW_ROLE_EXPANSION;

    assert.equal(knowledgeSvc.evaluateKnowledgeRagAccess({ id: 'u-stu-pilot', role: 'student' }).enabled, true);
    assert.equal(knowledgeSvc.evaluateKnowledgeRagAccess({ id: 'u-stu-pilot', role: 'student' }).reason, 'canary_user_id');
    assert.equal(knowledgeSvc.evaluateKnowledgeRagAccess({ id: 'u-admin-1', role: 'admin' }).enabled, true);
    assert.equal(knowledgeSvc.evaluateKnowledgeRagAccess({ id: 'u-tea-other', role: 'teacher' }).enabled, false);
    assert.equal(knowledgeSvc.evaluateKnowledgeRagAccess({ id: 'u-stu-other', role: 'student' }).enabled, false);

    // 3. Production role-only list still blocks blanket 'student' role unless ALLOW_ALL_PRODUCTION=1
    delete process.env.AI_KNOWLEDGE_RAG_CANARY_USER_IDS;
    process.env.AI_KNOWLEDGE_RAG_CANARY_ROLES = 'admin,student';
    assert.equal(knowledgeSvc.evaluateKnowledgeRagAccess({ id: 'u-admin-1', role: 'admin' }).enabled, true);
    assert.equal(knowledgeSvc.evaluateKnowledgeRagAccess({ id: 'u-stu-other', role: 'student' }).enabled, false);
    assert.equal(knowledgeSvc.evaluateKnowledgeRagAccess({ id: 'u-stu-other', role: 'student' }).reason, 'production_student_role_blocked');

    // 4. Emergency rollback (AI_KNOWLEDGE_RAG_ENABLED=0) disables immediately for everyone including allowlisted IDs
    process.env.AI_KNOWLEDGE_RAG_CANARY_USER_IDS = 'u-admin-1';
    process.env.AI_KNOWLEDGE_RAG_ENABLED = '0';
    const rb = knowledgeSvc.evaluateKnowledgeRagAccess({ id: 'u-admin-1', role: 'admin' });
    assert.equal(rb.enabled, false);
    assert.equal(rb.reason, 'flag_disabled');
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    knowledgeSvc.setKnowledgeRagOverrideForTests(null);
  }
});

test('P4-03: Telemetry tracks P50/P95/P99, HTTP 429/500/503/timeout errors, feedback counts, legacy fallback, and redacts PII/secrets', async () => {
  const fakeGoogleKey = ['AIza', 'SyAbCdEfGhIjKlMnOpQrStUvWx'].join('');
  const redacted = aiSupportSvc.redactPiiText(`Gọi 0912345678 hoặc email hocvien@gmail.com với key ${fakeGoogleKey} và Bearer eyJhbGciOi.abc.def`);
  assert.doesNotMatch(redacted, /0912345678|hocvien@gmail\.com|AIzaSy|eyJhbGciOi/);
  assert.match(redacted, /\[REDACTED_PHONE\]/);
  assert.match(redacted, /\[REDACTED_EMAIL\]/);
  assert.match(redacted, /\[REDACTED_API_KEY\]/);
  assert.match(redacted, /\[REDACTED_TOKEN\]/);

  const llmPath = require.resolve('../../services/ai/llmClient');
  const svcPath = require.resolve('../../services/aiSupportService');
  const origLlm = require.cache[llmPath];
  const origSvc = require.cache[svcPath];

  let attempt = 0;
  require.cache[llmPath] = {
    id: llmPath,
    filename: llmPath,
    loaded: true,
    exports: {
      isAiConfigured: () => true,
      parseGeminiKeys: () => ['test-key'],
      chatCompletion: async () => {
        attempt += 1;
        if (attempt === 1) { const e = new Error('429 quota'); e.status = 429; throw e; }
        if (attempt === 2) { const e = new Error('503 overloaded'); e.status = 503; throw e; }
        if (attempt === 3) { const e = new Error('504 timeout'); e.status = 504; throw e; }
        if (attempt === 4) { const e = new Error('500 internal'); e.status = 500; throw e; }
        return {
          content: '**Hướng dẫn chuẩn:** Vào thẻ **View** → **Freeze Panes** để cố định tiêu đề bảng Excel.',
          model: 'gemini-3.5-flash',
          usage: { promptTokenCount: 300, candidatesTokenCount: 80, totalTokenCount: 380 },
        };
      },
    },
  };
  delete require.cache[svcPath];
  const svc = require('../../services/aiSupportService');
  svc.resetQuickAskMetrics();
  await cache.delByPrefix('ai:quickask:');
  knowledgeSvc.setKnowledgeRagOverrideForTests(true);

  try {
    await svc.quickAskAssistant({
      user: { id: 'stu-m1', role: 'student', name: 'Test' },
      question: 'Hướng dẫn cố định tiêu đề bằng Freeze Panes trong Excel 365',
      preferredLang: 'vi',
    });
    svc.recordQuickAskFeedback('helpful');
    svc.recordQuickAskFeedback('inaccurate');

    // Rollback to legacy -> increments legacyFallbackCount
    knowledgeSvc.setKnowledgeRagOverrideForTests(false);
    await svc.quickAskAssistant({
      user: { id: 'stu-m2', role: 'student', name: 'Test 2' },
      question: 'Hướng dẫn chia cột báo Columns trong Microsoft Word',
      preferredLang: 'vi',
    });

    const m = svc.getQuickAskMetricsSummary();
    assert.equal(m.errorsByType.http429, 1);
    assert.equal(m.errorsByType.http503, 1);
    assert.equal(m.errorsByType.timeout, 1);
    assert.equal(m.errorsByType.http500, 1);
    assert.equal(m.feedback.helpful, 1);
    assert.equal(m.feedback.inaccurate, 1);
    assert.equal(m.legacyFallbackCount, 1);
    assert.equal(typeof m.latencyMs.p99, 'number');
    assert.ok(m.latencyMs.p99 >= m.latencyMs.p95);
    assert.ok(m.estimatedCostUsd > 0);
    assert.ok(m.cacheBackend && typeof m.cacheBackend.activeBackend === 'string');
  } finally {
    knowledgeSvc.setKnowledgeRagOverrideForTests(null);
    if (origLlm) require.cache[llmPath] = origLlm; else delete require.cache[llmPath];
    if (origSvc) require.cache[svcPath] = origSvc; else delete require.cache[svcPath];
  }
});
