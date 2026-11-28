'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const aiPackageService = require('../../services/aiPackageService');
const aiSupportService = require('../../services/aiSupportService');

const ROOT = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('aiPackageService: cấu hình 5 gói AI, ref chuyển khoản và cộng dồn hạn sử dụng', () => {
  const plans = aiPackageService.AI_PACKAGE_PLANS;
  assert.deepEqual(Object.keys(plans), ['1d', '1m', '3m', '6m', '12m']);
  assert.equal(plans['1d'].code, '1D');
  assert.equal(plans['1m'].code, '1M');
  assert.equal(plans['3m'].code, '3M');
  assert.equal(plans['6m'].code, '6M');
  assert.equal(plans['12m'].code, '12M');

  const student = {
    _id: '507f1f77bcf86cd799439011',
    phone: '0984623486',
    studentCode: 'HV001',
  };
  assert.equal(
    aiPackageService.makeAiPackageRef(student, plans['3m']),
    'DEW AI 3M 0984623486',
  );
  assert.equal(
    aiPackageService.makeAiPackageRef({ _id: '507f1f77bcf86cd799439011', studentCode: 'HV88' }, plans['1d']),
    'DEW AI 1D HV88',
  );

  const now = new Date('2026-11-28T03:00:00.000Z');
  const firstExpiry = aiPackageService.computeNextAiPlanExpiry(null, plans['1m'], now);
  assert.equal(firstExpiry.toISOString(), new Date(now.getTime() + 30 * 86400e3).toISOString());

  // Cộng dồn khi đang còn hạn
  const stackedExpiry = aiPackageService.computeNextAiPlanExpiry(
    { isUnlimited: true, expiresAt: firstExpiry },
    plans['1d'],
    now,
  );
  assert.equal(stackedExpiry.toISOString(), new Date(firstExpiry.getTime() + 24 * 3600e3).toISOString());

  assert.equal(
    aiPackageService.hasActiveAiPlan({ aiPlan: { isUnlimited: true, expiresAt: firstExpiry } }, now.getTime()),
    true,
  );
  assert.equal(
    aiPackageService.hasActiveAiPlan({ aiPlan: { isUnlimited: true, expiresAt: '2026-11-01T00:00:00.000Z' } }, now.getTime()),
    false,
  );
});

test('aiSupportService: học viên kích hoạt gói AI Không Giới Hạn không bị trừ % và được gửi ảnh', async () => {
  const futureDate = new Date(Date.now() + 15 * 86400e3).toISOString();
  const unlimitedFreeStudent = {
    role: 'student',
    freePortal: true,
    aiPlan: {
      plan: '3m',
      isUnlimited: true,
      activatedAt: new Date().toISOString(),
      expiresAt: futureDate,
    },
  };

  let saved = false;
  const mockSession = {
    userRole: 'student',
    status: 'ai_active',
    budgetDate: '',
    budgetUsedBp: 0,
    async save() {
      saved = true;
    },
  };

  const peek = aiSupportService.peekQuestionQuota(mockSession, unlimitedFreeStudent);
  assert.equal(peek.isUnlimited, true);
  assert.equal(peek.percentLeft, 100);
  assert.equal(peek.aiPlan.plan, '3m');

  const consumed = await aiSupportService.consumeAiBudgetQuota(mockSession, unlimitedFreeStudent, {
    text: 'Cách dùng SUMIFS trong Excel?',
  });
  assert.equal(consumed.isUnlimited, true);
  assert.equal(consumed.blocked, false);
  assert.equal(consumed.consumedBp, 0);
  assert.equal(consumed.percentLeft, 100);
  assert.equal(saved, false);

  const imgQuota = aiSupportService.peekImageQuota(mockSession, unlimitedFreeStudent);
  assert.equal(imgQuota.allowed, true);
  assert.equal(imgQuota.isUnlimited, true);

  // Hết hạn -> quay lại trừ % bình thường
  const expiredStudent = {
    role: 'student',
    freePortal: true,
    aiPlan: {
      plan: '1d',
      isUnlimited: true,
      expiresAt: '2020-01-01T00:00:00.000Z',
    },
  };
  const expiredConsumed = await aiSupportService.consumeAiBudgetQuota(mockSession, expiredStudent, {
    text: 'VLOOKUP là gì?',
  });
  assert.equal(expiredConsumed.isUnlimited, false);
  assert.equal(expiredConsumed.applies, true);
  assert.ok(expiredConsumed.consumedBp > 0);
  assert.ok(expiredConsumed.percentLeft < 100);
  assert.equal(saved, true);
});

