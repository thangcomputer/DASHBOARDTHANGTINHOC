'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');

const policySvc = require('../../services/ai/aiPlanPolicyService');
const modelRouter = require('../../services/ai/modelRouter');
const knowledgeSvc = require('../../services/ai/knowledgeSearchService');

const ROOT = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('aiPlanPolicyService: cấu hình mặc định 7 nhóm, làm sạch dữ liệu & chống model không hợp lệ', () => {
  policySvc.invalidateAiPlanPolicyCache();
  const def = policySvc.DEFAULT_AI_PLAN_MODEL_POLICY;

  assert.deepEqual(policySvc.PLAN_TIER_KEYS, ['free', '1d', '1m', '3m', '6m', '12m', 'course_student']);
  assert.equal(def.tiers.free.imageDailyLimit, 0);
  assert.equal(def.tiers['1d'].standardDailyLimit, 15);
  assert.equal(def.tiers['1d'].fileFlashDailyLimit, 5);
  assert.equal(def.tiers['1d'].fileProDailyLimit, 0);
  assert.equal(def.tiers['1m'].standardDailyLimit, 15);
  assert.equal(def.tiers['1m'].imageDailyLimit, 8);
  assert.equal(def.tiers['1m'].fileFlashDailyLimit, 3);
  assert.equal(def.tiers['1m'].fileProDailyLimit, 0);
  assert.equal(def.tiers['3m'].fileProDailyLimit, 2);
  assert.equal(def.tiers['3m'].fileProThinkingBudget, 1024);
  assert.equal(def.tiers['3m'].allow38Fallback, false);
  assert.equal(def.tiers['6m'].fileProDailyLimit, 4);
  assert.equal(def.tiers['6m'].fileProThinkingBudget, 1536);
  assert.equal(def.tiers['6m'].allow38Fallback, true);
  assert.equal(def.tiers['12m'].standardDailyLimit, 40);
  assert.equal(def.tiers['12m'].fileProDailyLimit, 6);
  assert.equal(def.tiers['12m'].fileProThinkingBudget, 2048);
  assert.equal(def.tiers['12m'].allow38Fallback, true);

  const sanitized = policySvc.normalizeAiPlanModelPolicy({
    tiers: {
      '1m': {
        liteModel: 'antigravity-agent',
        standardModel: 'computer-use-preview',
        fileProModel: 'deep-research-pro',
        standardDailyLimit: 9999,
        rateLimitPerMinute: -5,
        fileProThinkingBudget: 99999,
      },
    },
  });
  assert.equal(sanitized.tiers['1m'].liteModel, 'gemini-3.5-flash-lite');
  assert.equal(sanitized.tiers['1m'].standardModel, 'gemini-3.6-flash');
  assert.equal(sanitized.tiers['1m'].fileProModel, 'gemini-3.1-pro-preview');
  assert.equal(sanitized.tiers['1m'].standardDailyLimit, 500);
  assert.equal(sanitized.tiers['1m'].rateLimitPerMinute, 0);
  assert.equal(sanitized.tiers['1m'].fileProThinkingBudget, 4096);
});

