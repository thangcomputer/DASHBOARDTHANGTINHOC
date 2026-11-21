'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cache = require('../../utils/cache');
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

test('P5-01: Non-RAG (Legacy) accounts strictly enforce Office-IT-only scope rule while allowing LMS FAQs & Office framing', async () => {
  const llmCalls = [];
  const { svc, restore } = withMockedQuickAskLlm(async (opts) => {
    llmCalls.push(opts);
    return {
      content: '**Hướng dẫn Excel:** Tạo bảng quản lý nhập xuất tồn với `SUMIFS`.',
      model: 'gemini-3.6-flash',
      usage: { promptTokenCount: 220, candidatesTokenCount: 70, totalTokenCount: 290 },
    };
  });

  knowledgeSvc.setKnowledgeRagOverrideForTests(false); // Force Legacy (non-RAG) account
  svc.resetQuickAskMetrics();

  try {
    const legacyStudent = { id: 'stu-legacy-1', role: 'student', name: 'Control User' };

    // 1. Out-of-scope topics (love, motorbike, cooking, general trivia) MUST be refused at 0 Gemini calls even when RAG is OFF
    const blockedQueries = [
      'Cách tỏ tình với crush trong tình yêu để được đồng ý?',
      'Xe máy Honda Vision và SH Mode xe nào tiết kiệm xăng hơn?',
      'Chỉ mình công thức nấu ăn món phở bò Hà Nội chuẩn vị',
      'Thủ đô của nước Pháp là thành phố nào?',
    ];
    for (const q of blockedQueries) {
      const res = await svc.quickAskAssistant({ user: legacyStudent, question: q, preferredLang: 'vi', platform: 'web' });
      assert.equal(res.source, 'memory', `Legacy off-topic must return memory refusal: ${q}`);
      assert.match(res.answer, /nằm ngoài phạm vi/i);
    }
    assert.equal(llmCalls.length, 0, 'Legacy off-topic queries must NEVER invoke Gemini');

    // 2. LMS FAQ still works on Legacy account
    const faq = await svc.quickAskAssistant({ user: legacyStudent, question: 'Lịch học', preferredLang: 'vi', platform: 'web' });
    assert.equal(faq.source, 'memory');
    assert.ok(faq.actions.length > 0);
    assert.equal(llmCalls.length, 0);

    // 3. Legitimate Office-framed question passes through to Legacy AI
    const officeFramed = await svc.quickAskAssistant({
      user: legacyStudent,
      question: 'Làm bảng Excel quản lý xe máy nhập xuất tồn cần những cột nào?',
      preferredLang: 'vi',
      platform: 'web',
    });
    assert.equal(officeFramed.source, 'ai');
    assert.equal(llmCalls.length, 1);
  } finally {
    knowledgeSvc.setKnowledgeRagOverrideForTests(null);
    restore();
  }
});