test('Frontend & Backend: cấu hình aiPackagesData, theme isolation DewSkill/Trung tâm và tích hợp CourseEnrollmentModal', async () => {
  const {
    AI_PACKAGES,
    AI_PACKAGE_CARDS,
    buildAiPackageTransferRef,
    formatAiPlanExpiry,
  } = await import('../../client/src/data/aiPackagesData.js');

  assert.deepEqual(Object.keys(AI_PACKAGES), ['1d', '1m', '3m', '6m', '12m']);
  assert.equal(AI_PACKAGE_CARDS.length, 3);
  assert.deepEqual(AI_PACKAGE_CARDS[1].options, ['1m', '3m']);
  assert.deepEqual(AI_PACKAGE_CARDS[2].options, ['6m', '12m']);
  assert.equal(buildAiPackageTransferRef('6m', { phone: '0984623486' }), 'DEW AI 6M 0984623486');
  assert.match(formatAiPlanExpiry('2026-12-25T10:00:00.000Z'), /^\d{2}\/\d{2}\/2026$/);

  const packagesViewCode = read('client/src/components/ai/AIPackagesView.jsx');
  const meterCode = read('client/src/components/ai/AIQuotaMeter.jsx');
  const outModalCode = read('client/src/components/ai/AIOutOfQuotaModal.jsx');
  const hookCode = read('client/src/hooks/useAIQuota.js');
  const enrollCode = read('client/src/components/student/courses/CourseEnrollmentModal.jsx');
  const appCode = read('client/src/App.jsx');
  const authCode = read('middleware/auth.js');
  const webhookCode = read('routes/webhookRoutes.js');
  const pkgSvcCode = read('services/aiPackageService.js');

  // Cô lập theme: dùng helper getDewSkillThemeAttr thay vì gán cứng JSX attribute data-theme="dewskill"
  for (const code of [packagesViewCode, meterCode, outModalCode, enrollCode]) {
    assert.ok(code.includes('getDewSkillThemeAttr'));
    assert.ok(code.includes('data-theme={'));
    assert.equal(code.includes('data-theme="dewskill"') && !code.includes('[data-theme="dewskill"]'), false);
  }

  assert.ok(packagesViewCode.includes('Áp dụng cho Học viên DewSkill &amp; Học viên Trung tâm'));
  assert.ok(packagesViewCode.includes('Nâng cấp gói'));
  assert.ok(packagesViewCode.includes('Đang sử dụng'));
  assert.ok(packagesViewCode.includes('disabled={isDisabled}'));
  assert.ok(packagesViewCode.includes('CourseEnrollmentModal'));
  assert.ok(pkgSvcCode.includes('AI_PLAN_ALREADY_ACTIVE'));
  assert.ok(meterCode.includes('Sẵn sàng'));
  assert.ok(meterCode.includes('Sắp hết · Mua thêm'));
  assert.ok(meterCode.includes('Đã hết · Nâng cấp'));
  assert.ok(meterCode.includes('Không giới hạn'));
  assert.ok(outModalCode.includes('Đã hết dung lượng hỏi AI hôm nay!'));
  assert.ok(outModalCode.includes('Xem &amp; Mua gói không giới hạn'));
  assert.ok(outModalCode.includes('Chờ làm mới vào ngày mai'));
  assert.ok(hookCode.includes('aiPackage:paid'));
  assert.ok(enrollCode.includes('aiPackage'));
  assert.ok(enrollCode.includes('cms:ai-plan-updated'));
  assert.ok(appCode.includes('/student/ai-packages'));
  assert.ok(authCode.includes('/api/ai-support/packages'));
  assert.ok(webhookCode.includes("'ai_package'"));
});

