'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rules = require('../../services/dailyPracticeRules');
const subscriptionService = require('../../services/subscriptionService');
const aiXpBillingService = require('../../services/aiXpBillingService');

const ROOT = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('statusOf & allowanceForSubscription: phân tách tài khoản miễn phí, khóa học theo môn (VD 100 XP/ngày) và gói tháng/năm', () => {
  const now = new Date('2026-11-28T03:00:00.000Z');
  const xpConfig = {
    freeAccountXp: 40,
    courseAccountXp: 200,
    planXp: { '1m': 400, '3m': 500, '6m': 600, '12m': 800, lifetime: 1000 },
    resetCycle: 'daily',
    aiQuestionCostXp: 10,
    aiImageCostXp: 20,
  };

  // 1. Tài khoản miễn phí chưa đăng ký khóa học theo môn và chưa mua gói tháng/năm
  const freeStudent = { freePortal: true, subscription: {} };
  const freeStatus = subscriptionService.statusOf(freeStudent, now, xpConfig, { hasOwnedClass: false });
  assert.equal(freeStatus.freeTier, true);
  assert.equal(freeStatus.state, 'free');
  assert.equal(freeStatus.dailyXpLimit, 40);
  assert.equal(rules.allowanceForSubscription(freeStatus, freeStudent, xpConfig), 40);

  // 2. Học viên đăng ký khóa học Lớp 1 (Admin cài 100 XP/ngày)
  const class1Owned = {
    hasOwnedClass: true,
    ownedClassCount: 1,
    dailyXpAllowance: 100,
    primaryClassName: 'Tin học Lớp 1–2 (Khởi động)',
  };
  const courseStatus = subscriptionService.statusOf(freeStudent, now, xpConfig, class1Owned);
  assert.equal(courseStatus.freeTier, false);
  assert.equal(courseStatus.state, 'course');
  assert.equal(courseStatus.hasOwnedClass, true);
  assert.equal(courseStatus.dailyXpLimit, 100);
  assert.equal(rules.allowanceForSubscription(courseStatus, freeStudent, xpConfig), 100);

  // 3. Học viên có cả gói Meet 1 tháng (400 XP) và khóa học Lớp 1 (100 XP) -> lấy mức cao hơn (400 XP)
  const paidPlanStudent = {
    freePortal: true,
    subscription: {
      plan: '1m',
      expiresAt: new Date('2026-12-28T03:00:00.000Z'),
      activatedAt: new Date('2026-11-20T03:00:00.000Z'),
    },
  };
  const paidWithClassStatus = subscriptionService.statusOf(paidPlanStudent, now, xpConfig, class1Owned);
  assert.equal(paidWithClassStatus.freeTier, false);
  assert.equal(paidWithClassStatus.state, 'active');
  assert.equal(paidWithClassStatus.dailyXpLimit, 400);
  assert.equal(rules.allowanceForSubscription(paidWithClassStatus, paidPlanStudent, xpConfig), 400);
});

