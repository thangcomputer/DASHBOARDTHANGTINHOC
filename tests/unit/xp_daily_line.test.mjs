import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  formatDailyXpProgressLine,
  formatDailyXpWalletLine,
  isDailyXpExhausted,
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

test('resolveTodayXpSidebar: tài khoản theo khóa dùng hạn XP khóa học (vd 200)', () => {
  const res = resolveTodayXpSidebar(
    { xpTotal: 150, todayXpCap: 200 },
    { dailyXpLimit: 200 },
  );
  assert.equal(res.line, '150/200 XP');
  assert.equal(resolveTodayXpSidebar({ xpTotal: 0 }, { dailyXpLimit: 200 }).line, '0/200 XP');
});

test('isDailyXpExhausted: phát hiện hết XP khi loading/còn/hết và ưu tiên xpTotal mới', () => {
  assert.equal(isDailyXpExhausted(null), false);
  assert.equal(isDailyXpExhausted({ xpTotal: 200, sessionStakeXp: 50 }), false);
  assert.equal(isDailyXpExhausted({ xpTotal: 35, sessionStakeXp: 50 }), true);
  assert.equal(isDailyXpExhausted({ xpTotal: 0, xpEmpty: false }), true);
  assert.equal(isDailyXpExhausted({ xpTotal: 100, xpEmpty: true, sessionStakeXp: 50 }), false);
});

test('AppSidebar hiển thị XP/XP thay cho Khóa chính thức và hiện nút Mua XP khi hết', () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const sidebar = fs.readFileSync(path.join(root, 'client/src/components/AppSidebar.jsx'), 'utf8');
  const subUtil = fs.readFileSync(path.join(root, 'client/src/utils/subscription.js'), 'utf8');
  assert.equal(sidebar.includes("'Khóa chính thức'"), false);
  assert.equal(subUtil.includes("'Gói Khóa học · Khóa chính thức'"), false);
  assert.ok(sidebar.includes('isDailyXpExhausted(dpSidebarStats)'));
  assert.ok(sidebar.includes('Mua XP'));
  assert.ok(sidebar.includes('<BuyXpModal'));
});
