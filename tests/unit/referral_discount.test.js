'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const referralConfigService = require('../../services/referralConfigService');

const ROOT = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('referralConfigService: cấu hình mặc định giảm 50K, sanitize an toàn và tính giảm giá chính xác', () => {
  const def = referralConfigService.DEFAULT_REFERRAL_CONFIG;
  assert.equal(def.enabled, true);
  assert.equal(def.discountAmountVnd, 50000);
  assert.equal(def.referrerRewardVnd, 50000);
  assert.equal(def.minOrderAmountVnd, 100000);
  assert.equal(def.applyToCourses, true);
  assert.equal(def.applyToAiPackages, false);

  assert.equal(referralConfigService.formatShortVnd(50000), '50K');
  assert.equal(referralConfigService.formatShortVnd(100000), '100K');
  assert.equal(referralConfigService.formatShortVnd(0), '0đ');

  const sanitized = referralConfigService.sanitizeReferralConfig({
    enabled: false,
    discountAmountVnd: -500,
    referrerRewardVnd: 99999999,
    minOrderAmountVnd: 150000,
    maxReferralsPerDay: 0,
  });
  assert.equal(sanitized.enabled, false);
  assert.equal(sanitized.discountAmountVnd, 0);
  assert.equal(sanitized.referrerRewardVnd, 5000000);
  assert.equal(sanitized.minOrderAmountVnd, 150000);
  assert.equal(sanitized.maxReferralsPerDay, 1);

  // Khóa học 1.699.000đ dùng mã giảm 50K -> còn 1.649.000đ
  const resCourse = referralConfigService.calculateReferralDiscount({
    basePrice: 1699000,
    availableDiscountVnd: 50000,
    config: def,
    target: 'course',
  });
  assert.equal(resCourse.appliedDiscountVnd, 50000);
  assert.equal(resCourse.finalAmount, 1649000);

  // Đơn dưới mức tối thiểu (100K) -> không trừ
  const resTooSmall = referralConfigService.calculateReferralDiscount({
    basePrice: 89000,
    availableDiscountVnd: 50000,
    config: def,
    target: 'course',
  });
  assert.equal(resTooSmall.appliedDiscountVnd, 0);
  assert.equal(resTooSmall.finalAmount, 89000);

  // Tắt chương trình -> không trừ
  const resDisabled = referralConfigService.calculateReferralDiscount({
    basePrice: 1699000,
    availableDiscountVnd: 50000,
    config: { ...def, enabled: false },
    target: 'course',
  });
  assert.equal(resDisabled.appliedDiscountVnd, 0);
  assert.equal(resDisabled.finalAmount, 1699000);

  // Gói AI mặc định không trừ, nếu bật applyToAiPackages thì trừ
  const resAiOff = referralConfigService.calculateReferralDiscount({
    basePrice: 149000,
    availableDiscountVnd: 50000,
    config: def,
    target: 'ai_package',
  });
  assert.equal(resAiOff.appliedDiscountVnd, 0);

  const resAiOn = referralConfigService.calculateReferralDiscount({
    basePrice: 149000,
    availableDiscountVnd: 50000,
    config: { ...def, applyToAiPackages: true },
    target: 'ai_package',
  });
  assert.equal(resAiOn.appliedDiscountVnd, 50000);
  assert.equal(resAiOn.finalAmount, 99000);

  // Trần mỗi đơn + luôn giữ lại tối thiểu 10.000đ cho VietQR
  const resFloor = referralConfigService.calculateReferralDiscount({
    basePrice: 40000,
    availableDiscountVnd: 150000,
    config: { ...def, minOrderAmountVnd: 0, discountAmountVnd: 100000 },
    target: 'course',
  });
  assert.equal(resFloor.appliedDiscountVnd, 30000);
  assert.equal(resFloor.finalAmount, 10000);
});

test('Frontend & Admin wiring: chuyển thẻ giới thiệu sang Giảm giá 50K, Admin cấu hình được và cô lập theme Admin', () => {
  const overview = read('client/src/components/student/StudentOverviewTab.jsx');
  const enrollModal = read('client/src/components/student/courses/CourseEnrollmentModal.jsx');
  const adminPanel = read('client/src/components/admin/subscription/AdminReferralConfigPanel.jsx');
  const adminSubTab = read('client/src/components/admin/tabs/AdminSubscriptionTab.jsx');
  const adminClassesTab = read('client/src/components/admin/tabs/AdminDewskillClassesTab.jsx');

  assert.equal(overview.includes('Giới thiệu bạn bè · Nhận thưởng XP'), false);
  assert.equal(overview.includes('Nhận XP'), false);
  assert.ok(overview.includes('Giới thiệu bạn bè · Giảm ${referralShortDiscount}'));
  assert.ok(overview.includes('Nhận giảm ${referralShortDiscount}'));
  assert.ok(enrollModal.includes('referralDiscountVnd'));
  assert.ok(enrollModal.includes('Ưu đãi giới thiệu'));

  assert.equal(adminPanel.includes('data-theme="dewskill"'), false);
  assert.ok(adminPanel.includes('getReferralConfig'));
  assert.ok(adminPanel.includes('setReferralConfig'));
  assert.ok(adminSubTab.includes('AdminReferralConfigPanel'));
  assert.ok(adminClassesTab.includes('AdminReferralConfigPanel'));

  const mobileCard = read('thang-tin-hoc-mobile/src/components/ReferralRewardCard.tsx');
  assert.equal(mobileCard.includes('Giới thiệu bạn bè · Nhận thưởng XP'), false);
  assert.equal(mobileCard.includes("'Nhận XP'"), false);
  assert.ok(mobileCard.includes('discountAmountVnd'));
  assert.ok(mobileCard.includes('Nhận giảm ${shortDiscount}'));

  const classServiceCode = read('services/dewskillClassService.js');
  const aiPkgServiceCode = read('services/aiPackageService.js');
  assert.ok(classServiceCode.includes("require('../models/DailyPracticeProfile')"));
  assert.ok(aiPkgServiceCode.includes("require('../models/DailyPracticeProfile')"));
});
