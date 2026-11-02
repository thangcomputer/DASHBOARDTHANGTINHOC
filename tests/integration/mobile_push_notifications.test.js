'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildEventNotification } = require('../../services/mobilePushService');

const ROOT = path.join(__dirname, '../..');

test('mobile push messages use safe notification text and a dedicated call channel', () => {
  assert.deepEqual(buildEventNotification('message:receive', { content: 'private text' }), {
    title: 'Tin nhắn mới',
    body: 'Bạn vừa nhận được tin nhắn mới.',
    channelId: 'default',
  });
  assert.deepEqual(buildEventNotification('call:incoming'), {
    title: 'Cuộc gọi đến',
    body: 'Bạn có một cuộc gọi đến.',
    channelId: 'calls',
    priority: 'high',
  });
  assert.equal(buildEventNotification('message:sent'), null);
  assert.equal(buildEventNotification('notification', { type: 'MESSAGE', content: 'private text' }), null);
  assert.deepEqual(buildEventNotification('notification', { type: 'FINANCE', content: 'private amount' }), {
    title: 'Thông báo tài chính',
    body: 'Bạn có thông báo mới.',
    channelId: 'default',
  });
});

test('mobile app registers native push tokens and configures notification handling', () => {
  const appConfig = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'thang-tin-hoc-mobile/app.json'),
    'utf8',
  )).expo;
  const pushService = fs.readFileSync(
    path.join(ROOT, 'thang-tin-hoc-mobile/src/services/mobilePushNotifications.ts'),
    'utf8',
  );
  const authContext = fs.readFileSync(
    path.join(ROOT, 'thang-tin-hoc-mobile/src/app/AuthContext.tsx'),
    'utf8',
  );
  const profileScreen = fs.readFileSync(
    path.join(ROOT, 'thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx'),
    'utf8',
  );
  const pushConfig = fs.readFileSync(
    path.join(ROOT, 'thang-tin-hoc-mobile/src/services/mobilePushNotifications.ts'),
    'utf8',
  );

  assert.ok(appConfig.plugins.includes('expo-notifications'));
  assert.ok(pushService.includes('Notifications.getExpoPushTokenAsync({ projectId })'));
  assert.ok(pushService.includes("mobileApiRequest('/mobile-push-tokens'"));
  assert.ok(authContext.includes('registerMobilePushNotifications'));
  assert.ok(pushConfig.includes('requestPermission = false'));
  assert.ok(profileScreen.includes('enableMobilePushNotifications()'));
  assert.ok(!profileScreen.includes("id: 'primary-course'"));
});

test('mobile API errors use safe text and enforce a bounded fetch timeout', () => {
  const apiClient = fs.readFileSync(
    path.join(ROOT, 'thang-tin-hoc-mobile/src/services/apiClient.ts'),
    'utf8',
  );
  assert.ok(apiClient.includes('API_REQUEST_TIMEOUT_MS = 20_000'));
  assert.ok(apiClient.includes("'NETWORK_TIMEOUT'"));
  assert.ok(apiClient.includes('getSafeApiErrorMessage(response.status)'));
});