test('resolveStudentPlanTier & resolvePlanRouting: đúng model theo gói và tự hạ model khi hết lượt (Fair-Use)', () => {
  const future = new Date(Date.now() + 10 * 86400e3).toISOString();
  const past = new Date(Date.now() - 10 * 86400e3).toISOString();

  assert.equal(policySvc.resolveStudentPlanTier({ role: 'admin' }), null);
  assert.equal(policySvc.resolveStudentPlanTier({ role: 'teacher' }), null);
  assert.equal(policySvc.resolveStudentPlanTier({ role: 'student' }, { isFreeStudent: true }), 'free');
  assert.equal(policySvc.resolveStudentPlanTier({ role: 'student' }, { isFreeStudent: false }), 'course_student');
  assert.equal(policySvc.resolveStudentPlanTier({ role: 'student', aiPlan: { plan: '6m', isUnlimited: true, expiresAt: future } }), '6m');
  assert.equal(policySvc.resolveStudentPlanTier({ role: 'student', aiPlan: { plan: '6m', isUnlimited: true, expiresAt: past } }, { isFreeStudent: true }), 'free');

  // Gói 1m: file -> dùng gemini-3.6-flash, thinkingBudget=0, không bật 3.8-flash
  const r1mFile = policySvc.resolvePlanRouting({ tier: '1m', task: 'qa_file_solve', hasFile: true, usage: {} });
  assert.equal(r1mFile.bucket, 'file_flash');
  assert.equal(r1mFile.models[0], 'gemini-3.6-flash');
  assert.equal(r1mFile.thinkingBudget, 0);
  assert.equal(r1mFile.models.includes('gemini-3.8-flash'), false);

  // Gói 1m hết 3 lượt giải file trong ngày -> hạ xuống liteModel, KHÔNG chặn
  const r1mFileExhausted = policySvc.resolvePlanRouting({
    tier: '1m',
    task: 'qa_file_solve',
    hasFile: true,
    usage: { fileFlashCount: 3, totalCount: 3 },
  });
  assert.equal(r1mFileExhausted.bucket, 'lite');
  assert.equal(r1mFileExhausted.models[0], 'gemini-3.5-flash-lite');
  assert.equal(r1mFileExhausted.downgradedReason, 'file_quota_downgraded_to_lite');

  // Gói 3m: file -> lượt 0..1 dùng gemini-3.1-pro-preview (thinking 1024), lượt 2 hạ sang gemini-3.6-flash
  const r3mPro = policySvc.resolvePlanRouting({ tier: '3m', task: 'qa_file_solve', hasFile: true, usage: { fileProCount: 1 } });
  assert.equal(r3mPro.bucket, 'file_pro');
  assert.equal(r3mPro.models[0], 'gemini-3.1-pro-preview');
  assert.equal(r3mPro.thinkingBudget, 1024);
  assert.equal(r3mPro.models.includes('gemini-3.8-flash'), false);

  const r3mFlash = policySvc.resolvePlanRouting({ tier: '3m', task: 'qa_file_solve', hasFile: true, usage: { fileProCount: 2 } });
  assert.equal(r3mFlash.bucket, 'file_flash');
  assert.equal(r3mFlash.models[0], 'gemini-3.6-flash');
  assert.equal(r3mFlash.downgradedReason, 'file_pro_exhausted');

  // Gói 12m: bật fallback 3.8-flash + thinking 2048; chạm Fair-Use soft cap -> hạ về liteModel + fairUseMaxTokens
  const r12mVision = policySvc.resolvePlanRouting({ tier: '12m', task: 'qa_vision', hasImage: true, usage: {} });
  assert.equal(r12mVision.bucket, 'standard');
  assert.equal(r12mVision.models[0], 'gemini-3.6-flash');
  assert.equal(r12mVision.models[1], 'gemini-3.8-flash');

  const r12mFairUse = policySvc.resolvePlanRouting({ tier: '12m', task: 'qa_file_solve', hasFile: true, usage: { totalCount: 200 } });
  assert.equal(r12mFairUse.bucket, 'lite');
  assert.equal(r12mFairUse.isFairUseThrottled, true);
  assert.equal(r12mFairUse.models[0], 'gemini-3.5-flash-lite');
  assert.equal(r12mFairUse.maxTokens, 900);
  assert.equal(r12mFairUse.downgradedReason, 'fair_use_cap');

  // modelRouter bridge helper
  const bridged = modelRouter.resolveTaskProfileForPlan('qa_file_solve', { planTier: '6m', hasFile: true, usage: {} });
  assert.equal(bridged.models[0], 'gemini-3.1-pro-preview');
  assert.equal(bridged.thinkingBudget, 1536);
});

test('checkPerMinuteRateLimit: chặn spam vượt tốc độ/phút và nhả lại sau 60 giây', () => {
  policySvc.resetPerMinuteRateLimitForTests();
  const baseMs = 1_700_000_000_000;
  for (let i = 0; i < 4; i += 1) {
    const r = policySvc.checkPerMinuteRateLimit('stu-burst-1', 4, baseMs + i * 100);
    assert.equal(r.allowed, true);
  }
  const blocked = policySvc.checkPerMinuteRateLimit('stu-burst-1', 4, baseMs + 500);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSec >= 1);

  const recovered = policySvc.checkPerMinuteRateLimit('stu-burst-1', 4, baseMs + 61_000);
  assert.equal(recovered.allowed, true);
  policySvc.resetPerMinuteRateLimitForTests();
});

