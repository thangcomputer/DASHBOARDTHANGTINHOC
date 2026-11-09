'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const { isSubscriptionExpired, isAllowedWhenExpired } = require('../../middleware/auth');

test('middleware: chỉ HV có hạn đã qua mới bị chặn; vẫn vào được auth / gia hạn / thông báo', () => {
  const now = Date.now();
  assert.equal(isSubscriptionExpired({}), false, 'HV cũ thiếu trường = vĩnh viễn');
  assert.equal(isSubscriptionExpired({ subscription: { plan: 'lifetime', expiresAt: new Date(now - 1000) } }), false);
  assert.equal(isSubscriptionExpired({ subscription: { plan: '1m', expiresAt: new Date(now + 60000) } }), false);
  assert.equal(isSubscriptionExpired({ subscription: { plan: '1m', expiresAt: new Date(now - 1000) } }), true);

  const allowed = (url) => isAllowedWhenExpired({ originalUrl: url });
  assert.equal(allowed('/api/auth/me'), true);
  assert.equal(allowed('/api/subscription/my'), true);
  assert.equal(allowed('/api/subscription/my/redeem?x=1'), true);
  assert.equal(allowed('/api/notifications'), true);
  assert.equal(allowed('/api/subscription/codes'), false, 'API admin không mở cho HV hết hạn');
  assert.equal(allowed('/api/lesson-practice/my/subjects'), false);
  assert.equal(allowed('/api/daily-practice/my/overview'), false);
  assert.equal(allowed('/api/messages/conversations'), true, 'hết hạn vẫn chat 1 kèm 1');
  assert.equal(allowed('/api/schedules'), true);
  assert.equal(allowed('/api/students/abc/exam-attempt/submit'), false, 'bài thi tự học vẫn khóa');
});

test('server: route gói tài khoản, webhook SePay gia hạn, cron nhắc', () => {
  const server = read('server.js');
  assert.ok(server.includes("app.use('/api/subscription', require('./routes/subscriptionRoutes'))"));
  assert.ok(server.includes('sendExpiryReminders'));
  const webhook = read('routes/webhookRoutes.js');
  assert.ok(webhook.includes("'subscription_renewal'"));
  assert.ok(webhook.includes('fulfillSubscriptionPayment'));
  const routes = read('routes/subscriptionRoutes.js');
  for (const route of ["router.get('/my'", "router.post('/my/redeem'", "router.post('/my/checkout'", "router.post('/codes'", "router.put('/students/:id'"]) {
    assert.ok(routes.includes(route), route);
  }
  const auth = read('routes/authRoutes.js');
  assert.ok(auth.includes('subscriptionStatusOf('), 'login + /me trả trạng thái gói');
});

test('web: HV hết hạn chỉ thấy màn gia hạn; hạn ở sidebar + hồ sơ; admin có tab mã', () => {
  assert.ok(read('client/src/components/student/StudentLearningAccessGate.jsx').includes('<SubscriptionGate session={sessionProp}>'));
  const gate = read('client/src/components/student/subscription/SubscriptionGate.jsx');
  assert.ok(gate.includes('SelfStudyLock'));
  assert.ok(gate.includes('<ExpiredScreen'));
  assert.ok(gate.includes('SUBSCRIPTION_EXPIRED_EVENT'));
  assert.ok(read('client/src/services/api.js').includes('SUBSCRIPTION_EXPIRED'));
  const sidebar = read('client/src/components/AppSidebar.jsx');
  assert.ok(sidebar.includes('subscriptionShortLabel(studentSubscription.subscription)'));
  assert.ok(sidebar.includes("hash: 'subscription-codes'"));
  assert.ok(
    read('client/src/components/student/StudentProfileTab.jsx').includes('<SubscriptionProfileCard')
    || read('client/src/components/student/StudentProfileTab.jsx').includes('Gói học Meet')
  );
  assert.ok(read('client/src/components/AdminDashboard.jsx').includes("activeTab === 'subscription-codes'"));
});

test('mobile: màn gia hạn khi hết hạn, thẻ hạn ở hồ sơ + drawer, bắt 403 hết hạn', () => {
  const nav = read('thang-tin-hoc-mobile/src/navigation/RootNavigator.tsx');
  assert.ok(nav.includes("subscription?.subscription.state === 'expired'"));
  assert.ok(nav.includes('<SubscriptionExpiredScreen />'));
  assert.ok(nav.includes('<SubscriptionStatusCard compact'));
  assert.ok(read('thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx').includes('<SubscriptionStatusCard />'));
  const client = read('thang-tin-hoc-mobile/src/services/apiClient.ts');
  assert.ok(client.includes("DeviceEventEmitter.emit('mobile:subscription-expired')"));
  const auth = read('thang-tin-hoc-mobile/src/app/AuthContext.tsx');
  assert.ok(auth.includes("'mobile:subscription-expired'"));
  assert.ok(auth.includes('subscriptionApi.overview()'));
});