test('P5-02: Separated latency streams (RAG Cold / RAG Warm / Legacy / Guard), alerts, rollback & promotion gate', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thangtinhoc-p5-streams-'));
  const tmpIdxPath = path.join(tmpDir, 'knowledgeIndex.json');
  fs.writeFileSync(tmpIdxPath, JSON.stringify({
    version: 'test_p5_streams_v1',
    builtAt: '2026-11-21T00:00:00.000Z',
    publishedToStudents: false,
    chunks: [{
      id: 'p5_freeze_1',
      docId: 'doc_freeze',
      fileName: 'excel365_freeze.docx',
      docTitle: 'Giáo trình Excel 365 Cố định dòng Freeze Panes',
      software: 'excel',
      officeVersion: '365',
      docType: 'curriculum',
      isMac: false,
      sourceOrigin: 'internal_thangtinhoc',
      tier: 1,
      priorityWeight: 1.35,
      accessLevel: 'public',
      location: { sectionTitle: 'View -> Freeze Panes', page: 2 },
      functions: [],
      shortcuts: [],
      text: 'Hướng dẫn cố định dòng tiêu đề bằng Freeze Panes trong Excel 365.',
    }],
  }), 'utf8');
  knowledgeSvc.reloadKnowledgeIndex(tmpIdxPath);

  const { svc, restore } = withMockedQuickAskLlm(async (opts) => {
    // Simulate distinct timings: RAG fast (~15ms), Legacy slower (~60ms)
    const isLegacy = opts.model === 'gemini-3.6-flash';
    await new Promise((r) => setTimeout(r, isLegacy ? 60 : 15));
    return {
      content: '**Hướng dẫn chuẩn:** Vào thẻ **View** → **Freeze Panes** để cố định dòng tiêu đề bảng tính Excel.',
      model: opts.model || 'gemini-3.5-flash-lite',
      usage: { promptTokenCount: 250, candidatesTokenCount: 90, totalTokenCount: 340 },
    };
  });

  svc.resetQuickAskMetrics();
  await cache.delByPrefix('ai:quickask:');
  const origPersist = process.env.AI_QUICK_ASK_PERSIST_STATS;
  process.env.AI_QUICK_ASK_PERSIST_STATS = '0';

  try {
    // 1. RAG Cold
    knowledgeSvc.setKnowledgeRagOverrideForTests(true);
    await svc.quickAskAssistant({
      user: { id: 'stu-p5-1', role: 'student', name: 'Pilot' },
      question: 'Hướng dẫn cố định dòng tiêu đề bằng Freeze Panes trong Excel 365',
      preferredLang: 'vi',
      platform: 'web',
    });
    // 2. RAG Warm Cache hit
    await svc.quickAskAssistant({
      user: { id: 'stu-p5-1', role: 'student', name: 'Pilot' },
      question: 'Hướng dẫn cố định dòng tiêu đề bằng Freeze Panes trong Excel 365',
      preferredLang: 'vi',
      platform: 'mobile',
    });
    // 3. Guard refusal
    await svc.quickAskAssistant({
      user: { id: 'stu-p5-1', role: 'student', name: 'Pilot' },
      question: 'Tư vấn tình yêu người yêu giận nên làm gì?',
      preferredLang: 'vi',
      platform: 'mobile',
    });
    // 4. Legacy call
    knowledgeSvc.setKnowledgeRagOverrideForTests(false);
    await svc.quickAskAssistant({
      user: { id: 'stu-p5-2', role: 'student', name: 'Control' },
      question: 'Cách chia cột báo trong Word cho người mới',
      preferredLang: 'vi',
      platform: 'web',
    });

    svc.recordQuickAskClientError({ platform: 'mobile', errorType: 'timeout' });
    svc.recordQuickAskFeedback('helpful', 'web');
    svc.adjustQuickAskFeedback('helpful', 'inaccurate', 'web');

    const m = svc.getQuickAskMetricsSummary();
    assert.equal(m.latencyByStream.ragCold.count, 1);
    assert.equal(m.latencyByStream.ragWarmCache.count, 1);
    assert.equal(m.latencyByStream.legacy.count, 1);
    assert.equal(m.latencyByStream.guardMemory.count, 1);
    assert.ok(m.latencyByStream.legacy.p50 >= m.latencyByStream.ragWarmCache.p50);
    assert.equal(m.byPlatform.web, 2);
    assert.equal(m.byPlatform.mobile, 2);
    assert.equal(m.clientErrors.mobile, 1);
    assert.equal(m.clientErrors.timeout, 1);
    assert.equal(m.feedback.helpful, 0);
    assert.equal(m.feedback.inaccurate, 1);
    assert.equal(m.promotionGate.readyForAllStudentsProduction, false);
    assert.equal(m.promotionGate.checks.pilotDuration7to14Days, 'awaiting_pilot_data');
    assert.equal(m.rollbackCommand, 'AI_KNOWLEDGE_RAG_ENABLED=0');
  } finally {
    if (origPersist === undefined) delete process.env.AI_QUICK_ASK_PERSIST_STATS;
    else process.env.AI_QUICK_ASK_PERSIST_STATS = origPersist;
    knowledgeSvc.setKnowledgeRagOverrideForTests(null);
    knowledgeSvc.reloadKnowledgeIndex(null);
    restore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('P5-03: Web & Mobile Quick AI popups implement feedback UI, short reason, Markdown tables, and Retry without breaking layout', () => {
  const webSrc = read('client/src/components/ui/CommandPalette.jsx');
  assert.match(webSrc, /QuickAiFeedbackBar/);
  assert.match(webSrc, /Hữu ích/);
  assert.match(webSrc, /Chưa chính xác/);
  assert.match(webSrc, /submitQuickAskFeedback/);
  assert.match(webSrc, /parseMarkdownBlocks/);
  assert.match(webSrc, /<table\b/);
  assert.match(webSrc, /Thử lại/);
  assert.match(webSrc, /responseId:\s*msg\.id/);

  const mobileSrc = read('thang-tin-hoc-mobile/src/components/QuickAiPopupModal.tsx');
  assert.match(mobileSrc, /MobileQuickAiFeedbackBar/);
  assert.match(mobileSrc, /Hữu ích/);
  assert.match(mobileSrc, /Chưa chính xác/);
  assert.match(mobileSrc, /submitQuickAskFeedback/);
  assert.match(mobileSrc, /parseMobileMarkdownBlocks/);
  assert.match(mobileSrc, /mdTableHeaderRow/);
  assert.match(mobileSrc, /Thử lại/);
  assert.match(mobileSrc, /responseId:\s*msg\.id/);

  const routeSrc = read('routes/aiSupportRoutes.js');
  assert.match(routeSrc, /deduplicated:\s*true/);
  assert.match(routeSrc, /quick-ask\/client-event/);
  assert.match(routeSrc, /AiQuickAskDailyStat/);

  // Regression guard caught by real browser QA: redactPiiText must NEVER exceed Mongoose maxlength (300)
  const { redactPiiText } = require('../../services/aiSupportService');
  const longText = 'A'.repeat(1200);
  assert.ok(redactPiiText(longText, 300).length <= 300, 'redactPiiText must stay within maxlength 300');
  assert.ok(redactPiiText(longText, 240).length <= 240, 'redactPiiText must stay within maxlength 240');
});
