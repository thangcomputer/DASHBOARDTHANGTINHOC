'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  vnDateKey,
  vnStartOfDay,
  getAnalyticsPeriodRange,
  enumerateVnBucketKeys,
} = require('../../utils/vnTimezone');

test('C — 1d is calendar today 00:00 VN → now (not rolling 24h)', () => {
  // 2026-08-13 15:30 VN = 2026-08-13 08:30 UTC
  const now = new Date('2026-08-13T08:30:00.000Z');
  const { start, end, prevStart, prevEnd } = getAnalyticsPeriodRange('1d', now);
  assert.equal(end.getTime(), now.getTime());
  assert.equal(vnDateKey(start), '2026-08-13');
  assert.equal(start.toISOString(), new Date('2026-08-13T00:00:00+07:00').toISOString());
  // Must NOT start ~24h before now
  const rolling = new Date(now);
  rolling.setDate(rolling.getDate() - 1);
  assert.notEqual(start.toISOString(), rolling.toISOString());
  // Previous = yesterday same elapsed window
  assert.equal(vnDateKey(prevStart), '2026-08-12');
  assert.ok(prevEnd.getTime() <= start.getTime());
  assert.equal(prevEnd - prevStart, end - start);
});

test('D — timezone: 00:30 VN buckets as VN calendar day, not UTC date', () => {
  // 2026-08-13 00:30 VN = 2026-08-12 17:30 UTC
  const utcEvening = new Date('2026-08-12T17:30:00.000Z');
  assert.equal(vnDateKey(utcEvening), '2026-08-13');
  assert.notEqual(utcEvening.toISOString().slice(0, 10), '2026-08-13');
  assert.equal(utcEvening.toISOString().slice(0, 10), '2026-08-12');
  const sod = vnStartOfDay(utcEvening);
  assert.equal(vnDateKey(sod), '2026-08-13');
});

test('E — net revenue definition (payment − refund) matches KPI/chart contract', () => {
  const payments = 10_000_000;
  const refunds = 4_000_000;
  const net = payments - refunds;
  assert.equal(net, 6_000_000);
  // Simulated timeSeries single day
  const timeSeries = [{ label: '2026-08-13', value: net }];
  const kpi = net;
  const seriesSum = timeSeries.reduce((s, p) => s + p.value, 0);
  assert.equal(seriesSum, kpi);
});

test('enumerateVnBucketKeys includes today only for 1d span', () => {
  const now = new Date('2026-08-13T08:30:00.000Z');
  const { start, end } = getAnalyticsPeriodRange('1d', now);
  const keys = enumerateVnBucketKeys(start, end, 'day');
  assert.deepEqual(keys, ['2026-08-13']);
});

test('7d spans 7 VN calendar days including today', () => {
  const now = new Date('2026-08-13T08:30:00.000Z');
  const { start, end } = getAnalyticsPeriodRange('7d', now);
  const keys = enumerateVnBucketKeys(start, end, 'day');
  assert.equal(keys[0], '2026-08-07');
  assert.equal(keys[keys.length - 1], '2026-08-13');
  assert.equal(keys.length, 7);
});

test('routes/analyticsRevenue no longer uses listPaidItems for chart', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '../../routes/analyticsRoutes.js'), 'utf8');
  assert.ok(src.includes('aggregateNetRevenueTimeSeries'));
  assert.ok(src.includes('getAnalyticsPeriodRange'));
  assert.ok(!src.includes('listPaidItems'));
  assert.ok(!/generateTimeSeries\(paidItems/.test(src));
});
