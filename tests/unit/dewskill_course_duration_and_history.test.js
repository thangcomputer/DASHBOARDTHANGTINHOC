'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DewskillClass = require('../../models/DewskillClass');
const StudentDewskillClassAccess = require('../../models/StudentDewskillClassAccess');
const DewskillClassPurchaseLog = require('../../models/DewskillClassPurchaseLog');
const dewskillClassService = require('../../services/dewskillClassService');
const subscriptionService = require('../../services/subscriptionService');

const ROOT = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('computeCourseExpiry cộng chuẩn 12 tháng khi mua mới, cuối tháng và cộng nối khi còn hạn', () => {
  const start = new Date('2026-11-28T08:00:00.000Z');
  const exp1 = dewskillClassService.computeCourseExpiry(null, 12, start);
  assert.equal(exp1.getUTCFullYear(), 2027);
  assert.equal(exp1.getUTCMonth(), 10); // tháng 11 (0-based 10)

  // Đang còn hạn -> cộng nối thêm 12 tháng từ mốc hạn cũ
  const exp2 = dewskillClassService.computeCourseExpiry(exp1, 12, new Date('2026-12-15T08:00:00.000Z'));
  assert.equal(exp2.getUTCFullYear(), 2028);

  // Đã hết hạn -> tính lại 12 tháng từ hiện tại
  const past = new Date('2025-01-01T00:00:00.000Z');
  const now = new Date('2026-11-28T08:00:00.000Z');
  const exp3 = dewskillClassService.computeCourseExpiry(past, 12, now);
  assert.equal(exp3.getUTCFullYear(), 2027);
});

test('getCourseTimeRemaining tính đúng số ngày còn lại, cảnh báo sắp hết hạn và trạng thái hết hạn', async () => {
  const { getCourseTimeRemaining } = await import('../../client/src/utils/courseAccessTime.js');
  const now = new Date('2026-11-28T08:00:00.000Z');

  const fullYear = getCourseTimeRemaining('2027-11-28T08:00:00.000Z', now);
  assert.equal(fullYear.hasExpiry, true);
  assert.equal(fullYear.isExpired, false);
  assert.equal(fullYear.isExpiringSoon, false);
  assert.equal(fullYear.daysLeft, 365);
  assert.match(fullYear.shortNote, /Còn 365 ngày/);
  assert.match(fullYear.detailNote, /Còn 365 ngày · Hết hạn/);

  const soon = getCourseTimeRemaining('2026-12-10T08:00:00.000Z', now);
  assert.equal(soon.isExpiringSoon, true);
  assert.equal(soon.daysLeft, 12);

  const expired = getCourseTimeRemaining('2026-11-27T08:00:00.000Z', now);
  assert.equal(expired.isExpired, true);
  assert.equal(expired.daysLeft, 0);
  assert.match(expired.detailNote, /Đã khóa & đặt lại về ban đầu/);
});

test('hasMeetAccess & hasMeetAccessClient mở quyền học Meet khi sở hữu khóa học còn hạn', async () => {
  const { hasMeetAccessClient } = await import('../../client/src/utils/subscription.js');
  const now = new Date('2026-11-28T08:00:00.000Z');
  const freeStudent = { freePortal: true, subscription: {} };

  assert.equal(subscriptionService.hasMeetAccess(freeStudent, now, null), false);
  assert.equal(
    subscriptionService.hasMeetAccess(freeStudent, now, {
      hasOwnedClass: true,
      includesMeet: true,
      ownedClassCount: 1,
      dailyXpAllowance: 100,
    }),
    true
  );

  assert.equal(hasMeetAccessClient({ state: 'free', freeTier: true }), false);
  assert.equal(
    hasMeetAccessClient({ state: 'course', hasOwnedClass: true, hasCourseMeetAccess: true }),
    true
  );
  assert.equal(
    hasMeetAccessClient({ state: 'course', hasOwnedClass: true, hasCourseMeetAccess: false }),
    false
  );
});

test('Models, cron hết hạn & service reset tiến độ khi hết hạn 12 tháng', () => {
  assert.equal(DewskillClass.schema.path('durationMonths').defaultValue, 12);
  assert.equal(DewskillClass.schema.path('includesMeet').defaultValue, true);
  assert.ok(StudentDewskillClassAccess.schema.path('purchasedAt'));
  assert.ok(StudentDewskillClassAccess.schema.path('expiredResetAt'));
  assert.ok(DewskillClassPurchaseLog.schema.path('courseName'));
  assert.ok(DewskillClassPurchaseLog.schema.path('expiresAt'));

  const classServiceSrc = read('services/dewskillClassService.js');
  assert.ok(classServiceSrc.includes('enforceExpiredCourseAccessAndReset'));
  assert.ok(classServiceSrc.includes('DailyPracticePathProgress.deleteMany'));
  assert.ok(classServiceSrc.includes('DailyPracticeSession.deleteMany'));
  assert.ok(classServiceSrc.includes('DewskillClassPurchaseLog.create'));
  assert.ok(classServiceSrc.includes('listMyPurchaseHistory'));

  const routeSrc = read('routes/dewskillClassRoutes.js');
  assert.ok(routeSrc.includes("router.get('/my/purchase-history'"));

  const serverSrc = read('server.js');
  assert.ok(serverSrc.includes('enforceExpiredCourseAccessAndReset'));
});

