'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const knowledgeSvc = require('../../services/ai/knowledgeSearchService');

const ROOT = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function withMockedQuickAskLlm(handler) {
  const llmPath = require.resolve('../../services/ai/llmClient');
  const svcPath = require.resolve('../../services/aiSupportService');
  const origLlm = require.cache[llmPath];
  const origSvc = require.cache[svcPath];

  require.cache[llmPath] = {
    id: llmPath,
    filename: llmPath,
    loaded: true,
    exports: {
      isAiConfigured: () => true,
      parseGeminiKeys: () => ['test-key'],
      chatCompletion: handler,
    },
  };
  delete require.cache[svcPath];
  const svc = require('../../services/aiSupportService');
  return {
    svc,
    restore() {
      if (origLlm) require.cache[llmPath] = origLlm;
      else delete require.cache[llmPath];
      if (origSvc) require.cache[svcPath] = origSvc;
      else delete require.cache[svcPath];
    },
  };
}

test('P7-01: docker-compose.staging.yml binds localhost ports, enforces Mongo --auth & Redis 7.4 --requirepass AOF + network isolation', () => {
  const compose = read('docker-compose.staging.yml');
  assert.match(compose, /image:\s*redis:7\.4-alpine/);
  assert.match(compose, /--requirepass/);
  assert.match(compose, /--appendonly/);
  assert.match(compose, /127\.0\.0\.1:6380:6379/);
  assert.match(compose, /127\.0\.0\.1:27018:27017/);
  assert.match(compose, /command:\s*\["--auth",\s*"--bind_ip_all"\]/);
  assert.match(compose, /dewskill_staging_net/);
  assert.match(compose, /ENFORCE_STAGING_DB_ISOLATION:\s*"1"/);
  assert.match(compose, /AI_KNOWLEDGE_RAG_ALLOW_ALL_PRODUCTION:\s*"0"/);

  const envEx = read('.env.staging.example');
  assert.match(envEx, /STAGING_REDIS_PASSWORD=/);
  assert.match(envEx, /dewskill_staging_app:/);
});

test('P7-02: Real-device Mobile QA checklist covers all 11 Android & iPhone test cases and sign-off', () => {
  const checklist = read('docs/MOBILE_REAL_DEVICE_QA_CHECKLIST.md');
  for (let i = 1; i <= 11; i += 1) {
    const code = `M${String(i).padStart(2, '0')}`;
    assert.ok(checklist.includes(code), `Checklist must include ${code}`);
  }
  assert.match(checklist, /Android \(Máy thật\)/);
  assert.match(checklist, /iPhone \/ iOS \(Máy thật\)/);
  assert.match(checklist, /Markdown/);
  assert.match(checklist, /Hữu ích/);
  assert.match(checklist, /Chưa chính xác/);
  assert.match(checklist, /Thử lại/);
  assert.match(checklist, /màn hình nhỏ/i);
});

