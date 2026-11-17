'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const readUtf8 = (relPath) => fs.readFileSync(path.join(ROOT, relPath), 'utf8');
const rules = require('../../services/dailyPracticeRules');

test('VIDEO_CHECK_SKIP_XP is 15 and videoCheckSkipCost charges 15 XP unless in review mode', () => {
  assert.equal(rules.VIDEO_CHECK_SKIP_XP, 15);
  assert.equal(rules.videoCheckSkipCost(false), 15);
  assert.equal(rules.videoCheckSkipCost(true), 0);
});

test('skipVideoCheck endpoints, frontend clients, warning confirm dialogs, and 15 XP copy exist across Web & Mobile', () => {
  const routes = readUtf8('routes/dailyPracticeRoutes.js');
  assert.ok(routes.includes('/my/path/units/:unitId/videos/:videoId/checks/:checkId/skip'));
  assert.ok(routes.includes("'/my/path/videos/skip', '/path/videos/skip'"));

  const service = readUtf8('services/dailyPracticePathService.js');
  assert.ok(service.includes('async function skipVideoCheck('));
  assert.ok(service.includes('rules.videoCheckSkipCost(reviewMode)'));
  assert.ok(service.includes('await adjustProfileXp(sid, -cost'));
  assert.ok(service.includes('await rememberPassedCheck(sid, unit, key)'));

  const mobileCard = readUtf8('thang-tin-hoc-mobile/src/components/dailyPractice/VideoCheckpointQuizCard.tsx');
  assert.ok(mobileCard.includes('Khó quá bỏ qua'));
  assert.ok(mobileCard.includes('skipCostXp = 15'));
  assert.ok(mobileCard.includes('Cảnh báo mất ${skipCostXp} XP'));
  assert.ok(mobileCard.includes('Bỏ qua (−${skipCostXp} XP)'));

  const mobileVideo = readUtf8('thang-tin-hoc-mobile/src/components/dailyPractice/PathVideoModal.tsx');
  assert.ok(mobileVideo.includes('VIDEO_CHECK_SKIP_XP = 15'));
  assert.ok(mobileVideo.includes('dailyPracticeApi.skipVideoCheck('));

  const mobileLesson = readUtf8('thang-tin-hoc-mobile/src/screens/DailyPracticeScreen.tsx');
  assert.ok(mobileLesson.includes('dailyPracticeApi.skipVideoCheck('));
  assert.ok(mobileLesson.includes('skipCostXp={(done || watchedEnough) ? 0 : 15}'));

  const webVideo = readUtf8('client/src/components/student/dailyPractice/PathVideoModal.jsx');
  assert.ok(webVideo.includes('Khó quá bỏ qua'));
  assert.ok(webVideo.includes('VIDEO_CHECK_SKIP_XP'));
  assert.ok(webVideo.includes('dailyPracticeApi.student.skipVideoCheck('));
  assert.ok(webVideo.includes('Cảnh báo mất ${VIDEO_CHECK_SKIP_XP} XP'));

  const webLesson = readUtf8('client/src/components/student/dailyPractice/PathLessonModal.jsx');
  assert.ok(webLesson.includes('Khó quá bỏ qua'));
  assert.ok(webLesson.includes('dailyPracticeApi.student.skipVideoCheck('));
  assert.ok(webLesson.includes('Cảnh báo mất ${VIDEO_CHECK_SKIP_XP} XP'));
});