test('UI modal kích hoạt, xem trước khóa học, danh mục và hồ sơ hiển thị 12 tháng, Meet GV, note thời gian & lịch sử mua', () => {
  const enrollModal = read('client/src/components/student/courses/CourseEnrollmentModal.jsx');
  assert.equal(enrollModal.includes('Truy cập không giới hạn'), false);
  assert.ok(enrollModal.includes('Thời hạn ${courseDurationMonths} tháng'));
  assert.ok(enrollModal.includes('Meet cùng giảng viên'));
  assert.ok(enrollModal.includes('getCourseTimeRemaining'));

  const previewModal = read('client/src/components/student/courses/CoursePreviewModal.jsx');
  assert.ok(previewModal.includes('getCourseTimeRemaining'));
  assert.ok(previewModal.includes('Có học Meet cùng GV'));

  const catalogPage = read('client/src/components/student/courses/StudentCoursesCatalogPage.jsx');
  assert.ok(catalogPage.includes('getCourseTimeRemaining'));
  assert.ok(catalogPage.includes('Meet GV'));

  const profileTab = read('client/src/components/student/StudentProfileTab.jsx');
  assert.equal(profileTab.includes('formatProfileDate'), false);
  assert.ok(profileTab.includes('Lịch sử thanh toán'));
  assert.ok(profileTab.includes('coursePurchases.slice(0, 1)'));
  assert.ok(profileTab.includes('myPurchaseHistory'));
  assert.ok(profileTab.includes('getCourseTimeRemaining'));
  assert.ok(profileTab.includes('cms:ai-plan-updated'));
  assert.ok(profileTab.includes("isAi ? 'Gói AI' : 'Khóa học'"));
});

test('Mua Gói AI được ghi vào DewskillClassPurchaseLog và gộp trong listMyPurchaseHistory', () => {
  assert.ok(DewskillClassPurchaseLog.schema.path('purchaseType'));
  assert.deepEqual(DewskillClassPurchaseLog.schema.path('purchaseType').enumValues, ['course', 'ai_package']);
  assert.ok(!DewskillClassPurchaseLog.schema.path('classId').isRequired);

  const aiPkgSrc = read('services/aiPackageService.js');
  assert.ok(aiPkgSrc.includes('DewskillClassPurchaseLog.create'));
  assert.ok(aiPkgSrc.includes("purchaseType: 'ai_package'"));

  const classServiceSrc = read('services/dewskillClassService.js');
  assert.ok(classServiceSrc.includes('aiLedgerRows'));
  assert.ok(classServiceSrc.includes("purchaseType: 'ai_package'"));
  assert.ok(classServiceSrc.includes('studentDoc?.aiPlan'));
});

test('Thông báo mua Khóa học & Gói AI có đủ thời gian mua, sản phẩm, số tiền, hạn sử dụng và nút Xem thêm khi dài', () => {
  const { buildPurchaseNotification } = require('../../services/purchaseNotificationHelper');
  const purchasedAt = new Date('2026-11-28T09:15:00.000Z');
  const expiresAt = new Date('2027-11-28T09:15:00.000Z');

  const courseNotif = buildPurchaseNotification({
    purchaseType: 'course',
    itemName: 'Tin học Lớp 1–2 (Khởi động)',
    amount: 1699000,
    source: 'payment',
    purchasedAt,
    durationText: '12 tháng',
    expiresAt,
    includesMeet: true,
    paymentRef: 'DS 123 THL12',
  });
  assert.equal(courseNotif.type, 'FINANCE');
  assert.equal(courseNotif.payload.kind, 'dewskill_course_paid');
  assert.match(courseNotif.content, /Sản phẩm: Tin học Lớp 1–2/);
  assert.match(courseNotif.content, /Thời gian mua:/);
  assert.match(courseNotif.content, /Số tiền: 1[.,]699[.,]000đ/);
  assert.match(courseNotif.content, /Hạn sử dụng: 12 tháng/);
  assert.match(courseNotif.content, /Google Meet/);

  const aiNotif = buildPurchaseNotification({
    purchaseType: 'ai_package',
    itemName: 'Gói Hỏi AI Tiêu Chuẩn · 3 Tháng',
    amount: 149000,
    source: 'payment',
    purchasedAt,
    durationText: '3 tháng',
    expiresAt: new Date('2027-02-27T09:15:00.000Z'),
  });
  assert.equal(aiNotif.payload.kind, 'ai_package_paid');
  assert.match(aiNotif.content, /149[.,]000đ/);
  assert.match(aiNotif.content, /Hạn sử dụng: 3 tháng/);

  const classSvc = read('services/dewskillClassService.js');
  assert.ok(classSvc.includes('buildPurchaseNotification'));
  assert.ok(classSvc.includes('NotificationService.send'));

  const aiSvc = read('services/aiPackageService.js');
  assert.ok(aiSvc.includes('buildPurchaseNotification'));
  assert.ok(aiSvc.includes('NotificationService.send'));

  const layout = read('client/src/components/DashboardLayout.jsx');
  assert.ok(layout.includes('PurchaseNotificationReceipt'));
  assert.ok(layout.includes('isLongNotificationText'));
  assert.ok(layout.includes('line-clamp-2'));
  assert.ok(layout.includes("isExpanded ? 'Thu gọn' : 'Xem thêm'"));

  const center = read('client/src/components/NotificationCenterPage.jsx');
  assert.ok(center.includes('PurchaseNotificationReceipt'));
  assert.ok(center.includes('Xem thêm ›'));
});