test('quickAskAssistant E2E: phân luồng theo gói 3m & 1m, cắt file dài, và hoàn lượt khi LLM lỗi', async () => {
  const llmPath = require.resolve('../../services/ai/llmClient');
  const svcPath = require.resolve('../../services/aiSupportService');
  const origLlm = require.cache[llmPath];
  const origSvc = require.cache[svcPath];

  const calls = [];
  let shouldFail = false;

  knowledgeSvc.setKnowledgeRagOverrideForTests(false);
  policySvc.invalidateAiPlanPolicyCache();
  policySvc.resetPerMinuteRateLimitForTests();

  require.cache[llmPath] = {
    id: llmPath,
    filename: llmPath,
    loaded: true,
    exports: {
      isAiConfigured: () => true,
      getApiKeys: () => ['mock-key'],
      chatCompletion: async (opts) => {
        calls.push(opts);
        if (shouldFail) throw new Error('Simulated 503');
        return {
          content: 'Công thức chuẩn tại `B2` là `=SUM(A1:A5)` trong Excel.',
          model: opts.model,
        };
      },
    },
  };

  delete require.cache[svcPath];
  const svc = require('../../services/aiSupportService');
  svc.resetMemoryPlanUsageForTests();

  const wb = XLSX.utils.book_new();
  const longText = Array.from({ length: 450 }, (_, idx) => [`Row_${idx + 1}`, idx * 100, `Note_${'x'.repeat(20)}`]);
  const ws = XLSX.utils.aoa_to_sheet([['Item', 'Val', 'Desc'], ...longText]);
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  const xlsxBase64 = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }).toString('base64');

  const future = new Date(Date.now() + 20 * 86400e3).toISOString();
  const student3m = {
    id: `stu-3m-${Date.now()}`,
    role: 'student',
    freePortal: true,
    aiPlan: { plan: '3m', isUnlimited: true, activatedAt: new Date().toISOString(), expiresAt: future },
  };
  const student1m = {
    id: `stu-1m-${Date.now()}`,
    role: 'student',
    freePortal: true,
    aiPlan: { plan: '1m', isUnlimited: true, activatedAt: new Date().toISOString(), expiresAt: future },
  };

  try {
    // 1. Gói 3m gửi 3 lần giải file Excel: 2 lượt Pro (thinking 1024), lượt 3 hạ xuống 3.6-flash (thinking 0)
    for (let i = 1; i <= 3; i += 1) {
      const res = await svc.quickAskAssistant({
        user: student3m,
        question: `Giải file Excel bài tập số ${i}`,
        attachment: {
          name: `bt-${i}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dataBase64: xlsxBase64,
        },
      });
      assert.equal(res.source, 'ai');
      assert.ok(res.planModelQuota);
    }

    assert.equal(calls.length, 3);
    assert.equal(calls[0].model, 'gemini-3.1-pro-preview');
    assert.equal(calls[0].thinkingBudget, 1024);
    assert.equal(calls[1].model, 'gemini-3.1-pro-preview');
    assert.equal(calls[1].thinkingBudget, 1024);
    assert.equal(calls[2].model, 'gemini-3.6-flash');
    assert.equal(calls[2].thinkingBudget, 0);

    // 2. Gói 1m giải file: dùng gemini-3.6-flash + cắt nội dung file <= 6000 ký tự
    const res1m = await svc.quickAskAssistant({
      user: student1m,
      question: 'Giải file Excel bài 1m',
      attachment: {
        name: 'bt-1m.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dataBase64: xlsxBase64,
      },
    });
    assert.equal(calls.length, 4);
    assert.equal(calls[3].model, 'gemini-3.6-flash');
    assert.equal(calls[3].thinkingBudget, 0);
    const userPrompt1m = calls[3].messages.find((m) => m.role === 'user')?.content || '';
    const matchAttach = userPrompt1m.match(/<user_attachment[^>]*>\n```\n([\s\S]*?)\n```\n<\/user_attachment>/);
    assert.ok(matchAttach && matchAttach[1].length <= 6005, 'Attachment text for 1m must be capped near 6000 chars');
    assert.equal(res1m.planModelQuota.fileFlash.remaining, 2);

    // 3. Nếu LLM fail ở lượt ảnh -> phải hoàn lại lượt ảnh & standard của gói 1m
    shouldFail = true;
    const failRes = await svc.quickAskAssistant({
      user: student1m,
      question: 'Xem ảnh lỗi Excel giúp em',
      attachment: {
        name: 'err.png',
        mimeType: 'image/png',
        dataBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      },
    });
    assert.equal(failRes.source, 'fallback');
    const afterRefund = svc.peekPlanModelQuota({ userRole: 'student' }, student1m);
    assert.equal(afterRefund.image.used, 0);
    assert.equal(afterRefund.standard.used, 0);
  } finally {
    shouldFail = false;
    svc.resetMemoryPlanUsageForTests();
    policySvc.resetPerMinuteRateLimitForTests();
    knowledgeSvc.setKnowledgeRagOverrideForTests(null);
    if (origLlm) require.cache[llmPath] = origLlm;
    else delete require.cache[llmPath];
    if (origSvc) require.cache[svcPath] = origSvc;
    else delete require.cache[svcPath];
  }
});

test('Frontend & API wiring: AdminSubscriptionTab có tab Phân tầng Model AI & AIPackagesView hiển thị Fair-Use', () => {
  const routesCode = read('routes/aiSupportRoutes.js');
  const apiCode = read('client/src/services/api.js');
  const adminTabCode = read('client/src/components/admin/tabs/AdminSubscriptionTab.jsx');
  const policyPanelCode = read('client/src/components/admin/subscription/AdminAiModelPolicyPanel.jsx');
  const pkgDataCode = read('client/src/data/aiPackagesData.js');
  const pkgViewCode = read('client/src/components/ai/AIPackagesView.jsx');
  const meterCode = read('client/src/components/ai/AIQuotaMeter.jsx');

  assert.ok(routesCode.includes('/admin/model-policy'));
  assert.ok(routesCode.includes('planModelQuota'));
  assert.ok(apiCode.includes('getAdminModelPolicy'));
  assert.ok(apiCode.includes('updateAdminModelPolicy'));
  assert.ok(adminTabCode.includes('Phân tầng Model AI'));
  assert.ok(adminTabCode.includes('AdminAiModelPolicyPanel'));
  assert.ok(policyPanelCode.includes('Phân tầng Model AI'));
  assert.ok(policyPanelCode.includes('Fair-Use'));
  assert.ok(pkgDataCode.includes('Gemini Flash'));
  assert.ok(pkgDataCode.includes('Gemini Pro'));
  assert.ok(pkgViewCode.includes('Chính sách Fair-Use'));
  assert.ok(meterCode.includes('planModelQuota'));
});