test('aiXpBillingService: tính chi phí XP cho AI (text/ảnh) và phân nhánh gợi ý khi hết XP', () => {
  const xpConfig = { aiQuestionCostXp: 10, aiImageCostXp: 20 };
  assert.equal(aiXpBillingService.resolveAiActionCostXp(xpConfig, { hasImage: false }), 10);
  assert.equal(aiXpBillingService.resolveAiActionCostXp(xpConfig, { hasImage: true }), 20);

  // Tài khoản miễn phí: nếu hết XP (test buildInsufficientXpError fallback -> upgrade_plan), còn quota 2 câu/ngày sẽ hiển thị theo số câu miễn phí còn lại
  const freeWalletEmpty = aiXpBillingService.buildWalletView({
    profile: { xpTotal: 5, dailyXp: 5, purchasedXp: 0, xpAllowanceAmount: 40 },
    xpConfig,
    subStatus: { freeTier: true, dailyXpLimit: 40, plan: 'free', planLabel: 'Miễn phí' },
  });
  const freeErr = aiXpBillingService.buildInsufficientXpError({
    costXp: 10,
    currentXp: 5,
    dailyAllowanceXp: 40,
    isFreeTier: true,
    wallet: freeWalletEmpty,
  });
  assert.equal(freeErr.status, 402);
  assert.equal(freeErr.code, 'AI_XP_INSUFFICIENT');
  assert.equal(freeErr.suggestedAction, 'upgrade_plan');
  assert.match(freeErr.message, /gói tháng\/năm/i);
  const freeView = aiXpBillingService.formatXpQuotaView(freeWalletEmpty);
  assert.equal(freeView.mode, 'xp');
  assert.equal(freeView.remaining, 2);
  assert.equal(freeView.limit, 2);
  assert.equal(freeView.percentLeft, 100);
  const freeExhaustedView = aiXpBillingService.formatXpQuotaView({
    ...freeWalletEmpty,
    freeUsedToday: 2,
    freeRemainingToday: 0,
    freeLimitReached: true,
    suggestedAction: 'register_course',
  });
  assert.equal(freeExhaustedView.percentLeft, 0);
  assert.equal(freeExhaustedView.suggestedAction, 'register_course');

  // Học viên đã đăng ký khóa học theo môn (100 XP/ngày) hết XP -> suggestedAction = 'buy_xp' (bắt mua thêm XP)
  const courseWalletEmpty = aiXpBillingService.buildWalletView({
    profile: { xpTotal: 0, dailyXp: 0, purchasedXp: 0, xpAllowanceAmount: 100 },
    xpConfig,
    subStatus: {
      freeTier: false,
      hasOwnedClass: true,
      ownedClassName: 'Tin học Lớp 1–2',
      dailyXpLimit: 100,
      plan: 'course',
    },
  });
  const courseErr = aiXpBillingService.buildInsufficientXpError({
    costXp: 10,
    currentXp: 0,
    dailyAllowanceXp: 100,
    isFreeTier: false,
    wallet: courseWalletEmpty,
  });
  assert.equal(courseErr.status, 402);
  assert.equal(courseErr.code, 'AI_XP_INSUFFICIENT');
  assert.equal(courseErr.suggestedAction, 'buy_xp');
  assert.match(courseErr.message, /mua thêm gói XP/i);
});

test('UI Admin & Học viên cấu hình XP khóa học, chi phí AI XP và phân nhánh Mua XP / Nâng cấp gói', async () => {
  const { isLowXpForBuyPrompt } = await import('../../shared/subscription/xpDailyLine.mjs');
  assert.equal(isLowXpForBuyPrompt({ xpTotal: 200 }), false);
  assert.equal(isLowXpForBuyPrompt({ xpTotal: 100 }), false);
  assert.equal(isLowXpForBuyPrompt({ xpTotal: 10 }), false);
  assert.equal(isLowXpForBuyPrompt({ xpTotal: 9 }), true);
  assert.equal(isLowXpForBuyPrompt({ xpTotal: 0 }), true);
  assert.equal(isLowXpForBuyPrompt(null), false);

  const classFormCode = read('client/src/components/admin/dewskillClasses/DewskillClassFormModal.jsx');
  const subTabCode = read('client/src/components/admin/tabs/AdminSubscriptionTab.jsx');
  const sidebarCode = read('client/src/components/AppSidebar.jsx');
  const paletteCode = read('client/src/components/ui/CommandPalette.jsx');
  const gateCode = read('client/src/components/student/subscription/SubscriptionGate.jsx');
  const lockCode = read('client/src/components/student/dailyPractice/FreeFeatureLock.jsx');
  const subUtilCode = read('client/src/utils/subscription.js');
  const classSvcCode = read('services/dewskillClassService.js');
  const dpSvcCode = read('services/dailyPracticeService.js');
  const feedRoutesCode = read('routes/feedRoutes.js');

  assert.ok(classFormCode.includes('dailyXpAllowance'));
  assert.ok(subTabCode.includes('aiQuestionCostXp'));
  assert.ok(subTabCode.includes('aiImageCostXp'));
  assert.ok(sidebarCode.includes('SidebarAIPlanCard'));
  assert.ok(sidebarCode.includes('useAIQuota'));
  assert.ok(lockCode.includes('sub.hasOwnedClass'));
  assert.ok(subUtilCode.includes("sub.state === 'course'"));
  assert.ok(classSvcCode.includes('unlockFreePortal'));
  assert.ok(dpSvcCode.includes('hasOwnedClass'));
  assert.ok(feedRoutesCode.includes('getStudentOwnedClassXpSummary'));
  assert.ok(paletteCode.includes('AI_XP_INSUFFICIENT'));
  assert.ok(gateCode.includes('cms:open-buy-xp'));
  assert.ok(gateCode.includes('cms:open-upgrade-plan'));

  const heroCode = read('client/src/components/student/dailyPractice/DailyPracticeHero.jsx');
  const readyModalCode = read('client/src/components/student/dailyPractice/PracticeReadyModal.jsx');
  const buyXpCode = read('client/src/components/student/dailyPractice/BuyXpModal.jsx');
  const aiUsageCode = read('client/src/components/ui/AiUsageIndicator.jsx');
  assert.ok(heroCode.includes('studyXpTotal'));
  assert.ok(heroCode.includes('XP Học tập'));
  assert.ok(heroCode.includes('Hỗ trợ AI'));
  assert.equal(heroCode.includes('Ví XP'), false);
  assert.ok(readyModalCode.includes('Hỗ trợ AI'));
  assert.equal(readyModalCode.includes('Ví XP'), false);
  assert.ok(buyXpCode.includes('AIPackagesView'));
  assert.ok(aiUsageCode.includes('Đăng ký khóa học'));
});

