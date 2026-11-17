import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import {
  canMediaSeekTo,
  findTriggeredVideoCheck,
  resolveVideoCheckResumeTarget,
} from '../../shared/dailyPractice/videoCheckpointPlayback.mjs';

const require = createRequire(import.meta.url);
const { videoCheckXpConfig, VIDEO_CHECK_ANSWER_XP } = require('../../services/dailyPracticeRules');

test('findTriggeredVideoCheck: chỉ mở mốc khi đạt đúng giây mốc, không bật sớm ở giây trước', () => {
  const pending = [{ id: 'c10', atSec: 10 }, { id: 'c20', atSec: 20 }];
  assert.equal(findTriggeredVideoCheck(pending, 9.75), null);
  assert.equal(findTriggeredVideoCheck(pending, 9.99), null);
  assert.equal(findTriggeredVideoCheck(pending, 10)?.id, 'c10');
  assert.equal(findTriggeredVideoCheck(pending, 10.35)?.id, 'c10');
});

test('resolveVideoCheckResumeTarget: trả lời đúng mốc Giây 10 tiếp tục ở Giây 11 (không giật về giây 9)', () => {
  const res = resolveVideoCheckResumeTarget({
    checkAtSec: 10,
    currentTime: 9.7,
    duration: 30,
    remainingPendingChecks: [{ id: 'c20', atSec: 20 }],
  });
  assert.deepEqual(res, { action: 'resume', check: null, seekToSec: 11 });

  const exactAtSec = resolveVideoCheckResumeTarget({
    checkAtSec: 10,
    currentTime: 10.2,
    duration: 30,
    remainingPendingChecks: [{ id: 'c20', atSec: 20 }],
  });
  assert.deepEqual(exactAtSec, { action: 'resume', check: null, seekToSec: 11 });

  const alreadyAhead = resolveVideoCheckResumeTarget({
    checkAtSec: 10,
    currentTime: 11.4,
    duration: 30,
    remainingPendingChecks: [{ id: 'c20', atSec: 20 }],
  });
  assert.deepEqual(alreadyAhead, { action: 'resume', check: null, seekToSec: 11.4 });
});

test('resolveVideoCheckResumeTarget: còn câu khác cùng giây 10 thì mở câu đó, chưa nhảy qua giây 11', () => {
  const res = resolveVideoCheckResumeTarget({
    checkAtSec: 10,
    currentTime: 10.1,
    duration: 30,
    remainingPendingChecks: [{ id: 'c10b', atSec: 10 }, { id: 'c20', atSec: 20 }],
  });
  assert.equal(res.action, 'open_check');
  assert.equal(res.check?.id, 'c10b');
  assert.equal(res.seekToSec, null);
});

test('resolveVideoCheckResumeTarget: mốc ở giây cuối không bị lùi về giây trước duration', () => {
  const res = resolveVideoCheckResumeTarget({
    checkAtSec: 30,
    currentTime: 29.9,
    duration: 30,
    remainingPendingChecks: [],
  });
  assert.equal(res.action, 'resume');
  assert.ok(res.seekToSec >= 29.85 && res.seekToSec <= 30);
});

test('canMediaSeekTo: không cho phép gán currentTime trên stream WebM chưa có vùng seekable để tránh giật về 0s', () => {
  const liveWebm = {
    duration: Infinity,
    seekable: { length: 1, start: () => 0, end: () => 0 },
  };
  assert.equal(canMediaSeekTo(liveWebm, 3), false);

  const mp4Seekable = {
    duration: 30,
    seekable: { length: 1, start: () => 0, end: () => 30 },
  };
  assert.equal(canMediaSeekTo(mp4Seekable, 3), true);
  assert.equal(canMediaSeekTo(mp4Seekable, 31), false);
});

test('videoCheckXpConfig: ôn lại video/bài đã hoàn thành không cộng và không trừ XP (kể cả gợi ý)', () => {
  const firstWatchRight = videoCheckXpConfig({ isReview: false, firstPass: true, hintCostXp: 10 });
  assert.deepEqual(firstWatchRight, {
    review: false,
    wrongCost: VIDEO_CHECK_ANSWER_XP,
    hintCost: 10,
    reward: VIDEO_CHECK_ANSWER_XP,
  });

  const reviewMode = videoCheckXpConfig({ isReview: true, firstPass: true, hintCostXp: 10 });
  assert.deepEqual(reviewMode, {
    review: true,
    wrongCost: 0,
    hintCost: 0,
    reward: 0,
  });
});
