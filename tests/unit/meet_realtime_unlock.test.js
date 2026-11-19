'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('socketHub.emitSubscriptionRealtime broadcasts unlock/lock/subscription updates to student rooms', () => {
  const { emitSubscriptionRealtime } = require('../../config/socketHub');

  const emitted = [];
  const fakeIo = {
    to(rooms) {
      return {
        emit(event, payload) {
          emitted.push({ rooms, event, payload });
        },
      };
    },
  };

  emitSubscriptionRealtime('stu-123', { plan: '3m', state: 'active' }, { unlocked: true, io: fakeIo });
  assert.equal(emitted.length, 2);
  assert.deepEqual(emitted[0].rooms, ['stu-123', 'student_stu-123']);
  assert.equal(emitted[0].event, 'subscription:updated');
  assert.equal(emitted[0].payload.freeUnlocked, true);
  assert.equal(emitted[1].event, 'free-portal-unlocked');

  emitted.length = 0;
  emitSubscriptionRealtime('stu-123', { plan: 'lifetime', freeTier: true }, { locked: true, io: fakeIo });
  assert.equal(emitted.length, 2);
  assert.equal(emitted[0].event, 'subscription:updated');
  assert.equal(emitted[0].payload.freeUnlocked, false);
  assert.equal(emitted[1].event, 'free-portal-locked');
});

test('Meet empty schedule card does not show "Mở khóa Meet" after user registers Meet plan', () => {
  const home = read('thang-tin-hoc-mobile/src/screens/HomeScreen.tsx');
  assert.match(home, /const needsUnlockMeetCta = freeMenu && !meetAccess && user\?\.freeUnlocked !== true;/);
  assert.match(home, /label=\{needsUnlockMeetCta \? 'Mở khóa Meet' : 'Xem lịch học'\}/);
  assert.match(home, /tabNavigation\.navigate\('Schedule'\)/);
  assert.match(home, /Chưa có lịch Meet hôm nay/);

  const webEmpty = read('client/src/components/student/MeetScheduleEmptyState.jsx');
  assert.match(webEmpty, /Hôm nay chưa có lịch Meet/);
});

test('Realtime unlock events propagate without page reload across server, Mobile, and Web', () => {
  const subService = read('services/subscriptionService.js');
  assert.match(subService, /emitSubscriptionRealtime\(/);

  const socketService = read('thang-tin-hoc-mobile/src/services/socketService.ts');
  for (const ev of ['free-portal-unlocked', 'free-portal-locked', 'subscription:updated']) {
    assert.ok(socketService.includes(ev), `Mobile socketService missing ${ev}`);
  }

  const authCtx = read('thang-tin-hoc-mobile/src/app/AuthContext.tsx');
  assert.match(authCtx, /SOCKET_EVENTS\.FREE_PORTAL_UNLOCKED/);
  assert.match(authCtx, /SOCKET_EVENTS\.SUBSCRIPTION_UPDATED/);
  assert.match(authCtx, /applyRealtimeSubscriptionState/);

  const rootNav = read('thang-tin-hoc-mobile/src/navigation/RootNavigator.tsx');
  assert.match(rootNav, /hasMeetAccessClient\(subscription\?\.subscription\)/);
  assert.match(rootNav, /SOCKET_EVENTS\.FREE_PORTAL_UNLOCKED/);

  const home = read('thang-tin-hoc-mobile/src/screens/HomeScreen.tsx');
  assert.match(home, /SOCKET_EVENTS\.FREE_PORTAL_UNLOCKED/);
  assert.match(home, /mobile:free-portal-unlocked/);

  const freeFeatureLock = read('client/src/components/student/dailyPractice/FreeFeatureLock.jsx');
  assert.match(freeFeatureLock, /setUnlockOverride\(true\)/);
  assert.match(freeFeatureLock, /cms:subscription-updated/);

  const layout = read('client/src/components/DashboardLayout.jsx');
  assert.match(layout, /socket\.on\('free-portal-unlocked'/);
  assert.match(layout, /socket\.on\('subscription:updated'/);
});