test('refillDailyXp được export và tài khoản miễn phí giới hạn tối đa 2 câu AI/ngày với gợi ý đăng ký khóa học', () => {
  const dailyPracticeService = require('../../services/dailyPracticeService');
  assert.equal(typeof dailyPracticeService.refillDailyXp, 'function');
  assert.equal(aiXpBillingService.FREE_AI_DAILY_QUESTION_LIMIT, 2);

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const xpConfig = { aiQuestionCostXp: 10, aiImageCostXp: 20 };

  const free1 = aiXpBillingService.buildWalletView({
    profile: { xpTotal: 0, dailyXp: 0, purchasedXp: 0, xpAllowanceAmount: 40, aiFreeAskDay: today, aiFreeAskCount: 1 },
    xpConfig,
    subStatus: { freeTier: true, dailyXpLimit: 40, plan: 'free', planLabel: 'Miễn phí' },
  });
  assert.equal(free1.freeDailyLimit, 2);
  assert.equal(free1.freeUsedToday, 1);
  assert.equal(free1.freeRemainingToday, 1);
  assert.equal(free1.freeLimitReached, false);
  assert.equal(aiXpBillingService.isWalletBlockedForAi(free1, { hasImage: false }), false);

  const free2 = aiXpBillingService.buildWalletView({
    profile: { xpTotal: 0, dailyXp: 0, purchasedXp: 0, xpAllowanceAmount: 40, aiFreeAskDay: today, aiFreeAskCount: 2 },
    xpConfig,
    subStatus: { freeTier: true, dailyXpLimit: 40, plan: 'free', planLabel: 'Miễn phí' },
  });
  assert.equal(free2.freeRemainingToday, 0);
  assert.equal(free2.freeLimitReached, true);
  assert.equal(free2.suggestedAction, 'register_course');
  assert.equal(aiXpBillingService.isWalletBlockedForAi(free2, { hasImage: false }), true);

  const freeBlockedErr = aiXpBillingService.buildInsufficientXpError({
    costXp: 10,
    currentXp: 0,
    dailyAllowanceXp: 40,
    isFreeTier: true,
    freeLimitReached: true,
    freeDailyLimit: 2,
    wallet: free2,
  });
  assert.equal(freeBlockedErr.status, 402);
  assert.equal(freeBlockedErr.code, 'AI_XP_INSUFFICIENT');
  assert.equal(freeBlockedErr.freeLimitReached, true);
  assert.equal(freeBlockedErr.suggestedAction, 'register_course');
  assert.match(freeBlockedErr.message, /2\/2 câu hỏi AI miễn phí/i);
  assert.match(freeBlockedErr.message, /đăng ký khóa học/i);

  const courseOk = aiXpBillingService.buildWalletView({
    profile: { xpTotal: 200, dailyXp: 100, purchasedXp: 100, xpAllowanceAmount: 100 },
    xpConfig,
    subStatus: { freeTier: false, hasOwnedClass: true, ownedClassName: 'Tin học Văn phòng', dailyXpLimit: 100, plan: 'course' },
  });
  assert.equal(courseOk.freeDailyLimit, 0);
  assert.equal(aiXpBillingService.isWalletBlockedForAi(courseOk, { hasImage: false }), false);
});
