'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const readUtf8 = (relPath) => fs.readFileSync(path.join(ROOT, relPath), 'utf8');

test('meetJoin & shared meetStartAlert timing: disabled before startTime, popup 1m early, red/live at startTime', async () => {
  const { isMeetLiveNow, isMeetJoinWindow, isMeetEnded } = await import('../../client/src/utils/meetJoin.js');
  const { meetAlertKicker, minutesUntilMeetStart } = await import('../../shared/meetStartAlert.mjs');

  // 16:57 before 19:00–21:00
  const m1657 = 16 * 60 + 57;
  assert.equal(isMeetLiveNow({ day: '2026-11-17', startTime: '19:00', endTime: '21:00', nowDay: '2026-11-17', nowMinutes: m1657 }), false);
  assert.equal(isMeetJoinWindow({ day: '2026-11-17', startTime: '19:00', endTime: '21:00', nowDay: '2026-11-17', nowMinutes: m1657, earlyMinutes: 1 }), false);

  // 18:59 -> 1 minute before 19:00: popup opens, main join button still disabled until 19:00
  const m1859 = 18 * 60 + 59;
  assert.equal(isMeetLiveNow({ day: '2026-11-17', startTime: '19:00', endTime: '21:00', nowDay: '2026-11-17', nowMinutes: m1859 }), false);
  assert.equal(isMeetJoinWindow({ day: '2026-11-17', startTime: '19:00', endTime: '21:00', nowDay: '2026-11-17', nowMinutes: m1859, earlyMinutes: 1 }), true);
  assert.equal(minutesUntilMeetStart('19:00', m1859), 1);
  assert.equal(
    meetAlertKicker({ isLive: false, isTeacher: false, minutesUntilStart: 1 }),
    '⏰ SẮP ĐẾN GIỜ VÀO HỌC (CÒN 1 PHÚT)',
  );

  // 19:00 -> class time: live & red join button enabled
  const m1900 = 19 * 60;
  assert.equal(isMeetLiveNow({ day: '2026-11-17', startTime: '19:00', endTime: '21:00', nowDay: '2026-11-17', nowMinutes: m1900 }), true);
  assert.equal(isMeetEnded({ day: '2026-11-17', endTime: '21:00', nowDay: '2026-11-17', nowMinutes: m1900 }), false);
  assert.equal(
    meetAlertKicker({ isLive: true, isTeacher: false, minutesUntilStart: 0 }),
    '🔴 ĐÃ ĐẾN GIỜ VÀO HỌC!',
  );

  // 21:00 -> ended
  const m2100 = 21 * 60;
  assert.equal(isMeetEnded({ day: '2026-11-17', endTime: '21:00', nowDay: '2026-11-17', nowMinutes: m2100 }), true);
});

test('Mobile HomeScreen & schedule CTAs always label scheduled classes "Vào học", turn red only when joinable, and disable before start', () => {
  const home = readUtf8('thang-tin-hoc-mobile/src/screens/HomeScreen.tsx');
  assert.ok(home.includes('{primaryTodayClass ? ('), 'checks primaryTodayClass before meetEmptyMode so scheduled class never falls back to Mở khóa Meet');
  assert.ok(home.includes('variant="danger"'), 'renders red danger button when class is joinable');
  assert.ok(home.includes('label="Vào học"'), 'uses "Vào học" label for scheduled classes');
  assert.ok(!home.includes('label="Vào Meet"'), 'replaces "Vào Meet" with "Vào học" on HomeScreen');
  assert.ok(home.includes('(nextMeetForEmpty || nextLesson.length > 0)'), 'keeps dimmed disabled "Vào học" button when upcoming schedule exists');

  const mobileCard = readUtf8('thang-tin-hoc-mobile/src/components/duo/DuoScheduleCard.tsx');
  assert.ok(mobileCard.includes('variant="danger"'), 'Mobile DuoScheduleCard uses red variant when joinable');
  assert.ok(mobileCard.includes('text="Vào học"'), 'Mobile DuoScheduleCard labels button "Vào học"');
  assert.ok(!mobileCard.includes('text="Vào Meet"'), 'Mobile DuoScheduleCard replaces "Vào Meet"');

  const features = readUtf8('thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx');
  assert.ok(features.includes("diaryStatus.tone === 'ongoing' && item.meetingUrl"), 'ScheduleScreen diary gates red join button on ongoing status');
  assert.ok(features.includes("backgroundColor: '#EF4444'"), 'ScheduleScreen diary button turns red when ongoing');
  assert.ok(features.includes('>Vào học<'), 'ScheduleScreen diary button says "Vào học"');
});

test('Web overview, DuoScheduleCard, StudentDiaryLog & CSS use red live "Vào học" and disabled pre-start button', () => {
  const css = readUtf8('client/src/index.css');
  assert.ok(css.includes('@keyframes duo-meet-live-red-glow'), 'adds red glow keyframes without removing duo-meet-glow');
  assert.ok(css.includes('background: #ef4444;') && css.includes('border-bottom-color: #b91c1c;'), 'styles .duo-btn--meet-live in red');

  const overview = readUtf8('client/src/components/student/StudentOverviewTab.jsx');
  assert.ok(overview.includes('variant="danger"'), 'Web StudentOverviewTab uses red danger variant when joinable');
  assert.ok(overview.includes('label="Vào học"'), 'Web StudentOverviewTab uses "Vào học"');
  assert.ok(!overview.includes('label="Vào Meet"'), 'Web StudentOverviewTab removes "Vào Meet"');

  const webCard = readUtf8('client/src/components/duo/DuoScheduleCard.jsx');
  assert.ok(webCard.includes('variant="danger"'), 'Web DuoScheduleCard uses red danger variant when joinable');
  assert.ok(webCard.includes('label="Vào học"'), 'Web DuoScheduleCard uses "Vào học"');

  const diary = readUtf8('client/src/components/student/StudentDiaryLog.jsx');
  assert.ok(diary.includes("const isOngoing = diaryStatus.tone === 'ongoing'"), 'Web StudentDiaryLog separates ongoing vs upcoming');
  assert.ok(diary.includes('bg-red-500 hover:bg-red-600'), 'Web StudentDiaryLog uses red CTA when ongoing');
});

test('Server cron and Mobile MeetStartAlert handle 1-minute pre-class reminders for both Schedule and MeetClass', () => {
  const server = readUtf8('server.js');
  assert.ok(server.includes("const MeetClass = require('./models/MeetClass');"), 'server cron imports MeetClass');
  assert.ok(server.includes('todayMeetClasses'), 'server cron checks MeetClass 1 minute before startTime');

  const mobileAlert = readUtf8('thang-tin-hoc-mobile/src/components/MeetStartAlert.tsx');
  assert.ok(mobileAlert.includes('function resolveScheduleFallbackLink'), 'Mobile MeetStartAlert ports Web link fallback helper');
  assert.ok(mobileAlert.includes('if (!incoming.linkHoc)'), 'Mobile MeetStartAlert refetches when socket reminder lacks link');
  assert.ok(mobileAlert.includes('tickRef.current?.()'), 'Mobile MeetStartAlert calls tickRef');
  assert.ok(mobileAlert.includes('SOCKET_EVENTS.SCHEDULE_NEW'), 'Mobile MeetStartAlert refreshes on schedule:new');
  assert.ok(mobileAlert.includes('15000'), 'Mobile MeetStartAlert polls every 15s for 1-minute pre-class accuracy');
  assert.ok((mobileAlert.match(/earlyMinutes:\s*1\b/g) || []).length === 2, 'Mobile MeetStartAlert uses 1-minute pre-class window for both schedules and meet-classes');
});
