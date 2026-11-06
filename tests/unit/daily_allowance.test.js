'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../../services/dailyPracticeRules');

test('sang ngày được lại 200 và giữ XP đã mua', () => {
  const next = rules.applyDailyAllowance({
    xpTotal: 80,
    dailyXp: 0,
    purchasedXp: 80,
    xpAllowanceDay: '2026-11-05',
  }, '2026-11-06');
  assert.equal(next.changed, true);
  assert.equal(next.dailyXp, 200);
  assert.equal(next.purchasedXp, 80);
  assert.equal(next.xpTotal, 280);
});

test('cùng ngày không đụng số đang có', () => {
  const kept = rules.applyDailyAllowance({
    xpTotal: 340,
    dailyXp: 40,
    purchasedXp: 300,
    xpAllowanceDay: '2026-11-06',
    xpBrokeDay: '',
  }, '2026-11-06');
  assert.equal(kept.changed, false);
  assert.equal(kept.xpTotal, 340);
});

test('gói Meet còn hạn thì mỗi ngày 300, XP đã mua vẫn giữ', () => {
  const next = rules.applyDailyAllowance({
    xpTotal: 150,
    dailyXp: 50,
    purchasedXp: 100,
    xpAllowanceDay: '2026-11-05',
    xpAllowanceAmount: 200,
  }, '2026-11-06', 300);
  assert.equal(next.dailyXp, 300);
  assert.equal(next.purchasedXp, 100);
  assert.equal(next.xpTotal, 400);
  assert.equal(next.xpAllowanceAmount, 300);
});

test('cùng ngày nâng 200 lên 300 thì cộng phần chênh, không trả lại XP đã tiêu', () => {
  const next = rules.applyDailyAllowance({
    xpTotal: 180,
    dailyXp: 80,
    purchasedXp: 100,
    xpAllowanceDay: '2026-11-06',
    xpAllowanceAmount: 200,
  }, '2026-11-06', 300);
  assert.equal(next.sameDayUpgrade, true);
  assert.equal(next.dailyXp, 180);
  assert.equal(next.purchasedXp, 100);
  assert.equal(next.xpTotal, 280);
});

test('hết hạn thì ngày mới về 200', () => {
  const next = rules.applyDailyAllowance({
    xpTotal: 300,
    dailyXp: 300,
    purchasedXp: 0,
    xpAllowanceDay: '2026-11-06',
    xpAllowanceAmount: 300,
  }, '2026-11-07', 200);
  assert.equal(next.dailyXp, 200);
  assert.equal(next.xpTotal, 200);
});

test('tài khoản miễn phí sang ngày chỉ được 60, XP đã mua vẫn giữ', () => {
  const next = rules.applyDailyAllowance({
    xpTotal: 260,
    dailyXp: 200,
    purchasedXp: 60,
    xpAllowanceDay: '2026-11-05',
    xpAllowanceAmount: 200,
  }, '2026-11-06', 60);
  assert.equal(next.dailyXp, 60);
  assert.equal(next.purchasedXp, 60);
  assert.equal(next.xpTotal, 120);
});

test('cùng ngày tài khoản miễn phí đang 200 thì hạ phần trong ngày còn 60', () => {
  const next = rules.applyDailyAllowance({
    xpTotal: 280,
    dailyXp: 180,
    purchasedXp: 100,
    xpAllowanceDay: '2026-11-06',
    xpAllowanceAmount: 200,
  }, '2026-11-06', 60);
  assert.equal(next.sameDayDowngrade, true);
  assert.equal(next.dailyXp, 60);
  assert.equal(next.purchasedXp, 100);
  assert.equal(next.xpTotal, 160);
});

test('trừ XP của gói trước, XP mua được cộng vào ví mua', () => {
  const spent = rules.applyXpDelta({ dailyXp: 200, purchasedXp: 100 }, -20, 'spend');
  assert.equal(spent.dailyXp, 180);
  assert.equal(spent.purchasedXp, 100);
  const bought = rules.applyXpDelta(spent, 300, 'purchase');
  assert.equal(bought.purchasedXp, 400);
  assert.equal(bought.dailyXp, 180);
  assert.equal(bought.xpTotal, 580);
});
