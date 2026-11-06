'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { levelFromXp, examUpgradeXp, streakProgress, sanitizeAmounts, weekBounds, badgeEarned, monthCells } = require('../../services/lmsXpRules');

test('cấp độ theo mốc XP và danh hiệu', () => {
  assert.equal(levelFromXp(0).level, 1);
  assert.equal(levelFromXp(0).title, 'Người mới');
  assert.equal(levelFromXp(99).level, 1);
  assert.equal(levelFromXp(100).level, 2);
  assert.equal(levelFromXp(100).title, 'Bắt đầu học');
  assert.equal(levelFromXp(250).level, 3);
  assert.equal(levelFromXp(250).xpIntoLevel, 0);
  assert.equal(levelFromXp(300).xpIntoLevel, 50);
  assert.equal(levelFromXp(12000).level, 10);
  assert.equal(levelFromXp(12000).atMaxLevel, true);
  assert.equal(levelFromXp(-5).xpTotal, 0);
});

test('kiểm tra chỉ cộng phần nâng mốc', () => {
  assert.equal(examUpgradeXp(79, 0), 0);
  assert.equal(examUpgradeXp(80, 0), 20);
  assert.equal(examUpgradeXp(90, 20), 10);
  assert.equal(examUpgradeXp(100, 20), 20);
  assert.equal(examUpgradeXp(100, 40), 0);
  assert.equal(examUpgradeXp(85, 30), 0);
});

test('chuỗi ngày nối liền và đứt thì bắt đầu mốc mới', () => {
  assert.deepEqual(streakProgress({ lastStudyDay: '2026-11-05', streak: 3, streakStartedOn: '2026-11-03' }, '2026-11-05', '2026-11-04'), {
    streak: 3,
    streakStartedOn: '2026-11-03',
  });
  assert.equal(streakProgress({ lastStudyDay: '2026-11-05', streak: 3, streakStartedOn: '2026-11-03' }, '2026-11-06', '2026-11-05').streak, 4);
  assert.equal(streakProgress({ lastStudyDay: '2026-11-01', streak: 9, streakStartedOn: '2026-10-24' }, '2026-11-06', '2026-11-05').streakStartedOn, '2026-11-06');
  assert.equal(streakProgress(null, '2026-11-06', '2026-11-05').streak, 1);
});

test('số XP quản trị không âm và không vượt trần', () => {
  const amounts = sanitizeAmounts({ theory: -4, video: 10.8, course: 99999 });
  assert.equal(amounts.theory, 0);
  assert.equal(amounts.video, 10);
  assert.equal(amounts.course, 10000);
  assert.equal(amounts.practice, 20);
});

test('tuần XP tính từ thứ Hai, huy hiệu và lịch tháng', () => {
  assert.deepEqual(weekBounds('2026-11-06'), { start: '2026-11-02', end: '2026-11-09' });
  assert.equal(badgeEarned('streak_7', { bestStreak: 7 }), true);
  assert.equal(badgeEarned('legend', { xpTotal: 4999 }), false);
  assert.equal(badgeEarned('word', { courseNames: ['Word cơ bản'] }), true);
  const cells = monthCells('2026-11', ['2026-11-06'], '2026-11-06');
  assert.equal(cells[0], null);
  assert.equal(cells.filter((cell) => cell?.studied).length, 1);
});
