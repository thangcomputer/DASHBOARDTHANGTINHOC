'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('mobile schedule screens refresh from shared realtime schedule events', () => {
  const socket = read('thang-tin-hoc-mobile/src/services/socketService.ts');
  const scheduleScreen = read('thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx');
  const conversationScreen = read('thang-tin-hoc-mobile/src/screens/MessageScreens.tsx');

  for (const event of ['schedule:new', 'schedule:updated', 'schedule:cancelled']) {
    assert.ok(socket.includes(`instance.on('${event}'`), `socket relays ${event}`);
  }
  assert.ok(scheduleScreen.includes('SOCKET_EVENTS.SCHEDULE_NEW'));
  assert.ok(scheduleScreen.includes('SOCKET_EVENTS.DATA_REFRESH'));
  assert.ok(scheduleScreen.includes('useFocusEffect'));
  assert.ok(conversationScreen.includes('SOCKET_EVENTS.SCHEDULE_CANCELLED'));
  assert.ok(conversationScreen.includes('scheduleResource.reload()'));
});

test('backend records schedule changes in chat without duplicate client sends', () => {
  const routes = read('routes/scheduleRoutes.js');
  const conversationService = read('services/scheduleConversationService.js');
  const messageService = read('thang-tin-hoc-mobile/src/services/mockService.ts');
  const conversation = read('thang-tin-hoc-mobile/src/screens/MessageScreens.tsx');
  const inbox = read('client/src/components/Inbox.jsx');

  assert.ok(routes.includes("notifyScheduleConversation(req, schedule, 'created')"));
  assert.ok(routes.includes("notifyScheduleConversation(req, updated, 'changed'"));
  assert.ok(routes.includes("notifyScheduleConversation(req, updated, 'cancelled'"));
  assert.ok(routes.includes("notifyScheduleConversation(req, schedule, 'cancelled'"));
  assert.ok(conversationService.includes('sendCanonicalMessage'));
  assert.ok(conversationService.includes("messageType: 'system'"));
  assert.ok(!messageService.includes('sendScheduleEvent'));
  assert.ok(!conversation.includes('notifyScheduleInConversation'));
  assert.ok(!inbox.includes('notifyInboxScheduleEvent'));
});

test('mobile schedule view follows the web schedule page structure for both roles', () => {
  const scheduleScreen = read('thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx');

  assert.ok(scheduleScreen.includes('Quản lý Lịch học & Điểm danh'));
  assert.ok(scheduleScreen.includes('Quản lý Lịch dạy & Điểm danh'));
  assert.ok(!scheduleScreen.includes('Xem lịch học theo tuần và nhật ký học tập'));
  assert.ok(scheduleScreen.includes('studentDiaryFilterContainer'));
  assert.ok(scheduleScreen.includes('studentDiaryLogMeta'));
  assert.ok(scheduleScreen.includes('Xếp lịch dạy theo tuần'));
  assert.ok(scheduleScreen.includes('Nhật ký học tập'));
  assert.ok(scheduleScreen.includes('Nhật ký giảng dạy'));
  assert.ok(scheduleScreen.includes('scheduleHero'));
});
