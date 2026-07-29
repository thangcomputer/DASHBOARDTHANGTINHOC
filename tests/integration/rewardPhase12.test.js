/**
 * Phase 12 — Reward (pct_5star + minSample + payout amount).
 * Gate fixture: 10 HV / 8×5★ / threshold 80% / amount 500_000 → 500_000đ.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  computeFiveStarStats,
  qualifiesForReward,
  computeRewardAmount,
  periodKeyFor,
  periodRange,
} = require('../../services/rewardService');
const { getTemplate } = require('../../constants/notificationTemplates');

function makeRatings(fiveStarCount, otherCount, otherStars = 3) {
  const rows = [];
  for (let i = 0; i < fiveStarCount; i += 1) {
    rows.push({ type: 'teacher_rating', status: 'approved', stars: 5 });
  }
  for (let i = 0; i < otherCount; i += 1) {
    rows.push({ type: 'teacher_rating', status: 'approved', stars: otherStars });
  }
  return rows;
}

test('GATE fixture: 10 HV / 8×5★ → 80% → thưởng 500.000đ', () => {
  const ratings = makeRatings(8, 2, 4);
  // thêm pending không được đếm
  ratings.push({ type: 'teacher_rating', status: 'pending', stars: 5 });
  ratings.push({ type: 'teacher_rating', status: 'rejected', stars: 5 });

  const stats = computeFiveStarStats(ratings);
  assert.equal(stats.total, 10);
  assert.equal(stats.fiveStar, 8);
  assert.equal(stats.pct, 80);

  const rule = { thresholdPct: 80, minRatings: 10, amount: 500000 };
  assert.equal(qualifiesForReward(stats, rule), true);
  assert.equal(computeRewardAmount(stats, rule), 500000);
});

test('below minSample → 0 (9 ratings dù 100% 5★)', () => {
  const stats = computeFiveStarStats(makeRatings(9, 0));
  assert.equal(stats.total, 9);
  assert.equal(stats.pct, 100);
  const rule = { thresholdPct: 80, minRatings: 10, amount: 500000 };
  assert.equal(qualifiesForReward(stats, rule), false);
  assert.equal(computeRewardAmount(stats, rule), 0);
});

test('below threshold → 0 (10 ratings / 7×5★ = 70%)', () => {
  const stats = computeFiveStarStats(makeRatings(7, 3, 3));
  assert.equal(stats.total, 10);
  assert.equal(stats.pct, 70);
  assert.equal(computeRewardAmount(stats, { thresholdPct: 80, minRatings: 10, amount: 500000 }), 0);
});

test('pending ratings excluded from public sample', () => {
  const stats = computeFiveStarStats([
    { type: 'teacher_rating', status: 'pending', stars: 5 },
    { type: 'teacher_rating', status: 'approved', stars: 5 },
  ]);
  assert.equal(stats.total, 1);
  assert.equal(stats.fiveStar, 1);
  assert.equal(stats.pct, 100);
});

test('periodKeyFor month/quarter/year', () => {
  const d = new Date(2026, 6, 15); // July 2026
  assert.equal(periodKeyFor('month', d), '2026-07');
  assert.equal(periodKeyFor('quarter', d), '2026-Q3');
  assert.equal(periodKeyFor('year', d), '2026');
  const range = periodRange('month', '2026-07');
  assert.ok(range.from);
  assert.ok(range.to);
  assert.equal(range.from.getMonth(), 6);
});

test('RewardRule + RewardPayout models', () => {
  const RewardRule = require('../../models/RewardRule');
  const RewardPayout = require('../../models/RewardPayout');
  assert.equal(RewardRule.modelName, 'RewardRule');
  assert.equal(RewardPayout.modelName, 'RewardPayout');
  assert.ok(RewardRule.schema.paths.thresholdPct);
  assert.ok(RewardRule.schema.paths.minRatings);
  assert.ok(RewardPayout.schema.paths.idempotencyKey.options.unique);
  assert.ok(RewardPayout.schema.path('status').enumValues.includes('draft'));
  assert.ok(RewardPayout.schema.path('status').enumValues.includes('paid'));
});

test('LedgerEntry source includes reward', () => {
  const LedgerEntry = require('../../models/LedgerEntry');
  assert.ok(LedgerEntry.schema.path('source').enumValues.includes('reward'));
});

test('routes + cron wired', () => {
  const routes = fs.readFileSync(path.join(__dirname, '../../routes/rewardRoutes.js'), 'utf8');
  assert.ok(routes.includes('runRewardPeriodJob'));
  assert.ok(routes.includes('/payouts/:id/approve'));
  assert.ok(routes.includes('MANAGE_HR'));

  const server = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');
  assert.ok(server.includes('rewardRoutes'));
  assert.ok(server.includes('REWARD_CRON'));
  assert.ok(server.includes('runRewardPeriodJob'));
});

test('REWARD_PAID template exists', () => {
  const t = getTemplate('REWARD_PAID');
  assert.ok(t);
  assert.equal(t.type, 'FINANCE');
});