test('SidebarAIPlanCard & AppSidebar: hiển thị đúng 4 trạng thái gói AI và cô lập theme DewSkill/Trung tâm', async () => {
  const { deriveSidebarAiPlan } = await import('../../client/src/utils/sidebarAiPlan.js');

  const nowMs = new Date('2026-11-28T10:00:00.000Z').getTime();

  // 1. Đã đăng ký gói 1 ngày -> remainingDays = 0, remainingHours > 0
  const oneDay = deriveSidebarAiPlan({
    aiQuotaPercent: 100,
    isPaidUnlimited: true,
    nowMs,
    aiPlan: {
      plan: '1d',
      isUnlimited: true,
      activatedAt: '2026-11-28T04:00:00.000Z',
      expiresAt: '2026-11-29T04:00:00.000Z',
    },
  });
  assert.equal(oneDay.isSubscribed, true);
  assert.equal(oneDay.variant, 'subscribed');
  assert.equal(oneDay.planName, 'Gói AI 1 Ngày');
  assert.equal(oneDay.remainingDays, 0);
  assert.equal(oneDay.remainingHours, 18);
  assert.equal(oneDay.timeRemainingPercent, 75);

  // 2. Đã đăng ký gói 3 tháng -> remainingDays > 0
  const threeMonths = deriveSidebarAiPlan({
    aiQuotaPercent: 100,
    isPaidUnlimited: true,
    nowMs,
    aiPlan: {
      plan: '3m',
      isUnlimited: true,
      activatedAt: '2026-11-10T10:00:00.000Z',
      expiresAt: '2027-02-08T10:00:00.000Z',
    },
  });
  assert.equal(threeMonths.isSubscribed, true);
  assert.equal(threeMonths.variant, 'subscribed');
  assert.equal(threeMonths.planName, 'Gói AI 3 Tháng');
  assert.equal(threeMonths.remainingDays, 72);
  assert.equal(threeMonths.timeRemainingPercent, 80);

  // 3. Miễn phí · còn nhiều (> 20%)
  const freeHigh = deriveSidebarAiPlan({ aiQuotaPercent: 85, aiPlan: null, nowMs });
  assert.equal(freeHigh.isSubscribed, false);
  assert.equal(freeHigh.variant, 'free_high');
  assert.equal(freeHigh.quotaPercent, 85);

  // 4. Miễn phí · sắp hết (1-20%)
  const freeLow = deriveSidebarAiPlan({ aiQuotaPercent: 15, aiPlan: null, nowMs });
  assert.equal(freeLow.isSubscribed, false);
  assert.equal(freeLow.variant, 'free_low');
  assert.equal(freeLow.quotaPercent, 15);

  // 5. Miễn phí · đã hết (0%) hoặc gói hết hạn rơi về miễn phí
  const freeEmpty = deriveSidebarAiPlan({
    aiQuotaPercent: 0,
    nowMs,
    aiPlan: { plan: '1m', isUnlimited: true, expiresAt: '2026-11-01T00:00:00.000Z' },
  });
  assert.equal(freeEmpty.isSubscribed, false);
  assert.equal(freeEmpty.variant, 'free_empty');
  assert.equal(freeEmpty.quotaPercent, 0);

  const cardCode = read('client/src/components/ai/SidebarAIPlanCard.jsx');
  const sidebarCode = read('client/src/components/AppSidebar.jsx');
  const dewCssCode = read('client/src/styles/dewdropStudentTheme.css');

  assert.ok(cardCode.includes('getDewSkillThemeAttr'));
  assert.ok(cardCode.includes('data-theme={'));
  assert.equal(cardCode.includes('data-theme="dewskill"') && !cardCode.includes('[data-theme="dewskill"]'), false);

  for (const text of [
    'Không giới hạn',
    'Gói AI Miễn phí',
    'Hết dung lượng AI',
    'Sắp hết dung lượng',
    'Nâng cấp không giới hạn',
    'Gia hạn',
    'Nâng cấp',
    'Mua gói',
  ]) {
    assert.ok(cardCode.includes(text), `SidebarAIPlanCard thiếu "${text}"`);
  }

  assert.ok(sidebarCode.includes('SidebarAIPlanCard'));
  assert.ok(sidebarCode.includes('useAIQuota'));
  assert.ok(sidebarCode.includes('deriveSidebarAiPlan'));
  assert.ok(dewCssCode.includes('[data-theme="dewskill"].dew-sidebar-ai-card'));
});

