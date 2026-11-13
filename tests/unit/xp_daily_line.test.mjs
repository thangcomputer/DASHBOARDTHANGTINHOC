import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatDailyXpProgressLine,
  formatDailyXpWalletLine,
  resolveTodayXpSidebar,
} from '../../shared/subscription/xpDailyLine.mjs';

test('formatDailyXpWalletLine: ví khớp popup luyện', () => {
  assert.equal(formatDailyXpWalletLine(52, 60), '52/60 XP');
  assert.equal(formatDailyXpWalletLine(0, 60), '0/60 XP');
});

test('formatDailyXpProgressLine: vẫn giới hạn mẫu số cho quest', () => {
  assert.equal(formatDailyXpProgressLine(80, 60), '60/60 XP');
});

test('resolveTodayXpSidebar: ưu tiên xpTotal, không dùng todayXp', () => {
  const line = resolveTodayXpSidebar(
    { xpTotal: 52, todayXp: 0, todayXpCap: 60 },
    { dailyXpLimit: 60 },
  ).line;
  assert.equal(line, '52/60 XP');
});