test('P7-03: Pilot promotionGate enforces 7-14 days, >=200 real queries, P95<=3s, <1% errors, <5% inaccurate & isolates benchmark traffic', async () => {
  const { svc, restore } = withMockedQuickAskLlm(async () => ({
    content: '**Excel:** Dùng `SUMIFS` theo giáo trình.',
    model: 'gemini-3.5-flash-lite',
    usage: { promptTokenCount: 200, candidatesTokenCount: 60, totalTokenCount: 260 },
  }));

  const origPersist = process.env.AI_QUICK_ASK_PERSIST_STATS;
  const origAllowAll = process.env.AI_KNOWLEDGE_RAG_ALLOW_ALL_PRODUCTION;
  process.env.AI_QUICK_ASK_PERSIST_STATS = '0';
  process.env.AI_KNOWLEDGE_RAG_ALLOW_ALL_PRODUCTION = '0';
  svc.resetQuickAskMetrics();
  knowledgeSvc.setKnowledgeRagOverrideForTests(true);

  try {
    // 5 automated benchmark calls should NEVER count as real pilot students or pilot queries
    for (let i = 0; i < 5; i += 1) {
      await svc.quickAskAssistant({
        user: { id: `bench-${i}`, role: 'student', name: 'Bench' },
        question: 'Xin chào',
        preferredLang: 'vi',
        platform: 'web',
        trafficSource: 'benchmark',
      });
    }
    // 2 real pilot calls from 1 user
    await svc.quickAskAssistant({
      user: { id: 'real-pilot-1', role: 'student', name: 'Real' },
      question: 'Xin chào',
      preferredLang: 'vi',
      platform: 'mobile',
      trafficSource: 'pilot',
    });
    await svc.quickAskAssistant({
      user: { id: 'real-pilot-1', role: 'student', name: 'Real' },
      question: 'Tư vấn tình yêu',
      preferredLang: 'vi',
      platform: 'mobile',
      trafficSource: 'pilot',
    });

    const summary = svc.getQuickAskMetricsSummary([
      { dateKey: '2026-11-15', pilotRequests: 30, uniqueUserHashes: ['h1', 'h2'] },
      { dateKey: '2026-11-16', pilotRequests: 40, uniqueUserHashes: ['h2', 'h3'] },
    ]);
    assert.equal(summary.benchmarkRequests, 5);
    assert.equal(summary.pilotRequests, 2);
    assert.equal(summary.uniqueRealUsersCount, 1);
    assert.equal(summary.promotionGate.observedDays, 2);
    assert.equal(summary.promotionGate.observedRequests, 70);
    assert.equal(summary.promotionGate.uniqueRealUsersCount, 3);
    assert.equal(summary.promotionGate.readyForAllStudentsProduction, false);
    assert.equal(summary.promotionGate.checks.pilotDuration7to14Days, 'awaiting_pilot_data');

    // Only when >=7 days, >=200 real queries, sufficient feedback/errors passing, AND Redis + non-prod-all is met does gate flip true
    for (let i = 0; i < 20; i += 1) svc.recordQuickAskFeedback('helpful', 'web');
    const gated = svc.evaluatePilotAlertsAndGate(
      {
        totalRequests: 250,
        pilotRequests: 250,
        geminiCallsCount: 150,
        errorsByType: { http429: 0, http500: 0, http503: 0, timeout: 0, network: 0, other: 0 },
        feedback: { helpful: 20, inaccurate: 0 },
        latencyByStream: { ragCold: { count: 100, p95: 1950 } },
        cacheBackend: { activeBackend: 'redis', silentFallbackToRam: false },
        ragConfig: { allowAllProduction: false },
        securityEvents: { authBlocked: 0, promptInjectionBlocked: 0 },
      },
      Array.from({ length: 7 }, (_, d) => ({
        dateKey: `2026-11-${10 + d}`,
        pilotRequests: 35,
        uniqueUserHashes: ['u1', 'u2', 'u3', 'u4'],
      })),
    );
    assert.equal(gated.promotionGate.readyForAllStudentsProduction, true);
    assert.equal(gated.promotionGate.checks.pilotDuration7to14Days, 'met');
    assert.equal(gated.promotionGate.checks.inaccurateFeedbackUnder5Pct, 'met');
    assert.equal(gated.promotionGate.checks.errorRateUnder1Pct, 'met');
  } finally {
    if (origPersist === undefined) delete process.env.AI_QUICK_ASK_PERSIST_STATS;
    else process.env.AI_QUICK_ASK_PERSIST_STATS = origPersist;
    if (origAllowAll === undefined) delete process.env.AI_KNOWLEDGE_RAG_ALLOW_ALL_PRODUCTION;
    else process.env.AI_KNOWLEDGE_RAG_ALLOW_ALL_PRODUCTION = origAllowAll;
    knowledgeSvc.setKnowledgeRagOverrideForTests(null);
    restore();
  }
});