test('Hồ sơ & Luyện tập: chuyển Gói học Meet/Ví XP sang Gói hỗ trợ AI và giữ nguyên XP Học tập', () => {
  const profileTabCode = read('client/src/components/student/StudentProfileTab.jsx');
  const subProfileCardCode = read('client/src/components/student/subscription/SubscriptionProfileCard.jsx');
  const heroCode = read('client/src/components/student/dailyPractice/DailyPracticeHero.jsx');
  const dpPageCode = read('client/src/components/student/dailyPractice/DailyPracticePage.jsx');
  const readyModalCode = read('client/src/components/student/dailyPractice/PracticeReadyModal.jsx');
  const chestCode = read('client/src/components/student/dailyPractice/UnitStageChest.jsx');
  const dpUtilCode = read('client/src/utils/dailyPractice.js');
  const buyXpModalCode = read('client/src/components/student/dailyPractice/BuyXpModal.jsx');

  // Hồ sơ học viên: Gói hỗ trợ AI thay cho Gói học Meet
  for (const code of [profileTabCode, subProfileCardCode]) {
    assert.ok(code.includes('Gói hỗ trợ AI'));
    assert.ok(code.includes('useAIQuota'));
    assert.equal(code.includes('Gói học Meet'), false);
    assert.equal(code.includes('Lịch sử mua XP'), false);
  }

  // Các chỗ Ví XP -> Hỗ trợ AI, giữ nguyên XP Học tập
  assert.ok(heroCode.includes('Hỗ trợ AI'));
  assert.ok(heroCode.includes('XP Học tập'));
  assert.ok(readyModalCode.includes('Hỗ trợ AI'));
  assert.ok(readyModalCode.includes('XP Học tập'));
  assert.ok(dpUtilCode.includes('XP Học tập'));
  assert.ok(chestCode.includes('XP Học tập'));
  assert.ok(buyXpModalCode.includes('AIPackagesView'));

  for (const code of [heroCode, dpPageCode, readyModalCode, chestCode, dpUtilCode]) {
    assert.equal(code.includes('Ví XP'), false);
  }
});

test('Đổi mật khẩu, Hồ sơ học viên, Khóa mã PIN & Tin nhắn dùng nút Giọt Nước 3D cô lập [data-theme="dewskill"]', () => {
  const layoutCode = read('client/src/components/DashboardLayout.jsx');
  const pinCode = read('client/src/components/pinLock/PinLockSettingsModal.jsx');
  const profileCode = read('client/src/components/student/StudentProfileTab.jsx');
  const inboxCode = read('client/src/components/Inbox.jsx');

  assert.ok(layoutCode.includes('dew-btn-primary'));
  for (const code of [pinCode, profileCode, inboxCode]) {
    assert.ok(code.includes('getDewSkillThemeAttr'));
    assert.ok(code.includes('data-theme={'));
    assert.equal(code.includes('data-theme="dewskill"'), false);
    assert.ok(code.includes('dew-btn-primary'));
    assert.ok(code.includes('dew-btn-white'));
  }
});
