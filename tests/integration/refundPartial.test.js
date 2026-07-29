/**
 * Unit — refundService resolveRefundAmount (partial vs full).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { resolveRefundAmount } = require('../../services/refundService');

test('resolveRefundAmount: omit amount = full', () => {
  const r = resolveRefundAmount(2_500_000, undefined);
  assert.equal(r.refundAmount, 2_500_000);
  assert.equal(r.remaining, 0);
  assert.equal(r.isFull, true);
});

test('resolveRefundAmount: partial keeps remaining', () => {
  const r = resolveRefundAmount(2_500_000, 500_000);
  assert.equal(r.refundAmount, 500_000);
  assert.equal(r.remaining, 2_000_000);
  assert.equal(r.isFull, false);
});

test('resolveRefundAmount: amount === paid = full', () => {
  const r = resolveRefundAmount(1_000_000, 1_000_000);
  assert.equal(r.isFull, true);
  assert.equal(r.remaining, 0);
});

test('resolveRefundAmount: over paid → 400', () => {
  assert.throws(() => resolveRefundAmount(1000, 2000), (err) => err.status === 400);
});

test('resolveRefundAmount: zero/negative → 400', () => {
  assert.throws(() => resolveRefundAmount(1000, 0), (err) => err.status === 400);
  assert.throws(() => resolveRefundAmount(1000, -1), (err) => err.status === 400);
});

test('studentRoutes refund uses refundService', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../routes/studentRoutes.js'), 'utf8');
  assert.ok(src.includes("require('../services/refundService')"));
  assert.ok(src.includes('refundStudentPayment'));
});
